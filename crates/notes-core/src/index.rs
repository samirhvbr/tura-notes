//! The quick-open path list, built off the critical path.
//!
//! Quick open matches paths from memory (ADR-032). Building that list means
//! walking the workspace, and on a folder of 21 000 directories that walk took
//! **550 ms** — inside the command, holding the service mutex, so the tree could
//! not be listed while it ran. On the owner's `~/x` it was minutes
//! (`docs/DECISIONS-0.1c.md` D-09).
//!
//! So it runs on its own thread and the caller matches whatever exists so far.
//! A partial list with `building: true` beside it is a better answer than a
//! frozen window, and it is an honest one — the interface says the index is
//! still filling.
//!
//! It also **never fails on a directory it cannot read**. The old walk
//! propagated the first `read_dir` error, so one unreadable subdirectory made
//! quick open return nothing for the entire workspace. Those are counted and
//! skipped, exactly as the watcher counts and skips them.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use notes_model::RelPath;

use crate::ignore::is_hidden_name;

/// What the index holds right now.
pub struct Snapshot {
    pub paths: Vec<RelPath>,
    pub building: bool,
    /// Directories skipped because they could not be read.
    pub unreadable: usize,
}

pub struct PathIndex {
    paths: Arc<Mutex<Vec<RelPath>>>,
    building: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
    unreadable: Arc<AtomicUsize>,
}

/// A walk whose thread could not be started is not still building (R6-37).
///
/// The result used to be dropped with `.ok()`. The closure that would have
/// cleared `building` was dropped with it, so under thread exhaustion or a
/// tight `RLIMIT_NPROC` the index said *building* for the life of the
/// workspace -- and `quick_open` only replaces an index that is not building,
/// so it never retried. `content_index::Job::start` already handled this.
fn settle_spawn<T>(spawned: std::io::Result<T>, building: &AtomicBool) {
    if spawned.is_err() {
        building.store(false, Ordering::Release);
    }
}

/// How many paths are appended before the shared list is touched. A lock per
/// file would make the walk contend with every keystroke that reads it.
const BATCH: usize = 256;

impl PathIndex {
    /// Start walking `root` in the background.
    pub fn start(root: &Path, extra_ignore: Vec<String>, show_hidden: bool) -> Self {
        let index = Self {
            paths: Arc::new(Mutex::new(Vec::new())),
            building: Arc::new(AtomicBool::new(true)),
            cancel: Arc::new(AtomicBool::new(false)),
            unreadable: Arc::new(AtomicUsize::new(0)),
        };

        let root = root.to_path_buf();
        let paths = Arc::clone(&index.paths);
        let building = Arc::clone(&index.building);
        let cancel = Arc::clone(&index.cancel);
        let unreadable = Arc::clone(&index.unreadable);

        let spawned = std::thread::Builder::new()
            .name("notes-index".into())
            .spawn(move || {
                walk(
                    &root,
                    &extra_ignore,
                    show_hidden,
                    &paths,
                    &cancel,
                    &unreadable,
                );
                if !cancel.load(Ordering::Relaxed) {
                    // Sorted once, at the end: a list that reorders itself under
                    // the user as it fills is worse than one that fills.
                    paths.lock().unwrap().sort();
                }
                building.store(false, Ordering::Release);
            });
        settle_spawn(spawned, &index.building);

        index
    }

    /// How many paths the list holds, and whether it is still filling —
    /// without cloning the list.
    ///
    /// `snapshot()` copies the whole `Vec`, which is the wrong price to pay
    /// every five seconds just to ask whether the tree is the same shape as the
    /// cache thinks.
    pub fn size(&self) -> (usize, bool) {
        (
            self.paths.lock().map(|p| p.len()).unwrap_or(0),
            self.building.load(Ordering::Acquire),
        )
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            paths: self.paths.lock().unwrap().clone(),
            building: self.building.load(Ordering::Acquire),
            unreadable: self.unreadable.load(Ordering::Relaxed),
        }
    }

    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }
}

impl Drop for PathIndex {
    /// Dropping the index stops its walk. Without this, changing workspace or
    /// invalidating the list would leave a thread walking a folder nobody is
    /// going to ask about.
    fn drop(&mut self) {
        self.cancel();
    }
}

/// Remove a temporary file `create_new` left behind, once it is old enough
/// that no create can still be writing it (R6-36). Such a file is only ever
/// left by a process killed between write and publish; it is hidden from the
/// tree, the watcher and the index, so the user would never see it otherwise.
/// Ten minutes is far beyond any single write this application makes.
fn sweep(path: &Path) {
    const STALE: std::time::Duration = std::time::Duration::from_secs(600);
    let old = std::fs::symlink_metadata(path).is_ok_and(|m| {
        m.is_file()
            && m.modified()
                .is_ok_and(|t| t.elapsed().is_ok_and(|age| age > STALE))
    });
    if old {
        let _ = std::fs::remove_file(path);
    }
}

fn walk(
    root: &Path,
    extra_ignore: &[String],
    show_hidden: bool,
    out: &Arc<Mutex<Vec<RelPath>>>,
    cancel: &Arc<AtomicBool>,
    unreadable: &Arc<AtomicUsize>,
) {
    let mut stack: Vec<PathBuf> = vec![root.to_path_buf()];
    let mut batch: Vec<RelPath> = Vec::with_capacity(BATCH);

    while let Some(dir) = stack.pop() {
        if cancel.load(Ordering::Relaxed) {
            return;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => {
                unreadable.fetch_add(1, Ordering::Relaxed);
                continue;
            }
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(notes_fs::CREATE_TMP_PREFIX) && name.ends_with(".tmp") {
                sweep(&path);
                continue;
            }
            if hidden(&name, show_hidden, extra_ignore) {
                continue;
            }
            // `symlink_metadata`: a symlinked directory is not descended into,
            // so a loop cannot be entered, and a symlink is not a note.
            let Ok(meta) = std::fs::symlink_metadata(&path) else {
                continue;
            };
            if meta.is_dir() {
                stack.push(path);
            } else if meta.is_file() {
                let Ok(rel) = path.strip_prefix(root) else {
                    continue;
                };
                // Segment by segment through `osname`, as the listing does, so
                // `Ctrl+P` offers the path that opens rather than a lossy one
                // that names no file. One segment it cannot express skips the
                // file, as before.
                let Some(segments) = rel
                    .iter()
                    .map(notes_fs::osname::to_segment)
                    .collect::<Option<Vec<_>>>()
                else {
                    continue;
                };
                if let Ok(rel) = RelPath::parse(&segments.join("/")) {
                    if rel.is_note() {
                        batch.push(rel);
                    }
                }
            }
        }
        if batch.len() >= BATCH {
            out.lock().unwrap().append(&mut batch);
        }
    }
    if !batch.is_empty() {
        out.lock().unwrap().append(&mut batch);
    }
}

/// The visibility rule, by name — the same one `ignore::is_hidden` applies to an
/// `Entry`, without needing one.
fn hidden(name: &str, show_hidden: bool, extra: &[String]) -> bool {
    if is_hidden_name(name) {
        return !show_hidden
            || crate::ignore::IGNORE_DEFAULT.contains(&name)
            || name.ends_with(".tmp");
    }
    extra.iter().any(|e| e == name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    fn settle(index: &PathIndex) -> Snapshot {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            let s = index.snapshot();
            if !s.building || Instant::now() > deadline {
                return s;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
    }

    #[test]
    fn a_stale_create_temporary_is_swept_and_a_fresh_one_is_left() {
        let d = tempfile::tempdir().unwrap();
        let stale = d.path().join(".notes-create-a.md.tmp");
        let fresh = d.path().join(".notes-create-b.md.tmp");
        std::fs::write(&stale, b"half").unwrap();
        std::fs::write(&fresh, b"being written").unwrap();
        let hour_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(3600);
        std::fs::File::options()
            .write(true)
            .open(&stale)
            .unwrap()
            .set_modified(hour_ago)
            .unwrap();
        let ix = PathIndex::start(d.path(), vec![], false);
        while ix.size().1 {
            std::thread::yield_now();
        }
        assert!(
            !stale.exists(),
            "a leftover older than ten minutes is removed"
        );
        assert!(fresh.exists(), "one that may still be written is not");
        assert_eq!(ix.size().0, 0, "neither is ever listed");
    }

    #[test]
    fn a_walk_that_could_not_start_is_not_left_building() {
        let building = AtomicBool::new(true);
        settle_spawn::<()>(Err(std::io::Error::other("no threads")), &building);
        assert!(!building.load(Ordering::Acquire));
        let building = AtomicBool::new(true);
        settle_spawn(Ok(()), &building);
        assert!(
            building.load(Ordering::Acquire),
            "a started walk clears it itself"
        );
    }

    #[test]
    fn it_finds_notes_and_ignores_everything_else() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("a.md"), b"").unwrap();
        std::fs::write(d.path().join("b.txt"), b"").unwrap();
        std::fs::create_dir_all(d.path().join("sub")).unwrap();
        std::fs::write(d.path().join("sub/c.markdown"), b"").unwrap();
        std::fs::create_dir_all(d.path().join(".git")).unwrap();
        std::fs::write(d.path().join(".git/d.md"), b"").unwrap();

        let s = settle(&PathIndex::start(d.path(), vec![], false));
        let names: Vec<_> = s.paths.iter().map(|p| p.as_str()).collect();
        assert_eq!(names, vec!["a.md", "sub/c.markdown"]);
        assert!(!s.building);
    }

    /// Whether a mode-000 directory is actually unreadable **here**.
    ///
    /// It is not, for root: `CAP_DAC_OVERRIDE` reads it anyway, and the Arch CI
    /// job runs the suite as root inside its container. A test about skipping
    /// an unreadable directory has nothing to exercise there, and asserting
    /// anyway would be asserting about the runner rather than about the code.
    #[cfg(unix)]
    fn permissions_are_enforced_here() -> bool {
        use std::os::unix::fs::PermissionsExt;
        let d = tempfile::tempdir().unwrap();
        let denied = d.path().join("negado");
        std::fs::create_dir(&denied).unwrap();
        if std::fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o000)).is_err() {
            return false;
        }
        let enforced = std::fs::read_dir(&denied).is_err();
        let _ = std::fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o755));
        enforced
    }

    /// The bug this module exists to remove: one unreadable directory used to
    /// make quick open return nothing at all.
    #[cfg(unix)]
    #[test]
    fn an_unreadable_directory_is_counted_and_skipped_not_fatal() {
        use std::os::unix::fs::PermissionsExt;
        if !permissions_are_enforced_here() {
            eprintln!("skipped: this process reads a mode-000 directory anyway (root?)");
            return;
        }
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("visivel.md"), b"").unwrap();
        let denied = d.path().join("negado");
        std::fs::create_dir(&denied).unwrap();
        std::fs::write(denied.join("escondida.md"), b"").unwrap();
        std::fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o000)).unwrap();

        let s = settle(&PathIndex::start(d.path(), vec![], false));
        std::fs::set_permissions(&denied, std::fs::Permissions::from_mode(0o755)).unwrap();

        assert!(
            s.paths.iter().any(|p| p.as_str() == "visivel.md"),
            "the rest of the workspace is still indexed: {:?}",
            s.paths
        );
        assert_eq!(
            s.unreadable, 1,
            "and the directory is counted, not swallowed"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_loop_does_not_hang_the_walk() {
        let d = tempfile::tempdir().unwrap();
        std::fs::write(d.path().join("a.md"), b"").unwrap();
        let loopy = d.path().join("loop");
        std::fs::create_dir(&loopy).unwrap();
        std::os::unix::fs::symlink(d.path(), loopy.join("up")).unwrap();

        let s = settle(&PathIndex::start(d.path(), vec![], false));
        assert!(!s.building, "the walk returned");
        assert_eq!(s.paths.len(), 1);
    }

    #[test]
    fn a_cancelled_walk_stops() {
        let d = tempfile::tempdir().unwrap();
        for i in 0..200 {
            std::fs::write(d.path().join(format!("n{i}.md")), b"").unwrap();
        }
        let index = PathIndex::start(d.path(), vec![], false);
        index.cancel();
        let s = settle(&index);
        assert!(!s.building);
    }
}
