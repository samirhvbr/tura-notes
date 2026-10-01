//! Provider clients for the opt-in AI assistant (ADR-100).
//!
//! Everything here runs in Rust, never in the webview: the desktop CSP gives the
//! page no network, and an API key must not cross into it. This crate does the
//! network and the stream parsing and nothing else. It reads no note and writes
//! no file; what is sent is built by the caller, and what comes back is handed
//! over as text.
//!
//! No key, no prompt and no reply is ever logged, and a key is held in a type
//! whose `Debug` prints nothing of it.

mod anthropic;
mod endpoint;
mod keychain;
mod openai;
mod sse;
mod transport;

pub use anthropic::AnthropicProvider;
pub use endpoint::validate_base;
pub use keychain::{KeyStore, KeychainError, MemoryKeyStore, SystemKeychain, SERVICE};
pub use openai::{OpenAiProvider, TokenLimit};

use std::sync::atomic::AtomicBool;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// 401 or 403: the provider does not accept this key.
    #[error("the provider did not accept the API key")]
    Unauthorized,
    /// 429: too many requests or too many tokens for this key.
    #[error("the provider is limiting this key; try again shortly")]
    RateLimited,
    /// No answer: DNS, connection, TLS, or a stream that went quiet.
    #[error("the provider could not be reached")]
    Offline,
    /// An answer this application does not understand, or a stream that ended
    /// before it said it was done.
    #[error("the provider answered something this application cannot read")]
    Protocol,
    /// The provider's own explanation, shortened and stripped of control
    /// characters. It is the provider's text about the request, never the key.
    #[error("the provider reported an error: {0}")]
    Provider(String),
    /// The base URL breaks a rule in [`validate_base`].
    #[error("this endpoint is not allowed: {0}")]
    Endpoint(&'static str),
    /// The caller stopped the stream.
    #[error("cancelled")]
    Cancelled,
}

pub type Result<T> = std::result::Result<T, Error>;

/// An API key. It has no `Display`, and its `Debug` is a fixed string, so it
/// cannot reach a log line or an error message by accident.
#[derive(Clone)]
pub struct ApiKey(String);

impl ApiKey {
    /// `None` for a key that is empty or holds anything a header cannot carry.
    pub fn new(key: impl Into<String>) -> Option<Self> {
        let key = key.into();
        let valid =
            !key.is_empty() && key.len() <= 512 && key.bytes().all(|b| b.is_ascii_graphic());
        valid.then_some(Self(key))
    }

    pub(crate) fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for ApiKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ApiKey(…)")
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    User,
    Assistant,
}

impl Role {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Role::User => "user",
            Role::Assistant => "assistant",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: Role,
    pub content: String,
}

/// How much thinking a model does, where the model has the control. Left unset
/// the provider's default applies, which is what an older model needs: Haiku
/// and Sonnet 4.5 reject the field.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Effort {
    Low,
    Medium,
    High,
    Xhigh,
    Max,
}

impl Effort {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Effort::Low => "low",
            Effort::Medium => "medium",
            Effort::High => "high",
            Effort::Xhigh => "xhigh",
            Effort::Max => "max",
        }
    }
}

/// A tool the model may call. The schema is JSON Schema for its one object
/// argument. Calls are not run here: this crate hands the call back, whole, and
/// the caller decides what it does (ADR-100 has the model edit through the
/// editor, never through this crate).
#[derive(Debug, Clone)]
pub struct ToolSpec {
    pub name: String,
    pub description: String,
    pub schema: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ChatRequest {
    pub model: String,
    pub system: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub max_tokens: u32,
    pub effort: Option<Effort>,
    /// Empty for a plain conversation.
    pub tools: Vec<ToolSpec>,
}

/// Why the model stopped. `Refusal` and `MaxTokens` are results the interface
/// must say out loud, not errors: the text so far is real.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StopReason {
    EndTurn,
    /// The model stopped to call tools. The calls have been handed back already.
    ToolUse,
    MaxTokens,
    Refusal,
    Other(String),
}

#[derive(Debug, Clone, PartialEq)]
pub enum StreamEvent {
    Text(String),
    /// One complete tool call, delivered when the model has finished writing its
    /// argument: never a fragment of one.
    ToolCall {
        name: String,
        input: serde_json::Value,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
}

pub trait Provider {
    /// The models this key can use. Doubles as the key test: a key the
    /// provider refuses fails here with [`Error::Unauthorized`].
    fn models(&self) -> Result<Vec<ModelInfo>>;

    /// Stream one reply. `on_event` gets each piece of text as it arrives.
    /// `cancel` is checked between pieces and while waiting, so a stop is
    /// prompt even if the provider has gone quiet.
    fn stream(
        &self,
        request: &ChatRequest,
        cancel: &AtomicBool,
        on_event: &mut dyn FnMut(StreamEvent),
    ) -> Result<StopReason>;
}

/// Shorten and clean text that came from a provider before it becomes part of
/// an error.
pub(crate) fn tidy(text: &str) -> String {
    text.chars()
        .filter(|c| !c.is_control() || *c == ' ')
        .take(300)
        .collect()
}
