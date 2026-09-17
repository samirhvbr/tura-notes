//! The root jail, against a real filesystem.
//!
//! 0.1a acceptance: *"Nenhum command aceita path resolvido fora da raiz (`..`,
//! absoluto, symlink) — teste no core."* The string half is `RelPath`'s unit
//! tests; this is the half that needs a disk, because a symlink is a valid
//! relative path that resolves elsewhere.

use notes_fs::{FileSystem, LocalFs};
use notes_model::{CoreError, RelPath};

fn workspace() -> (tempfile::TempDir, LocalFs) {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("inside.md"), b"# inside\n").unwrap();
    std::fs::create_dir(dir.path().join("sub")).unwrap();
    std::fs::write(dir.path().join("sub/deep.md"), b"# deep\n").unwrap();
    let fs = LocalFs::open(dir.path()).unwrap();
    (dir, fs)
}

#[test]
fn relative_escapes_never_parse() {
    for bad in [
        "../secret.md",
        "sub/../../secret.md",
        "/etc/passwd",
        "C:/secret.md",
    ] {
        assert!(RelPath::parse(bad).is_err(), "{bad} must not parse");
    }
}

#[test]
fn a_symlink_out_of_the_root_is_refused_not_followed() {
    let (dir, fs) = workspace();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("secret.md"), b"# secret\n").unwrap();

    #[cfg(unix)]
    std::os::unix::fs::symlink(outside.path().join("secret.md"), dir.path().join("link.md"))
        .unwrap();
    #[cfg(windows)]
    if std::os::windows::fs::symlink_file(
        outside.path().join("secret.md"),
        dir.path().join("link.md"),
    )
    .is_err()
    {
        return; // unprivileged Windows cannot create symlinks; nothing to assert
    }

    let p = RelPath::parse("link.md").unwrap();
    assert!(matches!(
        fs.read(&p),
        Err(CoreError::SymlinkNotFollowed { .. })
    ));
    assert!(matches!(
        fs.stat(&p),
        Err(CoreError::SymlinkNotFollowed { .. })
    ));
    assert!(matches!(
        fs.write_atomic(&p, b"overwritten", None),
        Err(CoreError::SymlinkNotFollowed { .. })
    ));
    assert_eq!(
        std::fs::read(outside.path().join("secret.md")).unwrap(),
        b"# secret\n",
        "the file outside the root must be untouched"
    );
}

/// A symlinked *directory* mid-path is the case a check on the final component
/// would miss.
#[cfg(unix)]
#[test]
fn a_symlinked_directory_is_refused_mid_path() {
    let (dir, fs) = workspace();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("secret.md"), b"# secret\n").unwrap();
    std::os::unix::fs::symlink(outside.path(), dir.path().join("escape")).unwrap();

    let p = RelPath::parse("escape/secret.md").unwrap();
    assert!(matches!(
        fs.read(&p),
        Err(CoreError::SymlinkNotFollowed { .. })
    ));
}

#[test]
fn paths_inside_the_root_work() {
    let (_dir, fs) = workspace();
    assert_eq!(
        fs.read(&RelPath::parse("inside.md").unwrap()).unwrap(),
        b"# inside\n"
    );
    assert_eq!(
        fs.read(&RelPath::parse("sub/deep.md").unwrap()).unwrap(),
        b"# deep\n"
    );
}

#[test]
fn a_symlink_appears_in_the_listing_but_is_not_a_note() {
    let (dir, fs) = workspace();
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(dir.path().join("inside.md"), dir.path().join("alias.md"))
            .unwrap();
        let entries = fs.list(&RelPath::root()).unwrap();
        let alias = entries
            .iter()
            .find(|e| e.name == "alias.md")
            .expect("symlink is listed");
        assert_eq!(alias.kind, notes_model::EntryKind::Symlink);
        assert!(
            !alias.is_note,
            "a symlink is shown as such and does not open"
        );
    }
    #[cfg(not(unix))]
    let _ = (dir, fs);
}

/// The temp file is the half of the jail that a path check cannot reach.
///
/// `tmp_path` uses a deterministic `.{name}.tmp` beside the note — deliberate,
/// so a crash leaves at most one of them — which also makes it predictable. A
/// link left at that name used to receive the next save's bytes, because
/// `File::create` follows a symlink and no path check ever looks at the temp.
#[cfg(unix)]
#[test]
fn a_symlink_at_the_temp_path_never_receives_the_write() {
    let (dir, fs) = workspace();
    let outside = tempfile::tempdir().unwrap();
    let victim = outside.path().join("victim");
    std::fs::write(&victim, b"untouched\n").unwrap();

    std::os::unix::fs::symlink(&victim, dir.path().join(".inside.md.tmp")).unwrap();

    let path = RelPath::parse("inside.md").unwrap();
    fs.write_atomic(&path, b"# changed\n", None).unwrap();

    assert_eq!(
        std::fs::read(&victim).unwrap(),
        b"untouched\n",
        "the write escaped the root through the temp path"
    );
    assert_eq!(fs.read(&path).unwrap(), b"# changed\n");
}

/// The leftover-temp contract the deterministic name exists for still holds:
/// a stale temp is reused rather than accumulating, and the note still saves.
#[test]
fn a_stale_temp_file_does_not_block_the_next_save() {
    let (dir, fs) = workspace();
    std::fs::write(
        dir.path().join(".inside.md.tmp"),
        b"leftover from a crash\n",
    )
    .unwrap();

    let path = RelPath::parse("inside.md").unwrap();
    fs.write_atomic(&path, b"# saved\n", None).unwrap();

    assert_eq!(fs.read(&path).unwrap(), b"# saved\n");
    assert!(!dir.path().join(".inside.md.tmp").exists());
}
