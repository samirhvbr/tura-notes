//! The Tauri shell. Thin by rule (ADR-003): it wires commands to `notes-core`
//! and holds no policy of its own.

mod asset;
mod commands;
pub mod linux;
mod updater;

use std::sync::Mutex;

use commands::{App, DmabufReport};
use notes_core::WorkspaceService;

/// The one entry point, for every platform.
///
/// On desktop `main.rs` calls this. On Android and iOS there is no `main`: the
/// generated project's activity loads this library and calls the symbol the
/// macro exports, which is why the attribute is `cfg_attr(mobile, ...)` rather
/// than a second function — ADR-042 keeps mobile inside this application, and a
/// separate mobile entry would be the beginning of a second one.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The service is built before the window so the settings that govern the
    // WebView are readable before it exists. A settings file that cannot be read
    // yields defaults, and the default is `auto` — never `off`.
    let service = WorkspaceService::new().expect("resolve the data directory");
    let network = notes_sync_client::control::Controller::new(service.data_dir());
    let setting = service.settings().linux.webkit_dmabuf_workaround.clone();

    // Before `tauri::Builder`, and therefore before any WebView: WebKit reads
    // the variable when it creates one.
    let decision = linux::apply(&setting);
    eprintln!("[notes] dmabuf: {}", decision.explanation);

    tauri::Builder::default()
        // Window lifecycle, logged.
        //
        // A window that disappears with the process exiting **0** is not a
        // crash: Tauri ends its event loop when the last window is gone, so
        // "closed" and "destroyed by something else" are indistinguishable from
        // outside. This says which, and who asked — without it the next
        // occurrence is as undiagnosable as the first.
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                eprintln!("[notes] window {}: close requested", window.label());
            }
            tauri::WindowEvent::Destroyed => {
                eprintln!("[notes] window {}: destroyed", window.label());
            }
            tauri::WindowEvent::Focused(f) => {
                eprintln!("[notes] window {}: focused={f}", window.label());
            }
            _ => {}
        })
        .setup(|app| {
            // Every use of `app` below is behind `cfg(desktop)`, so on Android
            // and iOS the binding is unused and `-D warnings` turns that into a
            // build failure. Naming it `_app` would then read as "unused" on the
            // platform where it is used the most.
            let _ = &app;
            #[cfg(desktop)]
            {
                use tauri::Manager;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.manage(updater::Pending::default());
            }
            // Help ▸ About, and it is ours rather than the platform's.
            //
            // Tauri's default menu puts a predefined About in Help on Linux and
            // Windows and leaves Help EMPTY on macOS, where the standard one
            // lives in the application menu. Either way the panel it opens says
            // the name and the version and stops, and the questions that arrive
            // with a problem — which engine is drawing this, where is the data,
            // which folder is open — have no surface at all (ADR-079).
            //
            // So Help is emptied and given one item, which is the same item on
            // every platform. macOS keeps its own About in the application menu;
            // that one is the system's and is left alone.
            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem, MenuItemKind, HELP_SUBMENU_ID};
                use tauri::Emitter;
                let handle = app.handle();
                let menu = Menu::default(handle)?;
                // Appending to the default rather than building a menu: the
                // default carries Edit with cut, copy, paste and select-all, and
                // a WebView whose menu loses those loses the shortcuts too.
                if let Some(MenuItemKind::Submenu(help)) = menu.get(HELP_SUBMENU_ID) {
                    while help.remove_at(0)?.is_some() {}
                    help.append(&MenuItem::with_id(
                        handle,
                        "about",
                        "About Tura Notes",
                        true,
                        None::<&str>,
                    )?)?;
                }
                app.set_menu(menu)?;
                // The one place the shell speaks to the frontend instead of
                // answering it. A command cannot carry this: the menu is on this
                // side and nothing in the webview knows it was clicked.
                app.on_menu_event(|app, event| {
                    if event.id() == "about" {
                        let _ = app.emit("menu://about", ());
                    }
                });
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(App {
            svc: Mutex::new(service),
            received: Mutex::new(None),
            network,
            dmabuf: DmabufReport {
                applied: decision.applied,
                explanation: decision.explanation,
            },
        })
        // The `notes-asset://` scheme, and the second entry point into the
        // workspace (`docs/ARCHITECTURE.md` §10). It resolves nothing itself:
        // the path goes to `notes-core`, which applies the same root jail as
        // every command, and only image types come back.
        .register_uri_scheme_protocol("notes-asset", asset::serve)
        .invoke_handler(tauri::generate_handler![
            commands::env_report,
            updater::update_check,
            updater::update_install,
            commands::sync_control_status,
            commands::sync_control_configure,
            commands::sync_control_conditions,
            commands::sync_control_run,
            commands::sync_control_pause,
            commands::sync_control_probe,
            commands::sync_control_pair,
            commands::sync_control_preview,
            commands::sync_control_confirm,
            commands::sync_control_apply,
            commands::sync_control_capture,
            commands::sync_control_recapture,
            commands::sync_control_resolve,
            commands::sync_control_export,
            commands::sync_open,
            commands::sync_apply,
            commands::sync_reload,
            commands::sync_recovery_restart,
            commands::knowledge_get,
            commands::wiki_candidates,
            commands::metadata_get,
            commands::attachment_import,
            commands::reference_preview,
            commands::reference_apply,
            commands::index_start,
            commands::index_status,
            commands::index_cancel,
            commands::recent_notes,
            commands::workspace_open,
            commands::markdown_render,
            commands::markdown_outline,
            commands::markdown_remote_images_set,
            commands::workspace_create,
            commands::workspace_restore_last,
            commands::workspace_recent,
            commands::workspace_forget,
            commands::app_data_remove,
            commands::workspace_close,
            commands::tree_list,
            commands::note_open,
            commands::note_save,
            commands::note_flush,
            commands::note_reload,
            commands::note_close,
            commands::note_convert_eol,
            commands::conflict_resolve,
            commands::conflict_list,
            commands::shell_open,
            commands::note_create,
            commands::pdf_extract,
            commands::pdf_save,
            commands::dir_create,
            commands::watch_start,
            commands::watch_status,
            commands::reconcile_tick,
            commands::reconcile_all,
            commands::entry_rename,
            commands::entry_move,
            commands::entry_duplicate,
            commands::entry_delete,
            commands::draft_write,
            commands::draft_list,
            commands::draft_resolve,
            commands::quick_open,
            commands::search_start,
            commands::search_poll,
            commands::search_cancel,
            commands::session_get,
            commands::session_save,
            commands::settings_get,
            commands::settings_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
