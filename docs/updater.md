# Signed desktop updates

> **Status:** ACTIVE · 1.3.7 · [ADR-074](decisions.md#adr-074--signed-desktop-updates-with-explicit-installation)

## Application behavior

Release builds check 20 seconds after launch and every six hours. Welcome and
Settings also expose a manual check.

**Both surfaces state the version that is running**, beside the one being
offered. Until 1.3.9 neither did, and *Tura Notes update 1.3.6* above an
application already on 1.3.6 reads as a loop rather than as an offer. The number
comes from `env_report`, which reads it from the package — stamped from
`version.md` at build time (ADR-035) — rather than from `CARGO_PKG_VERSION`,
which is the `0.0.0` placeholder. Settings repeats it under Diagnostics, and
**Help → About** shows it beside the engine, the data directory and the open
workspace, with a button that copies all of them
([ADR-079](decisions.md#adr-079--the-about-dialog-is-ours-and-help-is-where-it-opens)). A new version shows its release notes and
an **Install and restart** action; **Later** suppresses automatic notices for
that version. A manual check can show it again. Automatic failures stay silent;
manual failures show a retryable status. Downloads/installations are never
started by a timer.

Installation closes the workspace through its normal save/conflict flow, and
**Install and restart** is what runs that flow. Unsaved work still stops the
close and is still named in the question it asks; declining leaves the workspace
open and installs nothing. Until 1.3.7 the condition was stated to the user and
left to them — the banner asked for a closed workspace and its only button
repeated the sentence, while the command that closes one lives in a menu in the
sidebar footer, so the update looked broken rather than guarded. The native side
still refuses to install while a workspace is open, so the condition is enforced
on both sides rather than assumed on one. The closed workspace is reopened by
`restore_last_workspace` after the restart, and reopened in place when the
installation fails instead of restarting. The editing/IPC barrier
blocks new work during installation and is released on failure. The native
plugin downloads over HTTPS, verifies the payload against the pinned Tura public
key, installs and restarts. AppImage replaces the running image; deb/rpm may
require the system's administrator authentication. AUR packages carry a pacman
marker and use their package manager instead. Debug, mobile and Windows builds
do not offer this update channel.

Versions predating 1.1.0 cannot discover updates: manually install the first
updater-capable release. A GitHub Release alone does not activate its updater
feed; the signed local publisher does that.

**Versions from 1.1.0 to 1.6.x discover updates and almost never install them.**
Before installing, the application claims the editor barrier, and until `1.7.0`
that claim was a single instant's check against the index poll (every 500 ms),
the knowledge panel (3 s) and the device status (15 s): a coin toss the install
loses nearly every time, reported as *"nothing was attempted"*. `1.7.0` fixed the
claim, but a fix cannot reach the copy whose installer is the broken part, so a
1.6.x installation leaves by hand, once — [OWNER-ACTS.md §5](OWNER-ACTS.md#5-leave-16x-by-hand-once).
From `1.7.0` on, the in-app installation is the one this page describes.

## Release builder setup

Tura uses an independent updater signing key. The public key is committed in
`apps/notes-app/src-tauri/tauri.conf.json`; the private key belongs outside Git,
by default at `~/.config/tura-notes/updater.key` with mode 600 (directory 700).
The same private key must be provisioned securely on each release builder.
Do not generate a different key for each machine or release: installed clients
trust the public key already embedded in their application.

For a key stored elsewhere, set `TAURI_SIGNING_PRIVATE_KEY_PATH`. The CLI's
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are also
supported. Never place key material in commands, documentation, artifacts or
logs. Apple Developer ID signing and notarization remain separate requirements
for macOS. Preflight signs a disposable probe and verifies it against the pinned
public key before the expensive application build.

```bash
./deploy.sh --publish                     # native macOS or Linux
./deploy.sh --bundles deb,appimage,rpm --publish   # Linux only
./deploy.sh --publish                     # retry a failed upload, reuse build
./deploy.sh --no-sign                     # local test, publication refused
```

Linux stores `.sig` and `.updater.json` beside each package and includes their
hashes in the completed-build record. macOS retains the notarized `.app`, creates
`Tura Notes.app.tar.gz` and signs that archive separately from the DMG. Missing
or changed signing records invalidate reuse. A valid publication retry needs
neither a private signing key nor npm/Cargo compilation. `--force` rebuilds.

## Hosting and publication

Upload remains SCP/SSH to `b3sys@100.64.100.125`. Public clients read:

```
https://samirhv.com.br/updates/tura-notes/{{target}}-{{arch}}-{{bundle_type}}.json
```

**That URL is compiled into every build**, in `tauri.conf.json` under
`plugins.updater.endpoints`, so it is fixed at build time and an installed
application cannot be told to look somewhere else. The upload host does not
appear in it, which is the property worth being precise about: **publishing
works from any machine, to any path, as long as the bytes end up somewhere
`https://samirhv.com.br` serves them.** `100.64.100.125` is that machine — it
answers for both shvia.org and samirhv.com.br — so the download page and the
updater feed both work with no redirection and no second name. Uploading to a
host that serves a *different* domain does not: the feed would be readable, at
a URL no installed build asks for.

That is enforced rather than documented. After writing the feed,
`tools/updater-release.py` fetches it back from `TURA_PUBLIC_BASE` over HTTPS,
compares it byte for byte with the manifest it generated, then downloads the
payload and checks its SHA-256. A host that does not serve the base fails the
publish; it does not produce a feed nobody reads.

Moving the feed to another name — `tura.samirhv.com.br`, for instance — means
editing `endpoints` and rebuilding, and only builds made after that change would
follow it. **That stopped being free on 17/09/2026**, when the two Linux feeds
were published at `1.6.3`: an installed build from before such a change keeps
asking the old name for ever, so the old name has to keep answering. It is also
not needed: the name already compiled into every build is served by the machine
the files are going to.

Examples: `darwin-aarch64-app.json`, `linux-x86_64-deb.json`,
`linux-aarch64-appimage.json`, `linux-x86_64-rpm.json`. Each feed contains version,
notes, HTTPS payload URL and signature. Payload names include version, platform
and a content hash so a newly published feed cannot change an in-flight download.

**Publishing is two independent steps, and conflating them is how six releases
went out believing they had shipped.** One files the artifact with the download
service, which is what puts a row on `/p/tura-notes`; the other writes the
updater feed, which is what an installed application reads. Either can succeed
while the other does nothing, and on 17/09 exactly that happened: both feeds
were published and verified, and the ingest published nothing at all.

**A zero exit status is not evidence of publication**, which is the lesson
`1.6.28` paid for. `--version` is a Symfony Console *global* option:
`Application::doRun()` reads it off raw argv before resolving any command, prints
the framework's version and returns 0. The ingest step's entire output was
`Laravel Framework 13.12.0`, and 0 is success — so the script deleted the staged
upload and announced a release. The option is `--file-version` now, on both call
sites. What to check after a publish is the row in the download service and the
project page, never the exit code
([ADR-084](decisions.md#adr-084--a-step-that-publishes-installs-or-deletes-is-verified-by-reading-back-what-it-changed)); the feed half already checks itself, and the
ingest half is the one with nothing watching it.

After download-service ingestion, the publisher stages files in a unique
remote directory, checks SHA-256 and installs as www-data under
`$TURA_PUBLISH_APP/public/updates/tura-notes` — through the publish helper
without a password when it is installed ([OWNER-ACTS.md §7](OWNER-ACTS.md#7-let-the-publish-run-without-a-password)),
otherwise through `sudo -u www-data`, which asks. It installs the payload first and
atomically replaces only that platform's feed last. Staging is cleaned even on
failure. It then checks the public feed and hashes the public download. The web
server must serve this directory directly without authentication or stale cache
for JSON feeds. Serialize releases for the same platform; publishing an older
version intentionally changes that feed, although clients never downgrade.

`TURA_PUBLISH_HOST`, `TURA_PUBLISH_STAGE`, `TURA_PUBLISH_APP` and `TURA_PUBLIC_BASE`
retain their existing meanings. Changing the public base for the publisher does
not change an already installed client's endpoint. Changing update service or
key requires an explicit migration. Keep old payloads while clients may still
be downloading them. CI's existing unsigned Linux installers do not publish a
signed feed; only this signing/publishing path does.

## When "the update could not be completed"

The banner finds the feed, shows the newer version, and the install fails. The
feed is therefore **not** the problem — it was read, parsed and its version
compared. What is left is download, signature check and replacing the
application, and on each platform the plugin fails differently.

**From `1.6.69` the application prints the actual error under the message**, so
read that first: it is the updater plugin's own text, carried across the IPC and
shown verbatim. Everything below is how to act on what it says, and what to infer
when you are on a build older than `1.6.69` — which, since the thing that is
broken is the updater, is the build most people reading this are on.

**If there is no error printed under the message, the plugin was never reached**,
and nothing below applies. Up to `1.6.98` that was this application's own defect
rather than anything about your machine: the install closes the workspace first,
the close is an IPC call, and the barrier that call releases a macrotask later
was being asked for a microtask too early — so the update was refused by its own
completed work, and reported with the macOS advice for a step that never ran. It
was reported twice from use, on two different versions, and the sign was always
the same: an empty space where the verbatim error should be. `1.6.99` gave that
refusal its own sentence — *"nothing was attempted"* — instead of the platform
hint, and `1.7.0` fixed the claim itself, which until then was a coin toss
against the application's own polling. A 1.6.x build saying it is that defect,
and pressing the button again is a retry of the same toss; see the 1.1.0
paragraph above for the way out. A `1.7.0` or later build saying it is telling
you something else really holds the barrier.

### macOS — the one question that splits it

`tauri-plugin-updater` replaces the bundle in three steps: extract the
`.app.tar.gz` into `$TMPDIR`, **`rename` the running `.app` out of the way**, and
move the new one into place. That middle step decides everything:

- **`PermissionDenied`** → the plugin escalates, and macOS shows an
  administrator password prompt. If you cancel it, or it fails, the error is
  *"Failed to move the new app into place"*.
- **Any other error** → the plugin returns it immediately and **no prompt ever
  appears**. The common one is `EXDEV` — a rename across filesystems, which
  `rename(2)` cannot do.

So: **did macOS ask for your password?** — the question that answers it without
the error text, for a build that does not yet print one.

**No prompt** means the application is not where it thinks it is. The two ways
that happens are the same mistake: running it from the mounted `.dmg`, or from
`~/Downloads` with the quarantine attribute still set, in which case Gatekeeper
**App Translocation** runs it from a read-only randomized path under
`/private/var/folders/…/AppTranslocation/`. A rename out of there crosses devices
and cannot be authorized away.

```sh
# where is it really running from?
osascript -e 'POSIX path of (path to application "Tura Notes")'
```

If that prints anything containing `AppTranslocation` or `/Volumes/`, the fix is
to quit, drag the `.app` into `/Applications`, clear the attribute and reopen.
Since 1.8.25 the app checks this itself before offering anything: from either
place it reports itself unable to update and says to move it, instead of
downloading an update it cannot install (`misplaced_path` in `updater.rs`).
By hand:

```sh
xattr -dr com.apple.quarantine "/Applications/Tura Notes.app"
```

**A prompt that appeared and still failed** is a genuine permission problem on
`/Applications/Tura Notes.app` — most often an app copied there with `sudo`, so
it is owned by `root` and the AppleScript's `rm -rf` is what fails.

**This is not specific to this application.** Every Tauri 2 application updates
through the same three steps, so an installation habit that breaks one breaks all
of them — which is the signal worth acting on if more than one of your apps
refuses to update with the same message.

### Linux

The `.deb` path runs `dpkg -i` through `pkexec`, falling back to `zenity` or
`kdialog` for a password and then to a terminal `sudo`. On a headless session
with no polkit agent and no `zenity`, all three fail and the message is the same.

Upgrading over the pre-`1.0.0` `notes` package works: the `.deb` declares
`Conflicts: notes (<< 1.0.0)` and `Replaces: notes (<< 1.0.0)`, and
`dpkg --dry-run -i` on the published package reports *"considering removing notes
in favour of tura-notes … yes, will remove"*. It did **not** work before
`1.6.1`, which is what the `half-installed` / `not-installed` pair in
`/var/log/dpkg.log` records on a machine that tried it then.

The AppImage path rewrites the AppImage in place and needs a temporary directory
**on the same device** as the file; it tries `$TMPDIR`, the cache directory and
the AppImage's own directory in that order before giving up.

## Validation and remaining acceptance

Automated tests cover notice/dismiss/manual-check behavior, workspace and input
barriers, failed installation cleanup, signed-record reuse, tamper detection,
upload checksum failures and payload-before-feed ordering. The existing Linux
orchestration suite continues to cover failed publication followed by reuse.

Installed acceptance requires two signed releases: install the older one, publish
the newer one for the same architecture/format, verify automatic and manual
notices, postpone, install with a dirty workspace and accept the save it asks for,
restart, and check version and note bytes. Repeat declining that save, which
must install nothing and leave the workspace open; offline; with a corrupt
payload; and with denied administrator authentication — the last three leave the
workspace closed for an installation that did not happen, so each one also
checks that it came back. Run separately on macOS, AppImage,
deb and rpm; confirm AUR delegates to pacman. Compilation and signature checks
do not establish this installed acceptance. Remaining work is in `.continue/`.

### Verification of 1.1.0

On 12/09/2026, the final macOS ARM64 application and DMG passed Apple
notarization, stapling and Gatekeeper checks. Its updater archive was signed
and verified against the configured key, and a repeat build reused it.
Debian 12 ARM64 produced deb, AppImage and rpm packages; a repeat invocation
reused all three. Those Linux packages were built with `--no-sign` in the local
Docker environment, then signed and verified on the macOS host, keeping the
private key out of the container. This validates native packaging and the actual
payload signatures, not an installed cross-version upgrade.

The frontend suite passed 90 tests; Linux orchestration passed 11, and updater
publication passed 5. A real signed probe verified successfully and a modified
probe was rejected. Clippy passed for the application library and standalone
signature verifier. The whole repository gate was run and still has the queued
`notes-sync-client` needless-borrow failure and watcher startup timing failure.
The changed CSS passes the contrast gate; the tracked version placeholder was
verified again after packaging restored it.

**The paragraph that used to open here said the live feed had never been
published. That stopped being true on 17/09/2026 and the correction is below.**
The application path was never wrong:
`/srv/www/samirhv.com.br/samirhv` is exactly where the site's `deploy.sh` puts
the Laravel application, and `ssh b3sys@100.64.100.125 test -f
/srv/www/samirhv.com.br/samirhv/artisan` succeeds. The host was wrong, for six
releases, and a wrong host reports itself as a missing path — which is what the
previous version of this paragraph recorded, in good faith, as a path to
confirm. 1.1.17 moved the default to `.125` and 1.1.14's preflight now passes
against it.

### What is published, measured from outside — 24/09/2026

Read back over HTTPS from `https://samirhv.com.br` on 24/09/2026, after the
owner's `tools/build-linux.sh --publish` of that afternoon:

| Feed | State |
|---|---|
| `linux-x86_64-deb.json` | `1.8.58`, 416-byte signature |
| `linux-x86_64-appimage.json` | `1.8.58`, 424-byte signature |
| `darwin-aarch64-app.json` | `1.7.21`, 408-byte signature: the macOS feed exists and is behind Linux |
| `darwin-aarch64.json`, `darwin-x86_64-app.json` | `404`: only Apple Silicon `.app` is published |

`/p/tura-notes` lists releases up to `1.8.58`. On 23/09 both Linux feeds were
at `1.8.21`, built from a tree that carried uncommitted work; the `1.8.58` build
replaced it. The updater key the publish needs is
`~/.config/tura-notes/updater.key` (`tools/updater-release.py`), not the
notarisation files the 18/09 text named.

An installed `1.6.100` offers the newest feed version within six hours (or 20 s
after it opens): the check is automatic and the installation explicit, as ADR-074
decided. **It cannot install it**, though, which is what the owner reported on
24/09: the click reaches the editor barrier of 1.6.x and stops there (above,
under the 1.1.0 paragraph). Measured the same day on the machine that reported
it: the `1.8.58` feed answers, the `.deb` downloads, its signature verifies
against the key built into `1.6.100` with `minisign -V`, and the plugin's own
format check accepts it — while `journalctl` shows no `pkexec` from Tura Notes at
all, against four from two other Tauri applications updating through the same
`pkexec dpkg -i` since 21/09.

**What remains is the acceptance**, which no script infers: an installed upgrade
between two versions on macOS, AppImage, deb and rpm, and confirming that the
`1.6.1` `.deb` removes the pre-`1.0.0` `notes` package on the machine that still
carries it
([ADR-082](decisions.md#adr-082--the-renamed-package-takes-over-the-one-it-was-renamed-from-and-the-binary-keeps-its-name)).
The feeds are not in step with each other: macOS clients are offered `1.7.21`
while Linux clients are offered `1.8.58`, because each platform is published by
its own build run.

### The 18/09/2026 measurement, kept as the record it is

On 18/09 the Linux feeds were at `1.6.3` and `darwin-aarch64*.json` answered
`404`, and this section listed three things remaining: the download-service
row, the macOS feeds, and the acceptance. The first two have since happened
(the macOS feed was being debugged by `1.7.3`), and this page and the queue
index went on saying they had not, under a stamp that said every row had been
checked. That is what the re-measurement above corrects (R6-34).

A feed that is published and a client that upgrades are not the same claim, and
this page has now been wrong in both directions about that — first claiming
nothing was published when the Linux feeds were, and elsewhere claiming the
artifacts were filed when they were not.
