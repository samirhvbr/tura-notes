# The acts only the owner can perform

> **Status:** `ACTIVE` · Written 17/09/2026 against the scripts as they are, not
> against what the queue says they are. Every command below was read out of
> `tools/sign-server-release.sh` and `.github/workflows/build.yml`; the one
> detail the queue had wrong is called out where it matters. §3 was added at
> `1.6.31`, after an agent had spent a round blaming `sudo` for something `sudo`
> cannot reach.

None of these is something an agent does. One holds a private key that must never
reach this repository or CI; one publishes artifacts; one is a firmware setting on
a machine, which no process running on that machine can change. What an agent
*can* do is make sure the steps are right before you spend an evening on them,
which is what this page is.

---

## 1. Sign the server binary

`server/cotenant/deploy-server.sh` refuses to install a tarball it cannot
verify, so until this is done the deploy changes nothing —
[ADR-081](decisions.md#adr-081--the-server-binary-is-signed-with-a-key-ci-never-holds-and-a-deploy-that-cannot-verify-changes-nothing).
Confirmed today: `server/cotenant/notes-server.pub` does not exist yet.

> **23/09/2026 — the once-ever half is done.** The public key was committed in
> `1.7.1` on 18/09, and `1.7.0` carries `notes-server-1.7.0-x86_64-linux.tar.gz.minisig`
> — checked on the Release, not assumed. The sentence above was true when it was
> written and stayed on this page for five days after it stopped being true, on the
> page an agent reads to decide what is the owner's. **What recurs is the
> per-release step below, once per minor: the next one to sign is `1.8.0`.**

### Once, ever: generate the pair

```bash
tools/sign-server-release.sh init
```

It writes the private half to `~/.config/tura-notes/notes-server.key` (mode
`0600`, directory `0700`) and the public half to
`server/cotenant/notes-server.pub`. Override the private location with
`TURA_SERVER_KEY` if you keep keys elsewhere.

**It refuses rather than overwriting either half**, and that refusal is the whole
safety of the step: regenerating over a key in use silently invalidates every
signature already published, and the symptom appears on a host that is serving.

Then two things, in this order:

```bash
git add server/cotenant/notes-server.pub
# commit it with the usual X.Y.Z subject; the deploy verifies against this file
```

Back up the **private** half somewhere outside the tree. It is not in git by
design and it is not in CI by design: it is a separate key from the updater's,
because the updater's ships inside every installed desktop application, and one
key that pushes both desktop updates and server binaries is one compromise with
two blast radii.

### Per release: sign

```bash
tools/sign-server-release.sh 1.6.0
```

**Only `X.Y.0` is accepted, and this is where the queue was wrong.** It said
"sign the current version"; the script refuses anything that is not a minor,
because attachments are built on minor releases only (ADR-036) and a patch
Release carries none. At the time of writing the version to sign was **1.6.0** (23/09: `1.7.0` is signed; the next is `1.8.0`),
whose `notes-server-1.6.0-x86_64-linux.tar.gz` and its `.sha256` are both
attached — checked, not assumed.

What it does, in order, and why the order is the point:

1. Downloads the tarball and its `.sha256` from the Release.
2. **Verifies the checksum before signing.** Signing a truncated download
   publishes a valid signature over wrong bytes, which is worse than not signing:
   it passes the deploy's verification and installs a binary that does not run.
3. Signs with the private half.
4. **Verifies against the committed public half**, not against the key that just
   signed. This is what catches the wrong pair — an old key, a restored backup —
   here rather than on a host that is serving.
5. Uploads `…​.minisig` to the Release.

Prerequisites, both present on this machine: `minisign` and `gh`.

---

## 2. Recover the 1.4.0 attachments

`1.4.0` has **zero** attachments; `1.5.0` and `1.6.0` have fourteen each —
measured, and the queue item was corrected at 1.6.3 because it named the wrong
release. While 1.4.0 stays empty, `deploy-server.sh` derives `X.Y.0` and would
fetch a file that is not there.

The cause is fixed at 1.5.5: the cancelling concurrency moved down to the jobs
and is keyed by version, so a minor is no longer cancelled by the push that
follows it. What is left is recovering what was already lost.

```bash
gh workflow run build.yml --repo samirhvbr/tura-notes -f version=1.4.0
```

The `version` input exists for exactly this and defaults to `version.md` at
`HEAD` when omitted — which is **not** what you want here, so pass it.

Then confirm, rather than assuming the run implies the artifacts:

```bash
gh release view 1.4.0 --json assets -q '.assets | length'   # expect 14, not 0
```

---

## 3. Turn SVM back on in the firmware — superseded

> **23/09/2026 — no longer the way forward.** The owner decided that milestone 0.4
> runs on the MacBook and on a physical Android device
> ([ADR-092](decisions.md#adr-092--milestone-04-is-exercised-on-the-macbook-and-on-a-physical-android-device)):
> on Apple Silicon the Android emulator needs no KVM at all. The steps are §4 below.
> This section stays as the record of why this machine could not run the
> emulator, and it still works if anyone ever wants it to.


Milestone 0.4 has compilation evidence and no execution evidence, and the reason
is one disabled bit. The x86_64 Android emulator requires KVM; `/dev/kvm` does
not exist on this machine; and it does not exist because `kvm_amd` cannot load.

**It is not a module that was never loaded, and it is not a missing group.** The
kernel says so twice, and both lines are in the current boot's journal:

```
set 16 11:23:21 samirb3 kernel: SVM disabled (by BIOS) in MSR_VM_CR
set 17 16:06:12 samirb3 kernel: kvm_amd: SVM not supported by CPU 1
```

The first is the boot noticing the firmware set `SVMDIS` in `MSR_VM_CR`; the
second is `modprobe kvm_amd` being refused by a CPU that, from the kernel's side
of that bit, does not have the feature. The corroborating measurement is that
`svm` is **absent from `/proc/cpuinfo`** on an AMD Ryzen 9 5900X, which is the
one place it would always appear if the firmware allowed it.

`sudo` cannot reach this. `MSR_VM_CR.SVMDIS` is locked by the firmware until the
next reset, so there is no privileged command that clears it from a running
system — which is exactly why this belongs on a page of acts only the owner can
perform, at a keyboard, before an operating system exists.

**On this board — ASUSTeK TUF GAMING X570-PLUS_BR, BIOS 5043:** reboot, `Del` for
UEFI, `F7` for Advanced Mode, then **Advanced ▸ CPU Configuration ▸ SVM Mode ▸
Enabled**, `F10` to save. Two things then follow on their own: `kvm_amd` loads at
boot and `/dev/kvm` appears.

Then one command, which *is* `sudo` and is the only part that ever was:

```bash
sudo usermod -aG kvm "$USER"   # log out and back in for the group to take effect
```

Confirm before handing it back, rather than assuming the reset took:

```bash
ls -l /dev/kvm && id -nG | tr ' ' '\n' | grep -x kvm
```

**What this unblocks:** the emulator boots, the generated Android application can
be installed on it, and 0.4 gets its first evidence that the thing *runs* rather
than merely compiles — the open row in
[ACCEPTANCE-0.4.md](ACCEPTANCE-0.4.md).

---

## 4. Run milestone 0.4 on the MacBook

[ADR-092](decisions.md#adr-092--milestone-04-is-exercised-on-the-macbook-and-on-a-physical-android-device)
moves the mobile milestone here. **This section is written, not run:** no agent
on the Linux machine reaches the Mac, so every command below is the documented
path and none of it is evidence yet. The first run of it is what turns
`MOBILE-0.4.md` from a contract into something observed.

Why the Mac works where the Linux machine did not: on Apple Silicon the Android
emulator runs `arm64-v8a` system images through Hypervisor.framework, with no
KVM involved, and the iOS Simulator ships with Xcode.

### Once: the toolchains

```bash
xcode-select --install                      # and Xcode itself, from the App Store
brew install openjdk@17 node rustup
brew install --cask android-commandlinetools
rustup-init -y
rustup target add aarch64-linux-android armv7-linux-androideabi \
                  i686-linux-android x86_64-linux-android \
                  aarch64-apple-ios aarch64-apple-ios-sim
```

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
sdkmanager --sdk_root="$ANDROID_HOME" \
  "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" \
  "ndk;27.2.12479018" "system-images;android-35;google_apis;arm64-v8a"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
avdmanager create avd -n tura -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_6
```

`compileSdk` is 36 and `minSdk` 24 in `apps/notes-app/src-tauri/gen/android`,
so any image from API 24 up is valid; 35 is the one this page names so that two
runs compare. Put the two `export` lines in the shell profile.

The NDK version is likewise a choice made here so runs compare, not a
requirement: CI builds the Android core with whatever NDK the runner carries
(`ANDROID_NDK_LATEST_HOME` in `ci.yml`), so a different recent NDK that
`sdkmanager --list` offers is fine — write down which one was used.

### Android: emulator, then the physical device

```bash
cd apps/notes-app && npm ci
emulator -avd tura &                        # wait for the home screen
npm run tauri -- android dev                # builds and installs on the running emulator
```

For the physical device: enable *Developer options* and *USB debugging* on the
phone, connect it, accept the fingerprint prompt, and check it is seen before
running the same command:

```bash
adb devices                                 # the phone must be listed as "device"
npm run tauri -- android dev
```

### iOS: the project has to be generated first

`gen/apple` does not exist in the repository yet — `tauri ios init` only runs on
macOS. Generate it once, **commit what it creates**, then run on the Simulator:

```bash
npm run tauri -- ios init                   # creates src-tauri/gen/apple — commit it
npm run tauri -- ios dev                    # picks a Simulator
```

A physical iPhone additionally needs an Apple development team set in Xcode
for signing; the Simulator does not.

### What to record, and where

The rows are in [ACCEPTANCE-0.4.md](ACCEPTANCE-0.4.md). The first observation
that matters is the one `MOBILE-0.4.md` names: a device that opens a folder,
lists it, writes a note, and survives having its permission revoked while the
app is open. Anything that fails on the way — a toolchain version, a command
that does not exist under that name — is a correction to this page, not a
workaround to remember.

---

## 5. Leave 1.6.x by hand, once

A Tura Notes from `1.1.0` to `1.6.x` finds every update and cannot install one:
its installer stops at the editor barrier that `1.7.0` fixed, and the fix cannot
reach the copy whose installer is broken ([updater.md](updater.md)). The machine
that reported it on 24/09 runs the `.deb` of `1.6.100`. What the agent checked
that day, so none of it needs checking again: the feed offers `1.8.58`, the
package downloads, and its signature verifies with `minisign -V` against the key
built into `1.6.100`.

Close Tura Notes, then:

```sh
curl -fLo /tmp/TuraNotes_1.8.58_amd64.deb \
  'https://samirhv.com.br/updates/tura-notes/1.8.58-linux-x86_64-deb-ade9beeaddbf18bc-TuraNotes_1.8.58_amd64.deb'
sudo apt install /tmp/TuraNotes_1.8.58_amd64.deb
```

`apt` rather than `dpkg -i`, so a dependency the new build needs is fetched
instead of left half-configured. `dpkg -s tura-notes | grep Version` then says
`1.8.58`, and so does **About Tura Notes** in the application menu. The next update after that is the in-app one, and the
first one to install through the fixed barrier is the acceptance `updater.md`
asks for — record it there.

---

## 6. Run the Windows intermittent on a Windows machine

`received_bytes_remain_pending_until_explicit_application`
(`crates/notes-sync-client/src/control.rs`) sees three entries in the peer's log
where every other platform sees four, on Windows only and not every time. The
note created while `capture_new` is on is not captured, and nothing says why. It
has been `#[cfg_attr(windows, ignore)]` since 1.5.0. The owner chose, on 24/09,
to run it on a Windows machine rather than through a diagnostic pull request.

Since 1.8.65 the assertion that fails prints every reason the capture can have
for taking nothing: pending publications, a capture in progress, how far the
application got, and each file in the inventory with the note it matched, if
any. One failing run names the guard.

Once, on the Windows machine: [rustup](https://rustup.rs) with the default MSVC
toolchain (it offers the Visual Studio Build Tools if they are missing), and Git.
Then, in PowerShell:

```powershell
git clone https://github.com/samirhvbr/tura-notes
cd tura-notes
# It is intermittent: twenty runs, stopping at the first failure.
1..20 | ForEach-Object {
  cargo test -p notes-sync-client --lib received_bytes_remain_pending_until_explicit_application -- --include-ignored 2>&1 | Tee-Object -Variable out | Out-Null
  if ($LASTEXITCODE -ne 0) { $out | Out-File windows-r7-09.txt; "failed on run $_"; break }
  "run $_ passed"
}
```

The first run compiles for a few minutes; the rest take seconds. If a run fails,
paste `windows-r7-09.txt` into the chat or onto the board. If twenty pass, say
so: that is a measurement too, and the machine and the Windows version go with
it (`winver`).

---

## What none of these is

None is acceptance. A signed binary, a recovered attachment and a booting
emulator are preconditions for a walk, not evidence of one — no acceptance in
this repository is inferred from a command succeeding, which is written into
`.continue/README.md` and holds here too.
