# Acceptance — milestone 0.6 (Sync)

> **Status:** `ACTIVE` · The contract delivered through `0.20.20` is recorded in
> [SYNC-0.6.md](SYNC-0.6.md). This is the acceptance that remains, and it is
> the whole of what [`.continue/0.6-sync.md`](../.continue/0.6-sync.md) still
> lists: *percorrer o fluxo em builds instaladas e em dispositivos físicos;
> registrar somente comportamento observado.*
>
> **Nothing here is ticked, and a box is not ticked by whoever built it.** A step
> becomes `verified` when the owner has walked it **in installed builds on two
> machines** and then **repeated it on the following release**. The cloud
> deployment answering `healthz` is not acceptance — that was settled when the
> item left the queue on 16/09/2026, and it is why this page exists at all: no
> acceptance in this repository is inferred from a command succeeding.

**This walk needs two machines and one server.** One machine is enough for
exactly none of it: every claim below is about what the *second* machine sees,
and a folder synchronized with itself proves nothing. The server is the one from
[ACCEPTANCE-0.5.md](ACCEPTANCE-0.5.md), and §2 of that walk — the backend port
not publicly exposed, the credential refused without `X-Forwarded-Proto: https`
— comes **first**. Sync inherits that boundary; it does not re-establish it.

**The mobile half of "physical devices" is not walkable yet, and that is not a
gap here.** 0.4 has produced compilation evidence and no installable
application; until it does, the device rows of this walk have nowhere to run.
That is tracked in [ACCEPTANCE-0.4.md](ACCEPTANCE-0.4.md), not deferred quietly
in this one.

---

## 0. Before the first box

Three things the owner provisions, none of which the application will create for
itself — and the refusal to create them is itself part of what is being accepted:

- [ ] A credential file per machine, issued by the server operator, **outside the
      notes folder**, readable only by its owner (`chmod 600`). The app reads it
      in Rust and the webview never receives token bytes; a file with the wrong
      mode is refused *before anything is sent*.
- [ ] A private queue directory per machine, **outside the notes folder**. It is
      operational state, not notes — [ADR-004](decisions.md#adr-004--notes-holds-only-data-that-can-be-rebuilt-and-must-be-deletable) applies to it.
- [ ] A throwaway workspace on each machine for the destructive steps of §3 and
      §5. Walk this on real notes once and the first delete/edit conflict is a
      bad evening.

---

## 1. Pairing — once per device, with the workspace closed

Expand **Device sync** above the editor.

- [ ] **S1 · Test connection, wrong on purpose first.** `Test connection` takes
      the address, the credential file and the private-address permission, and
      **not** the workspace name — the name is what it exists to discover. Walk
      it four times: a name that does not resolve (*"Nothing answered"*), a
      credential file with the wrong mode (*refused before anything was sent*),
      the address of some other site on the same host (*"Something answered and
      it was not this API"*), and then the real one (*"Connected. The credential
      works."*, naming the workspace, the scope and the permissions). **Four
      different sentences sending you to four different machines is the feature;
      one generic failure would be the bug.**
- [ ] **S2 · The empty Server workspace field fills itself, and a typed one does
      not get overwritten.** Run `Test connection` with the field empty: it is
      filled from the answer. Type a *different* name and run it again: the app
      reports the disagreement — *"The credential is for X, not for what the
      field says"* — instead of silently correcting you.
- [ ] **S3 · Machine A sends to an empty inbox.** Pairing mode **Send local
      folder to empty inbox**, workspace closed. Confirm the pairing, then
      `Transfer now`. Observe on the server that a workspace that was empty now
      holds the notes, and that **machine A's folder is unchanged** — compare it
      against a copy taken before the pairing, byte for byte.
- [ ] **S4 · Machine B receives into an empty folder.** Mode **Receive into empty
      local folder**, pointing at an empty directory. `Transfer now`, and then
      watch what does **not** happen: the status says **Pending**, not *Up to
      date*, and the folder is still empty. Nothing is applied in the background,
      ever. Close the workspace and use **Apply received files**; only then do
      the notes exist on disk.
- [ ] **S5 · Reconcile, on two folders that both already have notes.** Mode
      **Reconcile existing folders** with a preview, on two folders sharing some
      identical files, some with the same name and different content, and some
      unique to each side. In the preview: identical same-path files are linked,
      differing ones appear as conflicts, unique ones are listed as unique, and
      **identical content at two unrelated paths is not merged into one note**.
      Confirming binds the identities; nothing was written before you confirmed.
- [ ] **S6 · Refusal to pair with an open workspace.** Try each mode with a
      workspace open: *"Still needed before pairing: close the workspace"*.
      `Test connection` is the one remote call that **does** run with a workspace
      open — check that it still does, because a diagnostic you cannot run while
      the thing is running is a diagnostic you cannot run.

---

## 2. Transfer — and everything it declines to decide for you

- [ ] **S7 · Automatic transfer is off until you turn it on.** Confirm the fresh
      pairing has **Background transfer** disabled. Enable it, set an interval
      (the field accepts 120–3600 and refuses outside it), and `Save transfer
      settings`. Observe passes happening with the controls collapsed — the
      worker is native and does not need its panel open.
- [ ] **S8 · The power and network gates, provoked rather than read about.**
      Unplug the laptop with *Allow battery use* off: the status becomes
      **Paused: battery power or unknown power status**. Put the machine on a
      metered or unknown connection with *Allow limited or unknown network
      conditions* off: **Paused: network conditions are limited or unknown**. An
      observation older than 45 seconds also pauses — so does an *unknown* one,
      which is the case worth checking deliberately: missing battery APIs must
      not read as AC power.
- [ ] **S9 · Pause is immediate, and honest about the request in flight.**
      `Pause transfer` during an active pass: it cancels between requests without
      waiting for the editor mutex, the schedule stays off across a restart, and
      a request already sent may still land — with its outcome resumable rather
      than lost.
- [ ] **S10 · Offline edits are ordinary files.** Disconnect machine B, edit
      several notes, quit the app, reopen it, reconnect. The edits were never
      anywhere but on disk; a permitted pass captures them. At no point did an
      unsent edit live only in the queue.
- [ ] **S11 · The status words mean different things.** Over one session, see
      **Disabled**, **Offline**, **Pending**, **Syncing**, **Up to date**,
      **Conflict** and **Error** each at least once, and confirm that
      received-but-unapplied never shows as *Up to date*. This is the single
      status most able to lie, and the whole point of the vocabulary.
- [ ] **S12 · A large inbox takes more than one pass, and says so.** With more
      queued than one bounded pass carries (48 transport requests), confirm
      progress is checkpointed: a pass that stops halfway resumes where it
      stopped rather than starting over.

---

## 3. Conflict — the part that exists because no rule is right

Every step here is walked on the throwaway workspaces.

- [ ] **S13 · Same path, both sides edited.** Edit one note on both machines,
      transfer both. Neither wins. The status is **Conflict** and the resolution
      is explicit: choose the file containing the resulting Markdown and the
      resulting path, or choose deletion. **Confirm no timestamp chose anything**
      — the later save has no privilege.
- [ ] **S14 · The earlier bytes survive the resolution.** After staging a
      resolution, find both parents in **Recent history** as retained branches,
      and `Export original bytes` for each. The exports are private, do not
      overwrite, and are byte-identical to what each machine actually had.
- [ ] **S15 · Staging is not applying.** *"Resolution staged. Transfer it, then
      apply the published resolution from history."* Confirm exactly that order:
      the staged resolution is not on disk until it has been transferred and then
      applied from history.
- [ ] **S16 · Recapture without discarding.** Save a newer edit on the receiving
      side after a resolution and use **Recapture newer saved edits**: the newer
      bytes are captured and the earlier branch is still retained.
- [ ] **S17 · Delete against edit, and rename against edit.** Delete a note on A
      while editing it on B; rename on A while editing on B. Both arrive as
      choices, never as an applied outcome — and the restored note lands at the
      **applied receiver path**, not at whatever path the other machine thought
      it had.
- [ ] **S18 · Path collision between unrelated notes.** Two notes of different
      identity claiming one path: *"Path collision: preserve both notes and
      choose distinct paths."* Both are preserved and the UI does not merge them
      for you.
- [ ] **S19 · Attachments referenced by a note.** Transfer a note that references
      an attachment; confirm the bundle arrives, that applying it is guarded the
      same way, and that `Export {path}` gives back the original bytes.

---

## 4. The two claims the whole milestone rests on

These are the boxes to tick last and re-tick on every release, because
everything else is a feature and these two are the promise.

- [ ] **S20 · A note that crossed the network comes back byte-identical.**
      Prepare notes that make this fail loudly if it is going to: CRLF line
      endings, a UTF-8 BOM, a trailing whitespace line with no final newline, an
      emoji outside the BMP, and one file that is not valid UTF-8 at all. Send,
      receive, apply, and run `cmp` on each pair. Not "looks the same" — `cmp`.
      This is [ADR-001](decisions.md#adr-001--markdown-files-on-the-filesystem-are-the-source-of-truth) crossing a wire, and it is the one failure that loses
      somebody's writing rather than inconveniencing them.
- [ ] **S21 · Nothing ever appeared that you did not ask for.** At the end of the
      whole walk, diff each machine's notes folder against what you expected to
      be there. No metadata written into a note, no `.notes/` internals leaked
      into the workspace, no file from the *other* machine's unique set that you
      never confirmed, no queue directory inside the notes folder. A sync that
      adds one file nobody asked for is a sync nobody can trust with a folder.

---

## 5. Maintenance, and the operations that are not in the app

None of these is exposed over HTTP, all of them want the server stopped, and
each has a backup as its first step. Walk them once, on the throwaway workspace,
**before** the day one of them is needed on the real one.

- [ ] **S22 · Retire a device.** `notes-server sync-device-list WORKSPACE` first —
      the rows name the device UUID, its owning credential, whether that
      credential is revoked, and how many receipts it holds. Revoke the owning
      credential, take the backup, then `notes-server sync-retire-device`.
      Confirm it is **refused** while the credential is still active, refused
      while the instance lock is held, refused a second time, and that the other
      device's registration is untouched. The audit records
      `sync_device_retire` with the removed receipt count.
- [ ] **S23 · A returning device is a new device.** After retirement, pair the
      same machine again: it enrols under a new credential and reconciles
      normally. Confirm no note is duplicated by the return.
- [ ] **S24 · Recover a server restored from an older backup.** Pause every
      device schedule and every other publisher first. Restore with the original
      workspace UUID and credentials, then recover through an **unscoped** queue
      as [SYNC-0.6.md](SYNC-0.6.md#explicit-older-server-recovery-02015)
      describes. The failure this prevents is silent, so the walk is the only
      way to know the procedure works before it is needed.
- [ ] **S25 · Reconnect rather than re-initialize.** Simulate the documented
      half-failure: enrollment succeeds and its first fetch fails. Use
      **Reconnect existing queue** on the directory that was created. Confirm the
      queue is reusable and that initializing the same directory a second time is
      refused — that refusal is what keeps a retry from becoming a second device.

---

### The test that cannot be automated

> The owner works on a note on the laptop, closes it, opens the other machine
> the next morning, and finds the note as it was left — without checking a
> status, reading a log, or wondering whether it went through. If any step of
> this walk had to be explained to them a second time, the milestone did not
> close.

☐ — and this one is the owner's alone.

---

## Automated coverage — what the walk does not need to re-prove

Listed so the walk can spend its attention on what only a person can see. None
of it substitutes for an installed-release walk.

| What | Where | Holds |
|---|---|---|
| The causal domain | `notes-sync` | One-sided changes, divergent equal content, stale compare-and-set, explicit two-parent resolution, delete/edit and rename/edit conflicts, path collisions, invalid DAGs, monotonic receipts, state across reopen |
| Real files, not fixtures | `notes-core` process tests | BOM/CRLF/binary notes, byte preservation, stable identity, external rename correlation, rejected populated pairing modes — through actual CLI execution |
| The server inbox | `server/tests/` | Durable queues, bounded bodies, limits, recovery, receipts |
| Device retirement | server tests | Active-owner refusal, stopped-server locking, revoked ownership, another device preserved, repeat refusal, the pruning device count |
| The connection test | `sync_control_probe` | Every check it reports is the one `Remote::connect` performs — `Endpoint::validate`, the credential file checks, the address policy and `decode` are each called from both, so a test cannot approve what the transport would refuse |
| The outcome vocabulary | the frontend build | The probe outcomes are a `Record<SyncProbeOutcome, string>`; a variant added in Rust fails `tsc` instead of rendering its own key |

**What none of it knows:** whether the status the owner reads matches what the
machine is doing, whether a conflict is *resolvable by a person* rather than
merely representable, and whether two real machines with two real folders and one
real network end the day agreeing.

---

## What this milestone does not claim

No end-to-end encryption. No mobile background execution, no OS wakeups, no
execution after the application quits — the worker runs while the process
exists and nothing more. Pairing reconciliation does not enable automatic
bidirectional capture, and no transfer applies a file in the background under
any setting. Retention, the broader two-device cases and the remaining receiver
edge cases stay in [`.continue/0.6-sync.md`](../.continue/0.6-sync.md) until
they are built. Remote MCP is 0.7 and is accepted in its own document.
