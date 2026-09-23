//! A shared lease for open workspaces; offline sync application takes exclusive.
use notes_model::CoreError;
use std::{
    fs::{self, File, OpenOptions},
    path::Path,
};
pub fn acquire(data: &Path, root: &str, exclusive: bool) -> Result<File, CoreError> {
    let dir = data.join("active");
    fs::create_dir_all(&dir).map_err(|e| CoreError::io("activity", "state", &e))?;
    if !fs::symlink_metadata(&dir)
        .map_err(|e| CoreError::io("activity", "state", &e))?
        .is_dir()
    {
        return Err(CoreError::Unsupported {
            cap: "invalid activity directory".into(),
        });
    }
    let path = dir.join(format!(
        "{}.lock",
        notes_fs::hash(root.as_bytes())
            .to_string()
            .trim_start_matches("b3:")
    ));
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file()) {
        return Err(CoreError::Unsupported {
            cap: "invalid activity lock".into(),
        });
    }
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let file = options
        .open(&path)
        .map_err(|e| CoreError::io("activity", "state", &e))?;
    let what = if exclusive {
        notes_model::LockWait::ActivityExclusive
    } else {
        notes_model::LockWait::ActivityShared
    };
    loop {
        let tried = if exclusive {
            file.try_lock()
        } else {
            file.try_lock_shared()
        };
        return match tried {
            Ok(()) => Ok(file),
            Err(e) => match refusal(e, what) {
                Some(err) => Err(err),
                None => continue,
            },
        };
    }
}

/// What a failed `try_lock` means, or `None` to try again.
///
/// Only `WouldBlock` is another holder. Everything else used to be reported as
/// the same "timed out waiting for the activity state file", which is how the
/// recovery-test intermittent (R7-11) arrived on macOS naming this lease and
/// still not saying whether anybody held it: the fixture's data directory is its
/// own, no thread captures the lease, and nothing in the binary forks. An
/// interrupted call is retried, as any interrupted syscall is; any other error
/// is an I/O error with its kind, so the next occurrence says which it was.
fn refusal(e: std::fs::TryLockError, what: notes_model::LockWait) -> Option<CoreError> {
    match e {
        std::fs::TryLockError::WouldBlock => Some(CoreError::LockTimeout { what }),
        std::fs::TryLockError::Error(e) if e.kind() == std::io::ErrorKind::Interrupted => None,
        std::fs::TryLockError::Error(e) => Some(CoreError::io("activity_lock", "state", &e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_another_holder_reads_as_a_lock_wait() {
        let shared = notes_model::LockWait::ActivityShared;
        assert!(matches!(
            refusal(std::fs::TryLockError::WouldBlock, shared),
            Some(CoreError::LockTimeout { .. })
        ));
        let interrupted = std::io::Error::from(std::io::ErrorKind::Interrupted);
        assert!(refusal(std::fs::TryLockError::Error(interrupted), shared).is_none());
        let other = std::io::Error::from(std::io::ErrorKind::Unsupported);
        let err = refusal(std::fs::TryLockError::Error(other), shared).unwrap();
        assert!(!matches!(err, CoreError::LockTimeout { .. }), "{err:?}");
        assert!(!err.to_string().contains("timed out"), "{err}");
    }

    #[test]
    fn a_held_exclusive_lease_refuses_a_shared_one_as_a_lock_wait() {
        let data = tempfile::tempdir().unwrap();
        let _held = acquire(data.path(), "root", true).unwrap();
        assert!(matches!(
            acquire(data.path(), "root", false),
            Err(CoreError::LockTimeout {
                what: notes_model::LockWait::ActivityShared
            })
        ));
    }
}
