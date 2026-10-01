use crate::{
    endpoint::validate_base,
    tidy,
    transport::{self, status_error, Clients, Flow},
    ApiKey, ChatRequest, Error, ModelInfo, Provider, Result, StopReason, StreamEvent,
};
use reqwest::Url;
use std::{io::Read, sync::atomic::AtomicBool};

/// Which field carries the reply's length limit. OpenAI's own current models
/// reject `max_tokens` and want `max_completion_tokens`; the servers that
/// imitate the API (Ollama, LM Studio, vLLM, OpenRouter) take `max_tokens`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenLimit {
    MaxTokens,
    MaxCompletionTokens,
}

impl TokenLimit {
    /// What the host calls for. A host this crate does not know gets the field
    /// the imitations accept, which OpenAI's own API is the exception to.
    fn for_host(host: &str) -> Self {
        if host.eq_ignore_ascii_case("api.openai.com") {
            Self::MaxCompletionTokens
        } else {
            Self::MaxTokens
        }
    }

    fn field(self) -> &'static str {
        match self {
            Self::MaxTokens => "max_tokens",
            Self::MaxCompletionTokens => "max_completion_tokens",
        }
    }
}

/// Any server that speaks the OpenAI chat-completions protocol: OpenAI itself,
/// OpenRouter, and a local Ollama or LM Studio, which is why the key is
/// optional. A local server asks for none, and sending a header with nothing in
/// it would be worse than sending none.
///
/// `effort` is not sent. It is an Anthropic control with no portable spelling
/// here, and a server that does not know a field may refuse the request.
pub struct OpenAiProvider {
    base: Url,
    key: Option<ApiKey>,
    limit: TokenLimit,
    clients: Clients,
}

impl OpenAiProvider {
    pub const DEFAULT_BASE: &'static str = "https://api.openai.com/v1";

    pub fn new(base: &str, key: Option<ApiKey>) -> Result<Self> {
        let base = validate_base(base)?;
        let limit = TokenLimit::for_host(base.host_str().unwrap_or_default());
        Ok(Self {
            base,
            key,
            limit,
            clients: Clients::new()?,
        })
    }

    /// Override the field chosen from the host, for a server that wants the
    /// other one.
    pub fn with_token_limit(mut self, limit: TokenLimit) -> Self {
        self.limit = limit;
        self
    }

    fn url(&self, path: &str) -> Result<Url> {
        self.base
            .join(path)
            .map_err(|_| Error::Endpoint("not a URL"))
    }

    fn authorize(
        &self,
        request: reqwest::blocking::RequestBuilder,
    ) -> reqwest::blocking::RequestBuilder {
        match &self.key {
            Some(key) => request.header("authorization", format!("Bearer {}", key.expose())),
            None => request,
        }
    }
}

fn stop_reason(reason: &str) -> StopReason {
    match reason {
        "stop" => StopReason::EndTurn,
        "length" => StopReason::MaxTokens,
        "content_filter" => StopReason::Refusal,
        other => StopReason::Other(tidy(other)),
    }
}

impl Provider for OpenAiProvider {
    fn models(&self) -> Result<Vec<ModelInfo>> {
        let response = self
            .authorize(self.clients.short.get(self.url("models")?))
            .send()
            .map_err(|_| Error::Offline)?;
        let status = response.status().as_u16();
        let mut body = vec![];
        response
            .take(2 * 1024 * 1024)
            .read_to_end(&mut body)
            .map_err(|_| Error::Offline)?;
        if !(200..300).contains(&status) {
            return Err(status_error(status, &body));
        }
        let value: serde_json::Value =
            serde_json::from_slice(&body).map_err(|_| Error::Protocol)?;
        let mut models: Vec<ModelInfo> = value["data"]
            .as_array()
            .ok_or(Error::Protocol)?
            .iter()
            .filter_map(|m| {
                let id = tidy(m["id"].as_str()?);
                Some(ModelInfo {
                    name: id.clone(),
                    id,
                })
            })
            .collect();
        models.sort_by(|a, b| a.id.cmp(&b.id));
        Ok(models)
    }

    fn stream(
        &self,
        request: &ChatRequest,
        cancel: &AtomicBool,
        on_event: &mut dyn FnMut(StreamEvent),
    ) -> Result<StopReason> {
        let mut messages = vec![];
        if let Some(system) = &request.system {
            messages.push(serde_json::json!({"role": "system", "content": system}));
        }
        messages.extend(
            request
                .messages
                .iter()
                .map(|m| serde_json::json!({"role": m.role.as_str(), "content": m.content})),
        );
        let mut body = serde_json::json!({
            "model": request.model,
            "messages": messages,
            "stream": true,
        });
        body[self.limit.field()] = request.max_tokens.into();
        let post = self
            .authorize(self.clients.stream.post(self.url("chat/completions")?))
            .header("content-type", "application/json")
            .header("accept", "text/event-stream")
            .body(serde_json::to_vec(&body).map_err(|_| Error::Protocol)?);

        let mut stop = None;
        let mut refused = false;
        let done = transport::drive(post, cancel, |frame| {
            if frame.data.trim() == "[DONE]" {
                return Ok(Flow::Done);
            }
            let value: serde_json::Value =
                serde_json::from_str(&frame.data).map_err(|_| Error::Protocol)?;
            if let Some(error) = value.get("error").filter(|e| !e.is_null()) {
                let message = error["message"].as_str().unwrap_or("unknown error");
                return Err(Error::Provider(tidy(message)));
            }
            let choice = &value["choices"][0];
            // `content` is null on the role chunk and on the last one; a model
            // that reasons aloud sends `reasoning_content`, which is not ours.
            if let Some(text) = choice["delta"]["content"]
                .as_str()
                .filter(|t| !t.is_empty())
            {
                on_event(StreamEvent::Text(text.to_owned()));
            }
            // OpenAI says a refusal in its own field, then finishes with "stop".
            if let Some(text) = choice["delta"]["refusal"]
                .as_str()
                .filter(|t| !t.is_empty())
            {
                refused = true;
                on_event(StreamEvent::Text(text.to_owned()));
            }
            if let Some(reason) = choice["finish_reason"].as_str() {
                stop = Some(stop_reason(reason));
            }
            Ok(Flow::Continue)
        })?;
        // OpenAI ends with `[DONE]`. A server that closes the stream after a
        // finish reason without it has still finished; one that closes with no
        // finish reason at all has been cut off.
        let reason = match (done, stop) {
            (_, Some(reason)) => reason,
            (true, None) => StopReason::EndTurn,
            (false, None) => return Err(Error::Protocol),
        };
        Ok(if refused { StopReason::Refusal } else { reason })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_openais_own_host_wants_the_newer_length_field() {
        assert_eq!(
            TokenLimit::for_host("api.openai.com"),
            TokenLimit::MaxCompletionTokens
        );
        assert_eq!(
            TokenLimit::for_host("API.OPENAI.COM"),
            TokenLimit::MaxCompletionTokens
        );
        for host in [
            "openrouter.ai",
            "localhost",
            "127.0.0.1",
            "api.openai.com.evil.test",
        ] {
            assert_eq!(TokenLimit::for_host(host), TokenLimit::MaxTokens, "{host}");
        }
    }
}
