use std::path::PathBuf;

use notes_model::{CoreError, WorkspaceId};

/// Where the application keeps everything that is not a note.
///
/// **The core resolves this itself and does not use Tauri's `app_data_dir()`**
/// (`ARCHITECTURE.md` §18.4): `notes-mcp` runs without Tauri from 0.3, and the
/// two processes have to agree on one directory or the registry has two
/// versions.
///
/// `NOTES_DATA_DIR` overrides it — that is what makes the whole service testable
/// without touching the developer's real data, and what "portable install"
/// will mean later.
pub fn data_dir() -> Result<PathBuf, CoreError> {
    if let Some(over) = std::env::var_os("NOTES_DATA_DIR") {
        return Ok(PathBuf::from(over));
    }
    dirs::data_dir()
        .map(|d| d.join("notes"))
        .ok_or_else(|| CoreError::Internal {
            message: "no data directory on this platform".into(),
        })
}

/// Create `path` if needed and make it private to this user (R6-27a).
///
/// The data directory holds the full text of every note ever opened (the search
/// index, measured at 108 MB on the machine this was found on), drafts that
/// never expire, conflict snapshots and the identity registry, and it was
/// created `0755` with files `0644`: readable by every account on the machine.
/// `0700` on the root closes all of it, including what existing installs
/// already wrote, because nothing below a directory others cannot enter is
/// reachable by them. Tightened on every start, not only on creation, for
/// exactly that reason. A no-op where modes do not exist.
pub fn private_dir(path: &std::path::Path) -> Result<(), CoreError> {
    std::fs::create_dir_all(path).map_err(|e| CoreError::io("mkdir", path.display(), &e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let meta =
            std::fs::metadata(path).map_err(|e| CoreError::io("stat", path.display(), &e))?;
        if meta.permissions().mode() & 0o077 != 0 {
            std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
                .map_err(|e| CoreError::io("chmod", path.display(), &e))?;
        }
    }
    Ok(())
}

pub fn workspaces_index(data: &std::path::Path) -> PathBuf {
    data.join("workspaces.json")
}

pub fn global_settings(data: &std::path::Path) -> PathBuf {
    data.join("settings.json")
}

pub fn workspace_dir(data: &std::path::Path, id: WorkspaceId) -> PathBuf {
    data.join("workspaces").join(id.to_string())
}

pub fn registry_file(ws: &std::path::Path) -> PathBuf {
    ws.join("registry.json")
}
pub fn session_file(ws: &std::path::Path) -> PathBuf {
    ws.join("session.json")
}
pub fn lock_file(ws: &std::path::Path) -> PathBuf {
    ws.join("write.lock")
}
pub fn drafts_dir(ws: &std::path::Path) -> PathBuf {
    ws.join("drafts")
}
pub fn conflicts_dir(ws: &std::path::Path) -> PathBuf {
    ws.join("conflicts")
}
