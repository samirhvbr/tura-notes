//! Where an API key lives: the system keychain, and nowhere else (ADR-100).
//!
//! There is no fallback to a file. Where the system has no keychain this
//! application can reach (a Linux session with no Secret Service, an Android
//! build) the assistant is unavailable and says why. A key kept in a file
//! readable by the user is exactly what the keychain exists to avoid.

use crate::ApiKey;
use std::{collections::HashMap, sync::Mutex};

/// The keychain entry's service name. The account is `ai:<provider id>`.
pub const SERVICE: &str = "br.com.samirhv.notes";

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum KeychainError {
    /// No keychain to talk to on this system.
    #[error("this system has no keychain this application can use")]
    Unavailable,
    /// There is one, and it said no: locked, denied, or broken.
    #[error("the keychain refused the request")]
    Failed,
}

/// A provider's id as a keychain account: a short token of letters, digits,
/// `-` and `_`, so it cannot smuggle anything into the account name.
fn account(provider: &str) -> Result<String, KeychainError> {
    let valid = !provider.is_empty()
        && provider.len() <= 64
        && provider
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    if valid {
        Ok(format!("ai:{provider}"))
    } else {
        Err(KeychainError::Failed)
    }
}

pub trait KeyStore: Send + Sync {
    /// Whether a keychain can be used at all.
    fn available(&self) -> Result<(), KeychainError>;
    /// `Ok(None)` when no key is stored for this provider.
    fn get(&self, provider: &str) -> Result<Option<ApiKey>, KeychainError>;
    fn set(&self, provider: &str, key: &ApiKey) -> Result<(), KeychainError>;
    /// Removing a key that is not there is not an error.
    fn clear(&self, provider: &str) -> Result<(), KeychainError>;
}

/// The real one.
pub struct SystemKeychain;

fn entry(provider: &str) -> Result<keyring::Entry, KeychainError> {
    let account = account(provider)?;
    keyring::Entry::new(SERVICE, &account).map_err(map)
}

fn map(error: keyring::Error) -> KeychainError {
    match error {
        keyring::Error::NoDefaultStore | keyring::Error::NotSupportedByStore(_) => {
            KeychainError::Unavailable
        }
        _ => KeychainError::Failed,
    }
}

impl KeyStore for SystemKeychain {
    fn available(&self) -> Result<(), KeychainError> {
        match keyring::Entry::store_status() {
            Ok(()) => Ok(()),
            Err(error) => Err(match error {
                keyring::Error::NoStorageAccess(_) | keyring::Error::PlatformFailure(_) => {
                    KeychainError::Failed
                }
                _ => KeychainError::Unavailable,
            }),
        }
    }

    fn get(&self, provider: &str) -> Result<Option<ApiKey>, KeychainError> {
        match entry(provider)?.get_password() {
            // A stored value that is not a usable key reads as no key.
            Ok(value) => Ok(ApiKey::new(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(map(error)),
        }
    }

    fn set(&self, provider: &str, key: &ApiKey) -> Result<(), KeychainError> {
        entry(provider)?.set_password(key.expose()).map_err(map)
    }

    fn clear(&self, provider: &str) -> Result<(), KeychainError> {
        match entry(provider)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(map(error)),
        }
    }
}

/// A keychain in memory, for tests of whatever sits above this crate. It is
/// not a fallback: nothing in the application constructs one.
#[derive(Default)]
pub struct MemoryKeyStore {
    keys: Mutex<HashMap<String, String>>,
    /// Set to make every call fail as `Unavailable`, like a system with none.
    pub unavailable: bool,
}

impl MemoryKeyStore {
    pub fn unavailable() -> Self {
        Self {
            unavailable: true,
            ..Self::default()
        }
    }
}

impl KeyStore for MemoryKeyStore {
    fn available(&self) -> Result<(), KeychainError> {
        if self.unavailable {
            Err(KeychainError::Unavailable)
        } else {
            Ok(())
        }
    }

    fn get(&self, provider: &str) -> Result<Option<ApiKey>, KeychainError> {
        self.available()?;
        let account = account(provider)?;
        let keys = self.keys.lock().map_err(|_| KeychainError::Failed)?;
        Ok(keys.get(&account).and_then(|v| ApiKey::new(v.clone())))
    }

    fn set(&self, provider: &str, key: &ApiKey) -> Result<(), KeychainError> {
        self.available()?;
        let account = account(provider)?;
        let mut keys = self.keys.lock().map_err(|_| KeychainError::Failed)?;
        keys.insert(account, key.expose().to_owned());
        Ok(())
    }

    fn clear(&self, provider: &str) -> Result<(), KeychainError> {
        self.available()?;
        let account = account(provider)?;
        let mut keys = self.keys.lock().map_err(|_| KeychainError::Failed)?;
        keys.remove(&account);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(s: &str) -> ApiKey {
        ApiKey::new(s).unwrap()
    }

    #[test]
    fn a_key_is_stored_read_replaced_and_cleared_per_provider() {
        let store = MemoryKeyStore::default();
        assert!(store.get("a").unwrap().is_none());
        store.set("a", &key("sk-1")).unwrap();
        store.set("b", &key("sk-2")).unwrap();
        assert_eq!(store.get("a").unwrap().unwrap().expose(), "sk-1");
        store.set("a", &key("sk-3")).unwrap();
        assert_eq!(store.get("a").unwrap().unwrap().expose(), "sk-3");
        assert_eq!(
            store.get("b").unwrap().unwrap().expose(),
            "sk-2",
            "another provider is untouched"
        );
        store.clear("a").unwrap();
        store.clear("a").unwrap(); // removing what is not there is fine
        assert!(store.get("a").unwrap().is_none());
        assert!(store.get("b").unwrap().is_some());
    }

    #[test]
    fn a_provider_id_cannot_smuggle_anything_into_the_account_name() {
        for bad in ["", "a b", "a/b", "a:b", "../x", "ação", &"x".repeat(65)] {
            assert_eq!(account(bad), Err(KeychainError::Failed), "{bad:?}");
        }
        assert_eq!(account("3f2a-9c_1").unwrap(), "ai:3f2a-9c_1");
    }

    #[test]
    fn a_system_with_no_keychain_is_unavailable_everywhere_and_never_a_silent_success() {
        let store = MemoryKeyStore::unavailable();
        assert_eq!(store.available(), Err(KeychainError::Unavailable));
        assert_eq!(
            store.set("a", &key("sk")).unwrap_err(),
            KeychainError::Unavailable
        );
        assert_eq!(store.get("a").unwrap_err(), KeychainError::Unavailable);
    }

    /// Against the real keychain of the machine running it, so it is not part
    /// of the gate (CI has no Secret Service session). Run by hand, or in the
    /// owner's acceptance of the assistant:
    /// `cargo test -p notes-ai --lib -- --ignored real_keychain`
    #[test]
    #[ignore = "needs a real keychain session"]
    fn real_keychain_round_trip() {
        let store = SystemKeychain;
        store
            .available()
            .expect("a keychain must be reachable for this test");
        let id = "acceptance-test";
        store.clear(id).unwrap();
        assert!(store.get(id).unwrap().is_none());
        store.set(id, &key("sk-acceptance-0123")).unwrap();
        assert_eq!(
            store.get(id).unwrap().unwrap().expose(),
            "sk-acceptance-0123"
        );
        store.clear(id).unwrap();
        assert!(store.get(id).unwrap().is_none());
    }
}
