# Acceptance — milestone 0.7 (Remote MCP)

> **Status:** `ACTIVE` · Implemented at `1.6.5`; the contract is
> [MCP-0.7.md](MCP-0.7.md). Owner acceptance is open.
>
> **Nothing here is ticked, and a box is not ticked by whoever built it.** A row
> becomes `verified` when the owner has walked it against **the deployed server**
> from **a real MCP client they actually use**, and then repeated it on the
> following release.

This is the shortest acceptance document in the repository, and that is the
point of the milestone. Remote MCP added no behaviour over the notes: it is a
second **envelope** over a call path that was already authenticated, already
scoped, and already shared with the stdio server. Most of what an acceptance
walk would normally check is therefore already accepted somewhere else — the
notes behaviour in [ACCEPTANCE-0.3.md](ACCEPTANCE-0.3.md), the transport and
credential boundary in [ACCEPTANCE-0.5.md](ACCEPTANCE-0.5.md).

**What is left is the part that only a real client can exercise**, and it is one
sentence: an agent configured by the owner, talking to their server, is told
about exactly the tools its credential admits and can reach exactly the notes
its scope admits.

---

## 1. The walk

A third-party MCP client, configured by hand, against the deployed server. Not
`curl`, and not the suite — `server/tests/mcp.py` is a real protocol client, but
a real protocol client is not a real *product*, and every gap between the two
lives in the client.

| # | What to do | What to look for | Verified |
|---|---|---|---|
| M1 | **Configure the endpoint in a client you use.** `POST /v1/mcp` on the public name, `Authorization: Bearer nt_<uuid>.<secret>` | The client completes its handshake and lists tools. Note *which* client and version: this row is about that client, and a second one is a second walk | ☐ |
| M2 | **The client that wants a stream.** MCP's Streamable HTTP also defines a `GET` that opens SSE; this server deliberately opens none, because none of the eight tools notifies, samples or elicits | Whether the client works anyway, degrades, or refuses. **This is the row most likely to fail on a client nobody tested**, and its answer decides whether the absent stream stays a choice or becomes an ADR | ☐ |
| M3 | **Two credentials, side by side.** One with `Delete`, one without | The narrower client is not told `notes_delete` exists — it is absent from the catalogue, not present-and-refused. A tool an agent can see is a tool an agent will try | ☐ |
| M4 | **A subfolder credential, naming a path above its scope directly.** | Refused, and the refusal names nothing: no path, no snippet, no evidence the note exists. Ask the agent to summarize what it just learned — if it can describe anything outside the subtree, that is the leak | ☐ |
| M5 | **The handshake is not a gate.** Restart the client, or let it reconnect, and call a tool without an `initialize` arriving first on that request | Answered. Over HTTP each request carries its own credential, so refusing would make correctness depend on state the transport does not keep | ☐ |
| M6 | **`Mcp-Session-Id`, if the client sends one** | Echoed back unchanged, and never required of a client that sends none | ☐ |
| M7 | **A stale write through the agent.** Have it read a note, edit the file yourself on the server, then let the agent write with the `base_rev` it read | Refused. Then confirm your edit survived — the refusal is only worth anything if the bytes it protected are still there | ☐ |
| M8 | **Line endings the agent never saw.** A note with CRLF: the agent reads normalized text, writes back LF | The file on disk still ends CRLF. MCP must not be the layer that loses that, and an agent is the writer most likely to normalize silently | ☐ |
| M9 | **The audit, after an agent session.** | Each call recorded as an allowlisted operation with a hash of the path — and **no tool arguments, no note text, no prompt**. An agent transcript in the audit is a private conversation in a log file | ☐ |
| M10 | **The limits are the same limits.** Let an agent run a burst | `429` with `Retry-After: 60` at the same thresholds as REST — not a separate budget. An agent is the client most able to find a rate limit by accident | ☐ |

### The two things this milestone must not have changed

| # | What to do | What to look for | Verified |
|---|---|---|---|
| M11 | **`ss -ltnp` on the desktop machine, with the app running** | No listening port. The desktop app opens none ([ADR-007](decisions.md#adr-007--the-desktop-app-opens-no-network-port-by-default)), and a remote transport arriving in the same release is exactly when that would quietly stop being true | ☐ |
| M12 | **Local stdio MCP, exactly as 0.3 shipped it** | Config file, no server, same eight tools, same behaviour. The `tools()` function moved into the library in this milestone; the walk that proves the move cost nothing is running the *old* path and finding it unchanged | ☐ |

### The test that cannot be automated

> The owner points an agent they already use at their own notes, asks it for
> something real, and it does the thing — without a workaround, a hand-written
> request, or a tool it should not have been offered. If it needed an
> explanation to get going, the envelope is not finished.

☐ — and this one is the owner's alone.

---

## 2. Automated

`server/tests/mcp.py`, in the gate, against a real `notes-server` process with
its own rate buckets. What it holds:

| What | Holds |
|---|---|
| Handshake | `initialize` answers protocol `2025-11-25` and `serverInfo.name` = `notes-mcp`; a sent `Mcp-Session-Id` comes back unchanged; a notification is answered `202` with no body |
| The catalogue is the permissions | `tools/list` with four permissions returns exactly six names; the same call on a narrower credential returns exactly two. Asserted as a **sorted list equality**, so a tool appearing to a credential that should not see it fails rather than passing unnoticed |
| The handshake is not a gate | `tools/list` is answered on a request that carried no `initialize` |
| Round trip through the core | create, read the `base_rev` a write needs, update with it, and the same `base_rev` replayed is refused as stale |
| Byte preservation | Created with CRLF, updated with LF, still CRLF on disk — checked by reading the file, not by reading the response |
| Scope | A narrow credential naming a path above its scope is refused, and the refusal's full JSON does not contain the out-of-scope marker |
| The boundary | An unauthenticated `tools/list` is `401` and never reaches the catalogue |

One description of the tools, not two: `tools()` lives in
`crates/notes-mcp/src/lib.rs` and both transports call it, so a schema cannot
drift between them. That is a property of the code rather than a test, which is
the stronger of the two.

**What none of it knows:** how a real MCP client behaves against this endpoint —
which is all of §1.
