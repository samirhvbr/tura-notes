// The ONLY place `invoke` is called (docs/ARCHITECTURE.md §13).
//
// Every type crossing this boundary is generated from Rust by ts-rs into
// `./generated`; nothing here is hand-written, and a CI job fails when the
// committed files differ from a fresh generation. The frontend has no
// filesystem capability — every read and write below is a command.
import { invoke as rawInvoke } from "@tauri-apps/api/core";
import { tracked } from "./barrier";
function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return tracked(() => rawInvoke<T>(command, args));
}
import type { BufferSnapshot } from "./generated/BufferSnapshot";
import type { SyncApplyResult } from "./generated/SyncApplyResult";
export type { BufferSnapshot, SyncApplyResult };
// Only the barrier owner may use these entry points while ordinary IPC is gated.
export const syncOpen = (stateDir: string) => rawInvoke<WorkspaceInfo>("sync_open", { stateDir });
export const syncApply = (buffers: BufferSnapshot[]) => rawInvoke<SyncApplyResult>("sync_apply", { buffers });
export const syncReload = (buffers: BufferSnapshot[]) => rawInvoke<SyncApplyResult>("sync_reload", { buffers });
/** The way out of an unverifiable receive reload (ADR-094): write the dirty
 * buffer as an exit draft, then restart. Not `tracked`, like `syncReload`: it is
 * called from behind the barrier, and it ends the process. */
export const syncRecoveryRestart = (draft: {
  noteId: NoteId; text: string; bufferVersion: number; baseRev: BaseRev;
} | null) => rawInvoke<void>("sync_recovery_restart", draft ?? {});

import type { BaseRev } from "./generated/BaseRev";
import type { CoreError } from "./generated/CoreError";
import type { DocStatus } from "./generated/DocStatus";
import type { DraftChoice } from "./generated/DraftChoice";
import type { DraftInfo } from "./generated/DraftInfo";
import type { DraftReason } from "./generated/DraftReason";
import type { ConflictChoice } from "./generated/ConflictChoice";
import type { ConflictSnapshot } from "./generated/ConflictSnapshot";
import type { Conflicts } from "./generated/Conflicts";
import type { ChangeKind } from "./generated/ChangeKind";
import type { ConflictKind } from "./generated/ConflictKind";
import type { CoreEvent } from "./generated/CoreEvent";
import type { DeleteKind } from "./generated/DeleteKind";
import type { Reconciled } from "./generated/Reconciled";
import type { Deleted } from "./generated/Deleted";
import type { Document } from "./generated/Document";
import type { Eol } from "./generated/Eol";
import type { Heading } from "./generated/Heading";
import type { Link } from "./generated/Link";
import type { LinkKind } from "./generated/LinkKind";
import type { Rendered } from "./generated/Rendered";
import type { Span } from "./generated/Span";
import type { Task } from "./generated/Task";
import type { Entry } from "./generated/Entry";
import type { NoteId } from "./generated/NoteId";
import type { OpenedNote } from "./generated/OpenedNote";
import type { RelPath } from "./generated/RelPath";
import type { SaveResult } from "./generated/SaveResult";
import type { QuickMatch } from "./generated/QuickMatch";
import type { QuickOpen } from "./generated/QuickOpen";
import type { WatchStatus } from "./generated/WatchStatus";
import type { SearchHit } from "./generated/SearchHit";
import type { SearchId } from "./generated/SearchId";
import type { SearchMode } from "./generated/SearchMode";
import type { SearchOpts } from "./generated/SearchOpts";
import type { SearchProgress } from "./generated/SearchProgress";
import type { Session } from "./generated/Session";
import type { Tab } from "./generated/Tab";
import type { Settings } from "./generated/Settings";
import type { WorkspaceInfo } from "./generated/WorkspaceInfo";
import type { WorkspaceEntry } from "./generated/WorkspaceEntry";
import type { WorkspaceId } from "./generated/WorkspaceId";

export type {
  BaseRev, ChangeKind, ConflictChoice, ConflictKind, ConflictSnapshot,
  Conflicts, CoreError, CoreEvent, DeleteKind, Deleted, DocStatus, DraftChoice,
  DraftInfo, DraftReason, Document, Entry, Eol, Heading, Link, LinkKind, NoteId,
  OpenedNote, QuickMatch, QuickOpen, Reconciled, RelPath, Rendered, SaveResult,
  SearchHit, SearchId, SearchMode, SearchOpts, SearchProgress, Session, Settings,
  Tab, Span, Task, WatchStatus, WorkspaceInfo, WorkspaceEntry,
};

/** Diagnostics, and the only shape here that is not generated. */
export interface EnvReport {
  /** The running version. `tools/tests/test_env_report.py` keeps this
   *  interface and the Rust struct in step; nothing else can. */
  version: string;
  /** `bundle.copyright` from `tauri.conf.json`; empty when it is not set. */
  copyright: string;
  os: string;
  arch: string;
  tauriVersion: string;
  session: string;
  /** The proprietary driver — the one the dmabuf workaround exists for. */
  nvidia: boolean;
  /** Reported, and deliberately not a trigger: nouveau's GBM works. */
  nouveau: boolean;
  dmabufApplied: boolean;
  dmabufExplanation: string;
  dataDir: string;
}

/** The workspace root, for listing. */
export const ROOT = "" as RelPath;

/**
 * A rejected command carries a `CoreError`, whose `code` is the contract.
 * Nothing in the UI reads a message — `code` maps to an i18n key.
 */
export function asCoreError(e: unknown): CoreError {
  if (e && typeof e === "object" && "code" in e) return e as CoreError;
  return { code: "internal", message: String(e) };
}

// ---- the AI assistant (ADR-100) ------------------------------------------
export type { AiError } from "./generated/AiError";
export type { AiErrorCode } from "./generated/AiErrorCode";
export type { AiKeychainState } from "./generated/AiKeychainState";
export type { AiModel } from "./generated/AiModel";
export type { AiOverview } from "./generated/AiOverview";
export type { AiProviderInput } from "./generated/AiProviderInput";
export type { AiProviderKind } from "./generated/AiProviderKind";
export type { AiProviderView } from "./generated/AiProviderView";
export type { AiTest } from "./generated/AiTest";

/** An assistant command's rejection. Like `asCoreError`, never read for its
 *  message: `code` maps to a sentence of the interface's own. */
export function asAiError(e: unknown): import("./generated/AiError").AiError {
  if (e && typeof e === "object" && "code" in e) return e as import("./generated/AiError").AiError;
  return { code: "internal", detail: null };
}
export const aiOverview = () => invoke<import("./generated/AiOverview").AiOverview>("ai_overview");
export const aiSetEnabled = (enabled: boolean) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_set_enabled", { enabled });
export const aiProviderSave = (provider: import("./generated/AiProviderInput").AiProviderInput) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_provider_save", { provider });
export const aiProviderRemove = (id: string) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_provider_remove", { id });
export const aiSetDefault = (id: string) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_set_default", { id });
/** The one place a key goes in. It is stored in the system keychain and never
 *  comes back: the answer only says that one is configured. */
export const aiKeySet = (id: string, key: string) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_key_set", { id, key });
export const aiKeyClear = (id: string) =>
  invoke<import("./generated/AiOverview").AiOverview>("ai_key_clear", { id });
export const aiTest = (id: string) => invoke<import("./generated/AiTest").AiTest>("ai_test", { id });

export type { AiChatMessage } from "./generated/AiChatMessage";
export type { AiChatRequest } from "./generated/AiChatRequest";
export type { AiChatStarted } from "./generated/AiChatStarted";
export type { AiDelta } from "./generated/AiDelta";
export type { AiDone } from "./generated/AiDone";
export type { AiEditOp } from "./generated/AiEditOp";
export type { AiRejection } from "./generated/AiRejection";
export type { AiTool } from "./generated/AiTool";
export type { AiToolCall } from "./generated/AiToolCall";
export type { AiFailed } from "./generated/AiFailed";
export type { AiRole } from "./generated/AiRole";
export type { AiSelection } from "./generated/AiSelection";
export type { AiSentItem } from "./generated/AiSentItem";
export type { AiStop } from "./generated/AiStop";
/** Start one chat turn. Returns at once with what is being sent; the reply
 *  arrives as `ai:delta` events and ends with `ai:done` or `ai:error`. */
export const aiChatStart = (request: import("./generated/AiChatRequest").AiChatRequest) =>
  invoke<import("./generated/AiChatStarted").AiChatStarted>("ai_chat_start", { request });
export const aiChatCancel = (chat: string) => invoke<void>("ai_chat_cancel", { chat });

export const envReport = () => invoke<EnvReport>("env_report");

export const workspaceOpen = (root: string) =>
  invoke<WorkspaceInfo>("workspace_open", { root });
export const workspaceCreate = (parent: string, name: string) =>
  invoke<WorkspaceInfo>("workspace_create", { parent, name });
export const workspaceRestoreLast = () =>
  invoke<WorkspaceInfo | null>("workspace_restore_last");
export const workspaceRecent = () => invoke<WorkspaceEntry[]>("workspace_recent");
/** Forget one workspace's state; the folder is not touched (ADR-091). */
export const workspaceForget = (id: WorkspaceId) => invoke<void>("workspace_forget", { id });
/** Remove everything the app keeps and restart into a first run (ADR-091). */
export const appDataRemove = () => invoke<void>("app_data_remove");
export const workspaceClose = (dirty: NoteId[]) =>
  invoke<void>("workspace_close", { dirty });

export const treeList = (dir: RelPath) => invoke<Entry[]>("tree_list", { dir });

export const noteOpen = (path: RelPath) => invoke<OpenedNote>("note_open", { path });
export const noteSave = (
  noteId: NoteId,
  text: string,
  bufferVersion: number,
  baseRev: BaseRev,
) => invoke<SaveResult>("note_save", { noteId, text, bufferVersion, baseRev });
export const noteFlush = (
  noteId: NoteId,
  text: string,
  bufferVersion: number,
  baseRev: BaseRev,
) => invoke<SaveResult>("note_flush", { noteId, text, bufferVersion, baseRev });
/** Re-read a note from disk. The caller decides when a buffer may be replaced. */
export const noteReload = (noteId: NoteId) =>
  invoke<OpenedNote>("note_reload", { noteId });

/** Forget the per-note state a closed tab no longer needs. Leaves the draft. */
export const noteClose = (noteId: NoteId) => invoke<void>("note_close", { noteId });

/** Rewrite a note's line endings, because the user asked. Keeps the old bytes. */
export const noteConvertEol = (noteId: NoteId, eol: Eol) =>
  invoke<OpenedNote>("note_convert_eol", { noteId, eol });

/**
 * Keep mine · use the disk's · save as a copy.
 *
 * **"Compare" is not a command.** It changes nothing on disk and reads two
 * strings this frontend is already holding, so it is a screen
 * (docs/ARCHITECTURE.md §17.1).
 */
export const conflictResolve = (
  noteId: NoteId,
  text: string,
  baseRev: BaseRev,
  choice: ConflictChoice,
) => invoke<OpenedNote>("conflict_resolve", { noteId, text, baseRev, choice });

/**
 * Open an `http(s)` URL in the operating system's browser.
 *
 * A link in a note never navigates the WebView and never reaches a shell: the
 * command checks the scheme again in Rust, and the capability file allows only
 * `http` and `https` (scope §8.4).
 */
export const shellOpen = (url: string) => invoke<void>("shell_open", { url });

/** Everything kept in `conflicts/`, and what it costs on disk. */
export const conflictList = () => invoke<Conflicts>("conflict_list");

export const noteCreate = (dir: RelPath, name: string) =>
  invoke<Entry>("note_create", { dir, name });
export const pdfExtract = (path: string) => invoke<string>("pdf_extract", { path });
export const pdfSave = (name: string, text: string) =>
  invoke<Entry>("pdf_save", { name, text });
export const dirCreate = (dir: RelPath, name: string) =>
  invoke<Entry>("dir_create", { dir, name });

/**
 * Sanitized HTML for the buffer the editor is holding.
 *
 * The text is sent rather than read from disk because the preview follows what
 * is being typed. **This is the whole of the preview IR** — no AST crosses, and
 * there is no Markdown parser in this application's frontend
 * (docs/ARCHITECTURE.md §10). `Rendered.html` is safe to assign to `innerHTML`
 * for exactly that reason, and for no other.
 */
export const markdownRender = (path: RelPath, text: string) =>
  invoke<Rendered>("markdown_render", { path, text });

/** The outline, links and front-matter span, with no HTML rendered. */
export const markdownOutline = (text: string) =>
  invoke<Document>("markdown_outline", { text });

/**
 * Turn remote images on or off for *this* workspace. `null` falls back to the
 * global setting. Raw HTML is untouched: it is a separate switch.
 */
export const markdownRemoteImagesSet = (allow: boolean | null) =>
  invoke<void>("markdown_remote_images_set", { allow });

/**
 * Start watching the workspace. `null` means the platform is watching; a string
 * is why it is not, and is shown rather than swallowed — the inotify limit comes
 * back with the `sysctl` that raises it.
 */
export const watchStart = () => invoke<string | null>("watch_start");

/**
 * How much of the workspace the watcher has managed to cover.
 *
 * `watch_start` returns as soon as the root is watched; the rest of the tree is
 * walked on a background thread, so this is polled beside `reconcile_tick` to
 * keep the status bar honest while it fills (0.1b).
 */
export const watchStatus = () => invoke<WatchStatus>("watch_status");

/**
 * One watcher-driven tick. **The dirty list comes from here**, because the
 * buffers live in this process and the core does not hold them.
 */
export const reconcileTick = (dirty: NoteId[]) =>
  invoke<Reconciled>("reconcile_tick", { dirty });

/** A full scan: window focus, tab switch, manual refresh. */
export const reconcileAll = (dirty: NoteId[]) =>
  invoke<Reconciled>("reconcile_all", { dirty });

/** Rename in place, keeping the `NoteId` — the tab and its cursor survive. */
export const entryRename = (path: RelPath, newName: string) =>
  invoke<Entry>("entry_rename", { path, newName });

/** Move into another directory. A collision is `AlreadyExists`, naming it. */
export const entryMove = (path: RelPath, toDir: RelPath) =>
  invoke<Entry>("entry_move", { path, toDir });

/** Copy beside the original. Never overwrites; the copy is its own note. */
export const entryDuplicate = (path: RelPath) =>
  invoke<Entry>("entry_duplicate", { path });

/** Delete, and say whether it went to the bin (scope §7.7). */
export const entryDelete = (path: RelPath) => invoke<Deleted>("entry_delete", { path });

export const draftWrite = (
  noteId: NoteId,
  text: string,
  bufferVersion: number,
  baseRev: BaseRev,
  reason: DraftReason,
) => invoke<DraftInfo>("draft_write", { noteId, text, bufferVersion, baseRev, reason });
export const draftList = () => invoke<DraftInfo[]>("draft_list");
export const draftResolve = (noteId: NoteId, choice: DraftChoice) =>
  invoke<OpenedNote>("draft_resolve", { noteId, choice });

/** Fuzzy match over paths, from memory — safe on every keystroke (0.1c). */
export const quickOpen = (query: string, limit: number) =>
  invoke<QuickOpen>("quick_open", { query, limit });

/** Start a content scan. Starting one cancels the previous. */
export const searchStart = (query: string, opts: SearchOpts) =>
  invoke<SearchId>("search_start", { query, opts });

/** Drain the hits found since the last poll — the `reconcile_tick` shape. */
export const searchPoll = (id: SearchId) => invoke<SearchProgress>("search_poll", { id });

export const searchCancel = (id: SearchId) => invoke<void>("search_cancel", { id });

export const sessionGet = () => invoke<Session>("session_get");
export const sessionSave = (session: Session) => invoke<void>("session_save", { session });
export const settingsGet = () => invoke<Settings>("settings_get");
export const settingsSet = (settings: Settings) => invoke<void>("settings_set", { settings });

export type { IndexStatus } from "./generated/IndexStatus";
export type { RecentNote } from "./generated/RecentNote";
export const indexStart = (force = false) => invoke<import("./generated/IndexStatus").IndexStatus>("index_start", { force });
export const indexStatus = () => invoke<import("./generated/IndexStatus").IndexStatus>("index_status");
export const indexCancel = () => invoke<void>("index_cancel");
export const recentNotes = () => invoke<import("./generated/RecentNote").RecentNote[]>("recent_notes");

export type { ReferencePlan } from "./generated/ReferencePlan";
export const referencePreview = (from:RelPath,to:RelPath) => invoke<import("./generated/ReferencePlan").ReferencePlan>("reference_preview",{from,to});
export const referenceApply = (token:string,selected:number[]) => invoke<import("./generated/ReferenceResult").ReferenceResult>("reference_apply",{token,selected});

export type {Knowledge} from "./generated/Knowledge";
export type {Metadata} from "./generated/Metadata";
export const knowledgeGet=()=>invoke<import("./generated/Knowledge").Knowledge>("knowledge_get");
export const metadataGet=(text:string)=>invoke<import("./generated/Metadata").Metadata>("metadata_get",{text});
export const wikiCandidates=(target:string)=>invoke<RelPath[]>("wiki_candidates",{target});
export const attachmentImport=(note:RelPath,bytes:number[])=>invoke<import("./generated/Attachment").Attachment>("attachment_import",{note,bytes});

export type { SyncConnection } from "./generated/SyncConnection";
export type { SyncConditions } from "./generated/SyncConditions";
export type { SyncPairRequest } from "./generated/SyncPairRequest";
export type { DeviceSnapshot } from "./generated/DeviceSnapshot";
export type { SyncPairPreview } from "./generated/SyncPairPreview";
export const deviceStatus = () => invoke<import("./generated/DeviceSnapshot").DeviceSnapshot>("sync_control_status");
export const deviceConfigure = (connection: import("./generated/SyncConnection").SyncConnection) => invoke<void>("sync_control_configure", {connection});
export const deviceConditions = (conditions: import("./generated/SyncConditions").SyncConditions) => invoke<void>("sync_control_conditions", {conditions});
export const deviceRun = () => invoke<void>("sync_control_run");
export type { SyncProbe } from "./generated/SyncProbe";
export type { SyncProbeOutcome } from "./generated/SyncProbeOutcome";
/** A connection test. Unlike pairing it writes nothing, so it runs with the
 *  workspace open — which is when somebody wants to know whether the server is
 *  there at all. */
export const deviceProbe = (origin: string, allowPrivate: boolean, tokenFile: string) => invoke<import("./generated/SyncProbe").SyncProbe>("sync_control_probe", {origin,allowPrivate,tokenFile});
export type { SyncDevice } from "./generated/SyncDevice";
/** The paired workspace's devices (ADR-096), or `null` when this device's
 *  credential was not granted `devices`. Writes nothing, so it works with the
 *  workspace open. */
export const deviceList = () => invoke<import("./generated/SyncDevice").SyncDevice[] | null>("sync_control_devices");
export const deviceRevoke = (device: string) => invoke<import("./generated/SyncDevice").SyncDevice>("sync_control_revoke_device", {device});
export const devicePair = (request: import("./generated/SyncPairRequest").SyncPairRequest) => invoke<void>("sync_control_pair", {request});
export const devicePreview = () => invoke<import("./generated/SyncPairPreview").SyncPairPreview>("sync_control_preview");
export const deviceConfirm = (confirmation: string) => invoke<void>("sync_control_confirm", {confirmation});
export const deviceApply = (resolution: string | null = null) => invoke<void>("sync_control_apply", {resolution});
export const deviceCapture = (note: string) => invoke<void>("sync_control_capture", {note});
export const deviceResolve = (local: string, remote: string, path: string, result: string | null) => invoke<string>("sync_control_resolve", {local,remote,path,result});
export const deviceExport = (id: string, attachment: string | null = null) => invoke<string>("sync_control_export", {id,attachment});

export const deviceRecapture = () => invoke<void>("sync_control_recapture");

export const devicePause = () => invoke<void>("sync_control_pause");

// ── The remote folder (ADR-099) ───────────────────────────────────────────────
// The server's notes workspace, edited in place through its REST API. None of
// these writes a local file.
export type { RemoteConfig } from "./generated/RemoteConfig";
export type { RemoteEntry } from "./generated/RemoteEntry";
export type { RemoteNote } from "./generated/RemoteNote";
export type { RemoteSave } from "./generated/RemoteSave";
export type { LocalMark } from "./generated/LocalMark";
export type { SyncCause } from "./generated/SyncCause";
export const remoteConfigGet = () => invoke<import("./generated/RemoteConfig").RemoteConfig | null>("remote_config_get");
export const remoteConfigSet = (config: import("./generated/RemoteConfig").RemoteConfig | null) => invoke<void>("remote_config_set", {config});
export const remoteProbe = (origin: string, allowPrivate: boolean, tokenFile: string) => invoke<import("./generated/SyncProbe").SyncProbe>("remote_probe", {origin,allowPrivate,tokenFile});
export const remoteList = () => invoke<import("./generated/RemoteEntry").RemoteEntry[]>("remote_list");
export const remoteOpen = (path: string) => invoke<import("./generated/RemoteNote").RemoteNote>("remote_open", {path});
export const remoteSave = (path: string, text: string, etag: string) => invoke<import("./generated/RemoteSave").RemoteSave>("remote_save", {path,text,etag});
export const remoteCreate = (path: string, text: string) => invoke<import("./generated/RemoteNote").RemoteNote>("remote_create", {path,text});
export type { Paired } from "./generated/Paired";
/** Start signing in to the owner's site (ADR-105): returns the address to open in the browser. */
export const pairBegin = (site: string, label: string, allowPrivate: boolean) => invoke<string>("pair_begin", {site,label,allowPrivate});
/** Finish it with the address the browser came back to. The credential is kept in the keychain and is not returned. */
export const pairFinish = (redirect: string) => invoke<import("./generated/Paired").Paired>("pair_finish", {redirect});
export const pairSignedIn = () => invoke<boolean>("pair_signed_in");
export const pairSignOut = () => invoke<void>("pair_sign_out");
export const remoteMerge = (base: string, mine: string, theirs: string) => invoke<import("./generated/Merged").Merged>("remote_merge", {base,mine,theirs});
export const remoteRename = (from: string, to: string, etag: string) => invoke<import("./generated/RemoteNote").RemoteNote>("remote_rename", {from,to,etag});
export const remoteDelete = (path: string, etag: string) => invoke<void>("remote_delete", {path,etag});
export const remoteRender = (path: string, text: string) => invoke<Rendered>("remote_render", {path,text});
