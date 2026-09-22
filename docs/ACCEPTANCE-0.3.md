# Acceptance — milestone 0.3

> **Status:** `ACTIVE` · Implementation in 0.16.0, YAML correction in 0.16.1; owner acceptance pending.
> As required for 0.1d and every later milestone, Samir walks the installed
> Linux release and repeats the flows on the following release. Automated or
> local debug checks never tick the owner columns.

The implemented contract and limits are in [KNOWLEDGE-0.3.md](KNOWLEDGE-0.3.md).
The mobile foundation from [PR #2](https://github.com/samirhvbr/tura-notes/pull/2)
was reviewed and integrated in 0.17.0; full mobile acceptance remains in
[ACCEPTANCE-0.4.md](ACCEPTANCE-0.4.md).

## Automated evidence

| Criterion | Evidence |
|---|---|
| YAML/tags are read-only; code and destinations do not become tags | `notes-markdown::knowledge` tests (including indented block-scalar separators) and the reviewed front-matter golden |
| Backlinks and graph do not invent a homonym target | `notes-core/tests/knowledge.rs` |
| Wiki rename preserves aliases, fragments and code | Reviewed rename integration test |
| Clipboard import preserves image and note bytes, uses unique names and rejects invalid content | Core image import integration test |
| Ambiguous wiki navigation requires selection; graph supports keyboard; tags filter semantic data | `Knowledge.test.tsx` |
| Headless operation, scope confinement, separate delete permission and review writes | Real child-process `notes-mcp/tests/stdio.rs` tests |
| App and MCP refuse stale writes, including equal size and restored mtime | Parent app-core service and child MCP process regression tests |
| Concurrent app/MCP writers have exactly one winner and preserve that content | Eight racing writes through parent app core and child MCP process |
| An append retry across process restart does not duplicate text | MCP process integration test |
| Two first clients share identity without changing GUI last workspace | Two simultaneous MCP child processes and a subsequent app-core open |
| Parser upgrade only clears disposable data | Index schema 1→2 migration regression |
| PDF import shows the extracted text before anything is written | `PdfImport.test.tsx`: the text is reviewable and the save callback runs only on the explicit save |

Run the complete `tools/check.sh` gate and the native/Windows/Linux/Arch CI
matrix. The MCP transport tests are real protocol clients, not a claim of a
configured third-party AI client's behavior. macOS debug UI validation is not
an installed Linux acceptance run.

## Owner flows

| # | Flow and expected result | Installed release | Following release |
|---|---|---|---|
| K1 | Open YAML with scalar/structured properties, malformed YAML and CRLF; properties appear or warn; untouched bytes stay identical | ☐ | ☐ |
| K2 | Mix YAML tags, inline tags, code, links and escaped hashes; Tags shows only semantic tags and filters notes | ☐ | ☐ |
| K3 | Follow unique, ambiguous and missing wiki targets, including Unicode names and a heading fragment; no arbitrary target opens | ☐ | ☐ |
| K4 | View backlinks; follow one and inspect the same edge in Graph; keyboard opens the selected node | ☐ | ☐ |
| K5 | Filter a large graph; truncation/stale state is explicit, and editing stays available | ☐ | ☐ |
| K6 | Rename/move a linked note; review wiki edits, cancel and apply; aliases/code survive and backups exist | ☐ | ☐ |
| K7 | Paste PNG/JPEG into nested notes twice; unique root attachments render via relative links; invalid formats fail visibly | ☐ | ☐ |
| K8 | Change note/workspace while an image imports; the destination path is reported without inserting into another buffer | ☐ | ☐ |
| K9 | Close the app; launch the standalone MCP in a client; list/read/search work within the configured scope | ☐ | ☐ |
| K10 | Exercise create/update/append/move; stale base refuses; retry append after restart does not duplicate text | ☐ | ☐ |
| K11 | Keep an unsaved app buffer while MCP changes the file; app shows conflict and preserves both versions | ☐ | ☐ |
| K12 | Review mode restricts writes to proposals; delete is unavailable unless explicitly granted; out-of-scope search leaks no snippet | ☐ | ☐ |
| K13 | Rebuild index; tags, links and graph return while note bytes, IDs, drafts and append retry history survive | ☐ | ☐ |
| K14 | Import a PDF: pick one, read the extracted text in the preview, then **cancel**. No note appears, and the PDF is still only where it was — the import is deliberately not a workspace operation until the save | ☐ | ☐ |
| K15 | Import again and save. One Markdown note at the workspace root, holding the text you reviewed and nothing else: no copy of the PDF, no images, no folder. Then try a file over 32 MiB and one that is not a PDF — both refuse visibly rather than producing an empty note | ☐ | ☐ |
| K16 | Import `fixtures/pdf/standard-encoding.pdf`. It refuses, visibly, **and the application is still running** — every other tab still open, nothing lost. The parser panics on that file rather than returning an error, so before `1.7.9` this row killed the process; it is the one PDF case a unit test cannot fully stand in for, because what is being checked is that the window survived | ☐ | ☐ |

Record release numbers, platform, failures and repeat results here when Samir
performs the walk. No owner flow has been marked by an agent.

**Measured on 17/09/2026, against everything that shipped after 1.0.0.** One gap
found and closed above: PDF import arrived at `0.20.27` and appeared in no
acceptance document in this repository — `grep -i pdf docs/ACCEPTANCE-*.md`
returned nothing. K14 and K15 are it; K16 was added on 22/09/2026 with the panic it names. Nothing else since 1.0.0 changes a K flow:
the remote MCP work of `1.6.4`–`1.6.5` is milestone 0.7 and is walked in
[ACCEPTANCE-0.7.md](ACCEPTANCE-0.7.md), whose **M12 is the row that protects this
document** — it re-runs the local stdio path after `tools()` moved into the
library, which is the only way this milestone could have been damaged by that one.

## Local observation — 2026-09-10

A separate macOS debug application with isolated app data opened a four-note
fixture. Native UI interaction confirmed YAML properties and semantic tags,
preview wiki ambiguity with both candidates and Escape cancellation, a graph
with the expected edge/unresolved count, opening the linked note from its
accessible list and directly from its SVG node, and its backlink to the
originating note. The final graph exposes each node as an accessibility button. This was a local
debug check, not owner acceptance or a clipboard/third-party client walkthrough.
