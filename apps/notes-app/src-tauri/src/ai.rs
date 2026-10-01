//! The AI assistant's settings commands (ADR-100).
//!
//! The logic is small pure functions over the assistant's settings and a
//! [`KeyStore`], so it is tested without a window or a keychain; the commands at
//! the bottom only fetch the settings, run one of them off the UI thread, and
//! store the result.
//!
//! What the commands guarantee, and the tests hold them to:
//!
//! - Every provider edit is validated here, in Rust, never trusted from the
//!   page: a name, a model, and a base URL that is `https` (or `http` for
//!   loopback only).
//! - A key travels once, inward, through [`ai_key_set`], goes to the keychain and
//!   is forgotten. Nothing returns it, and no error carries it.
//! - Nothing that opens a connection runs unless the assistant is switched on.
//! - The generic `settings_set` cannot change the assistant's section, so no
//!   page can get around the validation above by writing the file's shape.

use crate::commands::App;
use notes_ai::{
    AnthropicProvider, ApiKey, Error as AiFailure, KeyStore, KeychainError, OpenAiProvider,
    Provider, SystemKeychain,
};
use notes_core::assistant::{
    AiError, AiErrorCode, AiKeychainState, AiModel, AiOverview, AiProviderInput, AiProviderView,
    AiTest,
};
use notes_core::settings::{AiProviderKind, AiProviderSettings, AiSettings};
use notes_core::Settings;
use tauri::State;

const MAX_PROVIDERS: usize = 12;

fn internal() -> AiError {
    AiError::new(AiErrorCode::Internal)
}

fn keychain_error(error: KeychainError) -> AiError {
    AiError::new(match error {
        KeychainError::Unavailable => AiErrorCode::KeychainUnavailable,
        KeychainError::Failed => AiErrorCode::KeychainFailed,
    })
}

/// A provider's failure as a code. The provider's own sentence is carried in
/// `detail`, already shortened by `notes-ai`; the key is never in it.
fn provider_error(error: AiFailure) -> AiError {
    match error {
        AiFailure::Unauthorized => AiError::new(AiErrorCode::Unauthorized),
        AiFailure::RateLimited => AiError::new(AiErrorCode::RateLimited),
        AiFailure::Offline | AiFailure::Cancelled => AiError::new(AiErrorCode::Offline),
        AiFailure::Protocol => AiError::new(AiErrorCode::Protocol),
        AiFailure::Provider(said) => AiError::with(AiErrorCode::Provider, said),
        AiFailure::Endpoint(rule) => AiError::with(AiErrorCode::InvalidEndpoint, rule),
    }
}

pub(crate) fn overview(ai: &AiSettings, store: &dyn KeyStore) -> AiOverview {
    let keychain = match store.available() {
        Ok(()) => AiKeychainState::Available,
        Err(KeychainError::Unavailable) => AiKeychainState::Unavailable,
        Err(KeychainError::Failed) => AiKeychainState::Failed,
    };
    let providers = ai
        .providers
        .iter()
        .map(|p| AiProviderView {
            id: p.id.clone(),
            kind: p.kind,
            name: p.name.clone(),
            base_url: p.base_url.clone(),
            model: p.model.clone(),
            // Asked of the keychain each time; with none there is no key to find.
            key_configured: keychain == AiKeychainState::Available
                && matches!(store.get(&p.id), Ok(Some(_))),
        })
        .collect();
    AiOverview {
        enabled: ai.enabled,
        default_provider: ai.default_provider.clone(),
        keychain,
        providers,
    }
}

fn clean_name(name: &str) -> Result<String, AiError> {
    let name = name.trim();
    let valid =
        !name.is_empty() && name.chars().count() <= 60 && !name.chars().any(char::is_control);
    if valid {
        Ok(name.to_owned())
    } else {
        Err(AiError::new(AiErrorCode::InvalidName))
    }
}

/// A model id as every provider here writes one: `claude-opus-5-5`,
/// `gpt-4o-mini`, `llama3.1:8b`, `anthropic/claude-opus-4`.
fn clean_model(model: &str) -> Result<String, AiError> {
    let model = model.trim();
    let valid = !model.is_empty()
        && model.len() <= 100
        && model.bytes().all(|b| {
            b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-' | b':' | b'/' | b'@')
        });
    if valid {
        Ok(model.to_owned())
    } else {
        Err(AiError::new(AiErrorCode::InvalidModel))
    }
}

/// The base URL as it will be stored: checked by the same rules the client
/// enforces, and without a trailing slash. An Anthropic provider may leave it
/// empty for the official API; the others must name a server.
fn clean_base(kind: AiProviderKind, base: &str) -> Result<String, AiError> {
    let base = base.trim();
    let base = match (base.is_empty(), kind) {
        (true, AiProviderKind::Anthropic) => AnthropicProvider::DEFAULT_BASE,
        (true, AiProviderKind::OpenAiCompatible) => {
            return Err(AiError::with(
                AiErrorCode::InvalidEndpoint,
                "a server address is needed",
            ))
        }
        (false, _) => base,
    };
    notes_ai::validate_base(base)
        .map(|url| url.as_str().trim_end_matches('/').to_owned())
        .map_err(provider_error)
}

fn position(ai: &AiSettings, id: &str) -> Result<usize, AiError> {
    ai.providers
        .iter()
        .position(|p| p.id == id)
        .ok_or_else(|| AiError::new(AiErrorCode::UnknownProvider))
}

/// Add a provider, or change one when `input.id` names it. Returns its id.
pub(crate) fn save_provider(
    ai: &mut AiSettings,
    input: AiProviderInput,
) -> Result<String, AiError> {
    let name = clean_name(&input.name)?;
    let base_url = clean_base(input.kind, &input.base_url)?;
    let model = clean_model(&input.model)?;
    let id = match &input.id {
        Some(id) => {
            position(ai, id)?;
            id.clone()
        }
        None => {
            if ai.providers.len() >= MAX_PROVIDERS {
                return Err(AiError::new(AiErrorCode::TooManyProviders));
            }
            uuid::Uuid::new_v4().to_string()
        }
    };
    let saved = AiProviderSettings {
        id: id.clone(),
        kind: input.kind,
        name,
        base_url,
        model,
    };
    match ai.providers.iter_mut().find(|p| p.id == id) {
        Some(existing) => *existing = saved,
        None => ai.providers.push(saved),
    }
    if ai.default_provider.is_none() {
        ai.default_provider = Some(id.clone());
    }
    Ok(id)
}

/// Remove a provider and its key. A keychain that refuses to forget the key
/// stops the removal, so a key is never left behind with nothing to name it. No
/// keychain at all means there is no key to leave.
pub(crate) fn remove_provider(
    ai: &mut AiSettings,
    id: &str,
    store: &dyn KeyStore,
) -> Result<(), AiError> {
    let index = position(ai, id)?;
    match store.clear(id) {
        Ok(()) | Err(KeychainError::Unavailable) => {}
        Err(error) => return Err(keychain_error(error)),
    }
    ai.providers.remove(index);
    if ai.default_provider.as_deref() == Some(id) {
        ai.default_provider = ai.providers.first().map(|p| p.id.clone());
    }
    Ok(())
}

pub(crate) fn set_default(ai: &mut AiSettings, id: &str) -> Result<(), AiError> {
    position(ai, id)?;
    ai.default_provider = Some(id.to_owned());
    Ok(())
}

/// Store a key in the keychain. The text is checked, stored, and not kept.
pub(crate) fn set_key(
    ai: &AiSettings,
    id: &str,
    key: &str,
    store: &dyn KeyStore,
) -> Result<(), AiError> {
    position(ai, id)?;
    let key = ApiKey::new(key.trim()).ok_or_else(|| AiError::new(AiErrorCode::InvalidKey))?;
    store.set(id, &key).map_err(keychain_error)
}

pub(crate) fn clear_key(ai: &AiSettings, id: &str, store: &dyn KeyStore) -> Result<(), AiError> {
    position(ai, id)?;
    store.clear(id).map_err(keychain_error)
}

/// The client for a provider, or why there is none. **Refuses while the
/// assistant is off**, which is what keeps ADR-007's promise that a switched-off
/// assistant opens no connection: nothing that talks to a server is built
/// without passing here.
pub(crate) fn build(
    ai: &AiSettings,
    id: &str,
    store: &dyn KeyStore,
) -> Result<Box<dyn Provider + Send>, AiError> {
    if !ai.enabled {
        return Err(AiError::new(AiErrorCode::Disabled));
    }
    let config = &ai.providers[position(ai, id)?];
    let key = match store.get(id) {
        Ok(key) => key,
        // A local server needs no key, so a system with no keychain can still
        // reach one. A provider that does need a key finds out below.
        Err(KeychainError::Unavailable) if config.kind == AiProviderKind::OpenAiCompatible => None,
        Err(error) => return Err(keychain_error(error)),
    };
    Ok(match config.kind {
        AiProviderKind::Anthropic => {
            let key = key.ok_or_else(|| AiError::new(AiErrorCode::NoKey))?;
            Box::new(AnthropicProvider::new(&config.base_url, key).map_err(provider_error)?)
        }
        AiProviderKind::OpenAiCompatible => {
            Box::new(OpenAiProvider::new(&config.base_url, key).map_err(provider_error)?)
        }
    })
}

/// Ask a provider what its key can use. This is the key test: a provider that
/// refuses the key says so here, and it is an error, never an empty list.
pub(crate) fn test(provider: &dyn Provider) -> Result<AiTest, AiError> {
    let models = provider.models().map_err(provider_error)?;
    Ok(AiTest {
        models: models
            .into_iter()
            .map(|m| AiModel {
                id: m.id,
                name: m.name,
            })
            .collect(),
    })
}

/// The settings a page sent, with the assistant's section put back as it was.
/// The generic `settings_set` takes a whole `Settings`, and a page that could
/// change `ai` through it would skip every check above.
pub(crate) fn keep_ai(mut incoming: Settings, current: &Settings) -> Settings {
    incoming.ai = current.ai.clone();
    incoming
}

// ---- commands -------------------------------------------------------------

fn read_ai(app: &State<'_, App>) -> Result<AiSettings, AiError> {
    let svc = app.svc.lock().map_err(|_| internal())?;
    Ok(svc.settings().ai.clone())
}

fn write_ai(app: &State<'_, App>, ai: AiSettings) -> Result<(), AiError> {
    let mut svc = app.svc.lock().map_err(|_| internal())?;
    let mut settings = svc.settings().clone();
    settings.ai = ai;
    svc.set_settings(settings).map_err(|_| internal())
}

/// Run on a thread of its own: a keychain call on Linux is a D-Bus round trip
/// and may wait on an unlock prompt, and neither belongs on the UI thread.
async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T, AiError> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| internal())
}

/// Change the assistant's settings with `change`, store the result when it
/// succeeded, and return the screen's new view of them.
async fn modify(
    app: &State<'_, App>,
    change: impl FnOnce(&mut AiSettings, &dyn KeyStore) -> Result<(), AiError> + Send + 'static,
) -> Result<AiOverview, AiError> {
    let mut ai = read_ai(app)?;
    let (result, ai, view) = blocking(move || {
        let store = SystemKeychain;
        let result = change(&mut ai, &store);
        let view = overview(&ai, &store);
        (result, ai, view)
    })
    .await?;
    result?;
    write_ai(app, ai)?;
    Ok(view)
}

#[tauri::command]
pub async fn ai_overview(app: State<'_, App>) -> Result<AiOverview, AiError> {
    let ai = read_ai(&app)?;
    blocking(move || overview(&ai, &SystemKeychain)).await
}

#[tauri::command]
pub async fn ai_set_enabled(app: State<'_, App>, enabled: bool) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, _| {
        ai.enabled = enabled;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn ai_provider_save(
    app: State<'_, App>,
    provider: AiProviderInput,
) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, _| save_provider(ai, provider).map(|_| ())).await
}

#[tauri::command]
pub async fn ai_provider_remove(app: State<'_, App>, id: String) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, store| remove_provider(ai, &id, store)).await
}

#[tauri::command]
pub async fn ai_set_default(app: State<'_, App>, id: String) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, _| set_default(ai, &id)).await
}

/// The one place a key enters. It is stored in the keychain and nowhere else,
/// and the answer is the new overview, which says only that one is configured.
#[tauri::command]
pub async fn ai_key_set(
    app: State<'_, App>,
    id: String,
    key: String,
) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, store| set_key(ai, &id, &key, store)).await
}

#[tauri::command]
pub async fn ai_key_clear(app: State<'_, App>, id: String) -> Result<AiOverview, AiError> {
    modify(&app, move |ai, store| clear_key(ai, &id, store)).await
}

/// Test a provider by listing its models. Opens a connection, so it needs the
/// assistant switched on.
#[tauri::command]
pub async fn ai_test(app: State<'_, App>, id: String) -> Result<AiTest, AiError> {
    let ai = read_ai(&app)?;
    blocking(move || build(&ai, &id, &SystemKeychain).and_then(|p| test(p.as_ref()))).await?
}

#[cfg(test)]
mod tests {
    use super::*;
    use notes_ai::{MemoryKeyStore, ModelInfo};

    fn input(kind: AiProviderKind, name: &str, base: &str, model: &str) -> AiProviderInput {
        AiProviderInput {
            id: None,
            kind,
            name: name.into(),
            base_url: base.into(),
            model: model.into(),
        }
    }

    fn ollama() -> AiProviderInput {
        input(
            AiProviderKind::OpenAiCompatible,
            "Ollama",
            "http://localhost:11434/v1/",
            "llama3.1:8b",
        )
    }

    fn claude() -> AiProviderInput {
        input(AiProviderKind::Anthropic, "Claude", "", "claude-opus-5-5")
    }

    fn code<T>(result: Result<T, AiError>) -> AiErrorCode {
        match result {
            Err(error) => error.code,
            Ok(_) => panic!("expected an error"),
        }
    }

    #[test]
    fn a_provider_is_added_with_a_generated_id_and_the_first_becomes_the_default() {
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        let b = save_provider(&mut ai, ollama()).unwrap();
        assert_ne!(a, b);
        assert_eq!(ai.default_provider.as_deref(), Some(a.as_str()));
        assert_eq!(
            ai.providers[0].base_url, "https://api.anthropic.com",
            "empty means the official API"
        );
        assert_eq!(
            ai.providers[1].base_url, "http://localhost:11434/v1",
            "stored without a trailing slash"
        );
        set_default(&mut ai, &b).unwrap();
        assert_eq!(ai.default_provider.as_deref(), Some(b.as_str()));
        assert_eq!(
            code(set_default(&mut ai, "nope")),
            AiErrorCode::UnknownProvider
        );
    }

    #[test]
    fn editing_keeps_the_id_and_an_unknown_id_is_refused() {
        let mut ai = AiSettings::default();
        let id = save_provider(&mut ai, claude()).unwrap();
        let mut edit = claude();
        edit.id = Some(id.clone());
        edit.name = "Claude, trabalho".into();
        assert_eq!(save_provider(&mut ai, edit).unwrap(), id);
        assert_eq!(
            (ai.providers.len(), ai.providers[0].name.as_str()),
            (1, "Claude, trabalho")
        );
        let mut ghost = claude();
        ghost.id = Some("not-there".into());
        assert_eq!(
            code(save_provider(&mut ai, ghost)),
            AiErrorCode::UnknownProvider
        );
    }

    #[test]
    fn every_field_is_validated_here_and_not_trusted_from_the_page() {
        let mut ai = AiSettings::default();
        let cases = [
            (
                input(AiProviderKind::Anthropic, "", "", "m"),
                AiErrorCode::InvalidName,
            ),
            (
                input(AiProviderKind::Anthropic, &"x".repeat(61), "", "m"),
                AiErrorCode::InvalidName,
            ),
            (
                input(AiProviderKind::Anthropic, "a\nb", "", "m"),
                AiErrorCode::InvalidName,
            ),
            (
                input(AiProviderKind::Anthropic, "n", "", ""),
                AiErrorCode::InvalidModel,
            ),
            (
                input(AiProviderKind::Anthropic, "n", "", "m; rm -rf"),
                AiErrorCode::InvalidModel,
            ),
            (
                input(AiProviderKind::Anthropic, "n", "", "a b"),
                AiErrorCode::InvalidModel,
            ),
            (
                input(AiProviderKind::OpenAiCompatible, "n", "", "m"),
                AiErrorCode::InvalidEndpoint,
            ),
            (
                input(
                    AiProviderKind::OpenAiCompatible,
                    "n",
                    "http://example.org/v1",
                    "m",
                ),
                AiErrorCode::InvalidEndpoint,
            ),
            (
                input(
                    AiProviderKind::OpenAiCompatible,
                    "n",
                    "https://u:p@example.org",
                    "m",
                ),
                AiErrorCode::InvalidEndpoint,
            ),
            (
                input(
                    AiProviderKind::OpenAiCompatible,
                    "n",
                    "file:///etc/passwd",
                    "m",
                ),
                AiErrorCode::InvalidEndpoint,
            ),
        ];
        for (case, expected) in cases {
            let shown = format!("{case:?}");
            assert_eq!(code(save_provider(&mut ai, case)), expected, "{shown}");
        }
        assert!(ai.providers.is_empty(), "a refused provider is not stored");
        for ok in [
            "claude-opus-5-5",
            "gpt-4o-mini",
            "llama3.1:8b",
            "anthropic/claude-opus-4",
            "m@v1",
        ] {
            assert!(
                save_provider(&mut ai, input(AiProviderKind::Anthropic, "n", "", ok)).is_ok(),
                "{ok}"
            );
        }
    }

    #[test]
    fn the_number_of_providers_is_bounded() {
        let mut ai = AiSettings::default();
        for _ in 0..MAX_PROVIDERS {
            save_provider(&mut ai, claude()).unwrap();
        }
        assert_eq!(
            code(save_provider(&mut ai, claude())),
            AiErrorCode::TooManyProviders
        );
    }

    #[test]
    fn the_overview_asks_the_keychain_whether_a_key_is_set_and_stores_no_flag() {
        let store = MemoryKeyStore::default();
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        let b = save_provider(&mut ai, ollama()).unwrap();
        let view = overview(&ai, &store);
        assert_eq!(view.keychain, AiKeychainState::Available);
        assert!(view.providers.iter().all(|p| !p.key_configured));
        set_key(&ai, &a, "  sk-ant-0123  ", &store).unwrap();
        let view = overview(&ai, &store);
        assert!(view.providers[0].key_configured && !view.providers[1].key_configured);
        clear_key(&ai, &a, &store).unwrap();
        assert!(!overview(&ai, &store).providers[0].key_configured);
        let _ = b;
        // The stored settings carry no key and no flag.
        let text = serde_json::to_string(&ai).unwrap();
        assert!(
            !text.to_ascii_lowercase().contains("key") && !text.contains("sk-ant"),
            "{text}"
        );
    }

    #[test]
    fn with_no_keychain_the_overview_says_so_and_nothing_is_stored_silently() {
        let store = MemoryKeyStore::unavailable();
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        let view = overview(&ai, &store);
        assert_eq!(view.keychain, AiKeychainState::Unavailable);
        assert!(!view.providers[0].key_configured);
        assert_eq!(
            code(set_key(&ai, &a, "sk-ant-0123", &store)),
            AiErrorCode::KeychainUnavailable
        );
    }

    #[test]
    fn a_key_that_cannot_be_a_key_is_refused_and_the_error_never_carries_it() {
        let store = MemoryKeyStore::default();
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        for bad in [
            "",
            "   ",
            "com espaço no meio",
            "tab\tkey",
            "x".repeat(600).as_str(),
        ] {
            let error = set_key(&ai, &a, bad, &store).unwrap_err();
            assert_eq!(error.code, AiErrorCode::InvalidKey, "{bad:?}");
            assert!(!format!("{error} {error:?}").contains("espaço"));
        }
        assert!(store.get(&a).unwrap().is_none());
        assert_eq!(
            code(set_key(&ai, "unknown", "sk-ant-0123", &store)),
            AiErrorCode::UnknownProvider
        );
    }

    #[test]
    fn removing_a_provider_removes_its_key_and_moves_the_default() {
        let store = MemoryKeyStore::default();
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        let b = save_provider(&mut ai, ollama()).unwrap();
        set_key(&ai, &a, "sk-ant-0123", &store).unwrap();
        remove_provider(&mut ai, &a, &store).unwrap();
        assert!(
            store.get(&a).unwrap().is_none(),
            "the key went with the provider"
        );
        assert_eq!(ai.default_provider.as_deref(), Some(b.as_str()));
        remove_provider(&mut ai, &b, &store).unwrap();
        assert!(ai.providers.is_empty() && ai.default_provider.is_none());
        assert_eq!(
            code(remove_provider(&mut ai, &b, &store)),
            AiErrorCode::UnknownProvider
        );
    }

    #[test]
    fn nothing_that_opens_a_connection_is_built_while_the_assistant_is_off() {
        let store = MemoryKeyStore::default();
        let mut ai = AiSettings::default();
        let a = save_provider(&mut ai, claude()).unwrap();
        set_key(&ai, &a, "sk-ant-0123", &store).unwrap();
        assert!(!ai.enabled);
        assert_eq!(code(build(&ai, &a, &store)), AiErrorCode::Disabled);
        ai.enabled = true;
        assert!(build(&ai, &a, &store).is_ok());
    }

    #[test]
    fn a_provider_that_needs_a_key_without_one_says_so_and_a_local_server_needs_none() {
        let mut ai = AiSettings {
            enabled: true,
            ..AiSettings::default()
        };
        let a = save_provider(&mut ai, claude()).unwrap();
        let o = save_provider(&mut ai, ollama()).unwrap();
        let empty = MemoryKeyStore::default();
        assert_eq!(code(build(&ai, &a, &empty)), AiErrorCode::NoKey);
        assert!(build(&ai, &o, &empty).is_ok(), "Ollama asks for no key");
        // And a system with no keychain can still reach a local server, but not
        // a provider that needs a key.
        let none = MemoryKeyStore::unavailable();
        assert!(build(&ai, &o, &none).is_ok());
        assert_eq!(
            code(build(&ai, &a, &none)),
            AiErrorCode::KeychainUnavailable
        );
        assert_eq!(
            code(build(&ai, "nope", &empty)),
            AiErrorCode::UnknownProvider
        );
    }

    struct Fake(Result<Vec<ModelInfo>, fn() -> AiFailure>);
    impl Provider for Fake {
        fn models(&self) -> notes_ai::Result<Vec<ModelInfo>> {
            self.0.clone().map_err(|e| e())
        }
        fn stream(
            &self,
            _: &notes_ai::ChatRequest,
            _: &std::sync::atomic::AtomicBool,
            _: &mut dyn FnMut(notes_ai::StreamEvent),
        ) -> notes_ai::Result<notes_ai::StopReason> {
            unreachable!("a test does not stream")
        }
    }

    #[test]
    fn testing_a_provider_lists_its_models_and_names_each_way_it_can_fail() {
        let ok = Fake(Ok(vec![ModelInfo {
            id: "m1".into(),
            name: "Model 1".into(),
        }]));
        assert_eq!(
            test(&ok).unwrap().models,
            vec![AiModel {
                id: "m1".into(),
                name: "Model 1".into()
            }]
        );
        let cases: [(fn() -> AiFailure, AiErrorCode); 5] = [
            (|| AiFailure::Unauthorized, AiErrorCode::Unauthorized),
            (|| AiFailure::RateLimited, AiErrorCode::RateLimited),
            (|| AiFailure::Offline, AiErrorCode::Offline),
            (|| AiFailure::Protocol, AiErrorCode::Protocol),
            (
                || AiFailure::Provider("model not found".into()),
                AiErrorCode::Provider,
            ),
        ];
        for (failure, expected) in cases {
            assert_eq!(code(test(&Fake(Err(failure)))), expected);
        }
        let error = test(&Fake(Err(|| AiFailure::Provider("model not found".into())))).unwrap_err();
        assert_eq!(error.detail.as_deref(), Some("model not found"));
    }

    #[test]
    fn the_generic_settings_command_cannot_change_the_assistant() {
        let mut current = Settings::default();
        save_provider(&mut current.ai, claude()).unwrap();
        let mut sneaky = Settings::default();
        sneaky.editor.font_size = 20;
        sneaky.ai.enabled = true;
        sneaky.ai.providers.push(AiProviderSettings {
            id: "x".into(),
            kind: AiProviderKind::OpenAiCompatible,
            name: "evil".into(),
            base_url: "http://example.org".into(),
            model: "m".into(),
        });
        let kept = keep_ai(sneaky, &current);
        assert_eq!(
            kept.editor.font_size, 20,
            "the rest of the settings still change"
        );
        assert_eq!(kept.ai, current.ai);
        assert!(!kept.ai.enabled && kept.ai.providers.len() == 1);
    }
}
