//! A file whose name is not valid UTF-8 works like any other note (ADR-090).
//!
//! Before 1.8.0 the listing spelled it with `U+FFFD` — a name no file on disk
//! has — and marked it a note, so the tree offered a row that answered "not
//! found"; the watcher dropped every event about it; `Ctrl+P` offered it too;
//! and duplicating its folder stopped halfway, after writing part of the copy.
//!
//! Unix only: a Unix name is bytes. APFS refuses such a name at creation and a
//! Windows name is UTF-16, so neither can hold one.
#![cfg(target_os = "linux")]

use notes_core::WorkspaceService;
use notes_model::{display_segment, RelPath};
use std::ffi::OsStr;
use std::os::unix::ffi::OsStrExt;

/// `reunião.md` written in cp1252, the way an old Windows backup unpacks.
const RAW: &[u8] = b"reuni\xe3o.md";

fn workspace() -> (tempfile::TempDir, tempfile::TempDir, WorkspaceService) {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::create_dir(work.path().join("pasta")).unwrap();
    std::fs::write(
        work.path().join("pasta").join(OsStr::from_bytes(RAW)),
        b"# ata\n",
    )
    .unwrap();
    std::fs::write(work.path().join("pasta/outra.md"), b"# outra\n").unwrap();
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    svc.open_workspace(work.path()).unwrap();
    (data, work, svc)
}

fn the_entry(svc: &WorkspaceService) -> notes_model::Entry {
    svc.list_dir(&RelPath::parse("pasta").unwrap())
        .unwrap()
        .into_iter()
        .find(|e| e.name.starts_with("reuni"))
        .expect("the file is listed")
}

#[test]
fn it_is_listed_as_a_note_under_a_path_that_opens_it() {
    let (_d, _w, mut svc) = workspace();
    let e = the_entry(&svc);
    assert!(e.is_note);
    assert_eq!(e.name, "reuni\u{FFFD}o.md", "what a person reads");
    assert_eq!(display_segment(e.path.file_name()), e.name);

    let opened = svc
        .open_note(&e.path)
        .expect("the path the tree offers opens the file");
    assert_eq!(opened.text, "# ata\n");
}

#[test]
fn it_saves_back_to_the_same_bytes_on_disk() {
    let (_d, work, mut svc) = workspace();
    let e = the_entry(&svc);
    let opened = svc.open_note(&e.path).unwrap();
    svc.save_note(opened.note_id, "# ata editada\n", 1, &opened.base_rev)
        .unwrap();
    let on_disk = std::fs::read(work.path().join("pasta").join(OsStr::from_bytes(RAW))).unwrap();
    assert_eq!(
        on_disk, b"# ata editada\n",
        "written to the real name, not a lossy twin"
    );
    let names: Vec<_> = std::fs::read_dir(work.path().join("pasta"))
        .unwrap()
        .flatten()
        .collect();
    assert_eq!(names.len(), 2, "no second file was created beside it");
}

#[test]
fn it_can_be_renamed_to_a_valid_name() {
    let (_d, work, mut svc) = workspace();
    let e = the_entry(&svc);
    svc.rename_entry(&e.path, "reuniao.md").unwrap();
    assert!(work.path().join("pasta/reuniao.md").exists());
    assert!(!work
        .path()
        .join("pasta")
        .join(OsStr::from_bytes(RAW))
        .exists());
}

#[test]
fn duplicating_its_folder_copies_it_instead_of_stopping_halfway() {
    let (_d, work, mut svc) = workspace();
    let copy = svc
        .duplicate_entry(&RelPath::parse("pasta").unwrap())
        .unwrap();
    let copied = work
        .path()
        .join(copy.path.as_str())
        .join(OsStr::from_bytes(RAW));
    assert_eq!(std::fs::read(copied).unwrap(), b"# ata\n");
}

#[test]
fn quick_open_offers_a_path_that_opens() {
    let (_d, _w, mut svc) = workspace();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
    let hit = loop {
        let q = svc.quick_open("reuni", 10).unwrap();
        if !q.building {
            break q.matches.into_iter().next().expect("offered");
        }
        assert!(std::time::Instant::now() < deadline, "the walk finishes");
        std::thread::sleep(std::time::Duration::from_millis(5));
    };
    svc.open_note(&hit.path)
        .expect("Ctrl+P offers a path that opens");
}

#[test]
fn a_hostile_escape_cannot_leave_the_workspace() {
    let (_d, _w, mut svc) = workspace();
    // An escape standing for `/`, arriving the way a sync peer or an MCP client
    // could send it, never becomes a `RelPath` at all.
    assert!(RelPath::parse("pasta/\u{FFFF}2f\u{FFFF}2e\u{FFFF}2e").is_err());
    assert!(svc
        .open_note(&RelPath::parse("pasta/outra.md").unwrap())
        .is_ok());
}
