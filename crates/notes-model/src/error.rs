use crate::{BaseRev, NoteId};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// What a [`CoreError::LockTimeout`] was waiting for.
///
/// The variant used to carry one sentence — *"timed out waiting for the
/// workspace write lock"* — emitted from three places, and **two of them are
/// not that lock**. The cost is not cosmetic. `.continue/README.md` carries an
/// open investigation into an intermittent failure whose evidence is precisely
/// that string, counted five times against two; a count over a message that
/// several unrelated waits share measures the message, not the wait, and the
/// next step it recommends is to instrument whichever one happened to be
/// guessed. A typed cause is what makes that count mean something.
///
/// `NotSettled` came out of the same variant for the same reason and is not a
/// lock at all, which is why it is a variant rather than a member here.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum LockWait {
    /// The per-workspace write lock in `notes-core::lock`, held for the
    /// stat → compare → replace sequence. Five seconds with a 20 ms retry, so
    /// this one genuinely waited. It is the only wait the old message named.
    WorkspaceWrite,
    /// The activity state file, taken exclusively. A `try_lock` tried again
    /// only for the quarter of a second a spawning process can carry a copy of
    /// it, so nothing was waited for: another process holds it right now.
    ActivityExclusive,
    /// The activity state file, taken shared. `try_lock_shared`, same.
    ActivityShared,
}

impl std::fmt::Display for LockWait {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            LockWait::WorkspaceWrite => "the workspace write lock",
            LockWait::ActivityExclusive => "the activity state file (exclusive)",
            LockWait::ActivityShared => "the activity state file (shared)",
        })
    }
}

/// Why the device sync client refused, as a typed code (R6-17).
///
/// Every sync-client error used to reach the desktop as `Unsupported`, which
/// the interface renders as *"This storage does not support that."* -- for a
/// conflict, a credential the server denied, the network being down, and a
/// pairing asked for before the history had arrived alike. One sentence for
/// eleven causes is the diagnosis that does not discriminate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum SyncCause {
    ApplicationBlocked,
    UnsupportedApplication,
    Invalid,
    Storage,
    Busy,
    Offline,
    Denied,
    Conflict,
    Limit,
    Protocol,
    Receiving,
}

/// The kind of an I/O failure, as a **typed code**.
///
/// Scope §17 requires "disco cheio / permissão negada → erro visível", and the
/// frontend switches on the code and never reads a message (`ARCHITECTURE.md`
/// §7.3). A stringly-typed `kind` would have put the only distinguishing
/// information in the one field that is not the contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum IoKind {
    DiskFull,
    PermissionDenied,
    ReadOnlyFilesystem,
    NotFound,
    IsADirectory,
    Busy,
    NameTooLong,
    Interrupted,
    Other,
}

impl IoKind {
    /// Classify a `std::io::Error`.
    ///
    /// `ErrorKind` alone does not carry "disk full" on stable Rust for every
    /// platform, so the errno is consulted first: ENOSPC (28) and EDQUOT
    /// (122 on Linux, 69 on macOS/BSD) are both "there is no room", and telling
    /// a user their disk is full when they hit a quota is closer to true than
    /// "unknown I/O error".
    pub fn classify(e: &std::io::Error) -> Self {
        if let Some(code) = e.raw_os_error() {
            match code {
                28 => return IoKind::DiskFull,       // ENOSPC
                122 | 69 => return IoKind::DiskFull, // EDQUOT
                112 | 39 => return IoKind::DiskFull, // Windows ERROR_DISK_FULL / ERROR_HANDLE_DISK_FULL
                _ => {}
            }
        }
        match e.kind() {
            std::io::ErrorKind::StorageFull | std::io::ErrorKind::QuotaExceeded => IoKind::DiskFull,
            std::io::ErrorKind::PermissionDenied => IoKind::PermissionDenied,
            std::io::ErrorKind::NotFound => IoKind::NotFound,
            std::io::ErrorKind::IsADirectory => IoKind::IsADirectory,
            std::io::ErrorKind::ResourceBusy | std::io::ErrorKind::WouldBlock => IoKind::Busy,
            std::io::ErrorKind::InvalidFilename => IoKind::NameTooLong,
            std::io::ErrorKind::Interrupted => IoKind::Interrupted,
            std::io::ErrorKind::ReadOnlyFilesystem => IoKind::ReadOnlyFilesystem,
            _ => IoKind::Other,
        }
    }

    /// Whether retrying the same operation could plausibly succeed. A full disk
    /// is not retried in a loop; a busy file is.
    pub fn is_transient(self) -> bool {
        matches!(self, IoKind::Busy | IoKind::Interrupted)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum ReadOnlyReason {
    NotUtf8,
    MixedEol,
    Workspace,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
#[ts(export)]
pub enum UnavailableReason {
    RootMissing,
    PermissionRevoked,
    NotADirectory,
}

/// Why a workspace opened read-only.
///
/// Both cases mean the same thing to the code — *do not write state* — and
/// completely different things to the person. `SchemaAhead` is a newer build's
/// file and resolves itself by running that build again; `IdentityLost` is
/// damage, and writing through it is what would cause the loss.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "reason", rename_all = "snake_case")]
#[ts(export)]
pub enum WorkspaceReadOnly {
    /// State written by a build newer than this one. Nothing is overwritten;
    /// `found` is carried so a message can say how far ahead it is.
    SchemaAhead { found: u32 },
    /// This root has been opened before — the workspaces index still lists it —
    /// and its identity registry is not there any more.
    ///
    /// Opening normally would write a fresh, empty registry, and the next
    /// reconciliation would mint a new `NoteId` for every note in the tree.
    /// Every `drafts/<old-id>.draft` would become unreachable, permanently:
    /// a draft is the only copy of something the user typed. The sync history
    /// would detach from the server at the same moment, which
    /// [ADR-005] exists to prevent. None of that announces itself, which is
    /// why it is refused here rather than reported afterwards.
    ///
    /// [ADR-005]: ../../docs/decisions.md
    IdentityLost,
}

/// Every command returns `Result<T, CoreError>`.
///
/// `code` is the contract; the frontend maps it to an i18n key and never
/// inspects a message (`ARCHITECTURE.md` §7.3). `Internal` is a bug rather than
/// a state, and a test that expects one fails CI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS, thiserror::Error)]
#[serde(tag = "code", rename_all = "snake_case")]
#[ts(export)]
pub enum CoreError {
    #[error("invalid path {path}: {reason}")]
    InvalidPath { path: String, reason: String },
    #[error("path {path} resolves outside the workspace root")]
    OutsideRoot { path: String },
    #[error("path {path} is a symlink and symlinks are not followed")]
    SymlinkNotFollowed { path: String },
    #[error("{path} not found")]
    NotFound { path: String },
    #[error("{path} already exists")]
    AlreadyExists { path: String },
    #[error("{count} buffers still have unsaved changes")]
    DirtyBuffers { note_ids: Vec<NoteId>, count: usize },
    /// Removing the application's data was refused because drafts hold work
    /// that was never saved (ADR-091). A draft is the only copy of what was
    /// typed into it, so it is resolved in the app first, never deleted here.
    #[error("{count} notes have unsaved drafts")]
    DraftsPending { count: u32 },
    #[error("{note_id} changed on disk since it was opened")]
    Conflict { note_id: NoteId, disk_rev: BaseRev },
    #[error("{note_id} is read-only")]
    ReadOnly {
        note_id: NoteId,
        reason: ReadOnlyReason,
    },
    #[error("workspace {root} is unavailable")]
    Unavailable {
        root: String,
        reason: UnavailableReason,
    },
    #[error("no workspace is open")]
    NoWorkspace,
    #[error("timed out waiting for {what}")]
    LockTimeout { what: LockWait },
    #[error("reconciliation did not settle after {passes} passes, {queued} still queued")]
    NotSettled { passes: u32, queued: u32 },
    #[error("this storage does not support {cap}")]
    Unsupported { cap: String },
    /// The device sync client refused. `received` is set for `Receiving`: how
    /// many revisions have arrived so far.
    #[error("sync refused: {cause:?}")]
    Sync {
        cause: SyncCause,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        #[ts(optional)]
        received: Option<u32>,
    },
    #[error("{op} failed on {path}")]
    Io {
        op: String,
        path: String,
        kind: IoKind,
    },
    /// The file is there and could not be read.
    ///
    /// Distinct from `NotFound` on purpose: for a draft or a conflict snapshot
    /// the difference is whether the only copy of something the user typed is
    /// gone or merely unreadable, and both stores used to answer *absent* for
    /// both. Absent is the answer that lets the next confirmed save delete the
    /// file.
    #[error("{store} at {path} exists but could not be read")]
    StateUnreadable { store: String, path: String },
    #[error("{store} schema {found} is newer than supported schema {supported}")]
    SchemaAhead {
        store: String,
        found: u32,
        supported: u32,
    },
    #[error("internal error: {message}")]
    Internal { message: String },
}

impl CoreError {
    pub fn io(op: &str, path: impl std::fmt::Display, e: &std::io::Error) -> Self {
        CoreError::Io {
            op: op.to_string(),
            path: path.to_string(),
            kind: IoKind::classify(e),
        }
    }
    /// The stable code a frontend switches on, matching the serde tag.
    pub fn code(&self) -> &'static str {
        match self {
            CoreError::InvalidPath { .. } => "invalid_path",
            CoreError::OutsideRoot { .. } => "outside_root",
            CoreError::SymlinkNotFollowed { .. } => "symlink_not_followed",
            CoreError::NotFound { .. } => "not_found",
            CoreError::AlreadyExists { .. } => "already_exists",
            CoreError::DirtyBuffers { .. } => "dirty_buffers",
            CoreError::DraftsPending { .. } => "drafts_pending",
            CoreError::Conflict { .. } => "conflict",
            CoreError::ReadOnly { .. } => "read_only",
            CoreError::Unavailable { .. } => "unavailable",
            CoreError::NoWorkspace => "no_workspace",
            CoreError::LockTimeout { .. } => "lock_timeout",
            CoreError::NotSettled { .. } => "not_settled",
            CoreError::Unsupported { .. } => "unsupported",
            CoreError::Sync { .. } => "sync",
            CoreError::Io { .. } => "io",
            CoreError::StateUnreadable { .. } => "state_unreadable",
            CoreError::SchemaAhead { .. } => "schema_ahead",
            CoreError::Internal { .. } => "internal",
        }
    }
}

impl From<crate::PathError> for CoreError {
    fn from(e: crate::PathError) -> Self {
        CoreError::InvalidPath {
            path: String::new(),
            reason: e.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contextual_disk_errors_keep_their_classification_without_an_errno() {
        for kind in [
            std::io::ErrorKind::StorageFull,
            std::io::ErrorKind::QuotaExceeded,
        ] {
            let contextual = std::io::Error::new(kind, "temporary file context");
            assert_eq!(contextual.raw_os_error(), None);
            assert_eq!(IoKind::classify(&contextual), IoKind::DiskFull);
        }
    }

    #[test]
    fn disk_full_is_distinguishable_from_permission_denied() {
        let full = std::io::Error::from_raw_os_error(28);
        let denied = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        assert_eq!(IoKind::classify(&full), IoKind::DiskFull);
        assert_eq!(IoKind::classify(&denied), IoKind::PermissionDenied);
        assert_ne!(IoKind::classify(&full), IoKind::classify(&denied));
    }

    #[test]
    fn quota_reads_as_disk_full() {
        assert_eq!(
            IoKind::classify(&std::io::Error::from_raw_os_error(122)),
            IoKind::DiskFull
        );
    }

    #[test]
    fn only_transient_kinds_are_worth_retrying() {
        assert!(IoKind::Busy.is_transient());
        assert!(!IoKind::DiskFull.is_transient());
        assert!(!IoKind::PermissionDenied.is_transient());
    }

    #[test]
    fn the_serde_tag_matches_the_code_accessor() {
        let e = CoreError::LockTimeout {
            what: LockWait::WorkspaceWrite,
        };
        let v: serde_json::Value =
            serde_json::from_str(&serde_json::to_string(&e).unwrap()).unwrap();
        assert_eq!(v["code"], e.code());
    }
}
