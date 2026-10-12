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
  ~~The Apple project still requires macOS.~~ — **done at 1.11.8**: `tauri ios init`
  produced `apps/notes-app/src-tauri/gen/apple/`, with the privacy manifest and the
  Files-visible `Documents` folder added to it.
- ~~Tauri mobile entry point~~ — **done at 1.6.16**: `run()` carries
  `#[cfg_attr(mobile, tauri::mobile_entry_point)]`, and CI checks the shell for
  arm64 Android alongside the core's four ABIs. ~~The generated **Apple** project
  still needs macOS.~~ — **done at 1.11.8**, see above.
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

**On Android, nothing here has ever been observed running**, and that is one
disabled firmware bit rather than a missing step. The x86_64 emulator needs KVM;
`kvm_amd` is refused by `SVMDIS` in `MSR_VM_CR`, which the firmware locks until
the next reset, so no privileged command on the running system reaches it. The
SDK side is already done — `emulator`, `platform-tools`, the
`android-35;google_apis;x86_64` image and an AVD all exist. What is missing is
[OWNER-ACTS.md](OWNER-ACTS.md) §3, and until it happens every row above is
blocked on the same thing rather than on separate work.

## iOS: what the Simulator showed on 12/10/2026, and what a store build still needs

> **Status:** observation, not acceptance. Xcode 27.0, iPhone 17 Simulator on iOS
> 26.5, a debug build from `tools/ios-simulator.sh`, a physical device never. No row
> of the list above is ticked by this.

**Worked:** the app launches; the welcome screen draws in the dark theme; "Create
Workspace" makes `Documents/notes` in the sandbox; a `.md` placed there from outside
appears in the tree and is indexed; it opens in CodeMirror; typed text is saved to the
file; killing the app and starting it again restores the workspace and the open tab;
the AI assistant's key is accepted and reads back as saved from the iOS keychain on
an ad-hoc-signed build.

**Did not, and is not fixed here:**

- **"Open Folder" is the sandbox, not a folder the user picks.** The dialog plugin
  answers a directory pick on mobile with `FolderPickerNotImplemented`. Both welcome
  buttons used to do nothing; since 1.11.8 they use the app's `Documents` folder
  (`sandbox_root`). The security-scoped-bookmark adapter is still unbuilt.
- **A workspace is stored by absolute path, and the sandbox path moves.** After
  re-installing the build the container's UUID changed, the registry still named the
  old one, and the welcome screen said the workspace folder is not reachable. Apple
  documents that the container path can change across updates and restores. Needs
  a registry that stores sandbox workspaces relative to `Documents`, before any
  update-over-update TestFlight run.
- **The page scrolls sideways when the keyboard opens.** WKWebView scrolls the
  document to the caret, `overflow: hidden` on `body` does not stop it, and the rail
  and the status bar stay off screen until the app restarts. The Markdown row
  (`.mdbar`) sits under the keyboard because iOS does not resize the layout viewport.
- **Desktop wording on a phone:** the new-note dialog says to right-click a folder,
  the settings and the welcome screen offer "Check for updates" (App Store apps do not
  update themselves), and "Open received workspace" is the first thing on screen.
- **Inputs below 16px make iOS zoom the page** on focus.

**A store build (`--export-method app-store-connect`) still needs, in order:**

1. The owner's decisions: export compliance (`ITSAppUsesNonExemptEncryption` is
   deliberately unset: the app carries rustls and ring), the App Privacy answers, a
   privacy-policy URL and a support URL, and review notes for the AI assistant and the
   site sign-in.
2. The bundle id `br.com.samirhv.notes` registered under team `S65UBCTPN5`, an App
   Store Connect record, and a distribution profile. None of it was touched.
3. A build number that rises on every upload (`--build-number N`, which gives
   `CFBundleVersion` `X.Y.Z.N`) and `--config '{"version":"X.Y.Z"}'`.
4. The first upload's answer on required-reason APIs: `PrivacyInfo.xcprivacy`
   declares FileTimestamp and DiskSpace, from the release binary.
5. The container-path fix above, and a decision on guideline 4.2 (minimum
   functionality) for an app whose only workspace is its own sandbox.

The owner explicitly requested proceeding to milestone 0.5 after merging this
foundation. That scheduling choice does not check off these mobile criteria.
