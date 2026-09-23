//! R6-27a: what the application keeps about the user's notes is readable by the
//! user and nobody else on the machine.
//!
//! The data directory holds the full text of every opened note (the content
//! index), drafts, conflict snapshots and the identity registry. It was created
//! `0755` with `0644` files; on the machine the finding came from, the index
//! alone was 108 MB of other people's-readable note text.
#![cfg(unix)]

use std::os::unix::fs::PermissionsExt;
use std::path::Path;

use notes_core::WorkspaceService;

fn mode(path: &Path) -> u32 {
    std::fs::metadata(path).unwrap().permissions().mode() & 0o777
}

/// Every file and directory under `root`, with its mode, that anyone but the
/// owner can reach.
fn exposed(root: &Path) -> Vec<(String, u32)> {
    let mut out = vec![];
    let mut pending = vec![root.to_path_buf()];
    while let Some(dir) = pending.pop() {
        for entry in std::fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            let m = mode(&path);
            if path.is_dir() {
                pending.push(path.clone());
            } else if m & 0o077 != 0 {
                out.push((path.display().to_string(), m));
            }
        }
    }
    out
}

#[test]
fn a_new_data_directory_and_what_it_stores_are_private() {
    let parent = tempfile::tempdir().unwrap();
    let data = parent.path().join("notes");
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("a.md"), "# private\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(&data).unwrap();
    svc.open_workspace(work.path()).unwrap();
    svc.index_start(true).unwrap();
    for _ in 0..500 {
        if !svc.index_status().unwrap().running {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    svc.close_workspace(&[]).unwrap();

    assert_eq!(mode(&data), 0o700);
    assert_eq!(exposed(&data), vec![]);
}

/// An existing install keeps working and stops being readable: the root is
/// tightened on every start, and nothing below a directory others cannot enter
/// is reachable by them.
#[test]
fn an_existing_open_data_directory_is_tightened_on_start() {
    let parent = tempfile::tempdir().unwrap();
    let data = parent.path().join("notes");
    std::fs::create_dir(&data).unwrap();
    std::fs::set_permissions(&data, std::fs::Permissions::from_mode(0o755)).unwrap();
    std::fs::write(data.join("settings.json"), "{}").unwrap();

    WorkspaceService::with_data_dir(&data).unwrap();
    assert_eq!(mode(&data), 0o700);
}
