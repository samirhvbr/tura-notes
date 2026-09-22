//! The 0.1a acceptance criteria that say "teste automatizado no core".
//!
//! Every test here runs with no Tauri, no window and no global state: the data
//! directory is redirected with `NOTES_DATA_DIR`, which is why that override
//! exists (`ARCHITECTURE.md` §4).

use notes_core::{DraftChoice, DraftReason, SaveResult, WorkspaceService};
use notes_model::{CoreError, RelPath};
#[cfg(unix)]
use std::path::PathBuf;

struct Fixture {
    _data: tempfile::TempDir,
    work: tempfile::TempDir,
    svc: WorkspaceService,
}

fn setup() -> Fixture {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("nota.md"), b"# nota\n\ncorpo\n").unwrap();
    std::fs::write(work.path().join("outra.md"), b"# outra\n").unwrap();
    std::fs::create_dir(work.path().join("sub")).unwrap();
    std::fs::write(work.path().join("sub/deep.md"), b"# deep\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    svc.open_workspace(work.path()).unwrap();
    Fixture {
        _data: data,
        work,
        svc,
    }
}

fn rel(s: &str) -> RelPath {
    RelPath::parse(s).unwrap()
}

#[cfg(unix)]
fn drafts_dir(svc: &WorkspaceService, id: notes_model::WorkspaceId) -> PathBuf {
    notes_core::paths::drafts_dir(&notes_core::paths::workspace_dir(svc.data_dir(), id))
}

// ---------------------------------------------------------------------------
// "Abrir uma pasta não cria nenhum arquivo nela"
// ---------------------------------------------------------------------------

#[test]
fn opening_a_folder_creates_nothing_inside_it() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("nota.md"), b"# n\n").unwrap();

    let before = snapshot(work.path());
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let info = svc.open_workspace(work.path()).unwrap();
    svc.list_dir(&RelPath::root()).unwrap();
    svc.open_note(&rel("nota.md")).unwrap();
    let after = snapshot(work.path());

    assert_eq!(
        before, after,
        "the workspace folder was modified by opening it"
    );
    assert!(info.read_only.is_none());
    // The case probe is part of open, and it must not have written either.
    assert!(!work.path().join(".notes").exists());
}

fn snapshot(root: &std::path::Path) -> Vec<(String, u64)> {
    let mut v = Vec::new();
    fn walk(root: &std::path::Path, dir: &std::path::Path, v: &mut Vec<(String, u64)>) {
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            let p = e.path();
            let name = p.strip_prefix(root).unwrap().to_string_lossy().to_string();
            if e.file_type().unwrap().is_dir() {
                v.push((name, 0));
                walk(root, &p, v);
            } else {
                v.push((name, e.metadata().unwrap().len()));
            }
        }
    }
    walk(root, root, &mut v);
    v.sort();
    v
}

// ---------------------------------------------------------------------------
// "Nenhum command aceita path resolvido fora da raiz"
// ---------------------------------------------------------------------------

#[test]
fn no_command_accepts_a_path_that_escapes_as_a_string() {
    for bad in ["../escape.md", "sub/../../escape.md", "/etc/passwd"] {
        assert!(RelPath::parse(bad).is_err(), "{bad} must not even parse");
    }
}

/// The half that needs a disk: a symlink is a well-formed relative path that
/// resolves elsewhere, so no string rule can catch it.
#[cfg(unix)]
#[test]
fn no_command_follows_a_symlink_out_of_the_root() {
    let f = setup();
    let outside = tempfile::tempdir().unwrap();
    std::fs::write(outside.path().join("secret.md"), b"# secret\n").unwrap();
    std::os::unix::fs::symlink(
        outside.path().join("secret.md"),
        f.work.path().join("link.md"),
    )
    .unwrap();

    let mut svc = f.svc;
    assert!(matches!(
        svc.open_note(&rel("link.md")),
        Err(CoreError::SymlinkNotFollowed { .. })
    ));
    assert_eq!(
        std::fs::read(outside.path().join("secret.md")).unwrap(),
        b"# secret\n",
        "the file outside the root must be untouched"
    );
}

// ---------------------------------------------------------------------------
// "Buffer sujo + `echo x >> nota.md` externo → autosave suspende, nada
//  sobrescrito, rascunho em app data"
// ---------------------------------------------------------------------------

#[test]
fn an_external_append_suspends_autosave_and_writes_a_draft_without_overwriting() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let id = opened.note_id;
    let base = opened.base_rev.clone();

    // The user is typing; nothing saved yet.
    let dirty = format!("{}editado pelo usuário\n", opened.text);

    // Somebody else appends. `echo x >> nota.md`, in effect.
    std::thread::sleep(std::time::Duration::from_millis(10));
    std::fs::write(f.work.path().join("nota.md"), b"# nota\n\ncorpo\nx\n").unwrap();

    let result = f.svc.save_note(id, &dirty, 7, &base).unwrap();
    assert!(
        matches!(result, SaveResult::Conflict { .. }),
        "got {result:?}"
    );

    // Nothing overwritten.
    assert_eq!(
        std::fs::read(f.work.path().join("nota.md")).unwrap(),
        b"# nota\n\ncorpo\nx\n",
        "the external change must survive intact"
    );

    // Autosave suspended for this note.
    assert!(f.svc.is_suspended(id));

    // The buffer is recoverable from app data.
    let drafts = f.svc.list_drafts().unwrap();
    assert_eq!(drafts.len(), 1);
    assert_eq!(drafts[0].note_id, id);
    assert_eq!(drafts[0].reason, DraftReason::Conflict);

    let restored = f.svc.resolve_draft(id, DraftChoice::Restore).unwrap();
    assert_eq!(
        restored.text, dirty,
        "the draft holds exactly what was typed"
    );
}

#[test]
fn a_suspended_note_keeps_its_edits_going_to_the_draft() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let id = opened.note_id;
    let base = opened.base_rev.clone();

    std::thread::sleep(std::time::Duration::from_millis(10));
    std::fs::write(f.work.path().join("nota.md"), b"# externo\n").unwrap();
    let _ = f.svc.save_note(id, "meu texto", 1, &base).unwrap();
    assert!(f.svc.is_suspended(id));

    // More typing while suspended: the draft moves, the note does not.
    f.svc
        .write_draft(id, "meu texto continuado", 2, &base, DraftReason::Conflict)
        .unwrap();
    assert_eq!(
        std::fs::read(f.work.path().join("nota.md")).unwrap(),
        b"# externo\n"
    );
    let restored = f.svc.resolve_draft(id, DraftChoice::Restore).unwrap();
    assert_eq!(restored.text, "meu texto continuado");
}

// ---------------------------------------------------------------------------
// "Disco cheio / permissão negada → erro visível, buffer recuperável ao reabrir"
// ---------------------------------------------------------------------------

#[cfg(unix)]
#[test]
fn a_denied_write_is_reported_and_leaves_the_buffer_recoverable() {
    use notes_model::IoKind;
    use std::os::unix::fs::PermissionsExt;
    // Root ignores the permission bits, so the denial this test needs cannot be
    // arranged — as it is in the Arch CI container. Skipping is honest;
    // asserting anyway would make the test pass for the wrong reason.
    if unsafe { libc::geteuid() } == 0 {
        eprintln!("skipped: running as root, which cannot be denied write access");
        return;
    }
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let id = opened.note_id;
    let base = opened.base_rev.clone();
    let ws_id = f.svc.recent_workspaces().unwrap()[0].id;

    // Make the directory unwritable: the temp file cannot be created.
    let dir = f.work.path();
    let original = std::fs::metadata(dir).unwrap().permissions();
    std::fs::set_permissions(dir, std::fs::Permissions::from_mode(0o555)).unwrap();

    let result = f.svc.save_note(id, "texto que não cabe", 3, &base);
    std::fs::set_permissions(dir, original).unwrap();

    let result = result.unwrap();
    match result {
        SaveResult::WriteFailed { kind, .. } => {
            assert!(
                matches!(kind, IoKind::PermissionDenied | IoKind::ReadOnlyFilesystem),
                "expected a permission failure, got {kind:?}"
            );
        }
        other => panic!("expected WriteFailed, got {other:?}"),
    }

    // Recoverable after a restart: a fresh service over the same data directory.
    let path = drafts_dir(&f.svc, ws_id).join(format!("{id}.draft"));
    assert!(
        path.exists(),
        "a failed write must leave a draft at {}",
        path.display()
    );
    let raw = std::fs::read(&path).unwrap();
    assert!(
        String::from_utf8_lossy(&raw).contains("texto que não cabe"),
        "the draft must hold the buffer verbatim"
    );
}

// ---------------------------------------------------------------------------
// Write protocol
// ---------------------------------------------------------------------------

#[test]
fn saving_unchanged_content_writes_nothing_and_does_not_move_mtime() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let before = std::fs::metadata(f.work.path().join("nota.md")).unwrap();

    std::thread::sleep(std::time::Duration::from_millis(10));
    let r = f
        .svc
        .save_note(opened.note_id, &opened.text, 1, &opened.base_rev)
        .unwrap();
    assert!(
        matches!(
            r,
            SaveResult::Saved {
                unchanged: true,
                ..
            }
        ),
        "got {r:?}"
    );

    let after = std::fs::metadata(f.work.path().join("nota.md")).unwrap();
    assert_eq!(
        before.modified().unwrap(),
        after.modified().unwrap(),
        "mtime moved"
    );
    assert_eq!(
        std::fs::read(f.work.path().join("nota.md")).unwrap(),
        b"# nota\n\ncorpo\n"
    );
}

#[test]
fn an_ordinary_save_writes_and_clears_the_draft() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let id = opened.note_id;

    f.svc
        .write_draft(id, "rascunho", 1, &opened.base_rev, DraftReason::Stale)
        .unwrap();
    assert_eq!(f.svc.list_drafts().unwrap().len(), 1);

    let r = f
        .svc
        .save_note(id, "# nova\n\nversão\n", 2, &opened.base_rev)
        .unwrap();
    match r {
        SaveResult::Saved {
            unchanged,
            buffer_version,
            ..
        } => {
            assert!(!unchanged);
            assert_eq!(buffer_version, 2);
        }
        other => panic!("expected Saved, got {other:?}"),
    }
    assert_eq!(
        std::fs::read(f.work.path().join("nota.md")).unwrap(),
        "# nova\n\nversão\n".as_bytes()
    );
    assert!(
        f.svc.list_drafts().unwrap().is_empty(),
        "a confirmed write clears the draft"
    );
}

#[test]
fn convergence_is_not_a_conflict() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();

    // Someone else writes exactly what the buffer holds.
    std::thread::sleep(std::time::Duration::from_millis(10));
    std::fs::write(f.work.path().join("nota.md"), b"# convergiu\n").unwrap();

    let r = f
        .svc
        .save_note(opened.note_id, "# convergiu\n", 5, &opened.base_rev)
        .unwrap();
    assert!(
        matches!(
            r,
            SaveResult::Saved {
                unchanged: true,
                ..
            }
        ),
        "got {r:?}"
    );
    assert!(!f.svc.is_suspended(opened.note_id));
}

#[test]
fn a_stale_save_reports_the_version_it_was_given() {
    let mut f = setup();
    let opened = f.svc.open_note(&rel("nota.md")).unwrap();
    let r = f
        .svc
        .save_note(opened.note_id, "novo", 41, &opened.base_rev)
        .unwrap();
    // The frontend paints a tab clean only when this equals its current
    // version, which is what stops an old save clearing a newer buffer.
    match r {
        SaveResult::Saved { buffer_version, .. } => assert_eq!(buffer_version, 41),
        other => panic!("{other:?}"),
    }
}

#[test]
fn the_byte_profile_survives_a_round_trip_through_the_service() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    let original: &[u8] = b"\xef\xbb\xbf# crlf com bom\r\n\r\ncorpo\r\n";
    std::fs::write(work.path().join("n.md"), original).unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    svc.open_workspace(work.path()).unwrap();
    let opened = svc.open_note(&rel("n.md")).unwrap();
    assert!(opened.profile.bom);
    assert_eq!(
        opened.text, "# crlf com bom\n\ncorpo\n",
        "the editor sees only \\n"
    );

    svc.save_note(opened.note_id, &opened.text, 1, &opened.base_rev)
        .unwrap();
    assert_eq!(std::fs::read(work.path().join("n.md")).unwrap(), original);
}

#[test]
fn a_read_only_note_refuses_to_be_saved() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("misto.md"), b"a\nb\r\nc\n").unwrap();
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    svc.open_workspace(work.path()).unwrap();

    let opened = svc.open_note(&rel("misto.md")).unwrap();
    assert_eq!(
        opened.read_only,
        Some(notes_model::ReadOnlyReason::MixedEol)
    );
    let err = svc
        .save_note(opened.note_id, "qualquer coisa", 1, &opened.base_rev)
        .unwrap_err();
    assert!(matches!(err, CoreError::ReadOnly { .. }), "got {err:?}");
    assert_eq!(
        std::fs::read(work.path().join("misto.md")).unwrap(),
        b"a\nb\r\nc\n"
    );
}

// ---------------------------------------------------------------------------
// Registry, tree, workspace
// ---------------------------------------------------------------------------

#[test]
fn listing_assigns_no_identity() {
    let mut f = setup();
    f.svc.list_dir(&RelPath::root()).unwrap();
    f.svc.list_dir(&rel("sub")).unwrap();
    assert!(f.svc.list_drafts().unwrap().is_empty());

    // Opening one note is what creates one record — not listing three.
    let id = f.svc.open_note(&rel("nota.md")).unwrap().note_id;
    let again = f.svc.open_note(&rel("nota.md")).unwrap().note_id;
    assert_eq!(id, again, "reopening a note keeps its identity");
}

#[test]
fn the_tree_hides_the_default_ignore_list_and_shows_notes() {
    let f = setup();
    std::fs::create_dir(f.work.path().join(".git")).unwrap();
    std::fs::write(f.work.path().join(".git/HEAD"), b"ref: x\n").unwrap();
    std::fs::create_dir(f.work.path().join(".obsidian")).unwrap();

    let names: Vec<_> = f
        .svc
        .list_dir(&RelPath::root())
        .unwrap()
        .into_iter()
        .map(|e| e.name)
        .collect();
    assert!(names.contains(&"nota.md".to_string()));
    assert!(names.contains(&"sub".to_string()));
    assert!(
        !names.contains(&".git".to_string()),
        "IGNORE_DEFAULT applies with no config"
    );
    assert!(!names.contains(&".obsidian".to_string()));
}

#[test]
fn creating_a_note_refuses_a_collision_and_never_overwrites() {
    let mut f = setup();
    let err = f.svc.create_note(&RelPath::root(), "nota").unwrap_err();
    assert!(
        matches!(err, CoreError::AlreadyExists { .. }),
        "got {err:?}"
    );
    assert_eq!(
        std::fs::read(f.work.path().join("nota.md")).unwrap(),
        b"# nota\n\ncorpo\n"
    );

    let e = f.svc.create_note(&RelPath::root(), "terceira").unwrap();
    assert_eq!(e.name, "terceira.md");
    assert_eq!(
        std::fs::read(f.work.path().join("terceira.md")).unwrap(),
        b""
    );
}

#[test]
fn the_last_workspace_comes_back_after_a_restart() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let id = {
        let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
        svc.open_workspace(work.path()).unwrap().id
    };

    // A different service over the same data directory: a restart.
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let restored = svc
        .restore_last_workspace()
        .unwrap()
        .expect("a workspace was open");
    assert_eq!(
        restored.id, id,
        "the same workspace, with the same identity"
    );
    assert!(restored.restored);
}

#[test]
fn a_workspace_that_moved_is_reported_rather_than_treated_as_absent() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();
    {
        let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
        svc.open_workspace(work.path()).unwrap();
    }
    // The canonical path, not the one handed to `open_workspace`: on macOS
    // `/var` is a symlink to `/private/var`, so a temp directory has two names
    // and the registry stores the resolved one.
    let path = work.path().canonicalize().unwrap();
    drop(work); // the folder disappears

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    match svc.restore_last_workspace() {
        Err(CoreError::Unavailable { root, .. }) => assert_eq!(root, path.display().to_string()),
        other => panic!("expected Unavailable, got {other:?}"),
    }
}

#[test]
fn closing_refuses_while_buffers_are_dirty() {
    let mut f = setup();
    let id = f.svc.open_note(&rel("nota.md")).unwrap().note_id;
    match f.svc.close_workspace(&[id]) {
        Err(CoreError::DirtyBuffers { count, .. }) => assert_eq!(count, 1),
        other => panic!("expected DirtyBuffers, got {other:?}"),
    }
    f.svc.close_workspace(&[]).unwrap();
}

#[test]
fn state_written_by_a_newer_build_is_never_overwritten() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let ws_id = {
        let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
        svc.open_workspace(work.path()).unwrap().id
    };
    let reg =
        notes_core::paths::registry_file(&notes_core::paths::workspace_dir(data.path(), ws_id));
    let from_the_future = br#"{"schema":999,"a_field_we_do_not_know":true}"#;
    std::fs::write(&reg, from_the_future).unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let info = svc.open_workspace(work.path()).unwrap();
    assert_eq!(
        info.read_only,
        Some(notes_model::WorkspaceReadOnly::SchemaAhead { found: 999 }),
        "a workspace with future state opens read-only, and says how far ahead"
    );
    assert_eq!(svc.workspace_id(), Some(ws_id));
    assert_eq!(
        std::fs::read(&reg).unwrap(),
        from_the_future,
        "state we cannot interpret must not be destroyed"
    );
}

#[test]
fn creating_a_name_that_breaks_another_platform_is_refused() {
    let mut f = setup();
    for bad in ["trailing-dot.", "a:b", "CON", "nul", "a?b"] {
        let err = f.svc.create_note(&RelPath::root(), bad).unwrap_err();
        assert!(
            matches!(err, CoreError::InvalidPath { .. }),
            "{bad} should be refused, got {err:?}"
        );
    }
    // The rule applies to new names only. Nothing on disk was created.
    let names: Vec<_> = f
        .svc
        .list_dir(&RelPath::root())
        .unwrap()
        .into_iter()
        .map(|e| e.name)
        .collect();
    assert!(!names.iter().any(|n| n.ends_with('.')));
}

/// An odd name that is *already on disk* is listed, never renamed (scope §7.6).
/// Created at runtime because a trailing dot cannot be committed: git aborts a
/// Windows checkout with `invalid path` before any test runs.
#[cfg(unix)]
#[test]
fn an_existing_name_with_a_trailing_dot_is_listed_and_left_alone() {
    let f = setup();
    let odd = f.work.path().join("legado.md.");
    std::fs::write(&odd, b"# legado\n").unwrap();

    let names: Vec<_> = f
        .svc
        .list_dir(&RelPath::root())
        .unwrap()
        .into_iter()
        .map(|e| e.name)
        .collect();
    assert!(
        names.contains(&"legado.md.".to_string()),
        "an existing odd name is shown: {names:?}"
    );
    assert!(odd.exists(), "and never renamed");
}

/// A name that differs only by case collides, on a root that folds case.
///
/// Created at runtime rather than committed: `Duplicate.md` and `duplicate.md`
/// are one file on case-insensitive APFS or NTFS, so committing both makes the
/// checkout wrong on those platforms before any test runs — which is how the
/// macOS CI job found it.
#[test]
fn a_name_differing_only_by_case_is_refused_when_the_root_folds_case() {
    let mut f = setup();
    std::fs::write(f.work.path().join("Nota.md"), b"# maiuscula\n").unwrap();
    let folds = std::fs::metadata(f.work.path().join("nota.md")).is_ok()
        && std::fs::read(f.work.path().join("nota.md")).unwrap() == b"# maiuscula\n";

    // Re-open so the case probe sees the file that was just created.
    f.svc.open_workspace(f.work.path()).unwrap();
    let result = f.svc.create_note(&RelPath::root(), "NOTA");

    if folds {
        assert!(
            matches!(result, Err(CoreError::AlreadyExists { .. })),
            "a case-folding root must refuse a colliding name, got {result:?}"
        );
    } else {
        assert!(
            result.is_ok(),
            "a case-sensitive root allows it: {result:?}"
        );
    }
}

/// A name in NFD is a distinct file where the filesystem stores what it is
/// given, and the same file where it normalises. Created at runtime for the
/// same reason as the case pair.
#[test]
fn a_name_in_nfd_is_compared_against_its_nfc_form() {
    let mut f = setup();
    let nfc = "cafe\u{301}.md"; // e + combining acute — NFD on disk
    std::fs::write(f.work.path().join(nfc), b"# nfd\n").unwrap();
    f.svc.open_workspace(f.work.path()).unwrap();

    let listed: Vec<_> = f
        .svc
        .list_dir(&RelPath::root())
        .unwrap()
        .into_iter()
        .map(|e| e.name)
        .collect();
    assert!(
        listed.iter().any(|n| n.contains("caf")),
        "the file is listed under whatever form the filesystem stored: {listed:?}"
    );

    // Creating the composed form collides: CompareKey normalises, RelPath does not.
    let result = f.svc.create_note(&RelPath::root(), "café");
    assert!(
        matches!(result, Err(CoreError::AlreadyExists { .. })),
        "NFC and NFD are the same name to compare against, got {result:?}"
    );
}

/// Losing the identity registry used to be indistinguishable from never having
/// had one, and the difference is every `NoteId` in the workspace.
///
/// `Loaded::Fresh` took one branch for both, so a workspace whose registry had
/// gone opened normally, wrote an empty registry over the absence, and let the
/// next reconciliation mint new identities for every note. Each
/// `drafts/<old-id>.draft` became unreachable at that moment — and a draft is
/// the only copy of something the user typed.
#[test]
fn a_registry_that_was_here_and_is_gone_opens_read_only_instead_of_renumbering() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let (ws_id, first_id) = {
        let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
        let info = svc.open_workspace(work.path()).unwrap();
        let note = svc.open_note(&RelPath::parse("n.md").unwrap()).unwrap();
        (info.id, note.note_id)
    };

    // Exactly what ADR-004 invites: the state directory is rebuildable, so it
    // gets deleted to force a reindex.
    let dir = notes_core::paths::workspace_dir(data.path(), ws_id);
    std::fs::remove_file(notes_core::paths::registry_file(&dir).with_extension("db")).ok();
    std::fs::remove_file(notes_core::paths::registry_file(&dir)).ok();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let info = svc.open_workspace(work.path()).unwrap();
    assert_eq!(
        info.read_only,
        Some(notes_model::WorkspaceReadOnly::IdentityLost),
        "a root the index still lists, with no registry, is damage rather than a new workspace"
    );

    // And the refusal has to be the thing that protects identity: opening
    // read-only is only worth anything if nothing was written over the gap.
    drop(svc);
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    assert_eq!(
        svc.open_workspace(work.path()).unwrap().read_only,
        Some(notes_model::WorkspaceReadOnly::IdentityLost),
        "the second open sees the same absence, because the first wrote nothing"
    );
    let _ = first_id;
}

/// A genuinely new workspace is not damage, and must not be read-only.
#[test]
fn a_root_the_index_has_never_seen_opens_writable() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    assert_eq!(svc.open_workspace(work.path()).unwrap().read_only, None);
}

/// The pre-SQLite JSON is read once, to migrate, and then retired.
///
/// While it stayed on disk it was a copy nothing wrote and `load` still
/// trusted: a restore bringing the old JSON without the database would revive
/// pre-migration identities and drop everything minted since, with no signal.
#[test]
fn the_pre_sqlite_registry_json_does_not_outlive_the_migration() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let ws_id = svc.open_workspace(work.path()).unwrap().id;
    let dir = notes_core::paths::workspace_dir(data.path(), ws_id);
    let json = notes_core::paths::registry_file(&dir);

    assert!(
        json.with_extension("db").exists(),
        "the database is where the registry lives"
    );
    assert!(
        !json.exists(),
        "and the JSON the loader falls back to is not left beside it"
    );
}

/// A draft that cannot be read is not a draft that is not there, and the
/// difference is whether the next save deletes it.
///
/// `drafts::read` answered `Ok(None)` for a corrupt header. The caller then
/// opened the note as though nothing had been recovered, the user typed, the
/// confirmed save called `drafts::discard`, and `discard` removed the file by
/// path without ever having read it. A draft is the only copy of something the
/// user typed, and nothing at any point said a word.
#[test]
fn a_draft_that_cannot_be_read_is_refused_and_never_silently_deleted() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let ws = svc.open_workspace(work.path()).unwrap();
    let note = svc.open_note(&RelPath::parse("n.md").unwrap()).unwrap();

    let dir = notes_core::paths::drafts_dir(&notes_core::paths::workspace_dir(data.path(), ws.id));
    std::fs::create_dir_all(&dir).unwrap();
    let draft = dir.join(format!("{}.draft", note.note_id));
    // A header that is not JSON, followed by text the user typed.
    std::fs::write(&draft, b"{not json at all\nthe sentence the user wrote\n").unwrap();

    let Err(err) = notes_core::drafts::read(&dir, note.note_id) else {
        panic!("a draft that is present and unreadable is not absent")
    };
    assert_eq!(err.code(), "state_unreadable");

    // And the call that does the destroying sets it aside rather than removing
    // it, because the cost of being wrong here is asymmetric.
    notes_core::drafts::discard(&dir, note.note_id).unwrap();
    assert!(
        !draft.exists(),
        "the unreadable draft is moved out of the way"
    );
    let aside = draft.with_extension("draft.unreadable");
    assert!(
        aside.exists(),
        "and it still exists under a name that says why"
    );
    assert!(
        String::from_utf8_lossy(&std::fs::read(&aside).unwrap())
            .contains("the sentence the user wrote"),
        "with the bytes intact"
    );
}

/// A draft from a newer build is reported as ahead, not as damaged.
#[test]
fn a_draft_written_by_a_newer_build_says_so() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let ws = svc.open_workspace(work.path()).unwrap();
    let note = svc.open_note(&RelPath::parse("n.md").unwrap()).unwrap();

    let dir = notes_core::paths::drafts_dir(&notes_core::paths::workspace_dir(data.path(), ws.id));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(
        dir.join(format!("{}.draft", note.note_id)),
        b"{\"schema\":999}\ntext\n",
    )
    .unwrap();

    let Err(err) = notes_core::drafts::read(&dir, note.note_id) else {
        panic!("a draft from a newer build is refused")
    };
    assert_eq!(err.code(), "schema_ahead");
}

/// A conflict sidecar that does not parse used to make its snapshot invisible
/// while the bytes it points at stayed on disk, unlisted and uncounted.
#[test]
fn an_unreadable_conflict_sidecar_is_counted_rather_than_skipped() {
    let data = tempfile::tempdir().unwrap();
    let work = tempfile::tempdir().unwrap();
    std::fs::write(work.path().join("n.md"), b"# n\n").unwrap();

    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let ws = svc.open_workspace(work.path()).unwrap();
    let note = svc.open_note(&RelPath::parse("n.md").unwrap()).unwrap();

    let dir = notes_core::paths::workspace_dir(data.path(), ws.id);
    let note_dir = notes_core::paths::conflicts_dir(&dir).join(note.note_id.to_string());
    std::fs::create_dir_all(&note_dir).unwrap();
    std::fs::write(note_dir.join("broken.json"), b"{ not json").unwrap();

    let found = notes_core::conflicts::list(&dir);
    assert_eq!(found.unreadable, 1, "the sidecar is reported, not skipped");
    assert!(found.snapshots.is_empty());
}
