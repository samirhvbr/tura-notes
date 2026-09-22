//! The watcher's walk, as background work.
//!
//! ADR-034 makes one promise about it beyond "it is not on the critical path":
//! it is **cancellable**. Dropping a `Watch` — closing a workspace, opening
//! another — must end the walk rather than leave a thread installing watches on
//! a folder nobody has open. On Linux that walk is one directory at a time and
//! can be minutes long on a large tree, so "it finishes eventually" is not the
//! same answer.
//!
//! Linux only, because the walk is (`DECISIONS-0.1c.md` D-10): FSEvents and
//! `ReadDirectoryChangesW` watch a subtree from one handle and have nothing to
//! walk.

#![cfg(target_os = "linux")]

use notes_fs::{FileSystem, LocalFs};
use std::path::Path;
use std::time::{Duration, Instant};

/// A tree wide enough that a walk takes long enough to be caught mid-flight.
fn wide(root: &Path, dirs: usize) {
    for i in 0..dirs {
        let d = root.join(format!("d{i:05}")).join("sub");
        std::fs::create_dir_all(&d).unwrap();
        std::fs::write(d.join("n.md"), b"# n\n").unwrap();
    }
}

#[test]
fn the_walk_reports_its_progress_and_finishes() {
    let d = tempfile::tempdir().unwrap();
    wide(d.path(), 300);
    let fs = LocalFs::open(d.path()).unwrap();

    let watch = fs.watch();

    let deadline = Instant::now() + Duration::from_secs(30);
    let mut p = watch.progress();
    while p.walking && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(2));
        p = watch.progress();
    }

    // **After the walk, not before it.** Establishing the handle moved onto the
    // thread, so at the moment `watch()` returns the answer does not exist yet
    // and `degraded` is `None` on a machine that cannot watch at all. Asking
    // first is how this skip stopped skipping. `fail()` clears `walking` as it
    // records the reason, so the loop above has already waited for it.
    if let Some(reason) = p.degraded {
        eprintln!("skipped: this machine cannot watch ({reason:?})");
        return;
    }

    assert!(!p.walking, "the walk finished: {p:?}");
    // 300 directories plus their `sub`, plus the root.
    assert!(p.dirs > 300, "one watch per directory: {p:?}");
    assert_eq!(p.unreadable, 0);
    assert_eq!(p.over_limit, 0);
}

/// Dropping the `Watch` ends the walk.
///
/// The assertion is that the walk **stops short**, not that a thread died: a
/// thread's death is not observable from here, and the count it stopped at is.
/// A `Watch` dropped immediately leaves a count far below the total; without
/// the cancel it would climb to the end regardless.
#[test]
fn dropping_the_watch_stops_the_walk_where_it_is() {
    let d = tempfile::tempdir().unwrap();
    wide(d.path(), 4000);
    let fs = LocalFs::open(d.path()).unwrap();

    let watch = fs.watch();
    // Kept, so the count — and the reason — can be read after the `Watch` is
    // gone. This test drops the `Watch` before the walk has started, which is
    // the point of it, so there is no moment at which asking the `Watch` itself
    // would have an answer.
    let counters = watch.counters();
    drop(watch);

    // Long enough that an uncancelled walk of 8 000 directories would have
    // finished several times over — it takes about 30 ms here.
    std::thread::sleep(Duration::from_millis(600));
    if let Some(reason) = counters.degraded.lock().ok().and_then(|d| d.clone()) {
        eprintln!("skipped: this machine cannot watch ({reason:?})");
        return;
    }
    let dirs = counters.dirs.load(std::sync::atomic::Ordering::Relaxed);
    let walking = counters.walking.load(std::sync::atomic::Ordering::Relaxed);

    assert!(!walking, "the walk is not still going");
    assert!(
        dirs < 8000,
        "the walk stopped where it was rather than finishing: {dirs} directories"
    );
}

/// A tree moved into the workspace after the walk gets watched all the way
/// down, not just at its top directory.
///
/// The event loop used to install one non-recursive watch on the directory the
/// event named and stop there. Moving an existing folder in is **one event**
/// for its top directory, so everything nested inside stayed unwatched —
/// silently, until something else triggered a full scan. The initial walk
/// already descends; only the path that runs afterwards did not.
#[test]
fn a_tree_moved_in_after_the_walk_is_watched_all_the_way_down() {
    let d = tempfile::tempdir().unwrap();
    std::fs::create_dir(d.path().join("workspace")).unwrap();
    let root = d.path().join("workspace");

    // Built outside the workspace, so the walk never sees it.
    let outside = d.path().join("elsewhere");
    std::fs::create_dir_all(outside.join("a/b/c")).unwrap();
    std::fs::write(outside.join("a/b/c/deep.md"), b"# deep\n").unwrap();

    let fs = LocalFs::open(&root).unwrap();
    let watch = fs.watch();
    let deadline = Instant::now() + Duration::from_secs(30);
    let mut p = watch.progress();
    while p.walking && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(2));
        p = watch.progress();
    }
    if let Some(reason) = p.degraded {
        eprintln!("skipped: this machine cannot watch ({reason:?})");
        return;
    }

    std::fs::rename(&outside, root.join("moved")).unwrap();
    // Let the move's own event be processed and the watches be installed.
    let _ = watch.wait(Duration::from_secs(5));
    let _ = watch.drain();

    // Now touch a file three levels inside the moved tree. Nothing but a watch
    // on `moved/a/b/c` can report this.
    std::thread::sleep(Duration::from_millis(50));
    std::fs::write(root.join("moved/a/b/c/deep.md"), b"# changed\n").unwrap();

    let seen = watch.wait(Duration::from_secs(5));
    assert!(
        seen.iter().any(|p| p.as_str().contains("deep.md")),
        "a change three levels inside a moved-in tree must be reported: {seen:?}"
    );
}

/// ADR-019: symlinks and junctions are not traversed. The walk uses
/// `symlink_metadata` for that; the event loop used `is_dir()`, which follows.
#[test]
fn a_symlinked_directory_that_appears_later_is_not_watched() {
    let d = tempfile::tempdir().unwrap();
    std::fs::create_dir(d.path().join("workspace")).unwrap();
    let root = d.path().join("workspace");

    let outside = d.path().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("n.md"), b"# n\n").unwrap();

    let fs = LocalFs::open(&root).unwrap();
    let watch = fs.watch();
    let deadline = Instant::now() + Duration::from_secs(30);
    let mut p = watch.progress();
    while p.walking && Instant::now() < deadline {
        std::thread::sleep(Duration::from_millis(2));
        p = watch.progress();
    }
    if let Some(reason) = p.degraded {
        eprintln!("skipped: this machine cannot watch ({reason:?})");
        return;
    }
    let before = watch.progress().dirs;

    std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();
    let _ = watch.wait(Duration::from_secs(3));

    assert_eq!(
        watch.progress().dirs,
        before,
        "a symlinked directory is not descended into and takes no watch"
    );
}
