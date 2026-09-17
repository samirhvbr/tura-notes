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
- ~~Tauri mobile entry point~~ — **done at 1.6.16**: `run()` carries
  `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, and CI checks the shell for
  arm64 Android alongside the core's four ABIs. The generated **Apple** project
  still needs macOS.
- ~~Full-screen editor, drawer navigation and Markdown keyboard toolbar~~ —
  **done at 1.6.14 and 1.6.15**: below 720px the sidebar leaves the flow and
  overlays, the editor takes the window, split view stacks, opening a note from
  the drawer closes it, and a Markdown row sits under the editor with the six
  marks a phone keyboard buries. Every action is a toggle and the logic is pure
  and tested; what remains untested is the CodeMirror dispatch, which needs a
  device.
- Application-container workspace flows and background flush.
- iOS security-scoped bookmarks, and Android SAF with persisted
  authorization — the Android half now has a written contract in
  [MOBILE-0.4.md](MOBILE-0.4.md) (`PROPOSED`), including the one thing that
  does not map: SAF has no atomic rename, so `write_atomic` cannot promise on
  a tree what it promises on a filesystem.
- Revocation, moved documents, provider offline and reauthorization handling.
- Budgeted polling for providers without watch support.
- Real virtual-keyboard input: accents, dead keys, IME, selection, paste and undo.
- Physical-device and installed-release owner acceptance and repeat.

**Nothing here has ever been observed running**, and that is one disabled
firmware bit rather than a missing step. The x86_64 emulator needs KVM;
`kvm_amd` is refused by `SVMDIS` in `MSR_VM_CR`, which the firmware locks until
the next reset, so no privileged command on the running system reaches it. The
SDK side is already done — `emulator`, `platform-tools`, the
`android-35;google_apis;x86_64` image and an AVD all exist. What is missing is
[OWNER-ACTS.md](OWNER-ACTS.md) §3, and until it happens every row above is
blocked on the same thing rather than on separate work.

The owner explicitly requested proceeding to milestone 0.5 after merging this
foundation. That scheduling choice does not check off these mobile criteria.
