//! The shapes the AI assistant's settings screen and commands exchange with the
//! interface (ADR-100). Data only: no network and no keychain is touched here,
//! and nothing in this module can reach either. Those live in `notes-ai`, and
//! the shell joins the two.

use crate::settings::AiProviderKind;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A configured provider as the screen shows it. Whether a key is set is read
/// from the keychain for this view and is stored nowhere.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiProviderView {
    pub id: String,
    pub kind: AiProviderKind,
    pub name: String,
    pub base_url: String,
    pub model: String,
    pub key_configured: bool,
}

/// What the screen sends to add or change a provider. `id` is `None` to add one;
/// the shell chooses the id. The key is not here: it goes through its own
/// command, once, inward.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiProviderInput {
    pub id: Option<String>,
    pub kind: AiProviderKind,
    pub name: String,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AiKeychainState {
    Available,
    /// No keychain on this system: the assistant cannot hold a key, and says so.
    Unavailable,
    /// There is one and it refused: locked, or denied.
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiOverview {
    pub enabled: bool,
    pub default_provider: Option<String>,
    pub keychain: AiKeychainState,
    pub providers: Vec<AiProviderView>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiModel {
    pub id: String,
    pub name: String,
}

/// The result of testing a provider: the models its key can use. A key the
/// provider refuses is an [`AiError`] and not an empty list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiTest {
    pub models: Vec<AiModel>,
}

/// Why a command did not do what was asked, as a code the interface turns into
/// a sentence of its own, never one it shows verbatim (the provider's own words
/// travel in `detail`, shortened).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum AiErrorCode {
    /// The assistant is switched off, and a switched-off assistant opens no
    /// connection (ADR-007).
    Disabled,
    KeychainUnavailable,
    KeychainFailed,
    UnknownProvider,
    InvalidName,
    InvalidEndpoint,
    InvalidModel,
    InvalidKey,
    /// A provider that needs a key has none.
    NoKey,
    TooManyProviders,
    Unauthorized,
    RateLimited,
    Offline,
    Protocol,
    /// The provider's own explanation is in `detail`.
    Provider,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AiError {
    pub code: AiErrorCode,
    pub detail: Option<String>,
}

impl AiError {
    pub fn new(code: AiErrorCode) -> Self {
        Self { code, detail: None }
    }
    pub fn with(code: AiErrorCode, detail: impl Into<String>) -> Self {
        Self {
            code,
            detail: Some(detail.into()),
        }
    }
}

impl std::fmt::Display for AiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self.code)?;
        if let Some(detail) = &self.detail {
            write!(f, ": {detail}")?;
        }
        Ok(())
    }
}

impl std::error::Error for AiError {}
