//! Signed updates are checked automatically; installation is explicitly requested.
use serde::Serialize;

#[derive(Serialize)]
pub struct UpdateStatus {
    supported: bool,
    /// Unsupported only because of where the app is running from: move it and
    /// it can update itself. The interface says so instead of pointing at a
    /// package manager (R7-06).
    relocate: bool,
    version: Option<String>,
    notes: Option<String>,
}

/// Whether the executable runs from somewhere macOS will not let it replace
/// itself: the mounted `.dmg` (`/Volumes/…`) or the read-only randomized copy
/// Gatekeeper's App Translocation makes of a quarantined download. Renaming the
/// new `.app` into place crosses devices there, fails with `EXDEV`, and never
/// even asks for a password; the offer used to be made anyway and fail after
/// the download (`docs/updater.md`, "did macOS ask for your password?").
#[cfg(any(target_os = "macos", test))]
pub fn misplaced_path(exe: &std::path::Path) -> bool {
    let s = exe.to_string_lossy();
    s.starts_with("/Volumes/") || s.contains("/AppTranslocation/")
}

#[cfg(target_os = "macos")]
fn misplaced() -> bool {
    std::env::current_exe().is_ok_and(|p| misplaced_path(&p))
}
#[cfg(not(target_os = "macos"))]
fn misplaced() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::misplaced_path;
    use std::path::Path;

    #[test]
    fn a_disk_image_or_a_translocated_copy_cannot_update_itself() {
        for p in [
            "/Volumes/Tura Notes/Tura Notes.app/Contents/MacOS/tura-notes",
            "/private/var/folders/x1/abc/T/AppTranslocation/0A1B/d/Tura Notes.app/Contents/MacOS/tura-notes",
        ] {
            assert!(misplaced_path(Path::new(p)), "{p}");
        }
        for p in [
            "/Applications/Tura Notes.app/Contents/MacOS/tura-notes",
            "/Users/me/Applications/Tura Notes.app/Contents/MacOS/tura-notes",
            "/usr/bin/tura-notes",
        ] {
            assert!(!misplaced_path(Path::new(p)), "{p}");
        }
    }
}

#[cfg(desktop)]
mod desktop {
    use super::UpdateStatus;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    };
    use tauri::{AppHandle, Manager};
    use tauri_plugin_updater::{Update, UpdaterExt};

    #[derive(Default)]
    pub struct Pending(pub Mutex<Option<Update>>);
    static BUSY: AtomicBool = AtomicBool::new(false);
    struct Guard;
    impl Guard {
        fn acquire() -> Result<Self, String> {
            BUSY.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .map(|_| Self)
                .map_err(|_| "update_busy".into())
        }
    }
    impl Drop for Guard {
        fn drop(&mut self) {
            BUSY.store(false, Ordering::SeqCst);
        }
    }

    pub fn supported() -> bool {
        if cfg!(debug_assertions) || super::misplaced() {
            return false;
        }
        #[cfg(target_os = "linux")]
        if std::fs::read_to_string("/usr/share/tura-notes/package-manager")
            .is_ok_and(|s| s.trim() == "pacman")
        {
            return false;
        }
        use tauri::utils::{config::BundleType, platform::bundle_type};
        matches!(
            bundle_type(),
            Some(BundleType::App | BundleType::AppImage | BundleType::Deb | BundleType::Rpm)
        )
    }

    pub async fn check(app: AppHandle) -> Result<UpdateStatus, String> {
        let _guard = Guard::acquire()?;
        if !supported() {
            return Ok(UpdateStatus {
                supported: false,
                relocate: super::misplaced(),
                version: None,
                notes: None,
            });
        }
        let update = app
            .updater_builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
            .map_err(|e| e.to_string())?
            .check()
            .await
            .map_err(|e| e.to_string())?;
        let result = UpdateStatus {
            supported: true,
            relocate: false,
            version: update.as_ref().map(|u| u.version.clone()),
            notes: update
                .as_ref()
                .and_then(|u| u.body.as_ref())
                .map(|s| s.chars().take(600).collect()),
        };
        *app.state::<Pending>().0.lock().map_err(|_| "update_lock")? = update;
        Ok(result)
    }

    pub async fn install(app: AppHandle) -> Result<(), String> {
        let _guard = Guard::acquire()?;
        if !supported() {
            return Err("update_unsupported".into());
        }
        // The UI closes the workspace through the normal save/conflict flow first.
        // Check again natively: restart must never bypass that lifecycle.
        if app
            .state::<crate::commands::App>()
            .svc
            .lock()
            .map_err(|_| "workspace_lock")?
            .workspace_id()
            .is_some()
        {
            return Err("update_workspace_open".into());
        }
        // A received workspace needs no check of its own: `sync_open` opens it
        // through this same service, so the workspace above is open while one
        // is live and the refusal has already happened. Asking `received`
        // instead was the bug — it is only ever set, never cleared, so it said
        // "open" for the rest of the session (`commands::Received`).
        let update = app
            .state::<Pending>()
            .0
            .lock()
            .map_err(|_| "update_lock")?
            .clone()
            .ok_or("update_unavailable")?;
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
}

#[cfg(desktop)]
pub use desktop::Pending;

#[tauri::command]
pub async fn update_check(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    #[cfg(desktop)]
    {
        desktop::check(app).await
    }
    #[cfg(mobile)]
    {
        let _ = app;
        Ok(UpdateStatus {
            supported: false,
            relocate: false,
            version: None,
            notes: None,
        })
    }
}

#[tauri::command]
pub async fn update_install(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        desktop::install(app).await
    }
    #[cfg(mobile)]
    {
        let _ = app;
        Err("update_unsupported".into())
    }
}
