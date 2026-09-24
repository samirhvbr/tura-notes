//! A shared lease for open workspaces; offline sync application takes exclusive.
use notes_model::CoreError;
use std::{
    fs::{self, File, OpenOptions},
    path::Path,
    time::{Duration, Instant},
};

/// How long a refused lease is tried again before the refusal is reported.
///
/// A process spawned by any thread of this one starts with a copy of every open
/// descriptor and holds it until it execs, and a `flock` belongs to the open
/// file, not to the descriptor. So a lease dropped while another thread is
/// spawning stays locked for that window, held by a process that is about to
/// become something else. On macOS every note deletion spawns one: the `trash`
/// crate asks the Finder through `osascript`. That was the recovery-test
/// intermittent (R7-11, R7-12, R8-05), macOS only because only there does
/// deleting spawn. Measured on Linux with one thread spawning `/bin/true`:
/// 274,000 refusals of a lock nobody held in 1.4 million rounds, and none in
/// 1.3 million without the spawner. The window closes in milliseconds; a real
/// holder is still refused, a quarter of a second later.
const SPAWN_WINDOW: Duration = Duration::from_millis(250);
const RETRY: Duration = Duration::from_millis(5);

/// Take `file`'s lock, trying a refusal again for up to [`SPAWN_WINDOW`].
/// `forget` probes every lease file through this too.
pub(crate) fn lock(file: &File, exclusive: bool) -> Result<(), std::fs::TryLockError> {
    let deadline = Instant::now() + SPAWN_WINDOW;
    loop {
        let tried = if exclusive {
            file.try_lock()
        } else {
            file.try_lock_shared()
        };
        match tried {
            Err(std::fs::TryLockError::WouldBlock) if Instant::now() < deadline => {
                std::thread::sleep(RETRY)
            }
            other => return other,
        }
    }
}
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
///
/// A holder is matched by path and by file identity (device and inode), not by
/// path alone: on macOS `/var` is `/private/var`, and the first report from CI
/// (1.8.60) said "none" for a path spelled one way, which is only conclusive if
/// a lease taken through the other spelling would have been found too. The
/// report also counts every live lease in the process, so "none" can be told
/// apart from a registry that recorded nothing.
#[cfg(debug_assertions)]
mod holders {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::{Mutex, MutexGuard};

    /// Device and inode of an open file, where the platform has them.
    pub type Identity = Option<(u64, u64)>;
    type Held = (u64, PathBuf, Identity, bool, String);
    static LIVE: Mutex<Vec<Held>> = Mutex::new(Vec::new());
    static NEXT: AtomicU64 = AtomicU64::new(1);

    /// A panic elsewhere must not blind the instrument: the list is still
    /// valid after one, so a poisoned lock is read through.
    fn live() -> MutexGuard<'static, Vec<Held>> {
        LIVE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn identity(file: &std::fs::File) -> Identity {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            file.metadata().ok().map(|m| (m.dev(), m.ino()))
        }
        #[cfg(not(unix))]
        {
            let _ = file;
            None
        }
    }

    pub fn add(path: &Path, identity: Identity, exclusive: bool) -> u64 {
        let id = NEXT.fetch_add(1, Ordering::Relaxed);
        let trace = std::backtrace::Backtrace::force_capture().to_string();
        // Only this workspace's frames: the rest is the runtime and the harness.
        let ours: Vec<&str> = trace
            .lines()
            .filter(|l| l.contains("notes_") && !l.contains("activity::"))
            .take(12)
            .map(str::trim)
            .collect();
        live().push((
            id,
            path.to_path_buf(),
            identity,
            exclusive,
            ours.join(" <- "),
        ));
        id
    }

    pub fn remove(id: u64) {
        live().retain(|h| h.0 != id);
    }

    pub fn report(path: &Path, identity: Identity, exclusive: bool) {
        eprintln!("{}", describe(path, identity, exclusive));
    }

    pub fn describe(path: &Path, identity: Identity, exclusive: bool) -> String {
        let live = live();
        let held: Vec<String> = live
            .iter()
            .filter(|h| h.1 == path || (identity.is_some() && h.2 == identity))
            .map(|h| {
                let kind = if h.3 { "exclusive" } else { "shared" };
                let spelled = if h.1 == path {
                    String::new()
                } else {
                    format!(" as {}", h.1.display())
                };
                format!("[{kind}{spelled}] {}", h.4)
            })
            .collect();
        format!(
            "activity lease {} refused ({}); held in this process by {} lease(s): {}",
            path.display(),
            if exclusive { "exclusive" } else { "shared" },
            held.len(),
            if held.is_empty() {
                format!(
                    "none among the {} live in this process, matched by path{}, \
                     so the holder is outside this process",
                    live.len(),
                    if identity.is_some() {
                        " and by inode"
                    } else {
                        ""
                    }
                )
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
        return match lock(&file, exclusive) {
            Ok(()) => Ok(Lease {
                #[cfg(debug_assertions)]
                id: holders::add(&path, holders::identity(&file), exclusive),
                _file: file,
            }),
            Err(e) => match refusal(e, what) {
                Some(err) => {
                    #[cfg(debug_assertions)]
                    if matches!(err, CoreError::LockTimeout { .. }) {
                        holders::report(&path, holders::identity(&file), exclusive);
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
/// still not saying whether anybody held it. An interrupted call is retried, as
/// any interrupted syscall is; any other error is an I/O error with its kind.
/// The holder that intermittent had turned out to be a spawning process (see
/// [`SPAWN_WINDOW`]).
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
        let said = holders::describe(&path, None, false);
        assert!(
            said.contains("1 lease(s)") && said.contains("[exclusive]"),
            "{said}"
        );
        drop(held);
        let said = holders::describe(&path, None, false);
        assert!(said.contains("outside this process"), "{said}");
        assert!(said.contains("live in this process"), "{said}");
    }

    /// The same file reached through another spelling of its directory -- a
    /// symlink here, `/var` against `/private/var` on macOS -- is the same
    /// holder, and the report has to find it.
    #[cfg(unix)]
    #[test]
    fn a_refusal_finds_a_holder_that_spelled_the_path_another_way() {
        let base = tempfile::tempdir().unwrap();
        let real = base.path().join("real");
        fs::create_dir(&real).unwrap();
        let alias = base.path().join("alias");
        std::os::unix::fs::symlink(&real, &alias).unwrap();
        let _held = acquire(&alias, "spelled", true).unwrap();
        let path = real.join("active").join(format!(
            "{}.lock",
            notes_fs::hash(b"spelled")
                .to_string()
                .trim_start_matches("b3:")
        ));
        let file = File::open(&path).unwrap();
        assert!(holders::describe(&path, None, false).contains("outside this process"));
        let said = holders::describe(&path, holders::identity(&file), false);
        assert!(
            said.contains("1 lease(s)") && said.contains("[exclusive as "),
            "{said}"
        );
    }

    /// R8-05: another thread spawning processes must not turn a lease this
    /// thread has just dropped into a refusal. Without [`SPAWN_WINDOW`] this
    /// failed within the first few hundred rounds on Linux.
    #[cfg(unix)]
    #[test]
    fn a_process_spawned_by_another_thread_does_not_keep_a_dropped_lease() {
        use std::sync::atomic::{AtomicBool, Ordering};
        let data = tempfile::tempdir().unwrap();
        let stop = std::sync::Arc::new(AtomicBool::new(false));
        let spawning = stop.clone();
        let spawner = std::thread::spawn(move || {
            let mut spawned = 0u32;
            while !spawning.load(Ordering::Relaxed) {
                std::process::Command::new("true").status().unwrap();
                spawned += 1;
            }
            spawned
        });
        let outcome = (0..400).try_for_each(|round| {
            drop(acquire(data.path(), "spawned", true).map_err(|e| (round, e))?);
            drop(acquire(data.path(), "spawned", false).map_err(|e| (round, e))?);
            Ok::<_, (u32, CoreError)>(())
        });
        stop.store(true, Ordering::Relaxed);
        assert!(spawner.join().unwrap() > 0, "nothing was spawned");
        if let Err((round, e)) = outcome {
            panic!("round {round}: {e}");
        }
    }

    #[test]
    fn a_real_holder_is_still_refused_once_the_window_is_over() {
        let data = tempfile::tempdir().unwrap();
        let _held = acquire(data.path(), "real", true).unwrap();
        let started = Instant::now();
        assert!(matches!(
            acquire(data.path(), "real", true),
            Err(CoreError::LockTimeout { .. })
        ));
        assert!(started.elapsed() >= SPAWN_WINDOW);
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
