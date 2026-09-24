use std::path::Path;
use std::time::{Duration, Instant};

use notes_model::CoreError;

/// The cross-process write lock (`ARCHITECTURE.md` §6).
///
/// One per workspace, guarding the *stat → compare → replace* sequence and the
/// registry update — hold time is milliseconds. It coordinates **our** processes
/// (the app and, from 0.3, `notes-mcp`); a third-party editor does not take it,
/// and its writes are caught by the base-rev check instead.
///
/// There is no stale-lock problem by construction: an advisory lock is released
/// by the kernel when its holder dies. That is why it is a lock and not a pid
/// file.
///
/// It exists at 0.1a, when there is only one process, so that the protocol is
/// exercised by tests before a second one arrives.
pub struct WriteLock {
    file: fd_lock::RwLock<std::fs::File>,
}

const TIMEOUT: Duration = Duration::from_secs(5);
const RETRY: Duration = Duration::from_millis(20);

/// Take the lock, blocking up to five seconds.
///
/// Returns a guard-carrying value; dropping it releases. `LockTimeout` is
/// handled as a write failure — a draft is written and the UI shows the error
/// (§5 step 9).
pub fn acquire(path: &Path) -> Result<WriteLock, CoreError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| CoreError::io("mkdir", dir.display(), &e))?;
    }
    let mut options = std::fs::OpenOptions::new();
    options.create(true).read(true).write(true).truncate(false);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600); // like everything else in the private store (R6-27a)
    }
    let file = options
        .open(path)
        .map_err(|e| CoreError::io("open_lock", path.display(), &e))?;

    // Opening the file takes no lock. The lock itself is taken inside `with`,
    // for exactly the length of the critical section — a lock held from
    // `acquire` to drop would serialise a whole command instead of the
    // stat → compare → replace sequence it exists to guard.
    Ok(WriteLock {
        file: fd_lock::RwLock::new(file),
    })
}

impl WriteLock {
    /// Run `f` while holding the lock for writing.
    pub fn with<T>(&mut self, f: impl FnOnce() -> T) -> Result<T, CoreError> {
        let deadline = Instant::now() + TIMEOUT;
        loop {
            match self.file.try_write() {
                Ok(_guard) => return Ok(f()),
                Err(_) if Instant::now() < deadline => std::thread::sleep(RETRY),
                Err(_) => {
                    return Err(CoreError::LockTimeout {
                        what: notes_model::LockWait::WorkspaceWrite,
                    })
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_lock_file_is_created_and_the_section_runs() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("sub/write.lock");
        let mut l = acquire(&p).unwrap();
        assert!(p.exists());
        let out = l.with(|| 42).unwrap();
        assert_eq!(out, 42);
    }

    #[test]
    fn a_second_acquisition_in_the_same_process_still_works() {
        // Advisory locks are per-file-descriptor: two handles in one process do
        // not deadlock, and the real contention case is two processes, which is
        // covered by tools/crash-save-loop from 0.3.
        //
        // This used to end here, with two `acquire` calls and no assertion —
        // and `acquire` takes no lock at all (the doc comment above says so:
        // the lock is taken inside `with`). It was a contention test that never
        // contended, and it could not have failed. Entering both critical
        // sections is the part that was missing.
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("write.lock");
        let mut a = acquire(&p).unwrap();
        let mut b = acquire(&p).unwrap();
        assert_eq!(a.with(|| "first").unwrap(), "first");
        assert_eq!(b.with(|| "second").unwrap(), "second");
    }

    /// The whole point of typing the wait: this variant is produced from three
    /// places and only one of them is this lock, so a count over the *message*
    /// counts unrelated failures together. An investigation that does that
    /// instruments whichever path it guessed.
    #[test]
    fn the_workspace_write_lock_names_itself_and_nothing_else() {
        let e = CoreError::LockTimeout {
            what: notes_model::LockWait::WorkspaceWrite,
        };
        assert_eq!(
            e.to_string(),
            "timed out waiting for the workspace write lock"
        );

        // The activity state file is a `try_lock`, retried only across a
        // spawn's window: no holder was waited for, and it used to report
        // itself in the sentence above.
        let activity = CoreError::LockTimeout {
            what: notes_model::LockWait::ActivityExclusive,
        };
        assert_ne!(activity.to_string(), e.to_string());
        assert!(activity.to_string().contains("activity state file"));

        // And reconciliation running out of passes is not a lock at all.
        let settle = CoreError::NotSettled {
            passes: 201,
            queued: 7,
        };
        assert_eq!(settle.code(), "not_settled");
        assert!(!settle.to_string().contains("lock"));
    }
}
