//! ADR-091: the application's own data can be removed from inside it -- one
//! workspace at a time, or all of it -- and never while a draft holds work that
//! was not saved, or while another process has the workspace open.

use notes_core::{DraftReason, WorkspaceService};
use notes_model::{CoreError, RelPath};

fn workspace(notes: &[&str]) -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    for n in notes {
        std::fs::write(dir.path().join(n), format!("# {n}\n")).unwrap();
    }
    dir
}

/// Open `root`, leave an unsaved draft in it, close.
fn leave_a_draft(svc: &mut WorkspaceService, root: &std::path::Path) {
    svc.open_workspace(root).unwrap();
    let opened = svc.open_note(&RelPath::parse("a.md").unwrap()).unwrap();
    svc.write_draft(
        opened.note_id,
        "typed and never saved",
        1,
        &opened.base_rev,
        DraftReason::Exit,
    )
    .unwrap();
    svc.close_workspace(&[]).unwrap();
}

#[test]
fn forgetting_a_workspace_removes_its_state_and_leaves_the_notes_and_the_others() {
    let data = tempfile::tempdir().unwrap();
    let (one, two) = (workspace(&["a.md"]), workspace(&["b.md"]));
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let first = svc.open_workspace(one.path()).unwrap();
    svc.close_workspace(&[]).unwrap();
    let second = svc.open_workspace(two.path()).unwrap();
    svc.close_workspace(&[]).unwrap();
    let state = |id: notes_model::WorkspaceId| data.path().join("workspaces").join(id.to_string());
    assert!(state(first.id).exists());

    svc.forget_workspace(first.id).unwrap();

    assert!(!state(first.id).exists());
    assert!(state(second.id).exists());
    let recent: Vec<_> = svc
        .recent_workspaces()
        .unwrap()
        .iter()
        .map(|w| w.id)
        .collect();
    assert_eq!(recent, vec![second.id]);
    assert_eq!(
        std::fs::read_to_string(one.path().join("a.md")).unwrap(),
        "# a.md\n"
    );
    assert!(matches!(
        svc.forget_workspace(first.id),
        Err(CoreError::NotFound { .. })
    ));
}

#[test]
fn a_workspace_with_an_unsaved_draft_is_not_forgotten() {
    let data = tempfile::tempdir().unwrap();
    let root = workspace(&["a.md"]);
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    leave_a_draft(&mut svc, root.path());
    let id = svc.recent_workspaces().unwrap()[0].id;

    assert!(matches!(
        svc.forget_workspace(id),
        Err(CoreError::DraftsPending { count: 1 })
    ));
    assert_eq!(svc.recent_workspaces().unwrap().len(), 1);
    svc.open_workspace(root.path()).unwrap();
    assert_eq!(
        svc.list_drafts().unwrap().len(),
        1,
        "the draft is still there"
    );
}

#[test]
fn a_workspace_open_here_or_in_another_process_is_not_forgotten() {
    let data = tempfile::tempdir().unwrap();
    let root = workspace(&["a.md"]);
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    let info = svc.open_workspace(root.path()).unwrap();
    assert!(matches!(
        svc.forget_workspace(info.id),
        Err(CoreError::Unsupported { .. })
    ));
    svc.close_workspace(&[]).unwrap();

    // A second service holds the shared lease exactly as another process does.
    let mut other = WorkspaceService::with_data_dir(data.path()).unwrap();
    other.open_workspace(root.path()).unwrap();
    assert!(matches!(
        svc.forget_workspace(info.id),
        Err(CoreError::LockTimeout { .. })
    ));
    other.close_workspace(&[]).unwrap();
    svc.forget_workspace(info.id).unwrap();
}

#[test]
fn removing_the_app_data_leaves_notes_and_unknown_files_and_starts_fresh() {
    let parent = tempfile::tempdir().unwrap();
    let data = parent.path().join("notes");
    let root = workspace(&["a.md"]);
    let mut svc = WorkspaceService::with_data_dir(&data).unwrap();
    svc.open_workspace(root.path()).unwrap();
    svc.close_workspace(&[]).unwrap();
    std::fs::write(data.join("not-ours.txt"), "keep me").unwrap();

    svc.remove_app_data().unwrap();

    let left: Vec<_> = std::fs::read_dir(&data)
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(left, vec!["not-ours.txt"]);
    assert!(svc.recent_workspaces().unwrap().is_empty());
    assert_eq!(
        std::fs::read_to_string(root.path().join("a.md")).unwrap(),
        "# a.md\n"
    );

    // With nothing unknown in it, the directory itself goes too.
    std::fs::remove_file(data.join("not-ours.txt")).unwrap();
    svc.remove_app_data().unwrap();
    assert!(!data.exists());
}

#[test]
fn the_app_data_is_not_removed_while_a_draft_or_another_process_holds_it() {
    let data = tempfile::tempdir().unwrap();
    let root = workspace(&["a.md"]);
    let mut svc = WorkspaceService::with_data_dir(data.path()).unwrap();
    leave_a_draft(&mut svc, root.path());
    assert!(matches!(
        svc.remove_app_data(),
        Err(CoreError::DraftsPending { count: 1 })
    ));
    assert!(data.path().join("workspaces.json").exists());

    let other_root = workspace(&["b.md"]);
    let data2 = tempfile::tempdir().unwrap();
    let mut svc2 = WorkspaceService::with_data_dir(data2.path()).unwrap();
    let mut other = WorkspaceService::with_data_dir(data2.path()).unwrap();
    other.open_workspace(other_root.path()).unwrap();
    assert!(matches!(
        svc2.remove_app_data(),
        Err(CoreError::LockTimeout { .. })
    ));
    assert!(data2.path().join("workspaces.json").exists());
}
