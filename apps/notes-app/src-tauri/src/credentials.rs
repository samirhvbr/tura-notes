//! The device's credential for the remote folder and Device sync, in the system
//! keychain (ADR-105).
//!
//! `notes-sync-client` reads a credential from a path or from a `keychain:<name>`
//! reference and links no keychain of its own; this is the one it is given. The
//! account is `cred:<name>` under the service the AI assistant's keys already use,
//! so the application has one place in the keychain and two prefixes in it.
//!
//! There is no fallback to a file: where the system has no keychain a reference to
//! it is a credential that cannot be read, and the sign-in says so.

use notes_sync_client::remote::{CredentialStore, StoreFailure};

pub struct SystemCredentials;

fn entry(name: &str) -> Result<keyring::Entry, StoreFailure> {
    // The name was checked as a short token before it got here (`credential_name`);
    // it is checked again because this is the last place it can still be wrong.
    let valid = !name.is_empty()
        && name.len() <= 64
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'));
    if !valid {
        return Err(StoreFailure::Failed);
    }
    keyring::Entry::new(notes_ai::SERVICE, &format!("cred:{name}")).map_err(map)
}

fn map(error: keyring::Error) -> StoreFailure {
    match error {
        keyring::Error::NoDefaultStore | keyring::Error::NotSupportedByStore(_) => {
            StoreFailure::Unavailable
        }
        _ => StoreFailure::Failed,
    }
}

impl CredentialStore for SystemCredentials {
    fn get(&self, name: &str) -> Result<Option<String>, StoreFailure> {
        match entry(name)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(map(error)),
        }
    }

    fn set(&self, name: &str, secret: &str) -> Result<(), StoreFailure> {
        entry(name)?.set_password(secret).map_err(map)
    }

    fn clear(&self, name: &str) -> Result<(), StoreFailure> {
        match entry(name)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(map(error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_name_that_is_not_a_token_never_reaches_the_keychain() {
        for bad in ["", "a/b", "a b", "../x", "a:b", &"x".repeat(65)] {
            assert_eq!(
                SystemCredentials.get(bad),
                Err(StoreFailure::Failed),
                "{bad:?}"
            );
            assert_eq!(
                SystemCredentials.set(bad, "nt_x"),
                Err(StoreFailure::Failed),
                "{bad:?}"
            );
            assert_eq!(
                SystemCredentials.clear(bad),
                Err(StoreFailure::Failed),
                "{bad:?}"
            );
        }
    }
}
