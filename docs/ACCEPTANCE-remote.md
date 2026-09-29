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
