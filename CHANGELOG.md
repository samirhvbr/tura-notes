# Changelog

Entries in the commit-message format (`version - short description in English`, see
[docs/versioning.md](docs/versioning.md)), newest first. **Each `##` heading is
literally the commit subject** — this file is the handoff artefact between
whoever does the work and whoever commits it.

Bodies are narrative: what changed, why, and what was measured. This file is
never rewritten.
## 1.6.51 - the remote MCP smoke ran in the gate and in no workflow

`.github/workflows/ci.yml` carries a comment explaining why some checks are
duplicated there rather than left to `tools/check.sh`: *"lists drift: every
check below existed in `check.sh` and in no workflow, so a pull request that
broke one was merged green."* Measured against the two lists, it had drifted
again — four scripts deep.

Three are mine, added today: `doc-links.py`, `adr-status.py`, `doc-index.py`.
**The fourth is older and worse: `server/tests/mcp.py`**, milestone 0.7's only
end-to-end proof — a real process, a real handshake, the catalogue filtered per
credential, an unauthenticated call refused — ran locally and in no workflow at
all. A pull request breaking `POST /v1/mcp` merged green, and had been able to
since `1.6.5`.

It now runs in `server HTTPS container`, beside `cotenant.py`: both want the
`target/debug/notes-server` that job already builds, and neither wants the
compose stack.

**And the list stops being maintained by memory.** `tools/ci-parity.py` reads
every `tools/…` and `server/tests/…` script out of `check.sh` and fails unless
each appears somewhere under `.github/workflows/`. It deliberately does not check
*how* or *in which job* — placing a check is judgement about toolchains,
containers and what is on disk, and only presence is mechanical. A script that
genuinely must not run in CI goes in `EXCLUDED` **with its reason**, which turns
an invisible omission into a sentence somebody wrote.

Proved non-vacuous: deleting one line from the CI list makes it fail by script
name, and restoring it passes at 19 scripts.

## 1.6.50 - three documents were not in the index, and one of them I wrote

`docs/README.md` is the index — the page somebody opens to find out what has been
written down here. Three pages were not in it: `OWNER-ACTS.md`, `MOBILE-0.4.md`
and `brand.md`.

**`OWNER-ACTS.md` is mine.** Written at `1.6.20`, extended at `1.6.31`, cited
from `ACCEPTANCE-0.5.md`, `ACCEPTANCE-0.4.md` and the queue — and never added to
the index, across four days and two passes that were otherwise careful about
fixing what they made stale. A document found only by somebody who already knows
its filename is, for a record that exists to be found, close to not having been
written.

`tools/doc-index.py` joins the gate: every `.md` at the top of `docs/` is linked
from the index. Proved non-vacuous — an empty page dropped into `docs/` fails it
by name and removing it passes.

`docs/history/` stays out of scope on purpose. The index links that directory as
a whole and says why: superseded planning drafts kept for provenance, never
implementation authority. Listing three dead pages beside thirty live ones in the
place a reader browses would make the index worse, not more complete.

One same-pass repair caught while editing the file: the *where a new document
goes* table still said an ADR is recorded `ACTIVE`, which `1.6.49` changed to
`ACCEPTED` an hour earlier. It now names all four ADR words and says they are
deliberately not the five a document carries.

## 1.6.49 - the decision record used two words for the same state, twenty-six times

`docs/decisions.md` is the file every *"do not re-litigate a decided direction"*
points at, and its status line is how a reader tells a decision in force from one
that was replaced. It carried two words for the same state: `ADR-043` through
`ADR-068` — one contiguous block of twenty-six — said `ACTIVE`, and every ADR on
either side of that block said `ACCEPTED`. `ADR-039` said
`Accepted, implemented in 0.14.0` in a third shape again.

This is the argument `tools/doc-status.sh` already makes about the other
vocabulary, one file along: a second word for one state is a word the reader has
to interpret rather than look up.

**The ADR words are deliberately not the document words, and that is now written
down.** A document is `ACTIVE` because somebody is deciding whether to build
against it *now*; an ADR is `ACCEPTED` because a decision was taken *then*, and
it stays taken after something replaces it. `ACTIVE` on an ADR reads as a claim
that the decision is still in force — a claim about the code, when the ADR is the
argument for that code rather than a report on it. The preamble names the four:
`PROPOSED`, `ACCEPTED`, `SUPERSEDED`, `REVERSED`.

That distinction is why the preamble's mention of `SUPERSEDED` is **not** a
vocabulary violation, which is what it looked like on the way in. Measuring
before editing is what kept a correct line from being "fixed".

`tools/adr-status.py` joins the gate: every `## ADR-` block carries a
`**Status:**` line and its word is one of the four. Proved against both failure
shapes before shipping — an ADR with `ACTIVE` and an ADR with no status line each
fail by name, and the file passes at 84 ADRs once restored.

## 1.6.48 - three citations named a file that exists and is not the one they point at

Sweeping for live documents that link into superseded ones — the defect found in
`product.md` at `1.6.47` — turned up seven links and three defects. The other
four are correct and stay: `ARCHITECTURE.md` explaining what it replaced,
`docs/README.md` indexing it, and two pointers at `MOBILE-0.4.md` that already
label it `PROPOSED` in their own text.

**`roadmap.md` and two ADRs wrote `[architecture.md]` and pointed at
`architecture-v1.md`.** `architecture.md` does not exist and `ARCHITECTURE.md`
does, so the link text names the live document while the link goes to the
`HISTORICAL` one — whose own banner says *do not build against this file*. A
reader who trusts link text lands in a superseded architecture believing it is
current, which is precisely what the status vocabulary is for. The text now says
`architecture-v1.md`, and the roadmap says out loud that it is the historical
page and why the reasoning lives there.

**The index was stale from yesterday, and by my own hand.** `docs/README.md`
still carried `product.md` as `PROPOSED` and described it as *"the accessible
product narrative for the original plan"* — `1.6.47` promoted the document and
did not update the page that indexes it, which is the same-pass rule broken in
the pass that was fixing a status.

**And it labelled `architecture-v1.md` `SUPERSEDED`**, a word that is not one of
the five. `tools/doc-status.sh` carries the story in a comment: that file
declared `SUPERSEDED` for a while, *"unambiguous to a human, and a word the
reader has to interpret rather than look up"*, and was changed to `HISTORICAL`.
The index kept the retired word, so the vocabulary was six words wide in the one
place a reader browses them side by side.

**No new gate rule for this class.** The sweep found four legitimate links to
three defects; a check with that ratio gets an exemption list longer than its
findings and then gets skipped. The cheap half is already mechanical — the link
checker proves the file and anchor exist — and the half that is left is judgment
about whether a reader would be misled, which is a review, not a test.

## 1.6.47 - the page you must read before changing product behaviour was formally powerless

`docs/product.md` declared `Status: PROPOSED` and opened with **"Nothing
described here has been built yet."** True the day it was written; false since
the desktop MVP, the index, knowledge, self-hosting, sync and remote MCP all
shipped.

**The status was not a formality.** Golden rule 2 says an `ACTIVE` document wins
a contradiction and a `PROPOSED` one does not — so the page `CLAUDE.md` names as
the thing to read *before changing product behaviour* was, on paper, the page
that gives way to anything disagreeing with it. That is the opposite of its job,
and it had been that way silently.

Promoted by its own rule rather than by decision: the header already said *a
section becomes `ACTIVE` when its code exists and works*, and the specification
this page was the worked-out form of left `.continue/` when the work was produced.

**The promotion names what it does not claim**, because that is the only honest
way to flip a whole document at once. The mobile application of §5 is still not
shipped — the responsive layout, the drawer and the Markdown row exist on the
desktop build and the Android project compiles, but nothing installs on a phone
yet. Everything in §15 is absent by decision, not pending.

Two smaller repairs in the same header. It called the project `notes`, which it
stopped being at `1.0.0`. And *"how it is built is in architecture.md"* linked
`architecture-v1.md` — the `HISTORICAL` one, whose own banner says **do not build
against this file**. A live document routing readers into a superseded one is the
failure mode the status vocabulary exists to prevent, and it was doing it from
its first paragraph.

## 1.6.46 - the self-hosting guide had no entry for the failure a third device causes

`SELF-HOSTING.md` §*When it does not work* is where somebody goes when their
setup misbehaves. It covered the address format, the private-range refusal,
`403 https_required`, `413` and a certificate that never issues — and said
nothing about the two failures a real multi-device deployment actually produces.

**`429`, and one device starving the others.** There are two budgets: 60 requests
a minute per credential and 120 per client address. Behind a front that does not
forward the client's address, every device shares one bucket — past three active
devices that is tighter than the per-credential limit each already has, so a
machine doing its first sync locks the rest out. Caddy and `mod_proxy` append
`X-Forwarded-For` by themselves; nginx does not. With a CDN proxying the name
there are two proxies and `NOTES_SERVER_TRUSTED_HOPS=2` says so — too high reads
an entry the client supplied and makes the budget forgeable, too low collapses
it back into the symptom you started with.

**A CDN in Flexible mode, which nothing can detect.** The guide already explains
the missing `X-Forwarded-Proto`; the worse case is the header being sent and
being a lie. Under Cloudflare's Flexible, the browser's half is encrypted, the
CDN-to-origin hop is plain HTTP, and the front asserts `https` anyway — so the
server issues HSTS and accepts the request. It is written as something to go and
look at rather than something that will fail, because that is exactly the
property that makes it dangerous.

Both were already in `SERVER-0.5.md`, which is the operator reference. They were
missing from the page a person reads when something is wrong, which is the page
that decides whether they find them.

## 1.6.45 - the changelog is checked too, and the first way of exempting it was wrong

`1.6.43` skipped `CHANGELOG.md` entirely, reasoning that the file is never
rewritten so a broken link in a published entry has no legal repair. That reason
holds for the history and not for the top of the file: the entry being written
*right now* is the only one a broken link can still be kept out of, and it was
the one going unchecked.

So the file is checked, with three published entries exempted by name. Two
breakages exist and both are genuinely unrepairable: `0.2.0` links
`docs/architecture.md`, which was later renamed to `ARCHITECTURE.md`, and `0.3.2`
cites ADR-009 and ADR-010 with no anchor — a rule that did not exist until
`1.6.44`.

**The first exemption keyed on line numbers, and that was wrong by
construction.** This file grows at the top, so every new entry pushes every
historical line down and silently un-exempts it; the next commit would have
turned the check red for reasons nobody could fix. Caught by testing the guard
rather than by reading it: inserting two lines to prove a new broken link fails
also made the three pinned lines miss.

Keyed by the version heading instead, an entry carries its exemption wherever it
ends up. Proved both directions: with two lines inserted at the top, the
historical exemptions still hold and only the two newly-introduced breakages are
reported.

`doc-links.py` now covers 69 documents.

## 1.6.44 - twenty-three ADR citations linked the file instead of the decision

`CLAUDE.md` states the rule the decision record runs on: *do not re-litigate a
decided direction — link the ADR*. Twenty-three links wrote `[ADR-071]` and
pointed at `decisions.md` with no anchor, landing the reader at the top of a
2,600-line file holding eighty-odd decisions.

That resolves, so `1.6.43`'s checker passed it, and it is still the wrong link. A
citation that makes somebody search for the decision they were just pointed at is
a citation that gets skipped — and the direction gets re-litigated, which is the
one outcome the rule exists to prevent.

All twenty-three now carry the anchor, derived from the ADR headings rather than
typed: `README.md`, `ARCHITECTURE.md` (eight of them), `roadmap.md`,
`updater.md`, three acceptance and decision pages, and `.continue/README.md`.

**And the class is closed rather than cleaned.** `doc-links.py` gains one rule: a
link whose text is exactly `ADR-<n>` and whose target ends in `decisions.md`
without a fragment fails the gate. Proved non-vacuous before shipping — reverting
one anchor made the check fail with that file and line, and restoring it made it
pass.

This is the second class of documentation error to become mechanical in two
versions, and both were found the same way: by noticing that a correction being
made by hand had been made by hand before.

## 1.6.43 - a broken anchor renders as the top of the page, which reads as a working link

`tools/doc-links.py` joins the gate. It resolves every relative link in the
tracked documentation — the file, and the `#anchor` when there is one.

The anchors are the half that rots. A renamed file is loud; an ADR heading
reworded by one word silently orphans every `#adr-0xx--…` pointing at it, and
GitHub answers a missing anchor by scrolling to the top of the page. The reader
gets a page, decides they misread the link, and moves on. This repository cites
ADRs by anchor more than a hundred times from `CLAUDE.md` and `AGENTS.md` alone,
and the rule that makes those citations load-bearing — *do not re-litigate a
decided direction, link the ADR* — is one broken anchor away from pointing at
nothing.

**It found one, and it is the shape of the problem.**
`docs/history/architecture-proposal-v0.1.md` linked to
`#5-o-que-preciso-que-voce-confirme`; the heading is *"O que preciso que **você**
confirme"*. GitHub keeps accented letters in a slug, so the anchor was one
missing circumflex from correct and had been silently landing at the top of a
400-line document.

Three exclusions, each with a reason rather than a shrug. **`fixtures/`** is test
data whose links are broken on purpose — `javascript:` URLs, `file:///etc/passwd`,
a note pointing at a neighbour that does not exist — and a checker that
"fixes" it destroys the XSS corpus. **`CHANGELOG.md`** is never rewritten, so a
broken link in a published entry has no legal repair and reporting it every run
would teach everyone to ignore the check. **Code** is skipped inside fenced
blocks and inline spans, because `[Server](infra/server.md)` shown as *syntax* is
documentation of a format; `product.md` and `SCOPE.md` both do that and both are
right to.

One path is allowlisted as expected-missing with its reason:
`server/cotenant/notes-server.pub`, which `SELF-HOSTING.md` names and which does
not exist until the owner performs OWNER-ACTS §1. A page has to be able to say
where a file will appear.

Two details the implementation earns its comments for. The slug turns **each**
space into a hyphen rather than collapsing runs — an em dash between two spaces
leaves and the two spaces both become hyphens, which is why every ADR anchor here
carries a double one, and collapsing reports all of them as broken. And
`git ls-files` is read with `-z`: without it git quotes any path containing a
non-ASCII byte, and `fixtures/edge-cases/` exists precisely to hold those.

No network: external links are not fetched. A checker that fails on a train is a
checker that gets skipped.

## 1.6.42 - the page you configure MCP from did not mention the second transport

`KNOWLEDGE-0.3.md` is where somebody goes to set up an agent against their notes:
the binary, the config file, the `mcpServers` block, the scope and permission
rules. Since `1.6.5` there is a second way in — `POST /v1/mcp` on the
self-hosted server — and this page said nothing about it. `MCP-0.7.md` links
here; nothing linked back.

The cost of that gap is specific rather than tidy: somebody running the server
and wanting an agent on another machine would read this page, find only a local
process and a config file, and conclude they need to expose something. They do
not.

The new section says what is shared and what is not, because the shared half is
the whole design. One catalogue, the same eight tools, the same permission
filter, the same `AgentService` — `tools()` lives in the library and both
transports call it, so a schema cannot drift between them. What differs is only
how the caller is identified: a JSON config file here, a bearer credential the
server already issues there. Neither changes what an agent can do to a note.

It also restates the thing a reader might fear when they hear "network
transport": the desktop application still opens no port, which is ADR-007 and is
not what shipped at 0.7.

## 1.6.41 - the queue item for the 0.1d walk still asked for ten areas

`.continue/0.1d-interface.md` is the item that will be closed when the owner
walks the interface, and it named the walk as *"I1–I10 e os fluxos U1–U12,
C1–C14"*. The I table has been I1–I16 since `1.6.27`.

A queue item that undercounts the work is worse than one that overcounts: the
person walking it stops at I10, ticks the item, and the six rows added since are
never walked by anybody — while the document they live in says they are pending
and the queue says the milestone is done.

Corrected, with what the six are and the one thing worth knowing before starting:
**three of them need no phone.** The drawer is decided by window width rather
than by platform, so narrowing a desktop window past 720px and back walks the
boundary in both directions, which a device — always on one side of it — cannot.

`0.2-indice.md` was measured in the same pass and is right: it says X1–X13 and
the table ends at X13.

## 1.6.40 - the file GitHub shows to a vulnerability reporter still carried a template TODO

`SECURITY.md` is the path GitHub recognises — it is what turns on *"Report a
vulnerability"*, and the first thing an outside reporter reads. Its *Supported
versions* section was still the skeleton's:

```
<!-- Replace with this project's real support window, or keep the line below if
     there is no released artefact yet. -->
```

There are 214 Releases and a signed desktop updater serving live feeds, so *"no
released artefact yet"* has been false for some time — and an HTML comment
telling the reader to go and write the section is visible to anyone who opens the
raw file.

The real window, measured rather than described: `origin/master` is the only
branch this project publishes from — the only other remote branches are
Dependabot's — and every fix has shipped forward as a new `X.Y.Z` with its own
Release. So the section now says that, and says what follows from it: nothing is
backported, an installed build gets the fix through the updater, and *"is my
version affected?"* is answered by the version number rather than by a support
matrix.

It also still called the project `notes`, which it stopped being at `1.0.0` — on
the one page where the name is read by someone who does not otherwise know this
repository.

## 1.6.39 - the permission posture's own record said no grant had ever been made

`.claude/README.md` carries a table for every permission granted to the agent —
what, when, why and how to revert — because, in its own words, *"a norm that does
not match the artefact is a defect"*, illustrated with a sibling repository whose
guide claimed `git pull` was pre-authorised when no such rule existed.

The table said `_(nothing yet)_`. `settings.json` has carried a grant since
05/09/2026: the four read-only `gh` entries — `repo view`, `pr list`,
`issue list`, `api repos/` — with their ADR-019 reason and their revert, written
into the file's `_comment` and never surfaced where the norm says to surface it.
So the defect the page warns about was in this repository, on the page that warns
about it, for two weeks.

Recorded properly now, with the revert spelled out: deleting the four lines does
not disable the guest clause, it just makes it ask each time.

The page also gains what is *still* not granted, checked against the file rather
than remembered — no build, no test runner, no package manager, no database
client, no network fetch, with `sudo`, `gh repo edit` and `gh repo delete` in
`ask`. That half was accurate and is now verifiable without opening the JSON.

Both files still called the project `notes`, which it stopped being at `1.0.0`.

## 1.6.38 - the conformance check told you to run the command whose default can be wrong

§7 of the runbook is the four commands that answer "does this repository still
conform", and the fourth is `./tools/release.sh --backfill --dry-run`. `1.6.36`
established that the script's automatic choice of history is right on `master`
with `origin/HEAD` set, and silently wrong in a worktree on a side branch without
it — where it audits a `version.md` that was never pushed.

A conformance check that can report a clean repository from the wrong history is
worse than no check, because its output is what someone quotes. §7 now sets the
pointer first, in a line that is a no-op when it already exists, and says why
rather than leaving a command nobody understands in a list of four.

Running the four here, after the pointer was set: the twins are identical,
`version.md` is a bare `X.Y.Z`, `settings.json` parses, and 212 versions all have
tags and Releases with none missing.

## 1.6.37 - the product document still listed sync as something the product does not do

`CLAUDE.md` says to read `product.md` before changing product behaviour. Its §15,
*Not in the first version*, exists because "an unstated exclusion is read as an
oversight" — and it listed `sync`, which has been implemented through `0.20.20`
and was given a twenty-six-step acceptance walk two days ago.

Moved out, with where it went and what it cost. The answer to "what did §2 give
up for it" is **nothing**: sync is opt-in, off by default, and goes to a server
the user runs, which is what §2 already said about everything above the base
product.

**The two neighbours it used to sit beside stayed**, and that is the part worth
writing rather than just deleting a word. `user accounts` and `an official cloud
server` are not pending work — they are the two entries on that list §1 will not
trade. A list that quietly loses an item teaches a reader that the whole list is
soft.

Nothing else in the page measured stale: §2 already describes remote storage,
sync, an HTTP API and AI agents as opt-in and self-hostable, and §5's mobile
priorities still end with sync as *later*, which is true — the mobile half has no
installable application yet.

## 1.6.36 - release.sh can read the wrong history, and this clone was set up for it

`docs/versioning.md` states the rule the whole release mechanism rests on — *the
`version.md` on GitHub equals the Releases on GitHub, the local checkout does not
enter the calculation* — and then never mentions `--ref`, the flag that makes it
true when the script's own guess is wrong. Measured: zero occurrences.

The guess is three steps: `origin/HEAD`, else `origin/<the branch you are on>`,
else plain `HEAD`. **The third is a wrong answer that looks like a right one, and
the second is what sends you there.** `origin/HEAD` is a local pointer a fresh
clone does not get; `CLAUDE.md` already calls `git remote set-head origin -a` the
step people skip. Without it, on `master` step two lands on `origin/master` and
everything works, which is exactly why nobody notices. In a worktree on a side
branch, `origin/<that branch>` does not exist, so the script reads a local
`version.md` that was never pushed and reconciles the `Latest` badge onto it.

**This clone had `origin/HEAD` unset**, across all four worktrees — so the trap
was armed, not hypothetical, and it had already fired once: the badge landed on
`1.6.6` while GitHub's `version.md` said `1.6.7`.

Documented and fixed. `git remote set-head origin -a` now points it at
`origin/master`, and the fix is measured rather than assumed: `release.sh
--dry-run` run from the worktree sitting at `1.6.29` reads **1.6.35**, the remote
version. Before it, the same command would have read `1.6.29` and moved the badge
there. The reasoning and how to undo it are in `.loop/ASSUMPTIONS.md`; it is a
local pointer, in no commit, and changes nothing on GitHub.

The section says both remedies and says which is better: setting the pointer is
once per clone, `--ref origin/master` is every time you remember.

## 1.6.35 - the structure document was missing two crates, the server, and had a directory that does not exist

`CLAUDE.md` says to read `ARCHITECTURE.md` before changing structure. Measured
against the structure: its tree listed six of the eight crates under `crates/`,
had no `server/` at all, and still described `packages/ui/` — a directory that
was never created.

`notes-sync` and `notes-sync-client` have existed since 0.6 and appear in neither
the tree, the dependency diagram nor the responsibilities table. `server/
notes-server` is a workspace member — `members = ["crates/*",
"apps/notes-app/src-tauri", "server/notes-server"]` — and the sentence naming the
workspace named the first two.

**The diagram is the part worth getting right**, because it is the thing someone
copies when they add a crate. `notes-sync` sits beside `notes-fs`, not above
`notes-core`: it depends on `notes-model` and `notes-markdown` and nothing else,
because a causal revision domain that cannot be reasoned about without a
filesystem is one nobody can test. `notes-sync-client` is the half that does I/O
and sits above the core. And `notes-server` is the only consumer that takes both
`notes-core` and `notes-mcp`, which is exactly the shape 0.7 argued for: one
catalogue, two transports, no second implementation over the notes.

`notes-mcp`'s row said "stdio server". Since `1.6.4` the catalogue, the argument
schemas and the JSON-RPC envelope live in `lib.rs` and the stdio loop is only
`main.rs` — so its *must not* column now carries the constraint that matters:
never a second description of a tool, because one function answering `tools/list`
on both transports is what keeps a schema from drifting between them.

`packages/` is removed rather than left with a "may stay empty" note. A reader
who goes looking for a directory the document describes and does not find it
learns to distrust the document, which costs more than the line saved. ADR-042's
mention of it is left alone: it records what was deferred that day.

**This is a Z bump although the page says adding a crate is a Y.** Nothing was
added; two crates that have existed for a milestone are being written down.

## 1.6.34 - the document that wins conflicts had never heard of this project's agent surface

`docs/security.md` is normative — in a conflict with any other document it wins —
and it was last revised at `1.3.3`, before remote MCP shipped. Measured: it
mentioned MCP **zero times**, while this project has had an agent tool surface
since 0.16.0 and a networked one since `1.6.5`.

Its §2 threat model is otherwise detailed, down to which ADR bounds each sync
behaviour. The nearest thing to an agent row was *"documents read by an agent →
prompt injection"* — the agent **reading**. Nothing covered the agent **acting**,
which is the half with permissions on it.

Two rows added, and the second matters most for what it says the endpoint does
*not* do: `POST /v1/mcp` is an envelope over `dispatch`, not a second
authorization path. Same bearer credential, same `AgentConfig`, same catalogue
filter, and everything enforced before `dispatch` — the trusted-proxy check, the
refusal of any request carrying `Origin`, the two rate limits, the redacted audit
— applies unchanged. A reader of a normative document should not have to go and
check whether a network transport quietly grew its own way in.

§4.9 gains the consequence for this project. A note is the untrusted text; an
agent holding MCP credentials is a caller that can act on it. So the dangerous
moment is the tool call injected text argues for, and the bound is what the
credential admits rather than what the model decides — scope, per-tool
permissions, a separate one for `notes_delete`, review mode, and a catalogue that
**omits** what the credential cannot use rather than refusing it later. A tool an
agent can see is a tool an agent will argue for.

**§8 gains the sibling of its own best line.** It already said `HTTP 200` proves
nothing. It now says a zero exit status proves nothing either, with the measured
case: `--version` is a Symfony Console global option, so the release step printed
`Laravel Framework 13.12.0`, returned 0, and the publisher deleted the staged
upload and announced a release — six times, while the download page said *In
preparation*. That became ADR-084, because it is a new requirement rather than a
line: a step that publishes, installs or deletes is verified by reading back what
it changed. The feed half of the same publisher already did exactly that, which
is why it is the half that worked.

The document declares itself 1.1 rather than editing 1.0 in place. None of this
changes a rule that was being followed; all of it was true of the code and absent
from the page that settles arguments.

## 1.6.33 - the update button is a second way into the restart that 0.1c measures

Measuring `ACCEPTANCE-0.1b.md` and `ACCEPTANCE-0.1c.md` against what shipped
after each was last revised. 0.1b came back clean and says so; 0.1c had two
findings.

**C14 — restoration across an update.** §2 of 0.1c is *reopening restores
workspace, tabs, active tab and cursor*, and every route into it was "quit and
reopen" when the table was written. At `1.3.7` the update banner's **Install and
restart** started performing the workspace close itself — calling the same
`leave()` the sidebar menu calls — so there is now a second restart, and
`restore_last_workspace` is what brings the session back on the far side. It is
the restart nobody walks: the user is looking at a new version, not at whether
their tabs survived, so a regression there surfaces weeks later as "it forgot my
tabs once". The row carries the dirty-buffer half too, because that is the part
the banner used to state and offer no way to obey.

**The standing rule was describing a weaker check than the one that runs.** 0.1c
inherited *"every new user-visible string is a key in both catalogues; CI fails
when they diverge"*. Comparing the catalogues against **each other** passes a key
missing from both — which is exactly how the New note dialog came to ask for a
name under the label `tree.newNote.prompt`, the failure C13 exists to catch.
Since `1.1.31` `tools/i18n-keys.py` resolves every literal `t("…")` against both
and replaced the parity check; the rule now says that.

**0.1b is current, measured rather than assumed.**
`git log 1.5.0..HEAD -- apps/notes-app/src crates/notes-markdown crates/notes-core
crates/notes-fs` returns four commits, three of them the mobile interface already
in 0.1d and one the sync connection test's wording. The drawer is the one worth
naming in that page: §6 measures how long the tree takes to appear, not where it
appears, so moving it into an overlay below 720px leaves the measurement alone.

C14 is carried into `ACCEPTANCE-0.1d.md` §3 with the rest, since that is where
these rows are actually walked, and the two counts that name them — in 0.1c's
pointer and in `docs/README.md` — are corrected with it. **ADR-037 is left
alone**: it says twenty-five because twenty-five is what was decided that day, and
an ADR that quietly updates its own numbers stops being a record of a decision.

## 1.6.32 - the updater page and the queue were both wrong about the publish, in opposite directions

Publishing a desktop release is two independent steps: filing the artifact with
the download service, which is what puts a row on `/p/tura-notes`, and writing
the updater feed, which is what an installed application reads. Neither
`docs/updater.md` nor `.continue/README.md` distinguished them, and that is
exactly why each got it wrong — in opposite directions.

Measured over HTTPS rather than inferred from a script's output:
`linux-x86_64-deb.json` and `linux-x86_64-appimage.json` are both live at
`1.6.3`, with 416- and 420-byte signatures, and the `.deb` the feed points at
answers `200` at 7,210,292 bytes. There is no macOS feed — `404`. And
`/p/tura-notes` still says *In preparation*.

So `updater.md` was stale in the pessimistic direction: it still said *"the live
updater feed has not been published"* and *"what remains is the act"*, when the
act had run for Linux and the feed had been read back — the exact condition that
paragraph named as the one that would end its own claim. The queue was stale in
the optimistic direction, recording the artifacts as ingested and the page as no
longer saying *In preparation*.

**The durable half is the sentence neither page had:** a zero exit status is not
evidence of publication. `1.6.28` paid for that one — `--version` is a Symfony
Console *global* option read off raw argv before any command resolves, so the
ingest printed `Laravel Framework 13.12.0`, returned 0, and the script deleted
the staged upload and announced a release. The feed half already verifies itself,
fetching the manifest back and re-hashing the payload; the ingest half had
nothing watching it, which is why it could fail silently for six releases. What
to check after a publish is the row and the page, never the exit code.

One more line stopped being true and is corrected with it: moving the feed to
another name was *"free today because nothing has ever been published"*. It was
free until 17/09. An installed build asks the name compiled into it for ever, so
the old name now has to keep answering.

## 1.6.31 - the emulator blocker is a firmware bit, and the kernel had said so first

Milestone 0.4 has compilation evidence and no execution evidence. Round 4 of the
loop recorded the reason as "two `sudo` commands away", and that was wrong in
both halves of its own evidence.

The claim was: *the CPU exposes `svm`, so virtualization is already enabled in
the BIOS; what is missing is the module and the group*. Measured now, `svm` is
**absent from `/proc/cpuinfo`** on an AMD Ryzen 9 5900X — the one place it would
always appear if the firmware allowed it. And the kernel had already said the
opposite, twice, in the current boot's journal:

```
set 16 11:23:21 samirb3 kernel: SVM disabled (by BIOS) in MSR_VM_CR
set 17 16:06:12 samirb3 kernel: kvm_amd: SVM not supported by CPU 1
```

The second line is `modprobe kvm_amd` — the very command that was written down as
the fix — being refused. `lsmod` corroborates: the generic `kvm` is loaded with
zero users and `kvm_amd` is absent from `/sys/module/`.

**`sudo` cannot reach this, and that is the whole correction.**
`MSR_VM_CR.SVMDIS` is locked by the firmware until the next reset, so the
unblock is a keyboard at boot — Advanced ▸ CPU Configuration ▸ SVM Mode ▸ Enabled
on this board — and not a privileged command. Only the `usermod -aG kvm`
afterwards was ever a `sudo` step.

**It becomes `OWNER-ACTS.md` §3 rather than staying in `.loop/`.** That page is
the acts only the owner can perform, and a firmware setting is the purest example
of one: no process running on the machine can change it. `.loop/` is round state
— a blocker measured in months does not belong in a file whose lifetime is a
session. `ACCEPTANCE-0.4.md` now says why nothing there has been observed
running, in one place, instead of leaving a reader to wonder whether the rows are
blocked on separate work.

The two `.loop/` records that carried the wrong cause are corrected by **appended,
dated corrections** rather than rewritten — the same treatment the CHANGELOG got
at `1.6.2`. A record that quietly changes its mind teaches nobody what the error
was, and the error here is the interesting part: a conclusion was drawn from a
flag without reading the flag.

## 1.6.30 - round 4 of the loop closes, and says what it is waiting on

`.loop/STATUS.md` records how the round ended, which is what that file is for.
Eleven items: the seven the queue was armed with, minus the emulator one, plus
four the refill measured after the queue had emptied.

**The refill is the part worth keeping.** With one blocked item left, the choice
was to end or to measure whether anything else was in scope — and measuring found
a shipped milestone with no acceptance page at all. 0.7 landed at `1.6.5`, its
queue item left `.continue/`, and `MCP-0.7.md` was not even listed in
`docs/README.md`. Three more came from running the same measurement over the
acceptance pages nobody had touched since 9–11/09: PDF import with no box
anywhere, two desktop interface flows, and a sentence in `ACCEPTANCE-0.1a.md`
that had become the opposite of what the code does.

The round is ended rather than left armed, because what remains needs `sudo`:
`/dev/kvm` for the emulator, and the updater signing environment for the publish.
Neither is a thing an agent waits for productively, and a loop that keeps waking
to report the same block is worse than one that stopped and said so.

## 1.6.29 - the 0.1a jail section said the check does not run at the open, and since 1.1.5 it does

Measuring the older acceptance pages against what shipped afterwards found one
sentence that had become the opposite of the truth. `ACCEPTANCE-0.1a.md` §6 ended
with *"the check runs on every call rather than at open time"* — written when
`LocalFs::resolve` verified each segment with `symlink_metadata` and then handed
the path to `fs::read` or `fs::File::create`, both of which follow symlinks.

`1.1.5` closed exactly that gap, and the gap *was* the jail's whole coverage in a
product whose premise is that other tools write in the same folder. Reads now open
with `O_NOFOLLOW` and report `ELOOP` as the same `SymlinkNotFollowed` the path
check produces; the temporary file is unlinked and then created with
`O_CREAT|O_EXCL`, which refuses a symlink outright, so losing the race between the
two refuses the write instead of redirecting it.

A stale sentence in an `ACTIVE` document is worse than a missing one because it
carries the authority of having been written down — and this one would have sent
the next reader looking for a TOCTOU window that had already been closed, or
worse, reassured them that open-time checking was deliberately not done.

The section also named two of the seven tests in `jail.rs`. The three that arrived
with the fix are named now, including the one that writes through a symlink left
at the deterministic temporary path: run against the code before `1.1.5` it fails
with the outside file overwritten, which is what makes it evidence rather than
decoration.
## 1.6.28 - the ingest stops handing artisan a flag the framework intercepts

Both publish paths announced "Published" and published nothing. `/p/tura-notes`
stayed "In preparation" through 1.6.0 with the `.dmg` uploaded and its SHA-256
verified on the server, because the step that files it never ran.

`--version` is a Symfony Console **global** option. `Application::doRun()` reads
it off raw argv before it resolves any command, prints the framework's long
version and returns 0. `Laravel Framework 13.12.0` was the entire output of the
ingest step, and 0 is success, so the script deleted the staged upload and
reported a release. A command that declares an option under that name cannot be
reached by it either, and the declaration itself breaks definition merging with
`An option named "version" already exists.`

The download service renamed its option to `--file-version` (samirhv-site 1.0.8,
deployed), and both call sites now pass that. The value stays optional: the
ingest infers the version from the filename when it is absent.

Linux was not spared, and the earlier reading that it was is wrong.
`tools/build-linux.sh` runs under `set -euo pipefail`, but that aborts on a
non-zero status and this call returned zero — the `.deb` and the `.AppImage`
went unpublished exactly as silently as the `.dmg`, with the same announcement.
The exit code was never the signal; nothing on either path checked that a
`ProjectFile` row existed afterwards.

## 1.6.27 - the same measurement, applied to the desktop half of 0.1d

`1.6.21` extended the 0.1d walk with what shipped in `1.6.14`–`1.6.17`, which is
what the queue asked for. Running the same measurement across everything else
since `0.13.0` found two more, and both are desktop.

**I15 — Help ▸ About.** A dialog of ours rather than the platform's empty one,
stating the version running, the engine, the data directory and the open
workspace, with `Copy` putting the same lines on the clipboard. It is the dialog
a bug report gets built from, which makes a wrong version in it worse than no
dialog at all, and it had no box.

**I16 — the chrome is not selectable text.** The bug behind it looked like a
colour problem: a screenshot of the context menu with every item lit at once. It
was a stray text selection painting the labels, because nothing in the chrome had
`user-select` and two line-number elements were the only things in the stylesheet
that did. The walk is dragging across the rail, the tab strip, the status bar, a
tree row and an open menu and seeing nothing highlight — then dragging across the
editor and seeing it highlight, because that one *is* the document.

The automated table gains two rows: `About.test.tsx`, and the i18n resolver. The
second is worth its line — the old check compared the two catalogues against each
other, so a key missing from **both** passed, which is how a dialog came to ask
for a name under the label `tree.newNote.prompt`. It now resolves every literal
`t("…")` against both and replaced the parity check rather than joining it.

**The page now carries the date it was measured to**, and what was deliberately
left out: `1.1.31`'s fault was that unresolved key, which the gate catches by
itself; `1.2.0` and `1.3.7` change what a rename and an update *do*, not what the
interface shows, and are accepted where that behaviour lives.

## 1.6.26 - PDF import shipped in 0.20.27 and appeared in no acceptance document

A pass over the two acceptance pages nothing had touched since 10 and 11/09,
measuring them against what shipped afterwards rather than assuming either way.
One real gap, one stale sentence, one row that belonged somewhere else, and a
dated line in each page so the next pass measures from here instead of from the
version that wrote it.

**The gap: PDF import.** It arrived at `0.20.27` with a preview, a 32 MiB bound
and a save that writes one note — and `grep -i pdf docs/ACCEPTANCE-*.md`
returned nothing. K14 and K15 close it, and K14 is the cancel: the import is
deliberately *not* a workspace operation until the save, so the walk that matters
is the one where nothing should have been written. K15 covers the save and the
two refusals — oversized, and not a PDF — because a refusal that produces an
empty note is worse than one that says no.

**The stale sentence** was 0.2's MinGW line, which predates `1.6.18` teaching the
gate to report a missing compiler as `FAILED, not run` with the package name
instead of leaking a shell error. It now names the Debian package too, and says
what `NOTES_NO_WINDOWS_CHECK=1` is and is not for.

**The row that belonged somewhere else:** `1.3.2`'s damaged-journal fix is the
sync vault's, reached by the offline `sync-prune`, not the index's `index.db` —
so it became S26 in the 0.6 walk, next to the other maintenance commands that
want the server stopped and a backup first. Declining to prune keeps the payload,
and a damaged vault is exactly the state somebody runs a maintenance command in,
which is why it is worth having seen once before it matters.

`1.3.0` looked like a third candidate and is not: it is workspace-open latency on
macOS, which X1 already covers from the user's side. Written down as measured
rather than left as a question.

## 1.6.25 - remote MCP was the one shipped milestone with no acceptance page

0.7 was delivered at 1.6.5, its queue item left `.continue/`, and `MCP-0.7.md`
moved to `ACTIVE`. Every other shipped milestone in this repository has an
`ACCEPTANCE-*.md`; this one had none, and `MCP-0.7.md` was not even listed in
`docs/README.md`. A milestone with a contract and no walk reads as accepted by
whoever built it.

**It is the shortest acceptance document here, and that is the milestone's own
argument.** Remote MCP added no behaviour over the notes — it is a second
envelope over a call path that was already authenticated, already scoped and
already shared with the stdio server. The notes behaviour is accepted in 0.3 and
the transport boundary in 0.5, so what is left is the one thing neither covers:
a real MCP client, configured by the owner, against their own server.

`server/tests/mcp.py` is a real protocol client and cannot stand in for that. A
real protocol client is not a real product, and every gap between the two lives
in the client — **M2 is where that shows.** MCP's Streamable HTTP defines a `GET`
that opens SSE and this server deliberately opens none, because none of the eight
tools notifies, samples or elicits. Whether a client the owner actually uses
works anyway is not knowable from here, and the answer decides whether the absent
stream stays a choice or becomes an ADR. The row says so instead of assuming.

**M11 and M12 exist because of when this shipped.** A release that adds a network
transport is exactly when "the desktop app opens no listening port" quietly stops
being true, and exactly when a refactor that moved `tools()` into the library
could have cost the stdio path something nobody re-ran. Both are one command to
check and neither is checked by anything else.

M4 is written as a question to the agent rather than a look at a response body:
ask it to summarize what it just learned. A refusal that leaks through a model's
paraphrase is still a leak, and it is not visible in the JSON the test asserts on.

`docs/README.md` gains the section 0.7 never had, and the roadmap, the contract
and the queue index all point at the page.

## 1.6.24 - the loop queue existed twice, and the committed copy was the poorer one

`.loop/` became tracked at 1.6.19, in the worktree the work was happening in.
The round itself was armed in the main checkout, which is where the Stop hook
writes — so from 1.6.19 onward there were two directories with the same name and
different contents. The live one had R4a, R4b and R4c ticked with what they
measured; the committed one still carried their original unstarted text.

Reconciled rather than chosen between, because neither was a superset of the
other: the live copy was ahead on `ASSUMPTIONS.md`, `INDEX.md` and one entry
file, the committed one on three finished items that exist nowhere else.

**The part that was not untidiness.** The main checkout's `.loop/` is
*untracked* there — it predates the commit that started tracking it — and `git
pull` refuses when an incoming tracked file would overwrite an untracked local
one. The next pull in `~/x/tura-notes` was going to fail, on a directory the
owner never edits and would have had no reason to suspect. Removing the stale
untracked copy after this push is what clears it; the content is in git now, so
nothing is lost by removing it.

## 1.6.23 - the 0.5 walk covers the deployment that is actually running

`ACCEPTANCE-0.5.md` was written against 0.18.0, when 0.5 was a server. What
arrived afterwards is what makes one a *deployment* — a public name, a CDN in
front of it, a script that updates it, a signature that gates the update, and a
way to mint a credential without an ssh session — and none of it had a box. The
page even still said "no public deployment is claimed by this milestone", which
stopped being true on 16/09.

The extension is organized by who is being trusted, because that is what the
steps have in common.

**Two of them the server cannot check about itself.** Cloudflare in **Flexible**
mode encrypts the browser's half, leaves the CDN-to-origin hop in plain HTTP, and
still sends `X-Forwarded-Proto: https` — the server then issues HSTS and accepts
the request, having been lied to by its own configuration. And
`NOTES_SERVER_TRUSTED_HOPS` has to equal the number of proxies that are really
there: too high reads an entry the client supplied and makes the address budget
forgeable, too low collapses every device into one bucket. Nothing in the
repository can verify either, which is exactly why they are boxes rather than
tests.

**The signature step is walked as a refusal, not as a success.** Truncate the
`.minisig`, run the deploy, confirm the installed binary did not move. A
signature check nobody has seen refuse is a signature check nobody knows is
wired up. It is also currently blocked: `notes-server.pub` does not exist, so
every deploy is in the refusing state until OWNER-ACTS §1 happens, and the page
says so rather than listing a step that cannot run.

**The audit step is written as a grep for what must not be there** — no
`Authorization` value, no note text, no query text, no plaintext token, no note
path — with `X-Request-Id` on a client response matched against a line in the
audit, because that correlation is the whole support story and is cheaper to
check once than to discover missing.

**The upgrade step exists for one sentence:** never ask an older server to
overwrite future state. It is the move with no recovery, and the walk is there so
the first time it is considered is not the night it is needed.

The automated section gains the reason the smoke suite restarts between phases.
It runs at production limits — 120/min per address, 60/min per credential — and
a credential per phase cannot substitute, because the per-IP bucket is checked
*before* authentication and every request in the suite comes from the same
loopback address. Written down so that a future change which makes the suite
green by raising a limit is recognizable as removing the coverage.

## 1.6.22 - milestone 0.6 has a walk, which was the only thing it was missing

Sync is the only milestone whose contract was fully written and whose acceptance
was one sentence in the queue: *percorrer o fluxo em builds instaladas e em
dispositivos físicos*. `docs/ACCEPTANCE-0.6.md` is that sentence turned into
S1–S25, in the format the other acceptance documents use — a step the owner
walks, and what to look at while walking it.

**Written against the interface, not against the design.** Every control is named
by the words on it — `Test connection`, `Apply received files`, `Pause transfer`,
`Reconnect existing queue` — read out of the i18n catalogue rather than
remembered, so a step cannot send the owner looking for a button that says
something else.

Three things the walk is built around:

**Two machines, or nothing.** A folder synchronized with itself proves nothing,
and every claim in the document is about what the *second* machine sees. The 0.5
walk comes first and is not repeated here: sync inherits that boundary rather
than re-establishing it.

**The failures are walked deliberately, not waited for.** S1 runs the connection
test four times wrong before running it right, because four different sentences
sending the owner to four different machines is the feature — one generic failure
would be the bug. S8 provokes the power and network pauses instead of reading
about them, and the case that matters is *unknown*: a missing battery API must
not read as AC power.

**S20 and S21 are the two boxes the milestone rests on.** A note that crossed the
network comes back byte-identical — CRLF, a BOM, no final newline, an emoji
outside the BMP, and one file that is not valid UTF-8, each checked with `cmp`
rather than by eye. And nothing ever appeared that was not asked for. Everything
else in the document is a feature; those two are the promise, and they are the
ones to re-tick on every release.

**The mobile half is declared unwalkable rather than left open.** 0.4 has produced
compilation evidence and no installable application, so the device rows have
nowhere to run; that is stated in the header and tracked in `ACCEPTANCE-0.4.md`,
instead of sitting as boxes nobody can tick for reasons nobody wrote down.

`docs/README.md`, `docs/roadmap.md`, `.continue/README.md` and
`.continue/0.6-sync.md` all point at the page. The queue item stays: the walk
existing is not the walk happening.

## 1.6.21 - the 0.1d walk covers the interface that shipped after it was written

`ACCEPTANCE-0.1d.md` stopped at I10, where 0.13.0 left it. Three pieces of
interface have shipped since — the drawer at 1.6.14, the Markdown row at 1.6.15,
the non-atomic-backend banner at 1.6.17 — and none of them had a box. An
acceptance document that silently stops tracking is worse than a short one,
because it still reads as the full list.

I11–I14 are added in the table's own format, with the automated rows that pair
with them.

**The first three need no phone, and that is the point of how they are written.**
The drawer is decided by window width, not by platform: `collapseOnNarrow()` asks
`matchMedia` the same query the stylesheet opens its mobile block with. So the
walk is dragging a desktop window under 720px and back, which exercises the
boundary in both directions — something a phone, which is only ever on one side
of it, cannot do.

I12 is split out from I11 deliberately. Closing the drawer when a note is opened
is correct *narrow* and wrong *wide*, and the wide half is the one a change is
likely to break without anybody noticing: the symptom is the sidebar collapsing
under you on a desktop, which reads as a glitch rather than as a regression in a
mobile feature.

**I14 is marked `n/a` rather than left open, with the reason written down.**
`LocalFs` answers `atomic_replace = true` on every platform, Android included,
so the banner cannot appear on a local folder and no walk can produce it. It is
listed so the first person to open a SAF tree or another non-atomic backend reads
the banner as expected rather than as a bug — an invisible feature with no entry
is indistinguishable from one nobody built.

## 1.6.20 - the two owner acts, written against the scripts rather than the queue

`docs/OWNER-ACTS.md` carries the steps for signing the server binary and for
recovering the 1.4.0 attachments. Neither is something an agent does — one holds
a private key that must never reach this repository or CI, the other publishes
artifacts — but both can be got right before an evening is spent on them.

**Reading the script found the queue wrong about its own procedure.** The item
said to sign "the current version". `tools/sign-server-release.sh` refuses
anything that is not `X.Y.0`, because attachments are built on minors only
(ADR-036) and a patch Release carries none. The version to sign is **1.6.0**,
and its `notes-server-1.6.0-x86_64-linux.tar.gz` and `.sha256` are both attached
— checked against the Release, not assumed from the workflow.

The page records the order the script works in, because the order is the
substance: checksum verified **before** signing, since signing a truncated
download publishes a valid signature over wrong bytes and that passes the
deploy's verification and installs a binary that does not run; and the signature
verified against the **committed public half** rather than the key that just
signed, which is what catches a restored backup or an old pair here instead of on
a host that is serving.

Both queue items now point at the page instead of carrying half the commands, and
the signing one no longer names the wrong version.

## 1.6.19 - `.loop/` is committed, and ADR-083 says in which language

The `loop-work` skill writes four things into `.loop/`: the queue a round works
from, an index of every stop, the archived report of each one, and
`ASSUMPTIONS.md` — the decisions an agent took **without the owner**, each with
its alternative and how to undo it. It sat untracked for a whole round while the
question was open, which is the worst of the three possible answers.

It is committed because `.gitignore`'s own header already decided this class: a
directory holding an open question or a verdict is memory, not execution.
`git log` answers what changed; only this answers what was decided instead, and
leaving it on one machine's disk made the record of unsupervised decisions the
most perishable thing in the project.

The language question was the harder half and is why an ADR exists rather than a
line. Everything here is English (US) with three carve-outs and `.loop/` is none
of them — taken literally, a Portuguese `.loop/` is a violation. But the reason
`.continue/` is carved out applies word for word: work being thought through,
written in the language the thinking happens in, where translating before the
thinking is finished destroys the only place it exists. ADR-083 draws the line
narrowly — *a directory whose content is work in progress rather than a product
of the work* — and notes that everything `.loop/` produces already crosses into
English: the commits, the changelog, the documents.

**The ADR is local and says so.** The language rule lives in a marked echo block
regenerated from repodocs, and nothing written inside it survives the next fleet
pass, so this touches none of it. The precedent is exact: `.continue/` in
Portuguese was decided here first as ADR-009 and ADR-010, and the fleet adopted
both later. If this deserves generalising, the route runs through repodocs, not
through an edit that would be erased without anybody noticing.

## 1.6.18 - the gate names the missing dependency instead of leaking a shell error

A fresh `git worktree add` has no `node_modules` — it is gitignored, and nothing
copies it — so the two frontend steps died on `sh: 1: vitest: not found`. Three
worktrees in one session hit it, and each time the gate was red for a reason it
knew perfectly well and did not say.

The two steps now go through `missing`, the same helper the Windows cross-check
uses, and the line reads `FAILED, not run — no node_modules in this checkout —
run: (cd apps/notes-app && npm ci)`. Still a failure, not a warning: that is the
house position since the MinGW guard was changed, and a suite that silently skips
its own frontend is worse than one that stops.

What this does not do is run `npm ci` for you. A gate that installs things is a
gate that can change the tree it is checking, and the failure it would hide is
exactly the one worth seeing — a lockfile that no longer resolves.

## 1.6.17 - say out loud when a backend cannot replace a file in one step

`docs/MOBILE-0.4.md` said `Caps` "grows a flag" for whether writes are atomic on
a backend. It does not: **`Caps::atomic_replace` has existed all along**, and
`notes-core`'s sync path has gated on it in three places since before that page
was written. Reading the type before writing the adapter is what found it, and
the page is corrected rather than left describing a change nobody needs to make.

What genuinely did not exist is the part that page promised: **anybody telling
the user.** A backend that cannot replace a file in one step is a backend where a
crash mid-save can leave a truncated note, and until now that fact reached only
the sync code. A workspace whose backend answers `false` now opens with a banner
saying what still holds — saving checks for outside changes and refuses to
overwrite them — and what does not: a whole note after a crash in the middle of a
save.

`LocalFs` answers `true` on every platform, including Android, because a path
there is still a path and `rename(2)` is still atomic. It is the SAF tree that
cannot, so this stays invisible until that adapter exists or another backend
says otherwise. That is also why the banner could not be tested against a real
`false` today, and why it is written against `info.caps` rather than a platform
check — the platform is not what decides this.

## 1.6.16 - the mobile entry point, and the warning it exposed

On desktop `main.rs` calls `run()`. On Android and iOS there is no `main`: the
generated project's activity loads this library and calls a symbol that has to
exist, which is what `#[cfg_attr(mobile, tauri::mobile_entry_point)]` exports. A
second function for mobile would have been the start of the second application
ADR-042 exists to prevent, so the attribute goes on the one that is already
there.

Checking it for Android surfaced something the desktop build could never see.
Every use of `app` inside `.setup(|app| ...)` sits behind `cfg(desktop)`, so on
mobile the binding is unused — and `-D warnings` turns that into a build failure
on the platform this change exists to serve. Renaming it `_app` would read as
"unused" on the platform where it is used the most, so the closure now starts
with `let _ = &app;` and a comment saying which platform it is for.

CI gains `notes-app` on **one** ABI rather than four, and the asymmetry is
deliberate. The core is checked on all four because `notes-index` bundles SQLite
and a C cross-compile is what breaks per architecture; the shell is Rust over a
JNI boundary and does not, so four full Tauri dependency trees would buy
repetition rather than coverage. arm64 is what a real device runs.

Measured here on NDK 28.2: the shell checks for Android in 27 seconds warm, and
clippy stays clean for the desktop target with `-D warnings`.

## 1.6.15 - a Markdown row for the keyboard that has no Markdown keys

Last line of the interface bullet in `ACCEPTANCE-0.4.md`. `**`, `` ` `` and `[`
are two or three taps deep on a phone keyboard, so a row of six sits under the
editor below 720px — bold, italic, heading, list, link, inline code — and is
hidden by CSS above it, where a physical keyboard has all of them and the row
would be clutter.

**The logic is a pure module, and that is the point of the split.** CodeMirror
does not run meaningfully under jsdom, so anything left inside a click handler is
untested by construction. `markdown-actions.ts` takes a document and a selection
and returns a document and a selection; fourteen tests cover where the caret
lands, what an empty selection does, and whether a second press undoes the first.

One of them found a real bug before any of this ran in a browser. Unwrapping
computed the new selection end from the *old* start — symmetric-looking and wrong
by the length of the selection, so pressing bold twice left the selection running
past the text it had just unwrapped. The test that caught it is the one that
presses twice from exactly the state the first press leaves behind.

Every action toggles. A toolbar whose bold button only ever adds asterisks
teaches the user to reach for the keyboard to undo it, which on a phone is the
keyboard the row exists to avoid. A mixed block finishes the job rather than
undoing the half already done, because that is the useful move.

Two details that are about phones rather than Markdown: the press is one
transaction, so it is one undo instead of a rewrite backed out character by
character; and `mousedown` is prevented, because taking focus off the editor
would dismiss the keyboard before the press ever lands.

What is not tested is the dispatch into CodeMirror itself, and it stays that way
until there is a device to run it on — which is in the queue as its own item, not
assumed away here.

## 1.6.14 - below 720px the sidebar is a drawer, not a column

The application had no width-based media query at all — 933 lines of stylesheet
and not one, which is what "desktop-first" looks like when the mobile half has
not been written yet. ADR-042 keeps mobile inside this application rather than
beside it, so this is a layout and not a second app: the same markup, laid out
differently once there is no room for three columns.

Below 720px the sidebar leaves the flow and overlays with a scrim, the editor
takes the window underneath it, and split view stacks instead of sitting side by
side. The rail stays visible on purpose — it is the only way back to the drawer,
and a drawer with no handle is one nobody opens twice. Safe-area insets are
honoured on the drawer, the rail and the status bar, and are zero on everything
that has no notch.

**Opening a note closes the drawer, and only where the drawer overlays.** On a
phone, opening a note from the sidebar without closing it leaves the note the
user asked for behind the thing that asked; on a desktop the sidebar is a column
and closing it on every open would be the app fighting the user. The call sits in
`tabs.activate`, which every route to showing a note passes through — the tree,
the palette, search, a link — so it is written once rather than in each of them.

The breakpoint is one number in two files, because CSS cannot read a TypeScript
constant. `ui.ts` exports it, `matchMedia` is asked for that exact string, and a
gate step reads the query out of the store and fails unless the stylesheet opens
its mobile block with the same one. Checked by moving the CSS to 700px: the step
fails, which is the whole reason it exists. A layout that overlays at one width
while the store closes the sidebar at another is unreasonable about in exactly
the way a user would notice and nobody could reproduce.

Four tests cover the behaviour, including the one that matters for a test runner:
an environment with no `window` or no `matchMedia` is not a narrow screen and
must not have its sidebar closed underneath it.

## 1.6.13 - write down what the Android folder adapter owes, before writing it

`ACCEPTANCE-0.4.md` names SAF in one bullet — "Android SAF with persisted
authorization" — and says nothing about what that adapter must do. `MOBILE-0.4.md`
is `PROPOSED` and says it, because the questions worth settling here are settled
by reading, and answering them in code first would answer them by accident.

**The finding that justifies the page: `write_atomic` does not map.** On a
filesystem it writes beside the target, fsyncs and renames over it, and the
rename is what makes a note never half-written. SAF has no such rename —
`DocumentsContract` may implement `moveDocument` and a cloud provider commonly
refuses. So `Caps` grows a flag for whether writes are atomic on this backend,
the adapter answers honestly per tree, and the user is told once at open rather
than never. The `expect`/`BaseRev` half survives untouched: re-read, hash, refuse
on mismatch is a divergence check, not an atomicity claim.

Two things the trait already handles, which is why it does not widen: `watch`
returns a degraded reason rather than failing and names "a SAF tree `[0.4]`" in
its own documentation, and `delete` already reports `Permanent` on a backend
without a trash.

Revocation gets the sharpest rule on the page. A tree whose permission was
withdrawn must read as `Unavailable` with a reason, never as an I/O error and
never as an empty workspace — a workspace listing zero notes because permission
vanished is indistinguishable from one the user emptied, and that is the mistake
worth naming before anybody can make it.

Nothing here is verified and the page says so in its own section. There is no
AVD and no device on this machine, so the contract is a contract; the four-ABI
cross-check landed at 1.6.12 and is compilation evidence, nothing more.

## 1.6.12 - CI checks the core for every Android ABI, not just for iOS

`ACCEPTANCE-0.4.md` said the gate carries "an iOS simulator cross-check ... This
is compilation evidence, not a running mobile app or Android proof." The sentence
was accurate and the asymmetry it described was backwards: iOS is the half that
needs Apple hardware, and it had the check; Android is the half that builds on
any Linux runner, and it had none.

`android-core` mirrors `ios-core` and checks all four ABIs — arm64, armv7, x86
and x86_64 — because `notes-index` bundles SQLite, and a C cross-compile is
precisely the thing that succeeds on one architecture and fails on the next. One
ABI would have been evidence about one ABI.

Verified locally before writing the job, on this machine's NDK 28.2: all four
check clean, and the arm64 `sqlite3.o` reads as `ELF 64-bit LSB relocatable, ARM
aarch64` rather than a host object that happened to be reused. The six-second
finish looked too fast to be real, which is why it was checked rather than
believed.

**Not added to `tools/check.sh`, deliberately.** The local gate now treats a
missing prerequisite as a hard failure, so an Android step would paint the gate
red on every machine without an NDK — the same way the missing MinGW compiler
already does. CI installs its toolchain deterministically and is where the iOS
twin already lives.

## 1.6.11 - the generated Android project enters the repository

First bullet of `ACCEPTANCE-0.4.md`. `tauri android init` produced
`apps/notes-app/src-tauri/gen/android/`: 40 files of manifest, Gradle, Kotlin,
resources and the Gradle wrapper, 388 KB in total. They are committed because
ADR-042 says a generated mobile project is source — its signing, entitlement and
manifest edits are made by hand, and a project regenerated from scratch loses
them.

Nothing that should not be here follows. Tauri writes its own `.gitignore` inside
the project excluding `build`, `.gradle`, `local.properties`, `key.properties` and
`keystore.properties`, so neither build output nor signing material is tracked —
checked against `git status --untracked-files=all` rather than assumed.

This machine turned out to be provisioned for it already: SDK with NDK 28.2,
build-tools 34 and 35, platforms 34 through 36, and all four Android Rust targets
installed. Only `ANDROID_HOME` and `NDK_HOME` were unexported. **iOS remains
impossible from here** and stays in the owner's column: the Apple project needs
macOS, and no amount of Linux substitutes for it.

The gate is unchanged and green: nothing desktop reads this directory, and
`gen/schemas/` keeps its own narrower ignore rather than one that would have
swallowed the new project.

No new document was written for milestone 0.4 in the pass that produced this.
`ACCEPTANCE-0.4.md` already lists what remains and is `ACTIVE`; a second page
repeating it is the duplication `docs/repodocs.md` asks to check for before adding
a documentation file. It is amended instead, in this same commit.

## 1.6.10 - ApplicationBlocked says which call refused, and why

Twenty-nine construction sites read `.map_err(|_| Error::ApplicationBlocked)`.
Every one threw the underlying error away at the boundary, so the variant that
reaches a user names a category and nothing else. The queued intermittent — two
recovery tests failing once with `ApplicationBlocked` in `stage_receiver_edits`,
then surviving twelve runs — was **undiagnosable by construction**: no output it
could produce would say which of a dozen calls had refused, or why.

The variant carries `cause` and its message prints it. The mechanical sites pass
`e.to_string()`; the four that decide "blocked" on their own now state the reason
the code already knew — a captured file gone, a saved note no longer matching its
captured base revision, or the error a lock timeout was not.

`Error::Busy` is untouched, which matters: the match that maps `LockTimeout` to
`Busy` and everything else to `ApplicationBlocked` kept both arms, so lock
contention still reads as contention and is not swallowed into the new message.

This does not fix the intermittent, and the queue item says so. It removes the
reason the intermittent could not be studied: the next occurrence names itself.
Eighty-one tests pass, five of which match the variant and did not need to care
about the cause.

## 1.6.9 - two builds sharing one tree stop corrupting the version placeholder

Reproduced, explained and closed. Both build scripts do the same four things
around a build: copy `tauri.conf.json` aside, stamp the version into it, build,
copy the copy back. Each is correct alone and the pair does not compose. A second
build starting while the first holds its stamp copies aside a file that is
**already stamped**, and its restore writes that back permanently — so the tree
keeps a real version where the committed `0.0.0` belongs, and the next
`tools/check.sh` fails at `version placeholder` for a reason that has nothing to
do with whatever it was testing. That is what happened here on 17/09.

The repro is two cycles of copy-stamp-hold-restore, offset by 200 ms, with the
stamp held for the length of a build rather than the milliseconds a stamp takes.
An earlier attempt with no hold did not reproduce in 80 cycles, which is why the
first pass concluded "not reproducible" — the window is the build, not the write.

**The guard is before the copy, and that placement is the finding.** The first
version put it inside `stamp-version.sh`, and the race survived: the second
process was refused its stamp but had already copied the stamped file, and its
restore still made it permanent. The damage is in the copy. Both build scripts
now refuse to start against a tree whose config is not the committed placeholder,
and `stamp-version.sh` keeps its own refusal as the backstop for anything that
stamps without going through them.

Measured: the same race, with the guard, fires seven refusals and leaves the
config byte-identical. `test_an_already_stamped_tree_is_refused_before_the_backup`
asserts the refusal and that nothing was written over, and fails against the
previous script.

The `.continue/` item asked to reproduce before changing anything, and is removed
here rather than in a later tidy — it described finding the cause, and the cause
is found.

## 1.6.8 - the publish that already ran leaves the queue

`.continue/` holds work that does not exist yet, and an item leaves it when the
thing it describes exists. **Publicação de release** described one act — run
`./build-local.sh --publish` once — and that act ran on 17/09: `TuraNotes_1.6.3`
deb and AppImage ingested at the download service, both updater feeds published
and verified twice, and the project page stopped saying "Em preparação".

The item stayed anyway, because I ran the publish and did not go back to the
document my own work had just aged. That is the failure the rule about fixing a
stale document in the same pass exists to prevent, and leaving it would have sent
the next reader to publish something already published.

What actually remains is not publishing but **accepting**: an update between two
installed versions, on each of the four formats, which no script infers. That was
already the **Atualização desktop** item, so this one is removed rather than
rewritten, and what it knew — that the publish is done, and which artifacts and
feeds are live — is folded into the item that carries the rest.

## 1.6.7 - the Linux build prints the step clock the macOS half already had

`build-local.sh` has timed itself since it was written: each phase opens with a
banner carrying the elapsed time, and the run ends with a table of every step
and a total. On Linux it execs `tools/build-linux.sh` before that block is ever
reached — so a Linux release printed no banner, no table and no total. The only
durations it ever reported were Vite's `built in 324ms` and cargo's ``Finished
`release` profile in 17.37s``, and both of those are one stage inside one step
of a run that takes minutes.

That leaves two ordinary questions unanswerable on the platform that actually
ships: which phase is worth optimising, and whether this machine is slower than
the other one. It is also the third instance of the same shape — the publish
ordering (1.1.14) and the unstamp before the fingerprint (1.1.19) were both
"macOS does it one way, Linux the other, and nobody noticed because only one
side is exercised" — so it is fixed the way those were: one implementation that
both sides call, instead of two that drift.

`tools/build-clock.sh` is that implementation — `step`, `_summary` and
`_clock_abort`, sourced by both scripts, sourcing being what starts the clock.
The Linux pipeline now names every phase it runs: sync, publish preflight, reuse
check, prerequisites, dependencies, signing preflight and stamp, compile and
bundle, names and checksums, upload and ingest. A run that aborts prints one
line — `❌ build aborted after 2m 04s (Linux, exit 42)` — rather than the table,
because a table of steps for a build that produced nothing reads like a build
that worked.

The Linux script also took the EXIT trap shape the macOS one uses: one trap,
installed once and after the option parsing rather than around the compile,
restoring the committed `0.0.0` placeholder *and* reporting how long the run
lasted. It used to install that trap inside the branch that compiles, so a
failure before that branch — a missing library, an unreachable publish host —
ended the run with whatever the failing check printed and nothing about the
build around it.

Measured on the packaging suite, which grew two cases: a successful run opens a
banner for each phase it ran and ends with a table whose heading names the
platform; a failed one prints the abort line with its exit code and no table.
`_BUILD_OS` is set with an `if` rather than `[ … ] && …`, for the reason already
written over the last statement of `build-local.sh`: a top-level AND-list whose
test is false is a non-zero status under `set -e`, and written the short way the
clock would have aborted every build that is not macOS — which is every build it
was added for.

## 1.6.6 - the version stamp stops rewriting the copyright line

`tools/stamp-version.sh` reads `tauri.conf.json`, sets one field and writes it
back with `json.dump(conf, f, indent=2)`. The default there is
`ensure_ascii=True`, so every non-ASCII character comes back as an escape, and
the copyright's `©` was rewritten on every stamp. Both spellings parse to the
same string, so nothing has ever shipped wrong and no build was affected.

It cost an afternoon anyway. A stamp left behind by a build that did not restore
its backup showed up as **two** changed lines — a version and a mangled
copyright — which reads like two writers rather than one, and sent the search for
a concurrent process that was never there. A stamp that edits one field should
produce a one-line diff, so that a leaked one is legible at a glance.

Measured before: four differing lines. After: two, which is the version line
changing. `test_stamping_changes_only_the_version_line` asserts exactly that and
fails against the previous script, naming both lines it touched.

What this does **not** explain is why a stamp was left behind at all. Both build
scripts restore the committed placeholder on exit, including on failure, and
neither the packaging suite alone nor a full gate run reproduces it. That is in
`.continue/` as its own item, to be reproduced before anything is changed for it.

## 1.6.5 - remote MCP answers at POST /v1/mcp

Milestone 0.7. One endpoint, one JSON-RPC message per request, one JSON
response. No SSE stream: none of the eight tools notifies, samples or elicits,
and a stream with nothing to carry is a listener to maintain for no behavior.
A notification — no `id` — gets `202` and an empty body, which is the stdio loop
writing nothing, expressed in HTTP.

**Nothing about authorization is re-implemented, and that is the delivery.** By
the time the handler runs, the credential has been authenticated in constant
time, rate-limited per IP and per token, refused if it carried `Origin`, and
audited. The `AgentConfig` it builds — workspace, scope, permissions, review — is
the same one the REST routes build two screens below, and `tools/list` is
filtered by the same permission map the stdio binary uses. A credential holding
only `Read` is told about `notes_list` and `notes_read` and nothing else: the
catalogue is the authorization surface, not a menu.

`Session::stateless()` is where the design met the first real question. The gate
that refuses a second `initialize` is correct on stdio, where the connection *is*
the session, and wrong over HTTP, where each request carries its own credential
and nothing survives between them. The first cut set `initialized: true` to open
the gate and thereby disabled the `initialize` branch itself — the test caught it
answering `Method not found` to a handshake. `Session` now carries whether the
transport keeps anything, `Default` is written out rather than derived so a
derived `false` cannot quietly turn stdio into the other transport, and
`Mcp-Session-Id` is echoed when sent and never required.

Four tests, and one of them found a real thing. `server/notes-server/tests/http.rs`
covers the filtered catalogue, the refused unlisted tool, the echoed session
header and a scoped read that must not return the marker planted outside it.
`server/tests/mcp.py` runs a real process with two real credentials through
`initialize` → `tools/list` → create → read → update → stale update, and asserts
the file on disk. It is its own process rather than an addition to `smoke.py`,
because that suite already spends most of a 120/min per-IP budget and these calls
are what would push it over.

What the smoke found: a note created with CRLF reads back as `\n` and stays CRLF
on disk. Byte preservation reaches through MCP unchanged, and the test now says so
out loud instead of asserting the wrong half of it.

## 1.6.4 - write the contract remote MCP is measured against

`docs/MCP-0.7.md`, status `PROPOSED`: nothing in it is built, and it moves to
`ACTIVE` only when the thing exists. It exists now because reading the two halves
made the milestone smaller than the queue item implied, and that is worth writing
down before building rather than discovering twice.

The finding: `server/notes-server` already builds the same `AgentConfig` out of a
credential — workspace, scope, permissions, review — and calls the same
`AgentService` the stdio MCP calls. Its REST routes are already a verb-to-tool
mapping. So remote MCP is a second envelope over a call path that is already
authenticated, already scoped and already shared, not new behavior over notes.

What the contract settles: one endpoint, `POST /v1/mcp`, one JSON-RPC message per
request, and no SSE stream, because none of the eight tools notifies, samples or
elicits and an idle stream is a listener to maintain for no behavior. The bearer
credential is the one REST already uses. `Mcp-Session-Id` is echoed when sent and
never required, because over HTTP each request carries its own credential and
making correctness depend on state the transport does not keep is a bug waiting
for a proxy to expose it.

## 1.6.4 - answer tools/list from one catalogue instead of two

`fn tools()` and the JSON-RPC envelope were private to
`crates/notes-mcp/src/main.rs`, which is where they had to stop being: the server
cannot call into a binary. Building the remote transport against a copy would put
two descriptions of every tool's schema in the tree, and a schema that drifts
gives no sign until an agent sends an argument the other half rejects.

They move to `crates/notes-mcp/src/lib.rs`. The binary keeps its stdio loop and
nothing else. `Session` carries what the handshake established, with
`Session::stateless()` for a transport that authenticates every request on its
own — the gate stays real where the connection is the session, and is open where
there is none, rather than being silently absent.

No behavior changes, and the proof is that the six stdio tests pass untouched:
they spawn the real binary and speak the protocol, so they cannot tell a refactor
from a rewrite except by its results.

## 1.6.4 - the roadmap named six MCP tools and the code has eight

`roadmap.md` §0.7 listed `notes_list`, `notes_search`, `notes_read`,
`notes_create`, `notes_update` and `notes_move`. The stdio server has shipped
`notes_append` and `notes_delete` since 0.3, each behind its own permission.

Correcting it is part of producing 0.7 rather than a separate tidy: a contract
written against a stale roadmap would have specified a remote surface two tools
narrower than the local one, and the milestone's whole rule is that MCP is a layer
over the same calls, not a second implementation with its own inventory.

## 1.6.3 - name only the release that is actually missing its attachments

The queue's **Anexos minor perdidos no Build** item said 1.4.0 and 1.5.0 both
carry no attachment at all, and told whoever picks it up to dispatch the Build
for 1.5.0. Measured against the releases today: 1.4.0 has zero, 1.5.0 has
fourteen, 1.6.0 has fourteen. Only 1.4.0 is still empty, and the recovery it
names would have rebuilt a version that no longer needs it while leaving the one
that does.

The item now names 1.4.0, carries the measurement and its date, and keeps the
consequence that makes it worth doing: `deploy-server.sh` derives `X.Y.0` and
would fetch a file that is not there. The cause stays fixed in 1.5.5 and the act
stays the owner's.

A queue item is the only place unbuilt work exists, so an item that describes the
wrong target is worse than a missing one — it sends the next person to rebuild
something that is already whole.

## 1.6.2 - correct the claim that the old pull test passed for the wrong reason

The 1.1.11 entry ends by saying the earlier `test_failed_pull_stops_before_stamping`
passed for the wrong reason, because a `git` faked to fail at everything takes
the not-a-checkout branch and never reaches the pull. That is false about the
test it describes. The script that test was written against made exactly one
`git` call — `git pull --ff-only`, under `set -e` — so a blanket fake reached
that call and the build aborted on 17, which is precisely what the test
asserted. Verified by reading the script as it stood at that commit.

The not-a-checkout branch arrived with 1.1.11 itself. So the selective fake was
a consequence of the new script, not the repair of an old mistake, and the
sentence blamed a working test for a gap the same change had just introduced.

The 1.1.11 entry is not rewritten — this file never is. A dated correction is
appended inside it, adding without removing, so a reader who lands on that entry
alone meets the claim and its correction together. The published Release for
1.1.11 carries the same body and is edited to match, because `tools/release.sh`
skips a version that already has a Release and would never revisit it. The
commit message itself stands as written: history is not rewritten either.

## 1.6.1 - the deb installs over the package it was renamed from

```
dpkg: error processing archive TuraNotes_1.3.6_amd64.deb (--install):
 trying to overwrite '/usr/bin/notes', which is also in package notes (0.11.11)
```

That is what a Tura Notes package has done on a machine carrying a pre-1.0.0
release, every version since 1.0.0. ADR-069 renamed the product and **kept** the
`notes` binary, the identifier and the data paths on purpose, so that installed
users kept their settings and their workspace. The name it could not keep is the
one nobody writes: the bundler derives the **package** name from `productName`,
so the package became `tura-notes` while every path inside it stayed where it
was — and dpkg does not own files, packages do. The identity that was preserved
is exactly the identity that refuses the upgrade.

Nothing caught it because nothing in the build, the gate or CI ever installs a
package over an older one. It surfaced when the owner typed `dpkg -i`.

ADR-082: the rename is **declared**, not performed. The deb now carries
`Conflicts: notes (<< 1.0.0)` and `Replaces: notes (<< 1.0.0)` — both, because
each alone is the wrong half. `Conflicts` by itself refuses the install politely
and permanently; `Replaces` by itself overwrites the file and leaves the old
package installed, still claiming `/usr/bin/notes` and still shipping a
`notes.desktop` that points at it. Together they are the one operation dpkg
performs unforced: remove the old, install the new. `--force-overwrite` reaches
the same screen and leaves the machine in the state `Replaces` alone produces.

**The bound is `<< 1.0.0`, and the claim reaches no further.** Every release
under the old package name was a `0.x`; `notes` is a generic enough name for the
archive to give to somebody else, and an unbounded `Conflicts: notes` would
remove *their* package on any machine that had it. No `Provides`: nothing
depends on the old name. No rpm equivalent either — rpm packaging arrived at
1.0.3, after the rename, so no rpm ever carried the old name, and the AUR
package kept its `notes-bin` name throughout.

**What it measured.** The 1.6.1 deb was built and read back: `dpkg-deb -I` shows
both fields in the control file. Then `dpkg --dry-run --install`, against this
machine's own database, where 0.11.11 is still the installed package:

```
dpkg: considering removing notes in favour of tura-notes ...
dpkg: yes, will remove notes in favour of tura-notes
```

A dry run changes nothing — it could not even open `/var/log/dpkg.log` — so the
install itself is still the owner's step, with root. The new
`DebianRename` test asserts both fields in the committed configuration and that
the binary name they exist for is still `notes`; it was re-broken twice to
confirm it fails, once with the declaration removed and once with `Replaces`
alone, which is the half-fix somebody will reach for.

## 1.6.0 - the deploy refuses a server binary it cannot prove came from us

ADR-081 implemented. `deploy-server.sh` fetches the `.minisig` beside the
tarball and verifies it with `minisign` against a public key committed in this
repository, **before `tar` and long before `/usr/local/bin`** — extracting an
unverified archive is already trusting it. A missing pinned key, a host without
`minisign`, an absent signature and a signature that does not match are four
refusals, not four skips.

**Refusing does not stop the server.** The running binary keeps running: a
mismatch is far more often a publishing mistake than an attack, and turning one
into an outage of every paired device's notes would be a second failure caused
by the first. The test asserts that too — `systemctl` may not appear anywhere in
the failure path.

`tools/sign-server-release.sh` is what the owner runs: `init` generates the pair
once and **refuses to overwrite** an existing key, because regenerating over one
in use silently invalidates every signature already published and the symptom
appears in a deploy, on a host that is serving. Signing downloads the release
asset, verifies its checksum *before* signing — signing a truncated download
publishes a valid signature over wrong bytes, which is worse than not signing,
since it passes the deploy and installs a binary that will not execute — and
verifies the result against the **committed public half** rather than the
private key that just produced it, which is what catches a restored backup or
last year's key here instead of on the host.

**Two of my own assertions were decoration, and the negative control is what
said so.** `minisign -Vm` before `install` passed a regression that moved
verification past the extraction; checking that `[ -f "$pubkey" ]` appears
passed `[ -f "$pubkey" ] || true`. They assert the ordering against `tar` and
the guarded *form* now, and each was re-broken to confirm it fails. The checks
also run before the ordering ones, so deleting a step reports what is missing
instead of a `substring not found` traceback.

**ADR-081's decision 2 is corrected in the same pass, and the correction is the
honest part of this commit.** It said the Release asset would be *produced* by
the same local act as the desktop bundles. Implementing it showed that act does
not exist — neither `build-local.sh` nor `tools/build-linux.sh` builds
`notes-server`, and what they publish goes to the owner's download service, not
to GitHub Releases. CI keeps building and attaching; the signature is what moves
offline. That closes asset substitution, which is what the finding was about,
and does not close a compromised CI, which is written into the ADR rather than
left for someone to discover.

**Nothing verifies yet, and that is the intended state.** No key exists, so the
deploy refuses — deny by default, `security.md` §3.5. The two commands that
finish it are in the queue and in `SELF-HOSTING.md`; only the owner can run
them, because the private half must never touch anything else.

## 1.5.7 - the connection test, against a server that is actually running

Every other test of `Remote::probe` answers it from a `TcpListener` with canned
bytes. That proves the mapping from a response to an outcome and says nothing
about DNS, TLS, a proxy in front of the server, or a credential a real server
issued — which is the half that fails in the field, and the half that cannot be
faked usefully.

`NOTES_PROBE_URL` and `NOTES_PROBE_TOKEN_FILE`, ignored by default, the same
shape `deep.rs` already uses for `NOTES_DEEP_ROOT`. It prints the outcome, the
status, the workspace, the scope, the permissions and the review flag, and never
the credential.

It earned itself immediately. The owner reported the panel saying nothing on a
real pairing attempt, and this separated the two halves in one run: against
`tura.samirhv.com.br` the Rust side answered `Granted · 200 · workspace
"personal"` with all five permissions. The fault is between the button and that
function, which is a much smaller place to look than "the connection test does
not work".

`SyncProbeOutcome` derives `Debug` so the outcome can be printed at all.

## 1.5.6 - the connection test's answer stops looking like the advice around it

`.device-probe` shipped in 1.3.8 with no rule in the stylesheet. The result
rendered as a plain paragraph between *Still needed before pairing…* and *Close
the workspace to review identities…* — three grey sentences in a row, one of
which was the answer. The owner installed the build, looked at the panel and
said *não sei, pelo que vejo é indefinido se está ou não funcionando*, which is
the sentence the whole feature was built to stop.

An answer indistinguishable from the advice around it has not answered anything.
The verdict is now a colour — green for a credential that works, red for
something that is not this machine's to fix, amber for something that is — and
the words still carry the reason. Three tones rather than seven, because a
colour can only say *done*, *not yours* and *yours*; the seven outcomes are what
the sentence is for.

A credential that works and requires server-side review is amber, not green:
pairing refuses it, so it is not a pass.

The three colours are `--good`, `--bad` and `--warn`, already checked at AA
against every surface by `tools/contrast.sh`; a tinted block would have been a
new surface nothing verifies. The tone map is exhaustive over the generated
union, like the sentence map beside it, so a variant added in Rust has to pick a
tone or fail the TypeScript build.

## 1.5.5 - the build stops cancelling the only version that builds anything

`build.yml` had `group: build` with `cancel-in-progress: true` at workflow
level, and the comment defending it stated the hole as a virtue: *"what has to
be installable is the newest — which is exactly the one this rule always
builds."*

**That does not hold for a minor.** Artifacts are built on `X.Y.0` and never on
a patch (ADR-036), so when the push of 1.5.1 cancelled 1.5.0's build, the newest
version was a patch, patches build nothing, and nothing ever rebuilt them.
1.4.0 and 1.5.0 both carry no server tarball at all — while `deploy-server.sh`
derives `X.Y.0` and downloads exactly that asset. The deploy is broken against
the last two minors, today.

The cancelling group moves to the jobs that cost something, where
`needs.what.outputs.version` exists and the group can be keyed on it:
`build-linux-1.5.0`, `build-arch-1.5.0`. A version is unique, so a minor's build
is never cancelled by a different one; re-running the same version still cancels
the older, which is the case where "the newest wins" meant something.

**Nothing is starved, which was the original and correct worry.** A patch's run
is the `what` job and nothing else — `build` comes back false and every
expensive job is gated on it — so the burst of Releases a working session
produces costs seconds, not nine minutes each. The protection was aimed at a
problem that the `build` gate had already solved on its own.

Validated with `actionlint`, which confirms `needs` is a legal context in a
job-level `concurrency` — the thing that makes this possible at all — and
reports no finding this change introduced: the four it does report on the file
are byte-identical to the ones it reports against `HEAD`.

The cause is fixed; the two Releases that already lost their assets are not, and
that stays in the queue. Rebuilding them is a `workflow_dispatch` that publishes
artifacts, which is the owner's call rather than a repair to make quietly.

## 1.5.4 - ADR-081: the server binary is signed with a key CI never holds

The review of 1.5.3 left one finding unfixed on purpose, because "sign it"
answers none of the three questions inside it. This is the decision; the work is
queued.

**What the checksum was actually claiming.** `deploy-server.sh` fetches the
tarball and its `.sha256` from the same GitHub Releases URL, and `build.yml`
produces both in one step on one runner. Anyone in a position to serve a
different tarball is in a position to serve its digest. The script's comment
claims only truncation and is right to; the ADR is about the claim nobody was
making.

**Why the asymmetry with ADR-074 exists at all** turns out not to be a
difference of principle. The macOS and Windows jobs are `if: false` (ADR-024),
so those bundles come from `build-local.sh` on the owner's machine — where the
key is. The Linux job runs in CI, where it is not. The artifact is built where
the key is absent, and the signature went missing with it.

The three decisions: **the key never enters CI**, because a key in a workflow
secret is usable by anything that can make a workflow run, and signing there
would move the trust boundary from GitHub-the-CDN to GitHub-the-CI and call it
provenance. It is a **separate** minisign key from the updater's, whose public
half ships inside every installed desktop application — one compromise should
not have two blast radii. **CI keeps building the binary unsigned** as a check
that it compiles, and the published asset comes from the same local act that
already produces the desktop bundles. And **a deploy that cannot verify changes
nothing and does not stop the service**: a mismatch is far likelier to be a
publishing mistake than an attack, and turning one into an outage of every
paired device's notes is a second failure caused by the first.

**A precondition the ADR names and does not fix.** 1.4.0 and 1.5.0 carry no
server tarball at all. `build.yml` has `concurrency: cancel-in-progress: true`,
and the minor's artifact build was cancelled by the next push; everything after
was a patch, which builds nothing by design. The workflow's comment accepts
losing artifacts on an intermediate version because "what has to be installable
is the newest" — which does not hold for a **minor**, since the newest is
usually a patch and a patch never rebuilds it. `deploy-server.sh` derives
`X.Y.0` and would download an asset that does not exist. Signing something that
is not being published is not worth doing first, so both go to the queue in
order.

Nothing is implemented here. The ADR says so on its status line and the queue
carries the work, because `.continue/` is where work that does not exist lives.

## 1.5.3 - the deploy stops instead of reporting success when a step fails

`deploy-server.sh` runs under `set -uo pipefail` and deliberately not `-e`, so
every failure path is explicit and the message names the step. Three commands
had been left without their `|| fail`, and the worst was inside the block that
exists to prevent exactly this.

**The self-pinning copy could report a successful deploy in which nothing ran.**
The block copies the script to `/run` and `exec`s the copy, so a `git pull`
cannot swap the file underneath a running deploy — the header cites a real case
where that skipped a step in silence and still reported success. But `cp` was
unchecked, `mktemp` leaves an **empty** file, and `bash` on an empty file exits
**0**. A failed copy therefore made `exec` run nothing, successfully, and the
orchestrator printed a green deploy. Measured against the previous version of
the block with a `cp` that returns 0 without writing: **exit 0, no output**.
After: exit 1, `a cópia fixada em … saiu vazia`.

The content is asserted, not just the exit code, and that is the point rather
than belt-and-braces: `/run` is a tmpfs, and a full one lets `cp` return 0
having written zero bytes. The check is on the property the next line depends
on.

The other two are the same shape one step down. `mkdir -p "$(dirname "$STAMP")"
&& printf … > "$STAMP"`: a failed `mkdir` skipped the `printf` and failed
nothing, leaving no stamp — so the next deploy re-downloaded the binary and
restarted a service that holds notes, believing it had never installed. And
`systemctl daemon-reload` was unchecked immediately after the unit file had been
rewritten, so a failure there would have had the `restart` below bring the
**old** unit up and report success.

`server/tests/cotenant.py` asserts the class rather than the three lines,
because the next one is a fourth command somebody adds without the suffix: every
line starting `cp`/`mkdir`/`install`/`systemctl`/`mv`/`tar`/`printf`, outside
comments and across `\` continuations, must carry `|| fail`. Plus the one
property no exit code reports — that the pinned copy has content, checked before
the `exec` rather than after. Both verified by removing them: the first names
the line and the command, the second says the copy is exec'd unchecked.

Finding 2 of the same review is deliberately **not** here. The server binary is
verified by a checksum fetched from the same URL as the tarball, which catches
truncation and not substitution, while the desktop updater has a pinned key and
signature verification (ADR-074). Closing that asymmetry decides where a private
key lives, who signs in the release pipeline, and what a deploy does when a
signature fails on a host that is already serving. That is an ADR, not a line in
this script.

## 1.5.2 - one session per worktree

Two agent sessions shared this working tree for the length of a review, and the
rule is written from what that produced rather than from principle:

- A blanket `git add -A` in one session swept the other's scratch file into its
  commit and published it, with a stray 16-byte file from the repository root
  alongside.
- The `rustls` security bump of 1.4.4 was reverted in `Cargo.lock` underneath
  the session that made it, between the command that wrote it and the command
  that read it back. It was caught only because the version was re-read; a
  commit two seconds earlier would have shipped an empty fix.
- Two `cargo test` runs against one `target/` produced a failure that twelve
  subsequent runs could not reproduce, and it is still queued as unexplained.

None of those was anybody's mistake. They are what concurrent writers to one
tree produce, and care inside a session cannot prevent them, because the other
session is not in it.

The rule goes in `CLAUDE.md` and `AGENTS.md` **outside the marked echo blocks**:
it is local, and written inside the markers it would be erased by the next fleet
regeneration with nobody noticing. It carries the practical form —
`git worktree add`, and the `core.hooksPath` a fresh worktree needs the same way
a fresh clone does — and what to do when a session inherits a shared tree
anyway: say so before committing, `git add <path>` rather than `-A`, and re-read
`version.md` and `git log` immediately before writing a commit.

## 1.5.1 - a missing tool is a failure, not a warning

`tools/check.sh` had two steps that printed `WARNING, not run` and let the gate
finish green: the Windows cross-check, when rustup or the MinGW compiler was
absent, and `rust advisories`, when `cargo-audit` was not installed.

The second one had been silently skipped on the owner's machine for its whole
life. CI ran it and was red on it, and a real `rustls` TLS 1.3 handshake flaw —
on the path every device sync request and every signed update download takes —
sat inside that red for two versions (1.4.4). The local gate said "all green"
the entire time. **The difference between a check that was skipped and a check
that passed has to survive into the exit code**, or the two are the same thing
to whoever reads the output.

`require_tool` installs what can be installed unattended — `cargo install
cargo-audit --locked` — and fails if it cannot. `missing` prints the step with
`FAILED, not run` and the one command that fixes it, which is what the warning
was useful for; what it no longer does is let the run claim to have checked
something it skipped.

**`NOTES_NO_WINDOWS_CHECK=1` is now the only way that step does not run.** An
escape hatch somebody chose, in writing, in the environment, is a skip and
prints as one. A tool nobody noticed was missing is a failure. The file's own
header argued for exactly this one paragraph above the code that contradicted
it — *a check that silently opts out is not a check* — and the header is
corrected in the same pass.

Verified by asking for a tool that does not exist and cannot be installed: the
step prints `FAILED, not run` and `fail` is 1.

## 1.5.0 - the one-second rule is asserted where its numbers came from

ADR-080, amending ADR-034. **The criterion does not move** — `workspace_open`
returns and the tree appears in under one second, at any size. What moves is
where that number is a verdict.

The ceiling was asserted as a wall clock on all three platforms. On
`windows-latest` the same 2 160 directories that open in ~10 ms here measured
**1 243 ms**, on a commit whose contents were a Linux-only test file, a queue
row and `Cargo.lock` — nothing that could slow an open. The next commit was
green and the one after red again on a different test. The number was reporting
a contended runner scanning a tree created milliseconds earlier, not the code.

**Why that gets an ADR instead of a bigger number.** This repository has just
paid for the answer: `cargo audit --deny warnings` sat red on eight advisories
nobody could act on, and a real `rustls` TLS 1.3 flaw — on the path every sync
request and every signed update takes — lived inside that red for two versions
before anyone read past it. A check that is red for a reason which is not the
code spends the attention the next real finding needs.

So: asserted on Linux, the platform whose numbers the rule was written from and
the least contended runner; **measured and published on every platform** into
the CI job summary, with the directory count and whether it was asserted. An
assertion that is dropped without a reading in its place leaves a criterion
nothing reports the drift of, which decays faster than a flaky one.

`received_bytes_remain_pending_until_explicit_application` gets
`#[cfg_attr(windows, ignore = …)]` with the queue item named in the reason —
intact on Linux and macOS, skipped only where it is intermittent, and not
weakened anywhere. It has no diagnosis and the honest ways to get one need a
Windows machine.

The ADR says what this is not: a licence to move an assertion to a friendlier
platform when it goes red. The test here was measuring the runner and not the
code, demonstrably — same input, three verdicts across commits that could not
have changed it. A test that fails because the code is slow on a platform is a
bug on that platform, and it is fixed there.

Verified both halves. The assertion still fails when it should: forcing the
Linux branch on with an impossible ceiling produces
`2 160 directories took 11.01 ms … over the one-second rule`. The publication
produces a markdown table in `$GITHUB_STEP_SUMMARY` and is silent outside
Actions. Both changes cross-check clean against `x86_64-pc-windows-gnu`.

`ADR-034` rule 1, `ARCHITECTURE.md`'s one-second section and
`ACCEPTANCE-0.1b.md`'s test row are corrected in the same pass.

## 1.4.7 - version.md had a literal backslash-n where a newline belonged

1.4.6 was written by a Python snippet inside a quoted heredoc, where `"\\n"`
is two characters and not a line ending. `version.md` came out as
`1.4.6\\n` — six bytes of version and two of garbage.

**Nothing caught it**, and the reason is the tolerance that exists for good
reasons: `docs/versioning.md` says the version is the *first* semver in the
file, so a bare string and a markdown document both satisfy it. `1.4.6\\n`
satisfies it too. The `pre-push` hook read 1.4.6, compared it against the
remote, and passed — correctly, by the rule as written.

So the file is corrected and the tolerance is left alone. Narrowing "first
semver" to "exactly one semver and a newline" would break the markdown form the
rule deliberately allows, to catch a typo that a `printf` does not make in the
first place.

## 1.4.6 - the Windows job is intermittent in two different places

With ubuntu, Arch, the advisories and the contract checks green, `rust
(windows-latest)` became the only red left — and it turns out to alternate on
commits that cannot have caused it:

| version | Windows | what failed |
|---|---|---|
| 1.4.3 | red | `the_tree_appears_in_well_under_a_second` — 2 160 directories in **1 243 ms** against a 1 000 ms ceiling |
| 1.4.4 | green | — |
| 1.4.5 | red | `received_bytes_remain_pending_until_explicit_application`, `control.rs:901`, the peer log holding 3 where 4 was expected |

Two different tests, and the only commits between them touch a Linux-only test
file, a queue row, `Cargo.lock` and CI YAML. 1.4.4 is the `rustls` bump and it
is the one that passed, which exonerates the dependency change specifically.

**Neither is fixed here, and the first one should not be fixed quietly.**
ADR-034 promises the tree appears in under a second at any size, and 1 243 ms on
a contended shared runner is not evidence that a user's machine misses it —
but loosening a product criterion's assertion to make CI green is a decision
with an ADR attached, not a patch. The second has no diagnosis at all and wants
a Windows machine to get one.

They go to the queue with their evidence instead. This is the same call as the
`recovery` flake recorded in 1.4.3: an intermittent failure nobody wrote down is
one somebody rediscovers.

## 1.4.5 - eight advisories nobody can act on stop hiding the ones we can

`cargo audit --deny warnings` had been failing CI on eight `unmaintained` and
`unsound` warnings, and none of the eight is this repository's to upgrade: five
`unic-*` crates arrive through Tauri's `urlpattern`, `glib` and
`proc-macro-error` through GTK on Linux, and `ttf-parser` through `pdf-extract`.

Leaving them red was not the safe direction. **RUSTSEC-2026-0285 — a real TLS
1.3 handshake flaw in `rustls`, on the path every device sync request and every
signed update download takes — sat in the middle of them for two versions and
was found only by reading past them** (1.4.4). A permanently red check is one
nobody reads, and this one had already cost a genuine finding.

`.cargo/audit.toml` names all eight with their source and the condition that
retires each: the `unic-*` family leaves when Tauri drops `urlpattern`, the GTK
pair when Tauri moves to glib 0.20, and `ttf-parser` is flagged as the only one
that is our own choice to revisit, since `pdf-extract` is a dependency this
workspace picked. The file says in as many words what may not go in it: a
vulnerability is fixed or the dependency goes, and 1.4.4 is the precedent.

Everything not listed still fails the build — verified by deleting one ID and
watching `cargo audit --deny warnings` go back to exit 1, then restoring it.

The GTK pair is worth one more note: it is invisible on macOS and Windows, where
GTK is not in the dependency tree at all. A gate run on a Mac cannot see those
two, which is why they were only ever red in CI.

## 1.4.5 - the co-tenant check needs a binary, and `contracts` builds nothing

`server/tests/cotenant.py` joined the `contracts` job in 1.4.2 and failed on the
first run: it needs `target/debug/notes-server` on disk, and that job's whole
premise is that it compiles nothing. It had passed locally for the worst reason
— the binary was already sitting in `target/` from an earlier build — which is
exactly the kind of green a clean runner exists to refuse.

It moves to `server HTTPS container`, which already has a toolchain and is about
the server, and builds `notes-server` before running it. The other seven checks
stay: the same CI run proved them on a machine with no `target/` at all.

**The grouped step earned itself on its first outing.** One check failed, the
seven after it still ran and reported, and the step exited non-zero. As eight
separate steps the first failure would have hidden the rest, and the answer to
"is anything else wrong" would have cost another push.

## 1.4.4 - rustls carried a TLS 1.3 handshake flaw on both transport paths

`cargo audit` reports **one vulnerability**, not only the unmaintained warnings
that were drowning it in the log: RUSTSEC-2026-0285, medium (5.3) —
*TLS 1.3 handshake messages incorrectly accepted across encryption level
boundaries* — against `rustls 0.23.44`, fixed in 0.23.45.

It is not an incidental transitive crate. It is a direct dependency of
`notes-sync-client`, and it backs both paths where this product speaks TLS:
`reqwest`, which carries every device sync request to the server, and
`tauri-plugin-updater`, which downloads the signed desktop update. ADR-074 pins
the updater's public key and verifies the signature before installing, so a
tampered payload is still refused — but the transport underneath it was the one
with the advisory.

`cargo update -p rustls` moves it inside its own semver range: one line of
`Cargo.lock`, no API change, no code change. `cargo audit` then reports no
vulnerabilities.

**It had not been seen locally because the tool is not installed on this
machine**, and `tools/check.sh` degrades that step to
`WARNING, not run — install it once` rather than failing. That degradation is
the right call — the same one the Windows cross-check makes — but it means the
local gate and CI disagree about what green means, and CI is the one that had
been red. Installing `cargo-audit` is what turned eight lines of unmaintained
noise into a finding.

## 1.4.3 - the Linux-only watcher test still read `degraded` as a field

Moving the watcher's setup onto its own thread — the fix that stopped
`start_watch` costing 270 ms of held service mutex on macOS — turned
`Watch::degraded` from a public field into a method, because the answer now
arrives after the caller already holds its `Watch`.
`crates/notes-fs/tests/watch_walk.rs` still read it as a field, in four places,
and the file is `#![cfg(target_os = "linux")]`.

**So the macOS gate compiled none of it and was green.** CI was red on
`rust (ubuntu-latest)` and on the Arch job for two versions, with
`error[E0615]: attempted to take value of method `degraded``.

The fix is not the parentheses. `degraded()` is `None` until the thread has
tried, which the API says in as many words, so a guard that asks the moment
`watch()` returns reads `None` on a machine that cannot watch at all — it would
have compiled and stopped skipping, and the test would have failed on the
assertions instead. `fail()` records the reason and clears `walking` together,
so each test asks where its own shape allows:

- `the_walk_reports_its_progress_and_finishes` already polls until `!walking`;
  the guard moved below that loop and reads `WatchProgress::degraded`.
- `dropping_the_watch_stops_the_walk_where_it_is` drops the `Watch` before the
  walk starts, which is its whole point, so there is no moment at which asking
  the `Watch` would have an answer. It reads the reason from the counters it
  already keeps for the count.

Verified by reproducing the failure on this machine before fixing it:
`rustup target add x86_64-unknown-linux-gnu` and `cargo check --target
x86_64-unknown-linux-gnu -p notes-fs --all-targets` gave the same four E0615s,
and pass after. `notes-model`, `notes-markdown` and `notes-sync` cross-check
clean too; the rest of the workspace needs a Linux C cross-compiler for SQLite,
which this machine does not have.

**The gate cross-checks Windows and not Linux, and that is the gap this fell
through.** `tools/check.sh` says why the Windows round exists — `cfg`-gated code
the native target cannot see, two CI rounds spent on exactly that — and the same
argument covers Linux, where `PER_DIRECTORY` puts the watcher's only per-directory
walk. Adding the round is its own commit; this one repairs the break.

## 1.4.2 - eight contracts the local gate checked and no pull request did

`tools/check.sh` and `.github/workflows/ci.yml` are two lists of the same
contracts, and two lists drift. Comparing them command by command found eight
checks that existed only in the local gate:

- `tools/ts-serde.py` — a serde wrapper declares its wire shape
- `tools/doc-status.sh` — every document declares one of the five statuses
- `server/tests/cotenant.py` — the co-tenant templates and the credential wrapper
- `tools/tests/test_build_linux.py` — Linux packaging orchestration
- `tools/tests/test_updater_release.py` — updater publication
- `tools/tests/test_build_local.py` — the macOS build script
- `tools/tests/test_selfhosting_doc.py` — the guide matches the code
- `tools/tests/test_env_report.py` — the env report is not a hand-written IPC shape

**A pull request that broke any of them merged green.** Three of the eight guard
things a reviewer cannot see by reading the diff — that the Apache template does
not take the other eight sites down, that the self-hosting guide still describes
the commands the code actually has, that a newly generated binding matches the
wire — and the local gate only runs when somebody remembers to run it. That is a
convention, not a gate, and the distinction is the whole reason this repository
writes checks instead of rules.

They run in `contracts`, the job that deliberately builds nothing: all eight are
pure `python3`/`bash`, with no toolchain, no system package and no network. They
are one step rather than eight because a failing step hides the ones after it,
and "what else is broken" should not cost another push — every check reports,
and the step fails if any did.

Verified by running the block exactly as the workflow will: eight green and exit
0, then with `RelPath`'s `#[ts(type = "string")]` deleted — one `::error::`, the
other seven still reported, exit 1. A grouped step that swallowed a failure
would have looked identical to a passing one from the outside.

The first comparison was wrong in the other direction and worth recording: it
matched step *names* rather than commands and reported `i18n keys resolve` as
missing when CI already runs `tools/i18n-keys.py`. Redoing it against the
commands is what produced the eight above.

## 1.4.1 - the serde/ts check could not see the two ids every payload carries

`tools/ts-serde.py` asserts that a type ts-rs cannot parse — `transparent`,
`try_from`, `into` — also carries an explicit `#[ts(type = "…")]`, because
without one the generated binding describes `{0: T}` while the wire carries a
bare `T`. It was green. It was green over a blind spot.

The parser read one line at a time and ended an attribute block at the first
line that was not an attribute, so a derive written across lines ended at its
own second line:

    #[derive(
        Debug, Clone, Copy, …, Serialize, Deserialize, TS,
    )]

That is exactly how `notes-model/src/ids.rs` writes `uuid_newtype!`, and the two
types it declares are `WorkspaceId` and `NoteId` — the identifiers on nearly
every IPC payload there is. A second miss compounded it: the item line inside
the macro reads `pub struct $name(Uuid);`, and a pattern requiring `\w` after
the keyword does not match a metavariable. Removing the `#[ts(type = "string")]`
from either one left the check reporting success.

Attributes are now accumulated until their brackets balance, string literals are
removed before those brackets are counted, and `$name` is accepted as a name.
Verified the way the claim deserves — by deleting the override at each of the
three real sites in turn and watching the check name the file and the line:
`SearchId`, `$name` in `ids.rs`, `RelPath`. Before the fix, `ids.rs` was missed.

**The reason the blind spot survived is that nothing ever asserted a failure.**
So `SELF_TEST` runs first, on seven synthetic blocks including both the
multi-line derive and the macro form, in their violating and their compliant
shapes. A run that cannot tell the two apart exits non-zero and says its silence
means nothing, before it has looked at the repository at all. A check that has
never been seen to fail is a check nobody has tested — this one now tests itself
every time it runs.

The ten `warning: failed to parse serde attribute` lines stay. They are noise,
and they are allowed to be noise precisely because the pairing they announce is
asserted here instead — silencing them would have hidden the same signal one
level further down.

## 1.4.0 - the MIT licence the metadata had been claiming for 78 versions

`Cargo.toml` says `license = "MIT"`. `tauri.conf.json` says `"license": "MIT"`.
There was no licence text anywhere in the repository, which is the one thing MIT
actually requires: *the above copyright notice and this permission notice shall
be included in all copies or substantial portions of the Software.* A licence
named in metadata and shipped nowhere grants nothing — the reader has to guess
which MIT, from which year, held by whom.

`LICENSE` now says it, and `bundle.copyright` carries the same line into the
installers and the About dialog, which reads it back rather than holding a
second copy of the year.

Found while looking for a copyright string to suggest, which is the only reason
it was noticed at all.

## 1.4.0 - Help ▸ About is a dialog of ours, and it can be copied

1.3.9 put the platform's own About panel in Help, on the argument that it
already carries the name, the version and the copyright and that a dialog of
ours would be one more thing to translate, style and keep in step with a number
it does not own. That argument answers the question the owner asked first —
*which version am I on* — and nothing else, which is the flaw in it.

The questions that actually arrive with a problem had no surface anywhere:
which engine is drawing this window, where the data directory is, which folder
is open. They were readable, if at all, from three different screens, and
somebody reading five values off three screens transcribes one of them wrong.

So the dialog states all five and **copies them**, and the Copy button is the
reason it exists rather than a convenience on top of it. These lines get written
down in order to be sent to somebody else, and a platform panel cannot be copied
at all. The copied text is built from the rendered rows, so the paste cannot
drift from the screen.

The engine line is read from the window's own user agent, because a rendering
fault is an engine fault and "macOS 26" does not say which WebKit shipped inside
it. Windows is matched first: WebView2's user agent carries `AppleWebKit` too,
and checking that first would report every Windows install as WebKit. There is a
test for exactly that.

Help is emptied before the item is added. Linux and Windows get a predefined
About there from Tauri's default and macOS gets an empty Help, so without the
clearing the two platforms that already had one would have two. macOS keeps the
system About in its application menu, which belongs to the system.

The menu emits `menu://about` — the first Rust-to-frontend event in this
application, where every other exchange is the frontend asking and a command
answering. A command cannot carry this one: the menu is on the shell's side and
nothing in the WebView knows it was clicked. `core:default` already includes
`core:event:default`, so nothing was granted and `capabilities/default.json` did
not change. [ADR-079](docs/decisions.md#adr-079--the-about-dialog-is-ours-and-help-is-where-it-opens),
which reverses 1.3.9 and is why this is a minor rather than a patch.

## 1.3.9 - About in the Help menu, where macOS left it empty

Tauri's default menu puts About in the application menu on macOS and leaves Help
with nothing in it; on Linux and Windows it puts About *in Help*, because there
is no application menu to hold it. macOS is the one platform where opening Help
opens nothing, which is where the request came from.

The item is the platform's own About panel rather than a window of ours. It
already carries the name, the version stamped from `version.md` and the
copyright, and a dialog we drew would be one more thing to translate, style and
keep in step with a number it does not own.

It appends to the default menu rather than rebuilding one. The default carries
Edit with cut, copy, paste and select-all, and a WebView whose menu loses those
loses the shortcuts with them.

Compile-checked here; a menu is confirmed by opening it, on the installed build.

## 1.3.9 - the update screen says which version is running

*"Na tela de update é obrigatório mostrar a versão."* It was not there. The
banner announced the version being offered and the Settings panel offered to
check for one, and neither said what the application was. *Tura Notes update
1.3.6* above something already running 1.3.6 reads as a loop rather than as an
offer.

`env_report` gains it, read from the package rather than `CARGO_PKG_VERSION` —
the constant in `Cargo.toml` is the `0.0.0` placeholder, and a diagnostic that
confidently reports `0.0.0` is worse than one that reports nothing. The banner,
the Settings check and the Diagnostics list all show it; a failed read leaves the
line out rather than the panel.

`EnvReport` is the one IPC shape the frontend hand-writes, so the drift it
invites is now a test. Add a field in Rust and forget the TypeScript and it is
invisible; rename one and the frontend reads `undefined`, which React renders as
nothing — and a blank where the version should be is indistinguishable from a
screen that never had one, which is the complaint this answers. The Rust struct
and the TypeScript interface are compared by name through serde's camelCase, and
the version field is asserted by name as well, because both sides agreeing it is
absent would pass the comparison.

## 1.3.8 - the cloud deployment leaves the queue, verified from outside

The queue said, checked on the morning of 16/09/2026, that `tura.samirhv.com.br`
resolved and still answered 404 from the default virtual host, that nothing
listened on 8787 and that `notes-server` was not installed. All three have
stopped being true, and a queue that describes a state the world left behind is
worse than an empty one.

Verified from this machine rather than assumed: `/healthz` returns
`{"status":"ok"}`, and `/v1/workspaces` without a credential returns `401
{"error":"unauthorized"}` as `application/json`. The second one is the proof.
`/healthz` sits **behind** the trusted-proxy gate, so answering at all means the
front end is setting `X-Forwarded-Proto`; and `{"error":"unauthorized"}` in JSON
is this server's own error shape, where a default virtual host would have
returned HTML.

What that closes is the deployment, and only the deployment. Owner acceptance
stays in the queue, because acceptance is somebody using the thing and `curl` is
not somebody.

## 1.3.8 - a connection test that names the step that failed

*"Não está claro se está funcionando, e se não está funcionando, por quê."* The
panel could say what was still empty on this machine and nothing at all about
the server. The only way to find out whether the address, the credential and the
workspace were right was to close everything, press **Create pairing and
review**, and read one of three sentences.

Three, for about thirty causes. `Error::Invalid` stands for a bad URL, a path or
query on the origin, a workspace name with the wrong characters, a scope
starting with a dot, plain HTTP, a name resolving to a private address, too many
addresses, and four ways a trust anchor can be wrong. `Error::Denied` stands for
a credential file that is missing, relative, too large, group-readable or
unreadable, contents that are not a credential, a credential the server
rejected, a workspace name that does not match, a scope that does not match, and
a review credential. That is the right shape for a transport — it retries, and
it must not narrate what it found in a secret file — and the wrong shape for a
person asking whether the thing works.

**Test connection** is a seventh `sync_control_*` command and the only remote
call that runs with a workspace open, because it writes nothing. It takes the
address, the credential file and the private-address permission — deliberately
**not** a workspace name. The name is the one field the owner cannot know: the
credential decides it and the server is the only thing that can say it. So the
test reports it, fills the empty field, and reports a disagreement rather than
overwriting a field somebody typed.

Seven outcomes, one per thing to go and fix: `address`, `credential_file`,
`credential_shape`, `unreachable`, `refused`, `unexpected`, `granted`. The one
worth naming is `unexpected` — the name resolves, a web server answers, and what
answers is not this API. On a host that already serves eight other sites that is
the default virtual host, and until now it was indistinguishable from a bad
credential.

**Every check is the function `connect` calls.** `Endpoint::validate`'s address
half, the credential file checks, the address policy and `decode` were split out
and are now called from both, because a test that approves what the transport
refuses is worse than no test: it moves the search for the cause to somewhere
the cause is not. The refactor is behaviour-preserving — the crate's 77 tests
passed before the probe existed.

The frontend maps the outcomes through a `Record<SyncProbeOutcome, string>` over
the generated union, so a variant added in Rust fails the TypeScript build
instead of rendering its own key at the user, which is how `tree.newNote.prompt`
shipped. The keys inside it are literals, so `tools/i18n-keys.py` checks that
both languages have them.

## 1.3.7 - a received workspace stops outliving the workspace it belongs to

Found while fixing the update banner, on the same path and one step further
along. The Tauri shell holds the received-queue client's store in
`App.received`. `sync_open` sets it; **nothing ever set it back to `None`.** So
`Some` meant "a received workspace was opened at some point in this session",
while both readers were asking "is one open now".

`update_install` was one of those readers, and it refuses to restart while a
workspace is open. A session that opened a received workspace once could
therefore never install an update again — not by closing the received workspace,
not by closing every workspace, not by anything short of restarting the
application by hand. The dialog fixed above would have run its close flow
correctly and then been refused natively, with a message about a workspace that
was not open.

`sync_apply` was the other reader, and there the stale store was worse than a
refusal: it would have applied one workspace's received state into whichever
workspace happened to be open. The frontend never let it, because `ReceivedSync`
compares workspace ids before it offers the control — but that made the guard a
property of the caller rather than of the command.

The store now carries the `WorkspaceId` it was opened for, and both readers
compare it against what is open now. `update_install` needs no check of its own
any more: `sync_open` opens the workspace through the same service, so a live
received store implies an open workspace, which the existing refusal already
covers. The check that was deleted is the one that could not answer the question
it was asked.

## 1.3.7 - the update closes the workspace instead of asking the user to

The update banner could not be obeyed. It said *Close your workspace through the
normal save flow, then try again*, and its only button — **Install and restart** —
did nothing but say it again, because the one command that closes a workspace
lives in a menu in the sidebar footer that nobody reading an update dialog would
think to open. Every press produced the same sentence, which is exactly how it
was reported: the update never installs.

[ADR-074](docs/decisions.md#adr-074--signed-desktop-updates-with-explicit-installation)
puts the installation *after* the normal workspace-close flow. It never said the
user performs that flow, and now the button does: `install()` calls the same
`leave()` the workspace menu calls, so unsaved work still stops the close and is
still named in the question it asks, and declining still installs nothing. A
guard that states a rule and offers no way to obey it is not read as a guard.

The close is invisible across the restart — `restore_last_workspace` opens the
same workspace on the way back — and when the installation fails instead of
restarting, the workspace is reopened where it was. `update_install` never
returns on success, so reaching that line at all means the failure path, and
leaving somebody at the Welcome screen holding a failed update would be a second
failure caused by the first.

`update.closeWorkspace` now reports what happened rather than prescribing what to
do, because it is only reachable when the user declined the close.

Two of the three new tests fail against the old store, which is why they were
written that way round. The third — *installs nothing when the close is
declined* — passes against both, because that is the guarantee the change had to
keep rather than the behaviour it changed.

## 1.3.6 - say why the credential store is re-read on every request

A review raised `admin::load()` reparsing `tokens.json` per HTTP request as a
thing to improve. Measured rather than assumed: at the documented ceiling of
1024 credentials the file is 285 KB, and reading and parsing it costs well under
a millisecond — on a request that has already taken a permit from a semaphore of
eight, taken a file lock, and is about to do filesystem work. A real store is a
handful of devices and a few kilobytes.

**Declined, and the reasoning is now at the call site**, because the next person
to look will reach for the same cache. `token revoke` runs in a separate process
and `SERVER-0.5.md` promises it takes effect with no server restart. A cache
keeps that promise only while its invalidation is right, and the failure mode of
getting it wrong is a revoked credential that still works. Trading a correct
security control for microseconds is how that bug gets written.

Nothing else changed. An item closed by deciding against it is still closed, and
a decision nobody wrote down gets re-raised.

## 1.3.5 - the ts-rs warnings stop being the only thing standing between a wrong type and the frontend

Every `cargo clippy` prints ten `warning: failed to parse serde attribute` lines.
`ts-rs` cannot read `#[serde(transparent)]`, `try_from` or `into`, so it says so
and then generates TypeScript for the **Rust** shape rather than the wire shape.

They are harmless today: all three types that carry one of those attributes —
`SearchId`, `RelPath` and the `uuid_newtype!` ids — also carry an explicit
`#[ts(type = "…")]`, so the declarations are right. **The problem is the next
one.** A `#[serde(transparent)]` newtype added without the override is described
to the frontend as `{0: T}` while the wire carries a bare `T`, and nothing
fails: the types compile, the IPC works at runtime, and the declaration is
quietly wrong. The warning that would announce it arrives in the middle of ten
identical ones everybody has learned to scroll past — which is what a warning
nobody can act on costs, the attention of the one that matters.

`tools/ts-serde.py` asserts the pairing instead, so failing the gate becomes the
signal and the warnings can stay noise. It was run against the failure it exists
for — `SearchId` with its `#[ts(type)]` removed — and names the type, the file
and the line.

Found by a review in another session, which had already checked that all three
overrides are in place today.

## 1.3.4 - the five status words are five, and something checks

Golden rule 3 lists five: `ACTIVE`, `HISTORICAL`, `PROPOSED`, `DEPRECATED`,
`NOT ADOPTED`. `architecture-v1.md` declared a sixth — `SUPERSEDED` — and
`roadmap.md` declared its status in prose with no word in it at all. The three
drafts under `docs/history/` declared nothing; the folder's index says they are
superseded, which is true of the folder and not of a file opened directly.

None of that is ambiguous to a human reading carefully, and that is not what the
rule is for. It exists for one sentence: **a document with no declaration is
read as ACTIVE**. A planning draft nobody has built, read as the thing that was
built, is worse than a missing document, because it has the authority of being
written down.

`SUPERSEDED` becomes `HISTORICAL`, which means the same thing and is one of the
five — a sixth word for one file costs more than the word it saves. `roadmap.md`
gains `ACTIVE` in front of its prose, and each `history/` draft says what it is
on its own first lines.

`tools/doc-status.sh` joins the gate and checks the **vocabulary**, not only the
presence: a sixth word is the same failure one step along, a word the reader
interprets instead of looking up. First eight lines only — a status further down
is a status nobody reads before they have started believing the document. It was
run against both failures, a missing declaration and an unlisted word, and
catches each.

## 1.3.3 - ask whether the pinned versions are vulnerable, not whether they are old

`security.md` §10 names dependency maintenance as a control and nothing checked
it. Dependabot exists and covers five ecosystems, but it answers a different
question: it opens a pull request when a newer version exists, which is not the
same as saying the version pinned right now carries a known advisory.

`cargo audit --deny warnings` against the lockfile — the lockfile is what ships,
so the lockfile is what is audited — and `npm audit --audit-level=high` for the
frontend, in both `tools/check.sh` and CI. The frontend is clean today, which is
the cheap moment to add the step rather than the expensive one.

**`--audit-level=high` and not `low`**, deliberately: a moderate advisory in a
build-time dependency of a desktop application that opens no port is a queue
item, and a gate that goes red for one of those is a gate people learn to
override. A gate nobody overrides is worth more than a gate that catches more.

**CI runs it weekly as well as on push.** An advisory is published against code
that has not changed, so a check that runs only on our commits learns about it
whenever we happen to commit next. The rest of the workflow coming along on that
schedule is not waste — a suite that has not run in a fortnight is a suite whose
state nobody knows.

Locally a missing `cargo-audit` warns and names the one install command, the way
the Windows cross-check already does: refusing to run the rest of the gate over
an absent checker helps nobody.

CI also stops duplicating the i18n parity check in shell and runs
`tools/i18n-keys.py`, which resolves keys rather than comparing catalogues — the
weaker check is what let `tree.newNote.prompt` ship missing from both.

## 1.3.2 - a damaged journal declines the prune instead of crashing

`linear_payload_is_prunable` walked back from a note's head by indexing
`journal.revisions[&next]`, with no check and no cap. Two shapes broke it: a
parent naming a revision the vault does not hold panicked the command outright,
and two revisions naming each other looped for ever, growing the backward list
until the process died.

Neither is reachable over HTTP — `sync-prune` is an offline operator command and
ADR-063 keeps it that way, so this is robustness rather than surface. It is
worth fixing anyway for where it lands: **a damaged vault is exactly the state
someone runs a maintenance command in**, and a maintenance command that aborts
the process is worse than one that declines to prune. Declining is also the safe
direction, since it keeps the payload.

The lookup returns rather than indexes, and the walk is bounded by the number of
revisions — a linear chain cannot visit more than the journal holds, so anything
longer is a cycle. Both shapes are built and asserted.

Found by a review in another session.

## 1.3.1 - the rate budget follows the client instead of the proxy

The server charges 120 requests a minute to an address, before authentication,
to bound a flood that never presents a credential. Behind a proxy the address is
the proxy, so it became the budget of every device put together. Past three
active devices that is **tighter than the 60/min each credential already has**,
and one busy device locks the others out — the control hitting the wrong people
rather than failing open. It is live now, on the co-tenant deployment.

The budget is charged to the last `X-Forwarded-For` entry, and only the last.
Each hop appends the address it saw, so everything further left came from the
client and can say anything, including the address of a device it would like to
lock out. Reading the header is safe here for one reason: the peer has already
been checked to *be* the trusted proxy, so the header is something our proxy
appended rather than something a client sent.

`NOTES_SERVER_TRUSTED_HOPS` (default 1, maximum 8) covers a CDN in front of the
site's own front, which is this deployment. **It defaults low on purpose.**
Wrong low costs a shared bucket — what shipped before. Wrong high counts back
into an entry the client supplied and makes the budget forgeable. The two
mistakes are not the same size, so the default is the safe one and the unit file
carries the other commented out with the reason.

**nginx does not send `X-Forwarded-For` unless told to**, which would have made
this change do nothing there; the template now carries the line. Apache's
`mod_proxy` and Caddy append it themselves, and the Apache template says so
rather than leaving the reader to wonder what is missing.

Four cases: one device spending its budget leaves the second device's alone; a
client naming a victim in the header spends its own budget and not the victim's;
a second hop is counted when configured; and a header nothing can be made of
falls back to the shared bucket rather than to a refusal.

## 1.3.0 - the watcher stops holding the service mutex for 270 ms

The gate has had one failing test for a while — `starting_the_watcher_returns_immediately_and_walks_behind`
— and its assertion message was pointing at the wrong thing. It said "it is
walking the tree inline", and on macOS there is no walk: one handle covers the
subtree. Measured, the cost is **280 ms for a workspace with 0 directories and
281 ms for one with 3 600**. Constant, inside `FSEventStreamCreate` and the run
loop `notify` waits to have scheduled.

Constant is not free. `commands.rs` held `app.svc` across the call and the
frontend awaited it on workspace open, so every IPC command queued behind those
270 ms. That is precisely the hazard D-09 removed from Linux in 0.1c, left
intact on macOS because the reasoning stopped at "there is no walk here" — true
of handles, never true of time.

Creating the backend and installing the root watch now happen on the watcher's
own thread on every platform. `start_watch` returns at once.

**The design cost is real and is the interesting half.** `degraded` was known at
construction and is not any more: it moves into the counters beside `walking`,
`WatchProgress` carries it, and `watch_status()` reports it — which the
interface was already polling for coverage. `start_watch` therefore usually
returns `None`, meaning "no answer yet" rather than "this platform can watch".

**And there is now a window that did not exist.** A change made between
`start_watch` returning and the handle existing is not seen by the watcher. The
5 s poll and the scan on focus cover it — the same two mechanisms that already
cover a watch lost silently — so it costs latency and not a missed change. It is
why the two watcher tests in `reconcile.rs` now wait for `walking` to clear
before they write: a test that did not wait would be asserting the poll while
claiming to assert the watcher. Recorded as ADR-078, along with the two module
comments that were wrong about latency.

`Y`: `Watch::degraded` is a method now and `WatchProgress` gained a field.

The whole Rust suite passes, including the deep tests that gated this. The
"Release gate repairs" item leaves the queue.

## 1.2.0 - a rename stops being able to delete a file nobody asked it to

`LocalFs::rename` checked `b.exists()` and then called `fs::rename`, and
everything between the two was a window. `fs::rename` **replaces** the
destination on every platform — that is what POSIX `rename` and
`MOVEFILE_REPLACE_EXISTING` both mean — so anything that created `b` in that gap
had its bytes deleted, with no error raised anywhere.

That is not a theoretical race here. This product's premise is that other tools
write in that folder: a sync client that is now actually deployed, a `git
checkout`, a restore, Dropbox. The window is ordinary rather than adversarial,
and what it costs is a file the user wrote — ADR-001 failing silently, which is
the worst way for it to fail.

The operating system can say this in one call, and all four targets have a
spelling for it: `renameat2(RENAME_NOREPLACE)` on Linux and Android,
`renamex_np(RENAME_EXCL)` on macOS and iOS, and `MoveFileExW` with no
`MOVEFILE_REPLACE_EXISTING` on Windows — which is precisely the flag
`std::fs::rename` opts into. `create_new` thirty lines above had already
answered the same question for creation with `persist_noclobber`; this is the
rename half of it.

**The fallback is a decision.** `RENAME_NOREPLACE` is not implemented by every
filesystem — some network mounts and older overlay setups answer `EINVAL` — and
refusing there would break renaming on those volumes in order to protect against
a race. On that answer the code falls back to exactly what shipped before, so
those volumes are no worse off and every other one loses the window. Recorded as
ADR-077, along with the consequence that a Windows rename across volumes now
fails rather than silently becoming a copy.

The tests assert the primitive and not the race, and that is the point worth
keeping: asserting through the public `rename` passes against the broken code
too, because the pre-check catches the simple case. What removes the window is
the syscall refusing, so that is what is tested — it refuses and leaves the
destination's bytes, and it still renames when the destination is free. A guard
that refused everything would satisfy the first half alone.

`Y`, not `Z`: the `FileSystemAdapter` surface behaves differently on a
destination that exists.

Also gone: `TMP_COUNTER`, incremented on every atomic write and never read since
the temporary file stopped having a random name.

Found by a review in another session. Two of its findings were already fixed
here — the stray credential fixture and the guard against a suite writing
outside its temporary directory, both in 1.1.25 — and its reading of the queue's
"Release gate repairs" was right: one of the two named failures passes now, and
the item says which one is left and what it costs.

## 1.1.31 - a folder you can see, and put something into

Three faults in the explorer, and the first one is the reason the other two were
never found.

**`tree.newNote.prompt` was rendering as body text.** `t()` returns the key when
it does not resolve, so the New note dialog asked for a name under the label
`tree.newNote.prompt`. It and `tree.newFolder.prompt` were used by
`ExplorerToolbar` and defined in neither language. The gate checked that the two
locales covered the SAME keys, which they did — both were missing it equally.
`tools/i18n-keys.py` now resolves every literal `t("…")` against both, and
replaces the parity check rather than joining it. Its regex carries a lookbehind
worth the line it costs: without one, `closest("a")` and `keepDraft("conflict")`
match, and a checker that cries wolf is a checker that gets skipped.

**A folder could be expanded and could not be put into.** `create_note` has
taken a directory since 0.1a, and the only interface reaching it was the
toolbar's two buttons, which always pass the workspace root. So the capability
existed, the folder was inert, and nothing said where a new note would land — it
reads as a folder that does not work rather than one the interface forgot.
A directory's context menu now offers **New note in {folder}** and **New folder
in {folder}**, creating in that folder; the toolbar's dialogs say they create at
the root and where to go instead.

**And a folder did not look like one.** The row drew `▸` for a directory, `•`
for a note and `·` for any other file — three characters a few pixels apart,
which asks the reader to learn a legend before they can tell a folder from a
file. Folders are drawn as folders, open when open, notes as documents, and a
file the core does not consider a note is drawn faint: present, and not offered.

`Tree.test.tsx` is new — the component had no suite. Three cases: the folder
menu creates in the folder and not in the root, a note's menu does not offer it,
and the two kinds draw different icons. 96 frontend tests pass.

## 1.1.30 - the context menu stops looking like a document

A screenshot of the explorer's right-click menu had every item highlighted at
once — Rename, Move to, Duplicate and Delete all wearing a selection colour. Not
a hover state: the highlight hugged the words rather than filling the rows,
because it was **text selection**. `styles.css` set `user-select` on exactly two
elements, both of them line numbers in the diff view, so a stray selection
anywhere painted the labels of the chrome. No native menu, tab strip or tree row
on this platform selects, and that is most of what made the menu look wrong —
not any of its colours.

`.menu`, `.menu-item`, `.rail`, `.tabbar`, `.statusbar` and `.row-wrap` no
longer select. The editor, the preview and every input are untouched: those are
the document.

**And `.menu` had two rule blocks**, which is not a style question. The later
wins on what it sets and the earlier survives on what it does not, so the menu
rendered as a mix nobody designed: geometry from the live block, `display:flex`
and a 2px gap between items from a block written for markup that no longer
exists, and — by specificity — that dead block's `padding: 5px 8px` and
`border-radius: 4px` beating the live `6px 8px` and `5px`.

It was not dead enough to simply delete. `.menu button.danger` at (0,2,1) was
the only rule giving Delete its colour, and nothing in the live block replaced
it; removing the old block without noticing would have quietly turned the
destructive item into ordinary text. It moves to `.menu-item.danger`.

Two guards in `tools/check.sh`, because both failures are invisible in a passing
build: `.menu` must have exactly one rule block, and the chrome must still carry
its `user-select`. 93 frontend tests pass and the contrast gate is unchanged at
42 pairs.

## 1.1.29 - the downloadable file loses the space the application keeps

The bundler names artefacts after `productName`, and that name has a space in
it, so the first published release put this in the updater feed:

    .../1.1.27-darwin-aarch64-app-8758989e-Tura%20Notes.app.tar.gz

A space in a released filename is `%20` in every URL that points at it and a
word boundary in every script that has not been written carefully. ADR-071
exists because one of those scripts was not: the Arch job split a path on
whitespace and ended up asserting against a file belonging to another package.

`tools/name-bundles.sh` takes the spaces out, on both pipelines, immediately
after the bundler and before anything hashes, signs, records or publishes the
name — `TuraNotes_1.1.29_aarch64.dmg`, and the same for .deb, .AppImage and
.rpm.

**What it does not rename is the point.** `Tura Notes.app`, the Debian package
name, `br.com.samirhv.notes` and `Tura Notes.desktop` are installed identities,
frozen by ADR-069: rename one and the next release installs *beside* the
previous one instead of over it. The helper touches regular files only, so the
application bundle — a directory — is out of reach by construction rather than
by remembering. The `.app` inside the updater tarball keeps its name for the
same reason; only the tarball around it changes.

`productName` was the other way to do this and is the wrong one: it is what
gives all four of those their names.

Four cases. The Linux suite asserts the built package carries no space and that
its checksum sidecar names the renamed file — the sidecar is written after the
rename, so it agrees with what gets published. The macOS suite asserts the
rename precedes the sidecar, the updater payload and the publication, and that
the application bundle's name survives it.

Feeds already published are unaffected: each entry carries its own payload URL,
and the next publication writes a new one.

## 1.1.28 - the deploy warns about the vhost instead of overwriting half of it

1.1.27 reinstalled `apache-tura.conf` whenever it differed from the repository's
copy. That is wrong on any host where the certificate came from
`certbot --apache`, which is to say the host it was written for.

Certbot **clones** the HTTP vhost into `<name>-le-ssl.conf` at issuance, and it
is the clone that serves 443. Reinstalling the original therefore updates the
half almost nobody reaches and leaves TLS running the old directives — silently,
with a deploy that reports success. Half a configuration updated is worse than
none, because nobody suspects it. Certbot also edits the HTTP vhost when it
configures a redirect, so the overwrite would delete that edit on the next
deploy, and the site would quietly stop redirecting.

The script now compares and says so, naming why the update is manual, and does
not touch Apache at all — no install, no configtest, no reload. The suite
asserts the absence rather than the ordering it asserted before: no
`systemctl reload apache2`, no `restart`, no `a2ensite`, and the comparison
still there so the warning cannot be dropped along with the write.

The unit file and the credential wrapper are still installed automatically.
Nothing else owns those two.

## 1.1.27 - a deploy script for the server, and a checkout the orchestrator leaves alone

The deployment host runs an orchestrator that executes every
`/srv/www/*/deploy.sh` it finds. The Tura checkout had been put there, and the
root of this repository has a `deploy.sh` — the desktop packaging entry point
(ADR-072). So the fleet deploy ran the Tura build pipeline on the production web
server. It failed, loudly, on `Missing prerequisite: rustc`, which is the good
version of that outcome: on a machine with a Rust toolchain it would have
compiled.

Two names, one meaning each. `server/cotenant/deploy-server.sh` is the server
deploy, and the checkout moves one level down — `/srv/www/tura.samirhv.com.br/`
holds a `deploy.sh` symlink into `repo/server/cotenant/`, and the scanner, which
walks one level, sees the symlink and nothing else.

What the script does is narrower than it looks. It reinstalls the unit, the
vhost and the credential wrapper **only when their contents differ**, compared
with `cmp` rather than inferred from the commit — restarting a service that
holds notes because of a commit that did not touch it is cost with nothing on
the other side. It installs a binary only when the release line moves, deriving
that release from `version.md` as `X.Y.0`, because assets are published on minor
bumps; deriving instead of asking spends none of the sixty GitHub API calls an
hour that this host shares with the site's release monitor.

**It never writes into the data directory**, and the suite asserts it: the notes
are there, and a deploy that touches them is a deploy that eventually loses
someone's notes. Backup stays separate and explicit.

Three more properties are pinned rather than trusted, each because its failure
is silent or expensive: the release derivation against five versions, the
checksum verified before anything reaches `/usr/local/bin` (a truncated tarball
installs a binary that exists and does not execute), and the Apache reload gated
on a configtest — that Apache serves eight other sites, and a bad vhost takes
all of them down.

It copies itself to `/run` and re-executes before pulling, the same guard the
site's deploy carries and for the same reason: the script is inside the
repository it updates, and bash reads a script as it runs.

## 1.1.26 - the pairing panel says what is missing instead of going grey

The first person to pair against a real server filled in the credential file and
the server address, and nothing happened. Not an error — nothing. The button
stayed grey, and there was no way to find out which of its six preconditions was
unmet.

Six, and it stated none of them: five fields and a closed workspace. The notice
about the workspace existed, but at the bottom of the panel and worded for a
different moment ("close the workspace to review identities or apply received
files"), so it read as a note about later rather than the reason for now. The
panel now lists what is still needed, by the label of the field that supplies
it, and the list disappears as the fields fill. "Disabled" is an answer to a
question the person has not been allowed to ask yet.

**A pairing that worked also said nothing**, which is the same failure from the
other side: `task` clears the message and writes one only on failure, so success
was indistinguishable from a button that did nothing. The phase in the summary
does move, but on the next poll, up to fifteen seconds later. It says so now,
immediately.

The `Reconnect existing queue` button also gains the busy guard its neighbour
had — it could be pressed during an in-flight pairing.

Three cases: the missing list names the empty fields and clears as they fill, an
open workspace appears in that list by name, and a successful pairing is
reported. 93 frontend tests pass; the contrast gate covers the hint's colours
already, which is why it uses existing tokens.

## 1.1.25 - stop the credential suite writing into the checkout

1.1.23 committed a file called `read,create,update,move,delete`, sixteen bytes,
at the root of the repository. It surfaced in a fresh clone on the deployment
host, in an `ls` next to the real files, which is the only place a name like
that is going to be noticed.

It is the fixture string `the-secret-bytes` and not a credential — no secret
was published — but the way it got there is worth the entry. The first draft of
the wrapper suite had its fake CLI write to `$6` instead of `$7`, and `$6` in
`token create LABEL WORKSPACE . PERMISSIONS OUTPUT` is the permissions list. The
fake ran with the repository as its working directory, so it created a file
named after that argument, and `git add -A` swept it in. The test was corrected
the same hour; the file it had already left behind was not, because a passing
suite says nothing about what it wrote on the way.

Two changes, and the file is the smaller one. The suite now runs the wrapper
with its temporary directory as the working directory, so a relative write
cannot reach the checkout at all. And it snapshots the repository root before
and after and asserts they match — the guard for the class rather than for the
instance, because the next stray write will not be this one and will be just as
invisible in a green run.

## 1.1.24 - remove the watcher probe a blanket add swept into the tree

`crates/notes-fs/tests/probe_watch.rs` was a throwaway measurement written
during a review to find out where `start_watch` spends its time on macOS. It
was never meant to be committed; a blanket `git add` in the next commit picked
it up and 1.1.23 published it.

It is deleted rather than kept, because what it measured belongs in the record
and not in the suite: `notify`'s FSEvents backend costs a **flat ~270 ms**
inside `Watcher::watch`, on an empty directory and on 3 600 directories alike —
280 ms for zero directories, 281 ms for 3 600. The cost is `FSEventStreamCreate`
plus the run-loop thread that `run()` blocks on until it is scheduled, and it is
constant in the size of the tree.

That number is the diagnosis for the `deep.rs` failure the queue carries, and it
contradicts the message the assertion prints: `start_watch` is not "walking the
tree inline" on macOS — there is no walk, and the same 270 ms is paid for a
workspace with nothing in it. The finding goes to the queue item; the file that
produced it does not belong in `cargo test`.

The stray 16-byte file at the repository root from the same commit is left
untouched deliberately — reading it was refused as credential material, and a
file nobody has read is not a file to delete on a guess.

## 1.1.23 - a credential wrapper a web administration screen can actually call

The site on the publication host is getting a screen that creates and revokes
sync credentials, so enrolling a device becomes downloading a file rather than
opening an ssh session. That screen runs as `www-data`, and the obvious way to
let it reach the CLI does not work.

`/var/lib/notes-server` is 0700 and owned by `notes`, so the web user cannot run
`notes-server` at all. Granting it `(notes) NOPASSWD: notes-server token create
*` gets past that and into the second half of the problem: `token create` writes
the secret to a **new** file at mode 0600 owned by whoever ran it, which the web
user then cannot read. The sudoers line buys a file nobody can open.

`server/cotenant/tura-credential` is the answer: it returns the secret over the
pipe, removes the file whatever happens next, sets the `NOTES_SERVER_DATA` that
sudo strips, and validates its own arguments. That last part is the reason it
is a script rather than a wildcard — the caller is a web application, so "the
caller validated it" is not a property this side may assume. The grant becomes
one reviewed script with no path argument, and the web user cannot choose where
a secret is written.

The permission list is spelled out rather than matched: a pattern accepting
"anything comma-separated and lowercase" also accepts a permission invented
later, and that failure is a credential quietly holding more than the screen
offered. Scope is always the whole workspace, because a flag no interface sets
is a flag that gets set wrong.

Eleven refusals are asserted against a fake CLI — a label carrying a shell
metacharacter, an uppercase workspace, two unknown permissions, wrong arity in
both directions, a malformed id, an unknown subcommand and no subcommand — plus
that a refused call never reaches the CLI, and that the secret file does not
outlive the call. `mktemp` takes a full template, because BSD appends its own
suffix to a `-t` prefix and GNU deprecates the flag: one line, two meanings, and
this script runs on Linux while its tests run here.

## 1.1.22 - the Apache template stops hand-writing a TLS vhost

The publication host turns out to be the deployment host too: Debian 13, x86_64,
**Apache** with more than eight sites and `certbot --apache`, which is visible in
the `-le-ssl.conf` files beside every `.conf` in `sites-enabled`. That convention
matters, because `apache-tura.conf` shipped a hand-written `<VirtualHost *:443>`
naming a certificate under `/etc/letsencrypt/live/`.

**On that host, enabling it would have taken the other sites down.** Apache
refuses to start when a vhost names an `SSLCertificateFile` that is not on disk,
and the certificate does not exist until certbot has run — which it cannot do
until the HTTP vhost is enabled. The template was a deadlock whose failure mode
is not "the new site does not work" but "samirhv.com.br, shvia.org and six
others stop answering", which is the one kind of mistake a co-tenant deployment
must not make.

The template is HTTP-only now, with the three load-bearing directives and an
exclusion so `/.well-known/acme-challenge/` is served from disk instead of being
proxied into the notes server. `certbot --apache` clones it into the TLS vhost
once the certificate exists. The header says what to do instead if you issue
certificates another way, and repeats the Cloudflare caveat: HTTP-01 through a
proxied record is answered by the CDN, so the record goes DNS-only for the
issuance.

`server/tests/cotenant.py` asserts the absence — no `<VirtualHost` line naming
`:443`, and the ACME path excluded from the proxy. It matches directives rather
than text, because the comment explaining why there is no TLS vhost necessarily
contains the thing it is warning about, and the first version of the assertion
failed on its own documentation.

The queue carries the ordered sequence for this host, with the trap named.

## 1.1.21 - let the remote sudo ask for its password

The first real publication got through the build, the notarisation, the
staple, the preflight and a verified 6 MB upload, and then stopped on
`sudo: a terminal is required to read the password`. `ssh host "cmd"` allocates
no terminal, and `sudo` will not prompt into one that does not exist. The ingest
runs `sudo -u www-data php artisan files:add` because artisan writes into
`storage/`, so it has always needed this and has never had it — the step had
simply never run.

`ssh -t` on the two calls that use sudo: the ingest in both pipelines, and the
feed install in `tools/updater-release.py`. The calls that do not use sudo keep
their default, because a pty there only mangles the output they are parsed for.

**The pipe had to go with it, and that is the half worth writing down.** The
ingest's output was indented with `| sed 's/^/      /'`. A password prompt
carries no newline, and sed reads a line at a time, so it would hold
`Password:` until something ended the line — the build sits there looking hung,
with nothing on screen to type into, which is a worse failure than the one being
fixed because it looks like a different problem. Six spaces of indentation are
not worth a prompt nobody can see.

Failing the ingest now prints the one-line sudoers rule that makes it stop
asking, which is what an unattended release wants, and says where the uploaded
file is still staged. `docs/runbook.md` carries the rule for both commands and
the warning against a blanket `NOPASSWD: ALL`.

Two regression cases. The updater suite asserts that every sudo call carries
`-t` and that no other call does; the build-script suite asserts the same of
both pipelines' ingest lines — including that the ingest is one `ssh` call, so
re-piping it fails the gate.

## 1.1.20 - write the self-hosting guide for the person who will run the server

Pointing the app at your own server has been possible since the 0.6 pairing
panel shipped, and there has been nowhere to send someone who wanted to. What
existed was `SERVER-0.5.md`, which is a contract: routes, limits, peer checks,
backup restrictions. Correct, and not a route through itself — it never says
which of three deployments to pick, never names a field on the screen, and opens
by explaining what the process is rather than what it is for.

`docs/SELF-HOSTING.md` is the route: what you get and what you do not, what you
need, five steps, and the failures that actually happen. One recommended path
end to end — Compose on a host with both ports free — with the co-tenant and
tailnet deployments as short sections that say what each is *for* and link to
the contract. The pairing panel is described by the labels on the screen,
including the one that has to be right: the mode, which is upload, download or
reconcile, and means three different things about what the two sides already
hold.

Three things it says that the contract states without emphasising, and that a
person deciding to self-host has to read before they decide: **there is no
end-to-end encryption and the server reads its own notes**; **one credential per
device**, because two devices sharing one cannot be told apart and revoking the
lost one cuts off the kept one; and **sync is not a backup** — it copies your
mistakes to the other machine promptly and correctly.

It stays English, like the rest of the repository. The Portuguese reader is
served by product copy on the site, which is where product copy lives; the guide
here is the contract's route and the thing the site's copy is written from.

`tools/tests/test_selfhosting_doc.py` keeps it honest. Every on-screen label the
guide tells a reader to look for is checked from both ends — it must still be a
string the app ships, and it must still appear in the guide — so renaming a
field fails the gate instead of stranding a reader in front of a panel that does
not say what they were told. The transfer interval bounds are read off the
control, and the `token create` argument order off the server's own usage line,
because a swapped workspace and scope produces a credential that authenticates
and reaches nothing. Five cases.

## 1.1.19 - unstamp the tree before asking whether it changed during the build

A signed, notarised, stapled 1.1.17 DMG was refused with "sources changed during
the build; retry before publishing", and nothing had changed. The guard compares
`build-cache.py fingerprint` against the `SOURCE_HASH` taken before the build —
but `tools/stamp-version.sh` writes the version into
`apps/notes-app/src-tauri/tauri.conf.json`, that file is under one of the
fingerprint's INPUTS, and `SOURCE_HASH` is read *before* stamping while the
comparison was made *while still stamped*. Two different files, two different
hashes. **The guard therefore fired on every macOS build that actually
compiled**, after the notarisation round-trip, and the build it refused to
record was correct every time.

Two things hid it. The reuse path skips the entire block, so a second run of an
unchanged version never reaches the check. And no macOS build has ever been
published, so the failure had nowhere to become visible — the DMG was produced,
signed and stapled, and only the bookkeeping step said no.

`tools/build-linux.sh` restores the placeholder on the line before its own
check, and has since 1.0.3. `build-local.sh` now does the same, immediately
after `tauri build` rather than only in the exit trap, which also returns the
tree to its committed state sooner. Same asymmetry as the publication ordering
in 1.1.14, same fix: do what the other platform already does.

`tools/tests/test_publish_preflight.py` becomes `test_build_local.py`, because
it now covers two unrelated things that share a cause — both bugs lived where
they did because a full macOS build is expensive to fake. One new test stamps
the real tree, asserts the fingerprint moves, and restores it; a second asserts
the restore precedes the comparison in the script, which is an ordering and
cannot be checked by running the parts. Eight cases pass.

## 1.1.18 - confirm the publication path and say where the download link comes from

`ssh b3sys@100.64.100.125 test -f /srv/www/samirhv.com.br/samirhv/artisan`
succeeds. **The path was never wrong** — the site's own `deploy.sh` puts the
Laravel application at exactly that address, and `docs/AI-MEMORY.md` on that
repository has been calling `artisan` there by its full path all along. The host
was wrong, for six releases, and a wrong host reports itself as a missing path.
That is why 1.1.14's preflight prints the host it asked as well as the path it
asked for; it is also why this note had survived since 1.1.0 asking someone to
confirm a directory that was already correct.

So nothing stands between here and a published release except the act: a signed,
notarised build, `--publish`, and the feed read back from samirhv.com.br.

**The download link on the site is data, not code.** `samirhv.com.br/p/tura-notes`
already renders tabs per operating system, groups by version with the newest
expanded, detects the visitor's platform to recommend a build, and counts each
download through `/d/{file}`. It shows "Em preparação" because `ProjectFile` has
no rows for that project, and `php artisan files:add` — which is the second half
of `--publish` — is what creates them. The `.dmg` will land under macOS with the
right architecture without anyone configuring it: the site infers both from the
filename, and Tauri's `Tura Notes_<version>_<arch>.dmg` carries both.

Nothing in the site repository needs to change for the link to appear, which is
the useful half of this entry: the work is one publication, not a feature.

## 1.1.17 - publish to the machine that actually answers for samirhv.com.br

`--publish` has pointed at `b3sys@100.64.100.242` since 1.0.4 and that is a
different machine: a different ed25519 host key, and `shvia-site` rather than
the host serving samirhv.com.br. `docs/updater.md` recorded the symptom in 1.1.0
— "the private host responds, but `/srv/www/samirhv.com.br/samirhv` does not
exist there" — which reads like a wrong path and was a wrong host. The default
is now `b3sys@100.64.100.125`, the machine that answers for both shvia.org and
samirhv.com.br.

**That also answers whether the download page and auto-update still work.** The
updater endpoint is compiled into every build — `plugins.updater.endpoints` in
`tauri.conf.json`, `https://samirhv.com.br/updates/tura-notes/…` — so it is
fixed at build time and an installed application cannot be told to look
elsewhere. The upload host does not appear in it: publication works from any
machine to any path, as long as the bytes land somewhere that URL serves them.
`.125` is that machine, so nothing needs redirecting. And the combination is
enforced rather than trusted: `tools/updater-release.py` fetches the feed back
from `TURA_PUBLIC_BASE`, compares it byte for byte with what it generated and
re-downloads the payload to check its hash, so uploading to a host that serves
a different domain fails the publish instead of leaving a feed nobody reads.

Moving the feed to `tura.samirhv.com.br` would mean editing `endpoints` and
rebuilding, and only later builds would follow it — free today because nothing
has been published, and not free afterwards. It is also unnecessary.

`tura.samirhv.com.br` exists in DNS and **answers from the server's default
vhost, which is a Matomo instance**, because no vhost claims the name yet. The
templates now carry that name instead of a placeholder, and
`server/cotenant/apache-tura.conf` joins them, because the host may be running
Apache rather than nginx. The suite asserts its directives like the others'.

The name also resolves to Cloudflare rather than to the host, and
`docs/SERVER-0.5.md` now says what that costs. `X-Forwarded-Proto: https` is an
assertion the front makes, not something it observes: under Cloudflare's
Flexible mode the CDN-to-origin hop is plain HTTP and the server is told `https`
anyway, then sends HSTS on the strength of it. Full (strict), or a DNS-only
record. TLS terminating at the CDN also means the CDN sees the note bytes, which
is a second party where the design had one.

## 1.1.16 - record the reachability the cloud notes will be paired against

ADR-076 left one thing open and named the cost of leaving it open: the sync
client treats `100.64.0.0/10` as private, so a tailnet name needs
`--allow-private` at pairing and a public name needs nothing, and changing the
answer afterwards means re-pairing every device. The owner chose the public
name — `notes.samirhv.com.br` at the public address, ACME certificate, no flag.

Written into the ADR, into SERVER-0.5's reachability table, into the queue item
so the deployment does not re-open it, and into ACCEPTANCE-0.5 as the one owner
check this mode adds: 8787 on 127.0.0.1 only, the public name answering over
TLS, and the same request without `X-Forwarded-Proto: https` refused. That
header is what the whole arrangement rests on and it lives in a file the owner
edits, which is the definition of a thing to verify rather than assume.

A public name makes the credential the entire boundary — the server can read its
notes and there is no end-to-end encryption — so the acceptance text says what
follows from that: one credential per device, only the permissions that device
needs, and revoke rather than rotate when one is lost.

The publication host stays `b3sys@100.64.100.242` by the owner's call; what
1.1.14's preflight has to establish there is the application path, not the host.

## 1.1.15 - run the notes server on the host that already serves the site

Storing the `.md` files in the cloud has had an implementation since 0.18.0 and
no deployment, and the missing piece was not code. `server/compose.yml` assumes
the host is the server's: Caddy binds 80 and 443 and reaches `notes-server` on a
private Docker address nothing else can. The host this project actually has is
the one already serving samirhv.com.br — the same machine whose download service
`--publish` ingests into — and it has neither port to give. A second machine to
avoid sharing one is a machine to pay for, patch and back up.

`server/cotenant/` is the second deployment: the native binary on loopback under
systemd, with whatever already terminates TLS there proxying one name to it. A
unit, an nginx `server` block and a Caddy site block, all templates. The server
did not change — `NOTES_SERVER_BIND` and `NOTES_SERVER_TRUSTED_PROXY` already
described exactly this, which is also why nothing had ever exercised it.

The container was the obvious alternative and it does not work: Docker rewrites
the source address of a published port, so a container reached at
`127.0.0.1:8787` sees the bridge gateway as its peer. `NOTES_SERVER_TRUSTED_PROXY`
would have to name an address that changes with the network, and naming it
wrongly fails closed on every request. The native process has no such gap.

**Three properties of this mode are invisible until they fail in production, so
`server/tests/cotenant.py` runs a real process and asserts each.** `/healthz` is
checked *after* the proxy gate, so a plain `curl http://127.0.0.1:8787/healthz`
returns 403 on a server that is working — the probe an operator would reach for
to decide whether the server or the proxy is at fault is the one that lies.
`Origin` is refused outright, so a front that passes a browser's through turns
real requests into 403s. And nginx's 1 MiB body default refuses an attachment
bundle before the server sees it, with an error page that names nginx. The suite
also asserts that a created note lands as an ordinary file in
`workspaces/<name>/` — ADR-001 on the server side — and that the three templates
still carry the directives the assertions depend on, so dropping one fails the
gate instead of production. It joins `tools/check.sh`.

The reachability choice is recorded because it is not reversible without
re-pairing: `notes-sync-client` treats `100.64.0.0/10` as private, so a tailnet
name needs `--allow-private` while a public name needs nothing. A phone off the
tailnet is the case that decides it. Recorded as ADR-076; the queue now carries
the deployment itself, which is DNS, a certificate and a running process, and
none of those exist yet.

## 1.1.14 - ask the download service whether it exists before publishing to it

`--publish` had never run. `docs/updater.md` has carried the reason since 1.1.0
— "the private host responds, but `/srv/www/samirhv.com.br/samirhv` does not
exist there" — and that sentence was the only place it was written down, which
is why it stayed true: nothing in the pipeline asked. `TURA_PUBLISH_APP` is a
written-down guess, and the first thing that touched it was a `cd` inside the
ingest, after the build, after a 20 MB upload, reporting `cd: no such file or
directory`. That message is accurate and names neither the path it wanted nor
the way to find the right one.

Both pipelines now ask first: one `ssh … test -f <app>/artisan`, before the
build on Linux and before the upload on macOS. A missing artisan prints the
command that lists the candidate directories and the variable to set; an
unreachable host says that instead, because exit 255 is ssh's own failure and
not an answer about the path. A wrong destination now costs a second.

**macOS also ingested before it verified, and that order publishes the failure
it was written to catch.** The read-back exists because a truncated `scp` leaves
a file that exists, that `files:add` ingests happily and that the downloads page
links — it fails only in the user's browser. Verifying afterwards finds it once
it is already on the page, and the script then exits non-zero over a release
that is live and broken. `tools/build-linux.sh` verified before ingesting from
the day it was written in 1.0.3; macOS did not, and the two now agree. On a
mismatch the staged copy is removed and nothing is ingested.

Every remote argument on the macOS side is quoted with `shlex.quote` the way
Linux has quoted since 1.0.3, and the host, staging and application paths are
validated against the same patterns on both sides — `--dest` and the five
`TURA_*` variables all reach a remote POSIX shell. The header comment claiming
"one password — a single scp connection, then a single ssh call" described a
flow that already made four connections; it now describes the four steps.

Nine new cases, all passing: three in the Linux suite (a missing service refuses
before npm runs, an unreachable host is named as such, and a non-plain
application path is refused) and a new `tools/tests/test_publish_preflight.py`
with six that extract the two new functions from `build-local.sh` itself, so a
rename fails the suite instead of quietly testing nothing. It is wired into
`tools/check.sh`. The live publication is still unperformed: this release makes
the pipeline able to say which host and which path are wrong, not which are
right.

## 1.1.13 - cover the per-IP request budget, which no test reached

The server enforces two rate limits and only one of them was tested.
`rate_limit_bounds_authenticated_requests` sends sixty requests, asserts the
sixty-first is refused, and stops there — that is the 60/min a credential gets.
The 120/min an address gets had no test at all, and it is the harder of the two
to reason about: it is charged before authentication, so it counts requests that
never present a credential, and holding a second credential does not divide it.

That gap was not hypothetical. Removing the smoke suite's rate-limit waits in
1.1.9 failed on exactly this limit, and the reason it took instrumentation to
see is that no test described the behavior anywhere.

The new test spends the budget through `/healthz`, which answers after the
address check and before the credential one, so 120 requests land on the per-IP
bucket while the per-token bucket stays at zero. The 121st is refused with
`retry-after`. It then mints a credential that has spent nothing and shows it is
refused too, because the bucket that refuses it was emptied before any
credential was read.

Both halves were mutation-checked. Raising the ceiling to 200, and deleting the
pre-authentication check outright, each make the new test fail — and each leave
`rate_limit_bounds_authenticated_requests` passing, which is the measurement of
what was uncovered.

## 1.1.12 - cover the Arch package the installer globs were missing

1.1.10 ignored `*.deb`, `*.AppImage` and `*.rpm`, and justified scoping the group
by format with the claim that nothing in this repository writes an installer
outside `target/`. That claim was false, and it was false about the one installer
format the group did not list. `makepkg` builds the Arch package inside
`packaging/aur/notes-bin/`, which is not under `target/`;
`.github/workflows/build.yml` installs it with
`pacman -U packaging/aur/notes-bin/*.pkg.tar.zst`, and `docs/runbook.md` runs the
same build. `git check-ignore` confirmed the result was untracked and unignored.

The existing block above it was written for exactly this workflow — it already
covers `PKGBUILD` and the source tarball `gen-pkgbuild.sh` copies in for a local
build — and simply stopped short of what the build produces. `*.pkg.tar.zst`
joins the installer group, and `makepkg`'s `src/` and `pkg/` working directories
join the block that anticipated the local build.

The scoping decision itself stands, and this accident is the argument for it: a
rule scoped to `apps/notes-app/` would have guarded one directory and missed
`packaging/aur/`, and the reverse would have missed the `.deb`. ADR-011's
paragraph carried the same false sentence and is corrected rather than deleted,
so the record shows what the reasoning was and where it was wrong.

Checked before committing, because the previous pattern choice was not: feeding
every tracked path to `git check-ignore` matches nothing. No file leaves a fresh
clone, on any platform.

## 1.1.11 - make the Linux build survive a pull it cannot fast-forward

`build-local.sh` has said since it was written that the pull before a build
"never fails the build — offline, dirty tree or a diverged branch only produce a
warning", because a build that refuses to run when the network is down is worse
than one that tells you it used the local tree. On Linux that was not true.
`build-local.sh` execs `tools/build-linux.sh` before any of it applies, and what
that script ran was a bare `git pull --ff-only` under `set -e`: an offline
machine, a detached HEAD or a diverged branch aborted the build outright, and
the header a reader meets first described the other platform.

The Linux path now performs the same three-way sync: `--skip-git-pull` skips the
step, a directory that is not a git checkout is reported and skipped, and a pull
that cannot fast-forward warns on stderr and builds what is checked out.
`--ff-only` still never creates a merge, so nothing about what gets built is
loosened — only what happens when the sync itself cannot complete.

`test_failed_pull_stops_before_stamping` asserted the behavior that changed and
now asserts the new one, renamed to match. It fakes a `git` that fails only for
`pull`, because one failing at everything takes the not-a-checkout branch and
never reaches the pull it means to test — the first version of the test passed
for that wrong reason. A second case covers the not-a-checkout branch itself.
Both fail against the previous script with the build aborting on 17. Twelve
orchestration tests pass.

> **Corrected at 1.6.2.** The last sentence of the paragraph above is wrong. The
> earlier test passed for the right reason: the script it was written against
> made exactly one `git` call — the pull itself — so a `git` faked to fail at
> everything reached that call and the build aborted, which is what the test
> asserted. The not-a-checkout branch that makes a blanket fake useless arrived
> with this same change, so the selective fake was a consequence of the new
> script, not a repair of an old mistake. Nothing else in this entry is
> affected, and the text above is left exactly as it was written, because this
> file is not rewritten.

## 1.1.10 - untrack the installer that was committed into the app directory

`apps/notes-app/notes_0.11.11_amd64.deb` was 4.2 MB of build output tracked in
git. It arrived at 0.12.0, in a commit about attaching artifacts to a minor bump,
and stayed through a hundred versions after that practice moved to GitHub
Releases and the download service. It is untracked now and stays on disk; the
blob remains in history, which is what history is for.

The `.gitignore` header forbids a new line without an ADR, so ADR-011 records
the coverage rather than the line arriving unargued. This is not a new exception:
an installer passes ADR-011's existing test without strain — `./build-local.sh`
produces it, from sources here, and reproducing it is running that command.

The pattern is scoped by format, not by path, and checking first is what decided
that. Nothing in this repository writes an installer outside `target/`: Tauri
bundles land in `target/local-linux/<host>/release/bundle/<format>/`, already
covered. So `apps/notes-app/*.deb` would guard a directory nobody writes to and
would miss the same accident one directory over. `*.deb`, `*.AppImage` and
`*.rpm` are the three formats one `--bundles` run produces, and none of them is
ever source. No tracked file other than that one matched them.

## 1.1.9 - restart the smoke server for a fresh rate window instead of waiting

Two `time.sleep(61)` calls cost 122 seconds of every gate run. They were waiting
out the rate limiter's window, and the comment beside them was right that
weakening production limits was not the answer. Restarting the server is: the
limiter's buckets are a `HashMap` built in `Server::new` and held in memory for
the life of the process, so a restart empties them while every limit stays
exactly as production runs it.

A credential per phase cannot do this job, which is worth recording because it
is the obvious idea. The per-IP bucket is checked *before* authentication, and
every request in this suite — urllib's and every `notes-sync-client`
subprocess's — arrives from the same loopback address, so one 120/min bucket
covers all of them and no number of credentials divides it. Measured: ~270
authenticated requests overall, of which the first two phases alone are ~145
inside three seconds.

Both paths restart now. The native one follows the pattern already in the file;
the compose one had no restart at all, which mattered because CI runs
`--compose`. It uses `docker compose restart notes-server`, which reuses the
same container. Verified against the running stack rather than assumed: `/data`
is a named volume and survives, while `/tmp` is a tmpfs on a `read_only: true`
container and does **not** survive even a plain restart — a recreate is not
required to lose it. That costs nothing here, because every secret written to
`/tmp` is read back into the test process in the same breath it is created, and
none is re-read after a restart point.

**A third restart was needed, and finding out why was the substance of this
change.** The client-recovery block already carried a dedicated credential to
isolate its request budget; that isolates the token bucket and not the per-IP
one above it. Together with the section before it, it is ~128 requests against a
120/min ceiling. It had been fitting only by accident: the suite ran slowly
enough that the limiter's 60-second window rolled over mid-phase and handed it a
second budget. At full speed all 128 land in one window, and `recover-client` —
which does not retry — failed with `client or server is busy`. The restart makes
the isolation that comment intends actually reach the bucket that binds.

The four hand-copied health-poll loops became one `wait_healthy`, which also
catches the `ValueError` a 502 from Caddy produces when its non-JSON body
reaches `json.load` — the one case the copies did not handle, and the one a
compose restart creates.

Measured end to end, both passing: native 188.0 s to 5.3 s, compose 192.0 s to
9.8 s. The limiter's own behavior is unaffected and stays covered by
`rate_limit_bounds_authenticated_requests` in `server/notes-server/tests/http.rs`.

## 1.1.8 - correct the crate layout in the agent instructions

The `Layout:` line in `CLAUDE.md` and `AGENTS.md` listed `packages/ui/` as part
of the tree. That directory does not exist and never has: ADR-043 defers it
until real sharing requires it, and `docs/ARCHITECTURE.md` annotates it as "may
stay empty until 0.4 needs it". Only the two agent files presented it as a
current fact, which is the shape of stale documentation that does damage — an
instruction file carries the authority of being the first thing read.

Checking the rest of the line before editing turned up a second error in it. The
crate list named six of the eight crates under `crates/`, omitting
`notes-markdown` and `notes-model` — the Markdown parse/render/sanitize layer
and the foundation crate that every other one depends on for ids, paths, stat,
caps and errors. Both are now listed, in the same alphabetical order.

`docs/ARCHITECTURE.md` keeps its `packages/ui/` row on purpose: it is annotated
as deferred and is the record ADR-043 points at, so removing it there would
erase a decision rather than correct a fact. The twins remain byte-identical
below the H1.

## 1.1.7 - update trash to 5.2.8

The desktop trash integration moves from 5.2.7 to 5.2.8. Its Windows backend
now resolves through the current `windows` 0.62 family instead of the older
0.56 family; Linux and macOS behavior keep the same public interface. The
dependency branch passed the complete GitHub matrix before versioning, and the
versioned lockfile was regenerated from the current 1.1.6 master rather than
copying a stale pre-uuid resolution.

## 1.1.6 - update uuid to 1.26.1

The lockfile moves `uuid` from 1.26.0 to 1.26.1. The patch release fixes an
overflow panic when converting timestamps to `SystemTime` and corrects the v7
counter placement without changing this repository's declared dependency
surface. The complete GitHub matrix passed on the dependency branch after it
was refreshed onto 1.1.5; the versioned delivery was then checked again from
the current master before merge.

## 1.1.5 - enforce the root jail at the open, not only at the path

`LocalFs::resolve` checked every path segment with `symlink_metadata` and then
returned a path the caller handed to `fs::read` or `fs::File::create`, both of
which follow symlinks. The gap between the check and the syscall was the jail's
whole coverage, and this product's premise is that other tools write in that
folder — a sync client, a `git checkout`, a restore from backup.

The temporary file needed no race to exploit. `tmp_path` is deterministic by
design — `.{name}.tmp` beside the note, so a crash leaves at most one to clean
up — which also makes it predictable. A symlink left at that name received the
next save's bytes wherever it pointed, outside the workspace, through a path the
jail had already approved. The new regression test writes through such a link
and asserts the outside file is untouched; run against the previous code it
fails with the outside file overwritten.

Reads now open with `O_NOFOLLOW` on Unix and report `ELOOP` as the same
`SymlinkNotFollowed` the path check produces. The temporary file is unlinked —
which removes a link, never its target — and then created with `O_CREAT|O_EXCL`,
which refuses a symlink outright; losing the race between the two refuses the
write rather than redirecting it. A divergence check that meets a symlink
reports `Diverged`, so the write is refused instead of followed.

This closes the final component and says so. An intermediate directory swapped
mid-operation is still followed: closing that needs
`openat2(RESOLVE_NO_SYMLINKS)`, Linux 5.6+ with no macOS equivalent, which would
buy one platform rather than the jail. Windows keeps the path half only, because
its nearest flag opens the reparse point rather than refusing it. ADR-075 records
the boundary and `docs/security.md` no longer claims more than the code does.

`libc` becomes a direct Unix-only dependency of `notes-fs` for `O_NOFOLLOW` and
`ELOOP`. It was already in the tree through `tempfile`, `uuid` and `notify`, so
nothing is added to the build; the constants differ per target and spelling them
out by hand is a portability bug waiting for a platform we do not test on.

## 1.1.4 - decide macOS build reuse by source fingerprint instead of mtime

The two release paths answered "is the build on disk still the build for this
source tree?" differently. Linux hashed every input file and compared the
digest; macOS ran `find -newer` against the DMG. Timestamps cannot answer that
question: a file restored with `cp -p`, or from any checkout that preserves
mtimes, is different from the build *and* older than it, so the test passed and
the reuse path skipped straight to publication. The weaker check was on the side
that signs, notarizes and uploads to the download service — a stale binary
republished under a new version number, with a valid Developer ID signature and
a notarization ticket, and nothing in the output to notice it by.

macOS now calls the same `check`, `record` and `fingerprint` operations Linux
does, writing `.build.json` beside the image after stapling. The manual sha256
comparison and the `find -newer` clause are gone; the shared code already
verified the artifact digest and its sidecar. The macOS path also gained the
during-build guard Linux had: if the fingerprint changes between the start of
the build and the recording, the script refuses rather than recording a
manifest that describes sources the image does not contain.

Measured on Linux against the shared implementation: a source file given
different content and a 2020 mtime is invisible to `find -newer` against the
build, and changes the fingerprint. The call shape macOS now uses was exercised
directly — matching state reuses; a changed fingerprint, version or build mode
and a tampered image each refuse with their own reason. The 11 packaging
orchestration tests and the 5 updater publication tests pass.

`tools/linux-build-cache.py` is now `tools/build-cache.py`. It was named for its
only caller, and it has two.

**Not verified on macOS.** The Darwin branch of `build-local.sh` cannot execute
on a Linux host; the Python it now calls is covered above, the shell around it
is not. The next macOS build establishes the first manifest and costs one
rebuild.

## 1.1.3 - ignore the CPython bytecode the gate generates

`tools/check.sh` runs the Python packaging and updater suites, which import
their module under test, so CPython writes `tools/__pycache__/` on every run of
the gate. Nothing ignored it, so a clean checkout reported an untracked
directory it had created itself.

In a repository whose first rule is that everything is versioned and the only
exception is a secret, an untracked directory appearing on its own is not
harmless noise: it is one `git add -A` away from putting compiled bytecode in
the history, where it would go stale against the source it was built from. It is
derived, reproducible build output of the same class as `target/` and
`node_modules/`, and it is ignored under the same ADR-011 those entries cite.

## 1.1.2 - degrade the Windows cross-check when its C compiler is missing

The `clippy (windows)` step guarded itself on `rustup` and on the
`x86_64-pc-windows-gnu` target, but never on the MinGW C compiler that bundled
SQLite needs to build for that target. On a machine with the target installed
and no compiler — a Debian workstation without `gcc-mingw-w64-x86-64` — the
guard passed, `cargo` reached `libsqlite3-sys`, and cc-rs failed the whole gate
with sixty lines of environment probing that never name the missing package.

That contradicted the step's own stated design: a missing prerequisite degrades
to a printed warning, because refusing to run the remaining eighteen checks over
a cross-check helps nobody. The gate was red on the owner's Linux machine for a
reason that was not the code, and a permanently red gate is an ignored gate.

The guard now checks `x86_64-w64-mingw32-gcc` before installing the target, and
reports the package to install in one sentence. Measured on that machine: the
step prints `WARNING, not run — no MinGW C compiler (gcc-mingw-w64-x86-64 on
Debian, mingw-w64 on Homebrew)` and the gate continues. `NOTES_NO_WINDOWS_CHECK`
and the install-the-target behavior are unchanged; D-01 in
`docs/DECISIONS-0.1b.md`, which described the old two-prerequisite degrade, was
corrected in the same pass.

## 1.1.1 - remove the Rust 1.96 Clippy blocker from the release gate

Rust 1.96 started flagging an unnecessary borrow in a sync-client regression
test, making every dependency pull request fail Clippy on Linux, macOS and
Windows even though the same failure was already present on `master`. Pass the
owned path directly to `WorkspaceService::with_data_dir`; runtime behavior and
the test's workspace isolation remain unchanged.

Native `cargo clippy --all-targets -- -D warnings` passes after the change. The
separate macOS watcher timing failures remain in the queue and are not described
as fixed by this release.

## 1.1.0 - add guarded desktop update installation

Check for desktop updates after startup and every six hours, with manual checks,
version dismissal and explicit installation/restart after the workspace closes.
Hold the input barrier during installation and verify workspace state natively;
failures remain retryable. Arch packages stay managed by pacman. Frontend tests,
application Clippy and native builds passed; installed upgrade acceptance and
existing unrelated full-gate failures remain documented in the queue.

## 1.1.0 - publish reusable signed updater payloads

Pin a dedicated Tura signing key and publish separate HTTPS feeds for macOS,
AppImage, deb and rpm. Persist signed payloads before publication so retries
reuse completed builds. Extend ADR-072 with authenticated update distribution.
Native macOS and Linux ARM64 packages, pinned signatures, tamper rejection and
build reuse were verified. Live publication awaits the correct application
path on the private host.

## 1.0.5 - reuse completed Linux builds when retrying publication

Record completed bundles before any upload and reuse them when version, native
host, source content and artifact checksums still match. A failed SCP or ingest
can now be retried with --publish without npm ci or compilation. Only missing or
invalid requested formats are rebuilt; --force explicitly rebuilds. Tests cover
failed uploads followed by a successful publish without build tools, source
changes and deletions, missing/corrupt artifacts and version changes.

## 1.0.4 - publish desktop installers through the private host

Use b3sys@100.64.100.242 as the default SCP/SSH destination on Linux and macOS.
The public domain remains the download-page URL. Explicit destination overrides
remain available; the runbook explains how to update old saved overrides.

## 1.0.3 - support local Linux installer builds

Route Linux builds through a native packaging pipeline instead of rejecting the
platform. Build deb and AppImage packages by default, allow explicit rpm
selection, check dependencies before compilation, restore the version placeholder
on errors and select only fresh artifacts from an architecture-specific output
directory. Add deploy.sh as an alias with explicit publication, verified upload
checksums and the existing download-service ingestion contract. Preserve the
macOS signing pipeline. Regression tests cover dispatch, cleanup, missing output,
invalid options, missing libraries and failed upload verification. Debian 12
ARM64 builds produced deb, AppImage and rpm packages with verified checksums.
The full gate still reports the existing sync-client Clippy and deep-index test
failures, documented in the runbook and queue.

## 1.0.2 - ask pacman which desktop entry the package installed

1.0.1 fixed the PKGBUILD and the Arch job got further: the package builds and
installs. It then failed on the check 1.0.1 rewrote alongside it, and that check
was wrong in a way worth naming. Asserting `notes.desktop` broke on the rename,
so it became a glob over `/usr/share/applications` — but the build container
already carries entries from gtk3 and its dependencies, and `find -print -quit`
returned one of those. The `Exec=` assertion then failed against somebody else's
file, on a package that was correct.

The entry now comes from `pacman -Ql notes-bin`, which is the one source that
knows what this package installed, parsed with `sed` rather than `awk '{print
$2}'` because the path contains a space — and a filename this repository has
just decided not to predict is exactly the kind it must not split on. The icon
is checked the same way, against the package's own file list.

## 1.0.1 - install the desktop entry the bundler produced

The Arch job failed on 1.0.0 and that release shipped with no Arch package. The
Tauri bundler names the Linux desktop entry after `productName`, so renaming the
application to Tura Notes turned `notes.desktop` into `Tura Notes.desktop`,
and both the PKGBUILD's `install` line and the job's post-install check had the
old name written out by hand. The package step now takes whatever
`share/applications/*.desktop` the tarball carries, under the same basename, and
fails loudly when there is none; the check asserts that an entry landed and that
its `Exec=` launches the binary the package installs, which is the property that
has to hold. Arch and Debian now install the same desktop file ID because both
come from the bundler, and the next rename cannot break one platform only.
Recorded as ADR-071.

## 1.0.1 - sign and notarise the macOS build from the local pipeline

`build-local.sh` is now the macOS release pipeline rather than a local
verification build. It reads the Developer ID certificate and the notarisation
credential from the keychain of the machine that builds — which is where a
signing key belongs, and the reason the `build.yml` macOS job has never run —
signs and notarises the app, staples the ticket into the DMG and records a
sha256 beside it. `--publish` uploads the result to samirhv.com.br through one
scp and one `php artisan files:add`, then reads the hash back from the server,
because a truncated upload leaves a file that exists and fails only in the
user's browser. Publishing refuses an unsigned or unstapled image, so ADR-024 is
enforced by the tool instead of remembered.

The sha256 is written after stapling. Stapling rewrites the image, so the hash
taken before it described a file that no longer existed — the symptom was a
build that could never be reused, and the consequence would have been a
published number that no download ever matched.

Carried over from the rest of the fleet: a per-step clock, a toolchain preflight
that fails in under a second with an actionable message, `git pull --ff-only`
before packaging, ejection of DMG images a killed build left mounted, and reuse
of an on-disk build whose sha256 still matches and whose sources are no newer.
INT and TERM restore the stamped configuration placeholder as EXIT already did,
so an interrupted notarisation no longer breaks the next commit. Recorded as
ADR-070.

## 1.0.0 - introduce the Tura Notes identity

Adopt Tura Notes with an editable ribbon-T logo, platform icons and a branded
welcome screen. Rename the repository to tura-notes and update canonical links.
Keep the existing application identifier, executable and data paths so installed
users retain their notes and settings. The owner-selected 1.0.0 release does not
close the remaining device acceptance and sync work tracked in the queue.
Local installer output now selects the artifact for the version just built.
The macOS DMG and frontend checks pass; the full gate retains the unchanged
sync-client Clippy and watcher timing failures documented in docs/brand.md.

## 0.20.27 - import PDF text as Markdown

Add a desktop PDF import flow that extracts plain text into an editable preview.
The original PDF and its images remain outside the workspace; only an explicit
save writes a new Markdown note. The backend bounds input size and the UI test
covers reviewing text before the save callback runs.

## 0.20.26 - add the local macOS installer build

Add a root `build-local.sh` that produces a local macOS DMG for installed-build
verification. It checks the host toolchain, synchronizes the checkout by
default, stamps the package version temporarily, restores the committed
configuration placeholder, and never publishes an unsigned artifact. Document
the output path and local-only boundary in the runbook.

## 0.20.25 - cover receiver capture under an open application

Exercise receiver capture through the desktop controller while the same
application data has an open workspace. The controller refuses without a
publication, then preserves a note identity through two closed rename passes.
A later missing file leaves the outbox unchanged rather than inferring a
tombstone. Update the sync record and queue with this deliberate boundary.

## 0.20.24 - verify restored identities across two devices

Extend the native TCP and Compose HTTPS acceptance smoke with a restored
receiver application-data directory. The real receive client explicitly
reconciles its unchanged source identity, then completes guarded move and
delete effects using the restored registry. Refresh the queue and roadmap so
only receiver edge cases and owner acceptance remain in sync 0.6.

## 0.20.23 - reconcile restored application identities

Add an explicit local receive-queue operation for application data restored
independently from its fully applied queue. It re-observes unchanged live files,
checks them against immutable remote content hashes, and updates only their
operational local identities. Regression tests cover a later guarded update
through the restored registry and refusal without checkpoint or source writes
when a file changed.

## 0.20.22 - compact acknowledged linear sync payloads

Extend the offline sync retention pass beyond resolved divergent branches to
strictly linear, unanimously acknowledged non-head publications. Keep immutable
revision metadata and append-log cursor positions, retain the current live
payload as a receive baseline, and require the client to fetch the exact compact
server envelope before replacing local bytes. Focused server, transfer and new
receiver tests cover baseline application and causal replay.

## 0.20.21 - keep implementation records out of the queue

Move the durable product specification and superseded planning drafts from
`.continue/` into `docs/`, reduce the interface, index and sync queue files to
their actual unfinished work, and make the documentation index point to the
delivered records. The queue now lists only implementation, physical-device and
owner-acceptance work that remains open.

## 0.20.20 - recover scoped receiver queues

Allow `recover-client` to audit and extend a restored scoped queue across
invisible server cursor positions. Compare only the credential-visible ordered
publications while preserving the absolute cursor, pending local branches,
application receipts and source files. Continue to refuse pending pairing and
mixed application backups. All 57 client integration tests and 17 library tests
passed, including recovery across interleaved out-of-scope publications.
The full local gate retained its existing watcher startup timing failure; every
remaining gate stage passed.

## 0.20.20 - retire revoked sync devices explicitly

Add offline operator commands to list sync devices and permanently retire one
device after its owning credential is revoked. Remove only that device's
application receipts, retain every revision and other device receipt, and keep
the operation under the server instance lock with an audit event. All 28 server
integration tests passed; native Clippy passed for the server and sync client.

## 0.20.19 - compact acknowledged receiver branches

Compact a receiver's retained divergent branch payloads only after its local
application receipts were acknowledged and the server returns the exact
metadata-only envelope. Preserve causal revisions, source files, application
state and subsequent synchronization. Keep unresolved or server-unconfirmed
bytes exportable and process at most 20 resolutions per explicit invocation.
All 56 client integration tests and 17 library tests passed, with continued
application after compaction. Two existing receiver guard tests refused once
during broader runs and passed in the complete client run and isolated reruns.

## 0.20.19 - prune resolved server payloads

Add an offline operator prune for divergent branch payloads whose resolution or
descendant was acknowledged by every known device. Retain revision metadata,
tombstones, heads and append cursors, preserve pre-prune retry idempotency, and
refuse remotely supplied metadata-only history. Verify stopped-server locking,
scope authorization, atomic persistence and backup restoration.
All 27 server tests and the sync-domain suite passed, as did native/Windows
clippy, TCP smoke, generated contracts, byte preservation and frontend checks.
The full local gate retained its existing watcher timing failure; a separate
index timing test failed only under concurrent load and passed isolated.

## 0.20.18 - verify interrupted two-device effects

Reconstruct receipt loss after receiver moves and deletions with separate CLI
processes over TCP and HTTPS. Verify unchanged moved-file bytes and timestamps,
retry acknowledgments, and retain files recreated before a replay. Exercise
restored uploader recovery against the same real server. Keep physical mobile
lifecycle and installed-release acceptance in the queue.

## 0.20.18 - recover restored client transfer queues

Audit an older unscoped client cache against the complete server prefix before
recovering another page. Clear only identical published outbox entries, preserve
unpublished branches and application receipts, and checkpoint successful batches
atomically. Refuse corrupt, divergent, scoped and mixed backup states without
source writes. Cover bounded recovery, transport interruption and retained local
conflicts with integration tests. All 55 client integration tests and 17 library
tests passed, as did native/Windows clippy, generated bindings, frontend checks
and the remaining workspace suite. The full local gate retains the existing
watcher startup timing failure.

## 0.20.17 - expose receiver file capture options

Expose independent default-off desktop options and CLI commands for capturing
new receiver notes and recognized local renames. Keep source application
explicit. Scoped TCP smoke verified both changes on another receiver; 82
frontend tests, native/Windows clippy, generated bindings and the remaining
workspace suite passed. The full local gate failed only the existing watcher
startup timing test; its assertion remains unchanged.

## 0.20.17 - retain receiver file changes

Retain local-only receiver notes as durable causal roots and recognized moves
as revisions of the same remote identity. Guard captures with an exclusive,
draft-free workspace and confirm observed bytes without rewriting source files.
Preserve successive edits and moves across transfer interruptions and reject
occupied destinations. All 48 client integration tests and 17 library tests
passed, including empty binding, root divergence and pending path collisions.

## 0.20.16 - schedule saved receiver edits explicitly

Add a separate opt-in for capturing already synchronized same-path receiver
edits during desktop transfer passes. Keep source application explicit. Validate
the setting and repeat captures with controller and UI tests, plus scoped TCP
round trips. All 40 client integration tests, 17 library tests, 81 frontend
tests, native/Windows clippy and binding verification passed. The existing
watcher startup timing gate failed locally; the remaining workspace suite passed.
One capture guard refusal did not recur in four diagnostic runs or the final run.

## 0.20.16 - queue saved receiver edits without a remote conflict

Retain ordinary saved receiver edits as immutable causal publications. Confirm
published captures from guarded source observations without rewriting files,
while preserving subsequent edits and explicit divergent resolution.

## 0.20.15 - verify device recovery after server rollback

Exercise two-device recovery, interrupted replay, retained local edits and
application receipts after restoring an older server history. Native TCP backup
restore, 34 client regressions, native/Windows clippy and the remaining workspace
suite passed. The existing macOS watcher startup timing test failed locally;
its threshold was not changed. The receive-interface regression now waits for
enrollment to finish before clicking Apply; all 80 frontend tests passed.

## 0.20.15 - recover retained publications after server rollback

Add explicit CLI recovery that verifies an exact unscoped server prefix before
replaying retained immutable publications with their original identifiers and
normal authorization. Preserve client cursors, pending work and source files.

## 0.20.14 - expose desktop synchronization controls

Add typed native commands and an accessible localized sync panel for enrollment,
reconciliation confirmation, schedules, received application, retained history,
conflict capture/recapture, explicit resolution and original-byte export. Preserve
the editor barrier and require closed workspaces for filesystem effects.
Validated native reconnection, conservative pause, automatic upload and history
against a disposable loopback server. Native/Windows clippy, frontend and TCP
checks passed. The existing macOS watcher timing test failed locally; the
remaining workspace suite and new client regressions passed separately.

## 0.20.14 - schedule bounded background device transfers

Add an opt-in desktop worker with persisted connection settings, network/power
pauses, bounded batches and retry backoff. Keep source application explicit.

## 0.20.13 - apply recoverable device bundles

Capture explicit current-head tombstones and order rename cycles without source
writes. Transfer referenced attachments, retain divergent binary bytes, guard
local replacements and resume individual file intents before note acknowledgment.
Expose bundle application and private attachment export through the CLI. Update
the queue and document recovery boundaries. Native/Windows clippy, all new
regressions, real TCP transport, byte-preservation and frontend checks passed.
The existing macOS watcher startup timing test exceeded 100 ms locally, including
an isolated repeat; the rest of the workspace suite passed separately.

## 0.20.13 - guard sync filesystem effects in core

Correlate closed rename permutations using unique native identities plus unchanged
bytes. Capture referenced binary files through the workspace jail and restore
attachments under exclusive workspace ownership with BaseRev preconditions.

## 0.20.13 - validate referenced attachment publications

Extend immutable publications and retained branches with bounded attachment
manifests. Validate Markdown references, exact hashes, decoded quotas and every
historical scope. Translate subfolder attachment paths at the transport boundary
and document the optional wire fields in OpenAPI.

## 0.20.12 - exercise the expanded device workflows over real transport

Add TCP/HTTPS CLI scenarios for receiver source effects and scoped enrollment,
including original-byte retention, identity confirmation and accurate receipts.
Document recovery boundaries and update the implementation queue. Native/Windows
clippy, new-flow tests, TCP smoke and frontend checks passed. The existing macOS
watcher startup timing test exceeded its 100 ms local budget in the full suite;
its isolated repeat passed, and the remaining workspace suite passed separately.

## 0.20.12 - confirm scoped pairing against observed folder contents

Pin the selected credential namespace and translate all publication paths while
preserving filtered server cursor positions. Preview reconciliation against local
identities and bytes, then confirm its digest after checking for unseen remote
entries. Equal files link, local-only files stage uploads, and remote-only files
wait for application. Divergent bytes refuse confirmation without source changes.

## 0.20.12 - apply receiver move and deletion resolutions recoverably

Apply explicit receiver path/tombstone choices under the captured source guard,
with durable intent before filesystem effects and retained original history.

## 0.20.11 - expose explicit receiver recapture in the CLI

Add recapture-conflict with the pinned application data directory. Document
publication-before-recapture for a prepared choice, retained ancestry, source
preconditions and capacity limits. Real TCP smoke exercises recapture before
resolution; recovery tests cover repeated capture, published choices, lost
responses, refusal boundaries and branch capacity. The full local gate passed,
including native/Windows clippy, workspace tests and frontend checks.

## 0.20.11 - recapture receiver edits without losing retained branches

Extend an unresolved receiver capture with newly saved bytes while preserving
prior branches and the actual application receipt. Require another explicit
resolution before publication/application, retaining existing source guards.

## 0.20.10 - document explicit receiver restoration after remote deletion

Document the explicit resolve-to workflow for remote rename/delete conflicts,
its applied-path constraint and the remaining local source effects. Extend real
CLI smoke through publication, restoration and acknowledgment for both cases.
The full local gate passed, including workspace tests, native/Windows clippy,
TCP integration, byte preservation, fixtures and frontend checks.

## 0.20.10 - restore receiver conflicts at their applied path

Allow explicit live restoration at the receiver's applied path when the remote
history renamed or deleted the note. Retain both branches and supersede remote
ancestor revisions without applying their source effects or sending false
receipts. Implicit path choices and local move/delete effects remain refused.

## 0.20.9 - expose the receiver conflict recovery workflow

Add capture-conflict and apply-resolution commands for saved same-path receiver
edits. Document explicit resolution, durable application progress, compatibility
and the remaining source rename/delete and recapture boundaries. Real CLI smoke
verifies publication, repeat application and accurate acknowledgments. The full
local gate passed, including native/Windows clippy, workspace tests, TCP smoke,
byte preservation, fixtures and frontend checks.

## 0.20.9 - resolve saved receiver edits without false application receipts

Capture a receiver's saved local edit against its application identity under an
exclusive closed-workspace session. Retain exact bytes and their observed source
revision as a conflict branch, without overwriting the note or advancing an
application receipt. Reuse explicit two-parent resolution for the captured edit. Apply only its
published result under the captured source revision guard; defer unrelated notes
and skip superseded revisions without sending false application receipts.
Regression tests cover lost responses, crash recovery, interleaved notes, drafts,
open workspaces and additional local edits.

## 0.20.8 - document explicit path and tombstone resolutions

Document resolve-to and resolve-delete, their source-file boundary and the
remaining receiver work. Record permission, collision, lost-receipt and source
preservation regressions plus real CLI smoke coverage. The full local gate
passed, including native/Windows clippy, workspace tests, TCP smoke and frontend
checks. The expanded smoke respects the production credential rate window;
client busy errors now also describe server backpressure accurately.

## 0.20.8 - resolve renamed and deleted upload branches explicitly

Allow an explicit result path and either chosen file bytes or a tombstone when
resolving divergent upload heads. Preserve the legacy same-path command's
refusals and the existing two-parent, capacity and expected-head guards. These
choices stage history without moving or deleting source files.

## 0.20.7 - expose explicit conflict resolution in the device CLI

Add independent fetch, conflict inspection, branch export and file-based resolve
commands so a blocked upload queue can retain both histories and resume after an
explicit choice. End-to-end CLI smoke verifies publication and guarded receiver
application without replacing uploader source files. Regression tests cover a
second remote race, lost response, restart and export of retained original bytes.
Update the protocol contract and remaining queue. The full local gate passed;
installed-release owner acceptance remains open.

## 0.20.7 - preserve divergent history in explicit resolutions

Accept bounded branch history atomically with an explicit two-parent resolution.
The observed remote head remains a compare-and-set precondition, every branch
retains its original bytes and permissions, and failed publication changes no
head or source file. The client stages chosen bytes with both observed parents
and durably retains its rejected revisions inside the new envelope. Existing
linear publications retain their wire format.

## 0.20.6 - connect received queues to exclusive editor sessions

Add app controls to open a prepared receive queue and apply bounded batches.
Freeze editing and reject concurrent IPC until verified clean reloads are
installed; retain the barrier after uncertain outcomes or incomplete recovery.
Dirty buffers, drafts and active composition refuse admission. Update the sync
contract and queue to put divergence handling next. The full local gate passed,
including Windows cross-target clippy, client recovery and frontend barrier
regressions. The development app launched, but native UI automation could not
access its unbundled window; installed-release owner acceptance remains open.

## 0.20.6 - adapt received queues to open sync sessions

Reuse the receive queue's durable intent and receipts through an exclusively
owned open core session. Advance clean buffer revisions within a batch and
return verified reloads after success or partial failure, preserving earlier
receipts when a later revision refuses application. Regression tests cover
multiple updates to one open note and dirty-buffer refusal.

## 0.20.5 - document exclusive sync host responsibilities

Document exclusive admission before buffers open, complete buffer snapshots,
input freezing, clean reload and separate durable receipt persistence. Record
ADR-049 and keep the frontend barrier, queue adapter and app controls in the
implementation queue. The full local gate passed with Rust tests serialized;
focused application tests and native/Windows clippy passed after the final
state-location guard. No installed-app interaction is claimed.

## 0.20.5 - guard received writes in an exclusively owned open workspace

Add opt-in exclusive core sessions for a future editor sync host. Reuse the
existing guarded application path without closing the workspace, and require
observed buffer snapshots before writing: changed buffers, stale clean buffers,
suspended notes and drafts are refused before durable intent. Keep the ordinary
shared-session CLI boundary intact. Refresh clean note reads and invalidate the
path index after application; app controls and the frontend editing barrier
remain queued.

## 0.20.4 - declare the CSS side-effect import for TypeScript 7

`typescript` 5.9 to 7.0. The native compiler found exactly one thing in this
codebase, and it was right: `import "./styles.css"` in `main.tsx` is a
side-effect import of a module with no declaration anywhere, which 5.x accepted
silently and 7 reports as TS2882.

The fix is the file this project never had. Vite ships the declarations for the
assets it resolves, and `src/vite-env.d.ts` is the reference to them — the same
shape as the existing `src/vitest-dom.d.ts`, which points at the DOM matchers
for the same reason. It is a gap being closed rather than a workaround: the
import was always untyped, and only the compiler changed its mind about saying
so.

`tsc --noEmit`, 72 frontend tests and the production build all pass, and with
this the whole of `tools/check.sh` is green across all thirteen dependency
updates of 0.20.4.

## 0.20.4 - move the frontend to React 19 and Vite 8

`react` and `react-dom` 18 to 19 with their `@types`, `@vitejs/plugin-react` 4
to 6, `vite` 6 to 8. The two React packages are one subject and not two, because
a tree holding `react` 19 against `react-dom` 18 is broken in a way no
typecheck reports. Nothing in `src/` needed a change: the app renders through
`createRoot` already and uses no API that 19 removed.

Vite 8 bundles with rolldown and minifies with oxc, and no longer ships esbuild
at all — so `minify: "esbuild"` in the config became a request for a package
that is not installed. It failed in `renderChunk`, *after* 2 034 modules
transformed successfully, which reads like a plugin bug rather than a
configuration one; the comment now in `vite.config.ts` is there to save the next
reader that ten minutes. `build.target` still decides the syntax floor, checked
rather than assumed: building the same tree at `es2015` and at
`es2021/chrome100/safari15` produces different bytes, so the WebView floor this
app ships against is still being applied.

72 frontend tests and the whole of `tools/check.sh` pass.

## 0.20.4 - convert index sizes at the SQL boundary for rusqlite 0.40

`rusqlite` 0.37 to 0.40 and `libsqlite3-sys` 0.35 to 0.38. The major removes the
`ToSql` and `FromSql` impls for `u64`, which is the honest thing to do — a SQLite
INTEGER is an i64, and the old impls hid a conversion that could fail at runtime
on a value no file size will ever reach. Three statements and one row read in
`notes-index` were relying on them.

The conversion now happens explicitly at the four sites that touch SQL, and
`Seen::size` and `Cached::size` stay `u64` for every caller: this is a boundary
detail, not a change to the crate's surface. The stored representation is
identical, so the schema version stays 2 and **no reindex is forced** — an
existing index opens and answers as before.

## 0.20.4 - carry base64, dirs and ts-rs to their current majors

`base64` 0.22 to 0.23 in the three crates that encode credentials and payloads,
`dirs` 6 to 7, and `ts-rs` 10 to 12. No call site changed: the APIs this
repository actually uses are the same across all three majors.

`ts-rs` is the one that could have been expensive, because it writes the
TypeScript the frontend compiles against and a changed emitter is a changed wire
contract. Regenerating under 12 produces all 72 files byte-identical, so the
generated-types gate stays a no-op and the frontend needed nothing.

## 0.20.4 - carry the CI actions to their current majors

`actions/setup-node` 4 to 7, `actions/setup-python` 5 to 7,
`actions/upload-artifact` 4 to 7 and `actions/download-artifact` 8. Every call
site passes only inputs that survived the majors — `node-version`, `cache`,
`cache-dependency-path`, `python-version`, `name`, `path`, `retention-days` —
so the bump is the version and nothing else.

The upload/download pair is the one worth checking rather than assuming:
`build.yml` uploads `linux-tarball` in one job and reads it back in another, and
an artifact written by one generation is not readable by the other. Both ends
stay on the post-v4 generation, so the handoff is unchanged.

## 0.20.3 - acknowledge durable device application receipts

Add explicit, resumable device acknowledgments derived only from durable local
application receipts. The server binds each device to its first credential,
checks historical scope and causal progress, and persists receipts separately
from storage acceptance. Lost responses can be retried without writing source
notes or claiming that cached content was applied. Active-editor integration
remains queued. Regression tests exercise lost responses, restart, bounded
batches, legacy checkpoints, unapplied content, credential ownership, causal
progress, scope, revocation and backup/restore; the real TCP smoke exercises
the new CLI command.

## 0.20.2 - preserve disk-full classification through contextual IO errors

Classify StorageFull and QuotaExceeded even when a library adds path context
and removes the raw OS error code. The Linux ENOSPC gate caught this when
atomic note creation used tempfile: the write failed safely but was reported
as generic IO. Cover both contextual error kinds and retain the real full-disk
regression, with a diagnostic that prints any unexpected result.

## 0.20.1 - resume guarded application from durable client checkpoints

Add an explicit receive-only apply command with a pinned app data directory,
per-revision local receipts and recoverable write intent. Refuse local edits,
preexisting destinations, incompatible state and unsupported renames/deletions
without discarding received bytes. Exercise real transfer/application and local
conflict refusal, plus a lost application receipt without a second source write.
Document the closed-workspace boundary and keep active-editor integration and
server device acknowledgments in the queue. The full local gate passed with
Rust tests serialized after the unchanged watcher timing test exceeded its
100 ms limit under parallel macOS load; native and Windows clippy also passed.

## 0.20.1 - apply received content through guarded core writes

Apply received creations and same-path updates only while the workspace is
closed in cooperating core processes. Preserve drafts and reject stale local
revisions, destination collisions and unsupported operations. Persist intent
before source writes so interrupted application can resume without rewriting
newer local content. Keep application receipts distinct from transfer receipts.

## 0.20.0 - refresh the remaining milestone queue

Record the shipped domain, server inbox and device transfer client separately
from guarded source application, conflict handling, broader pairing, deletions,
attachments, scheduling, UI and retention. Keep mobile implementation and owner
installed-release acceptance visible, with remote MCP following sync. Correct
the scope index to reflect partial implementation without removing open work.

## 0.20.0 - ship the verified device transfer client

Package the standalone client and exercise two real processes through the native
server and the CI HTTPS proxy. Verify offline restart, untrusted certificate
refusal, explicit test-CA trust and exact received-byte export while preserving
source folders. Include the client in cross-target checks and build transport
binaries explicitly before smoke tests.

## 0.20.0 - resume device revision transfers from durable queues

Add an explicit sync client that captures saved source bytes through core,
queues immutable publications offline and retries unchanged UUIDs after restart.
Pin the selected server and workspace, verify bounded responses and persist
received content before advancing its cursor. Keep conflicts and failures in
the local queue, never acknowledge source application or modify dirty notes.
Document the remaining sync, mobile, MCP and installed-release acceptance queue.

## 0.19.1 - expose immutable revision transfer over authenticated HTTP

Expose incremental metadata pages, original revision fetches and idempotent
conditional publication through the existing HTTPS and bearer boundary. Reuse
workspace permissions, protect entire historical paths and report storage
separately from source application. HTTP and TCP tests cover retries, stale
writes, concurrency, quota refusal, review scope and backup recovery. The device
outbox, workspace application and sync UI remain open.

## 0.19.1 - persist scoped sync revision inboxes

Persist original revision bytes and causal heads in one bounded, atomic server
transaction, so a stored revision cannot refer to missing content. Validate
history and hashes on reopen, retain tombstones until explicit capacity refusal,
and include inbox data in offline backups while excluding its process lock.
Future or corrupt state is refused without replacement.

## 0.19.0 - preview pairing through core inventories

Expose a standalone notes-sync-plan command over bounded core inventories of
two mounted folders. Distinguish upload, download and reconciliation; preserve
raw bytes, existing identities and note visits while reporting links, unique
notes and conflicts. Reject state directories inside source folders before
creating anything. Package the preview separately and keep the unfinished
transport, outbox, content application and UI explicitly in the sync queue.

## 0.19.0 - model causal revisions for synchronization

Start milestone 0.6 with a separate notes-sync domain crate. Track immutable
revisions, parentage, renames, tombstones and device acknowledgments without
using modification time to elect a winner. Produce deterministic incremental
plans that preserve conflicting edits and refuse path collisions, stale
resolutions and unrelated histories. Persist schema-versioned metadata through
locked, atomic compare-and-set transactions that preserve invalid/future state.

## 0.18.1 - exclude process locks from portable server backups

Windows enforces locked byte ranges even when the lock file contains no data,
so archiving a live backup guard failed before the archive could be published.
Keep the guards held and omit only regenerable operational lock files; source
files, credentials, identities and SQLite state remain in the backup. Exercise
the documented offline container backup/restore path as well as HTTPS, using
an isolated one-off container without a network or competing static address.

## 0.18.0 - package the self-hosted server with HTTPS operations

Provide a non-root container, a Compose deployment behind Caddy HTTPS, a
versioned OpenAPI contract and operator backup/restore instructions. Add real
TCP and container TLS acceptance alongside the existing workspace gate. The
server remains opt-in; desktop sync and remote MCP remain later milestones.

## 0.18.0 - serve scoped notes through a conditional REST API

Add the independent notes-server executable for one owner and per-integration
credentials. Reuse core permissions, root confinement, identity locks and
durable append receipts for path-addressed CRUD and search. Enforce bounded
bodies, pagination, request rates and concurrency; preserve source formatting
and reject stale complete revisions. Persist revocable credential digests and
bounded authorship events without tokens, note paths or content. Offline
backups include source bytes and operational state, refuse a live server and
restore only into a new directory. Future state schemas are refused unchanged.

## 0.17.0 - prepare the filesystem core for mobile targets

Merge the reviewed mobile foundation after the completed local knowledge work.
Make the trash dependency and capability desktop-only while preserving the
0.3 guarded-write changes. Reconcile the PR's obsolete version and ADR numbers,
state that generated mobile projects and layouts are still pending, and add
an iOS simulator core check to CI. This integrates the foundation of milestone
0.4; it does not claim a usable mobile application or device acceptance.

## 0.16.1 - preserve indented separators in YAML properties

Only an unindented Markdown metadata fence ends front matter. An indented
`---` or `...` inside a YAML block scalar is content; trimming its indentation
silently truncated properties and could hide tags after the scalar. Keep the
original source unchanged and cover both separators and trailing tags in a
regression test. Properties update immediately; upgrading from 0.16.0 requires
Rebuild index for affected cached tags. Publish refreshed packages for this
milestone correction.

## 0.16.0 - expose knowledge navigation and package local MCP

Add Properties, Tags and Backlinks panels, wiki destination selection, an
accessible graph with usable node targets, and safe asynchronous clipboard
image insertion. Publish the standalone Linux MCP archive alongside app
packages. The complete local gate, six real MCP process tests and 72 frontend
tests pass; native debug interaction verified metadata, ambiguity, graph
navigation and backlinks. Installed Linux owner acceptance and its repeat
remain explicitly pending. Keep the independently developed mobile PR intact.

## 0.16.0 - build local knowledge and scoped agent operations

Implement the milestone 0.3 core: read-only YAML and tags, wiki resolution,
backlinks/graph data, reviewed wiki renames, validated clipboard imports and
standalone scoped stdio MCP. Rebuild derived schema 1 documents for the new
parser while retaining operational identity. Cross-process tests found and
now prevent overwrites hidden by equal size/mtime; shared enrollment and
identity locking plus durable append receipts cover concurrent starts and
retries. Version 0.15.0 remains reserved by the independent mobile PR; its merge
must reconcile version and ADR numbering. Owner acceptance remains pending.

## 0.14.1 - isolate empty-file content correlation from inode reuse

Arch CI exposed a fixture that deleted the original empty file before creating
its replacement. A reused inode legitimately entered the native-identity rule,
so the test did not isolate the content-correlation behavior named in its title.
Create both files before removing the original, and additionally assert that
opening the replacement gives it a distinct NoteId. Product behavior is unchanged.
The complete local gate is rerun; installed packages remain the 0.14.0 delivery.

## 0.14.0 - complete the desktop navigation workflow

Expose Files/Recent/Outline, named Words/Literal/Regex modes, index progress,
cancellation/rebuild, and reference review before rename/move. The review lets
users select affected files and cancel without writes; an unavailable index
requires an explicit choice to move without updating links.

Finish the 0.1d implementation pass: mount the Welcome creation dialog, trap
and restore Settings/palette focus, refresh Quick Open while its cache builds,
clean up a divider unmounted mid-drag, cancel late search-start responses, and
prevent reloads from replacing newer typing. English/Portuguese catalogues and
IPC types match. All 69 frontend tests and the full local gate pass. A debug
macOS UI smoke test exercised Outline, Recent and a Words hit at the correct
line. The installed-release owner checks remain unticked in both acceptance
documents; 0.3 is still proposed.

## 0.14.0 - implement the milestone 0.2 core

Add separate operational registry.db and derived index.db, legacy identity
migration with a retained backup, incremental/cancellable FTS5 indexing, recent
history, and guarded incoming/outgoing Markdown reference rewrites. Rewrites
keep original bytes, disclose skipped candidates and report per-file failure.
Registry transactions merge unrelated stale snapshots and refuse conflicts;
newer database schemas are never downgraded. Literal and Regex keep their
existing semantics. Image destinations enter the shared document IR; the golden
fixture changes only metadata, not rendered HTML.

The full local gate passes, including native/Windows clippy, workspace tests,
byte preservation and generated contracts; ENOSPC is Linux-only. The read-only
~/x debug benchmark scanned 6,707 notes: 78.6 seconds initially and 3.7 seconds
with zero unchanged files reprocessed on the second pass. Owner acceptance on
installed Linux packages and the following release remains pending.

## 0.13.5 - preserve focus across menu actions

Choosing a menu item removed the focused button without restoring focus, so
ordinary actions left the keyboard on the document body. Dialogs launched by a
menu also captured a disappearing return target and lost focus on cancellation.
The menu now restores its trigger synchronously before running the action.
An action can then focus its own destination without a delayed restoration
stealing focus back.

Three DOM regression cases cover ordinary selection, launching and cancelling
a dialog, and an action that focuses another control. The first two failed
before the fix. All 14 menu tests and `tools/check.sh` passed, including the
frontend suite and production build; ENOSPC skipped because this machine is
macOS. Manual installed-build acceptance remains pending.

## 0.13.4 - show the repository version in development builds

The macOS About window displayed 0.0.0 during interface acceptance because the
development CLI read the committed packaging placeholder. The npm Tauri entry
now supplies the first version from version.md through an in-memory CLI config
override for desktop and mobile dev commands. Build commands retain ADR-035's
explicit release stamping, and tauri.conf.json stays unchanged.

Five launcher tests cover version extraction, mobile commands, application
argument separation, build passthrough, and refusal of a missing version. They
run in the local gate and frontend CI. The real CLI version/help commands and
`tools/check.sh` passed; ENOSPC skipped on macOS. The existing native window
was not restarted, so visual confirmation of About remains pending.

## 0.13.3 - preserve keyboard intent inside modal dialogs

Pressing Enter on Cancel confirmed a destructive request because the modal's
parent intercepted Enter before the button could activate. Confirmation now
uses each button's native keyboard behavior. Tab and Shift+Tab wrap inside the
modal, and separate input and button refs prevent the confirmation button from
receiving an unsupported `select()` call when it opens. Modal keystrokes no
longer reach background application shortcuts.

Six DOM regression tests cover cancellation, confirmation, focus containment,
text selection, Escape with focus restoration, text submission, and shortcut
isolation. Before the
fix, three failed and confirmation dialogs raised three uncaught exceptions.
A sixth test also reproduced shortcut propagation before its fix. The manual
installed-build acceptance remains pending. `tools/check.sh` passed; its ENOSPC
check skipped because this machine is macOS. The final frontend suite passed
all 55 tests and the production build passed.

## 0.13.2 - disambiguate the dialog component on case-insensitive filesystems

A fresh macOS clone passed all 49 frontend tests but failed the production
build: TypeScript resolved the extensionless `app/Dialog` import against
`app/dialog.ts`, then reported TS2305 and TS1149. The modal component now lives
in `DialogHost.tsx`, separate from the dialog state module even when filename
case is ignored. Its exported component and behavior are unchanged.

The existing TypeScript build is the regression check on macOS; a new unit
test would not exercise filesystem module resolution. `tools/check.sh` passed,
including native and Windows clippy, the Rust suite, byte preservation, and
frontend tests and build. The ENOSPC script skipped on macOS because it needs
Linux. The development app started; interface acceptance remains pending and
this fix does not begin milestone 0.2.

## 0.13.1 - the queue says where 0.1d and 0.2 stand

Two rows in `.continue/README.md`, which is the folder's index and had neither.

`0.1d-interface.md` **stays in the queue** even though the interface is on
screen as of `0.13.0`. Its own header says it leaves when the interface exists
there — but the rule the owner set for this milestone is stricter than the one
the file was written under: a box is ticked after they have walked it on the
installed `.deb` **and repeated it on the release after**. Until then the
milestone is built and unverified, which is a state the queue can hold and a
tick cannot.

`0.2-indice.md` records where the index milestone stopped. The code written for
it — the `notes-index` crate, the SQLite plumbing with WAL and a migration
ladder, five green tests — was **discarded** rather than left on a branch,
because scope §5 says a crate exists only once the milestone that uses it
begins and 0.2 has not begun. What is kept is the part that was expensive: the
crate cut ADR-003 deferred, the argument for `notes-index` touching no
filesystem, and the two-phase `plan`/`apply` protocol that follows from it.

## 0.13.0 - milestone 0.1d ships: the interface, with twenty-six boxes nobody has ticked

The minor the milestone asks for, so `build.yml` produces a `.deb`, an AppImage,
a tarball and the AUR package (ADR-036). `.continue/0.1d-interface.md` §9: the
owner installs it and walks everything at once — the ten areas of this milestone
and the twenty-five flows of 0.1b and 0.1c, re-indexed into the interface that
now exists.

**What is on screen that was not before**

| | |
|---|---|
| A rail | Files, Search, Graph (disabled, tooltip `0.3`), Settings at the foot. The active icon collapses the sidebar |
| A sidebar | Explorer toolbar — new note, new folder, sort, collapse all — the tree, and **the workspace selector** pinned below the scroll |
| A tab bar | The 0.1c tabs, with a background on the active one, `+`, and the split toggle |
| A note header | Back/forward, the title without `.md`, Source ↔ Preview, `⋮` |
| A column | 700 px, centred, the same on both sides of a split, with the same font and rhythm |
| A divider | Draggable, **and focusable, and arrow-movable** |
| A status bar | The seven states, words, characters — and nothing else |

**And the defect that started it.** Every command needed to change workspace has
existed since 0.1a; the only surface reaching them was the Welcome screen, which
disappears the moment a folder is opened. After the first open there was no way
to change folder at all.

**What was decided, and where.** Two ADRs for the scope change — 0.1d exists
(ADR-037), graph view leaves §18 for 0.3 after backlinks (ADR-038) — and seven
calls in `DECISIONS-0.1d.md`, including the three questions the milestone left
open by name: the column is a fixed maximum rather than a fifth setting, split
is horizontal only, and Welcome stays a screen.

**What the machine holds, and what it does not.** Eleven DOM tests on the menu's
keyboard path, six core tests on switching workspace, and a contrast script over
42 pairs that fails the build if any colour is written outside `:root`. That is
less than a fifth of `ACCEPTANCE-0.1d.md`, and the document says so. The rest is
the owner's, twice — once on this `.deb` and once on the next one.

The one criterion no test will ever hold is written down too: *"Alguém que usa
Obsidian todo dia abre o app e encontra tudo sem pensar. Se precisar procurar
onde troca de pasta, o marco não fechou."*

## 0.12.5 - the editor is set in the body font, because the reading was jumping

Two things the milestone's own acceptance asks for that the build did not do,
found by launching it and looking.

**Source and Preview did not share a typography.** §4.3: *"Preview: mesma
coluna, mesma tipografia — a leitura não deve 'pular' ao alternar."* The
preview was in the interface sans and the editor was entirely in JetBrains
Mono, so switching between them moved every line — two fonts at one size do not
occupy the same space, and the column that 0.12.3 carefully matched was the
only thing that did.

§5 is explicit about which way to resolve it: *"uma sans para interface e
**corpo**, uma mono para código."* A note is body text and the editor is where
it is written, so the editor is now set in `--font-body` and **code keeps the
mono** — inline spans and fenced blocks, through the highlight style. The H1
that was a large monospace heading now looks like a heading.

Both stacks became tokens, which also removed the last three places a font was
written out by hand. Nothing is downloaded: the CSP forbids a remote font, and
an application that needs the network to look right is not local-first.

**The collapse-all icon read as a close button.** `ChevronsDownUp` at 15 px is
two chevrons pointing at each other, which is an ✕ to anyone not looking for
it — in a toolbar, beside a tree, that is an invitation to lose your expansion
state on purpose. It is `ListCollapse` now.

Both were found the same way: building the `.deb`, launching it, and taking a
picture of the window. Synthetic clicks still do nothing on this machine — the
window manager refuses to raise the window and WebKit ignores events delivered
to an unfocused one, which is the same wall `ACCEPTANCE-0.1b.md` recorded — so
the session was **seeded through the core** instead, and the shell photographed
with a real note open in split.

## 0.12.4 - polish, and ACCEPTANCE-0.1d.md with the twenty-five flows re-indexed

Steps 4 and 5 of 0.1d.

**Polish.** One focus ring for every control, on `:focus-visible` so a mouse
click leaves nothing behind and a `Tab` always does. Colour transitions at
90 ms — short enough to read as a response rather than an animation, and only
on colour, because nothing that moves the layout should be animated under a
click that is on its way. `prefers-reduced-motion` turns all of it off: that is
a preference the operating system already knows and the application has no
business second-guessing. Scrollbars joined the palette. The Welcome screen —
the first thing anyone sees and the piece with the least attention — got the
same tokens and rhythm as the shell it leads into.

The selected tree row moved from `color-mix(accent)` to `--selected`, because
`color-mix()` resolves against whatever it lands on and its result is not a
token the contrast script can read — and a selected row is the surface most
likely to be carrying dim text.

And the script gained the pair it was missing: **the accent is also a
surface.** The primary button paints a label on it, and the accent had only
ever been checked as a foreground. A colour is not safe because one of its two
roles is.

**`ACCEPTANCE-0.1d.md`.** Ten areas, none ticked, plus the one that cannot be
automated — *"alguém que usa Obsidian todo dia abre o app e encontra tudo sem
pensar"* — and an automated section that says plainly it holds less than a
fifth of the rest.

The **twenty-five flows of 0.1b and 0.1c are re-indexed into it**, each with a
*was* and a *now*: `New note` moved from the top bar to the explorer toolbar,
the entry menu is reachable by `⋮` as well as right-click, search moved into
the sidebar, Settings is on the rail. The expectations are the originals word
for word; only where you press changed. Both older documents now point at the
new one and say why, because a flow whose steps describe a window that no
longer exists cannot be walked — which is what ADR-037 said when it re-indexed
them instead of ticking them where they were.

They stay ☐ in all three until the walk on the `.deb`, and then until the
walk on the one after it.

## 0.12.3 - the column, the type, and a divider you can move with the keyboard

Step 3 of 0.1d (`.continue/0.1d-interface.md` §6, §4.3, §5).

**The column.** Both panes now lay their content out in a centred column of
`--column` (700 px, D-03) with margins that grow with the window. In the editor
it is on `.cm-content` rather than on the scroller, and in the preview on the
children rather than on the container — in both cases so the **scrollbar stays
at the pane's edge** instead of sliding in to the column's. Line height, top
padding and heading scale are the same on both sides, which is what §4.3 means
by the reading not jumping when you switch.

Both also carry 40vh of bottom padding, so the last line of a note can be
scrolled to the middle of the screen instead of sitting on the floor.

**The type.** Markdown is now highlighted: H1 at 1.9em and 700, H2 at 1.5,
bold actually bold, code and links on the accent and the good colour, and the
punctuation Markdown is made of — `#`, `*`, backticks — dimmed rather than
removed. Sizes are `em`, so they scale with the font size the settings panel
controls instead of ignoring it. The syntax stays on screen: hiding it is Live
Preview, which is §18, and a bigger heading is not a step towards it.

**The editor's colours came off hard-coded hex and onto the tokens.** Four of
them — caret, gutter, active line, selection — were written in a TypeScript
object, which is exactly the blind spot `tools/contrast.sh` was given a guard
for one commit ago: the guard reads the stylesheet and could never have seen
them.

**The divider** is a `role="separator"` with a value, not a `<div>` with a
mousedown. It takes focus, the arrows move it two points at a time, `Home` and
`End` go to the limits, `Enter` and a double click even it up, and it reports
its position so a screen reader says something better than "5 pixels wide". A
drag handle reachable only by mouse is a control half the people using this
application cannot operate.

The drag listens on the document rather than on the handle — a fast drag leaves
a 5-pixel target behind long before the button comes up — and writes a CSS
custom property instead of React state, so a drag costs one style write per
mouse move rather than a re-render of a pane containing CodeMirror.

## 0.12.2 - the shell: a rail, a real sidebar, a note header, and a contrast check that found a bug in my own palette

Step 2 of 0.1d (`.continue/0.1d-interface.md` §6). Everything in its place;
the fine styling is step 3.

**The rail**, 44 px on the left: files, search, graph, and settings at the foot.
Clicking the icon of the panel already showing collapses the sidebar, which is
the only way to give the editor the whole window. Graph is rendered
**disabled with its milestone in the tooltip** — ADR-038 moved it from "out of
scope" to 0.3, and a promise with a date on it is worth more than a gap in the
rail.

**The sidebar** is one column with three parts: a toolbar that acts on the panel
(new note, new folder, sort, collapse all), the panel, and the workspace
selector pinned below the scroll. Global search moved *into* it — it used to be
a third column that pushed the editor sideways.

**The tree's context menu is now the shared `Menu`**, so it has arrows, `Escape`
and the focus return that 0.12.1's eleven tests cover. It also gained a `⋮`
button, revealed on hover and **always on focus**: hiding a control from the
keyboard is how a menu becomes mouse-only without anyone deciding it.

**The note header** carries back/forward, the centred title (file name without
`.md`), the Source/Preview toggle and a `⋮`. It sits below the tabs rather than
in a top bar because at split there are two of them, one per pane — a header in
the window chrome could not be. Back/forward is one history for the window
rather than one per tab, and D-06 says why: a tab here is a note, not a
viewport, so there is no navigation *within* one to have a history of.

**The status bar** moved right and gained words and characters. Characters are
code points, so an emoji counts once. **Nothing else is there**: a backlinks
counter needs the index that arrives at 0.3, and a counter with no data behind
it is a lie with the face of a feature (§3). Background work — the watcher's
walk — sits on the left, discreet, and disappears when it finishes.

The old top bar is gone; its diagnostics moved into Settings, which is where a
thing you look up rather than read belongs.

**`tools/contrast.sh`**, and it earned its place immediately: it failed on the
palette I had just written. The three dark levels were 1.05:1 apart — exactly
the *"visível numa tela ruim"* failure §5 names.

Two things were wrong and both were mine. `--line` was being held to WCAG's
3:1 for non-text contrast, which does not apply: 1.4.11 covers what identifies
a **control**, and a rule between two panels that are already different surfaces
identifies nothing — holding it to 3:1 means a near-white hairline brighter than
the text beside it. And the level check was a contrast *ratio*, which is the
wrong instrument near black: the formula adds 0.05 to both sides to model screen
flare, and that constant swamps the difference. My first floor of 1.15:1 was
unreachable by any palette that still reads as one tone of dark.

Levels and dividers are now checked as a **step in 8-bit sRGB** — 8/255, about
where a cheap panel stops merging two greys — and text and the focus ring keep
their WCAG ratios. The script says which number is a standard and which is this
project's own.

Then it found three more: `--disabled` at 2.15:1 was a smudge rather than the
legible-but-inert control §3 asks for, and `--fg-dim` on a selected row was
4.36:1. Both fixed in the palette.

And the hole underneath all of it: **a colour written outside `:root` is a
colour the checker cannot see.** Thirty-odd inline hexes were doing exactly
that. They are now role tokens — `--hover`, `--selected`, `--field`, `--scrim`,
the tint family — and the script fails the build if a raw hex appears below the
token block. 41 pairs checked, up from nine.

## 0.12.1 - 0.1d opens with the two ADRs and the bug: you can change folder again

Milestone 0.1d — Interface — enters the scope, and the desktop MVP becomes
`0.1a + 0.1b + 0.1c + 0.1d`. Two ADRs, in the first commit as the milestone
asks:

**ADR-037.** The interface is a milestone, not a finishing pass. The reference
is Obsidian's dark layout; the rule is that palette, spacing and structure are
free and **no theme file, stylesheet or asset is copied — everything is
rebuilt**. Icons are `lucide-react` (ISC). The twenty-five flows of 0.1b and
0.1c are re-indexed into `ACCEPTANCE-0.1d.md` rather than ticked where they are:
the steps move, the behaviour does not, and a flow whose steps no longer
describe the window is not a flow anyone can walk.

**ADR-038.** Graph view leaves §18's "out of scope until further order" and
becomes 0.3, after backlinks — a graph is a rendering of a link relation, and
backlinks are that relation. It is **not** part of 0.1d; the icon rail carries
it disabled with its milestone in the tooltip, which is the honest way to show
something that is coming.

**And the defect.** Every command needed to change workspace has existed since
0.1a — `workspace_open`, `workspace_create`, `workspace_recent`,
`workspace_close` — and the only surface that reached them was the Welcome
screen, which disappears the moment a folder is opened. After the first open
there was **no way to change folder at all**. A command with no route to the
user is a command that does not exist.

The selector lives in the sidebar footer, in a scroll-proof row: it is the one
control that has to be reachable at every moment, because it is how a user
leaves a workspace they opened by mistake. Switching is `close` then `open`, in
that order, so `close_workspace`'s `DirtyBuffers` refusal is **on** the path
rather than beside it; a dirty buffer asks, by name, in the application's own
modal — never `window.confirm`, which does nothing in a WebView.

`tests/switch.rs` — six tests over a path nothing had ever exercised, because
until now it was unreachable. They pin behaviour rather than a fix: a
store-before-adopt was written into `open_workspace` and then **removed**, because
the tests passed identically with and without it. `ARCHITECTURE.md` §4.1
describes a two-second registry debounce that is not implemented, so there is
nothing unwritten to lose — recorded as `DECISIONS-0.1d.md` D-01 rather than
pre-fixed, and the day the debounce lands those tests start failing, which is
the outcome to want.

`Menu.tsx` is the one popup the workspace selector, the note header's `⋮` and
the explorer's context menu will all be. Eleven tests, in a DOM, because focus
is the subject: a menu that keeps focus leaves a keyboard user on `<body>` with
no way back. `jsdom` and testing-library join the **dev** dependencies for it
(D-02) — `vitest` stays on `node` by default and a file opts into a DOM on its
first line.

The three questions `.continue/0.1d-interface.md` §10 left open are answered by
the rule and recorded: the editor column is a fixed maximum rather than a fifth
setting (D-03), split is horizontal only in this milestone (D-04), and Welcome
stays a screen rather than becoming an empty shell (D-05).

## 0.12.0 - artifacts on a minor bump, and a patch release that says why it is empty

The owner's call on yesterday's cost: *"9 min e 105 MB por commit de doc não se
justifica."* ADR-011 makes every commit a version and every version a Release,
and `build.yml` was packaging all of them — twelve full builds in one session,
three concurrent, with the CI job that gates the work queued behind an AppImage.

`build.yml` now builds a version whose patch component is `0`, plus any version
asked for through `workflow_dispatch`. A patch Release carries no artifacts and
**says so in its own description**, with how to get them — an empty downloads
section otherwise reads as a build that failed. The note is written once; a
marker keeps a re-run from appending it twice.

The rule is arithmetic on the version string rather than a diff of what changed.
A patch that touches the editor gets no artifacts even though the binary is
different, and a minor bump that only moves documents gets a full set. Deciding
by content means defining which paths count, keeping that list right, and
explaining an empty Release whose commit *looks* like code. The version number
is a decision the author already made; reading it is cheaper than
second-guessing it (ADR-036).

**This release is the first minor bump under the new rule**, which makes it the
first one built by it.

## 0.11.11 - one build at a time, because the burst was starving CI

An operational consequence of yesterday's release pipeline, observed rather than
predicted: every commit is a version, every version gets a Release, and
`build.yml` queued a nine-minute build for each. Three ran concurrently while
the CI job that actually gates the work sat queued behind an AppImage.

The concurrency group is now `build` with `cancel-in-progress`. A burst of
commits produces one build — the newest. What it costs is that an intermediate
version can end up with no artifacts, and that is the right trade: nobody
installs the middle of a working session, and what has to be installable is
exactly the one this rule always builds. Filling an older one in afterwards is a
manual `workflow_dispatch` with its version as the input.

Cancelling mid-run needed the completion check to get stricter. It looked for a
`.deb`, which a run cancelled halfway will have already uploaded; it now looks
for the `.SRCINFO`, which the Arch job uploads last. Every upload already used
`--clobber`, so rebuilding over a partial set is safe.

## 0.11.10 - the churn test measured the runner, not the rule

`an_index_that_is_still_building_is_not_restarted_by_a_change` was green here
and red on Ubuntu, Windows and Arch — and this time the code was right and the
test was too big.

It is the one test whose **main thread competes with the walk for the disk**: it
creates a note per iteration precisely to keep invalidating. On a two-core
runner with four other tests building corpora beside it, a 7 200-directory tree
means the walk gets no I/O and the assertion fires on a runner's contention
rather than on a restart. The evidence is in the failure itself —
`indexed: 2398, building: true` after 1 632 changes: climbing steadily, which is
exactly not what a restart looks like.

The corpus drops to 120 repositories and the ceiling rises to two minutes. The
property is size-independent, and both directions are re-verified at the new
size: 1.5 s green with the rule, and with the old rule put back,
`indexed: 0, building: true` after 6 606 changes and the full two minutes.

Two stale index lines went with it: `docs/README.md` now describes the runbook's
release section, and `.continue/README.md` no longer says the repository is at
`0.1.0`.

## 0.11.9 - the deep fixture becomes a CI criterion, not a local measurement

The criteria added at 0.11.0 build their own corpus so they can run on every
push; the 20 962-directory fixture the freeze was actually measured on was a
local `--ignored` run and nothing enforced it. Generating it costs 2.8 s, so
now CI does, on the Linux job, and the measurement is a criterion:

- `open_workspace` + `list_dir` on 20 962 directories, **under a second**;
- `start_watch` and the first `quick_open`, **under 100 ms each** — they cost
  502.72 ms and 549.88 ms before ADR-034;
- `quick_open` returns `Ok`, not `Err(PermissionDenied)`, with the mode-000
  directory in place;
- `degraded` stays `None` — one unreadable directory does not demote the
  workspace to polling.

Linux only, for the two reasons the rest of it is: the per-directory counters
are inotify's (D-10), and it is the one runner in the matrix that is not root,
which is what the Arch job taught at 0.11.3.

The whole sequence on that fixture is now **1.59 ms**, against 1 053.73 ms
before — and the "before" number had to be taken with the unreadable directory
temporarily made readable, because with it in place there was nothing to
measure: the run aborted in under a millisecond.

## 0.11.8 - the front door stops saying there is no application

`README.md` said **"Documentation only — there is no application code in this
repository yet"** while the repository built a Markdown editor, tested it on
four platforms and published a `.deb`, an AppImage and an Arch package. A
release nobody can find is not a release, and the first file anyone opens was
telling them not to look.

It now says what is built, how to install it on each of the three Linux routes,
and how to build it. It also says the thing the acceptance documents say and the
old text never had to: **nobody has walked the interface.** Every criterion so
far is an assertion about the core, and the twenty-five flows stay unticked
until a person has done them.

`docs/roadmap.md` goes from `PROPOSED` to `ACTIVE` for 0.1 only, with the three
sub-milestones and the versions they shipped in. Everything from 0.2 on is still
a specification.

## 0.11.7 - the index stopped starving itself on a workspace that keeps changing

A bug the background index introduced, found by asking what happens on a folder
that is being written to while it fills.

ADR-032 drops the quick-open list on every operation that changes the tree, and
on every reconciliation that saw an event. That was right when building the list
was a 30 ms walk inside the call. It is wrong once the walk is background work
that takes **15.8 s on `~/x`**: any folder with continuous activity in it — a
build, an `npm install`, a `git checkout` — invalidates faster than the walk can
finish, so each `Ctrl+P` restarted it from zero and quick open returned an empty
list for as long as the activity lasted.

`quick_open` now rebuilds when there is no index, or when the list is stale
**and the previous walk has finished**. The staleness is remembered rather than
dropped; the next call after the walk ends starts a fresh one, and the palette
says `building` for the whole of it.

Measured by putting the old rule back:
`QuickOpen { matches: [], indexed: 0, building: true }` after **2 919 changes**
and thirty seconds. With D-11 the same test settles in 1.4 s with the whole
workspace indexed, while the changes are still arriving.

## 0.11.6 - the watch-limit sentence is asserted; the behaviour behind it is not

The one claim in this milestone that nothing exercised. `notify` reports an
exhausted watch table as an ordinary I/O error, so errno 28 is the only thing
separating "this kernel has run out of watches" — which a `sysctl` fixes — from
"this path does not exist", which it does not. Getting that wrong costs the user
the single instruction that would have helped, so it is now asserted: errno 28
classifies as `WatchLimit` and its message carries
`fs.inotify.max_user_watches`; errno 2 does not, and must not offer a command
that would not help.

**What is still not verified is the behaviour on a full table** — keep the
watches already installed, count the remainder, do not demote the workspace.
Reaching that state means lowering `max_user_watches`, which is 1 048 576 here
against the 49 937 `~/x` needs, and the inotify sysctls are not writable from an
unprivileged user namespace on this kernel. The ENOSPC suite does exactly that
trick for a full disk; it does not work for this. Recorded as not verified in
`ACCEPTANCE-0.1b.md` §6 rather than left to look tested.

## 0.11.5 - the folder that froze it, measured on the folder that froze it

`fixtures/deep` is a reconstruction. `~/x` is the original, and
`deep.rs::where_the_time_goes_on_a_real_folder` now measures it directly, behind
`NOTES_DEEP_ROOT`. Nothing in it writes to the folder: `open_workspace` reads,
and the case probe is read-only by construction (scope §2.3).

```
root:              /home/samir/x
open_workspace:        0.42 ms
list root:             0.17 ms   (44 entries)
start_watch:           0.17 ms   (degraded: None)
quick_open first:      0.05 ms   (0 matches, building true, 0 indexed)
to a usable tree:      0.59 ms
watch walk done:    7258.65 ms   dirs 49937 · unreadable 1 · over_limit 0
index done:        15756.08 ms   (56622 notes, 1 unreadable)
```

Over two minutes to **0.59 ms**. The two walks that used to cost it are 7.3 s
and 15.8 s of background work, with the window usable throughout.

The `unreadable: 1` is `.../www/web1/ead` — the directory whose
`Permission denied (os error 13)` was in the banner. It is a number now; it used
to stop the workspace being watched at all, and to make `quick_open` return
nothing for the whole folder.

`over_limit: 0` because this machine's `max_user_watches` is 1 048 576 and the
folder needs 49 937. A default Linux ships 8 192 or 65 536, where the same
folder leaves tens of thousands over the limit — the state the banner exists to
name, and the one thing in this milestone that nothing has exercised.

56 622 notes indexed under `~/x`, most of them inside `node_modules/`. That is
D-08's argument as a number: hiding the folder by name would hide all of them.

## 0.11.4 - the walk is actually cancellable, and the numbers moved to the banner

Two gaps between what ADR-034 says and what 0.11.0 shipped.

**"Cancellable" was true of the quick-open index and not of the watcher.**
`PathIndex` stops when it is dropped; the watcher's walk ran to completion
whatever happened to the `Watch`, so closing a workspace or opening another left
a thread installing inotify watches on a folder nobody had open — minutes of it
on a large tree. `add_watches_below` now checks the stop channel once per
directory, which is the granularity it already works at.

Asserted by what it does rather than by a thread's death, which is not
observable: `Watch::counters()` hands out the live counters, the test drops the
`Watch` three directories into an 8 000-directory walk and reads the count it
stopped at. Removing the check again fails it — *"the walk stopped where it was
rather than finishing: 8001 directories"*.

**The over-limit and unreadable counts moved from the status bar to a banner.**
The rule the milestone set is that a full watch table degrades only the excess
and **says the number**; a count in the corner of a status bar is not something
a user can act on. The banner names how many directories did not fit and the
`sysctl` that raises the limit, and separately how many folders could not be
read. What stays in the status bar is the walk's progress, which is transient
and gone the moment it ends — the one reading that would be noise as a banner.

## 0.11.3 - two tests that asserted about the runner instead of the code

The 0.11.0 criteria were green here and red on two of the four CI platforms, and
in both cases the test was wrong rather than the code.

**Arch, as root.** The container job runs the suite as root, and root reads a
mode-000 directory anyway — `CAP_DAC_OVERRIDE`. A test about *skipping an
unreadable directory* has nothing to exercise there, so it asserted that a
directory it could read had been skipped. It now probes first —
`permissions_are_enforced_here()` creates a mode-000 directory and checks
whether reading it actually fails — and skips with a reason when it does not.
A uid check would have been the same test written to guess; this asks.

**macOS.** `an_unreadable_directory_does_not_demote_the_workspace` asserted the
per-directory counters, which 0.11.1 made Linux-only on purpose: FSEvents
watches the subtree from one handle and never reads the tree, so it cannot meet
an unreadable directory. The half that is universal — the workspace is still
watched, `degraded` is `None` — stays universal; the counting is guarded.

The two edits that missed in 0.11.1 missed for one reason: they were written
against the file as it read before `cargo fmt` split the assertions across
lines, and the replacement was made without checking that it had matched.

## 0.11.2 - the Linux release: .deb, AppImage, tarball and an AUR package that was actually built

`ARCHITECTURE.md` §15 has described this since 0.1a and none of it existed.
Now it does, and all of it was run before it was committed.

**`build.yml`** builds the artifacts and attaches them to the Release
`release.yml` already publishes. Two workflows on purpose: publishing a Release
must not wait on, or be failed by, a compiler — a broken build should leave a
Release with notes rather than no Release. The trigger is `workflow_run` rather
than `on: release`, because `release.yml` creates the Release with the built-in
`GITHUB_TOKEN` and GitHub fires no workflow events for what a `GITHUB_TOKEN`
did; an `on: release` job here would simply never have run.

**Linux**: `.deb` and AppImage from the Tauri bundler, on `ubuntu-22.04` rather
than `ubuntu-latest` — a `.deb` links against the glibc it was built on, so the
oldest supported runner is the widest audience.

**Arch** (ADR-023): `packaging/aur/notes-bin/PKGBUILD.in` plus
`gen-pkgbuild.sh`, and a job that runs a real `makepkg` in an `archlinux:latest`
container against the tarball the previous job produced — then installs the
package and checks `ldd` resolves. Not a lint of a PKGBUILD: a package that
builds nowhere but the maintainer's machine is not a release target. The
tarball is unpacked from the `.deb` rather than assembled, so the `.desktop`
entry and the icon set are the ones the bundler produced and not a second copy
that drifts.

**macOS and Windows are written and disabled** (ADR-024), each behind `if:
false` with the list of what is missing: an Apple Developer membership and a
Developer ID certificate for notarisation; an OV code-signing certificate for
SmartScreen. Neither is engineering. A job that does not exist is a job nobody
can cost.

**ADR-035 — the version is stamped, not maintained twice.** `tauri.conf.json`
said `0.1.0` while `version.md` said `0.11.1`; a package attached to Release
`0.11.1` calling itself `0.1.0` cannot be matched to the code that produced it.
`tools/stamp-version.sh` writes `version.md`'s version at build time, the
committed value is `0.0.0`, and CI and `tools/check.sh` both fail on anything
else. The `PKGBUILD` is generated the same way, checksum included.

Two things the first build got wrong and this one does not: the binary was
installed as `usr/bin/notes-app` — the crate name, an artefact of the workspace
layout rather than the name of the program — fixed with `mainBinaryName`; and
`Depends:` listed `libwebkit2gtk-4.1-0` and `libgtk-3-0` twice, because Tauri
already derives them.

Verified end to end on this machine before committing: the `.deb` builds and
carries the right paths, the AppImage builds, the tarball unpacks from the
`.deb`, and `makepkg` in a real `archlinux:latest` container built, installed
and resolved a `notes-bin` package from a binary compiled on Debian 13.

## 0.11.1 - native_id on Windows, and the watcher stops being one shape for three platforms

**D-24 closes.** `native_id` returned `None` on Windows from 0.1a because the
standard library's `volume_serial_number` and `file_index` are behind the
unstable `windows_by_handle` feature — the Windows job did not fail a test, it
failed to build. It now reads the same two numbers through
`GetFileInformationByHandle` (`windows-sys`, one target-gated dependency, one
call): `access_mode(0)` so a file another process holds open still answers,
`FILE_FLAG_BACKUP_SEMANTICS` so a directory can be opened at all, and
`FILE_FLAG_OPEN_REPARSE_POINT` so a symlink reports its own identity rather
than its target's — matching the `symlink_metadata` the rest of `Stat` is built
from. `Caps::LOCAL.native_id` is `cfg!(any(unix, windows))`, which is what
`ARCHITECTURE.md` §11's matrix has promised for NTFS all along.

Because the id costs an opened handle on Windows, it is filled in by `stat` and
**not** by `list`: `Entry` carries none, and identity correlation asks one path
at a time. Seven tests in `crates/notes-fs/tests/identity.rs` run on all three
platforms in CI — the capability agrees with the value, a rename keeps the id,
identical bytes do not share one, a directory has one, and an atomic replace
produces a new one and says so in the `Stat` it returns.

**And a correction to 0.11.0.** That commit moved the watcher to one watch per
directory on every platform. That is right on Linux, where an inotify descriptor
covers exactly one directory and `notify`'s recursive mode is a walk it does for
you. It is wrong everywhere else: FSEvents watches a subtree from one handle and
`ReadDirectoryChangesW` takes a `bWatchSubtree` flag, so the walk would have
replaced an O(1) call with 20 000 kernel objects on the deep fixture and
hundreds of thousands on the folder that started all this — the same mistake as
the freeze, introduced by the fix for it.

`PER_DIRECTORY` is now `cfg!(target_os = "linux")`. The two hazards the walk
handles are Linux's too: a recursive add failing whole on an unreadable
directory is inotify enumerating, and `max_user_watches` is an inotify sysctl.
`WATCH_SKIP` applies only where there is a watch table to protect (D-10).

## 0.11.0 - the tree in under a second, and two walks moved off the critical path

Opening `~/x` — around 160 repositories with `node_modules/`, `target/` and
`.git/` — froze the Welcome screen for over two minutes, with a banner naming
one unreadable subdirectory. That is not a notes workload, and it does not have
to be: the application may not freeze on any folder.

**Measured first.** `tools/gen-deep.sh` builds the same shape — 20 962
directories, with a mode-000 directory and a symlink loop in it — and
`crates/notes-core/tests/deep.rs` times each step of opening it:

```
open_workspace:        0.70 ms
list root:             0.43 ms   (160 entries)
start_watch:         502.72 ms
quick_open first:    549.88 ms
to a usable tree:      1.13 ms
```

The tree costs a millisecond on 21 000 directories, because it is lazy. The
freeze was `start_watch` and `quick_open`, each walking the whole tree inside a
`#[tauri::command]` holding `Mutex<WorkspaceService>` — so `tree_list` did not
run slowly, it did not run at all until they finished. The fixture also found a
second bug that had nothing to do with time: with the mode-000 directory in
place, `quick_open` returned `Err(PermissionDenied)` for the entire workspace,
and `notify`'s recursive add did the same to the watcher, demoting the whole
folder to polling because of one directory.

**The rule, now an acceptance criterion (ADR-034).** `workspace_open` returns and
the tree appears in under one second at any size. Everything that needs the whole
tree runs on its own thread, is cancellable, and reports progress to the status
bar: the watcher's per-directory walk (`notes-fs::watch`) and quick open's path
list (the new `notes-core::index`). Both use an explicit stack and
`symlink_metadata`, so a symlink loop cannot be entered. Both count and skip a
directory they cannot read. A full watch table degrades **only the excess** —
the watches already installed keep working, the remainder is counted, and the
banner names the number and the `sysctl`.

`quick_open` now returns `QuickOpen { matches, indexed, building, unreadable }`
and answers from a partial index while it fills; the palette says *"still
indexing — N notes so far"* rather than "nothing matches". The status bar shows
the watcher's coverage while it walks.

**`node_modules/` and `target/` do not go into the default ignores** (D-08). They
hold real Markdown, and hiding a folder by name is the application deciding which
of the user's files are real. They go into the watcher's skip list instead, which
is a different list answering a different question — a watch is a finite kernel
resource, visibility is not. Changes inside a skipped directory still arrive
through the 5 s scan.

Three new automated criteria, in CI rather than behind `--ignored`, over a corpus
each test builds: the tree under a second on 2 160 directories; `start_watch` and
the first `quick_open` each returning in under a fifth of the walk they replace,
over 7 200 directories. The assertion is a ratio against the walk measured in the
same test rather than a millisecond budget, because at this size a synchronous
walk costs ~30 ms and any absolute budget worth writing would let it through.
Both were verified by putting the regression back: the inline walk fails them.

`fixtures/large` could never have caught this. It is 10 000 notes, flat, and
lists in 37 ms. The axis that broke was directories.

## 0.10.3 - milestone 0.0 closes on this machine, and the queue drops three rows

The owner ran it without the environment variable and then **switched the failure
back on**: with `NOTES_NO_DMABUF_WORKAROUND=1` the GBM error returns. That was
the control the Debian section was missing — until it was run, "the workaround
fixed it" was inference, and now the failure has been turned off and on again.
The section is closed.

Three rows leave `.continue/`. Dependabot #1 was merged at `0.9.6`, and
`PROGRESS-0.1b.md` describes where a milestone stopped that shipped at `0.9.0` —
both were items the `QUEUE-RULE` says should have gone with the commit that
carried the work. The repodocs skeleton defect leaves for a different reason: it
is **not this repository's item**. It is a defect in repodocs' skeleton, fixed
here at `0.1.0` and still shipping from there to every new repository, so it is
recorded in "where things went" pointing at the repository that can fix it rather
than sitting in a queue that cannot.

## 0.10.2 - the record catches up with the cause

Three documents said something the run at `0.10.1` disproved.

**ADR-033** amends ADR-022. The Wayland half of its condition was wrong, and the
log is quoted in full as the evidence rather than summarised. It records what the
change costs — every Linux machine with the proprietary driver now turns the
DMA-BUF renderer off, X11 included, which is a real performance cost on hardware
where the bug may never have shown — and why that is the right side of the
trade: applying it needlessly is slower compositing, not applying it is no
window. It also says what it does **not** claim: whether the original Wayland
black-window reports share this mechanism is not established, and ADR-022's
account of those is left standing.

**D-20 is marked resolved and wrong.** Its reading — a GTK file chooser taking
its parent down — fitted the evidence and was not the cause, and the reason is
named: every run behind it had `WEBKIT_DISABLE_DMABUF_RENDERER` already exported
in the owner's shell, so the workaround never ran and its absence could not be
observed. A masked symptom produces a plausible mechanism. The GTK hypothesis and
the portal workaround are left as written rather than edited away, because a
decision log that deletes its wrong turns stops being evidence of how the
conclusion was reached.

**`SPIKE-0.0.md` had a fabricated line.** It reported `nvidia false` for this
machine and concluded criterion 1 could not be exercised here. The machine has a
GTX 1060 with all four proprietary modules loaded and `/proc/driver/nvidia/version`
present; the detection said `true` all along, and what was false was the
document. It had been written from expectation rather than from a run, and that
is the failure mode the whole spike document exists to prevent.

Debian 13 / X11 / NVIDIA is now a checklist section of its own with both boxes
answered — the failure reproduced with the old rule, and fixed by the new one —
plus one box left open on purpose: turning the workaround `off` should bring the
failure back, and until someone sees that, "the workaround fixed it" is inference
rather than observation. The Arch boxes stop asserting `session wayland`, since
the session is reported and no longer required.

`ACCEPTANCE-0.1b.md` and `ACCEPTANCE-0.1c.md` are untouched, as instructed.

## 0.10.1 - the dmabuf rule required Wayland, and the failure never did

The window that disappeared on *Open Folder* was found, and it was not the file
chooser. Run without the environment variable that had been masking it, on
Debian 13 / X11 / NVIDIA:

```
[notes] dmabuf: not needed — session is not wayland
src/nv_gbm.c:288: GBM-DRV error (nv_gbm_create_device_native): …failed (ret=-1)
KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied
Failed to create GBM buffer of size 1100x720: Permission denied
[notes] window main: close requested
[notes] window main: destroyed
```

**The workaround declined to apply, and one line later the reason it exists
happened.** WebKitGTK has used the DMA-BUF renderer on **X11 since 2.42**; the
fault is in NVIDIA's GBM, not in a compositor, so requiring Wayland was checking
the wrong thing. `decide` no longer takes the display server at all: on Linux,
the proprietary NVIDIA driver is the whole condition.

`nouveau` does **not** count, and the function says how it is told apart rather
than matching a name: `/proc/driver/nvidia/version` is created by the
proprietary kernel module and by nothing else, `/sys/module/nvidia/` is that
module's own sysfs directory while nouveau's is `nouveau`, and `nvidia-smi` is a
weaker hint that nouveau never ships. Nouveau's GBM works, and turning the
renderer off there would cost compositing performance for nothing. It is reported
in the diagnostics beside the proprietary flag, so the panel shows which one is
loaded.

The six tests become nine, and the one that mattered flipped: *"skips X11 even
with NVIDIA"* — an assertion of the bug — is now **"applies on X11 with
NVIDIA"**. `session_kind()` keeps a test of its own because the diagnostics still
report it; it just no longer decides anything.

Verified on the machine that produced the failure, without the variable:
`dmabuf: applied — proprietary nvidia driver detected`, no GBM error, and the
window renders.

**Two of this repository's own claims were wrong and are corrected by it.** The
instrumentation added at `0.9.5` is what named the event — `close requested` then
`destroyed` — and D-20's reading of the evidence, that a GTK file chooser was
taking its parent down, was a plausible mechanism built on a false premise: the
run that produced it had the variable set, so the workaround never ran and the
comparison was never made. And `docs/SPIKE-0.0.md` recorded *"nvidia false"* for
this machine, which has a GTX 1060 with the proprietary modules loaded — that
line was written from expectation rather than from a run.

## 0.10.0 - milestone 0.1c ships, and the MVP desktop is complete

`0.1a + 0.1b + 0.1c` is the desktop MVP of `SCOPE_final.md` §17.

**Both criteria are met, and both were measured rather than asserted.** The first
result over 10 000 notes and 197 MiB arrives in **11.4 ms** against a ceiling of
500 ms, and cancelling returns in **650 ns**. The restart criterion is automated
on both sides of the IPC, because it spans both: five tests in `notes-core` prove
tabs, the active tab and the cursor survive a restart through a *different*
service over the same data directory, and twenty in the store prove it puts them
back.

Three decisions are promoted to ADRs:

**ADR-030** — tabs are a list *beside* the editor, not a second document model.
The editor holds one loaded document and all of 0.1a and 0.1b is written against
that: the write protocol, the stale-save guard, the draft rules, the conflict
state. Making it hold a map to gain a tab strip would put every one of those back
in play for a navigation feature, when two notes are never visible at once. The
cost is stated: switching tabs re-reads from disk, and the moment two documents
must be visible the decision is to be revisited rather than worked around.

**ADR-031** — global search is a scan the core owns and the frontend **polls**,
the same way it polls reconciliation. `ARCHITECTURE.md` §7.2 had sketched events;
two delivery mechanisms for two streams of the same kind is one more than this
application needs. And the scanner does not retire when FTS5 arrives: §10
requires literal, words and regex to keep their names, and the index only takes
over *words*.

**ADR-032** — quick open matches a cached path list that the tree invalidates.
Walking 10 000 notes is fine once and ruinous per keystroke; a stale list offers
a note that is not there, so every create, rename, move, duplicate, delete and
reconciliation tick drops it. Coarse on purpose.

**`notes-index`, SQLite and the `registry.db` move are not here**, and that was a
stop rather than a preference. The instruction that opened the milestone asked
for them; §17 puts them at 0.2, §10 says the 0.1c search is a scan and that FTS5
takes over word search at 0.2, and **ADR-015 is `ACTIVE`** saying the registry
moves at 0.2. Building them would have contradicted an ACTIVE ADR and made this
milestone's own search criterion untestable as written. `DECISIONS-0.1c.md` D-01
records it with the alternative: an ADR superseding ADR-015 and an edit to the
scope, in that order.

One gap the acceptance document found before a user could: **C8 says clicking a
search hit opens the note *at that line*, and the panel only opened the note.**
Writing the row first is what surfaced it. `openAt` now sets the target before
the note opens — so a fresh view mounts on it — and bumps a counter for the case
where the note is already on screen and the view will not rebuild.

`ACCEPTANCE-0.1c.md` has existed since the milestone's first commit with its
thirteen interface rows, **and not one of them is ticked.** A screenshot showed
tabs, the active tab, the workspace and Split all restored from a seeded session;
that is written down as evidence and explicitly not as a tick, because a caret
position is not visible in a screenshot and nobody has clicked anything.

## 0.9.11 - tabs, quick open, workspace search, the command palette and settings

The interface half of milestone 0.1c.

**Tabs are a separate store, and that is the decision worth stating.** The editor
holds exactly one loaded document and all of 0.1a and 0.1b is written against
that; making every consumer tab-aware to gain a tab strip would put the write
protocol back in play for a navigation feature. So the new store owns the *list*
and the editor keeps owning the *document*. A tab carries only what has to
survive a restart — path, identity, cursor, scroll — and the buffer stays where
it was.

Leaving a tab is not a new rule either: a dirty note is **flushed** and a note in
conflict writes its **draft** instead, which is what `ARCHITECTURE.md` §5 already
says happens when a buffer stops being looked at.

The cursor is the part of the restart criterion that is easy to lose, because it
can only be applied *after* the editor has mounted the document — a position in a
document that does not exist yet means nothing. So the editor reports the caret
on every selection change and asks the tab store for one when it builds a view,
and the store suppresses reports while a restore is in flight so a freshly
mounted editor does not overwrite the position being restored.

**Quick open and the command palette are one surface**, because filter-arrow-
`Enter` over different rows is one interaction. **Global search is not**, and is a
panel rather than a modal: its results are something you work through, not
something you pick from. It polls the core the way reconciliation does, and says
two things out loud that scope §10 requires — that it reads **what is on disk**,
with an explicit warning when the open note has unsaved changes, and that a
truncated list is the first N rather than all of them.

Settings apply as they are changed, with no Save button, for the same reason a
note has none: a panel that can be closed with unsaved changes is a way to lose
them. Font size, line numbers, wrapping and tab size are CodeMirror *extensions*,
so each one rebuilds the view — they are in the effect's dependency list rather
than applied to a live one, which is the honest way to say it.

Thirty-eight new strings, in both catalogues, and CI still fails if they diverge.

## 0.9.10 - milestone 0.1c starts with search in the core, and its acceptance document

**First result in `fixtures/large` in 11.4 ms, cancel in 650 ns** — two orders of
magnitude under the criterion, measured over 10 000 notes and 197 MiB.

The shape is what makes it hold rather than the language: the walk is parallel,
hits are pushed **as they are found** instead of collected and returned at the
end, and every worker reads the cancel flag before each file — so cancelling is
bounded by one file, not by the workspace. Dropping a `Search` cancels it, which
is why typing a second query cannot leave the first one scanning 197 MiB for
nobody.

Quick open is deliberately a **different thing** and not a cheap query over the
same scanner: it matches paths from a list held in memory and never opens a
file. The list is built once and dropped whenever the tree changes shape — every
create, rename, move, duplicate, delete, and any reconciliation that saw a file
appear or vanish. Rebuilding it for ten thousand notes costs tens of
milliseconds, which is fine once and ruinous per keystroke. Its scoring is small
and explainable rather than clever: a subsequence, a bonus for consecutive
characters and for landing at the start of a segment, and the file name ranked
ahead of the directory, because `Ctrl+P` is how someone reaches for a file they
can name.

Sixteen tests cover what the timing does not: a literal query is **not** read as
a pattern (`(a.b)` finds `(a.b)`), regex mode is separate and named, case
sensitivity is opt-in, an invalid pattern is refused instead of scanning for
nothing, only notes are searched, `.git/` is never a hit, and — scope §10 —
**search reads the disk, so a buffer typed and not saved is not reported as
found.** A test asserts exactly that, because it is the fact the interface has to
tell the user rather than let them infer.

`docs/ACCEPTANCE-0.1c.md` exists **from this first commit**, with its "verified
in the running app" section already written and **thirteen rows, none ticked**.
0.1b shipped five green criteria over six dead flows because every criterion was
an assertion about the core; a section that only appears once the work is
finished is a section that agrees with whatever was built.

`notes-index`, SQLite, FTS5 and the `registry.db` move are **not** in this
milestone. §17 puts them at 0.2, §10 says the 0.1c search is a scan and that FTS5
takes over word search at 0.2, and ADR-015 is `ACTIVE` saying the registry moves
at 0.2. The acceptance document says so where a reader will look for it.

## 0.9.9 - the contracts job ran a suite twice and threw away the reason it failed

CI went red on `contracts` while `rust (ubuntu-latest)` — which runs the same
tests properly, with system dependencies and a cache — went green. The failure
was `notes-core --test reconcile`, and the log said nothing beyond *"test
failed"*, because the step ends in `>/dev/null`. **A step that discards its
output has thrown away exactly the thing that is worth having at the only moment
it matters**, and I wrote that line.

The output is kept now. And the step stops running the integration suites at all:
its purpose is to regenerate the TypeScript and diff it, `#[ts(export)]` emits
its writer as a **lib** test, so `--lib` still produces all fifty-one types.
Running the integration tests there duplicated a job that already exists and
bought nothing but a second chance to be flaky — which is what it spent.

The `reconcile` suite passed eight consecutive runs locally, so what is fixed
here is the duplication and the missing diagnostic, not the flake. If it is real
it will now surface in the job built to run it, with output attached. The likely
mechanism is written down rather than guessed at in silence: those tests assert
against a self-write expectation with a **two-second wall-clock TTL**
(`reconcile.rs`), and a cold, loaded runner is where a wall clock in a test first
disagrees with the machine that wrote it.

## 0.9.8 - what the acceptance document could not see: the interface

Every 0.1b criterion is an assertion about `notes-core`, and all five were met
while **six flows of the same milestone were dead** behind a dialog the WebView
does not have. A criterion satisfied in the core says nothing about the
interface. `ACCEPTANCE-0.1b.md` now has a section that says so and keeps the two
apart.

**Six things are marked verified**, because they were watched on screen on
Debian 13 / X11: the Welcome screen paints, the last workspace restores with no
dialog at all, the tree lists and marks notes from non-notes, a note opens into
CodeMirror with highlighting, **Split renders the preview beside the source** —
`notes-markdown` through the IPC, doing its job — and the status bar reports
`✓ saved`.

**Twelve are marked not verified, and none is ticked.** The six dialog flows, the
three view modes, the conflict compare screen, the three resolutions and in-file
search. The reason is the machine, not a judgement about the code: this window
manager will not raise the application window — `xdotool windowactivate` returns
`_NET_ACTIVE_WINDOW failed`, and `windowraise` and `wmctrl -a` do nothing — and
WebKit ignores synthetic input delivered to an unfocused window. **The window can
be photographed and cannot be driven.** Each step is written out so a person can
walk it, and an unticked box means a flow nobody has seen work.

`src/app/dialog.test.ts` closes the part a machine can: eleven tests over the
contract those flows depend on. That a request resolves at all; that cancelling
gives `null` for text and `false` for a confirm; that **the empty string survives
as an answer** instead of collapsing into a cancellation, which is what *move to
the workspace root* is; that the validator refuses before the core is asked; and
that a second request cancels the first rather than stacking, so no caller is
left awaiting a promise nobody settles.

Said plainly in the document, because it is the honest limit: a dialog that
resolves correctly and never renders passes every one of those tests. The
machine-checkable half is checked; the other half needs eyes.

## 0.9.7 - the other five checkouts the Dependabot PR could not have seen

`#1` was opened at 18:42 on 07/09 and `ci.yml` was written at `0.7.0`, two hours
later. So merging it bumped `release.yml` and left the five checkouts in the file
that did not exist yet — the repository ended with two versions of one action,
which is worse than one old version because nothing reports it.

## 0.9.6 - the three things milestone 0.1a left in the queue

Housekeeping, and one of the three is a rule this repository wrote about itself
and then broke.

**The scaffold row leaves the queue.** *"Scaffold milestone 0.1 — the Cargo
workspace, `apps/notes-app/`, the first crates"* has described something that
exists since `0.7.4`. The `QUEUE-RULE` says a document leaves when the thing it
describes exists, and that removing it is **the last step of the commit that
carries the work** — never a step of its own. It became a step of its own because
`.continue/` was closed to that milestone's work, which is the right instruction
and this is its cost, paid late.

**`.continue/ARCHITECTURE.md` says on its first line that it is superseded** and
names `docs/ARCHITECTURE.md`. It opened with *"PROPOSTA, aguardando revisão"* —
a document that had been answered months of commits ago still asking to be read
as current. Kept rather than deleted, because it is where the questions were
asked and its §5 is the list the live document answered; a status line is the
difference between a record and a trap.

**Dependabot #1 is merged**: `actions/checkout` 5 → 7, open since the repository
was created.

## 0.9.5 - the window that vanishes: instrumented, and one wrong claim withdrawn

The owner clicked *Open Folder…* and the window disappeared. The process exited
**`0`** with an empty `stderr` — so **not a crash**: no panic, no signal. Tauri
ends its loop when the last window is gone, which means the window was destroyed
and the application shut down normally. That is what a parent following its child
dialog down looks like from outside.

The dependency tree agrees with that reading and is stated as evidence rather
than as a conclusion: `ashpd` is absent, so `rfd` is on the **GTK3 backend**, not
the portal; it pulls `raw-window-handle`, so the chooser is parented
`transient-for` to the Tauri window; and the XDG portal is installed and running
on this machine but unused. A GTK3 chooser parented to the `GtkWindow` that hosts
the WebView, in one main loop.

**It did not reproduce, and an earlier claim that it had is withdrawn here.** The
window manager refuses to raise the window — `xdotool windowactivate` returns
`_NET_ACTIVE_WINDOW failed`, `windowraise` and `wmctrl -a` do nothing — so
synthetic clicks were landing on whatever was in front. Two runs that opened the
chooser programmatically both survived. A mechanism consistent with the evidence
is not a proven one, and swapping the dialog backend to fix a failure that cannot
be triggered on demand leaves nothing to verify against.

So the deliverable is the instrumentation: the window lifecycle is logged, and
`CloseRequested` and `Destroyed` answer different questions that are
indistinguishable from outside the process — something *asked* the window to
close, or it was destroyed outright. The next occurrence names which. The
workaround is written out in `docs/DECISIONS-0.1b.md` D-20 with its costs, so it
is not rediscovered and not applied blind.

One finding invalidates a different test. The owner's shell already exports
`WEBKIT_DISABLE_DMABUF_RENDERER`, and `linux.rs` correctly refuses to override a
value the user set — every run logged *"left alone — already set"*. **Milestone
0.0's first acceptance criterion was not exercised by any of these runs**, and
`docs/SPIKE-0.0.md` now says to unset the variable before answering that box.

## 0.9.4 - the six flows behind a dialog the WebView does not have

`window.prompt` in five places and `window.confirm` in one: new note, new
folder, the workspace name, rename, move and delete. **Those are a browser's
blocking script dialogs, and the WebView this ships in is not a browser** —
WebKitGTK, WKWebView and WebView2 each answer somewhere between "does nothing"
and "blocks the WebView's own loop". Behind one of them a flow is dead without a
sound.

Six flows of the milestone that just shipped were behind one, and **no test could
have caught it**: every 0.1b criterion is an assertion about `notes-core`, and
these live only in the interface. `0.9.0` said it in one line — *nobody has
launched the window* — and it took launching it to find them.

They are replaced by the application's own modal: one surface, one at a time,
promise-based, Escape cancels and Enter confirms because those are the keys the
dialogs it replaces already taught. Focus moves in on open and **returns to
whatever had it on close**, since a modal that strands keyboard navigation is a
regression in an application that is keyboard-first. The text variant validates
before resolving, so an empty name is refused in the dialog rather than by a
round trip to the core.

The native file picker stays native. Choosing a folder is the operating system's
job, and that is the one dialog `@tauri-apps/plugin-dialog` should own.

**`tools/no-blocking-dialogs.sh` fails the build if they come back**, in
`npm run lint`, in `npm run build`, in `tools/check.sh` and in CI. It has **no
exclusions** — which is why the file that documents the ban does not spell the
tokens, rather than exempting itself. The rule was checked by putting one back:
it bit.

## 0.9.3 - the git hooks are regenerated from repodocs

Both hooks of the standard are rewritten from repodocs, and `tools/release.sh`
with them when it came from there. `commit-msg` checks the shape of the subject
(`X.Y.Z - description`), refuses a Conventional Commits prefix and a vague
message, **and checks that the subject's `X.Y.Z` is the version this commit
carries in `version.md`**. `pre-push` compares the local `version.md` against
the remote default branch for a repeated or a backwards version — **only when
the push actually updates that branch**, so a branch deletion, a tag and a topic
branch pass through.

The hook does **not** check the language and could not: what it measures is the
shape and the number.

Escape hatch, declared in both: `NOTES_NO_HOOK=1`. In a fresh clone, enable them with
`git config core.hooksPath tools/git-hooks`.

## 0.3.2 - the queue rule arrives as a regenerated block, and stops being local

This repository decided two things on the day its queue was emptied and
restored: an item leaves `.continue/` only when the thing has been built
([ADR-009](docs/decisions.md)), and the queue is written in Portuguese
([ADR-010](docs/decisions.md)). Both were written as **local exceptions**, placed
deliberately outside the marked echo blocks so a fleet pass would not erase them.

The fleet adopted both the same day, as ADR-021 and ADR-022 in
[samirhvbr/repodocs](https://github.com/samirhvbr/repodocs). What was an
exception is the norm, so keeping a local copy of it would be the thing the
standard forbids: one rule with two sources, and no way to tell which is stale.

The rule now arrives in the new **`QUEUE-RULE`** block — the single exit
condition, the definition of *produce*, the bound on the half-a-page rule that
authorised the deletion in the first place, and the sentence that is the actual
instruction: **never empty this folder as tidying**. `LANGUAGE-RULE` and
`COMMIT-RULE` are regenerated in the same pass; the language block now names
three carve-outs, the third being this queue.

Why the block matters more than the correction it carries: on 07/09/2026, of the
52 repositories in the fleet, **2** carried any version of the queue rule and
**35** never mention `.continue/` in their agent instructions. It had never been
an echo block — it lived in the skeleton's `CLAUDE.md`, which is copied once at
creation and never regenerated. This repository was created from that skeleton
hours before the fix, which is precisely why the fix had to become something that
travels.

The two local ADRs stay as the record of **where** the decision was made, each
carrying a note that the fleet adopted it. The block is the source if they ever
disagree. Two details this repository holds that the fleet rule does not spell
out survive in prose: `.continue/README.md` is the folder's index and stays
English, and writing the `docs/` page in English is part of checking that the
thing was actually built.

## 0.2.0 - record the product scope and roadmap in docs/

The scope arrived as a 1 338-line draft in `.continue/`, written in Portuguese.
Two rules in this repository say it cannot stay there: a queue item that needs
half a page belongs in `docs/` with a pointer left behind, and everything in the
repository is written in English (US). This commit lands the first half of that
conversion — [docs/product.md](docs/product.md) and
[docs/roadmap.md](docs/roadmap.md).

`product.md` is the definition: local-first, a user-chosen folder as the
workspace, `.md` files on the filesystem as the source of truth, one dark theme,
CodeMirror 6, Source/Preview/Split with Live Preview explicitly deferred, and the
list of what the first version does not do. The promise it exists to protect is
that the files belong to the user rather than to the application — everything
else in the document is downstream of it.

`roadmap.md` is the order: seven product milestones from a desktop editor to an
MCP server. Its ordering constraint is that **each stage is useful on its own** —
someone who stops receiving updates after the first one still has a working
Markdown editor. It also states in its own header that its stage numbers are
product milestones and not repository versions, because `0.3` there and `0.3.0`
in `version.md` are otherwise going to be read as the same thing.

This is a `Y` bump rather than a `Z`: the repository went from having no product
definition to having one, and every later decision is measured against it.

## 0.2.0 - record the architecture in docs/

[docs/architecture.md](docs/architecture.md), the second half of the scope
conversion. It opens with the layering rule — Markdown is the source of truth,
SQLite is index and cache, the server is sync, REST is integrations, MCP is
agents — because that is the rule every later proposal gets checked against, and
the two forbidden shapes (SQLite as the only copy of a note; a proprietary
format with a Markdown export bolted on afterwards) are written down as
forbidden rather than left to be inferred.

Two things in the draft contradicted each other and are resolved here. The
`apps/` + `crates/` + `server/` layout and the `src/` + `src-tauri/` layout are
not two proposals: the second is what lives *inside* `apps/notes-app/`. The page
states both levels together, and adds the rule that makes the split worth
anything — **the Rust logic lives in `crates/`, and `src-tauri/` stays a thin
shell with no business logic**, which is what lets `server/` reuse the core at
milestone 0.5 instead of extracting it under pressure.

The filesystem abstraction is documented as existing from milestone 0.1, when it
will have exactly one adapter behind it. That looks like premature generality, so
the page carries the reason inline: "a folder the user picked" is a desktop
concept that iOS does not have, and finding that out after the UI has been
written against local paths is a UI rewrite.

The sync section states the constraint that shapes the data model years before
sync is built — `modified_at` alone cannot synchronise anything, because clocks
disagree, filesystems round timestamps differently, and a restored backup
rewrites them all.

## 0.2.0 - record the founding decisions as ADRs

Eight ADRs in [docs/decisions.md](docs/decisions.md), replacing the skeleton's
template. They exist so that the expensive parts of the scope are not
re-litigated by the next session — each one carries the reason and, more
importantly, the cost.

ADR-001 is the load-bearing one: Markdown files on the filesystem are the source
of truth, with no proprietary format at any point. It is recorded with what it
gives up — sync gets harder, indexing must be incremental, writes must be atomic
because the file is the only copy — because a decision that lists only benefits
has not been thought through.

The rest: Tauri 2 over Electron and Flutter, with the platform-webview tax
stated; Rust logic in `crates/` with a thin `src-tauri/`, so `server/` can reuse
the core at 0.5 without an extraction under pressure; `.notes/` restricted to
data that can be rebuilt, with the "delete it — did the user lose anything they
wrote?" test that keeps it from silently becoming the proprietary store ADR-001
forbids; sync deferred but its identity model protected, because an app built on
path + `modified_at` cannot be given sync later, only rewritten; Git dropped as
a dependency; no network port opened by default, since an editor that quietly
listens on a laptop joining untrusted networks is not a default worth shipping;
and desktop before mobile, with the filesystem seam carried from 0.1 so that 0.4
is an adapter rather than a rewrite.

ADR-006 is the one that records a reversal: the project was first sketched as a
Markdown editor with a public Git repository attached, and local-first replaced
it. Written down as a decision rather than dropped, so the idea does not come
back as a suggestion.

Also fixes a section reference in `roadmap.md` that pointed at
`architecture.md#3` when the filesystem abstraction is §4 — stale in the same
pass that created it.

## 0.3.0 - an item leaves the queue only when it has been built

`0.2.1` put the deleted drafts back. This writes down the rule that would have
stopped them being deleted, because an override nobody wrote down is not an
override — it is a mistake waiting to be repeated by whoever reads the rules and
obeys them.

**[ADR-009](docs/decisions.md#adr-009--an-item-leaves-continue-only-when-it-has-been-built):
an item leaves `.continue/` when the thing it describes has been BUILT** — not
when it has been documented, decided, translated or written up. A queue note
reading "a black screen with a yellow ball in the middle" stays in the queue
until that screen exists and works. **Size is never a reason to move an item
out**, which is the second half of the override: the fleet rule sending a
half-page queue item to `docs/` is exactly the rule that was followed into the
`0.2.0` mistake, and a 1 300-line specification stays in the queue while its code
does not exist. And nothing leaves the queue before it has been committed — the
operational half, which would have made `0.2.0` cost a `git revert` instead of a
reconstruction from memory.

The ambiguity that caused it is one word, and the ADR names it: the fleet
convention says a document moves to the record when it describes "something that
already exists", and *exists* was read as the definition existing rather than the
thing existing. Under the first reading, describing something well is what makes
it real. The failure is worst on a new project and that is not incidental — on
day one everything is words and nothing is code, so a rule that retires an item
once its text is tidy retires the whole queue. Which it did: four open items to
zero, with no application code written.

Golden rules 1 and 2 in `CLAUDE.md`/`AGENTS.md`, the "how it works" list in
`.continue/README.md` and the "where a new document goes" table in
`docs/README.md` all said the old thing and now say this one, each pointing at
ADR-009. Three files repeating a rule is worse than one when they disagree, and
they disagreed with the owner's intent in the same direction, which is how the
mistake looked correct at every checkpoint.

This is a `Y` because an ADR that overrides a fleet convention now counts as one.
That trigger did not exist before this commit and is added by it — a repository
quietly diverging from the fleet is exactly the change that has to be visible in
the version history, and `Z` would have buried it.

## 0.3.0 - write the queue in Portuguese and translate on the way out

[ADR-010](docs/decisions.md#adr-010--continue-is-written-in-portuguese-everything-else-is-english):
`.continue/` is written in Portuguese, and translation to English happens at the
moment the material leaves the queue — which, per ADR-009, is the moment the
thing has been built. Everything else is unchanged and stays English (US):
`docs/`, commit messages, pull requests, issues, code comments, changelog
entries, release notes.

The queue is where the owner thinks before anything exists, and a second language
is a tax on precisely the part of the work least able to carry one. It was also
part of the `0.2.0` argument for emptying the queue — "it is in Portuguese" read
as a defect to fix rather than as the queue working correctly.

**The exception is written outside the `LANGUAGE-RULE` markers, and that placement
is the point of the commit.** That block is a marked echo regenerated from
repodocs; an exception written between the markers is erased by the next fleet
pass with nobody noticing, leaving a repository whose stated rule contradicts its
practice. The precedent is `BLUE3-INTRANET`, whose language exception sits
outside the block for the same reason. The new section says so in its own first
line, so that a later reader tidying the file does not move it inside.

`.continue/README.md` stays in English and now says why: it is the folder's
index, not queue material.

## 0.9.2 - the acceptance document says the matrix is green, because now it is

`ACCEPTANCE-0.1b.md` was written while CI was still red and said so: *"no CI run
exists for this milestone yet"*. The `0.9.1` fix made the matrix green on all
four platforms, which made that line wrong an hour after it was written. It now
says what happened, including that the Linux leg had been red since `0.7.5` —
scope §19's *"sem verde nos quatro, marco desktop não fecha"* is satisfied by
that run, not by a document claiming it.

## 0.9.1 - the ENOSPC test needed the one privilege the runner has

CI had been red on the Linux leg since `0.7.5`, and on that leg alone: Windows,
macOS, Arch, the contracts job, the frontend and the crash loop were green
throughout. The failing step was the full-disk test, with
`unshare: write failed /proc/self/uid_map: Operation not permitted`.

**It is the case the script already anticipated, arriving from the machine
nobody expected it from.** Ubuntu 24.04 ships
`kernel.apparmor_restrict_unprivileged_userns=1`, so a GitHub runner cannot
create the user namespace the test mounts its `tmpfs` in — and it is also the
one machine in this project with passwordless `sudo`. `tools/enospc.sh` now
tries both, in the order that needs the fewest privileges: the namespace first,
because that is what a developer runs and it leaves nothing mounted anywhere,
then `sudo -n mount -t tmpfs`. `sudo -n` never prompts, so a machine with a
password falls through rather than stopping the gate to ask for one.

**And a skip is now a failure where it matters.** `NOTES_REQUIRE_ENOSPC=1` is
set on the CI leg: a runner that lost both mechanisms would otherwise skip in
silence, which is precisely the failure mode D-01 was written to refuse two
versions ago — a check that quietly opts out is not a check.

**The lesson is mine and it is worth writing down.** Six commits went out
without the CI result being read, on the assumption that a green local gate
meant a green matrix. It did not, for a reason the local gate structurally
cannot see: the developer machine allows the thing the runner forbids. The
matrix exists for exactly that, and it is only useful if somebody looks at it.

## 0.9.0 - milestone 0.1b ships: search in the file, the acceptance document, and five ADRs

The last scope item and the record. `@codemirror/search` gives `Ctrl+F` and
`Ctrl+H` **on the buffer in front of the user** — which is why it searches what
is being typed rather than what is saved. Global search is 0.1c and is a
different thing entirely: it scans the workspace in the core, streams results
and is cancellable.

[docs/ACCEPTANCE-0.1b.md](docs/ACCEPTANCE-0.1b.md) puts each of scope §17's five
criteria against a named test or a documented manual step, and says plainly
where a criterion is met **in the core** and unobserved in the window. All five
are met; criterion 1 is qualified, because nobody has watched a tab update.

**262 Rust tests and 8 `vitest` cases.** The `fixtures/xss/` census renders every
payload under all four combinations of `raw_html` and `remote_images`, so adding
one is enough and forgetting to write a test for it cannot make it pass.

**What the preview IR costs, measured rather than argued.** Turning `Rendered`
into JSON is 6–9% of render-plus-serialise at any size a person writes and 18%
at the 5 MiB edge case: not where the time goes, and nothing was engineered
around it. What the profile *did* say is that the cost tracks element count
rather than bytes — 1 MiB of dense HTML costs about what 5 MiB of prose does —
and that is written down so the next person measures the right thing.

Five ADRs, for the decisions that outlived the milestone that made them:
**ADR-025** golden corpus, and why blessing is not accepting; **ADR-026**
reconciliation driven from what vanished, and a full scan that announces no
creations, amending ADR-014; **ADR-027** not being able to watch is a state of
the workspace rather than a failure; **ADR-028** a resolution keeps the version
it did not choose; **ADR-029** `mailto:` and every scheme but `http(s)` render
as text.

`docs/ARCHITECTURE.md` is `ACTIVE` for §§7–10 — they describe code that exists
now — and §17.1 gained four more rows where the implementation and the
Portuguese scope had to be reconciled out loud.

**What is not done, in one line: nobody has launched the window.** The
interface compiles, typechecks, bundles, and has tests over the one piece of it
that is logic rather than markup. Everything else about it is unobserved, and
`ACCEPTANCE-0.1b.md`'s *Not verified* section lists it item by item rather than
leaving it to be discovered.

## 0.8.5 - the watcher, reconciliation, and identity that survives an external rename

`ARCHITECTURE.md` §8 and §9 in code, and the last three 0.1b criteria that can
be asserted without a window.

**`stat`, then hash. Everything else is a hint.** A watcher event, a window
regaining focus, a tab switch and the 5 s poll all arrive at the same function
as *these paths may have moved, go and look*. Nothing believes an event; size
and mtime alone never conclude anything (scope §12), and reconciliation never
writes.

**The self-write filter is armed before the write, not after.** Otherwise there
is a window exactly as long as the write in which the application's own autosave
comes back as an external change. It is consumed on its first match and expires
after two seconds, so **someone else writing the same bytes right afterwards is
still seen** — there is a test named after that, because it is the half that is
easy to get wrong.

**Identity correlation is driven from what vanished.** §9 phrases it as
*"appeared := disk paths not in registry"*, which here is nearly every file —
the registry is lazy. Driving it from the vanished side computes the same answer
and costs nothing on every tick but one. Rule 1 is a unique native id, rule 2 a
unique non-empty hash — **a zero-byte file is never correlated**, because every
empty file has the same digest — and rule 3 is a new identity, because
re-identifying a note is cheaper than attaching one to the wrong history.

**Two design defects the tests found before the push.** A full scan reported
every note nobody had opened as `Created`, which on a real workspace means
announcing a thousand creations each time the window regains focus, and which
blew the hash budget with events that were not changes; `Created` is now a
hinted-path signal only (D-13). And the editor could not accept a reload at all:
the CodeMirror view is keyed on the note id, so replacing `doc.text` did nothing.
It now takes the new text in **one transaction** with the selection clamped and
kept — rebuilding the view would throw away the undo history and put the caret
at the top of a note the user was reading half-way down — and the transaction is
annotated so the update listener does not mark the buffer dirty and autosave
text the user never typed.

**Not being able to watch is a state of the workspace, not a failure.**
`watch()` returns a `Watch` with a `degraded` reason rather than an `Err`: a
network mount, a SAF tree and a kernel out of inotify watches all mean *poll
instead and say why*, and the inotify case says it with the `sysctl` that raises
the limit. The interface shows the reason and keeps working.

The hash budget is 50 files per tick with the rest queued, and a test asserts
the queue drains and that every change is reported **exactly once** — a budget
that silently dropped work would be worse than no budget.

`notify` 8.x, not the 9 release candidate, and the debouncer is ours (D-12).

## 0.8.4 - rename, move, duplicate and delete, and the identity that survives them

The four entry operations of 0.1b, and the criterion they exist to satisfy:
**a rename performed by the application never resets a tab.**
`ARCHITECTURE.md` §9 says a rename the app performs never enters identity
correlation — it updates the registry directly — and `Registry::repath` is that
sentence in code. Renaming a folder carries every note beneath it, because the
notes inside a folder someone renamed did not change and giving them new ids
would lose their history for a reason invisible to the person who did it. The
prefix test is on a path boundary, so `pasta2/` is not dragged along by a rename
of `pasta/` — a naive `starts_with` corrupts the registry silently, which is why
there is a test named after it.

**Duplicate never overwrites**, per scope §17: `create_new` throughout, a copy
gets an identity of its own because a new file is a new note, and the name is
`nome (copy).md` → `nome (copy 2).md`, in ASCII and the same in every language
(D-10). **Move refuses a collision and names what is in the way**, which is what
lets the interface ask rather than guess, and a folder cannot be moved inside
itself.

**Delete has a trash now**, and says which of the two things happened. `trash`
is a dependency from this commit; `caps.trash` decides whether to try, and a
failure — no bin on a removable stick, no session bus in a container — degrades
to a permanent delete with a *different sentence in the interface*, never a
silent one (scope §7.7, D-11). The notes leave the registry; **their drafts do
not**, because a note deleted while it held unsaved edits is precisely the case
where the draft is the only copy of them.

The tree grew a context menu for the four, and the frontend a `notice` channel
for a thing that went right — an error banner is the wrong shape for "moved to
the trash, so it can be put back".

**The Windows cross-check earned its place again.** `tools/check.sh` failed on a
`let mut f` that is only mutated inside a `#[cfg(unix)]` block: fine on Linux,
`-D warnings` on Windows, and invisible to every other step of the gate. That is
the third time this class of defect would otherwise have been found by CI, and
the first time it was found before the push.

## 0.8.3 - Source · Preview · Split, and the conflict screen 0.1a shipped without

The interface catches up with the core. `Ctrl+E` cycles Source → Preview →
Split, the mode is remembered per workspace in `session.json`, and the preview
renders through `markdown_render`.

**`innerHTML` is assigned in exactly one component, and the comment above it
says why.** The string came from `notes-markdown` behind `ammonia`; nothing else
in this application may assign it, and that component must never render a string
it did not get from that command. A click inside the preview never navigates: a
relative link opens the note in-app, an anchor scrolls, an `http(s)` link goes to
the operating system's browser through `shell_open`, which **checks the scheme
again in Rust** — the capability is what the WebView may ask for, and the check
is what the process will do. Blocked remote images are named in a banner with a
button that turns them on for this workspace, because a silent gap is worse than
a visible one.

**The comparison screen is the piece 0.1a left out.** The core suspended
autosave and wrote the draft; the interface said only that something had
happened. Scope §12's four resolutions are now all reachable — *comparar* as a
screen (`ARCHITECTURE.md` §17.1: it changes nothing on disk and reads two
strings the frontend already holds), and the other three as one call to
`conflict_resolve`. It reads the disk version with `note_reload`, which touches
no buffer, and shows the two side by side with the differing lines aligned.

**The diff is sixty lines of this repository's own**, for the reason
`notes-markdown` writes its own slugs: a dependency that changes how a diff
aligns changes what a user sees at the one moment they are deciding which
version of their work to keep. Common prefix and suffix are trimmed first, so a
one-line change in a 6 000-line note is cheap; past four million cells the
alignment is skipped and the differing middle is shown as one block, **loudly**,
because a window that stops responding at that moment is worse than a coarse
answer. Eight `vitest` cases hold it, and the one that matters asserts no line
from either version is ever lost. `npm test` joins the local gate and CI.

A mixed-EOL note now offers `note_convert_eol` in its read-only banner rather
than only explaining why it cannot be edited.

Two things were deliberately **not** done on the way past, and both are in
`docs/DECISIONS-0.1b.md`: the preview serves raster images only, because
"probably safe because of a browser rule" is not the same as safe by decision
(D-08); and `shell().open` stays deprecated rather than migrating to
`tauri-plugin-opener`, because that means a new dependency and a capability
edit, and scope §19 sends both to the owner (D-09, with the whole change written
out for whoever makes it).

## 0.8.2 - the three ways out of a conflict, each keeping the version it did not choose

Scope §12 lists four resolutions — *comparar · manter o meu · usar o do disco ·
salvar como `nome (local).md`* — and `ARCHITECTURE.md` §17.1 had already settled
that **compare is not one of them**: it changes nothing on disk and reads two
strings the frontend is already holding, so it is a screen rather than a
command. The other three are `conflict_resolve` now.

**The rule they share is the reason the module exists.** Resolving a conflict is
the one moment a user can lose a morning by answering a dialog quickly, so the
version they did not choose is written to `conflicts/` *before* anything else
happens: `KeepLocal` snapshots the disk and then overwrites it, `UseDisk`
snapshots the buffer and then throws it away, `SaveAsCopy` writes the buffer to
`nota (local).md` and leaves the note exactly as the other program wrote it —
numbered `nota (local 2).md` when that name is taken, because `create_new` never
overwrites and a second conflict has to have somewhere to go.

`KeepLocal` passes no `base_rev` to the write, deliberately: the user has just
been shown both versions and said which one wins, and re-checking the revision
there would refuse the very thing they answered.

**The removal case both ways.** A note deleted externally with a dirty buffer:
`KeepLocal` recreates it — the only circumstance in which this application
recreates a path it did not create, and only because the user asked — and
`UseDisk` accepts the deletion, keeps the buffer in `conflicts/` anyway, and
returns `NotFound` so the tab can close.

`note_convert_eol` arrives with them, and it is the one command in this
application that rewrites a file the user did not edit. It exists for one
situation: a mixed-EOL note opens read-only, and without a conversion the
application would be refusing to edit a file while offering no way forward. The
old bytes go to `conflicts/` first. It found a real trap on the way —
`TextProfile::detect` normalises `\r\n` only when the *whole* file is CRLF, so a
mixed file reaches the caller with its endings intact and the flattening has to
happen in the conversion itself.

`conflicts/` follows §4.3: `<NoteId>/<iso-ts>-<local|disk>.md` with a sidecar,
colons stripped from the timestamp because they are legal on ext4 and illegal on
NTFS. Resolved snapshots are pruned after `files.conflict_retention_days` (30,
`serde(default)` so an older `settings.json` still loads at schema 1), **`0`
means keep them** rather than delete them all, and the 200 MB warning says so
and deletes nothing — making room by throwing away the only copy of something a
user wrote is the failure the directory exists to prevent. An *unresolved*
conflict is a draft, and nothing prunes those.

`note_reload` and `note_close` land with them: reload re-reads from disk and
lets the caller decide when a buffer may be replaced, and close lifts the
suspension while **leaving the draft alone** — a draft outlives its tab.

## 0.8.1 - the preview IR crosses the IPC, and the measurement that says it may

`markdown_render`, `markdown_outline` and `markdown_trust_set` are commands
now, and `notes-asset://` is a registered scheme. That completes
`docs/ARCHITECTURE.md` §10 in code: **sanitized HTML crosses for the preview, a
slim `Document` crosses for the outline, and no AST crosses at all.**

**The asset scheme is a second entry point into the workspace, and it resolves
nothing itself.** The WebView has no filesystem capability, so a note that shows
a picture cannot reach for the file; the preview writes
`notes-asset://<workspace-id>/<relative/path.png>` and the handler in
`src-tauri/src/asset.rs` hands the path to `notes-core`, which applies the same
root jail as every command — the string check, then `notes-fs` re-resolving each
segment and refusing a symlink. `tests/preview.rs` proves that with a symlink out
of the root and asserts the file it pointed at is untouched. Only raster image
types come back; a `.txt` and a `.md` are both `Unsupported`, so the preview
cannot be used to read one note into another. Responses carry
`default-src 'none'; sandbox` and `nosniff`, and a failure has an empty body —
a message would say whether a path exists outside the root, and that is not a
question the preview is entitled to ask.

**Raw HTML and remote images are per workspace**, in the registry rather than in
the global settings: trusting the notes in one folder says nothing about
another, and the setting survives a restart because that is the only reason to
persist it at all.

**The serialisation cost was measured, not guessed** — `cargo test -p notes-core
--test cost -- --ignored --nocapture`. Turning `Rendered` into JSON is **6–8%**
of render-plus-serialise for anything of a size a person writes, and 18% for the
5 MiB edge case; it is not where the time goes, and nothing was optimised for
it. What the profile did show is that `ammonia`'s builder was being assembled
per render: 0.385 ms → 0.293 ms for a 337-byte note once it is built once. That
is a small number and it is stated small, because the point of measuring first
is being able to say which numbers are real.

## 0.8.0 - notes-markdown reads the two fixture corpora it was written against

`fixtures/xss/` was committed at 0.1a with a README calling each file *"an
assertion, not a sample"*, and nothing read it. This commit is the thing that
reads it, and the corpus it needed beside it.

**The fixtures came first, and that mattered.** `fixtures/markdown/` holds
seventeen inputs, each with the exact HTML and the exact `Document` it must
produce, compared byte for byte; `fixtures/markdown/README.md` states the
contract one row per file *before* any of it existed. The goldens are generated
with `NOTES_BLESS=1` and then **read against that table** — blessing is not
accepting (docs/DECISIONS-0.1b.md D-04). That reading caught four defects the
suite would otherwise have frozen as decisions: `outra.md#uma-secao` lost its
fragment; `<alguem@example.com>` was classified as a relative path and rendered
as a note link to a file with an `@` in its name; a refused image dropped its
alt text; and a bare `https://…` in prose was not linkified, which scope §8.1
lists among the GFM features. All four are fixed and pinned.

**The XSS corpus is now a census.** Every `.md` in `fixtures/xss/` is rendered
under all four combinations of `raw_html` and `remote_images` and checked
structurally — tags and attributes read back out of the sanitized output, never
substrings. `safe-in-code.md` is why: it must render `javascript:alert(1)` **as
text**, so a suite that greps for `javascript:` asserts the opposite of the
requirement. Adding a payload to the folder is therefore enough; forgetting to
write a test for it cannot make it pass. Each file also keeps a named test of
its own, asserting it was refused for the right reason and that the rest of the
note still rendered.

**Two layers, on purpose.** The rewrite pass in `url.rs` decides what every
destination may become — schemes, root escapes, the raster-only `data:`
allowlist that excludes `image/svg+xml`, remote images blocked and named rather
than silently missing. `ammonia` then applies a closed allowlist that knows
nothing about notes, forces every `<input>` to be a disabled checkbox, and
permits exactly three `style` values, on table cells only. A mistake in one has
to coincide with a hole in the other to reach a user.

**`mailto:` renders as text**, and so does an email autolink. Scope §8.4 says
*"outros esquemas recusados"*, and `shell:allow-open` is restricted to `http`
and `https` — a `mailto:` anchor would be a link that does nothing when clicked.
Widening that capability is the owner's act, not the renderer's (D-06).

**One 0.1a defect surfaced on the way and is fixed here.** `RelPath::root()`
serialises to `""` and `TryFrom<String>` refused `""`, so the type could not
deserialise a value it produces. `tree_list` takes a `RelPath`, and the
frontend's `ROOT` is that string: every listing of the workspace root was
rejected by argument deserialisation before the command body ran — the sidebar's
first call on every launch. `parse` still refuses an empty name; only the wire
form accepts it (D-05). Three tests hold the line.

`docs/ARCHITECTURE.md` §10 is rewritten to describe what was built rather than
what was proposed. The generated-types check now covers `notes-markdown` and asks
two questions instead of one — `git diff` for a changed file and
`git ls-files --others` for an untracked one — because a type introduced by a
new crate arrives untracked, which is how eight new `.ts` files stayed invisible
to a green gate.

## 0.7.5 - the debt 0.1a left: the Windows check runs by default and the full disk is automated

Three things 0.1a left behind, cleared before any 0.1b feature so that the
milestone starts from a gate that is actually closed.

**The full-disk criterion is automated, and it is the one that mattered.**
[ACCEPTANCE-0.1a.md](docs/ACCEPTANCE-0.1a.md) §5 read *partly met*: `IoKind`
classified errno 28 in a unit test, but nothing exercised the path from a
filesystem that is really out of room to a visible error and a recoverable
buffer — the two steps in that gap being `write_atomic` returning `Err` at the
right moment and `settle` writing the draft instead of propagating. The document
called automating it "a decision about CI privileges", because the manual recipe
wanted `sudo mount -o loop`. It does not need one: an **unprivileged user
namespace** can mount a `tmpfs`, and a size-capped `tmpfs` over its limit returns
ENOSPC exactly as a full disk does. `tools/enospc.sh` builds that namespace and
runs `notes-core`'s `tests/enospc.rs` inside it, in the local gate and on the
Linux leg of CI, with no privileges at all and no mount left behind anywhere.
The test asserts the whole path: `WriteFailed { kind: DiskFull }` rather than an
`Err`, the note byte-identical afterwards, no `.tmp` left in the user's folder,
the draft holding the buffer verbatim, and reopening the note offering it back.
Criterion 5 is now **met**; the reasoning and the loopback alternative it
displaced are [DECISIONS-0.1b.md](docs/DECISIONS-0.1b.md) D-03.

**The Windows cross-check runs by default.** `tools/check.sh` gained it at
`0.7.3` and then skipped it whenever `x86_64-pc-windows-gnu` was not installed —
so the one check that would have caught both Windows compile failures was
missing on exactly the machines that had never added the target. It now installs
the target once and runs. `NOTES_NO_WINDOWS_CHECK=1` opts out deliberately; a
machine with no `rustup` gets a loud warning rather than a failed gate, because
refusing to run the test suite over a cross-compilation concern trades a real
check for a hypothetical one (D-01).

**And the queue index points at a file that exists.** `.continue/README.md`
linked `ARCHITECTURE.md` at the repository root, where it has never lived. That
is a pointer, not queue material — the README says of itself that it is the
folder's index — so repairing it is not the tidying the queue rule forbids
(D-02).

`docs/DECISIONS-0.1b.md` opens with these three, in the same shape the 0.1a log
uses: what was decided, which gap it closed, and what to do instead if the owner
disagrees.

One stale transcript went with them: `ACCEPTANCE-0.1a.md` §3 still quoted 22
edge-case files saved unchanged, from before D-20 and D-23 removed the names no
target filesystem could hold. The corpus is 21 files — 17 saved unchanged, 4
read-only — and 227 in total across both corpora.

## 0.7.4 - the CI matrix is green on all four platforms

Ubuntu, macOS, Windows and Arch, plus the contracts job, the frontend and the
1000-round crash loop. `docs/ACCEPTANCE-0.1a.md` said the matrix had not run;
now it has, and what it found is written down there as a table.

**Not one of the four rounds was a failing test.** Every problem stopped the
build or the checkout before a test could execute — an unclonable repository on
Windows, a corpus APFS cannot materialise, two compile failures behind `cfg`
walls Linux cannot see. That is the argument for the matrix in one line, and it
is why "it passes here" was never the same claim as "it passes".

What remains asserted rather than observed is narrower now: the suite runs on
ext4, APFS and NTFS, so §11's rows for SMB, NFS, exFAT and FUSE are the ones
still unproven.

## 0.7.3 - check the Windows target locally instead of discovering it in CI

The third CI round failed on Windows for the third time in a row, and for a
class of reason Linux cannot see: a helper used only under `#[cfg(unix)]` is
**dead code** on Windows, and `-D warnings` makes that a build failure. Not a
test failing — the crate does not compile, so nothing runs. Three symbols were in
that state (`IoKind`, `drafts_dir`, and two symlink tests that kept a fixture
they no longer used), each behind a `#[cfg(unix)]` block inside an otherwise
portable function.

They are fixed by making the whole test Unix-only where that is what it is,
rather than by threading `cfg` through a function body — which is also more
honest: `no_command_accepts_a_path_outside_the_root` was two tests, a string
half that needs no disk and a symlink half that does, and splitting them says so.

**`tools/check.sh` now runs the gate including
`cargo clippy --target x86_64-pc-windows-gnu`.** It costs one `rustup target
add`, type-checks without linking, and would have caught all three of these plus
the unstable-API failure at `0.7.2` — about thirty minutes of CI, found in
seconds. The step skips with a message when the target is absent rather than
failing.

123 tests; native and Windows targets both clean.

## 0.7.2 - the second CI run found two more, and both were the product

The first pass fixed the harness. This one is code and corpus.

**Windows did not fail a test — it failed to compile.**
`MetadataExt::volume_serial_number` and `file_index` sit behind the unstable
`windows_by_handle` feature, so `native_id` could never have built on stable.
It now returns `None` there and `Caps::LOCAL.native_id` is `cfg!(unix)`, which is
the degradation `ARCHITECTURE.md` §11 already specifies: correlation falls back
to the content hash and yields a new `NoteId` in more ambiguous cases — the safe
direction, and it costs nothing at 0.1a because nothing correlates yet. Doing it
properly needs `GetFileInformationByHandle` and belongs with its first consumer
at 0.1b.

**macOS found the general form of the trailing-dot defect.** Two more sets of
names cannot be materialised on APFS: `Duplicate.md` and `duplicate.md` are *one
file* on a case-insensitive filesystem, so git checks one out over the other and
the survivor reports as modified on a clean clone; and APFS normalises to NFD, so
the NFC name in the index and the NFD name on disk disagree, leaving one missing
and one untracked. Both pairs are gone from the committed corpus and are created
at runtime by tests that **ask the filesystem what it does** rather than assume —
the case test asserts a collision only where the root folds case.

The rule generalises, and is written down: a committed fixture must be
materialisable on every platform in the matrix. What tests a thing a filesystem
cannot represent is built at runtime.

That is three defects in two runs that only a real matrix could find, and two of
them made the repository unusable on a platform before a single test executed.
122 tests; `fmt`, `clippy -D warnings`, the workspace suite and the generated
types are all clean here.

## 0.7.1 - the CI matrix ran for the first time and found four real problems

Three were the test harness. **One made the repository unclonable on Windows.**

`actions/checkout` did not fail a test — it aborted:
`error: invalid path 'fixtures/edge-cases/trailing-dot.md.'`. A file whose name
ends in a dot cannot exist on NTFS, so git refuses the entire checkout. Every
Windows contributor's first command would have failed, and **no test could have
caught it, because no test ran.** The file is gone from the committed corpus; the
rule it covered is a unit test, and the "an existing odd name is listed, never
renamed" half is created at runtime by a test that skips on Windows.

That defect exposed a gap: scope §7.6 requires a **new** name to follow a
portable rule and nothing implemented it. `portable_name` now refuses
`\ / : * ? " < > |`, control characters, a trailing dot or space, and the Windows
device names — checked against what the user typed **before** `.md` is appended,
because otherwise `trailing-dot.` becomes `trailing-dot..md`: legal, and not what
they asked for. A name already on disk is still never touched.

The other three, each recorded with its alternative:

- **Arch** runs its container as root, and root ignores permission bits, so the
  denial the write-failure test needs could not be arranged and it observed a
  successful write. It now skips as root and says so. Asserting anyway would have
  made it pass for the wrong reason everywhere else and mean nothing there.
- **macOS** resolves `/var` to `/private/var`, so a temp directory has two names
  and the registry stores the resolved one; the test was comparing the name it
  handed in.
- **contracts** ran `cargo test --workspace`, which builds the Tauri application
  and needs GTK, WebKit and glib — on a job whose entire point is that it needs
  none of them. It now builds only the two crates that export types.

Ubuntu, the frontend and the 1000-round crash loop were green on the first run.

## 0.7.0 - milestone 0.1a ships: ARCHITECTURE.md is ACTIVE and its decisions are ADRs

A workspace is a folder, its `.md` files are notes, and editing one is safe
against everything else on the machine that might touch it at the same time.

**Seven of the eight acceptance criteria are met, one is partly met, and
`docs/ACCEPTANCE-0.1a.md` says which is which** — each against a named test or a
documented manual step, with the measurements rather than assurances:

- a 10 000-note, 197 MiB workspace **opens in 226 µs and its whole tree lists in
  37.5 ms**, two orders of magnitude under the one-second criterion, with the
  registry still empty afterwards — proof that listing assigned no identity and
  therefore hashed nothing;
- **1000 kills mid-save, 0 failures**, no truncated or empty note;
- **228 files opened and saved unchanged with `git status` clean**, in the
  criterion's literal form, plus a hermetic copy-based version that cannot dirty
  the repository;
- the external-append case, the path-escape cases and "opening a folder creates
  nothing" are all automated in the core, as the criteria require.

**The one that is only partly met is said so plainly.** Permission-denied is
automated and proven to leave a recoverable draft; **no test fills a
filesystem**, so the path from a real ENOSPC to a visible error is documented as
a manual step and listed as unverified. Automating it needs loopback privileges
in CI, which is a decision about CI rather than about this milestone.

`ARCHITECTURE.md` becomes `ACTIVE`, and the twelve decisions it introduced become
**ADR-013 … ADR-024**. Three are worth naming here. ADR-014 amends ADR-005 once
rather than twice, closing both readings of its Decision together: identity never
enters a note file, and the content hash is correlation rather than identity —
which is what keeps the promise that the app never writes what the user did not
type alive through 0.6, the milestone at which most note applications break it.
ADR-020 records that one command per operation was chosen over a single
`dispatch` on a capability argument, not a stylistic one: permitting `dispatch`
permits `delete`, and there is no way to grant half of it. ADR-021 records why
autosave and the base-rev guard could not ship apart — the moment autosave
exists, the app is writing to files that VS Code or an agent may be writing too,
and without the guard it overwrites them.

`docs/DECISIONS-0.1a.md` holds the nineteen calls the specification did not make,
each with the alternative if the owner disagrees. Two changed the design rather
than filling a hole: the case-sensitivity probe reads instead of writing, because
the mechanism specified would have created a file inside a folder that was merely
opened; and the temporary file has a deterministic name, because the crash loop
proved that random ones accumulate in the user's folder forever.

**Not verified, and not claimed: the window has never been launched.** Everything
above comes from the core and the corpus. The CI matrix — Ubuntu, macOS, Windows
and an Arch container against rolling `webkit2gtk-4.1` — has not run yet either,
so `ARCHITECTURE.md` §11's capability matrix remains a specification rather than
an observation. Milestone 0.0 stays open in `.continue/`, on hardware this
machine does not have.

A `Y` bump: a completed roadmap milestone.

## 0.6.1 - the Tauri shell, the typed IPC boundary, and the 0.1a interface

Nineteen commands, one per operation, each of them parse → call the core →
return. `src-tauri` holds no policy: a single `dispatch` command was rejected in
`ARCHITECTURE.md` §18.8 because Tauri's capabilities are per command, so
permitting `dispatch` would permit everything.

**The generated TypeScript found a real defect.** `mtime_ns` is around
1.7 × 10¹⁸ and `Number.MAX_SAFE_INTEGER` is 9.0 × 10¹⁵, so a nanosecond
timestamp sent as a JSON number is rounded by JavaScript — and it does not
merely display wrong. `BaseRev` travels back to the core on every save, so a
rounded timestamp would make the cheap check disagree with the disk on every
write and quietly send each one down the hashing path. It now crosses as a
string, with a test that asserts the exact round-trip above the safe integer.
No test that stayed inside Rust could have caught it.

The capability file grants `core:default`, `dialog:allow-open`, clipboard read
and write, and `shell:allow-open` restricted to `http(s)`. **No `fs:` permission
exists in it**, and CI greps for one — the check `ARCHITECTURE.md` §12 asked for
in as many words. A second job deletes `ipc/generated`, regenerates it and fails
on any diff, because Rust and TypeScript disagreeing about the wire while both
compile is the failure the generator exists to prevent. A third fails when the
two i18n catalogues do not carry the same keys, since a missing key is a blank
label in exactly one language.

The interface is the 0.1a list and nothing beyond it: welcome with recents,
lazy tree, CodeMirror 6, autosave with the base-rev guard, `Ctrl+S` as a flush
rather than the only path to disk, a draft banner, a conflict banner, and the
status bar carrying the seven states of scope §9 — each with a word and a glyph
as well as a colour, and `saved` set only from a `SaveResult`.

The store holds the stale-save guard: a save paints the tab clean only when the
`buffer_version` it returns still equals the current one, so an old save landing
after new keystrokes cannot mark the buffer saved. While a note is in conflict
the debounce writes to the **draft** instead of the note, which is the rule §5
states and which needs the command D-11 added.

The 1000-round crash loop passed here: no truncated or empty note, and temporary
files never exceeded one.

`cargo fmt --check`, `cargo clippy --all-targets -D warnings`, `cargo test
--workspace` and `npm run build` are all clean, and the CI matrix now runs them
on Ubuntu, macOS, Windows and an Arch container against rolling `webkit2gtk-4.1`.

## 0.6.0 - notes-core: the write protocol, drafts, the registry and the lock

117 tests, none of which needs Tauri or a window. Four of the eight 0.1a
acceptance criteria are now automated tests rather than intentions.

**The write protocol** is `ARCHITECTURE.md` §5 with `base_rev` explicit on the
wire. The order matters and is asserted: identical content is a no-op that never
moves mtime, so an unchanged save leaves `git status` clean; a disk whose bytes
already equal the buffer is *convergence*, not a conflict; a change in mtime with
an unchanged hash is a touch, and only a changed hash is a conflict. Size and
mtime never authorise an overwrite on their own.

**A failed write is a result, not an error**, and that was a real bug found by
writing the acceptance test first: propagating `Err` out of `save_note` skipped
the draft, so "disco cheio / permissão negada → buffer recuperável ao reabrir"
would have been false while the code looked right. The test denies write
permission on the directory and asserts the draft holds the buffer verbatim.

**`tools/crash-save-loop.sh` found a defect on its first run.** The note never
truncated across sixty kills — but every `SIGKILL` between the write and the
rename left a temporary file behind, and with a random suffix **they accumulate
in the user's folder forever**. No process cleans up after being killed, so the
fix is not cleanup: the temporary name is now deterministic, one per note, and
the next save overwrites it. The loop asserts that bound rather than asserting
zero, because zero is not achievable and a test that demands it would be
disabled within a week.

Seven more decisions in `docs/DECISIONS-0.1a.md`, each with its alternative. The
load-bearing ones: the registry is populated when a note is **opened** and never
by listing, because a `hash` per record plus population-on-listing would mean
reading every file in a workspace the criterion says must list in under a second;
`write_draft` exists as a command at all, because §4.2 wants a draft after 30 s
of dirty buffer and on exit while §5 gives the buffer to the frontend, so all
three rules were unimplementable; and `workspaces.json` gains `last_workspace`,
because picking the maximum `last_opened` is a tie-break invented at read time
that is wrong the moment two workspaces open in the same second.

State loading reads the `schema` before the body, so a file written by a newer
build is detected even when its shape no longer parses — that workspace opens
read-only and **nothing is overwritten**, with a test that asserts the bytes
survive.

A `Y` bump: a new crate.

## 0.5.0 - notes-model and notes-fs, with the root jail and the atomic write

Two crates, 76 tests, no Tauri anywhere near them.

**`notes-model`** is types and nothing else — the rule that makes the write
protocol testable against a fake filesystem later. `RelPath` refuses every escape
shape as a string and **never normalises**, because a normalised path is a string
that does not open the file the user has on any filesystem storing NFD;
comparison is `CompareKey`'s job, and it is a separate type so the two can never
be confused. `ContentHash` serialises as `b3:<hex>` — prefixed by the algorithm,
so changing hash one day is a migration rather than an ambiguity — and carries
the digest of the empty input as a constant, which `notes-fs` asserts against the
real hasher so the constant cannot rot.

`TextProfile` is where the byte policy lives, and where front-matter preservation
actually comes from: the editor only ever sees `\n` with no BOM, and `encode`
puts the file's own shape back, so YAML survives 0.1a because nothing rewrites
the buffer — not because a parser restores it. Mixed endings and invalid UTF-8
return a read-only reason instead of a lossy decode.

**`notes-fs`** is the seam. The root jail is two halves that fail differently:
`RelPath` refuses what can be seen in the string, and `LocalFs::resolve`
`symlink_metadata`s each segment as it appends it, because a symlink is a
perfectly well-formed relative path that resolves somewhere else. Both halves run
on **every** call — a root validated at open time says nothing about the path
being used now.

The atomic write is temp, fsync, mode copy, re-stat, rename, `fsync` on the
directory — the last one because without it the contents survive a power cut and
the name may not. `expect` re-stats immediately before the rename and returns
`Diverged` with **nothing written**; a test asserts the external content is still
there afterwards. A rewrite with identical bytes moves mtime and not the hash,
and the test for that is the one that keeps size-and-mtime from ever authorising
an overwrite on its own.

The case-sensitivity probe reads instead of writing (D-01): it flips the case of
one character of an existing name and compares `dev`+`ino`. Inconclusive resolves
to *insensitive*, and the asymmetry is the point — a missed fold refuses a
legitimate name, the opposite lets a create pass its collision check and
overwrite a note.

Five decisions the specification left open are in `docs/DECISIONS-0.1a.md` with
their alternatives: a typed `IoKind` so a full disk is distinguishable from a
denied permission by *code* rather than by a string the contract says not to read;
`watch()` answering `Unsupported` until 0.1b rather than pulling `notify` early;
a fixed table of byte shapes instead of a property-testing dependency; NFC and
case-folding implemented in-crate rather than widening the four-dependency list
`ARCHITECTURE.md` §2 fixes for `notes-model`; and `delete` reporting `Permanent`,
which scope §7.7 allows as long as the user is told, and which no 0.1a command
can reach.

A `Y` bump: adding a crate is one, per `docs/versioning.md`.

## 0.4.1 - build the fixture corpora, because no fixture means no test

Milestone 0.1a's acceptance criteria are almost all statements about a corpus:
list `fixtures/basic` and `fixtures/large` in under a second, kill the process
during a thousand saves against `large`, open and re-save every file in `basic`
and `edge-cases` and see a clean `git status`. None of those corpora existed.

`fixtures/basic/` — 200 notes over a nine-directory tree, plus the files that
must **not** appear in it: a `.txt`, a `.png`, a dot-file, and three ignored
directories. `fixtures/edge-cases/` — 26 files, one per hazard the byte policy
has to survive: LF, CRLF, CR-only, missing final newline, BOM with each ending,
mixed EOL, empty, whitespace-only, invalid UTF-8, a lone surrogate, valid and
malformed front matter, front matter that is not on the first line, tabs, a name
with a space, a trailing dot, a case collision, NFC and NFD names, and 5 MB.
`fixtures/xss/` — 18 files, each an assertion rather than a sample, with two that
must **survive**: the payloads inside a code fence have to render as text, and a
renderer that strips them there is rewriting what the user wrote.

Both committed corpora come from `tools/gen-fixtures.py`, which is deterministic
by construction — a blake2b stream keyed on the file's own path, never
`random` — so regenerating on a clean checkout leaves `git status` empty and a
review can see where each byte came from. `tools/gen-large.sh` generates the
performance corpus at 10 000 notes and 197 MiB and is never committed.

**`.gitattributes` marks the corpus `-text`, and without it the byte-preservation
criterion would be theatre.** The files under test deliberately carry CRLF,
CR-only and mixed endings; git's default `text=auto` would normalise them on
commit and re-expand on checkout, handing the Windows runner different bytes from
the ones committed — so the test would pass or fail on git's behaviour rather
than the application's, exactly where it is most likely to break.

Two things the corpus cannot contain, recorded in `docs/DECISIONS-0.1a.md` rather
than discovered later: a nested `.git/` directory, which git will not track, so
that entry of the ignore list is covered by a unit test over a temp directory;
and, on Windows, the trailing-dot filename, which the generator skips with a
warning instead of failing.

`tools/crash-save-loop` is not here: it drives the write path, and the crate that
owns the write path arrives in the next commit.

## 0.4.0 - move the architecture into docs/ and resolve the scope contradictions

Milestone 0.1a starts here. Nothing prescriptive is left at the repository root:
`ARCHITECTURE.md` moves to `docs/ARCHITECTURE.md`, and the scope-v1 page it
replaced becomes `docs/architecture-v1.md` — which also removes the hazard of two
files whose names differ only in case, on a filesystem where §11 of the same
document says case may not distinguish them.

The eight contradictions the review found are resolved in the document itself:

**The scope wins on the write contract.** `note_save(note_id, text,
buffer_version, base_rev)` — the `BaseRev` is explicit on the wire rather than
held core-side. That is scope §9 as written, and it collapses the app and
`notes-mcp` onto one write path: the agent already had to send the base it read,
and a core-held `open_rev` would have given the app a second, weaker rule for the
same guard.

**The document wins on three**, all recorded in a new §17.1 rather than by
editing the queue: `notes-markdown` is 0.1b because its first consumer is the
0.1b preview and front matter survives 0.1a through the byte policy, not a
parser; conflict resolution has three variants because "compare" changes nothing
on disk and is therefore UI, not a command; and a draft is written on four
occasions rather than two, a superset that cannot weaken the guarantee.

**The default ignore list is a constant in `notes-core`**, not configuration. It
could not live in `.notes/config.json`: that file is off by default, and a
default that only exists once the user opts in is not a default. `.notes/`
extends the list and can never replace it — no configuration file can unhide
`.git/`.

**The dmabuf workaround is unconditional at 0.0** and gated by a setting only
from 0.1a, because `settings.json` is itself 0.1a: gating 0.0 on it would gate it
on a file that does not exist. From 0.1a a missing settings file degrades to
`auto`, never to `off` — not applying it yields a black window, applying it
needlessly yields slightly slower compositing.

**Case sensitivity is probed rather than assumed**, and the probe reads instead
of writing — see `docs/DECISIONS-0.1a.md` D-01. The mechanism the owner specified
would have created a temporary file inside a folder that was merely opened,
which scope §2.3 forbids and a 0.1a acceptance criterion tests for. The intent is
kept: nothing is assumed from the operating system, and the flag self-corrects in
both directions.

**npm, not pnpm** — the lockfile has been committed since `0.3.7`.

`§18` is corrected for the ADR pass that closes 0.1a: items 2 and 9 fold into one
ADR so that ADR-005 is amended once rather than twice in the same commit; item 3
drops its `index.db` half, which is already ADR-012; and item 11 splits, because
the WebKitGTK workaround and Arch-as-a-release-target are two subjects.

`fixtures/large/` joins `.gitignore` under ADR-011's test. `.continue/` is
untouched, as instructed — which leaves one stale link in its README pointing at
the old root path.

## 0.3.11 - record what the 0.0 spike established, and what it did not

`docs/SPIKE-0.0.md`, in two halves, because the second is the one that matters.

**Verified here**, on Debian 13 / X11 / no NVIDIA: `cargo build`, `cargo clippy
--all-targets` and `npm run build` with zero warnings, and 12 tests passing with
no Tauri and no window. The document says what those tests actually cover rather
than reporting a count.

**Not verified here, and not claimed.** The window was never launched on this
machine, so "renders correctly" is unverified even for Debian/X11 — the document
says so and gives the command. Wayland, NVIDIA, macOS, Windows, iOS and Android
do not exist here at all. The checklist for them is written to be *seen* rather
than reasoned about: the diagnostics panel prints the word `APPLIED`, so
criterion 1 is read off a screen, not inferred from the fact that the code looks
right.

**Milestone 0.0 stays open and its queue item stays in `.continue/`.** The tests
prove the decision, not the rendering, and the whole reason a spike exists is the
part that only hardware can answer. Closing it here would be the failure the
document exists to prevent: a milestone marked done because the machine that
could not test it had nothing left to run.

The queue also records that my `.continue/ARCHITECTURE.md` is superseded by the
owner's `ARCHITECTURE.md`. It is kept rather than deleted — it is where the
questions were asked, and three of the four were answered by the document that
replaced it.

## 0.3.10 - track ARCHITECTURE.md and retire the v1-derived page it replaces

`ARCHITECTURE.md` at the repository root, written by the owner and aligned to
`.continue/SCOPE_final.md` v2.0. It closes every item SCOPE §20 delegates —
layout, crates, core types, app-data schemas, the command contract, `CoreError`,
the inter-process lock, the markdown IR, `Caps`, distribution — and its §18 lists
the decisions to record as ADRs. It is `PROPOSED` and becomes `ACTIVE` in the
commit that ships 0.1a, which is when those ADRs get written and numbered from
the last one here.

It arrived untracked. Committing it is the same rule that `0.2.0` broke in the
other direction: a document the project is about to be built from, existing only
in one working tree, is one accident from being the loss this repository has
already paid for once.

**Two architecture documents was the actual risk**, and this closes it.
`docs/architecture.md` — derived from the **v1** draft — is marked `SUPERSEDED`
with a line telling the reader not to build against it, and it names the file
that replaces it. It contradicts v2 on identity and on the app-data layout, and a
stale document is worse than a missing one precisely because it has the authority
of being written down. It is kept rather than deleted: it is the record of what
was understood before v2, and its original status line is preserved underneath.

## 0.3.9 - track Cargo.lock, which the spike build produced and 0.3.7 missed

The workspace builds a binary application, so the lockfile is part of the source:
without it, a clone resolves whatever versions are current that day, and "it
builds here" stops being a statement about this repository. `0.3.7` reported the
build as passing and left the file that makes the result reproducible untracked.

## 0.3.8 - write the ADR the .gitignore was already pointing at

`0.3.3` added `target/`, `node_modules/`, `dist/` and `.vite/` to `.gitignore`
with a comment saying the exception is recorded as ADR-011. **ADR-011 did not
exist.** The rule in that file is that any exception beyond secrets needs an ADR
rather than a silent line, and a line that cites an ADR nobody wrote is a silent
line with a citation on it — worse than an uncommented one, because it reads as
settled.

ADR-011 states the test for admitting anything to that list: it is produced by a
command in this repository, from inputs in this repository, and reproducing it is
running that command. `src-tauri/gen/schemas/` passes and joins the list — it is
rewritten by `tauri-build` on every build and read only by an editor resolving a
`$schema` reference; `0.3.7` committed it by accident. `icon-source.png` fails
the test and stays versioned: it is what `tauri icon` consumes, and without it
the icons cannot be regenerated.

The ADR is numbered 011 and lands after 012, which was written first. The number
is an identifier, not a timeline, and `.gitignore` had already named this one.

## 0.3.7 - complete the 0.0 spike so it builds, tests and lints clean

The Rust half the previous commit said was missing: the Tauri crate, the
capability set, the window and CSP configuration, the icons, the five commands,
the stylesheet, and the platform module. `cargo build`, `cargo clippy
--all-targets` and `npm run build` all pass with zero warnings, and `cargo test`
runs **12 tests with no Tauri and no window**.

**The dmabuf decision was split into a pure function, and that is the point of
the commit.** 0.0's first acceptance criterion is that the Wayland + NVIDIA
workaround is applied automatically — on hardware this was not written on. A
function that reads the environment can only be checked by having the
environment. `decide_dmabuf(linux, opt_out, already_set, session, nvidia)` can be
checked by anyone: it applies on Wayland + NVIDIA, stays out of the way on
Wayland alone, on X11 with NVIDIA and off Linux, loses to
`NOTES_NO_DMABUF_WORKAROUND=1`, and never overrides a value the user set. Six
tests. **They prove the decision, not the rendering** — the window still has to
be looked at, which is why 0.0 stays open.

The other six cover the two things a spike can still get wrong in a way that
matters later: `..`, `sub/../../` and absolute paths are refused against the
resolved path rather than by string rules that each miss a case; and the atomic
write round-trips bytes exactly for empty, plain, CRLF, BOM-led and
accented/emoji payloads, leaving no temp file behind.

Three rules are honoured now rather than retrofitted, because breaking them would
make the spike measure the wrong thing: the webview gets `core:default` and
`dialog:allow-open` and **no filesystem capability**; every path is re-resolved
and re-checked against the root at the moment of use, not only at open; and
opening a folder writes nothing into it, with the chosen path persisted in app
data.

The identifier is `br.com.samirhv.notes.spike`, suffixed deliberately. The
production identifier is still open, it fixes the app-data path on three
operating systems, and changing it later strands the state of everyone who
installed — a spike must neither squat on it nor pollute its directory.

`apps/notes-app/README.md` stops saying the app cannot run and starts saying what
it is not: no `BaseRev`, so a write can still overwrite a concurrent external
change; no identity registry, no draft recovery, no watcher, no byte policy. That
list is milestone 0.1a, and naming it here is what keeps the spike from being
mistaken for a first draft of it.

## 0.3.6 - amend ADR-004: index.db lives in app data, not in the workspace

ADR-012, written as an **amendment** rather than a reversal, because ADR-004's
rule was right and only its example was wrong. `.notes/` stays what ADR-004 made
it — optional, deletable, holding nothing whose loss costs a note — and its test
is untouched. One file moves out.

The reason is not that the index is rebuildable; it is that users keep their
folders inside Dropbox, iCloud Drive, OneDrive, Nextcloud and Syncthing, and
those tools copy files whenever they change with no knowledge of transactions.
**An active SQLite database copied mid-transaction is not stale, it is corrupt**,
and on the provider's side that corruption is what other devices download. Being
rebuildable is exactly why nobody would notice: the app reindexes, the provider
copies again, and the loop repeats with no error anyone can act on. A `-wal` file
copied apart from its database is the same failure wearing another name.

Recorded with its cost: "delete `.notes/` to force a reindex" stops being the
recovery path, so an explicit reindex command has to exist; and the app now keeps
per-workspace state the user cannot see from their file manager, which has to be
discoverable rather than folklore.

## 0.3.5 - propose ARCHITECTURE.md, closing the SCOPE §20 items 0.1a needs

`.continue/ARCHITECTURE.md`, v0.1, a proposal awaiting review. It closes the
three items SCOPE §20 delegates to it that milestone 0.1a cannot start without:
the persistent-state schemas (§20.1), the Tauri command contract and the core
error model (§20.2), and the `Caps` mapping per backend (§20.6). The other four
are left alone because they do not block 0.1a.

It goes in the queue, in Portuguese, because it describes something that does not
exist — the `QUEUE-RULE` block, not a judgement call.

Three things it settles that the SCOPE could not have known it left open:

**A global file is missing from the §6.1 layout.** Keying a `WorkspaceId` by the
canonical root path and persisting the last workspace are both data that cannot
live inside `workspaces/<WorkspaceId>/` — you need the index before you have the
id. `workspaces.json` is proposed alongside it.

**`registry.json` is needed at 0.1a, and not for the reason it looks like.**
Nothing consumes `NoteId` until 0.1b, so the registry looks deferrable. It is
not, because a suspended draft has to know which note it belongs to: keyed by
path, an external rename while the draft is suspended orphans it — and an
external rename during suspension is precisely the situation that produces
drafts. The 0.1a acceptance criterion "buffer recoverable on reopen" would fail
in the case that matters most.

**Capability detection cannot probe.** The reliable way to know whether `rename`
is atomic on a given root is to write a temp file and try. SCOPE §2.3 forbids
that — opening a folder must not modify it — and 0.1a has the literal acceptance
criterion "opening a folder creates no file in it". So caps are derived read-only
from the filesystem type, with an unknown type falling back to the conservative
profile. A FUSE mount that does support atomic rename will be treated as though
it does not; that is the cheaper mistake.

The document also argues one thing against the instruction that asked for it:
`notes-markdown` has no consumer at 0.1a. Front matter is preserved byte for byte
there, which is the `notes-fs` byte policy rather than parsing, and CodeMirror's
highlighting is explicitly not the semantic authority. Its first real consumer is
the 0.1b preview.

Four questions are held open at its §5 — the bundle identifier above all, since
it fixes the app-data path on three operating systems and changing it later
strands the state of everyone who already installed. No ADR is written yet:
writing `ACCEPTED` decisions for a proposal nobody has reviewed would be the
paperwork imitating the decision.

## 0.3.4 - stop restating the queue rule now that a block carries it

`0.3.2` took the queue rule to repodocs and it came back as the regenerated
`QUEUE-RULE` block. Four places in this repository still restated it as a local
override, which is one rule with two sources — the exact thing that commit
removed — and three of them now said something false: that the fleet rule does
not apply here, when the fleet had adopted this one.

Golden rules 1 and 2 collapse into one that points at the block and says **do not
restate it here**; the list renumbers to nine. The freed slot goes to the rule
that is genuinely local and is in no block: **an `ACTIVE` document in `docs/`
wins a contradiction, a `PROPOSED` one does not** — the queue is the authority on
intent while both exist. `.continue/README.md` and `docs/README.md` lose their
copies the same way and keep only what is theirs: that the queue's README is the
one file in the folder that is not queue material, and so stays in English while
the items around it do not.

The ADR bodies are untouched. Their status lines already record the fleet
adoption, and `0.3.2` put it there; rewriting a decision's Context and
Consequences to match what happened afterwards would turn the log into a
description of the present rather than a record of what was decided and why.

## 0.3.3 - commit the 0.0 spike scaffold, unfinished and parked

The Cargo workspace, and the frontend half of the 0.0 spike application:
`apps/notes-app/` with Vite, React, TypeScript and a CodeMirror 6 host, plus a
diagnostics panel that exists because the spike's product is evidence rather
than software.

**It is committed incomplete, on purpose, and says so in three places** — the
status line of `apps/notes-app/README.md`, a table of what is written against
what is missing, and this entry. The Rust half does not exist: `src/api.ts`
declares five Tauri commands and none of them is implemented, so the application
cannot run. `npm install` and `cargo build` have never been executed against it.
Committing it beats leaving it in a working tree nobody else can see, which is
the failure this repository has already paid for once at `0.2.0`; pretending it
works would be a different and worse failure.

The design is recorded even where the code is not: the Wayland + NVIDIA
`WEBKIT_DISABLE_DMABUF_RENDERER` detection is 0.0's first acceptance criterion,
it belongs in the missing `src-tauri/src/lib.rs` before the webview is created,
and the README says exactly that so the next session does not rediscover it.

Two rules are honoured in the frontend from the start rather than retrofitted:
no filesystem capability is granted to the webview, so every read and write in
`api.ts` is a call into the core (SCOPE §2.5); and the editor adds nothing to
input handling, because the mobile acceptance criterion is measuring the
platform's IME, not ours.

`.gitignore` gains `target/`, `node_modules/`, `dist/` and `.vite/`. That file
requires an ADR for any exception beyond secrets, so ADR-011 owes it one — the
line is written with a pointer, and the ADR follows in the architecture pass
rather than being waved through as obvious.

0.0 cannot be closed from this machine: its acceptance needs Arch/Wayland/NVIDIA,
an iPhone and an Android device.

## 0.3.1 - take SCOPE_final.md into the queue as the version to build

`.continue/SCOPE_final.md` — the owner's v2.0 specification, in Portuguese, as
[ADR-010](docs/decisions.md#adr-010--continue-is-written-in-portuguese-everything-else-is-english)
provides. It supersedes the two v1 drafts beside it and is the document the
application gets built from. Committed on arrival, because the rule that nothing
leaves the queue uncommitted is worth as little as its counterpart on the way in
— the v1 drafts were lost at `0.2.0` precisely for want of this commit.

It closes decisions the v1 left open, and several of them contradict ADRs that
are currently `ACTIVE`: identity lives in the app's own registry and **no `id`
is ever written into a `.md`**, not even when sync is switched on; the content
hash stops being identity and becomes a correlation signal with explicit
ambiguity rules; data outside the notes splits into three categories where only
the derived one is disposable, which moves `index.db` out of the workspace by
default — an active SQLite database copied mid-transaction by Dropbox or iCloud
is a corrupt database; a concurrency guard ships with autosave at 0.1a rather
than with sync; and a timeboxed 0.0 spike now precedes 0.1a.

Those reversals are not applied in this commit. An ADR is reversed by an ADR,
and this one only records the arrival of the document that argues for it.

## 0.3.0 - mark the unbuilt specifications as PROPOSED

`product.md`, `architecture.md` and `roadmap.md` were written at `0.2.0` and
marked `ACTIVE`, which claimed they described something that exists. They
describe an application with no code. They are now `PROPOSED`, each carrying the
same header: nothing here has been built, the specification still lives in
`.continue/`, **the queue is the authority on intent while both exist**, and a
section becomes `ACTIVE` when its code exists and works.

That resolves the duplication ADR-009 creates rather than pretending it is not
there. The same subject is in the queue in Portuguese and in `docs/` in English,
and the pair only stays honest if the direction of authority is written on the
face of the document — otherwise the next reader picks whichever they opened
first. `.continue/README.md` states the same rule from its side: an `ACTIVE`
document in `docs/` wins a contradiction, a `PROPOSED` one does not.

`decisions.md` stays `ACTIVE`, deliberately. A decision exists the moment it is
taken — the ADRs are the artefact, not a description of a future one — and it is
the record that stops a settled direction being re-litigated during exactly the
long stretch of a project where nothing has been built and everything is still
arguable.

Golden rule 4 already said an undeclared status is read as `ACTIVE` and that
this is "exactly the failure mode". Three documents were sitting in it.

## 0.2.1 - restore the scope drafts to the queue

`0.2.0` deleted `.continue/scope.md` and
`.continue/scope.md — Aplicativo Markdown Local-First.md` on the reading that
writing them up in `docs/` had finished them. That reading is wrong for this
repository: an item leaves the queue when it has been **built**, not when it has
been documented. Nothing in those two files exists as code, so they belong in the
queue, and they are back in it.

They had never been committed, so they were not recoverable from the history —
they are reconstructed here from the session that deleted them, and are content-
complete rather than byte-identical to the originals.

The queue's "where things went" table is corrected too: it claimed the drafts had
migrated to `docs/`, which was the same mistake stated as fact.

The rule this violated is not yet written down anywhere — that is the next
commit, and it is why this one only repairs.

## 0.2.0 - adopt the scope in the agent instructions and empty the queue

The last block of the conversion: making the documents the repository actually
reads agree with the four that were just written.

`CLAUDE.md` and `AGENTS.md` had `_to be filled in._` in all three identity slots.
They now carry the stack, the repository layout and — the part worth having — a
list of things not to do without an ADR reversing the one named: no note stored
anywhere but as a `.md` file, no metadata written into a user's note that the
user did not ask for, no file identified by path plus `modified_at`, no
listening port in the desktop app, no touching `.git/` in a workspace. An
instruction file that only describes the project is a file an agent skims; one
that names the five ways to break it is one that changes behaviour.

The `X`/`Y`/`Z` bump triggers stopped being the skeleton's examples and became
this project's, in both the twins and `docs/versioning.md`. A `Y` here is a
completed roadmap milestone, a new crate, a change to the `FileSystemAdapter`
surface, an index-schema change forcing a reindex, or an ADR reversing an
earlier one. Both places also state that milestone numbers are not versions:
`0.3` in the roadmap and `0.3.0` in `version.md` will otherwise be read as the
same thing, and they are not kept in step.

`README.md` describes what the project is rather than what it was going to be,
and says plainly that there is no application code here yet — the pre-flight in
`docs/runbook.md` §6 asks for exactly that, and this repository is public.

`.continue/` is empty of drafts. The two scope files are recorded in its "where
things went" table with links to what replaced them. **They were never committed,
so they are not in the history** — their content lives in `docs/`, translated and
split, and nowhere else. The three questions that were open in the queue are
closed and named against the ADRs that answered them, so they are reversed by a
new ADR rather than re-opened as a queue item.

## 0.1.1 - rename the project to notes

The project was called `franknote` until this commit. The name is dropped
because the `frank-` slot is already taken by a known project in the same space
(`frankmd`), and a name that collides costs more attention than it earns before
a single line of product exists.

`notes` is provisional and deliberately plain: it holds the slot until the
product has a shape worth naming, and renaming again is cheap for as long as
there is nothing but documentation here.

The rename went through GitHub's own rename, so the old URL redirects and any
link already pointing at `franknote` keeps working. The hook escape variable
followed the name — `FRANKNOTE_NO_HOOK` is now `NOTES_NO_HOOK`, declared at the
top of both hooks and in `docs/versioning.md`.

**The `0.1.0` entry below keeps its original wording.** At that commit the
project was `franknote`, and this file is not rewritten — a changelog that
retro-names its own history stops being a record of what happened.

## 0.1.0 - initial documentation structure

<!-- Replace this entry. The heading IS the commit subject, so write it in
     English, in the format `X.Y.Z - description`. The body is prose: what
     changed, why, and what you measured — not a bullet list. -->

First commit of franknote, a desktop app for writing Markdown, standalone and optionally linked to a public Git repository.

The documentation skeleton comes from the fleet standard at
[samirhvbr/repodocs](https://github.com/samirhvbr/repodocs) — the norm itself
lives there and is **not** copied into this repository, so there is one place to
change it.
