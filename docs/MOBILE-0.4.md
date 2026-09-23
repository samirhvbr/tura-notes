# The Android folder adapter

> **Status:** `PROPOSED` · Milestone 0.4 · Nothing below is built. It moves to
> `ACTIVE` when an adapter exists and a device has run it. The remaining scope
> and the owner checks live in [ACCEPTANCE-0.4.md](ACCEPTANCE-0.4.md); this page
> is the contract the adapter is measured against, and it exists because that
> list names SAF in one bullet and says nothing about what it must do.

[ADR-008](decisions.md#adr-008--desktop-first-mobile-at-milestone-04-behind-the-same-abstraction)
put mobile behind `FileSystem` from 0.1 for exactly this moment: *"a folder the
user chose" is a desktop concept, and iOS in particular has no equivalent — the
adapter is what absorbs that*. This page is that absorption, written down for
Android before any of it is written in code.

## What the trait already asks for

`notes_fs::FileSystem` is ten methods, and the adapter owes all ten against a
Storage Access Framework tree instead of a path: `caps`, `list`, `read`,
`write_atomic`, `create_new`, `create_dir`, `rename`, `delete`, `stat`, `watch`.

Two of them already carry mobile in their contract, which is worth saying because
it means the trait does not need widening:

- `watch` returns a [`Watch`] carrying a `degraded` reason **instead of failing**,
  and its own documentation names "a SAF tree `[0.4]`" beside a network mount as
  the case it was shaped for. Not being able to watch is a state of the
  workspace, not an error.
- `delete` returns `DeleteOutcome`, and `Caps::LOCAL.trash` is already `false` on
  Android, so a mobile delete reports `Permanent` and says so. That shipped with
  the foundation at 0.17.0.

## The part that does not map, and what it costs

**`write_atomic` is the hard one, and pretending otherwise is how this milestone
would ship a lie.** On a filesystem it writes a temporary file beside the target,
fsyncs, and renames over it; the rename is atomic and the note is never half
written. SAF has no such rename. `DocumentsContract` can create, delete and move
a document, and a provider may implement `moveDocument` or refuse it — a cloud
provider commonly refuses.

So the adapter must not claim what it cannot do. **`Caps::atomic_replace`
already exists** — this page said it would have to "grow a flag", which was
wrong, and checking before writing the adapter is what found it. `LocalFs`
answers `true` on every platform, because a path on Android is still a path; it
is the SAF tree that cannot, and it reports that per tree.

`notes-core`'s sync path has gated on the flag since before this page existed, in
three places. What did **not** exist was anybody telling the user, which this
page had promised: from 1.6.17 a workspace whose backend answers `false` opens
with a banner saying that saving still refuses to overwrite an outside change,
and that what it cannot promise is a whole note after a crash mid-save.

The `expect: Option<&BaseRev>` half still works and still matters: re-read,
hash, compare, refuse on mismatch. It is the divergence check, not the atomicity,
and SAF can honour it.

## Identity, revocation and a document that moved

**A document URI is not a path, and that is an advantage here.** SAF hands out a
stable document id that survives a rename or a move inside the tree, which is
exactly the identity
[ADR-005](decisions.md#adr-005--sync-is-out-of-the-mvp-but-the-file-identity-model-is-not-foreclosed)
forbids deriving from path plus `modified_at`. The adapter keeps the tree URI and
resolves paths through it, and correlation uses the document id the way
`NativeId` already does on Windows and Unix.

**Authorization is persisted and can still be withdrawn.** `takePersistableUriPermission`
survives a reboot; it does not survive the user revoking it in system settings, the
provider app being uninstalled, or the backing account being removed. Every one of
those must read as `CoreError::Unavailable` with a reason the interface can show —
never as an I/O failure, and never as an empty workspace, which is the dangerous
one: a workspace that lists zero notes because permission vanished looks exactly
like a workspace the user emptied.

**A provider can be offline.** Cloud-backed trees answer slowly or not at all.
That is `Degraded`, the same as a watch that cannot start, and it must not block
opening.

## Polling, and its budget

Without inotify there is no watch. `Watch::none(Degraded::…)` is the honest
answer, and the acceptance list asks for *budgeted* polling rather than a loop:
a poll costs a provider round trip, and on a metered connection or a large tree
an unbudgeted one is a battery and data bill the user did not agree to. The
budget belongs in the adapter, reported through the same `Degraded` reason, so
the interface can say "checking every N seconds" rather than implying live
updates it does not have.

## How this gets verified, and why none of it is verified yet

An emulator or a device. There is neither on the machine this was written on —
no AVD, no attached device — so every line above is a contract and none of it is
evidence.

**23/09/2026 — where it gets verified moved.** Per
[ADR-092](decisions.md#adr-092--milestone-04-is-exercised-on-the-macbook-and-on-a-physical-android-device),
the emulator and the Simulator run on the MacBook and the physical device is an
Android phone over USB; the steps are [OWNER-ACTS.md §4](OWNER-ACTS.md#4-run-milestone-04-on-the-macbook).
The iOS project (`gen/apple`) has to be generated there first. The Android core already cross-compiles for all four ABIs in CI since
1.6.12, which is compilation evidence and nothing more.

The first thing that would make this page `ACTIVE` is a device that opens a tree,
lists it, writes a note, and survives having its permission revoked while the app
is open.
