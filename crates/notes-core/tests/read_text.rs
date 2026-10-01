//! `read_text`: a note's text for the AI assistant (ADR-100), read without
//! giving anything an identity or touching the workspace.

use notes_core::WorkspaceService;
use notes_model::{CoreError, RelPath};
use std::fs;

fn open(files: &[(&str, &[u8])]) -> (tempfile::TempDir, WorkspaceService) {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("notes");
    fs::create_dir_all(root.join("sub")).unwrap();
    for (name, bytes) in files {
        fs::write(root.join(name), bytes).unwrap();
    }
    let mut service = WorkspaceService::with_data_dir(dir.path().join("data")).unwrap();
    service.open_workspace(&root).unwrap();
    (dir, service)
}

fn path(p: &str) -> RelPath {
    RelPath::parse(p).unwrap()
}

#[test]
fn a_note_reads_as_text_with_unix_line_endings_and_is_not_changed() {
    let (dir, service) = open(&[
        ("a.md", b"# t\r\num\r\ndois\r\n"),
        ("sub/b.markdown", "ação\n".as_bytes()),
    ]);
    let a = service.read_text(&path("a.md"), 1000).unwrap();
    assert_eq!(
        (a.text.as_str(), a.truncated, a.chars),
        ("# t\num\ndois\n", false, 12)
    );
    assert_eq!(
        service
            .read_text(&path("sub/b.markdown"), 1000)
            .unwrap()
            .text,
        "ação\n"
    );
    assert_eq!(
        fs::read(dir.path().join("notes/a.md")).unwrap(),
        b"# t\r\num\r\ndois\r\n",
        "the file is untouched"
    );
}

#[test]
fn a_long_note_is_cut_by_characters_not_bytes_and_says_so() {
    let (_dir, service) = open(&[("a.md", "áéíóú0123456789".as_bytes())]);
    let note = service.read_text(&path("a.md"), 7).unwrap();
    assert_eq!(note.text, "áéíóú01", "seven characters, though more bytes");
    assert!(note.truncated);
    assert_eq!(note.chars, 15, "the whole length is still reported");
    let all = service.read_text(&path("a.md"), 15).unwrap();
    assert!(!all.truncated && all.text.chars().count() == 15);
}

#[test]
fn only_notes_that_are_text_inside_the_workspace_can_be_read() {
    let (dir, service) = open(&[
        ("a.md", b"ok"),
        ("secret.env", b"KEY=1"),
        ("bin.md", &[0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]),
    ]);
    // Not a note.
    assert!(matches!(
        service.read_text(&path("secret.env"), 100),
        Err(CoreError::Unsupported { .. })
    ));
    // A note that is not text.
    assert!(service.read_text(&path("bin.md"), 100).is_err());
    // A folder with a note's name.
    fs::create_dir(dir.path().join("notes/dir.md")).unwrap();
    assert!(service.read_text(&path("dir.md"), 100).is_err());
    // Missing.
    assert!(service.read_text(&path("missing.md"), 100).is_err());
    // A path outside the root cannot even be written as a RelPath.
    assert!(RelPath::parse("../outside.md").is_err());
}

#[cfg(unix)]
#[test]
fn a_symlink_out_of_the_workspace_is_not_followed() {
    let (dir, service) = open(&[("a.md", b"ok")]);
    let outside = dir.path().join("outside.md");
    fs::write(&outside, "do not leak").unwrap();
    std::os::unix::fs::symlink(&outside, dir.path().join("notes/leak.md")).unwrap();
    assert!(
        service.read_text(&path("leak.md"), 100).is_err(),
        "the root jail holds for this read too"
    );
}

#[test]
fn reading_needs_an_open_workspace() {
    let dir = tempfile::tempdir().unwrap();
    let service = WorkspaceService::with_data_dir(dir.path().join("data")).unwrap();
    assert!(service.read_text(&path("a.md"), 100).is_err());
}
