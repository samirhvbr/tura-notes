//! One Tauri command per operation (`docs/ARCHITECTURE.md` §7.1, §18.8).
//!
//! Every function here is: parse → call `notes-core` → return. **No branching
//! on business state.** A single `dispatch` command was rejected because Tauri's
//! capabilities are per command, and permitting `dispatch` would permit
//! everything — which is exactly what the security posture forbids.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notes_core::search::{QuickOpen, SearchId, SearchOpts, SearchProgress};
use notes_core::{
    ConflictChoice, Conflicts, Deleted, Document, DraftChoice, DraftInfo, DraftReason, OpenedNote,
    Reconciled, Rendered, SaveResult, Session, Settings, WorkspaceEntry, WorkspaceInfo,
    WorkspaceService,
};
use notes_model::{BaseRev, CoreError, Entry, NoteId, RelPath, WorkspaceId};
use serde::Serialize;
use tauri::State;

pub struct App {
    pub svc: Mutex<WorkspaceService>,
    pub network: std::sync::Arc<notes_sync_client::control::Controller>,
    pub received: Mutex<Option<Received>>,
    pub dmabuf: DmabufReport,
}

/// A received workspace opened for editing, **with the workspace it was opened
/// as**.
///
/// The pairing is the whole point. `sync_open` fills this in and nothing ever
/// put it back to `None`, so `Some` answered "a received workspace was opened
/// at some point in this session" while every reader was asking "is one open
/// now". `update_install` asked exactly that, and refuses to restart while a
/// workspace is open — so a session that had opened a received workspace once
/// could never install an update again, whatever the user closed.
///
/// Holding the id turns that question back into one the state can answer: the
/// store describes this workspace and no other, and a reader compares it with
/// what is open now instead of trusting the `Option`'s shape.
pub struct Received {
    pub workspace: WorkspaceId,
    pub store: notes_sync_client::state::Store,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DmabufReport {
    pub applied: bool,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvReport {
    /// The running version, stamped into the bundle from `version.md` at build
    /// time (ADR-035). Read from the package rather than from a constant,
    /// because the constant in `Cargo.toml` is the `0.0.0` placeholder and a
    /// diagnostic that confidently reports `0.0.0` is worse than none.
    pub version: String,
    /// `bundle.copyright`, read back from the same configuration the installers
    /// carry. The About dialog shows this rather than a string of its own, so
    /// there is one year to change and no way for the two to disagree.
    pub copyright: String,
    pub os: String,
    pub arch: String,
    pub tauri_version: String,
    pub session: String,
    pub nvidia: bool,
    pub nouveau: bool,
    pub dmabuf_applied: bool,
    pub dmabuf_explanation: String,
    pub data_dir: String,
}

type R<T> = Result<T, CoreError>;

/// The service is behind a `Mutex` and every command takes it briefly. A
/// poisoned lock means a previous command panicked, which is a bug and is
/// reported as one rather than propagating a panic into the WebView.
fn svc<'a>(app: &'a State<'_, App>) -> R<std::sync::MutexGuard<'a, WorkspaceService>> {
    app.svc.lock().map_err(|_| CoreError::Internal {
        message: "the workspace service panicked in an earlier command".into(),
    })
}

#[tauri::command]
pub fn env_report(app: State<'_, App>, handle: tauri::AppHandle) -> R<EnvReport> {
    Ok(EnvReport {
        version: handle.package_info().version.to_string(),
        copyright: handle.config().bundle.copyright.clone().unwrap_or_default(),
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
        tauri_version: tauri::VERSION.into(),
        session: crate::linux::session_kind().into(),
        nvidia: crate::linux::nvidia_proprietary(),
        nouveau: crate::linux::nouveau_present(),
        dmabuf_applied: app.dmabuf.applied,
        dmabuf_explanation: app.dmabuf.explanation.clone(),
        data_dir: svc(&app)?.data_dir().display().to_string(),
    })
}

// ---- workspace ---------------------------------------------------------

#[tauri::command]
pub fn workspace_open(app: State<'_, App>, root: String) -> R<WorkspaceInfo> {
    svc(&app)?.open_workspace(&PathBuf::from(root))
}

#[tauri::command]
pub fn workspace_create(app: State<'_, App>, parent: String, name: String) -> R<WorkspaceInfo> {
    svc(&app)?.create_workspace(&PathBuf::from(parent), &name)
}

#[tauri::command]
pub fn workspace_restore_last(app: State<'_, App>) -> R<Option<WorkspaceInfo>> {
    svc(&app)?.restore_last_workspace()
}

#[tauri::command]
pub fn workspace_recent(app: State<'_, App>) -> R<Vec<WorkspaceEntry>> {
    svc(&app)?.recent_workspaces()
}

/// Forget one workspace's state (ADR-091). The folder is not touched.
#[tauri::command]
pub fn workspace_forget(app: State<'_, App>, id: WorkspaceId) -> R<()> {
    svc(&app)?.forget_workspace(id)
}

/// Remove everything this application keeps, then restart into a first run
/// (ADR-091). A restart rather than a reset because the device-sync controller
/// and the window hold their configuration in memory, and a fresh process is
/// the one state nothing can have left behind.
#[tauri::command]
pub fn app_data_remove(app: State<'_, App>, handle: tauri::AppHandle) -> R<()> {
    let _ = app.network.pause();
    svc(&app)?.remove_app_data()?;
    handle.restart()
}

#[tauri::command]
pub fn workspace_close(app: State<'_, App>, dirty: Vec<NoteId>) -> R<()> {
    svc(&app)?.close_workspace(&dirty)
}

// ---- tree --------------------------------------------------------------

#[tauri::command]
pub fn tree_list(app: State<'_, App>, dir: RelPath) -> R<Vec<Entry>> {
    svc(&app)?.list_dir(&dir)
}

// ---- notes -------------------------------------------------------------

#[tauri::command]
pub fn note_open(app: State<'_, App>, path: RelPath) -> R<OpenedNote> {
    svc(&app)?.open_note(&path)
}

#[tauri::command]
pub fn note_save(
    app: State<'_, App>,
    note_id: NoteId,
    text: String,
    buffer_version: u64,
    base_rev: BaseRev,
) -> R<SaveResult> {
    svc(&app)?.save_note(note_id, &text, buffer_version, &base_rev)
}

/// The same call with no debounce. Separate so the frontend's intent is legible
/// in the log and in the capability list, not because the core does anything
/// different.
#[tauri::command]
pub fn note_flush(
    app: State<'_, App>,
    note_id: NoteId,
    text: String,
    buffer_version: u64,
    base_rev: BaseRev,
) -> R<SaveResult> {
    svc(&app)?.save_note(note_id, &text, buffer_version, &base_rev)
}

#[tauri::command]
pub fn note_create(app: State<'_, App>, dir: RelPath, name: String) -> R<Entry> {
    svc(&app)?.create_note(&dir, &name)
}

/// Extract plain text from an operator-selected PDF. It is deliberately not a
/// workspace operation: cancelling the import must leave no source file behind.
///
/// **`async` is load-bearing, and so is `catch_unwind`.** ADR-068 says to refuse
/// a malformed or unsupported PDF without guessing — and `Err` was the only
/// refusal handled, while `pdf_extract` does not return `Err` for what it does
/// not model. `encoding_to_unicode_table` matches exactly `MacRomanEncoding`,
/// `MacExpertEncoding` and `WinAnsiEncoding` and calls `panic!` on anything
/// else, `/StandardEncoding` included; `to_unicode` panics on a predefined
/// non-Identity CMap, which is most CJK documents. `pdf-extract 0.12.0` carries
/// 31 `panic!`, a `todo!` and 42 `unwrap()` in that one file.
///
/// As a plain `#[tauri::command]` this ran inline on the webview thread, inside
/// WebKitGTK's `extern "C"` scheme callback. The workspace does not set
/// `panic = "abort"`, so the unwind crossed that FFI frame — undefined
/// behaviour, and in practice the process died. Everything typed since the last
/// 750 ms debounce went with it, in every open tab, and the `beforeunload`
/// handler that writes the exit draft never ran. Refusing an unreadable PDF is
/// not supposed to cost the user their other notes.
///
/// `command(async)` moves the work off that thread, which also keeps a 32 MiB
/// parse from freezing the window; `catch_unwind` turns the panic into the
/// refusal ADR-068 already specified.
#[tauri::command(async)]
pub fn pdf_extract(path: String) -> R<String> {
    let path = PathBuf::from(path);
    let metadata =
        std::fs::metadata(&path).map_err(|e| CoreError::io("read", path.display(), &e))?;
    if !metadata.is_file() || metadata.len() > 32 * 1024 * 1024 {
        return Err(CoreError::Unsupported {
            cap: "PDF text extraction".into(),
        });
    }
    extract_or_refuse(&path)
}

/// `pdf_extract::extract_text`, with a panic reported as the refusal it means.
///
/// Separate from the command so a test can reach it: `#[tauri::command]`
/// rewrites the item, and the panics this exists to contain are in the parser,
/// not in the IPC.
fn extract_or_refuse(path: &Path) -> R<String> {
    let unsupported = || CoreError::Unsupported {
        cap: "PDF text extraction".into(),
    };
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        pdf_extract::extract_text(path)
    }))
    .map_err(|_| unsupported())?
    .map_err(|_| unsupported())
}

/// Persist text that the user reviewed in the PDF import preview as a Markdown
/// note. This is the only import operation that writes into the workspace.
#[tauri::command]
pub fn pdf_save(app: State<'_, App>, name: String, text: String) -> R<Entry> {
    let entry = svc(&app)?.create_note(&RelPath::root(), &name)?;
    let opened = svc(&app)?.open_note(&entry.path)?;
    let result = svc(&app)?.save_note(opened.note_id, &text, 1, &opened.base_rev)?;
    if !matches!(result, SaveResult::Saved { .. }) {
        return Err(CoreError::Internal {
            message: "new PDF import could not be saved".into(),
        });
    }
    Ok(entry)
}

#[tauri::command]
pub fn dir_create(app: State<'_, App>, dir: RelPath, name: String) -> R<Entry> {
    svc(&app)?.create_dir(&dir, &name)
}

/// Re-read a note from disk. The caller decides when a buffer is clean enough
/// to be replaced; this command does not.
#[tauri::command]
pub fn note_reload(app: State<'_, App>, note_id: NoteId) -> R<OpenedNote> {
    svc(&app)?.reload_note(note_id)
}

/// Forget the per-note state a closed tab no longer needs. **Does not touch the
/// draft** — a draft outlives the tab by design.
#[tauri::command]
pub fn note_close(app: State<'_, App>, note_id: NoteId) -> R<()> {
    svc(&app)?.close_note(note_id)
}

/// Rewrite a note's line endings, because the user asked. The old bytes go to
/// `conflicts/` first.
#[tauri::command]
pub fn note_convert_eol(
    app: State<'_, App>,
    note_id: NoteId,
    eol: notes_model::Eol,
) -> R<OpenedNote> {
    svc(&app)?.convert_eol(note_id, eol)
}

/// Open an `http(s)` URL in the operating system's browser.
///
/// **The scheme is checked here as well as in the capability file**, and that
/// is not redundancy for its own sake: the capability is what the WebView may
/// ask for, and this is what the process will do. Scope §8.4 — *"Links externos
/// `http(s)` abrem no navegador do SO por clique. Outros esquemas recusados.
/// Link não dispara shell."* The renderer never emits another scheme; this is
/// the guarantee that holds even if it one day does.
/// **`shell().open` is deprecated in favour of `tauri-plugin-opener`, and the
/// migration is deliberately not made here.** Swapping the plugin means
/// replacing `shell:allow-open` with `opener:allow-open-url` in
/// `capabilities/default.json` — a permission edit and a new dependency, and
/// scope §19 sends both to the owner rather than letting an agent make them on
/// the way past. The call still works and the scope restriction is unchanged;
/// `docs/DECISIONS-0.1b.md` D-09 carries the one-line change for whoever does.
#[allow(deprecated)]
#[tauri::command]
pub fn shell_open(app: tauri::AppHandle, url: String) -> R<()> {
    use tauri_plugin_shell::ShellExt;

    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(CoreError::InvalidPath {
            path: url,
            reason: "only http and https links are opened".into(),
        });
    }
    app.shell()
        .open(&url, None)
        .map_err(|e| CoreError::Internal {
            message: format!("opening {url}: {e}"),
        })
}

// ---- conflicts ---------------------------------------------------------

/// Keep mine · use the disk's · save as a copy. **"Compare" is not here**: it
/// changes nothing on disk and reads two strings the frontend already holds, so
/// it is a screen rather than a command (`docs/ARCHITECTURE.md` §17.1).
#[tauri::command]
pub fn conflict_resolve(
    app: State<'_, App>,
    note_id: NoteId,
    text: String,
    base_rev: BaseRev,
    choice: ConflictChoice,
) -> R<OpenedNote> {
    svc(&app)?.resolve_conflict(note_id, &text, &base_rev, choice)
}

/// Everything kept in `conflicts/`, and what it costs on disk.
#[tauri::command]
pub fn conflict_list(app: State<'_, App>) -> R<Conflicts> {
    svc(&app)?.list_conflicts()
}

// ---- markdown ----------------------------------------------------------

/// Sanitized HTML for the buffer the frontend is holding.
///
/// The text is sent rather than read from disk because the preview follows what
/// is being typed; `path` only resolves relative links. **This is the whole of
/// the preview IR** — no AST crosses (`docs/ARCHITECTURE.md` §10).
#[tauri::command]
pub fn markdown_render(app: State<'_, App>, path: RelPath, text: String) -> R<Rendered> {
    svc(&app)?.render_markdown(&path, &text)
}

/// The outline, the links and the front-matter span, with no HTML rendered.
/// Separate from `markdown_render` because the sidebar wants it while the
/// preview pane is closed.
#[tauri::command]
pub fn markdown_outline(app: State<'_, App>, text: String) -> R<Document> {
    svc(&app)?.outline(&text)
}

/// Turn remote images on or off for **this** workspace, and nothing else.
/// Raw HTML has no command: nothing in the interface turns it on.
#[tauri::command]
pub fn markdown_remote_images_set(app: State<'_, App>, allow: Option<bool>) -> R<()> {
    svc(&app)?.set_remote_images(allow)
}

// ---- reconciliation ----------------------------------------------------

/// Start watching the open workspace. Returns the reason when the platform
/// cannot, so the interface can say why it is polling instead — the inotify
/// limit comes back with the `sysctl` that raises it.
#[tauri::command]
pub fn watch_start(app: State<'_, App>) -> R<Option<String>> {
    svc(&app)?.start_watch()
}

/// One watcher-driven tick. **The frontend passes which notes are dirty**,
/// because the core does not hold buffers and cannot know
/// (`docs/DECISIONS-0.1a.md` D-11).
#[tauri::command]
pub fn reconcile_tick(app: State<'_, App>, dirty: Vec<NoteId>) -> R<Reconciled> {
    svc(&app)?.tick(&dirty)
}

/// A full scan: window focus, tab switch, manual refresh.
#[tauri::command]
pub fn reconcile_all(app: State<'_, App>, dirty: Vec<NoteId>) -> R<Reconciled> {
    svc(&app)?.reconcile_all(&dirty)
}

// ---- entries -----------------------------------------------------------

/// Rename in place, **keeping the `NoteId`** — the tab and its cursor survive
/// (scope §17). Renaming a folder carries every note beneath it.
#[tauri::command]
pub fn entry_rename(app: State<'_, App>, path: RelPath, new_name: String) -> R<Entry> {
    svc(&app)?.rename_entry(&path, &new_name)
}

/// Move into another directory, keeping the name and the `NoteId`. A collision
/// comes back as `AlreadyExists` naming what is in the way, so the interface can
/// ask rather than guess.
#[tauri::command]
pub fn entry_move(app: State<'_, App>, path: RelPath, to_dir: RelPath) -> R<Entry> {
    svc(&app)?.move_entry(&path, &to_dir)
}

/// Copy beside the original as `nome (copy).md`. Never overwrites, and the copy
/// gets an identity of its own.
#[tauri::command]
pub fn entry_duplicate(app: State<'_, App>, path: RelPath) -> R<Entry> {
    svc(&app)?.duplicate_entry(&path)
}

/// Delete, and say whether it went to the bin or not (scope §7.7).
#[tauri::command]
pub fn entry_delete(app: State<'_, App>, path: RelPath) -> R<Deleted> {
    svc(&app)?.delete_entry(&path)
}

// ---- drafts ------------------------------------------------------------

#[tauri::command]
pub fn draft_write(
    app: State<'_, App>,
    note_id: NoteId,
    text: String,
    buffer_version: u64,
    base_rev: BaseRev,
    reason: DraftReason,
) -> R<DraftInfo> {
    svc(&app)?.write_draft(note_id, &text, buffer_version, &base_rev, reason)
}

/// The way out of a receive barrier that cannot verify its reload (ADR-094).
///
/// When received revisions were applied and the reload that should follow could
/// not be verified, the window stays behind the barrier — every edit and every
/// tracked call refused — and until now "Retry safe reload" was the only button,
/// one that could never succeed once the document had changed during the drain.
/// The owner chose to keep the barrier and offer a restart instead.
///
/// This is the one call exempt from the barrier, and the exemption is safe
/// because it ends the process. **The draft is written first, and the restart
/// happens only if it was**: a restart that lost the buffer would be the failure
/// this exists to prevent. Passed only when the buffer is dirty — a clean buffer
/// holds nothing the disk and the applied revisions do not already have.
#[tauri::command]
pub fn sync_recovery_restart(
    app: State<'_, App>,
    handle: tauri::AppHandle,
    note_id: Option<NoteId>,
    text: Option<String>,
    buffer_version: Option<u64>,
    base_rev: Option<BaseRev>,
) -> R<()> {
    if let (Some(note_id), Some(text), Some(buffer_version), Some(base_rev)) =
        (note_id, text, buffer_version, base_rev)
    {
        svc(&app)?.write_draft(note_id, &text, buffer_version, &base_rev, DraftReason::Exit)?;
    }
    handle.restart()
}

#[tauri::command]
pub fn draft_list(app: State<'_, App>) -> R<Vec<DraftInfo>> {
    svc(&app)?.list_drafts()
}

#[tauri::command]
pub fn draft_resolve(app: State<'_, App>, note_id: NoteId, choice: DraftChoice) -> R<OpenedNote> {
    svc(&app)?.resolve_draft(note_id, choice)
}

/// What the watcher has managed so far. Polled beside `reconcile_tick`.
#[tauri::command]
pub fn watch_status(app: State<'_, App>) -> R<notes_core::WatchStatus> {
    Ok(svc(&app)?.watch_status())
}

// ---- search (0.1c) -----------------------------------------------------

/// Fuzzy match over paths, from memory. Never reads a file, so it is safe to
/// call on every keystroke.
#[tauri::command]
pub fn quick_open(app: State<'_, App>, query: String, limit: usize) -> R<QuickOpen> {
    svc(&app)?.quick_open(&query, limit)
}

/// Start a content search. Starting one cancels the previous, because the caller
/// is a search box and the previous query is no longer wanted.
#[tauri::command]
pub fn search_start(app: State<'_, App>, query: String, opts: SearchOpts) -> R<SearchId> {
    svc(&app)?.search_start(&query, opts)
}

/// Drain the hits found since the last poll. Following the same shape as
/// `reconcile_tick`: the core collects, the frontend asks.
#[tauri::command]
pub fn search_poll(app: State<'_, App>, id: SearchId) -> R<SearchProgress> {
    svc(&app)?.search_poll(id)
}

#[tauri::command]
pub fn search_cancel(app: State<'_, App>, id: SearchId) -> R<()> {
    svc(&app)?.search_cancel(id)
}

// ---- session and settings ----------------------------------------------

#[tauri::command]
pub fn session_get(app: State<'_, App>) -> R<Session> {
    svc(&app)?.session()
}

#[tauri::command]
pub fn session_save(app: State<'_, App>, session: Session) -> R<()> {
    svc(&app)?.save_session(&session)
}

#[tauri::command]
pub fn settings_get(app: State<'_, App>) -> R<Settings> {
    Ok(svc(&app)?.settings().clone())
}

#[tauri::command]
pub fn settings_set(app: State<'_, App>, settings: Settings) -> R<()> {
    svc(&app)?.set_settings(settings)
}

#[tauri::command]
pub fn index_start(
    app: tauri::State<'_, App>,
    force: bool,
) -> Result<notes_core::content_index::IndexStatus, notes_model::CoreError> {
    svc(&app)?.index_start(force)
}
#[tauri::command]
pub fn index_status(
    app: tauri::State<'_, App>,
) -> Result<notes_core::content_index::IndexStatus, notes_model::CoreError> {
    svc(&app)?.index_status()
}
#[tauri::command]
pub fn index_cancel(app: tauri::State<'_, App>) -> Result<(), notes_model::CoreError> {
    svc(&app)?.index_cancel()
}
#[tauri::command]
pub fn recent_notes(
    app: tauri::State<'_, App>,
) -> Result<Vec<notes_core::recent::RecentNote>, notes_model::CoreError> {
    svc(&app)?.recent_notes()
}

#[tauri::command]
pub fn reference_preview(
    app: tauri::State<'_, App>,
    from: notes_model::RelPath,
    to: notes_model::RelPath,
) -> Result<notes_core::references::ReferencePlan, notes_model::CoreError> {
    svc(&app)?.reference_preview(&from, &to)
}
#[tauri::command]
pub fn reference_apply(
    app: tauri::State<'_, App>,
    token: String,
    selected: Vec<usize>,
) -> Result<notes_core::references::ReferenceResult, notes_model::CoreError> {
    svc(&app)?.reference_apply(&token, &selected)
}

#[tauri::command]
pub fn knowledge_get(app: State<'_, App>) -> Result<notes_core::knowledge::Knowledge, CoreError> {
    svc(&app)?.knowledge()
}
#[tauri::command]
pub fn wiki_candidates(app: State<'_, App>, target: String) -> Result<Vec<RelPath>, CoreError> {
    svc(&app)?.wiki_candidates(&target)
}
#[tauri::command]
pub fn metadata_get(
    app: State<'_, App>,
    text: String,
) -> Result<notes_core::knowledge::Metadata, CoreError> {
    svc(&app)?.outline(&text)?;
    Ok(notes_core::knowledge::metadata(&text))
}
#[tauri::command]
pub fn attachment_import(
    app: State<'_, App>,
    note: RelPath,
    bytes: Vec<u8>,
) -> Result<notes_core::attachments::Attachment, CoreError> {
    svc(&app)?.import_attachment(&note, &bytes)
}

#[tauri::command]
pub async fn sync_open(app: State<'_, App>, state_dir: String) -> R<WorkspaceInfo> {
    let store = notes_sync_client::state::Store::open(&PathBuf::from(state_dir))
        .map_err(CoreError::from)?;
    let mut service = svc(&app)?;
    let info = store
        .open_for_editor(&mut service)
        .map_err(CoreError::from)?;
    *app.received
        .lock()
        .map_err(|_| sync_unavailable("sync state lock failed"))? = Some(Received {
        workspace: info.id,
        store,
    });
    Ok(info)
}
/// A blocking sync task that did not come back: a panic, which is a bug.
fn sync_error(error: tauri::Error) -> CoreError {
    CoreError::Internal {
        message: format!("sync task failed: {error}"),
    }
}
/// A precondition of the app's own, not a refusal of the sync client, which
/// arrives as `CoreError::Sync` through `From`.
fn sync_unavailable(what: &str) -> CoreError {
    CoreError::Unsupported { cap: what.into() }
}
#[tauri::command]
pub async fn sync_apply(
    app: State<'_, App>,
    buffers: Vec<notes_core::sync::BufferSnapshot>,
) -> R<notes_core::sync::SyncApplyResult> {
    let mut service = svc(&app)?;
    let received = app
        .received
        .lock()
        .map_err(|_| sync_unavailable("sync state lock failed"))?;
    // The workspace has to be the one this store was opened for. Without the
    // comparison a store left behind by an earlier received workspace would
    // apply into whichever workspace happens to be open now.
    let received = received
        .as_ref()
        .filter(|r| Some(r.workspace) == service.workspace_id())
        .ok_or_else(|| sync_unavailable("no received workspace open"))?;
    Ok(received.store.apply_for_editor(&mut service, buffers))
}
#[tauri::command]
pub async fn sync_reload(
    app: State<'_, App>,
    buffers: Vec<notes_core::sync::BufferSnapshot>,
) -> R<notes_core::sync::SyncApplyResult> {
    Ok(notes_sync_client::state::Store::reload_for_editor(
        &mut *svc(&app)?,
        &buffers,
    ))
}

// Blocking network/filesystem work runs outside both the UI thread and editor mutex.
#[tauri::command]
pub async fn sync_control_status(
    app: State<'_, App>,
) -> R<notes_sync_client::control::DeviceSnapshot> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.snapshot().map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_configure(
    app: State<'_, App>,
    connection: notes_sync_client::control::SyncConnection,
) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.configure(connection).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_conditions(
    app: State<'_, App>,
    conditions: notes_sync_client::control::SyncConditions,
) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.conditions(conditions).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_run(app: State<'_, App>) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.run(true).map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
/// A connection test. Separate from pairing, and available with the workspace
/// open, because the question "is the server there and does this credential
/// work" is the one people ask *before* they are willing to close everything
/// and commit to a pairing.
#[tauri::command]
pub async fn sync_control_probe(
    app: State<'_, App>,
    origin: String,
    allow_private: bool,
    token_file: String,
) -> R<notes_sync_client::remote::SyncProbe> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.probe(origin, allow_private, token_file)
    })
    .await
    .map_err(sync_error)
}

/// The paired workspace's devices, or `null` when this device's credential was
/// not granted `devices` (ADR-096). Available with the workspace open, like the
/// probe: it writes nothing on this machine.
#[tauri::command]
pub async fn sync_control_devices(
    app: State<'_, App>,
) -> R<Option<Vec<notes_sync_client::remote::SyncDevice>>> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.devices().map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
/// Revoke another device's credential on the server (ADR-096). Asked for from
/// an explicit confirmation in the interface; the server refuses this device's
/// own credential.
#[tauri::command]
pub async fn sync_control_revoke_device(
    app: State<'_, App>,
    device: String,
) -> R<notes_sync_client::remote::SyncDevice> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.revoke_device(&device).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}

#[tauri::command]
pub async fn sync_control_pair(
    app: State<'_, App>,
    request: notes_sync_client::control::SyncPairRequest,
) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.pair(request).map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_preview(
    app: State<'_, App>,
) -> R<notes_sync_client::control::SyncPairPreview> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.preview().map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_confirm(app: State<'_, App>, confirmation: String) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.confirm(confirmation).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_apply(app: State<'_, App>, resolution: Option<String>) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.apply(resolution).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_capture(app: State<'_, App>, note: String) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.capture(note).map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_resolve(
    app: State<'_, App>,
    local: String,
    remote: String,
    path: String,
    result: Option<String>,
) -> R<String> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller
            .resolve(local, remote, path, result)
            .map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}
#[tauri::command]
pub async fn sync_control_export(
    app: State<'_, App>,
    id: String,
    attachment: Option<String>,
) -> R<String> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || {
        controller.export(id, attachment).map_err(CoreError::from)
    })
    .await
    .map_err(sync_error)?
}

#[tauri::command]
pub async fn sync_control_recapture(app: State<'_, App>) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.recapture().map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}

#[tauri::command]
pub async fn sync_control_pause(app: State<'_, App>) -> R<()> {
    let controller = app.network.clone();
    tauri::async_runtime::spawn_blocking(move || controller.pause().map_err(CoreError::from))
        .await
        .map_err(sync_error)?
}

#[cfg(test)]
mod pdf_tests {
    use super::*;

    fn fixture(name: &str) -> PathBuf {
        // `CARGO_MANIFEST_DIR` is `apps/notes-app/src-tauri`.
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../fixtures/pdf")
            .join(name)
    }

    /// The whole point of `extract_or_refuse`: this input does not return `Err`
    /// from the parser, it panics inside it. Before the `catch_unwind` the
    /// unwind crossed the webview's `extern "C"` frame and took the process —
    /// and with it every unsaved buffer in every open tab.
    #[test]
    fn a_font_encoding_the_parser_does_not_model_is_refused_not_fatal() {
        let err = extract_or_refuse(&fixture("standard-encoding.pdf"))
            .expect_err("a PDF the parser cannot model must be refused");
        assert!(
            matches!(&err, CoreError::Unsupported { cap } if cap == "PDF text extraction"),
            "expected the ADR-068 refusal, got {err:?}",
        );
    }

    /// The refusal a missing file gets is still the I/O one, so the panic guard
    /// did not flatten every failure into `Unsupported`.
    #[test]
    fn a_file_that_is_not_a_pdf_is_refused_as_unsupported() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("not.pdf");
        std::fs::write(&path, b"this is not a PDF at all").expect("write");
        assert!(matches!(
            extract_or_refuse(&path),
            Err(CoreError::Unsupported { .. })
        ));
    }
}
