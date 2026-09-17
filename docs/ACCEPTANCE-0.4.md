# Acceptance — milestone 0.4

> **Status:** `ACTIVE` tracking document · Foundation integrated in 0.17.0.
> The usable mobile milestone is not complete.

PR #2 makes the trash crate a desktop-only dependency and reports
`Caps::LOCAL.trash = false` on iOS/Android. Mobile deletion therefore reports
`DeleteOutcome::Permanent`; the existing desktop trash and guarded atomic
write behavior are retained. ADRs 040 and 042 record the integration choices.

The regression gate cross-checks notes-model, notes-fs, notes-markdown,
notes-index and notes-core for **both** mobile platforms alongside the desktop
tests: an iOS simulator target, and — from 1.6.12 — every one of the four Android
ABIs. Android is checked per ABI rather than once because `notes-index` bundles
SQLite, and a C cross-compile is exactly what breaks on one architecture while
passing on another.

This is compilation evidence. It is not a running mobile app, and no acceptance
below is inferred from it.

The following implementation and owner checks remain pending:

- ~~Generated Android project~~ — **done at 1.6.11**: `tauri android init` produced
  `apps/notes-app/src-tauri/gen/android/`, 40 files of manifest, Gradle, Kotlin and
  resources, committed because ADR-042 calls them source. The generated
  `.gitignore` inside it excludes `build`, `local.properties`, `key.properties`
  and `keystore.properties`, so no build output and no signing material follows.
  The Apple project still requires macOS.
- Tauri mobile entry point, and the generated Apple project.
- Full-screen editor, drawer navigation and Markdown keyboard toolbar.
- Application-container workspace flows and background flush.
- iOS security-scoped bookmarks and Android SAF with persisted authorization.
- Revocation, moved documents, provider offline and reauthorization handling.
- Budgeted polling for providers without watch support.
- Real virtual-keyboard input: accents, dead keys, IME, selection, paste and undo.
- Physical-device and installed-release owner acceptance and repeat.

The owner explicitly requested proceeding to milestone 0.5 after merging this
foundation. That scheduling choice does not check off these mobile criteria.
