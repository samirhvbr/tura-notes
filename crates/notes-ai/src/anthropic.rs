use crate::{
    endpoint::validate_base,
    tidy,
    transport::{self, status_error, Clients, Flow},
    ApiKey, ChatRequest, Error, ModelInfo, Provider, Result, StopReason, StreamEvent,
};
use reqwest::Url;
use std::{io::Read, sync::atomic::AtomicBool};

const VERSION: &str = "2023-06-01";

/// The Anthropic Messages API, streamed.
///
/// Thinking is left to the model's default and the only control sent is
/// `output_config.effort`, and only when the caller set one: on Opus 5.5 an
/// explicit `thinking` setting can be a 400, and an older model rejects the
/// effort field itself.
pub struct AnthropicProvider {
    base: Url,
    key: ApiKey,
    clients: Clients,
}

impl AnthropicProvider {
    pub const DEFAULT_BASE: &'static str = "https://api.anthropic.com";
    /// The model offered first, and the one a key is tested against.
    pub const DEFAULT_MODEL: &'static str = "claude-opus-5-5";

    pub fn new(base: &str, key: ApiKey) -> Result<Self> {
        Ok(Self {
            base: validate_base(base)?,
            key,
            clients: Clients::new()?,
        })
    }

    fn url(&self, path: &str) -> Result<Url> {
        self.base
            .join(path)
            .map_err(|_| Error::Endpoint("not a URL"))
    }
}

/// The most one tool call's argument may carry.
const MAX_TOOL_INPUT: usize = 1024 * 1024;

/// A tool call's argument. An empty one is `{}`, as the API sends for a tool with
/// no required fields; anything that is not a JSON object is a reply this
/// application cannot read, and says so instead of guessing.
pub(crate) fn parse_input(json: &str) -> Result<serde_json::Value> {
    if json.trim().is_empty() {
        return Ok(serde_json::json!({}));
    }
    match serde_json::from_str::<serde_json::Value>(json) {
        Ok(value) if value.is_object() => Ok(value),
        _ => Err(Error::Protocol),
    }
}

fn stop_reason(reason: &str) -> StopReason {
    match reason {
        "tool_use" => StopReason::ToolUse,
        "end_turn" | "stop_sequence" => StopReason::EndTurn,
        "max_tokens" => StopReason::MaxTokens,
        "refusal" => StopReason::Refusal,
        other => StopReason::Other(tidy(other)),
    }
}

impl Provider for AnthropicProvider {
    fn models(&self) -> Result<Vec<ModelInfo>> {
        let mut url = self.url("v1/models")?;
        url.query_pairs_mut().append_pair("limit", "1000");
        let response = self
            .clients
            .short
            .get(url)
            .header("x-api-key", self.key.expose())
            .header("anthropic-version", VERSION)
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
        let list = value["data"].as_array().ok_or(Error::Protocol)?;
        Ok(list
            .iter()
            .filter_map(|m| {
                let id = m["id"].as_str()?;
                Some(ModelInfo {
                    id: id.to_owned(),
                    name: m["display_name"]
                        .as_str()
                        .map_or_else(|| id.to_owned(), tidy),
                })
            })
            .collect())
    }

    fn stream(
        &self,
        request: &ChatRequest,
        cancel: &AtomicBool,
        on_event: &mut dyn FnMut(StreamEvent),
    ) -> Result<StopReason> {
        let mut body = serde_json::json!({
            "model": request.model,
            "max_tokens": request.max_tokens,
            "stream": true,
            "messages": request.messages.iter()
                .map(|m| serde_json::json!({"role": m.role.as_str(), "content": m.content}))
                .collect::<Vec<_>>(),
        });
        if let Some(system) = &request.system {
            body["system"] = system.clone().into();
        }
        if let Some(effort) = request.effort {
            body["output_config"] = serde_json::json!({"effort": effort.as_str()});
        }
        if !request.tools.is_empty() {
            body["tools"] = request
                .tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.schema,
                    })
                })
                .collect::<Vec<_>>()
                .into();
        }
        let post = self
            .clients
            .stream
            .post(self.url("v1/messages")?)
            .header("x-api-key", self.key.expose())
            .header("anthropic-version", VERSION)
            .header("content-type", "application/json")
            .header("accept", "text/event-stream")
            .body(serde_json::to_vec(&body).map_err(|_| Error::Protocol)?);
        let mut stop = None;
        // A tool call arrives as a block that opens with its name, streams its
        // argument as JSON fragments, and closes. Only a closed block is a call.
        let mut open: std::collections::BTreeMap<u64, (String, String)> = Default::default();
        let done = transport::drive(post, cancel, |frame| {
            let value: serde_json::Value =
                serde_json::from_str(&frame.data).map_err(|_| Error::Protocol)?;
            match value["type"].as_str() {
                Some("content_block_delta") if value["delta"]["type"] == "text_delta" => {
                    if let Some(text) = value["delta"]["text"].as_str() {
                        on_event(StreamEvent::Text(text.to_owned()));
                    }
                }
                Some("content_block_start") if value["content_block"]["type"] == "tool_use" => {
                    let index = value["index"].as_u64().ok_or(Error::Protocol)?;
                    let name = value["content_block"]["name"]
                        .as_str()
                        .ok_or(Error::Protocol)?;
                    open.insert(index, (name.to_owned(), String::new()));
                }
                Some("content_block_delta") if value["delta"]["type"] == "input_json_delta" => {
                    let index = value["index"].as_u64().ok_or(Error::Protocol)?;
                    if let (Some((_, json)), Some(part)) = (
                        open.get_mut(&index),
                        value["delta"]["partial_json"].as_str(),
                    ) {
                        // A model cannot make this buffer grow without bound.
                        if json.len() + part.len() > MAX_TOOL_INPUT {
                            return Err(Error::Protocol);
                        }
                        json.push_str(part);
                    }
                }
                Some("content_block_stop") => {
                    if let Some(index) = value["index"].as_u64() {
                        if let Some((name, json)) = open.remove(&index) {
                            on_event(StreamEvent::ToolCall {
                                name,
                                input: parse_input(&json)?,
                            });
                        }
                    }
                }
                Some("message_delta") => {
                    if let Some(reason) = value["delta"]["stop_reason"].as_str() {
                        stop = Some(stop_reason(reason));
                    }
                }
                Some("message_stop") => return Ok(Flow::Done),
                Some("error") => {
                    let message = value["error"]["message"]
                        .as_str()
                        .unwrap_or("unknown error");
                    return Err(Error::Provider(tidy(message)));
                }
                _ => {} // message_start, content_block_start/stop, thinking_delta, ping
            }
            Ok(Flow::Continue)
        })?;
        // A body that ends before `message_stop` is a truncated reply, not a
        // finished one.
        if done {
            Ok(stop.unwrap_or(StopReason::EndTurn))
        } else {
            Err(Error::Protocol)
        }
    }
}
