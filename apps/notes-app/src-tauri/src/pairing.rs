//! Signing in to the owner's site from the application (ADR-105,
//! `docs/PAIRING.md`): the commands the page calls, over `notes_sync_client::pairing`.
//!
//! The page never sees the secret and never holds the flow's verifier: both stay
//! here, in the one pending sign-in the application keeps. The page gets the
//! address to send the browser to, and later, when the browser has come back, the
//! address it came back to goes the other way and what returns is where to
//! connect and a `keychain:` reference to put where a credential file goes.

use crate::commands::App;
use notes_model::CoreError;
use notes_sync_client::pairing::{self, Paired};
use std::time::{Duration, Instant};
use tauri::State;

/// How long the browser may take. The site's code lives two minutes after the
/// person presses Allow; this is for the person to log in, which can take
/// longer, and for a sign-in that was abandoned not to wait for ever.
const WAIT: Duration = Duration::from_secs(15 * 60);

/// The one credential name this application keeps for the site's sign-in.
pub const CREDENTIAL: &str = "site";

/// Start a sign-in. Returns the address to open in the browser.
#[tauri::command]
pub async fn pair_begin(
    app: State<'_, App>,
    site: String,
    label: String,
    allow_private: bool,
) -> Result<String, CoreError> {
    let pending = pairing::begin(&site, &label, allow_private)?;
    let url = pending.authorize_url.clone();
    *app.pairing
        .lock()
        .map_err(|_| CoreError::from(notes_sync_client::Error::Invalid))? =
        Some((pending, Instant::now()));
    Ok(url)
}

/// Finish the sign-in the browser has come back from, given the address it came
/// back to (`tura://pair?code=…&state=…`). Consumes the pending sign-in whatever
/// happens: a code is single-use, so a failure is a new sign-in and not a retry.
#[tauri::command]
pub async fn pair_finish(app: State<'_, App>, redirect: String) -> Result<Paired, CoreError> {
    let pending = app
        .pairing
        .lock()
        .map_err(|_| CoreError::from(notes_sync_client::Error::Invalid))?
        .take();
    let Some((pending, began)) = pending else {
        return Err(CoreError::from(notes_sync_client::Error::Invalid));
    };
    if began.elapsed() > WAIT {
        return Err(CoreError::from(notes_sync_client::Error::Invalid));
    }
    tauri::async_runtime::spawn_blocking(move || pending.finish(&redirect, CREDENTIAL))
        .await
        .map_err(|_| CoreError::from(notes_sync_client::Error::Invalid))?
        .map_err(CoreError::from)
}

/// Whether this device has a credential from the site. A yes or a no: the
/// credential is not returned to anything.
#[tauri::command]
pub async fn pair_signed_in() -> bool {
    tauri::async_runtime::spawn_blocking(|| notes_sync_client::remote::has_credential(CREDENTIAL))
        .await
        .unwrap_or(false)
}

/// Sign out: forget the credential on this device. The credential itself is
/// revoked on the site or from the devices list (ADR-096); until it is, it still
/// works for anyone who has it, and the page says so.
#[tauri::command]
pub async fn pair_sign_out() -> Result<(), CoreError> {
    tauri::async_runtime::spawn_blocking(|| {
        notes_sync_client::remote::forget_credential(CREDENTIAL)
    })
    .await
    .map_err(|_| CoreError::from(notes_sync_client::Error::Invalid))?
    .map_err(CoreError::from)
}
