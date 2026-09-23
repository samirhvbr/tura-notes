//! A shared lease for open workspaces; offline sync application takes exclusive.
use notes_model::CoreError;
use std::{
    fs::{self, File, OpenOptions},
    path::Path,
};
/// A held activity lease: the lock is released when this drops and its file
/// closes. In debug builds each live lease is also recorded with where it was
/// taken, so a refusal can name the holder (R7-12).
pub struct Lease {
    _file: File,
    #[cfg(debug_assertions)]
    id: u64,
}

impl Drop for Lease {
    fn drop(&mut self) {
        #[cfg(debug_assertions)]
        holders::remove(self.id);
    }
}

/// The recovery-test intermittent (R7-11, R7-12) arrived twice on macOS CI as a
/// `WouldBlock` on this lease -- once shared, once exclusive -- inside one test's
/// own data directory, with no holder visible by reading the code. Debug builds
/// (every test) therefore remember each live lease and the stack that took it,
/// and a refusal prints the in-process holders of that file to stderr, which
/// `cargo test` shows for a failing test. An empty list means the holder is not
/// in this process. Release builds record nothing.
#[cfg(debug_assertions)]
mod holders {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Mutex;

    type Held = (u64, PathBuf, bool, String);
    static LIVE: Mutex<Vec<Held>> = Mutex::new(Vec::new());
    static NEXT: AtomicU64 = AtomicU64::new(1);

    pub fn add(path: &Path, exclusive: bool) -> u64 {
        let id = NEXT.fetch_add(1, Ordering::Relaxed);
        let trace = std::backtrace::Backtrace::force_capture().to_string();
        // Only this workspace's frames: the rest is the runtime and the harness.
        let ours: Vec<&str> = trace
            .lines()
            .filter(|l| l.contains("notes_") && !l.contains("activity::"))
            .take(12)
            .map(str::trim)
            .collect();
        if let Ok(mut live) = LIVE.lock() {
            live.push((id, path.to_path_buf(), exclusive, ours.join(" <- ")));
        }
        id
    }

    pub fn remove(id: u64) {
        if let Ok(mut live) = LIVE.lock() {
            live.retain(|h| h.0 != id);
        }
    }

    pub fn report(path: &Path, exclusive: bool) {
        eprintln!("{}", describe(path, exclusive));
    }

    pub fn describe(path: &Path, exclusive: bool) -> String {
        let held: Vec<String> = LIVE
            .lock()
            .map(|live| {
                live.iter()
                    .filter(|h| h.1 == path)
                    .map(|h| format!("[{}] {}", if h.2 { "exclusive" } else { "shared" }, h.3))
                    .collect()
            })
            .unwrap_or_default();
        format!(
            "activity lease {} refused ({}); held in this process by {} lease(s): {}",
            path.display(),
            if exclusive { "exclusive" } else { "shared" },
            held.len(),
            if held.is_empty() {
                "none, so the holder is outside this process".to_string()
            } else {
                held.join(" | ")
            }
        )
    }
}

pub fn acquire(data: &Path, root: &str, exclusive: bool) -> Result<Lease, CoreError> {
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
            Ok(()) => Ok(Lease {
                #[cfg(debug_assertions)]
                id: holders::add(&path, exclusive),
                _file: file,
            }),
            Err(e) => match refusal(e, what) {
                Some(err) => {
                    #[cfg(debug_assertions)]
                    if matches!(err, CoreError::LockTimeout { .. }) {
                        holders::report(&path, exclusive);
                    }
                    Err(err)
                }
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
    fn a_refusal_names_the_leases_this_process_holds_on_that_file() {
        let data = tempfile::tempdir().unwrap();
        let path = data.path().join("active").join(format!(
            "{}.lock",
            notes_fs::hash(b"named")
                .to_string()
                .trim_start_matches("b3:")
        ));
        let held = acquire(data.path(), "named", true).unwrap();
        let said = holders::describe(&path, false);
        assert!(
            said.contains("1 lease(s)") && said.contains("[exclusive]"),
            "{said}"
        );
        drop(held);
        assert!(holders::describe(&path, false).contains("outside this process"));
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
