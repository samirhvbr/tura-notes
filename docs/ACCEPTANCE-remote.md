# Acceptance — the remote folder

> **Status:** `PROPOSED` · Built in 1.9.8–1.9.11
> ([ADR-099](decisions.md#adr-099--the-remote-folder-edits-the-servers-notes-workspace-through-the-rest-api)).
> This walk has not been done. It stays `PROPOSED` until the owner has done it
> against **the deployed server** from **an installed build**.
>
> **A box is not ticked by whoever built it.**

The suites cover a lot. The client is tested end to end against this
repository's server over a loopback socket, and the stores and screens have
their own tests. What they cannot cover is a real server behind its real proxy,
a real credential, and the moment a note is changed on the server while it is
open on the desktop. That is this walk.

| # | Step | Expected | Verified |
|---|---|---|---|
| 1 | Issue a credential with `read,create,update,move,delete,search`; in the cloud panel fill in the address, credential and workspace; **Test connection** | "Connected", and the workspace field fills itself | ☐ |
| 2 | **Connect** | The server's tree appears, folders closed, with the count line | ☐ |
| 3 | Open a local folder that has one note identical to a server note, one edited, and none of a third | Marked *same*, *different* and *only on the server* | ☐ |
| 4 | Open a remote note, type, wait | The status bar goes *Not sent yet* → *Sending* → *Saved on the server*; `GET` of the note on the server shows the text | ☐ |
| 5 | With the note open, change it on the server (web, phone, or `curl -X PUT` with its ETag); type again | "Changed on the server"; **Compare** shows both; each of *Keep mine*, *Use the server's*, *Save mine as a copy* does what it says | ☐ |
| 6 | Stop the server (or the network) while typing | *Offline, kept here*; restoring it sends the edit without a click | ☐ |
| 7 | Close the window with an edit the server cannot take | The window asks; *Save a copy to the local folder* puts it in the local folder | ☐ |
| 8 | **New note on the server** as `new-folder/today.md` | It is created with its folder and opens | ☐ |
| 9 | Rename it, then delete it, from the note's `⋮` menu | Both happen on the server; the local folder is untouched | ☐ |
| 10 | In the server's tree, **right-click a note that is not open** (or use its `⋮`), choose *Rename or move on the server*, and give it a new name or `folder/name` | It moves on the server, the tree shows it at the new path, and nothing was opened. A name without `.md` gets it. Try a name that is taken: the tree says so and stays as it was. The note that is open with unsent text has the row greyed out | ☐ |
| 11 | Open the same remote note in **two apps** (two machines, or one machine and a `PUT` with `curl` and the note's ETag). Type in one and wait | Within about ten seconds the other shows the new text with no click, the cursor where it was, and the status bar says *Updated from another device* for a few seconds | ☐ |
| 12 | In both apps, edit **different parts** of the note, so that one has unsent text when the other's change arrives | Both changes end up in both apps, nothing is asked, the status bar says *Your changes were joined with those from another device*, and the note on the server has both | ☐ |
| 13 | Edit **the same line** in both apps | The conflict screen of row 5 appears, with both versions, and neither app has lost its text | ☐ |
| 14 | Put one app in the background behind the other, and minimize it for a minute | The minimized one stops asking, and catches up once when shown again | ☐ |
| 15 | Open **two different remote notes one after the other**, from the tree and from the tabs, one of them **empty** (create it with `+`). Do it again in the other order | Each shows **its own** text. The word and character count in the status bar, the preview and the editor all describe the same note. Type one character in the second note, wait for *Saved on the server*, and read **the first note on the server**: it is unchanged | ☐ |
| 16 | Connect with a credential that has **`read` only**, open a remote note and type | A banner on the note says it **was not saved to the server**, why, that the text is kept here, and offers *Try now* and *Save a copy to the local folder*. The status bar says *Not saved*. Keep typing, pause and use *Try now*: the warning stays in place through pending/sending/refused states and the editor does not jump. A successful save of the current text clears it. Click **another note in the tree**, and **another remote tab**: each says the open note has changes the server did not take — never *This storage does not support that*, and never nothing. Close the tab: it asks, and *Discard and close* lets go | ☐ |
| 17 | Through the **real proxy chain** (Cloudflare in front of the server, as `tura.samirhv.com.br` is), open a remote note, type, and wait | *Saved on the server* — not *Not saved*, and never *The sync settings … are not valid*. Then rename it and delete it from its `⋮` menu: both work. This is the row that proves 1.10.18 and 1.10.21: the proxy tests cover both a weak prefix and a gzip suffix, but only an installed save through the real chain proves that whole path | ☐ |

## Diagnostic evidence from 06/10/2026

The running installation reported 1.10.20. Authenticated read-only requests to
`tura.samirhv.com.br` returned 200 for the reported note and its detailed listing.
The note's header had the shape `W/"<revision>-gzip"`, even though the final
response had no content encoding. Removing the transport decorations produced
exactly the ETag in the listing JSON. No note text, credential or complete tag was
printed, and no production note was written. This explains why the weak-prefix
fix alone did not resolve the owner's save failure.

The 1.10.21 tests reproduce the refusal through a proxy with that header shape,
then cover successful writes and a stale revision that must still conflict.
Frontend regressions compare the warning and editor DOM nodes while typing,
retrying and failing again, and check that an older acknowledgement does not
clear a newer unsent edit's warning. These automated checks do not tick the
installed acceptance boxes above.
