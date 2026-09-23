# Decisions (ADR log)

> **Status:** `ACTIVE` · The single, chronological record of decisions taken in
> this repository. Format: Architecture Decision Record.

An ADR records a decision **and the reason it was taken**, so that the next
session does not re-litigate it. A how-to does not argue direction — it links
the ADR.

Numbering is sequential and never reused. A superseded ADR is not deleted: its
status changes to `SUPERSEDED` and it names the ADR that replaced it.

**The four words an ADR may carry are `PROPOSED`, `ACCEPTED`, `SUPERSEDED` and
`REVERSED`, and they are deliberately not the five a document carries.** A
document is `ACTIVE` or `HISTORICAL` because a reader is deciding whether to
build against it *now*; an ADR is `ACCEPTED` because a decision was taken *then*,
and it stays taken even after something replaces it. Using `ACTIVE` here reads as
"this decision is still in force", which is a claim about the code rather than
about the record — and the code is what the ADR is the argument for, not a fact
the status line gets to assert.

Twenty-six ADRs — `043` through `068`, one contiguous block — said `ACTIVE` until
`1.6.49`, and everything on either side of that block said `ACCEPTED`. Normalized
rather than left, for the reason `tools/doc-status.sh` already gives about the
other vocabulary: a second word for one state is a word the reader has to
interpret instead of look up, and `tools/adr-status.py` now fails the gate on a
sixth one.

---

## ADR-001 — Markdown files on the filesystem are the source of truth

**Status:** `ACCEPTED` · 07/09/2026

**Context.** A note-taking app has to store notes somewhere, and the convenient
answer is a database: indexing is trivial, sync is tractable, and the schema is
whatever the app needs this week. The cost is paid later and by the user — their
notes become readable only through the app that wrote them, and "export to
Markdown" is a lossy escape hatch bolted onto a format that was never Markdown.
The alternative, plain files in a folder the user chose, gives up all of that
convenience and buys one thing: the notes remain usable from a terminal, VS
Code, `git`, `rsync`, a backup tool, another editor, or an AI agent writing
straight to disk.

**Decision.** Markdown files on the filesystem are the source of truth. There is
no proprietary storage format at any point. SQLite exists only as an index and
cache, and everything it holds must be rebuildable from the files. Markdown
exists on disk from the first moment — never as an export path from something
else.

**Consequences.** The app must tolerate the filesystem changing underneath it,
which makes external-change detection a requirement rather than a feature. It
must write atomically, because a half-written note is a lost note when the file
is the only copy. Sync becomes harder than it would be over a database, and
milestone 0.6 will pay for that in full. Indexing must be incremental, since
there is no schema to query directly. In exchange, every other decision in this
project becomes cheap to reverse: the app can be rewritten, abandoned or
replaced, and the user's notes are untouched. This is the decision the rest of
the architecture hangs off — see
[architecture-v1.md §1](architecture-v1.md#1-the-layering-rule).

---

## ADR-002 — Tauri 2 with React, TypeScript, Rust and CodeMirror 6

**Status:** `ACCEPTED` · 07/09/2026

**Context.** The product targets five platforms — Linux, macOS, Windows, iOS and
Android. Electron covers three of them and ships a browser to do it: roughly
120 MB per install and a memory floor that is hard to defend for a text editor.
Flutter covers all five with one rendering model, but puts the editor on a
canvas where CodeMirror does not exist, and the whole editing surface would have
to be rebuilt. Native per platform is the best result and several times the
work. Tauri 2 covers all five, uses the system webview instead of shipping one,
and puts the non-UI half of the app in Rust — which matters here because the
non-UI half is filesystem work, incremental indexing and, later, a sync protocol.

**Decision.** Tauri 2 as the shell; React and TypeScript for the interface;
Rust for filesystem, indexing, search and native integration; CodeMirror 6 as
the editor; SQLite as the index.

**Consequences.** The webview differs by platform — WebKitGTK on Linux, WKWebView
on Apple, Android WebView — and that is the recurring tax this choice carries;
CSS and web APIs need testing per platform rather than once. Binaries are around
an order of magnitude smaller than the Electron equivalent, and the Rust core is
reusable by `server/` later without a rewrite. The team needs Rust as well as
TypeScript. CodeMirror 6 rules out a WYSIWYG editor without replacing the editor
layer wholesale — acceptable, because [product.md §15](product.md#15-not-in-the-first-version)
puts full WYSIWYG out of scope anyway.

---

## ADR-003 — The Rust logic lives in `crates/` and the Tauri shell stays thin

**Status:** `ACCEPTED` · 07/09/2026

**Context.** The default Tauri layout puts Rust code in `src-tauri/`, which is
the right place for a single application and the wrong place for this one:
[roadmap.md](roadmap.md) has a self-hosted server at milestone 0.5 that needs the
same domain model, the same index and the same sync protocol as the app. Logic
that grows inside `src-tauri/` gets entangled with Tauri's command layer, and
extracting it later happens under deadline pressure, which is when it happens
badly.

**Decision.** Domain logic lives in workspace crates — `notes-core`,
`notes-fs`, `notes-index`, `notes-sync` — and `src-tauri/` is a thin shell that
exposes Tauri commands and wires them to those crates, holding no business logic
of its own. The repository is a Cargo workspace with `apps/`, `crates/`,
`packages/` and `server/` from the start, even though only `apps/notes-app/`
exists at milestone 0.1.

**Consequences.** More ceremony on day one: a workspace, crate boundaries and
cross-crate types before there is a second consumer to justify them. Crate
boundaries have to be decided early, and a wrong cut costs a refactor. Against
that, `server/` can depend on the core at 0.5 without an extraction, and the
boundary keeps Tauri-specific types out of the domain model — which is also what
keeps the domain model testable without a running app.

---

## ADR-004 — `.notes/` holds only data that can be rebuilt, and must be deletable

**Status:** `ACCEPTED` · 07/09/2026 · **amended** by
[ADR-012](#adr-012--indexdb-lives-in-app-data-not-in-the-workspace) on where
`index.db` is kept. The rule below stands as written; only the location of that
one file changes

**Context.** The app needs somewhere to keep the index, workspace settings and
caches, and the obvious place is a reserved directory inside the workspace. The
failure mode of such a directory is well known: it starts as a cache, something
convenient gets stored there because it has no other home, and eventually
deleting it loses user data. At that point the directory is a proprietary store
living inside a folder that was supposed to be plain Markdown, and
[ADR-001](#adr-001--markdown-files-on-the-filesystem-are-the-source-of-truth) has
been broken without anyone deciding to break it.

**Decision.** `.notes/` holds only auxiliary data — `workspace.json`, `index.db`,
`cache/`. It must never contain the only copy of anything the user wrote.

> **Names, 19/09/2026.** `workspace.json` never shipped under that name. What the
> directory holds is `registry.json`, `session.json`, `settings.json`,
> `recent.json` and `index.db`. The decision is the rule, not the list — *delete
> the directory: does the user lose something they wrote?* — and the rule is
> unchanged. Noted because somebody who goes looking for `workspace.json` will
> not find it, and the original wording stays because an ADR records what was
> decided on the day.
Deleting it must cost a reindex and nothing else. The test for anything proposed
for `.notes/`: delete the directory — does the user lose something they wrote? If
yes, it does not go there.

**Consequences.** Things that would be easy to keep in `.notes/` need another
home or must be derivable from the files: note metadata belongs in YAML front
matter, and per-file sync state has to be reconstructible. A "reindex workspace"
path must exist and stay working, which means it needs to be exercised, not just
implemented. The gain is that the workspace stays a plain folder that survives
the app.

---

## ADR-005 — Sync is out of the MVP, but the file identity model is not foreclosed

**Status:** `ACCEPTED` · 07/09/2026 · **amended** by
[ADR-014](#adr-014--identity-lives-in-the-registry-never-in-the-note-and-the-hash-is-correlation)
on two points of its Decision: identity is never written into a note file, and
the content hash is a correlation signal rather than an identity field. The rest
stands

**Context.** Multi-device sync is at milestone 0.6, four milestones after the
first usable app. The risk is not that it is late; it is that decisions taken now
make it impossible later. The specific trap is identifying a file by its path and
its `modified_at`. Paths change under rename. Timestamps are not a version:
clocks disagree between devices, filesystems round them differently, a restored
backup rewrites them wholesale, and none of that is detectable after the fact.
An app built on path + mtime cannot be given sync later — it has to be rebuilt.

**Decision.** Do not build sync now. Do design the data model so it stays
possible: a file eventually carries `file_id` (stable across renames), `path`,
`revision` (monotonic per file), `content_hash`, `modified_at` (advisory, never
authoritative) and `device_id`. The protocol must account for tombstones,
conflicts, renames, offline modification and history. And the rule that outranks
all of it: **a silent overwrite is a defect, never a conflict resolution** —
both versions survive, whether as `project (conflict iphone).md` or through a
resolution interface.

**Consequences.** The index schema carries fields that nothing reads at
milestones 0.1 to 0.4, and they have to be maintained correctly anyway — an
identity that is only nearly right is worse than none, because sync will trust
it. Generating and preserving a stable `file_id` across renames done by *other*
programs is real work, and the honest answer for a file that vanishes and
reappears may be that it is a new file. The alternative is discovering the whole
problem at 0.6 with an app to rewrite.

---

## ADR-006 — Git is not a dependency, and not a feature in the first versions

**Status:** `ACCEPTED` · 07/09/2026

**Context.** The project was first sketched as a Markdown editor with a public
Git repository attached — the notes would live in a repo, and publishing would
be a native act. Once local-first was settled it stopped fitting: Git as a
dependency means requiring an installed binary or embedding libgit2, plus a
credential story, plus a conflict story — and it is unusable on iOS, where a
whole milestone of the product lives. It would also make the second-simplest
thing a user can do (open a folder that is not a repo) a special case of the
harder one.

**Decision.** The app does not depend on Git and does not integrate with it in
the first versions. Because notes are ordinary Markdown files in an ordinary
folder, a workspace *can* be a Git repository, and the app must not get in the
way — concretely, it tolerates `.git/` in the tree and never touches it. Native
integration is a candidate for later, listed as out of scope in
[product.md §15](product.md#15-not-in-the-first-version).

**Consequences.** Versioning and multi-device use are not solved by borrowing
Git's — they are the job of milestones 0.5 and 0.6, and this ADR is part of why
those exist. Users who want Git keep using Git, outside the app, which works
today and costs the project nothing. The `.git/` directory has to be excluded
from indexing and from the file tree, which is a small explicit rule rather than
an accident of hidden-file filtering.

---

## ADR-007 — The desktop app opens no network port by default

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Milestones 0.5 and 0.7 add an HTTP API and an MCP interface for AI
agents. The convenient implementation is a small server inside the desktop app,
listening locally. That turns every install into a listening service, on
machines whose owners believe they installed a text editor; on a laptop that
joins untrusted networks, a local API with filesystem access is a serious
default to ship silently.

**Decision.** The desktop application opens no network port by default and
initiates no outbound connection for its basic operation. The API and MCP
surfaces belong to **Notes Server**, which the user chooses to run. Any external
integration is explicitly enabled by the user.

**Consequences.** An agent that wants to reach the notes has to go through a
server the user deliberately started — more setup for that user, and the setup
is the consent. A local-only agent mode, if it is ever wanted, needs its own ADR
rather than arriving as a default. In exchange, "local-first" stays literally
true: the app installed and never configured talks to nothing. The normative
statement lives in [security.md](security.md), which wins any conflict with this
log.

---

## ADR-008 — Desktop first; mobile at milestone 0.4, behind the same abstraction

**Status:** `ACCEPTED` · 07/09/2026

**Context.** The product targets desktop and mobile. Building both at once was
considered and rejected on a specific ground rather than on effort: the
workspace model — a folder the user chose, held open, watched for external
changes — is a desktop concept. iOS has no equivalent; the app gets a sandboxed
container or scoped access through the document picker. Android has scoped
storage and the Storage Access Framework. Designing the first version to satisfy
all three at once means the desktop app is worse today for a user who does not
exist yet.

**Decision.** Desktop (Linux, macOS, Windows) at milestone 0.1. Mobile at
milestone 0.4. The `FileSystemAdapter` seam exists from 0.1 with a single
adapter behind it, so 0.4 is an adapter and an interface, not a rewrite. The
mobile interface is adapted to mobile rather than a shrunk desktop.

**Consequences.** Mobile users wait. The abstraction is carried for three
milestones before a second implementation justifies it — accepted deliberately,
with the reasoning recorded in
[architecture-v1.md §4](architecture-v1.md#4-the-filesystem-abstraction) so it is not
"simplified away" by a later reader who sees one adapter behind an interface.
There is a real risk that the seam turns out to be cut in the wrong place when
the iOS adapter is finally written; that is cheaper than a UI written directly
against local paths.

---

## ADR-009 — An item leaves `.continue/` only when it has been built

**Status:** `ACCEPTED` · 07/09/2026 · **Adopted fleet-wide the same day** as
[repodocs ADR-021](https://github.com/samirhvbr/repodocs/blob/master/docs/decisions.md)
— it stopped being local. The rule now arrives here in the `QUEUE-RULE` block of
`CLAUDE.md`, which is regenerated; this ADR stays as the record of where the
decision was made, and the block is the source if the two ever differ

**Context.** The fleet convention says a document moves from queue to record
"the moment it describes something that already exists", and a companion rule
sends any queue item needing more than half a page to `docs/`. Both were
followed at `0.2.0`, and the result is the reason this ADR exists: a 1 338-line
specification for an application with zero lines of code was translated into
`docs/`, deleted from `.continue/`, and the queue then reported nothing open —
on a project where nothing at all had been built. The ambiguity is one word.
"Exists" was read as *the definition* existing; the owner means *the thing*
existing. Under the first reading, writing about a black screen with a yellow
ball makes it exist. Under the second, only the screen does.

The failure is specific to a new project and worst exactly there: on day one
everything is words and nothing is code, so a rule that retires an item once its
text is tidy retires the entire queue. A queue whose job is to list what is
still missing must not lose an entry because someone described the entry well.

**Decision.** In this repository an item leaves `.continue/` when the thing it
describes **has been built and works** — not when it has been documented,
decided, translated or written up. **Size is never a reason to move an item
out**: a specification of any length stays in the queue while its code does not
exist. A decision taken along the way still becomes an ADR in the same pass, and
that ADR does **not** retire the queue item. And nothing leaves `.continue/`
before it has been committed, so that a wrong call costs a `git revert` rather
than a reconstruction from memory.

**Consequences.** This overrides two fleet rules for this repository —
`conventions.md` §1 and the golden rule that sends a half-page item to `docs/` —
and an override that is not written down is not an override, which is what this
ADR is for. The queue will hold large files. `docs/` may hold a document
describing something that does not exist yet; those carry `PROPOSED` rather than
`ACTIVE`, and the queue, not the document, is the authority on intent while both
exist. The cost is real: the same subject can live in the queue and in `docs/` at
once, in two languages, and they can drift. The mitigation is direction — intent
changes in the queue, and `docs/` is updated when the thing is built. If this
rule is right for the whole fleet rather than only here, it belongs in repodocs
`conventions.md`, and this ADR is the argument to take there.

---

## ADR-010 — `.continue/` is written in Portuguese; everything else is English

**Status:** `ACCEPTED` · 07/09/2026 · **Adopted fleet-wide the same day** as
[repodocs ADR-022](https://github.com/samirhvbr/repodocs/blob/master/docs/decisions.md),
which makes it the third carve-out of the English rule rather than this
repository's exception to it. The `LANGUAGE-RULE` block above now carries it

**Context.** The language rule — repodocs `conventions.md` §8, stamped into
`CLAUDE.md` and `AGENTS.md` as the `LANGUAGE-RULE` echo — puts everything in the
repository in English (US), with two carve-outs: end-user-facing strings, and
the Blue3 internal repositories. `.continue/` is in the repository, so it falls
under English. But the queue is where the owner thinks out loud before anything
exists, and a second language is a tax on precisely the part of the work with
the least tolerance for one. It also contributed to the `0.2.0` mistake:
"it is in Portuguese" was part of the case for emptying the queue.

**Decision.** `.continue/` is written in Portuguese. Translation to English (US)
happens **on the way out** — when the thing has been built and its document
lands in `docs/`, per
[ADR-009](#adr-009--an-item-leaves-continue-only-when-it-has-been-built).
Everything else is unchanged and stays English (US): `docs/`, commit messages,
pull request titles and bodies, issues, code comments, changelog entries,
release notes.

**Consequences.** The exception must be written **outside** the `LANGUAGE-RULE`
markers in `CLAUDE.md` and `AGENTS.md`. That block is a marked echo regenerated
from repodocs, so an exception written inside it is erased by the next fleet
pass with nobody noticing — the precedent is `BLUE3-INTRANET`, whose language
exception sits outside the block for exactly this reason. A contributor who does
not read Portuguese cannot read the queue; that is acceptable while the queue is
the owner's own, and it is the trigger to revisit this ADR rather than a cost to
absorb quietly. Translation work concentrates at the moment of production
instead of being spread thin, which is also the moment the material is best
understood — writing it in English is part of checking that it was actually
built.

---

## ADR-011 — Build output is the one `.gitignore` exception beyond secrets

**Status:** `ACCEPTED` · 07/09/2026

**Context.** `.gitignore` in this repository carries a rule with teeth: everything
is versioned, the only exception is a secret, and **any further exception needs
an ADR rather than a silent line**. The rule exists because ignoring a directory
that holds an open question or a verdict has already cost this fleet real work,
and because a line added quietly is a line nobody can argue with later. The first
commit of application code needs `target/`, `node_modules/`, `dist/` and
`.vite/`, and the Tauri build generates `src-tauri/gen/schemas/` on every build.

**Decision.** Build output is ignored, and it is the only category admitted
besides secrets. The test for admitting anything here: it is produced by a
command in this repository, from inputs in this repository, and reproducing it is
running that command. `src-tauri/gen/schemas/` qualifies — `tauri-build` writes it
on every build, and the only thing that reads it is an editor resolving a
`$schema` reference. `icon-source.png` does **not** qualify and stays versioned:
it is the input `tauri icon` consumes, and losing it means the icons cannot be
regenerated.

**Consequences.** A fresh clone does not build without `npm install` and
`cargo build`, which is ordinary and is written in the app's README. The rule
that protects the queue keeps its force, because this exception is argued rather
than assumed — the `.gitignore` line names this ADR, so the next person adding
one can see what the bar was. The risk this accepts is the familiar one: a
generated directory that quietly starts holding something hand-edited stops being
build output while still being ignored. The mitigation is the test above, applied
when the line is added and not after.

**Recorded 15/09/2026 — installer artifacts are inside this exception.** A
`.deb`, `.AppImage` or `.rpm` passes the test above without argument:
`./build-local.sh` produces it, from sources in this repository, and reproducing
it is running that command. The ones a build writes land under `target/` and
were already covered, so the `.gitignore` line added here is for one placed
outside it — which is exactly what `apps/notes-app/notes_0.11.11_amd64.deb` was,
4.2 MB committed at 0.12.0 when artifacts were still attached to the tree, and
still tracked a hundred versions later. Nothing in this repository writes an
installer outside `target/` — which was wrong, and is corrected at 1.1.12:
`makepkg` builds the Arch package inside `packaging/aur/notes-bin/`, and
`.github/workflows/build.yml` installs it from that path. The scoping by format
rather than by path still holds, for the reason that accident shows: a
path-scoped rule would have guarded one directory and missed the other. The file is untracked from 1.1.10;
the blob stays in history, which is the point of history and is not something
`git rm --cached` claims to change.

---

## ADR-012 — `index.db` lives in app data, not in the workspace

**Status:** `ACCEPTED` · 07/09/2026 · amends
[ADR-004](#adr-004--notes-holds-only-data-that-can-be-rebuilt-and-must-be-deletable)

**Context.** ADR-004 established that `.notes/` inside the workspace holds only
data that can be rebuilt and must be safe to delete, and it listed `index.db`
among the files living there. The rule is right. The example is not, for a reason
that has nothing to do with whether the file is rebuildable.

A workspace is a folder the user chose, and users put those folders inside
Dropbox, iCloud Drive, OneDrive, Nextcloud and Syncthing. Those tools copy files
whenever they change, with no knowledge of transactions. **An active SQLite
database copied mid-transaction does not produce a stale database — it produces a
corrupt one**, and on the sync provider's side that corruption becomes the
version other devices download. The database being rebuildable is exactly why
nobody would notice: the app would reindex, the provider would copy again, and
the loop would repeat with no error the user could act on. A `-wal` file copied
without its main database, or after it, is the same failure with a different
name.

**Decision.** `index.db` and every other derived cache live in app data, per
workspace, outside the folder the user chose. `.notes/` inside the workspace
remains what ADR-004 made it: optional, deletable, and holding nothing whose loss
costs the user a note — portable configuration the user switches on, never the
index.

**Consequences.** The index no longer travels with the folder: copying a
workspace to another machine copies the notes and leaves the index behind, and
the second machine reindexes. That is the correct outcome and cheaper than
shipping a database written by a different build. Deleting `.notes/` no longer
removes the index, so "delete `.notes/` to force a reindex" is not the recovery
path — a reindex command is, and it has to exist and be reachable. The app now
keeps per-workspace state the user cannot see from their file manager, so where
it lives has to be discoverable rather than folklore. ADR-004's test is untouched
and still applies to everything proposed for `.notes/`: delete it, and if the
user loses something they wrote, it never belonged there.

---

## ADR-013 — The crate set, and when each one is created

**Status:** `ACCEPTED` · 07/09/2026 · extends
[ADR-003](#adr-003--the-rust-logic-lives-in-crates-and-the-tauri-shell-stays-thin)

**Context.** ADR-003 put the Rust logic in `crates/` and left the set open.
Building it out invites the opposite failure: crates created early, empty, "so
the structure is there", which are then refactored before they have a consumer
to constrain them.

**Decision.** `notes-model` (types, no I/O), `notes-fs` (the `FileSystem` trait,
`LocalFs`, the root jail, the atomic write), `notes-core` (`WorkspaceService`)
at 0.1a; `notes-markdown` at 0.1b, `notes-index` at 0.2, `notes-mcp` at 0.3,
`notes-sync` at 0.6. **No crate exists before the milestone that uses it.**
`notes-model` depends on nothing that does I/O — the rule that makes the write
protocol testable against a fake filesystem.

**Consequences.** `notes-markdown` is absent at 0.1a and front matter survives
anyway, through the byte policy rather than a parser — which is the evidence the
rule was right. The cost is that a crate boundary is decided when its first
consumer appears rather than in advance, so a wrong cut is found later; against
that, a boundary drawn with a consumer in hand is drawn from evidence.

---

## ADR-014 — Identity lives in the registry, never in the note, and the hash is correlation

**Status:** `ACCEPTED` · 07/09/2026 · amends
[ADR-005](#adr-005--sync-is-out-of-the-mvp-but-the-file-identity-model-is-not-foreclosed)

**Context.** ADR-005's Decision reads "a file eventually carries `file_id` …
`content_hash` …", which can be read as the file carrying them — and lists the
hash among the identity fields. Both readings have to be closed before sync is
built, and closing them separately would amend ADR-005 twice for one subject.

**Decision.** A `NoteId` lives in the app's registry and, later, on the server.
**Nothing is ever written into a `.md` file** — not a front-matter `id:`, not at
0.1a, not when sync is enabled at 0.6. And **the hash is not identity**: an
external rename reconnects a `NoteId` only on a unique native-id match or a
unique non-empty-hash match. Zero-byte files are never correlated by hash, and
any ambiguity yields a new id. Re-identifying is cheaper than attaching a note to
the wrong history.

**Consequences.** Copying a workspace folder produces a second workspace with new
ids, and reconnecting to a server is an explicit flow rather than something that
happens by itself. A user who wants portable identity across machines does not
get it from the file, and if that is ever wanted it is a separate opt-in feature
with the user told their files will change. In exchange the promise that the app
never writes what the user did not type survives contact with sync, which is the
milestone at which most note applications break it.

---

## ADR-015 — The registry is operational state, and moves to its own database at 0.2

**Status:** `ACCEPTED` · 07/09/2026

**Context.** The identity registry and the search index are both derived-looking
files that live outside the workspace, and treating them alike is the mistake:
the index is rebuildable from the notes, the registry is not. From 0.3 a second
process (`notes-mcp`) updates the registry, and a JSON read-modify-write between
two processes has no story better than a lock held for the whole file.

**Decision.** The registry is **operational** state: it has retention and
migration rules and no cleanup touches it. JSON at 0.1, moving to `registry.db`
— a SQLite file **separate from `index.db`** — at 0.2, so "delete the index" can
never touch identity. The `index.db` location is already
[ADR-012](#adr-012--indexdb-lives-in-app-data-not-in-the-workspace) and is not
re-decided here.

**Consequences.** Two database files instead of one, with two schemas and two
migration paths. The JSON at 0.1 is rewritten whole on every change, which is
O(n) in the number of notes ever opened — acceptable while nothing consumes a
`NoteId`, and the reason the move at 0.2 is stated as mandatory rather than
conditional.

---

## ADR-016 — One data directory, resolved by the core

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Tauri offers `app_data_dir()`, and using it is the obvious choice
for an application built on Tauri. `notes-mcp` is not: from 0.3 it runs as a
stdio process with no Tauri and no window, and it reads and writes the same
registry.

**Decision.** `notes-core` resolves the directory itself —
`dirs::data_dir()/notes`, overridable by `NOTES_DATA_DIR`. Tauri's
`app_data_dir()` is not used.

**Consequences.** The bundle identifier no longer determines where state lives,
so changing it does not strand anyone. `NOTES_DATA_DIR` is what makes the whole
service testable without touching a developer's real notes, and it is what
"portable install" will mean later. The cost is one more thing that must agree
across processes, stated in one function rather than assumed twice.

---

## ADR-017 — Cross-process coordination is an advisory lock, per workspace

**Status:** `ACCEPTED` · 07/09/2026

**Context.** From 0.3 the app and `notes-mcp` write to the same files. Using the
same crate does not share a lock; the lock has to be in the filesystem. A pid
file is the usual reach, and it leaves a stale lock behind whenever a process
dies badly — which is exactly when it matters.

**Decision.** `write.lock` in the workspace's app-data directory, taken with an
OS advisory lock (`flock` / `LockFileEx`), one per workspace, guarding the
*stat → compare → replace* sequence and the registry update and nothing else.
Timeout 5 s, then `LockTimeout`, handled as a write failure — a draft is written
and the user is told. **There is no stale-lock problem by construction**: the
kernel releases an advisory lock when its holder dies. It exists from 0.1a, when
there is one process, so the protocol is exercised before a second arrives.

**Consequences.** One lock per workspace rather than per note serialises two
concurrent saves to different notes; hold time is milliseconds and simplicity
wins. **The lock coordinates our processes only** — a third-party editor does not
take it, and its writes are caught by the base-rev check instead. The scope does
not promise mutual exclusion with the rest of the system, and this ADR does not
either.

---

## ADR-018 — Preview crosses the IPC as sanitised HTML; outline and links as a slim document

**Status:** `ACCEPTED` · 07/09/2026 · applies from 0.1b

**Context.** The preview needs rendered Markdown in the WebView. Sending an AST
and rendering in JavaScript would put a Markdown parser in the frontend, and
sanitisation with it — inside the process that a malicious note is trying to
reach.

**Decision.** `notes-markdown` renders to HTML and `ammonia` sanitises it in
Rust; that HTML crosses the IPC. A slim `Document` — headings, links, tasks,
spans — crosses for outline and link work. The full AST does not, and the
frontend contains no Markdown parser.

**Consequences.** Sanitisation happens at one boundary, in one language, and can
be tested against `fixtures/xss/` without a browser. Interactive preview features
that would want the AST client-side have to ask the core instead, which is a
round trip. Front matter preservation is not this crate's job at all — the byte
policy keeps it intact because nothing rewrites the buffer.

---

## ADR-019 — Symlinks and junctions are not traversed

**Status:** `ACCEPTED` · 07/09/2026

**Context.** A symlink is a well-formed relative path that resolves somewhere
else, which makes it the one way a validated `RelPath` can leave the workspace.
Following them also makes the tree potentially infinite and identity ambiguous —
two paths, one file.

**Decision.** They appear in the tree marked as what they are and **do not
open**. Every path is resolved segment by segment and a symlink anywhere along
the way is refused, on every call rather than at open time. Following them is
opt-in, later, with its own ADR.

**Consequences.** A user who organises a workspace with symlinks finds them
inert, and the tree shows why rather than hiding them. The check costs a
`symlink_metadata` per segment per operation, which is a stat and is not
measurable against the read that follows.

---

## ADR-020 — One Tauri command per operation, with types generated by `ts-rs`

**Status:** `ACCEPTED` · 07/09/2026

**Context.** A single typed `dispatch(Request) -> Response` would put every
cross-cutting concern in one place and would let `notes-mcp` reuse the envelope.
Tauri's capability system is per command.

**Decision.** One command per operation. Types cross as `serde` JSON and `ts-rs`
generates the TypeScript for every one of them into
`apps/notes-app/src/ipc/generated`, which is committed; **CI regenerates it and
fails on any diff.** The frontend never hand-writes an IPC type.

**Consequences.** The argument that settles it is the capability: permitting
`dispatch` permits `delete`, and there is no way to grant half of it — a single
command would be a switch for the filesystem. The cost is many command names to
register and list. Generating the types caught a defect a Rust-only test could
not have: a nanosecond `mtime_ns` sent as a JSON number is silently rounded by
JavaScript and comes back wrong in the next `BaseRev`.

---

## ADR-021 — Autosave and the base-rev guard ship together

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Autosave is a 0.1a feature and conflict detection reads like a sync
problem, so shipping autosave first and the guard later is the natural
sequencing. It is also the sequencing that loses data: the moment autosave
exists, the app is writing to files that VS Code, a script or an AI agent may be
writing at the same time, and without the guard it overwrites them.

**Decision.** They ship in the same milestone. Every write compares a `BaseRev`
before replacing; a divergence suspends autosave for that note, snapshots the
buffer to a draft, and writes nothing. Drafts and conflict copies are operational
data with retention rules and are **never deleted as cache**.

**Consequences.** 0.1a carries machinery that looks like sync infrastructure long
before sync — and it is the rehearsal for it. Storage that cannot replace
atomically has to say so rather than pretend. The user-facing cost is a note that
stops autosaving until they resolve it, which is the correct behaviour and has to
be visible: it is why the status bar has seven states rather than two.

---

## ADR-022 — The WebKitGTK dmabuf workaround is applied automatically on Wayland with NVIDIA

**Status:** `ACCEPTED` · 07/09/2026 · **amended** by
[ADR-033](#adr-033--the-dmabuf-workaround-keys-on-the-nvidia-driver-not-on-the-display-server):
the Wayland half of the condition was wrong. WebKitGTK uses the DMA-BUF renderer
on X11 too, the fault is in NVIDIA's GBM rather than in a compositor, and
requiring Wayland cost a window on X11. Everything else below stands

**Context.** WebKitGTK on Wayland with the NVIDIA driver has a long history of a
black or flickering window. The mitigation —
`WEBKIT_DISABLE_DMABUF_RENDERER=1` — must be set before the WebView is created,
and telling users to export a variable means the first experience of the
application is a black window.

**Decision.** Detect Wayland and an NVIDIA driver at startup, before
`tauri::Builder`, and set the variable. Unconditional at 0.0, since `settings.json`
belongs to 0.1a; gated from 0.1a by `settings.linux.webkit_dmabuf_workaround`
(`auto` / `off` / `force`), where **a missing or unreadable settings file
degrades to `auto`, never to `off`**. A value already in the environment is never
overridden.

**Consequences.** Slightly slower compositing for users who did not need it, in
exchange for a window that renders. The degrade direction is chosen from the
asymmetry of the failures: not applying it yields a black window, applying it
needlessly costs a little performance. The decision is a pure function of its
inputs so the case the developer's machine cannot produce is covered by a test.

---

## ADR-023 — Arch Linux is a release target, with its own CI job

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Arch is rolling. `webkit2gtk-4.1` moves without warning, and a build
that passes on Debian stable says nothing about it. The owner develops on Arch.

**Decision.** Arch is a release target, distributed through the AUR
(`notes-bin` from the release tarball, `notes-git` optional), and CI runs a job
in an `archlinux:latest` container against the current `webkit2gtk-4.1`.

**Consequences.** Upstream breakage surfaces in CI before it reaches a user, and
a red Arch job on a green Debian one is information rather than noise. The cost
is a CI job that can fail for reasons outside the repository, which is the point
and must not be treated as flakiness to be muted.

---

## ADR-024 — No unsigned macOS or Windows artefact is published

**Status:** `ACCEPTED` · 07/09/2026

**Context.** An unsigned Windows build trips SmartScreen and an unsigned macOS
build is refused by Gatekeeper. Both produce a first run that looks like the
application is malware, and the workaround taught to get past them is the same
one an actual attacker needs the user to learn.

**Decision.** macOS artefacts are signed with a Developer ID and notarised;
Windows artefacts are signed with an OV certificate. **No unsigned artefact is
published** for either. Linux artefacts (`.deb`, AppImage, AUR) need no signature
and are published without one.

**Consequences.** An Apple Developer account and a code-signing certificate are
prerequisites of the first macOS and Windows releases — cost and lead time, not
engineering. Linux ships before them, which matches where the project is
developed. Secrets live in CI secrets and never in the repository.

---

## ADR-025 — The preview corpus is a golden corpus, and blessing is not accepting

**Status:** `ACCEPTED` · 07/09/2026

**Context.** `fixtures/xss/` shipped at 0.1a with a README calling each file "an
assertion, not a sample", and nothing read it for a whole milestone. A corpus
nobody executes is a comment. The question at 0.1b was what "executing" it
should mean, and there are two answers with different failure modes: exact
output files, which can freeze a bug as a decision if regenerated carelessly,
and property assertions, which cannot say whether the renderer produces *the
right* HTML.

**Decision.** Both, for the two things they are each right for.
`fixtures/markdown/` holds an input, its exact expected HTML and its exact
expected `Document`, compared **byte for byte with no normalisation**;
`NOTES_BLESS=1` regenerates them, and **the diff is read against a written
contract before it is committed** (`fixtures/markdown/README.md`, one row per
file). `fixtures/xss/` asserts *properties* — structurally, on tags and
attributes read back out of the sanitized output — because a sanitizer is
specified by what cannot survive it, and because `safe-in-code.md` must render
`javascript:alert(1)` as text, which a substring ban would forbid.

**Consequences.** The reading is not ceremony: the first one caught four
defects, each of which the suite would otherwise have frozen — a dropped
`#section` fragment, an email autolink rendered as a link to a file with an `@`
in its name, a refused image losing its alt text, and bare URLs never linkified.
Byte-exactness also turned an intermittent `ammonia` attribute-ordering
behaviour into a red build rather than an occasional shrug
([DECISIONS-0.1b.md](DECISIONS-0.1b.md) D-07). The cost is that a
`pulldown-cmark` upgrade produces a diff that has to be read, which is the same
property stated as a cost.

---

## ADR-026 — Reconciliation is driven from what vanished, and a full scan announces no creations

**Status:** `ACCEPTED` · 07/09/2026 · **amends [ADR-014](#adr-014--identity-lives-in-the-registry-never-in-the-note-and-the-hash-is-correlation)**

**Context.** `ARCHITECTURE.md` §9 states identity correlation as
*"appeared := disk paths not in registry"*. That phrasing assumes a registry
that knows every file. This one does not: it is populated when a note is
**opened**, never by listing — [ADR-015](#adr-015--the-registry-is-operational-state-and-moves-to-its-own-database-at-02)
and `docs/DECISIONS-0.1a.md` D-09, which exist so that listing a 10 000-note
workspace does not hash 197 MiB. Under a lazy registry, "appeared" is
nearly every file in the workspace, on every scan.

**Decision.** Correlation is computed **from the vanished side**: for each
record whose path is gone, look for a unique match among the paths on disk that
no record claims. The answer is identical — a unique native id, then a unique
non-empty hash, then a new identity — and the work is zero on every tick where
nothing vanished. Separately, `ChangeKind::Created` is emitted **only for a
hinted path**, one the watcher has just reported; a full scan reports
modifications, removals and correlated moves and says nothing about a file that
is merely absent from the registry.

**Consequences.** A window regaining focus no longer announces every note the
user has never opened as newly created — which the first run of the
reconciliation tests did, a thousand events at a time, and which also blew the
hash budget with events that were not changes. Nothing is lost: a scan re-lists
the tree, which is what the sidebar needs, and a file that appeared as half of a
rename is found by correlation, which walks for exactly that. The cost is that
"a file appeared while the application was closed" is a listing rather than an
event, which nothing currently needs.

---

## ADR-027 — Not being able to watch is a state of the workspace, not a failure

**Status:** `ACCEPTED` · 07/09/2026 · amended by
[ADR-034](#adr-034--the-tree-appears-in-under-a-second-at-any-size-whole-tree-work-is-background-work) — coverage has a middle, and it is reported with numbers

**Context.** `ARCHITECTURE.md` §11 already says several backends have no
watcher — SMB, NFS, exFAT, a SAF tree at 0.4 — and §8 says Linux can run out of
inotify watches. The obvious signature, `watch() -> Result<()>`, makes all of
those errors, and an error at open time is a workspace that will not open.

**Decision.** `FileSystem::watch()` returns a `Watch` carrying an optional
`degraded` reason rather than a `Result`. A workspace that cannot be watched
opens normally, is reconciled by a 5 s poll and a scan on focus, and **the
interface says why** — for the inotify case, with the `sysctl` that raises the
limit.

**Consequences.** Every backend in §11's matrix is usable, with a stated
limitation instead of a refusal, which is the same shape as `Caps` everywhere
else in this application. The application also always runs its poll and its
focus scan, watcher or no watcher, so a watch that is silently lost degrades to
5 s rather than to nothing.

---

## ADR-028 — A resolution keeps the version it did not choose

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Scope §12 lists four resolutions for a conflict — compare, keep
mine, use the disk's, save as a copy — and three of them destroy one of two
versions of something the user wrote. It is the one moment in this application
where answering a dialog quickly can cost a morning.

**Decision.** Every resolution writes the version it is discarding to
`conflicts/` **before** it acts: `KeepLocal` snapshots the disk, `UseDisk`
snapshots the buffer, and `SaveAsCopy` writes the buffer to a file of its own so
both survive on disk. `note_convert_eol` — the one command that rewrites a file
the user did not edit — does the same with the old bytes. Unresolved conflicts
are drafts and are never pruned; resolved snapshots are pruned after a retention
setting whose `0` means *keep*, and the 200 MB warning **deletes nothing**.

**Consequences.** A resolution is always recoverable, which is what lets the
interface offer the three buttons without a second confirmation. The cost is
disk in app data, bounded by retention and reported rather than reclaimed —
making room by throwing away the only copy of something a user wrote is the
failure the directory exists to prevent.

---

## ADR-029 — `mailto:` and every scheme but `http(s)` render as text

**Status:** `ACCEPTED` · 07/09/2026

**Context.** Scope §8.4: *"Links externos `http(s)` abrem no navegador do SO por
clique. Outros esquemas recusados."* `mailto:` is the one that looks like an
exception worth making, and `shell:allow-open` in the capability file is
restricted to `http` and `https`.

**Decision.** A `mailto:` link, and an email autolink, render as text. Only
`http` and `https` become anchors, with `target=_blank rel="noopener
noreferrer"`, opened through a command that **checks the scheme again in Rust**
— the capability is what the WebView may ask for, and the check is what the
process will do.

**Consequences.** A rendered `mailto:` would have been a link that does nothing
when clicked, which is worse than text. Making it work means widening a
capability, and granting a permission is the owner's act, written into the
capability file with its reason — not applied by an agent on the way past
(CLAUDE.md golden rule 7). The change is two lines and is written out in
[DECISIONS-0.1b.md](DECISIONS-0.1b.md) D-06 for whoever makes it.

---

## ADR-030 — Tabs are a list beside the editor, not a second document model

**Status:** `ACCEPTED` · 08/09/2026

**Context.** Milestone 0.1c adds tabs with restoration. The editor store holds
exactly one loaded document, and everything in 0.1a and 0.1b is written against
that: the write protocol, `buffer_version` and the stale-save guard, the draft
rules, the conflict state, the reload-from-disk path. Making it hold a map of
documents to gain a tab strip would put every one of those back in play for what
is, at 0.1c, a navigation feature — two notes are never visible at the same time.

**Decision.** A separate store owns the **list**; the editor keeps owning the
**document**. A tab carries only what has to survive a restart — path, `NoteId`,
cursor, scroll, pinned — and the buffer stays where it was. Leaving a tab is not
a new rule: a dirty note is flushed and a note in conflict writes its draft,
which is what `ARCHITECTURE.md` §5 already says happens when a buffer stops being
looked at.

The cursor is handed to the editor **after** it mounts the document, because a
position in a document that does not exist yet means nothing; reports from a
freshly mounting editor are suppressed while a restore is in flight, or the
caret at 1:1 would overwrite the one being restored.

**Consequences.** Switching tabs re-reads the note from disk rather than swapping
an in-memory buffer, which is a round trip the user can feel on a very large
note — accepted, because it means there is exactly one place where a buffer
exists and therefore exactly one place where it can be lost. The moment two
documents must be **visible** at once — a split of two notes, not of one note's
source and preview — this decision is the one to revisit, and it should be
revisited rather than worked around.

---

## ADR-031 — Global search is a scan the core owns, polled like reconciliation

**Status:** `ACCEPTED` · 08/09/2026

**Context.** Scope §10 puts a workspace-wide search at 0.1c and the FTS5 index at
0.2, and requires the first result in under 500 ms on a 10 000-note workspace
with the search cancellable. `ARCHITECTURE.md` §7.2 sketched `search:result` and
`search:done` as core-to-frontend events; the reconciliation built at 0.1b uses
polling instead, and two delivery mechanisms for two streams of the same kind is
one more than the application needs.

**Decision.** The core walks the workspace with `ignore` and matches with
`regex`, in a background thread, pushing hits as they are found. The frontend
**polls** — `search_start`, `search_poll`, `search_cancel` — exactly as it polls
reconciliation. Every worker reads the cancel flag before each file, so
cancelling is bounded by one file rather than by the workspace.

**This scanner does not go away when FTS5 arrives.** §10 requires the three
semantics — literal, words, regex — to keep their names and not swap underneath
the user; the index takes over *words*, and literal and regex remain what the
scan is for.

**Consequences.** Measured at 11.4 ms to the first result and 650 ns to cancel
over 197 MiB, which is the criterion met by two orders of magnitude. Polling adds
a latency floor of one interval, which is invisible against a walk and is the
price of one delivery mechanism instead of two. The core carries a background
thread and a cancellation flag it did not have; a search left running by a
closed panel is prevented by cancelling on drop rather than by asking every
caller to remember.

---

## ADR-032 — Quick open matches a cached path list, and the tree invalidates it

**Status:** `ACCEPTED` · 08/09/2026 · amended by
[ADR-034](#adr-034--the-tree-appears-in-under-a-second-at-any-size-whole-tree-work-is-background-work) — the list is built in the background, and a partial one answers

**Context.** `Ctrl+P` has to answer on every keystroke. Walking a 10 000-note
workspace takes tens of milliseconds — fine once, ruinous per character — and
reading files to match a *name* would be work for nothing.

**Decision.** The service caches the workspace's note paths, built on first use,
and matches them in memory. It reads no file. **Every operation that changes the
shape of the tree drops the cache** — create, rename, move, duplicate, delete,
and any reconciliation tick, since a file that appeared or vanished outside the
application changes the tree as surely as one the application renamed.

Scoring is deliberately small and explainable rather than clever: a subsequence
match, a bonus for consecutive characters and for landing at the start of a path
segment, and the file name ranked ahead of the directory, because `Ctrl+P` is how
someone reaches for a file they can name.

**Consequences.** The first `Ctrl+P` after opening a workspace pays for the walk;
every later one is a filter over memory. Invalidating on every reconciliation
tick is coarse — a tick that changed nothing still drops the cache — and that is
chosen over tracking which paths moved, because a stale quick-open list offers a
note that is not there, which is worse than rebuilding a list. The scoring will
disagree with someone's expectation eventually; it is small enough to read and
change, which is the property that matters.

---

## ADR-033 — The dmabuf workaround keys on the NVIDIA driver, not on the display server

**Status:** `ACCEPTED` · 08/09/2026 · amends
[ADR-022](#adr-022--the-webkitgtk-dmabuf-workaround-is-applied-automatically-on-wayland-with-nvidia)

**Context.** ADR-022 said "detect Wayland and an NVIDIA driver". The Wayland half
was wrong, and it was wrong in the direction that costs a window.

WebKitGTK has used the DMA-BUF renderer on **X11 as well since 2.42**. The fault
the workaround exists for is in NVIDIA's GBM — creating the buffer — not in a
compositor, so it occurs on both display servers. Observed on Debian 13 / X11 /
NVIDIA, with the environment variable unset:

```text
[notes] dmabuf: not needed — session is not wayland
src/nv_gbm.c:288: GBM-DRV error (nv_gbm_create_device_native): …failed (ret=-1)
KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied
Failed to create GBM buffer of size 1100x720: Permission denied
[notes] window main: close requested
[notes] window main: destroyed
```

The workaround declined to apply, and the next four lines are the failure it
exists to prevent. **This is the window that disappeared on *Open Folder***
(`docs/DECISIONS-0.1b.md` D-20): the GBM buffer for a new surface cannot be
created, the window is destroyed, and Tauri ends its event loop with status `0` —
which is why it never looked like a crash. It had nothing to do with the file
chooser; the chooser was merely the first thing that asked for a surface.

The reason it took this long is worth recording, because it is a hazard and not
an accident: **the owner's shell already exported
`WEBKIT_DISABLE_DMABUF_RENDERER`.** `linux.rs` correctly refuses to override a
value the user set, so every run before this one logged *"left alone — already
set"*, the workaround never ran, and no comparison was ever made. A masked
symptom produced a plausible mechanism (a GTK chooser taking its parent down)
built on a false premise.

> **Correction, 19/09/2026 — where the variable came from.** The sentence above
> says *the owner's shell* exported it. Traced at `1.6.86`, it is in none of
> `~/.bashrc`, `~/.profile`, `~/.zshrc`, `/etc/environment`, `environment.d/` or
> the systemd user environment: walking `/proc/<pid>/environ` up the tree finds
> it entering at `sshvterm-sidecar`, and absent in both `sshvterm` itself and
> `gnome-shell`. The hazard this ADR records is unchanged and the decision is
> unchanged — what changes is the remedy for the next person. It is not *"clear
> your shell profile"*; it is that **a run started from a terminal inside that
> application and a run started from the desktop session are different tests**,
> and only the second one exercises the workaround without help. The original
> sentence is left standing because an ADR is a record of what was decided and
> believed on the day, and one that edits its own reasoning silently stops being
> one.

**Decision.** On Linux, the **proprietary NVIDIA driver alone** decides. The
display server is no longer an input to `decide` — not weighted differently,
removed, because it never bore on the failure.

`nouveau` does not count, and is distinguished by what each driver *creates*
rather than by a name: `/proc/driver/nvidia/version` is written by the
proprietary kernel module and by nothing else; `/sys/module/nvidia/` is that
module's own sysfs directory, while nouveau's is `nouveau`; `nvidia-smi` on
`PATH` is a weaker hint and is never shipped by nouveau. Nouveau's GBM works, so
disabling the renderer there would cost compositing performance for no reason.
Both are reported in the diagnostics panel, so a user can see which is loaded.

**Consequences.** Every Linux machine with the proprietary driver now turns the
DMA-BUF renderer off, X11 included — a real performance cost on hardware where
the bug may never have shown, accepted because the asymmetry is absolute: applying
it needlessly is slower compositing, and not applying it is no window at all. The
`off` setting remains for anyone who measures the difference and wants it back.

A false positive from `nvidia-smi` present without a loaded driver lands on the
cheap side of that same asymmetry.

**What this ADR does not claim.** It fixes the failure that was observed. Whether
the *original* Wayland black-window reports share this mechanism is not
established here, and ADR-022's account of them is left standing.

---

## ADR-034 — The tree appears in under a second at any size; whole-tree work is background work

**Status:** `ACCEPTED` · 08/09/2026 · amends
[ADR-027](#adr-027--not-being-able-to-watch-is-a-state-of-the-workspace-not-a-failure)
and [ADR-032](#adr-032--quick-open-matches-a-cached-path-list-and-the-tree-invalidates-it)

**Context.** The owner opened `~/x` — around 160 repositories with
`node_modules/`, `target/` and `.git/` — and the Welcome screen stayed on screen
for over two minutes before the tree appeared. That folder is not a notes
workload, and it does not have to be: **the application may not freeze on any
folder.**

The measurement is in `docs/DECISIONS-0.1c.md` D-09 and reproduces with
`tools/gen-deep.sh` plus `cargo test -p notes-core --test deep -- --ignored`. On
20 962 directories, opening the workspace and listing the root cost **1.13 ms**
together — the lazy tree was never the problem — while `start_watch` cost
**502 ms** and the first `quick_open` **550 ms**, each walking the entire tree
inside a `#[tauri::command]` holding `Mutex<WorkspaceService>`. Every other
command, `tree_list` included, waited behind them. On a folder ten times the
size, so did the user.

**Decision.** Three rules, and the first is an acceptance criterion:

1. **`workspace_open` returns and the tree appears in under one second, at any
   size.** `crates/notes-core/tests/deep.rs` asserts it on Linux and publishes
   the measurement on every platform
   ([ADR-080](#adr-080--a-timing-criterion-is-asserted-where-its-numbers-came-from-and-published-everywhere-else));
   `docs/ACCEPTANCE-0.1b.md` and `docs/ACCEPTANCE-0.1c.md` carry it with the
   number, and the owner's walk is where it is judged on real hardware.
2. **Anything that needs the whole tree runs off the critical path** — on its own
   thread, cancellable, with its progress visible in the status bar. That is the
   watcher's per-directory walk and quick open's path list today, and it is the
   rule any future whole-tree work is held to.
3. **Partial is a state, and it is reported with numbers.** A directory that
   cannot be read is counted and skipped, never fatal. A full watch table
   degrades **only the excess**: the watches already installed keep working, the
   remainder is counted, and the banner says how many and which `sysctl` raises
   the limit.

Rule 3 is the amendment to ADR-027. That ADR made "watched" and "polled" the two
states of a workspace; the truth has a middle — mostly watched, with a named
number of directories that are not — and the interface now says so instead of
collapsing it to the worse of the two ends. Rule 2 is the amendment to ADR-032:
the cached path list is still a cached path list, but it is **built in the
background** and `quick_open` answers from a partial one with `building: true`
beside it, rather than blocking on the first call. ADR-032's *"every operation
that changes the tree drops the cache"* survives with one qualification that
only a background walk needs: a walk still running is not restarted, because on
a workspace with continuous activity it would never finish
(`DECISIONS-0.1c.md` D-11).

**Consequences.** Quick open can answer from an incomplete index for the first
few seconds on a very large workspace, and says so in the palette. The watcher
does not descend into `node_modules/`, `target/` and their kin
(`docs/DECISIONS-0.1c.md` D-08) — changes there arrive via the 5 s scan instead
of instantly. Both walks skip symlinked directories, which the deep fixture's
loop exists to check.

The freeze had one more property worth keeping in view: it was invisible in
every fixture the project had. `fixtures/large` measures 10 000 **notes** and
lists them in 37 ms. The axis that broke was **directories**, and nothing
measured it until `fixtures/deep` did. A performance criterion is only as good
as the shape it is measured on.

---

## ADR-035 — The bundle version is stamped from `version.md`, never maintained beside it

**Status:** `ACCEPTED` · 08/09/2026

**Context.** `version.md` is the version (ADR-011): `tools/release.sh` names the
git tag and the GitHub Release after it. `tauri.conf.json` needs the same number
to stamp a `.deb`, an AppImage and a `PKGBUILD`, and it held its own copy —
`0.1.0`, while `version.md` said `0.11.1`. A package attached to Release
`0.11.1` that calls itself `0.1.0` cannot be matched to the code that produced
it, which is the one thing a version number is for.

**Decision.** `tools/stamp-version.sh` writes `version.md`'s version into
`tauri.conf.json` at build time. **What is committed is `0.0.0`** — valid
semver, and unmistakably not a release. `tools/check.sh` and CI both fail if the
committed value is anything else, so a stamped tree cannot be committed by
accident and the number cannot quietly acquire a second maintainer.

The AUR package follows the same line: `packaging/aur/notes-bin/PKGBUILD` is
**generated** from `PKGBUILD.in` by `packaging/aur/gen-pkgbuild.sh`, which fills
in the version, the source and its `sha256sum`. The generated file is
gitignored. A checksum committed by hand is a checksum that is eventually wrong.

**Consequences.** The version lives in exactly one file, and every artefact that
carries a version gets it from there. The cost is that a local
`npm run tauri build` produces a `0.0.0` bundle unless `tools/stamp-version.sh`
is run first — which is stated in the runbook and is the correct default, since
a local build is not a release.

**Alternative if you disagree.** Keep the number in `tauri.conf.json` and bump
both. It is one more line in the commit ritual and it is the line that gets
forgotten; the evidence is that it already had been, by ten minor versions.

---

## ADR-036 — Release artifacts are built for minor bumps, and on request

**Status:** `ACCEPTED` · 08/09/2026 · refines
[ADR-023](#adr-023--arch-linux-is-a-release-target-with-its-own-ci-job) and
[ADR-035](#adr-035--the-bundle-version-is-stamped-from-versionmd-never-maintained-beside-it)

**Context.** ADR-011 makes every commit a version and every version a Release.
`build.yml` then built a `.deb`, a 105 MB AppImage, a tarball and an Arch
package for each of them — nine minutes a time. In one working session that was
twelve full builds, three of them running concurrently while the CI job that
actually gates the work sat queued behind an AppImage. The owner's call:
*"9 min e 105 MB por commit de doc não se justifica."*

**Decision.** Artifacts are built for a **minor bump** — a version whose patch
component is `0` — and for any version asked for explicitly through
`workflow_dispatch`. A patch Release carries no artifacts and **says so in its
own description**, with the marker `<!-- no-artifacts -->` so a re-run does not
append the note twice.

Serialisation stays as well: the concurrency group is `build` with
`cancel-in-progress`, so even a burst of minor bumps produces one build.

**Consequences.** The version a user installs is a version where something an
installer contains actually changed. A patch that somebody does want packaged
is one manual run away, and the Release itself carries that instruction rather
than leaving an empty downloads section to be read as a failed build. What is
lost is the invariant *"every Release is installable"*; what replaces it is
*"every Release says whether it is"*, which is the honest version and the one a
person can act on.

The rule is arithmetic on the version string, not a diff of what changed. A
patch that touches the editor gets no artifacts even though it changes the
binary, and a minor bump that only moves documents gets a full set. Deciding by
content would mean defining which paths count, keeping that list correct, and
explaining an empty Release whose commit *looks* like code — the version number
is a decision the author already made, and reading it is cheaper than
second-guessing it.

**Alternative if you disagree.** Build on every version, which is what shipped
at `0.11.2` and cost the CI queue; or decide by which paths a release range
touched, which trades nine minutes for a rule that has to be maintained and can
be wrong in both directions.

---

## ADR-037 — Milestone 0.1d exists: the interface is a milestone, not a finishing pass

**Status:** `ACCEPTED` · 08/09/2026 · owner's decision, recorded here ·
amends [SCOPE.md](SCOPE.md) §17

**Context.** 0.1a, 0.1b and 0.1c built a Markdown editor and its behaviour is
tested on four platforms. What none of them built is an *interface*: the window
is a tree, a text area and a status line, and the twenty-five interface flows in
`ACCEPTANCE-0.1b.md` and `ACCEPTANCE-0.1c.md` had been waiting for a person to
walk them.

The owner installed the `0.11.11` `.deb`, opened it, and did not walk them —
because the interface is about to change entirely and walking flows against a
layout that is being replaced measures nothing. In the same pass they hit the
concrete consequence of never having had an interface pass: **there is no way to
change workspace without going back to the Welcome screen.** Every command
exists in the core; nothing in the window reaches them.

**Decision.** §17 gains **0.1d — Interface**, and the desktop MVP becomes
`0.1a + 0.1b + 0.1c + 0.1d`. The layout reference is Obsidian's dark interface.
Icons are `lucide-react` (ISC).

**The copying rule, which is the part that matters legally and is stated in the
scope rather than left to judgement:** palette, spacing and structure are free —
they are ideas, and an interface layout is not a protected work. **No Obsidian
theme file, stylesheet or asset is copied. Everything is rebuilt.** A CSS file
is a work; the observation that a note editor reads better in a 700-pixel column
is not.

The twenty-five flows of 0.1b and 0.1c are **re-indexed into
`ACCEPTANCE-0.1d.md`** rather than ticked where they are: the steps move in the
interface, the behaviour does not, and a flow whose steps no longer describe the
window is not a flow anyone can walk.

**Consequences.** The MVP ships later, and it ships as something a person can
use rather than something a test can prove. The workspace selector alone closes
a defect that had no route to the user at all. The cost is a milestone that
produces almost no core code and a great deal of frontend, at a point where the
project's testing strength is in the core — which is why the automated half of
0.1d is contrast, keyboard navigation and the standing dialog check, and why
everything else is a flow with a person's name on it.

**Alternative if you disagree.** Ship the MVP on 0.1c and treat the interface as
polish inside 0.2. That is what "finishing pass" usually means and it is why so
many applications never get one: there is always an index to build.

---

## ADR-038 — Graph view leaves "out of scope" and becomes 0.3, after backlinks

**Status:** `ACCEPTED` · 08/09/2026 · owner's decision, recorded here ·
amends [SCOPE.md](SCOPE.md) §18

**Context.** §18 listed graph view among the features that do not enter "until
further order", beside canvas, plugins and a marketplace. The owner has given
that order.

**Decision.** Graph view moves out of §18 and into **0.3**, explicitly *after*
backlinks. **It is not part of 0.1d.** The icon rail 0.1d builds carries a graph
entry that is **disabled, with a tooltip naming the milestone** — which is the
honest way to show a thing that is coming: visible, inert, and dated.

**Why after backlinks and not before.** A graph is a rendering of a link
relation; backlinks are that relation. Building the view first means inventing a
data source for it, and then rebuilding it when 0.3 produces the real one. The
ordering is not a preference about interest, it is which of the two can exist
without the other.

**Consequences.** §18 stops being the list of things that will never happen and
becomes the list of things that have not been ordered yet, which is what it
always said it was — *"Recurso fora de escopo não entra como 'melhoria
incidental' de um agente. Entra por revisão deste documento."* This is that
revision, made by the owner.

A disabled control in the interface from 0.1d onward is a promise with a date on
it. If 0.3 moves, the tooltip is what has to be corrected — it is a string, and
it is a key like every other.

**Alternative if you disagree.** Leave graph view out of §18 *and* out of the
interface, and add it whenever it arrives. That avoids a disabled control
carrying a promise, at the cost of an icon rail that has to be relaid out later
and a user who cannot see the shape of what is coming.


## ADR-039 — SQLite stores facts; the core owns workspace I/O

**Status:** `ACCEPTED` · implemented in 0.14.0 (milestone 0.2).

**Context.** ADR-003 deferred the index boundary until real code needed it;
ADR-015 requires operational identity to move to a separate SQLite database.
The user requested all of 0.1d and 0.2 together; owner acceptance still follows
the installed-release and following-release rule.

**Decision.** `notes-index` depends on `notes-model`, `notes-markdown` and
bundled `rusqlite`, never `notes-fs`. Core walks the confined filesystem and
supplies metadata/text. Index persistence owns FTS5 and derived parser facts;
registry persistence owns a separate operational DB. The initial registry
schema stores the existing serialized identity snapshot to preserve its full
shape during migration. Immediate transactions merge deltas against a baseline
and refuse conflicting changes; a stale snapshot cannot erase unrelated notes.
Legacy JSON and a backup are retained. Persistence remains immediate, correcting
the earlier unimplemented debounce described in architecture §4.1.

Recent history and reviewed rewrite originals are operational app-data files,
not derived index tables. Link/image destinations are parsed by the existing
Markdown authority and rewritten only at exact source spans after review.
Concurrency checks and original-byte journals make partial application
recoverable; no claim of a filesystem transaction is made. Notes not examined
are disclosed; an unavailable index offers an explicit move without rewriting.

**Alternatives.** Giving the index direct filesystem access duplicates the root
boundary. A third registry crate adds no useful isolation between the two DB
lifecycles. Normalized registry rows can replace the snapshot in a later backed-up
migration if measurements justify it; the current per-note merge semantics must
survive that change. Tags, graph and wiki-link semantics remain 0.3.

---

## ADR-040 — Mobile starts with the iOS container

**Status:** `ACCEPTED` · Original decision 09/09/2026; integration reviewed 10/09/2026

**Context.** The owner started mobile independently while desktop milestones
0.2 and 0.3 were being delivered. The original PR proposed completing mobile
before 0.3; 0.3 has since shipped, so that sequencing statement is historical.
The owner now requests this foundation be merged and work continue on 0.5.

**Decision.** Start mobile validation with iOS and the application's own
container, where LocalFs applies. External folders require security-scoped
bookmarks on iOS and SAF on Android in a later slice. Toolchain availability
motivated iOS first at the time; it is not a permanent claim about a machine's
installed SDKs. Distribution credentials and physical-device acceptance remain
separate from compilation for the simulator.

**Consequences.** This foundation gates the unsupported trash dependency and
reports permanent deletion on mobile. It does not supply the Tauri mobile
entry point, generated projects, layouts, external-folder adapters or device
proof. Those remain in the mobile queue.

---

## ADR-041 — Local knowledge and agents share the parser and guarded core

**Status:** `ACCEPTED` · 10/09/2026

**Number reservation at publication.** ADR-040 was reserved by mobile PR #2.
Its integration in 0.17.0 filled that reservation and assigned ADR-042 to its
other decision, preserving the already published ADR-039.

**Context.** The owner requested all of milestone 0.3 while another agent
implements mobile in PR #2. Knowledge relationships need one semantic source;
MCP must run without the app and must not silently overwrite app buffers.

**Decision.** The Rust Markdown crate uses pulldown-cmark's wiki syntax and
`serde_yaml_ng` 0.10 for bounded, read-only YAML interpretation. It never
serializes metadata into notes. Core resolves wiki homonyms explicitly and
derives backlinks/graph from index schema 2. Frontend shows the same facts,
with bounded graph rendering and partial-state labels. The `image` crate
with PNG/JPEG decoders validates clipboard bytes under allocation/dimension
limits; original bytes are exclusively created in root attachments.

`notes-mcp` is a stdio executable over core, without a listener or application
dependency. Configuration explicitly scopes paths and independent permissions;
review writes stay in proposals. Note contents never grant authority. Global
enrollment locking gives simultaneous processes the same workspace ID, while
the existing workspace lock serializes identity assignment and mutations.
Disk hashes are always compared even when metadata matches: a two-process
test demonstrated that matching size/mtime could otherwise destroy a newer
write before the registry reported its conflict. Append receipts persist in
operational app data to make retries across process restarts idempotent. Agent
reads do not alter GUI visit history. Configuration and operational limits
are [documented separately](KNOWLEDGE-0.3.md).

**Consequences.** Disposable schema 1 indexes rebuild; operational schema stays
unchanged. Saving reads the current bytes even on a metadata match. Coordination
requires a shared app-data directory and cannot exclude unrelated editors from
the filesystem. Linux releases publish a standalone MCP archive; unsigned
macOS/Windows publication remains disabled under ADR-024. Version 0.16.0 avoids
the mobile PR's reserved 0.15.0; merging the PR must choose a newer version.
Owner acceptance remains the installed-release walk and following-release
repeat; automated process/UI tests do not tick those boxes.

---

## ADR-042 — Mobile remains in the same repository and application

**Status:** `ACCEPTED` · Original decision 09/09/2026; numbering reconciled 10/09/2026

**Context.** The mobile PR used ADR-039 before the index decision occupied that
number on master. Its architectural choice remains valid; its number changes
here without renumbering an already published decision.

**Decision.** iOS and Android are targets of notes-app and consume the same
core. Mobile UI will be a layout in the existing React application. Generated
Apple/Android projects will be committed when created, since their signing,
entitlement and manifest edits are source. They do not exist in this PR.
A separate repository or second React application is not introduced, and
packages/ui is deferred until real sharing requires it.

**Consequences.** Filesystem interfaces and their consumers evolve in one
commit and one CI matrix. The current iOS CI check covers core dependencies,
including bundled SQLite and clipboard image decoders; compiling the full
Tauri shell, Android runtime integration and device flows remain future work.

## ADR-043 — A separate owner-operated REST server reuses core policy

**Status:** `ACCEPTED` · 10/09/2026 · Implemented in 0.18.0.

**Context.** The owner requested milestone 0.5 after reviewing and merging the
mobile foundation. Server access needs revocable, scoped credentials without
turning the desktop app into a network service or inventing another note store.

**Decision.** Add `server/notes-server` using Axum 0.8.9 and Tokio, with an
operator CLI and a path-only `/v1` REST API documented in OpenAPI 3.1. Core owns
scope checks, note IO, identity coordination, conditional writes, append
receipts and saved-content search. Paged core results remain scope-filtered.
Complete BaseRev comparison prevents consuming a stale conditional revision;
a timestamp never chooses a sync winner. This is not the 0.6 sync protocol.

There is one owner, with distinct random bearer credentials per integration.
Only secret digests are persisted; comparison is constant-time. Operator CLI
creation/revocation is outside HTTP. A shared administration lock surrounds
request authorization and its core operation; revocation takes the exclusive
lock. A separate lifetime lock excludes backup from a live server. State schema
1 is explicit; unknown versions are refused. Offline restore stages the data,
rejects traversal/links, rebinds restored enrollment through the core with a
pre-restore copy, and publishes only a new directory. Notes stay byte-identical.

The process defaults to loopback. Remote use requires the fixed private
backend/known HTTPS proxy topology documented in SERVER-0.5.md. Compose exposes
only Caddy; the backend rejects an untrusted actual peer or a missing HTTPS
forwarded-protocol header. Eight-operation concurrency and fixed identity/peer
rate windows bound requests. Request bodies, result pages and audit retention
are bounded. Audit records authorship and an opaque route reference, never
credentials, note text, queries or full note IDs/paths. Filesystem trash failure
logging is generic so a server fallback cannot disclose a note path.

**Explicit CSRF amendment to security.md §4.3.** These machine endpoints use
non-cookie bearer authorization instead of a session CSRF token or per-request
signature. No cookies authenticate, no CORS is enabled, and every Origin-bearing
request is denied. This deliberate exemption applies only to the documented
`/v1` API; it grants no exemption to a future browser/session interface.

**Consequences.** The desktop still opens no listener. Linux releases include a
separate server archive; CI builds the non-root container and verifies actual
TLS using a test CA. The public certificate setup remains an owner deployment
step. Server state is readable by its operator: no E2EE, teams, hosted service,
desktop sync or remote MCP is introduced. Dependencies and container digests
are tracked by Dependabot and Cargo.lock. The owner acceptance walk and its
following-release repeat remain open in ACCEPTANCE-0.5.md.

## ADR-044 — Synchronization starts with causal plans and explicit pairing

**Status:** `ACCEPTED` · Implemented domain boundary in 0.19.0; milestone 0.6 open.

**Context.** The owner requested the next queued items after the 0.5 server.
ADR-005 already requires identity, revisions, tombstones and no clock-based
winner. Applying remote writes without a causal model would turn synchronization
into overwrite-by-arrival and bypass the local save protocol.

**Decision.** Create `notes-sync` beside the filesystem adapter. Its first block
contains immutable revision DAGs, compare-and-set heads, monotonic device
receipts, explicit two-parent resolution and deterministic pairing/incremental
plans. It depends on the domain model, never on Tauri or an HTTP implementation.
Core supplies explicit inventories with original byte hashes and its existing
identity/reconciliation rules. A separate `notes-sync-plan` executable exposes
those inventories as a read-only preview for two mounted folders.

Schema-1 sync metadata is private operational data and uses locked, atomic,
digest-conditional replacement. Future/corrupt state is refused unchanged.
Limits stop growth explicitly; acknowledgments alone do not invoke pruning.
Missing inventory is never a deletion, and a tombstone retains ancestry.
Upload/download require an empty destination inventory; reconciling two
populated folders produces explicit links and conflicts before any application.
Filesystem-specific name checks remain mandatory at the eventual apply step.

**Consequences.** Planning creates no source files and changes no note bytes;
explicit inventory may establish identities in operational state. The desktop
continues to open no listener. No remote wire format, background transfer,
content retention or UI completion is claimed by this first block. Those
remaining items stay in `.continue/0.6-sync.md`; MCP remote is still 0.7.
See SYNC-0.6.md for the implemented contract and limits.

## ADR-045 — The first server sync transport stores revisions before application

**Status:** `ACCEPTED` · Implemented in 0.19.1; milestone 0.6 remains open.

**Context.** After causal planning, replication needs durable original bytes and
an authenticated resumable exchange. A storage acknowledgment cannot honestly
claim that a revision was applied to a source file or a dirty device buffer.

**Decision.** Add a separate `/v1/workspaces/{workspace}/sync/revisions` inbox
under the existing bearer, HTTPS, rate, concurrency and audit controls. Reuse
operation permissions and review scopes. Authorize every historical note path;
a token cannot recover old content through a UUID after the note leaves its
scope. The existing machine-only CSRF exemption covers these `/v1` endpoints.

The first vault is a bounded atomic document containing causal metadata and
base64 original content together, with verified hashes, expected-head checks
and immutable UUID retry receipts. It acknowledges storage only. No source file
is read or written through the vault, and no application receipt is invented.
Parents must already be accepted; divergent branches remain on the device until
a later conflict/import flow. Append-log cursors enable metadata paging; filtered
entries still advance the cursor and may reveal aggregate workspace activity.
Device UUIDs are asserted metadata, not authentication principals.

Retain all accepted revisions and tombstones within the documented byte/count
bounds; refuse capacity without eviction. No automatic pruning or migration is
introduced by this block; ADR-063 later permits explicit metadata-preserving
branch-payload pruning. Per-workspace OS locks serialize writes, atomic replacement binds
content to heads, and offline backup/restore includes the vault but not its lock.
Corrupt or future-schema state is refused unchanged. Original workspace files
remain the source of truth; the inbox contains replication copies.

**Consequences.** This block can transfer and recover immutable bytes but cannot
synchronize a user's workspace by itself. Device outboxes, conflict import,
application with draft protection, attachments, background work and UI remain
queued. The bounded JSON design deliberately limits scale; its replacement
needs a documented migration and recovery path. See SYNC-0.6.md and OpenAPI.

## ADR-046 — Device transfer uses durable queues before source application

**Status:** `ACCEPTED` · Implemented in 0.20.0; milestone 0.6 remains open.
Explicit source application is added separately by ADR-047 in 0.20.1.

**Context.** The server inbox can store immutable revisions, but a device must
survive offline edits and lost responses without regenerating UUIDs or treating
a storage receipt as proof of source application.

**Decision.** Add `notes-sync-client` as a separate desktop CLI/transport crate.
Core captures saved original bytes against its identity/hash inventory. The
shared publication contract and byte validation live in `notes-sync`; neither
core nor domain imports an HTTP client. Explicit initialization pins endpoint,
workspace UUID and source root. The first upload requires an empty server inbox;
the first client only supports whole-workspace non-review credentials.

Offline staging atomically persists immutable publications in order. Transfer
checkpoints each validated receipt and reuses the exact publication on an unknown
outcome. Conflicts retain the rejected publication and successors. Receive
validates complete pages/content before committing its cursor. Received bytes
can be exported to a new private state file, never applied to a source note.
Missing source files are reported, not inferred as deletions. Draft protection
and application acknowledgments are not claimed by this block.

Use pinned reqwest 0.13.4 with rustls and the ring provider, bounded responses,
timeouts, no redirects, no automatic retries and no inherited proxies. The
operator-selected origin is the only network authority; no received URL is
followed. Resolve, validate and pin addresses per process while retaining TLS
hostname verification. Credentials come from a private regular file and remain
outside persisted client state and command-line values.

**Narrow amendment to security.md §4.4.** Explicit initialization with
`--allow-private` can authorize that selected private server, including plain
HTTP only at a literal loopback IP for local use. Link-local/metadata,
unspecified and multicast addresses remain denied. This does not authorize URLs
from note content, HTTP responses or arbitrary future integrations. A selected
PEM trust anchor augments certificate trust without disabling verification.

**Consequences.** Atomic schema-1 client state contains bounded queued and
received content. It must be backed up while stopped and preserved on conflict;
unknown/corrupt schemas are refused unchanged. Retention/migration, scoped or
populated pairing, deletion capture, divergent import, source application,
background work and UI remain in the queue. CI tests real client processes over
TCP and the existing HTTPS proxy, in addition to fault-injected lost receipts.


## ADR-047 — Apply received notes only through guarded closed-workspace writes

**Status:** `ACCEPTED` · Implemented in 0.20.1; milestone 0.6 remains open.

**Context.** Durable transfer is not proof that a note was safely applied. The
editor owns buffers outside the transport process, and a crash can separate a
source write from the receipt that records it.

**Decision.** Extend the CLI with explicit receive-only application of creations
and same-path updates. Keep HTTP outside core. Core acquires an exclusive
workspace activity lease against shared leases held by open core workspaces,
then the existing write lock. The actual app data directory is required and
pinned. Any pending draft blocks application; updates require the observed
BaseRev and local identity, and creations refuse collisions. Core preflight
precedes the durable client intent; every source write follows it. LocalFs
creation publishes a synced temporary file without replacing an existing file,
so incomplete new bytes cannot appear as the destination. Unix new files use
0600. Existing atomic updates preserve their mode.

A separate schema-1 application checkpoint maps remote revisions to local
identity/BaseRev and persists intent before writing. Exact intended bytes allow
recovery of a lost receipt without another write; different content refuses
recovery. Successful receipts advance individually. Transfer receipts and server
state do not become device application acknowledgments. Existing schema-1
transfer state remains readable without migration.

**Consequences.** Updated cooperating processes must share the app data path and
workspace path; older binaries and unrelated editors cannot be protected by the
lease. Native root identities unify activity leases where available. The normal
filesystem adapter's external-writer race limits still apply. Renames, deletes,
conflict resolution, active buffers, server acknowledgments and mobile lifecycle
remain separate work. Owner installed-release acceptance is not inferred from
CLI tests. Server backup skips activity lock files; device backups must retain application
checkpoints.

## ADR-048 — Application acknowledgments report durable device receipts

**Status:** `ACCEPTED` · Implemented in 0.20.3; milestone 0.6 remains open.

**Context.** Storage acceptance and a successful local application are different
facts. The server needs explicit device progress without inferring it from
received bytes or requiring connectivity during filesystem writes.

**Decision.** A separate receive-client `acknowledge` command sends one immutable
workspace/device/revision assertion per durable application receipt, up to 20
per invocation. It advances an additive default-zero cursor only after validating
the server's exact echo. Lost responses retry the same receipt. Application
intents and cached content never authorize sending. HTTP stays outside core.

The server requires Read and entire-history scope visibility and binds each
device to its first acknowledging credential ID. Same-revision retries are
idempotent; ancestors of an acknowledged revision are refused. Atomic vault
persistence retains acknowledgments and credential ownership alongside history,
under existing request and storage limits. Existing vaults have no owners;
existing client checkpoints have zero acknowledged receipts. Older binaries
refuse the additive fields, preventing silent loss on downgrade.

**Consequences.** A receipt is a historical assertion from an authenticated
client, not independent proof of current disk bytes. No pruning happens from a
receipt alone, and no source mutation or new credential authority follows from
it. ADR-063 later requires unanimous descendant receipts for an explicit offline
operator prune. Credential rebinding and stale
backup reconciliation remain explicit future work; retries never reset identity
or roll server progress back. Active-editor application remains queued under
ADR-047's existing closed-workspace guard.


## ADR-049 — Admit exclusive sync hosts before opening buffers

**Status:** `ACCEPTED` · Core foundation in 0.20.5; frontend integration follows in ADR-050.

**Context.** Applying with an editor open needs a coherent snapshot of buffers
that live outside core. Upgrading an existing shared OS lock risks a gap in
ownership, and the CLI cannot discover the app's unpersisted edits.

**Decision.** Add opt-in exclusive workspace admission before a host opens any
buffers. Reuse the existing activity lease for the session lifetime. Refuse
admission when that service already has a workspace; do not release an existing
shared lease to try an upgrade. Ordinary app/MCP sessions stay shared and the
CLI's closed-workspace requirement from ADR-047 stays in force.

Expose single-revision application on an exclusively owned service. The host
must freeze editing and supply every buffer's identity, BaseRev and saved/current
versions. Core rejects dirty, stale, duplicated or suspended buffer state and
pending drafts before durable intent. Reuse the existing guarded source write;
return the local receipt and allow clean reload through the existing note API.
Invalidate the path index after successful application.

**Consequences.** This implements the core seam, not an editor sync feature.
The frontend barrier, inactive-pane accounting, durable client adapter, error
recovery/reload and UI remain queued. Omitted frontend buffers cannot be detected
by core. No automatic flush, draft deletion, lease upgrade, network listener or
server acknowledgment is added. Other cooperating processes using the same app
data are excluded for the entire exclusive session, not just its writes.


## ADR-050 — The editor owns an input barrier around received application

**Status:** `ACCEPTED` · Implemented in 0.20.6.

**Context.** Exclusive core ownership does not freeze the frontend's document.
A batch may apply some revisions before a later failure, and a missing response
does not prove no source write occurred.

**Decision.** Add explicit app controls for an already initialized receive queue.
The Tauri shell delegates queue/session admission and application to
`notes-sync-client`, which reuses its durable intent/receipt protocol and calls
core without closing the exclusively owned workspace. HTTP stays in the client
crate, but these app commands make no transport calls or open listening ports.

The frontend snapshots its one live buffer (inactive tabs have no buffers and
Split is a preview). Dirty/draft/conflict/writing state refuses application.
Admission requires no pending IPC response continuations, no active composition,
and no outstanding modal. A synchronous barrier gates ordinary IPC, user input,
CodeMirror edits, autosave and reconciliation. The barrier owner alone invokes
application/recovery commands. Input resumes only after verified clean reloads
are installed into the exact frozen document. A missing response or failed
reload retains the barrier with an explicit recovery control.

The client advances buffer BaseRev snapshots between revisions and reloads after
partial failures. Successful earlier receipts stay durable. The shell owns the
selected Store for the session; source binding is checked by the client/core.
A normal app restart does not silently opt into exclusive mode.

**Consequences.** Received creations/updates can be applied with the app open.
Transport, acknowledgment, pairing initialization and credentials remain CLI
operations. Multi-buffer editing must extend the inventory before enabling this
workflow. No automatic flush, draft deletion, overwrite-on-conflict, network
listener, or server acknowledgment follows from the UI action.


## ADR-051 — Import divergent history only with its explicit resolution

**Status:** `ACCEPTED` · Implemented in 0.20.7; extends ADR-045's inbox protocol.

**Context.** A rejected linear publication remains queued, but its peer cannot
resolve with two parents until the divergent history is available. Importing a
branch as a head would choose a winner before the operator resolves it.

**Decision.** Add an optional bounded `branches` field to immutable publications.
The branches retain original revisions and bytes; only the enclosing two-parent
resolution changes the head, under the existing expected-head compare-and-set.
Parents precede children, every imported revision belongs to that note and leads
to the divergent parent, and graph/hash/capacity checks include retained history.
Authorize every imported mutation and historical path. Import plus resolution is
one vault transaction; stale, forbidden or invalid submissions change nothing.

The client provides independent fetch, conflict inspection, private export and
explicit file-based resolution. It durably replaces selected pending envelopes
only when their original histories and bytes are retained in the new envelope
or already verified in the remote journal. No source write or network operation
is implicit in choosing result bytes. Receive application keeps its existing
revision guards and applies only accepted heads, not imported branch values.

**Consequences.** Linear wire JSON stays unchanged; old readers reject envelopes
with branches. Both sides must be upgraded. Branches share existing byte/revision
quotas and have a 20-revision per-envelope limit. Version 0.20.7 supports same-path live-note resolutions in whole-workspace
upload queues; ADR-052 extends the result choices. Receive-folder local conflicts,
pairing and editor conflict controls remain open.


## ADR-052 — A rename or deletion resolution requires an explicit result choice

**Status:** `ACCEPTED` · Implemented in 0.20.8; extends ADR-051's client workflow.

**Context.** A file-only resolution cannot express which path survives a rename,
or distinguish an intentionally empty note from deletion. Inferring either
choice would discard user intent.

**Decision.** Keep the existing same-path live-note `resolve` contract. Add
`resolve-to` with a workspace-relative result path and a result file, and
`resolve-delete` with a path and no content. Both consume exact divergent heads
of one note and use the same bounded two-parent publication and retained branch
bytes. They stage history only; they do not change source files. Server checks
still require Create for resurrection, Move for changed paths and Delete for
tombstones, including the permissions of imported branches.

**Consequences.** Upload conflicts involving renames and tombstones have explicit
resolution commands. Missing files and empty bytes never infer deletion. Source
rename/deletion application, local receiver conflict capture and editor controls
remain queued. Existing source guards and wire/schema versions are unchanged.


## ADR-053 — Receiver conflicts retain capture and application progress separately

**Status:** `ACCEPTED` · Implemented in 0.20.9 for closed-workspace same-path live notes.

**Context.** A local receiver edit differs from its last source-application receipt.
Replacing that receipt with a captured edit would falsely claim remote progress;
applying intervening remote revisions would overwrite the edit before resolution.

**Decision.** Capture an explicit remote note UUID through its applied local
identity and the actual pinned app data directory, under an exclusive core
session with no drafts. Persist the original bytes as a local branch plus its
observed source revision in client state. Resolve with two parents before upload;
receive mode gains no credential permissions. Capture and choice write no source.

Apply the fetched chosen result under a durable resolution intent and the captured
source precondition. Record same-note ancestor revisions as superseded without
source writes or application acknowledgments. Record unrelated interleaved entries
as deferred and let ordinary guarded application drain them first. Application
state validates these position sets against the immutable history. Acknowledgment
stops at deferred entries and skips superseded ones; counts represent receipts.
Both resolution writes and deferred ordinary writes recover through durable intents.

**Consequences.** Saved same-path receiver conflicts have a complete explicit CLI
workflow without sacrificing either branch or falsifying receipts. Keep the source
closed and stable during the workflow; newer external edits refuse application.
Receiver rename/delete application, editor controls and refreshing unresolved
captures remain separate work. Additive private state fields fail closed in older
readers. Source files remain the user's Markdown, never the queue or SQLite.

**0.20.10 extension.** A remote rename/tombstone may be an ancestor of the
chosen live receiver resolution at its applied path. Require `resolve-to` for
this restoration; the implicit same-path command still refuses these parents.
Superseding those ancestors executes no filesystem effects and creates no
receipts for them. Local move/delete choices remain outside this operation.

**0.20.11 extension.** Explicit recapture appends a saved-edit revision to the
previous captured branch, not to a resolution that was never applied locally.
Keep the original application anchor and replace only the observed capture
precondition. Retain all pending capture bytes; require publication of a prepared
choice first. Refuse unfinished application intents and unchanged bytes. New
resolution remains mandatory, with existing branch/byte limits and no false
application receipt for the earlier published choice.


## ADR-054 — Receiver path effects have durable intent before source changes

**Status:** `ACCEPTED` · Implemented in 0.20.12.

**Decision.** Apply explicit move/tombstone resolutions only in a closed exclusive
core session, retaining captured bytes in history. A move creates the chosen target
without replacement before guarded removal of the original; its destination parent
must exist. Keep identity across recovery and persist the receipt only after all
effects. A tombstone receipt records completed removal; OS trash is not promised.
Collisions, drafts, changed identity and changed BaseRev refuse before mutation.
A durable intent authorizes recovery of partially completed effects. General
rename cycles and automatic source deletion capture remain separate work.

## ADR-055 — Pairing confirms observed identities within a pinned namespace

**Status:** `ACCEPTED` · Implemented in 0.20.12.

**Decision.** Pin the credential's exact workspace/subfolder scope and translate
all paths at the transport boundary. Preserve the server's global cursor even
when scoped pages omit publications. A fresh receive queue previews reconciliation
before confirmation: equal bytes may link identities, local-only files stage
uploads, remote-only files wait for application, and divergent bytes block.
Confirmation binds the snapshot and checks for unseen remote entries. Persist
pairing receipts/baselines with the client state atomically; never pretend that
older superseded publications were applied. Retaining both divergent files requires
an explicit local rename and fresh preview. No new server permission or endpoint
is introduced, and enrollment does not imply automatic two-way synchronization.

## ADR-056 — Explicit note effects use ordered recoverable publications

**Status:** `ACCEPTED` · Implemented in 0.20.13.

**Decision.** Missing inventory entries require an explicit current-head tombstone
request. Correlate closed rename cycles only with unique native identities and
unchanged bytes; order their publications through a temporary same-directory
path. Apply each effect with the existing exclusive core guards and durable
intent. Source capture never mutates user files. Ambiguous external cycles are
not inferred from hashes alone.

## ADR-057 — Referenced attachments travel with immutable note revisions

**Status:** `ACCEPTED` · Implemented in 0.20.13.

**Decision.** The shared Markdown parser selects local references. Capture exact
binary bytes through core, retaining optional bounded manifests with primary
and divergent revisions. Validate references, hashes and scope, including all
historical manifests. Keep Markdown unchanged. Apply attachments with individual
BaseRev checks and durable intents before the note receipt; interrupted bundles
resume but are not multi-file transactions. Preserve locally changed files and
retain branch exports. Do not delete assets merely because references disappear.

## ADR-058 — The desktop schedules transfer independently of source application

**Status:** `ACCEPTED` · Implemented in 0.20.14.

**Decision.** A native worker in `notes-sync-client` owns bounded transport passes,
serialized independently of the editor mutex. Persist one active queue and an
opt-in schedule, storing only the path to an operator-managed credential file.
Reuse the device transport's existing endpoint policy; note-derived URLs have
no access to this channel. Host observations are conservative and expire.
Pause cancels between requests; retries preserve original revision identities.
The worker never applies source effects, merges conflicts, or promises execution
after process exit. Desktop controls call typed individual IPC commands for
pairing, review, explicit application, capture/resolution and recovery exports.


## ADR-059 — Server rollback recovery replays only an exact retained prefix

**Status:** `ACCEPTED` · Implemented in 0.20.15.

**Decision.** Make older-server recovery an explicit CLI maintenance operation.
An unscoped queue audits the complete server prefix before and after a bounded
replay of original immutable publications. Never reset client cursors, choose a
winner, synthesize application or mutate source files. Re-send only current
durable previously acknowledged receipts after the retained history is restored. Preserve
normal permissions, device ownership and request limits. Operators pause other
publishers because the audit is not a server-wide transaction. Divergent,
foreign, scoped or locally incomplete history requires separate reconciliation;
this operation does not authorize pruning or older-client recovery.


## ADR-060 — Saved receiver edits are publications, not implicit file application

**Status:** `ACCEPTED` · Implemented in 0.20.16.

**Decision.** Capture already applied same-path receiver edits under existing
identity and closed-workspace guards. Use the applied revision as the causal
parent and retain one pending ordinary capture until publication. Confirm only
published bytes observed on disk, without rewriting source files. Preserve later
saved edits as subsequent publications and retain divergent branches for explicit
resolution. Desktop capture is a separate default-off setting and remains bounded
by the transfer scheduler. This extends transport while preserving ADR-058's
separation from source application. New paths, missing paths and open buffers do
not authorize automatic creation, movement or deletion.


## ADR-061 — Receiver additions and renames require independent capture choices

**Status:** `ACCEPTED` · Implemented in 0.20.17.

**Decision.** Extend ADR-060 with separate default-off choices for new local notes
and recognized renames. Presence of a new path alone does not grant publication
authority; existing saved-edit settings do not enable either choice. Use a closed,
draft-free core inventory to correlate identities, retain a causal root for a new
note and the original remote identity for a recognized rename. Confirm published
bytes through reads only. An empty receiver may bind application data without
source effects; a nonempty cache still requires explicit application. Missing
tracked notes block creation guesses, and occupied destinations never authorize
overwriting. Retention, deletion capture, ambiguous moves and open editor buffers
remain outside these choices.


## ADR-062 — Restored client recovery audits history without applying files

**Status:** `ACCEPTED` · Implemented in 0.20.18.

**Decision.** Provide explicit unscoped client recovery complementary to ADR-059.
Verify the complete retained prefix and recover one additional page per atomic
checkpoint. Only an identical full server publication clears a pending entry.
Preserve unpublished branches, captures and application receipts; never synthesize
application progress from downloaded bytes. Refuse mixed receipt/cache backups,
pending pairing and, in this block, scoped cursors. ADR-065 later extends the
same audit to the credential-visible sequence. Pause publishers because it
is not a server-wide snapshot. This does not authorize history pruning, identity
repair or replacement of local files after an application-data rollback.


## ADR-063 — Pruning starts with unanimously acknowledged resolved branches

**Status:** `ACCEPTED` · Implemented in 0.20.19.

**Decision.** The first sync retention operation removes payload bytes only from
divergent branches enclosed by a resolution that every known device has applied.
Keep their immutable revision metadata in the envelope, preserving ancestry,
tombstones, heads and append cursors. Require an offline, backed-up server and a
local operator command; do not expose pruning as credential authority. Revoked
devices continue to block pruning until a future explicit retirement protocol.

Receive queues compact only locally acknowledged resolutions whose exact
metadata-only server envelope they can fetch. They never infer server pruning
from a page or mutate source/application state. Accept an authorized original
envelope retry after server pruning without restoring payloads, preserving lost
storage-response idempotency. General linear-history pruning requires a future
baseline/cursor protocol and is not implied by this decision.


## ADR-064 — Device retirement requires prior credential revocation

**Status:** `ACCEPTED` · Implemented in 0.20.20.

**Decision.** Let an offline operator list registered sync devices and retire a
specific device only after revoking the credential that owns it. Hold the server
instance lock, remove only that device's owner binding and per-note application
receipts, validate and atomically replace the vault, and audit success. Keep all
revisions, payloads, tombstones, heads, cursors and other device receipts.
Expose no retirement endpoint to remote credentials. An unknown device, active
owner credential or concurrent server/backup refuses the operation. Returning
hardware enrolls as a new device; restoring the prior backup restores the old
registration. Zero remaining devices still authorize no pruning under ADR-063.


## ADR-065 — Scoped client recovery follows the visible sequence and absolute cursor

**Status:** `ACCEPTED` · Implemented in 0.20.20.

**Decision.** Extend ADR-062 client recovery to a queue with a pinned subfolder
scope. Compare every retained publication against the ordered sequence visible
to that credential, skip unfetched out-of-scope cursor positions, and checkpoint
the absolute server cursor. Require exact visible publications and the existing
queue scope on transport; preserve pending branches, application receipts and
source files. Pending pairing and mixed application backups remain invalid.
This visibility proof cannot establish the complete server prefix, so
`recover-server` remains restricted to unscoped retained queues. The operation
does not repair restored application identities or infer missing publications.


## ADR-066 — Linear retention keeps append positions and the live baseline

**Status:** `ACCEPTED` · Implemented in 0.20.22.

**Decision.** Extend the offline server retention operation to acknowledged,
strictly linear history. Keep every publication and revision in its original
append-log position, but replace eligible non-head payloads with a
`payload_pruned` metadata record. The current live head retains its content and
acts as the baseline for a newly enrolled receiver. Every known device must have
acknowledged the candidate or a descendant; a fork, merge, tombstone head,
unresolved branch, missing receipt or zero devices refuses linear compaction.

The client compacts only after fetching the exact server form, as with ADR-063.
A receiver that did not retain an old payload advances across its causal record
without changing source files and applies the later live baseline. Cursor values
and revision identities never move. This is payload retention, not history
deletion or restored-application identity repair.


## ADR-067 — Reconcile restored application identity explicitly

**Status:** `ACCEPTED` · Implemented in 0.20.23.

**Decision.** Provide a local `reconcile-application` operation for a fully
applied receive queue after its application data was restored. Re-observe each
live non-deleted receipt through the restored application registry, require its
current bytes and content hash to exactly match the immutable remote revision,
and replace only the receipt's operational `NoteId` and `BaseRev`. Refuse any
pending publication, capture, deferred work, interrupted effect, missing
payload, altered file, or non-receive queue. Deleted receipts remain historical
metadata and are never reinterpreted as local files.

The operation makes no network request and never writes a source file, changes
queue contents or cursors, or acknowledges a revision. This keeps restoration
repair explicit and prevents a mixed backup from silently choosing a source of
truth by timestamp.


## ADR-068 — PDF import saves reviewed plain text only

**Status:** `ACCEPTED` · Implemented in 0.20.27.

**Decision.** Select PDFs through the native dialog, extract only plain text in
the desktop backend, and show that text in an editable import view before any
workspace mutation. The source PDF remains outside the workspace and images,
layout and embedded files are not preserved. Only an explicit save creates a
new Markdown note; cancellation writes nothing. Bound the selected input to
32 MiB and refuse malformed or unsupported PDFs without guessing content.

## ADR-069 — Tura Notes branding preserves installed identities

**Status:** `ACCEPTED` · 11/09/2026

**Decision.** Adopt Tura Notes, the ribbon-T identity and the repository name
`tura-notes` for the owner-selected 1.0.0 release. Keep `br.com.samirhv.notes`,
the `notes` binary, internal package names and existing data paths to preserve
installed users' settings and workspace access. The major version does not
waive outstanding acceptance or security requirements. Editable SVG sources
and regeneration instructions live in [brand.md](brand.md).

## ADR-070 — macOS releases are signed, notarised and published by the local pipeline

**Status:** `ACCEPTED` · 11/09/2026

**Context.** [ADR-024](#adr-024--no-unsigned-macos-or-windows-artefact-is-published)
withheld every macOS artefact until one could be signed and notarised, and named
the missing pieces: an Apple Developer membership and a code-signing
certificate. Both now exist. What does not exist is a way to put that
certificate in CI without also putting it, and the app-specific password that
notarises with it, into repository secrets — and the macOS job in `build.yml`
has sat behind `if: false` since it was written, so nothing has ever shipped for
macOS at all. Meanwhile the rest of the fleet had already answered the same
question: `shvia-desktop` and `sshvterm-desktop` package, sign and publish from
the maintainer's Mac, because that is where the certificate lives.

**Decision.** `build-local.sh` is the macOS release pipeline. It reads the
`Developer ID Application` certificate and the notarisation credential from the
**keychain** of the machine that builds, signs and notarises the `.app`, staples
the ticket into the `.dmg`, records a `.sha256` beside it, and — with
`--publish` — uploads it to samirhv.com.br through `php artisan files:add`,
reading the hash back from the server first (until 1.1.14 it read back
afterwards, which published a truncated image before noticing). **It refuses to publish an
unsigned or unstapled image**, which is ADR-024 enforced by the tool rather than
by remembering it. Linux continues to be built and published by `build.yml`;
the macOS and Windows jobs there stay disabled.

**Consequences.** macOS releases depend on one machine being available, and that
is the trade: the alternative is a Developer ID private key in a CI secret,
which is a worse thing to own than a manual step. The certificate belongs to the
Blue3 team, so Gatekeeper shows that organisation as the signing authority of a
personally-authored application — accurate, and the only Developer ID there is.
The published macOS artefact is the Apple-silicon `.dmg`; an Intel build needs
a second run on, or a cross-compile for, `x86_64`. The download is served by
samirhv.com.br rather than attached to the GitHub Release, so the Release and
the downloads page carry different platform sets until CI can sign.

## ADR-071 — Packaging reads the bundler's filenames instead of asserting them

**Status:** `ACCEPTED` · 11/09/2026

**Context.** The Tauri bundler names the Linux desktop entry after
`productName`. `packaging/aur/notes-bin/PKGBUILD.in` and the Arch job's
post-install check both spelled `notes.desktop` out, so [ADR-069](#adr-069--tura-notes-branding-preserves-installed-identities)'s
rename to "Tura Notes" produced `Tura Notes.desktop` and the Arch job failed on
the one release that renamed the application. Release 1.0.0 therefore shipped
with a `.deb`, an AppImage and the tarballs, and **no Arch package** — and
because `.SRCINFO` is the sentinel `build.yml` uses for "already has its
artefacts", the gap was correctly detectable but nothing detected it.

**Decision.** Packaging takes the names the bundler produced rather than
restating them. The `PKGBUILD` installs whatever `share/applications/*.desktop`
is in the tarball under the same basename — the rule its icon loop already
followed — and fails loudly if there is none. The Arch job asserts that *an*
entry landed and that its `Exec=` launches the binary this package installs,
which is the property that has to hold; the filename is not.

**Consequences.** Arch and Debian install the same desktop file ID, because both
now come from the bundler. Renaming the product again changes that ID on both
platforms at once, which is visible and consistent rather than a build failure
on one of them. The generated tarball layout documented in
`packaging/linux/tarball.sh` no longer names the entry, because it cannot.

## ADR-072 — Local Linux packaging shares the desktop build entry point

**Status:** `ACCEPTED` · 12/09/2026 · Build reuse amended by ADR-073.

**Decision.** Extend ADR-070 with a Linux dispatch in `build-local.sh` and a
`deploy.sh` compatibility entry point. The existing macOS pipeline remains
responsible for Apple signing and notarization. Linux uses `tools/build-linux.sh`
to build deb/AppImage by default and optional rpm, with a separate compilation
cache per native Rust host. Linux CI packaging remains available.

**Reason.** The previous unconditional Darwin check prevented local Linux builds.
Native Linux builds need distribution development libraries, not Xcode or Apple
credentials. Each run clears package files only in its dedicated output folders
before building, preventing stale outputs from being reported or published.

**Consequences.** Linux always rebuilds packages while reusing Cargo's compilation
cache. Publication is opt-in and verifies uploaded bytes before invoking the
existing `files:add` ingestion. No updater signing, Arch package assembly or
cross-compilation is introduced by this script. Existing CI handles Arch packages.

## ADR-073 — Persist completed Linux builds before publication

**Status:** `ACCEPTED` · 12/09/2026

**Decision.** Replace ADR-072's unconditional Linux rebuild with per-format
completed-build manifests. Verify version, host, source content and artifact
hashes before compiling. Persist the manifests before SCP or ingestion so failed
publication cannot invalidate a successful build. `--force` overrides reuse.

**Reason.** The owner's ShvIA reference workflow supports retrying publication
without rebuilding the same version. Build completion and upload completion are
separate states. Comparing source contents also detects deletion and edits with
preserved timestamps. Missing or unverifiable manifests require a fresh build.

## ADR-074 — Signed desktop updates with explicit installation

**Status:** `ACCEPTED` · 12/09/2026

**Decision.** Reverse the MVP's no-updater boundary and ADR-072's exclusion of
updater signing. Add the Tauri updater in the native desktop shell. Check after
20 seconds and every six hours; expose manual checks in Welcome and Settings.
Offer installation and restart explicitly, after the normal workspace-close
flow and the input/IPC barrier. Automatic network failures remain silent.

**Reason.** The owner requested ShvIA Desktop's update workflow. Updater trust is
independent of Apple signing: Tura has its own pinned public key and a private
key outside the repository. No generic updater capability is granted to the
webview. Update signatures are verified before installation.

**Consequences.** Local signed builds produce durable payload/signature records;
repeated publication reuses them without compiling or needing the private key.
Separate HTTPS feeds identify platform, architecture and installer type. Publish
payloads with verified hashes before atomically replacing each feed. Arch uses
pacman; mobile and unpublished Windows installers are outside this delivery.
The first updater-capable release must be installed manually. Installed upgrade
acceptance remains distinct from compilation, signing and transport tests.

## ADR-075 — The root jail is enforced again at the open, not only at the path

**Status:** `ACCEPTED` · 15/09/2026

**Decision.** Keep `LocalFs::resolve` as the path half of the jail and add a
second enforcement at the moment of use. Reads open with `O_NOFOLLOW` on Unix
and report `ELOOP` as `SymlinkNotFollowed`, the same error `resolve` produces.
The atomic write's temporary file is unlinked and then created with
`O_CREAT|O_EXCL` instead of `O_CREAT|O_TRUNC`. Windows keeps the path half only.

**Reason.** `resolve` checks each segment with `symlink_metadata` and returns a
path the caller then hands to `fs::read` or `fs::File::create`, both of which
follow symlinks. Everything between the check and the syscall is a window, and
this product's premise is that other tools write in that folder — a sync client,
a `git checkout`, a restore — so the window is ordinary rather than adversarial.

The temporary file was the concrete hole, and it needed no race at all. Its name
is deterministic by design (`.{name}.tmp`, so a crash leaves at most one), which
makes it predictable; a symlink left at that name received the next save's bytes
at whatever it pointed to, outside the root, through a path the jail had already
approved. `a_symlink_at_the_temp_path_never_receives_the_write` in
`crates/notes-fs/tests/jail.rs` fails against the previous code with the write
landing on the outside file, and passes now.

**Consequences.** `libc` becomes a direct Unix-only dependency of `notes-fs`,
for `O_NOFOLLOW` and `ELOOP`; it was already in the tree through `tempfile`,
`uuid` and `notify`, so the build gains nothing but the use becomes visible.
A write whose temporary path is taken in the instant between the unlink and the
exclusive create is refused rather than redirected — the safe direction. A
divergence check that meets a symlink reports `Diverged`, so the write is
refused rather than following it.

**What this does not close, stated plainly.** Only the final component. A
directory in the middle of the path swapped between `resolve` and the open is
still followed. Closing that requires `openat2(RESOLVE_NO_SYMLINKS)`, which is
Linux 5.6+ with no macOS equivalent, and would buy one platform rather than the
jail; a portable `openat` walk is the alternative if this is ever revisited.
Windows has no `O_NOFOLLOW` at all, and `FILE_FLAG_OPEN_REPARSE_POINT` opens the
reparse point rather than refusing it, which would return the link's own bytes
as the note — worse than the gap. `docs/security.md` records the boundary in the
control table rather than leaving the row claiming more than the code does.

## ADR-076 — The cloud copy of the notes is a co-tenant on the site's own server

**Status:** `ACCEPTED` · 15/09/2026

**Context.** "Store the `.md` files in the cloud" has had an implementation
since 0.18.0 and no deployment. `notes-server` is the process
([ADR-043](#adr-043--a-separate-owner-operated-rest-server-reuses-core-policy)),
sync 0.6 is the transport, and `server/compose.yml` is the way to run them —
but that stack assumes the host is the server's: Caddy binds 80 and 443 and
talks to `notes-server` on a private Docker address. The host this project
actually has is the one already serving samirhv.com.br, where the download
service that `--publish` ingests into lives. Both ports are taken, and a second
machine to avoid sharing one is a machine to pay for, patch and back up.

**Decision.** The supported second deployment is the native binary on loopback,
run by systemd, with the host's existing TLS front proxying one name to it —
`server/cotenant/` carries the unit and both front templates, and
`docs/SERVER-0.5.md` documents it beside the Compose stack rather than instead
of it. Nothing in the server changed: `NOTES_SERVER_BIND` and
`NOTES_SERVER_TRUSTED_PROXY` already describe exactly this, and the trusted
proxy is what turns the front's configuration from advice into a precondition.

**Reason, and why it is not just "run the container on another port".** Docker
rewrites the source address of a published port, so a container reached at
`127.0.0.1:8787` sees the bridge gateway as its peer, not loopback — the trusted
proxy would have to name an address that changes with the network, and naming it
wrongly fails closed on every request. The native binary has no such gap: the
peer *is* 127.0.0.1 and the unit says so. The sandbox costs nothing to state
there either, and says something the container could not: `IPAddressDeny=any`
with `IPAddressAllow=localhost`, which is a server holding private notes that
cannot open an outbound connection at all.

**Consequences.** Three properties of this mode are invisible until they fail in
production, so `server/tests/cotenant.py` runs a real process and asserts each,
then asserts the templates still carry the directives that produce them.
`/healthz` sits *behind* the proxy gate, so the obvious monitoring probe reports
a healthy server as down; `Origin` must be stripped by the front or every
request from anything that sets one is refused; and the 1 MiB nginx body default
refuses an attachment bundle before the server sees it. The per-address rate
budget collapses to the proxy's address, exactly as it already does behind the
bundled Caddy, and the per-credential budget remains the one that separates
devices.

**The reachability choice is the owner's and is not reversible without
re-pairing.** `notes-sync-client` treats `100.64.0.0/10` as private, so a name
that resolves to a tailnet address needs `--allow-private` at pairing time,
while a public name needs nothing. A phone off the tailnet is the case that
decides it, and **the owner chose the public name on 15/09/2026**:
`tura.samirhv.com.br` at the public address, an ACME certificate for it, and
pairing with no flag. The tailnet path stays documented because choosing it
later means re-pairing every device, which is the kind of cost that has to be
written down before it is paid.
[ADR-007](#adr-007--the-desktop-app-opens-no-network-port-by-default) is
untouched either way — the desktop app still opens no port; this is a separate
process on a separate machine.

## ADR-077 — A rename refuses an occupied destination in the syscall, not before it

**Status:** `ACCEPTED` · 16/09/2026

**Decision.** `LocalFs::rename` asks the operating system for an exclusive
rename — `renameat2(RENAME_NOREPLACE)` on Linux and Android,
`renamex_np(RENAME_EXCL)` on macOS and iOS, `MoveFileExW` with no
`MOVEFILE_REPLACE_EXISTING` on Windows — and reports `AlreadyExists` from its
`EEXIST`. Where the call reports that the filesystem does not implement the flag
(`ENOSYS`, `EINVAL`, `ENOTSUP`), it falls back to the previous check-then-rename
rather than refusing the operation.

**Reason.** It was `b.exists()` and then `fs::rename`, and everything between
the two was a window. `fs::rename` *replaces* the destination on every platform
— that is what POSIX `rename` and `MOVEFILE_REPLACE_EXISTING` both mean — so
anything that created `b` in that gap had its bytes deleted with no error raised
anywhere. This product's premise is that other tools write in that folder: a
sync client, a `git checkout`, a restore, Dropbox. The window is ordinary rather
than adversarial, and what it costs is a file the user wrote, which is
[ADR-001](#adr-001--markdown-files-on-the-filesystem-are-the-source-of-truth)
failing silently.

The shape is [ADR-075](#adr-075--the-root-jail-is-enforced-again-at-the-open-not-only-at-the-path)
again, one operation along: a check that approves a path, then a syscall that
acts on the name rather than on what was checked. And `create_new` in the same
file had already answered it for creation, with `persist_noclobber`.

**The fallback is a decision and not an oversight.** `RENAME_NOREPLACE` is not
implemented by every filesystem — some network mounts and older overlay setups
answer `EINVAL` — and a rename that refuses there would break renaming on those
volumes to protect against a race. The fallback is exactly what shipped before,
so those volumes are no worse off, and every other one loses the window.

**Consequences.** `MOVEFILE_COPY_ALLOWED` stays off on Windows, so a rename
across volumes now fails rather than silently becoming a copy; a move inside one
workspace root never crosses one. The unit tests assert the primitive rather
than the race — that the syscall refuses and leaves the destination's bytes, and
that it still renames when the destination is free — because the destroying case
needs a window no test can schedule reliably, and asserting through the public
`rename` would have passed against the broken code too.

## ADR-078 — The watcher is established on its own thread, on every platform

**Status:** `ACCEPTED` · 16/09/2026

**Decision.** `notes_fs::watch()` creates the backend and installs the root
watch on the watcher's own thread on every platform, not only where
`PER_DIRECTORY` makes a walk necessary. `Watch::degraded` stops being a field
known at construction and becomes a method reading a slot in the counters, the
way `walking` already worked; `WatchProgress` carries it, so `watch_status()`
reports it. `walking` now means "the watch is still being set up", which on
Linux still includes the per-directory walk under the root.

**Reason.** [D-09](DECISIONS-0.1c.md) moved the per-directory walk off the
caller's thread on Linux because `RecursiveMode::Recursive` installed one
inotify watch per directory inline, and on a large folder that was minutes with
the service mutex held. D-10 recorded that macOS and Windows have no walk — one
handle covers the subtree — and the module's comment concluded that the same
call was therefore `O(1)`.

That is true of handles and was never true of time. Measured on macOS:
**280 ms for a workspace with 0 directories, 281 ms for one with 3 600.**
Constant, and constant is not free. The cost is inside `FSEventStreamCreate`
and the run loop `notify` waits to have scheduled, and `commands.rs` held
`app.svc` across it while the frontend awaited it on workspace open — so every
IPC command queued behind those 270 ms. It is exactly the hazard D-09 removed
from Linux, left intact on macOS because the reasoning stopped at "no walk".

`deep.rs` had been failing on this for some time, and its assertion message —
"it is walking the tree inline" — pointed at a walk that does not exist there,
which is part of why it stayed.

**Consequences, and one of them is a real loss.** A change made between
`start_watch` returning and the handle existing is **not seen by the watcher**.
It is seen by the 5 s poll and the scan on focus, the same two mechanisms that
already cover a watch lost silently, so the window costs latency rather than a
missed change — but it is a window that did not exist before, and it is why the
two watcher tests in `reconcile.rs` now wait for `walking` to clear before they
write. A test that did not wait would be asserting the poll while claiming to
assert the watcher.

`start_watch` therefore usually returns `None`: not "this platform can watch"
but "no answer yet". Only a failure visible without waiting — a thread that
will not spawn — still comes back from the call. The interface reads the reason
from `watch_status()`, which it was already polling for coverage, and the
frontend keeps a reason from the start call rather than letting a later poll
clear it.

## ADR-079 — The About dialog is ours, and Help is where it opens

**Status:** `ACCEPTED` · 16/09/2026 · reverses the approach shipped in 1.3.9

**Decision.** Replace the platform's About panel with a dialog of ours on every
desktop platform. Tauri's default Help submenu is emptied and given one item,
`about`, which emits `menu://about` to the frontend; the frontend opens
`AboutDialog`. macOS keeps the system About in its application menu, which
belongs to the system and is left alone. The dialog states the version, the
platform, the engine, the data directory and the open workspace, and copies
those same lines to the clipboard. Its copyright line is read from
`bundle.copyright` rather than written in the component.

**Reason.** 1.3.9 put `PredefinedMenuItem::about` in Help, on the argument that
the panel already carries the name, the version and the copyright and that a
dialog of ours would be one more thing to translate, style and keep in step.
That argument answers only the question the owner asked first — *which version
am I on* — and the platform panel answers nothing else. The questions that
actually arrive with a problem have no surface anywhere in the application:
which engine is drawing this window, where the data directory is, which folder
is open. They were readable, if at all, from three different screens, and a
person reading five values off three screens transcribes one of them wrong.

The Copy button is the reason the dialog exists rather than a convenience on
top of it. These lines are written down in order to be sent to somebody else,
and the platform panel cannot be copied at all.

**Consequences.** The shell emits one event to the frontend — the first
Rust-to-frontend event in this application, where every other exchange is the
frontend asking and a command answering. A command cannot carry this one: the
menu is on the shell's side and nothing in the WebView knows it was clicked.
`core:default` already includes `core:event:default`, so listening grants no new
capability and `capabilities/default.json` does not change (golden rule 7).

The menu is built by appending to `Menu::default` rather than by constructing
one, because the default carries Edit with cut, copy, paste and select-all, and
a WebView whose menu loses those loses the shortcuts with them. The item's label
is English like the rest of the native menu, which Tauri builds in English;
translating one item inside an English menu reads worse than not translating it.

`EnvReport` grows two fields, and it is the one IPC shape the frontend
hand-writes. `tools/tests/test_env_report.py` compares the two declarations by
name, because a field added on one side only is invisible rather than broken.

---

## ADR-080 — A timing criterion is asserted where its numbers came from, and published everywhere else

**Status:** `ACCEPTED` · 17/09/2026 · amends
[ADR-034](#adr-034--the-tree-appears-in-under-a-second-at-any-size-whole-tree-work-is-background-work)
· amended by [ADR-095](#adr-095--a-timing-criterion-is-asserted-as-its-mechanism-and-its-time-is-only-published)

**Context.** ADR-034's first rule is an acceptance criterion: `workspace_open`
returns and the tree appears in **under one second, at any size**. It was
asserted as a wall clock on every platform, in
`deep.rs::the_tree_appears_in_well_under_a_second`.

On `windows-latest` the same 2 160 directories that open in ~10 ms on the
owner's machine took **1 243 ms**, and the commit it failed on touched a
Linux-only test file, a queue row and `Cargo.lock` — nothing that could slow an
open. The following commit was green and the one after it red again, on a
different test. The number was not reporting the code; it was reporting a
contended shared runner with a virus scanner mid-scan on a tree created
milliseconds earlier.

**Why that is not a small problem.** This repository has just paid for the
answer. `cargo audit --deny warnings` sat red on eight advisories nobody could
act on, and a real `rustls` TLS 1.3 handshake flaw — on the path every device
sync request and every signed update download takes — lived inside that red for
two versions before anyone read past it (1.4.4, 1.4.5). A check that is red for
a reason which is not the code does not merely annoy: **it spends the attention
that the next real finding needs.** `tools/check.sh` has said so in its own
header since it was written.

**Decision.** The criterion does not move. Where the number is a *verdict*
does.

1. **The one-second ceiling is asserted on Linux.** It is the platform the rule's
   numbers were measured on — `DECISIONS-0.1c.md` D-09, `fixtures/deep`, the
   per-directory inotify walk that caused the freeze in the first place — and
   the least contended of the three runners.
2. **Every platform measures it and publishes the measurement into the CI job
   summary**, with its directory count and whether it was asserted. A criterion
   that stops being asserted must not stop being *visible*: an unmeasured
   criterion decays faster than a flaky one, because nothing reports its drift
   at all.
3. **A test that is intermittent on one platform is ignored on that platform,
   with the investigation queued and named in the `ignore` reason** — never
   weakened, and never ignored everywhere.
   `control::tests::received_bytes_remain_pending_until_explicit_application`
   is the first: `#[cfg_attr(windows, ignore = …)]`, intact on Linux and macOS,
   queued in `.continue/README.md`.

**Consequences.** A regression that slows `workspace_open` on macOS or Windows
without slowing it on Linux is a row in a job summary rather than a red build.
That is a real reduction in coverage and it is the price: the alternative was a
red that had already been overridden in practice, and a red nobody acts on is
zero coverage wearing the costume of full coverage. The owner's acceptance walk
(`ACCEPTANCE-0.1b.md` §6, `ACCEPTANCE-0.1c.md` §3) is where the criterion is
judged on real hardware, and that was always true — the automated check was
never the thing the promise rested on.

**What this is not.** It is not a licence to move an assertion to a friendlier
platform whenever it goes red. The test here was measuring the runner and not
the code, demonstrably: same input, three different verdicts across commits that
could not have changed it. A test that fails because the code is slow on one
platform is a bug on that platform, and it is fixed there.

---

## ADR-081 — The server binary is signed with a key CI never holds, and a deploy that cannot verify changes nothing

**Status:** `ACCEPTED` · 17/09/2026 · extends
[ADR-074](#adr-074--signed-desktop-updates-with-explicit-installation) to the
server artifacts · implemented at 1.6.0, except the key itself: `minisign` is
generated once by the owner and the deploy **refuses to install** until the
public half is committed and a release is signed.

**Context.** `server/cotenant/deploy-server.sh` downloads
`notes-server-X.Y.0-x86_64-linux.tar.gz` and its `.sha256` from the same GitHub
Releases URL, verifies the checksum, and installs the binary into
`/usr/local/bin`. `.github/workflows/build.yml` produces both in one step, on
one runner, and uploads them together.

**The checksum answers "did this arrive intact", and nothing else.** It is
generated beside the artifact it describes, published beside it, and fetched
beside it, so anyone in a position to serve a different tarball is in a position
to serve its matching digest. The script's own comment claims only truncation,
and is right to; this ADR is about the claim nobody was making.

ADR-074 already settled the principle for the desktop: a pinned public key, a
private key outside the repository, signature verified before installation. The
server did not get it, and the reason is not a difference of principle but of
**where each artifact is built**. The macOS and Windows jobs are `if: false`
(ADR-024) and those bundles are produced by `build-local.sh` on the owner's
machine — where the key is. The Linux job runs in CI, where it is not.

What the artifact controls raises the stakes rather than lowering them: the
binary is a long-lived daemon holding every note of every paired device, running
on a host that also serves eight other sites.

**Decision.** Three questions, because "sign it" answers none of them.

### 1. The private key never enters CI

A key in a GitHub Actions secret is usable by anything that can cause a workflow
to run, which includes a change to the workflow itself. Signing there would move
the trust boundary from GitHub-the-CDN to GitHub-the-CI and call it provenance:
the signature would attest that a workflow ran, which is what the checksum
already attests to.

**The key lives where ADR-074's does — outside the repository, on the owner's
machine** — and it is a **separate** key from the updater's. The updater key is
embedded in every installed desktop application; a key that can push desktop
updates and server binaries is one compromise with two blast radii, for no
saving. The public half is **committed**, so the host verifies against a pinned
value rather than one it downloads alongside the thing it is checking.

**minisign**, for the same reason Tauri's updater uses it and because Debian
packages it: the verifier on the host is a shell script, not a Rust binary that
would itself need to be delivered and trusted first.

### 2. The published artifact is signed locally; CI keeps building it

CI continues to build and attach `notes-server` on every minor bump. What is
added is that the **signature** is made offline, by the owner, with the key
above, and uploaded beside the asset — so installing a server binary requires an
act a person performed and CI cannot forge.

> **Corrected 17/09/2026, before first implementation.** This clause originally
> read *"the Release asset is **produced** and signed by the same local act that
> already produces the desktop bundles"*. Implementing it showed that act does
> not exist: neither `build-local.sh` nor `tools/build-linux.sh` builds
> `notes-server` at all, and what they publish goes to the owner's own download
> service, not to GitHub Releases. The clause described a path that would have
> had to be invented, and it was written from the principle without checking
> that the local act reached Releases.
>
> **What the correction costs, stated rather than glossed:** a compromised CI
> could produce a malicious tarball that the owner then signs without having
> built it. What it still closes — and what the finding was actually about — is
> **substitution of a published asset**, which the same-origin checksum could
> never detect. `tools/sign-server-release.sh` verifies the checksum before
> signing, and building from source with `cargo build --locked -p notes-server`
> remains available to anyone who wants the stronger guarantee.
>
> The correction is written **inside this ADR** rather than as ADR-082, which
> departs from the house norm of amending with a new ADR — deliberately, and
> only because this one had never been implemented: two documents describing one
> decision that had no implementation would cost a reader more than it tells
> them. An implemented decision gets the new ADR.

The `.sha256` stays. It is still the right tool for a truncated download, it
fails faster and with a clearer message than a signature check, and a deploy
that has to distinguish "the network cut out" from "this is not our binary" is
better for having both.

### 3. A deploy that cannot verify changes nothing, and does not stop the service

Verification happens **before anything touches `/usr/local/bin`** — the same
ordering the checksum already has, which `server/tests/cotenant.py` already
asserts and which extends to cover the signature.

On failure the deploy **exits non-zero, names the artifact, and leaves the host
exactly as it was**: the running service keeps serving the binary it already
has. It deliberately does *not* stop the service as a precaution. A signature
mismatch is far more likely to be a publishing mistake than an attack, and
converting one into an outage of the notes of every paired device — on a host
that is already serving — is a second failure caused by the first. Refusing to
install is the whole of the protection; stopping is a different decision nobody
asked for.

**Consequences.** The owner cannot publish a server binary from a machine
without the key, which is the point and is also a single point of failure: the
recovery path is the same as the updater's, and it is key rotation with a
committed public half, not a bypass. `deploy-server.sh` gains a `minisign -V`
against the pinned key and a `minisign` dependency on the host. Hosts running a
binary published before this ADR keep running it; the first signed release is
the first one a deploy will verify.

**A precondition this ADR does not itself fix.** 1.4.0 and 1.5.0 carry **no**
server tarball at all: `build.yml`'s `concurrency: cancel-in-progress: true`
cancelled the minor's artifact build when the next push arrived, and every
version after it was a patch, which deliberately builds nothing. The workflow's
comment accepts that "an intermediate version can end up with no artifacts" on
the grounds that "what has to be installable is the newest" — which does not
hold for **minor** versions, because the newest is usually a patch and patches
never rebuild them. Signing an artifact that is not being published is not worth
doing first; that is queued separately.

## ADR-082 — The renamed package takes over the one it was renamed from, and the binary keeps its name

**Status:** `ACCEPTED` · 17/09/2026 · completes
[ADR-069](#adr-069--tura-notes-branding-preserves-installed-identities) ·
implemented at 1.6.1

**Context.** ADR-069 renamed the product to Tura Notes and deliberately kept
`br.com.samirhv.notes`, the `notes` binary and the existing data paths, so that
an installed user's settings and workspace survived the rebranding. One name it
did not consider is the one nobody writes down: **the bundler derives the Debian
package name from `productName`**, so the package became `tura-notes` at 1.0.0
while every path inside it stayed exactly as it was.

dpkg does not own files, packages do. Installing 1.3.6 over an installed
0.11.11, on 16/09/2026:

```
dpkg: error processing archive TuraNotes_1.3.6_amd64.deb (--install):
 trying to overwrite '/usr/bin/notes', which is also in package notes (0.11.11)
```

and the three `notes.png` icons are the same collision, one step behind the
binary. **So the identity ADR-069 set out to preserve is precisely the identity
that blocks the upgrade** — and it blocks it in the one place the project never
looks, because nothing in the build, the gate or CI ever installs a package over
an older one. The deb has been unable to land on a pre-1.0.0 machine since 1.0.0 —
sixty-six versions across six days — and the way it was found was the owner
typing `dpkg -i`.

The in-app updater installs the deb the same way, so the same wall stands there
— though no 0.x machine reaches it, updates arriving only from 1.1.0 onward
([ADR-074](#adr-074--signed-desktop-updates-with-explicit-installation)). A
manual install is the only path onto those machines, which is why this surfaced
there.

**Decision.** **The rename is declared, not performed.** The deb states what
happened in the fields Debian reads for exactly this:

```
Conflicts: notes (<< 1.0.0)
Replaces: notes (<< 1.0.0)
```

**Both, because each alone is the wrong half.** `Conflicts` by itself refuses
the installation, politely and permanently. `Replaces` by itself permits the
file to be overwritten while the old package stays installed, still claiming
`/usr/bin/notes` and still shipping a `notes.desktop` pointing at it. Together
they are the one operation dpkg performs without being forced: remove the old
package, install the new one. `--force-overwrite` reaches the same screen and
leaves the machine in the state `Replaces` alone produces.

**The bound is `<< 1.0.0` and the claim reaches no further.** Every release that
carried the old package name was a `0.x` — 0.11.11 was the last — and `notes` is
a generic enough name for the archive to hand to somebody else one day. An
unbounded `Conflicts: notes` would silently remove *their* package on any
machine that had it. There is no `Provides`: nothing depends on the old name.

**Not rpm, and not the AUR.** rpm packaging arrived at 1.0.3, after the rename,
so no rpm has ever carried the old name and an `Obsoletes` written for symmetry
would claim a name this project never published there. The AUR package kept its
`notes-bin` name throughout, so pacman upgrades it as it always did.

**Rejected: renaming the binary too.** It dissolves the conflict by dissolving
what ADR-069 was protecting — `notes` is the command installed users type — and
it leaves the old package installed forever, with a stale binary, because
nothing would then replace it.

**Consequences.** Installing over a 0.x machine now removes it and its desktop
entry as part of the unpack; user data is untouched, because no data of the
user's has ever been inside the package. A machine that already hit the error
keeps 0.11.11 until the next install, which is now the fix rather than a second
failure. A future Debian package named `notes` at a version below 1.0.0 would be
taken over by ours — accepted knowingly: the archive has no such package today,
and the alternative claims strictly more.

**What checks it.** `tools/tests/test_build_linux.py::DebianRename` asserts both
fields in the committed configuration, and asserts the binary name they exist
for is still `notes` — rename that, and the declaration has to be reconsidered
rather than carried along. The gate cannot install a package, so what it
protects is the declaration. The built 1.6.1 package was read back with
`dpkg-deb -I`, and `dpkg --dry-run --install` was run against the database of
the machine that still carries 0.11.11, which answered *"yes, will remove notes
in favour of tura-notes"*. The install itself needs root and remains an owner
step, in the queue with the other installed-release checks.

## ADR-083 — `.loop/` is versioned memory, in the language it is thought in

**Status:** `ACCEPTED` · 17/09/2026

**Decision.** `.loop/` is committed. It is not added to `.gitignore`, and it is
written in the language its author thinks in — the same ressalva `.continue/`
already has, rather than a fourth exception with its own criterion.

**Context.** The `loop-work` skill writes four things into `.loop/`: the queue it
is working from, an index of every stop, the archived report of each one, and
`ASSUMPTIONS.md` — the decisions an agent took **without the owner**, each with
its alternative and how to undo it. The directory was left untracked for a whole
round while the question was open.

**Why it is versioned.** `.gitignore`'s own header says a directory holding an
open question or a verdict is memory rather than execution, and that keeping one
out of git has already cost this fleet real work. `ASSUMPTIONS.md` is precisely a
ledger of verdicts, and it is the one artefact that explains *why* a series of
commits looks the way it does. Reading `git log` a year from now answers what
changed; only this answers what was decided instead. Leaving it on one machine's
disk makes the record of unsupervised decisions the most perishable thing in the
project, which is backwards.

**Why the language question was not obvious.** Everything in this repository is
English (US), with three carve-outs, and `.loop/` is none of them. Taken
literally that makes a Portuguese `.loop/` a violation. But the reason
`.continue/` is carved out applies here word for word: it is work being thought
through, written in the language the thinking happens in, and translating it
before the thinking is finished destroys the only place that thinking exists. A
stop report and a queue item are the same kind of artefact as a queue document —
unfinished, addressed to the next turn, not to a collaborator or a tool.

The line this draws is not "agent files are exempt". It is narrower: **a
directory whose content is work in progress rather than a product of the work**
is written in the author's language, and becomes English when its content
graduates into `docs/`, a commit message, or a changelog entry — exactly as
`.continue/` does. Everything `.loop/` produces already crosses that line as
English: the commits, the entries in `CHANGELOG.md`, the documents in `docs/`.

**Consequences.** `.loop/` is tracked from 1.6.19 and shows in `git status`
during a round; that is diff noise, which the `.gitignore` header already answers
as a commit-granularity question rather than a reason to ignore a file. The
directory is committed when a round closes, not on every stop, so it does not
compete with the commit of the work itself.

**This decision is local, and deliberately says so.** The language rule lives in
a marked echo block regenerated from
[samirhvbr/repodocs](https://github.com/samirhvbr/repodocs); nothing written into
that block survives the next fleet pass, so this ADR does not touch it. The
precedent is exact: `.continue/` in Portuguese and an item leaving the queue only
when built were decided **here first**, as
[ADR-009](#adr-009--an-item-leaves-continue-only-when-it-has-been-built) and
[ADR-010](#adr-010--continue-is-written-in-portuguese-everything-else-is-english),
and the fleet adopted both later. If this one is worth generalising, the route is
the same and it runs through repodocs, not through an edit here that would be
erased without anybody noticing.

---

## ADR-084 — A step that publishes, installs or deletes is verified by reading back what it changed

**Status:** `ACCEPTED` · 18/09/2026

**Decision.** A step whose purpose is to change something outside this
repository — publish an artifact, install a binary, delete a remote file — is
not considered to have run until the script reads the changed thing back and
checks it. Its own exit status is not evidence, and neither is its output. This
extends [security.md](security.md) §8's existing `HTTP 200` rule to the case
where the caller is a script rather than an auditor.

**Context.** `tools/updater-release.py` already did this: after writing a feed it
fetches the feed back over HTTPS, compares it byte for byte with the manifest it
generated, downloads the payload and checks its SHA-256. The download-service
ingestion beside it did not — it invoked
`php artisan files:add … --version=X` and read the exit status.

`--version` is a Symfony Console **global** option. `Application::doRun()` reads
it off raw argv before it resolves any command, prints the framework's long
version and returns 0. The step's entire output was
`Laravel Framework 13.12.0`. Zero is success, so the publisher deleted the staged
upload and announced a release, on both the macOS and the Linux paths, for six
releases — while `/p/tura-notes` said *In preparation* the whole time. `1.6.28`
renamed the option to `--file-version` on both call sites.

**Why the exit code cannot be the check.** The failure was not that the command
returned the wrong status; it returned the right status for what it actually did,
which was print a version string. A caller that trusts an exit code is trusting
the callee's model of what was asked, and the whole class of bug here is the
callee having a different model. Reading the result back is the only check that
does not share the caller's assumption.

**Why `set -euo pipefail` did not save it.** `tools/build-linux.sh` runs under it,
and the earlier reading that Linux had therefore been spared is wrong: the call
returned zero, so there was nothing for `-e` to catch. A shell option that aborts
on failure is not a substitute for asking whether the work happened.

**What it costs.** One extra request per publishing step, and a script that is
longer than the command it wraps. Against six releases that believed they had
shipped, that is not a trade worth thinking about.

**Consequence.** New publishing, deployment and destructive steps carry their own
read-back. Where the read-back is expensive or impossible, that is written down
at the call site as a known gap rather than left as a silent assumption — a step
nobody verifies is a step nobody knows the state of.

---

## ADR-085 — The quick-open cache drops when the tree has a different number of paths, not when a tick produced an event

**Status:** `ACCEPTED` · 22/09/2026 · amends
[ADR-032](#adr-032--quick-open-matches-a-cached-path-list-and-the-tree-invalidates-it)
and [ADR-034](#adr-034--the-tree-appears-in-under-a-second-at-any-size-whole-tree-work-is-background-work)

**Decision.** A reconciliation tick drops the cached path list when it produced
a user-visible event **or** when the full walk it just performed saw a different
number of paths than the cache holds. A hinted tick, which does not walk, drops
the cache only on an event. A list that is still filling is never restarted.

**Context.** ADR-032 says the cache drops on *"any reconciliation tick"* and
accepts the coarseness in as many words. ADR-034 amends that with exactly one
qualification — a walk still running is not restarted. The code carried a
second: both invalidations sat behind `if !events.is_empty()`, introduced in the
same commit that wrote ADR-034 and recorded in no ADR.

That guard is not equivalent to either ADR, because **`Created` is suppressed on
a full scan by design**, and `apps/notes-app/src/stores/sync.ts` polls
`reconcileAll` every five seconds with `full = true`. On a workspace with no
watch — a network mount, an exhausted inotify table, the SAF backend of 0.4 — a
note created by another program produced no event, so nothing was invalidated.
`Ctrl+P` answered from the list captured when the workspace was opened, and
`QuickOpen.building` was `false`, so the palette reported a **complete** list
that was not.

**Why not restore ADR-032 literally.** Invalidating on every tick puts the
background walk on a five-second treadmill over a folder that has not changed,
which is a cost ADR-032 accepted when ticks came from a watcher and the frontend
did not poll. It does now.

**Why the count.** A full scan walks the tree already, so its path count is
free, and a tree with a different number of paths is a tree the cache does not
describe. Appearing is what the count catches; vanishing already arrives as an
event, because a record that lost its file is a `Removed` or a correlation. The
two together cover the cases ADR-032 names, at the price of one `usize`
comparison per full tick.

**Consequences.** A create-and-delete inside one tick leaves the count
unchanged, and the deletion half produces an event, so the tick still
invalidates. A tick on an unchanged tree does not. The measurement that would
overturn this is a workspace where the count is stable while the shape is not
and no event is emitted; none is known, and if one appears the answer is to
compare a cheap digest of the walk rather than to return to invalidating on
every tick.

---

## ADR-086 — A device is accepted by its credential, one credential per device

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_dispositivo`

**Decision.** Holding a valid, unrevoked credential is the whole of device
acceptance. There is no separate per-device approval on the server. The model
that makes this workable is **one credential per device**: issued with a label
naming the device, so that revoking a credential revokes exactly one device.

**Context.** `.continue/0.6-sync.md` carried this as one of three product
questions the 0.6 gap turned on. Measured on 23/09: the server already keeps a
list of sync devices per workspace and can retire one (`notes-server
sync-device-list`, `sync-retire-device`), and revokes access per credential
(`notes-server token revoke`) — all from the command line on the host, none
from the application.

**Consequences.** The owner also asked for a screen listing connected devices
with revocation one at a time, "now if it can be done". It is round 7 item
R7-04, and it is bounded by `docs/security.md` §4.10: an administrative service
binds to loopback or a private interface, never to the public one. The sync
server is public. So R7-04 is not "add an admin endpoint"; it has to be either
a user-level action a credential may take over its own workspace's devices, or
an administrative surface that stays off the public interface. R7-04 writes its
own ADR choosing between those before any code, and if neither satisfies §4.10
it becomes a question for the owner rather than an exception.

---

## ADR-087 — Retention never purges on its own; the limits go up and the client warns before the 507

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_retencao`

**Decision.** The server never deletes a revision automatically, including one
every known device has confirmed. Purging stays the explicit, offline operator
act it already is. What changes is that the storage limits rise, with the
reason written beside the number, and the client warns ahead of the ceiling so
that nobody learns about it from a `507`.

**Context.** The second of the three 0.6 product questions. Automatic purging
after confirmation was the alternative, and it is the one that can delete the
only surviving copy of a branch when "every known device" turns out not to
include one that was offline for a month.

**Consequences.** Round 7 item R7-05 specifies the warning threshold and the new
limits in `SYNC-0.6.md` before touching code, because that document still names
retention as open.

---

## ADR-088 — The mobile transfer queue runs as background work

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_ciclo_movel`

**Decision.** When the operating system suspends or kills the mobile app mid
transfer, the queue resumes as scheduled background work — `WorkManager` on
Android, `BGTaskScheduler` on iOS — rather than waiting for the user to reopen
the app, and rather than leaving the phone without sync in the first usable
version.

**Context.** The third of the three 0.6 product questions. The durable outbox and
resumable passes from 0.20.x are what make resuming safe; this decides who
resumes them.

**Consequences.** Implementation is round 7 item R7-08, parked by environment:
it can only be seen running on the MacBook or on a device (ADR-092), and writing
mobile code nobody has executed is the problem `docs/ACCEPTANCE-0.4.md` already
records. With this ADR, all three questions in `.continue/0.6-sync.md` are
answered, and what remains there is specification to write, not a decision to
wait for.

---

## ADR-089 — Remote images load over https, and raw HTML obeys the same opt-in first

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_imagens` · built in 1.8.6, 1.8.7 and 1.8.8

**Decision.** The "allow remote images" opt-in stays, and works: `https:` is
added to the preview's `img-src`. **That change is the last of three and may not
ship before the other two.** A raw-HTML `<img>` must first go through the same
URL policy as a Markdown image (R6-23a), and must obey `remote_images` and be
reported in `Rendered.blocked_remote` (R6-23). Only then does the policy open
(R6-24).

**Context.** Today `img-src 'self' notes-asset: data:` (`ARCHITECTURE.md` §10)
blocks every remote image, so the opt-in can never show one: the user clicks
Allow, the blocked URL turns into a broken-image icon, and the banner goes away.
Removing the opt-in and fetching images in Rust were the other two answers.

**Consequences.** Opening `img-src` before raw HTML obeys the opt-in would turn
any `<img src="https://…">` in a note into a request the user never allowed —
a tracking beacon. The order in the queue is the safety of this decision.
`ARCHITECTURE.md` §10 changes in the same commit as R6-24, not before: a page
describing a policy that is not in force is the failure this repository's
documentation rules exist to prevent.

---

## ADR-090 — A file name that is not valid UTF-8 is carried as it is, and works

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_utf8` · built in 1.8.0

**Decision.** The filesystem adapter carries the raw `OsString` beside the
`RelPath` for every entry, so a file whose name is not valid UTF-8 can be
listed, opened, edited and renamed like any other note. Omitting such files and
listing them marked unreadable were the alternatives.

**Context.** Today such a file is listed under a lossy name, looks like a note,
and never opens; duplicating a folder that contains one stops halfway.

**Consequences.** This changes the `FileSystemAdapter` surface, which
`docs/versioning.md` makes a **Y** bump. It is last in round 7's queue for that
reason: a surface change should land on a quiet base, after the smaller items
that touch the same code.

**Mechanism, as built in `1.8.0`.** Not a second value carried beside every
`RelPath` — every adapter method takes a `RelPath`, and threading an `OsString`
through all of them would have changed each signature for a case most users
never meet. The raw name is carried **inside** the `RelPath`, reversibly: each
byte that is not valid UTF-8 is written as `U+FFFF` plus two lowercase hex
digits, and a literal `U+FFFF` as two of them. `U+FFFF` is a Unicode
noncharacter, legal in a string and not something a real name carries. Every
name that is valid UTF-8 — every name that existed before — is unchanged, so no
stored path, registry entry or sync history moves. The extension survives, so
`is_note` still works; the index, sync and MCP treat the path as the opaque
string they always did; and only `notes-fs` decodes, at the moment it touches
the disk. The owner's answer was about the outcome — *make these files work* —
and this is the realisation of it.

**The decoder is strict because its input may be hostile**: a path can arrive
from a sync peer, the REST API or an MCP client. An escape may only stand for a
byte `>= 0x80`, which is the only kind that can be invalid UTF-8 — otherwise
`U+FFFF` + `2f` would decode to `/` and leave the workspace. And a segment must
be canonical, exactly what the encoder would produce, or one file would have two
spellings and its identity, keyed by path, would split. `RelPath::parse` applies
both checks, so a malformed escape never becomes a path at all.

**Where such a file cannot exist, it is refused rather than approximated.** A
Windows name is UTF-16 and APFS rejects invalid UTF-8 at creation, so a note
with such a name that syncs to those platforms answers `Unsupported` there.

---

## ADR-091 — The application's own data can be removed from inside the application

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_dados` · not yet built

**Decision.** The product gets two actions: *forget this workspace*, and *remove
Tura's data*. Both refuse while a draft holds unsaved work, and say which. This
is chosen over documenting the directory, and over a package `postrm` purge.

**Context.** `~/.local/share/notes/` holds the full text of every note ever
opened (in the search index), drafts that by design never expire, conflict
snapshots, and the list of every folder ever opened. Nothing in the app, the
packages or the documentation names that directory, and uninstalling leaves it.
`docs/security.md` §9 requires that a request for deletion "has an owner and a
path"; an action in the product is the path that does not depend on reading
anything.

**Consequences.** It is a new destructive command, which is why the refusal is
part of the decision rather than an implementation detail: a draft is the only
copy of something the user typed. Round 7 builds it as R6-27, after R6-27a
gives the same directory `0700`/`0600` permissions.

---

## ADR-092 — Milestone 0.4 is exercised on the MacBook and on a physical Android device

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_04`

**Decision.** The mobile milestone stops depending on this Linux machine's
firmware. It runs on the MacBook — the Android emulator natively on Apple
Silicon, and the iOS Simulator — and on a physical Android device over USB.
Mobile work concentrates on the MacBook, which is also the iOS target.

**Context.** The emulator here needs KVM, and `kvm_amd` is refused because SVM
is disabled in the firmware (`docs/OWNER-ACTS.md` §3). On Apple Silicon the
Android emulator runs `arm64-v8a` system images through Hypervisor.framework and
needs no KVM at all.

**Consequences.** The UEFI step stops being the way forward, and queue item R4g
is closed by this decision rather than by being done. Round 7 item R7-03 writes
the MacBook runbook; running it is the owner's, because no agent on this machine
reaches the Mac.

---

## ADR-093 — An acceptance walk repeats on the next minor release

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_aceite`

**Decision.** Where an acceptance page says a walk is *repeated on the release
immediately after*, it means the next `X.Y.0`, not the next patch.

**Context.** With round 6 shipping a patch every few minutes, "the next release"
read literally would require a walk on each of them; read loosely it meant
nothing measurable.

**Consequences.** Round 7 item R7-02 changes the wording in every
`docs/ACCEPTANCE-*.md` and in `.continue/README.md`. No box is ticked by an
agent.

---

## ADR-094 — A receive barrier that cannot verify its reload keeps the lock and offers a restart

**Status:** `ACCEPTED` · 23/09/2026 · owner answer `q_barreira` · built in 1.8.1

**Decision.** When the verified reload after applying received revisions cannot
succeed, the barrier stays in place and the window offers *restart the
application*, writing the buffer as an exit draft on the way. Releasing the
barrier and degrading the note to a conflict was the alternative; leaving the
window inert with no way out, as today, is not an option.

**Context.** Finding 7 of the review: `apply()` reads the document before
acquiring the barrier, so a keystroke during the drain makes the identity check
fail for good, and "Retry safe reload" can never succeed.

**Consequences.** Round 7 item R6-07 builds both halves: re-reading the document
after the barrier is acquired, which needed no decision, and the restart that
this one chose.

---

## ADR-095 — A timing criterion is asserted as its mechanism, and its time is only published

**Status:** `ACCEPTED` · 23/09/2026 · amends
[ADR-080](#adr-080--a-timing-criterion-is-asserted-where-its-numbers-came-from-and-published-everywhere-else)

**Decision.** Where a test guards a timing criterion, it asserts the **mechanism**
that makes the criterion true, counted as events, and the elapsed time is
measured and published but is not a verdict on any platform. ADR-034's
one-second rule is asserted as *the open path reads a constant number of
directories, whatever the size of the tree*; the no-restart rule for the
quick-open walk as *no walk is replaced while it is still running*; the rate
limit as *sixty requests in a window of an injected clock*.

**Context.** ADR-080 kept the one-second ceiling asserted on Linux because the
Linux runner was the least contended of the three. Measured on 23/09, on code
that did not change between the runs: 15 ms at `1.7.18`, 295 ms at `1.7.19`,
1 113 ms at `1.7.20` — a failure — and 185 ms on a re-run of that same job. The
index test failed on Linux on `1.7.23`, a commit that changed only documents,
with the walk's count still climbing, which is what a walk that was **not**
restarted looks like. Two red runs out of three were the runner; ADR-080's own
reasoning — *a check that is red for a reason which is not the code spends the
attention the next real finding needs* — applies to Linux now as well.

**The better reason is that the timing assertion did not catch its own
regression.** With a synchronous walk of the whole tree injected into
`open_workspace` — the exact failure that froze `~/x` — the open took **38 ms**
on the owner's machine, comfortably under the ceiling. The read count went from
2 to 2 163 and failed at once. On a fast disk the clock is not a test of the
mechanism at all.

**Consequences.** Three assertions change: `deep.rs`'s two one-second ceilings,
the index-while-churning test, and the rate-limit test, which now drives an
injected clock and asserts the window's expiry as well — something the real
clock could never show deterministically. `LocalFs` counts the listings it
serves and the quick-open state counts its walks; both are per instance, because
a process-global counter read beside parallel tests is the flake `1.7.20` fixed.
The two `start_watch` and first-`quick_open` ceilings of 100 ms stay: they do no
I/O on the calling thread and have run at 0.07 ms, three orders of magnitude
inside the bound. The owner's walk on real hardware remains where the one-second
promise is judged.
