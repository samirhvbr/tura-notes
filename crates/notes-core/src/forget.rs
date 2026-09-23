//! Removing the application's own data from inside the application (ADR-091).
//!
//! `~/.local/share/notes/` holds the full text of every opened note (the
//! content index), drafts that never expire, conflict snapshots and the list of
//! every folder ever opened, and uninstalling leaves all of it. These are the
//! two ways out the product offers: forget one workspace, or remove everything.
//!
//! **Both refuse while a draft exists.** A draft is the only copy of something
//! the user typed and did not save; it is resolved in the app, never deleted as
//! a side effect of tidying. Both also refuse while another process -- a second
//! window, `notes-mcp` -- has the workspace open, by taking its activity lease
//! exclusively, the same lease that process holds shared.
//!
//! **Only names this application writes are removed.** `NOTES_DATA_DIR` can
//! point anywhere, so an unknown file in it is left where it is.

use std::path::Path;

use notes_fs::FileSystem;
use notes_model::{CoreError, RelPath, WorkspaceId};

use crate::{activity, lock, paths, state, Result, WorkspaceService};

/// Everything this application writes directly into the data directory, other
/// than `workspaces/`, `active/` and `workspaces.lock`, which are handled apart.
const ROOT_FILES: &[&str] = &[
    "settings.json",
    "settings.json.bak-0",
    "workspaces.json",
    "workspaces.json.bak-0",
    "workspaces.json.before-restore",
    "sync-control.json",
];

impl WorkspaceService {
    /// Forget one workspace: its enrollment and everything under
    /// `workspaces/<id>/`. The folder and its notes are not touched.
    pub fn forget_workspace(&mut self, id: WorkspaceId) -> Result<()> {
        if self.open.as_ref().is_some_and(|o| o.id == id) {
            return Err(CoreError::Unsupported {
                cap: "close the workspace before forgetting it".into(),
            });
        }
        let data = self.data_dir.clone();
        let mut enrollment = lock::acquire(&data.join("workspaces.lock"))?;
        enrollment.with(|| {
            let mut index = self.index()?;
            let Some(pos) = index.workspaces.iter().position(|w| w.id == id) else {
                return Err(CoreError::NotFound {
                    path: id.to_string(),
                });
            };
            let dir = paths::workspace_dir(&data, id);
            refuse_drafts(drafts_in(&dir)?)?;
            let _lease = lease(&data, Path::new(&index.workspaces[pos].root))?;
            // The directory first: if its removal fails half way, the workspace
            // is still listed and forgetting it again finishes the job.
            remove_dir(&dir)?;
            index.workspaces.remove(pos);
            if index.last_workspace == Some(id) {
                index.last_workspace = None;
            }
            state::store(&paths::workspaces_index(&data), &index)
        })?
    }

    /// Remove everything this application keeps: every workspace's state, the
    /// enrollment, settings and device-sync configuration. Notes are not
    /// touched, and neither is any folder the user chose (a sync queue).
    pub fn remove_app_data(&mut self) -> Result<()> {
        if self.open.is_some() {
            return Err(CoreError::Unsupported {
                cap: "close the workspace before removing the application's data".into(),
            });
        }
        let data = self.data_dir.clone();
        let workspaces = data.join("workspaces");
        let mut enrollment = lock::acquire(&data.join("workspaces.lock"))?;
        enrollment.with(|| -> Result<()> {
            let mut drafts = 0;
            for dir in subdirs(&workspaces)? {
                drafts += drafts_in(&dir)?;
            }
            refuse_drafts(drafts)?;
            // Every lease any process holds lives in `active/`; taking each one
            // exclusively proves nobody has any workspace open.
            let mut leases = vec![];
            for file in files(&data.join("active"))? {
                leases.push(exclusive(&file)?);
            }
            remove_dir(&workspaces)?;
            for name in ROOT_FILES {
                remove_file(&data.join(name))?;
            }
            drop(leases);
            remove_dir(&data.join("active"))?;
            self.settings = Default::default();
            Ok(())
        })??;
        drop(enrollment);
        // Left empty and private; removed when nothing else is in it. A lock
        // file still open elsewhere, or a file this application does not know,
        // keeps the directory, and that is the intended outcome.
        let _ = std::fs::remove_file(data.join("workspaces.lock"));
        let _ = std::fs::remove_dir(&data);
        Ok(())
    }
}

fn refuse_drafts(count: u32) -> Result<()> {
    if count > 0 {
        return Err(CoreError::DraftsPending { count });
    }
    Ok(())
}

/// Every `*.draft` file, readable or not: an unreadable draft is still the
/// only copy of something.
fn drafts_in(ws: &Path) -> Result<u32> {
    let dir = paths::drafts_dir(ws);
    Ok(files(&dir)?
        .iter()
        .filter(|p| p.extension().is_some_and(|e| e == "draft"))
        .count() as u32)
}

/// This workspace's lease, exclusively: refused while another process has it
/// open. A root that no longer exists has no lease anyone could hold.
fn lease(data: &Path, root: &Path) -> Result<Option<std::fs::File>> {
    let Ok(fs) = notes_fs::LocalFs::open(root) else {
        return Ok(None);
    };
    let canonical = fs.root().display().to_string();
    let key = fs
        .stat(&RelPath::root())?
        .native_id
        .map(|id| format!("native:{id:?}"))
        .unwrap_or_else(|| format!("path:{canonical}"));
    activity::acquire(data, &key, true).map(Some)
}

fn exclusive(path: &Path) -> Result<std::fs::File> {
    let file = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| CoreError::io("activity", "state", &e))?;
    match file.try_lock() {
        Ok(()) => Ok(file),
        Err(std::fs::TryLockError::WouldBlock) => Err(CoreError::LockTimeout {
            what: notes_model::LockWait::ActivityExclusive,
        }),
        Err(std::fs::TryLockError::Error(e)) => Err(CoreError::io("activity_lock", "state", &e)),
    }
}

fn entries(dir: &Path) -> Result<Vec<std::fs::DirEntry>> {
    match std::fs::read_dir(dir) {
        Ok(rd) => rd
            .map(|e| e.map_err(|e| CoreError::io("read_dir", dir.display(), &e)))
            .collect(),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(e) => Err(CoreError::io("read_dir", dir.display(), &e)),
    }
}

fn files(dir: &Path) -> Result<Vec<std::path::PathBuf>> {
    Ok(entries(dir)?
        .into_iter()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .map(|e| e.path())
        .collect())
}

fn subdirs(dir: &Path) -> Result<Vec<std::path::PathBuf>> {
    Ok(entries(dir)?
        .into_iter()
        .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
        .map(|e| e.path())
        .collect())
}

fn remove_dir(dir: &Path) -> Result<()> {
    match std::fs::remove_dir_all(dir) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(CoreError::io("remove_app_data", dir.display(), &e)),
    }
}

fn remove_file(file: &Path) -> Result<()> {
    match std::fs::remove_file(file) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(CoreError::io("remove_app_data", file.display(), &e)),
    }
}
