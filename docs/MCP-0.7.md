# Remote MCP over the server API

> **Status:** `ACTIVE` · Milestone 0.7 · Implemented in 1.6.5. It was `PROPOSED`
> while it described nothing, which is the only honest status for a contract
> written before its subject; it moves here because `POST /v1/mcp` answers, the
> catalogue is filtered per credential, and `server/tests/mcp.py` proves both
> against a real process in the gate.

[`roadmap.md` §0.7](roadmap.md#07--ai) states the whole of it in one sentence:
*"REST stays the generic interface; MCP is the agent-facing layer over it, not a
second implementation."* Everything here follows from refusing the second
implementation.

## What already exists, and why that makes this thin

Two halves are built and they already meet in the middle.

`crates/notes-mcp` speaks newline-delimited JSON-RPC over **stdio**. It reads an
`AgentConfig` from a file, filters its tool list by that config's permissions,
and answers `tools/call` by constructing a fresh `AgentService` per request
(0.3, [KNOWLEDGE-0.3.md](KNOWLEDGE-0.3.md#standalone-mcp)).

`server/notes-server` authenticates a bearer credential and, in `dispatch`,
builds **the same `AgentConfig`** out of it — workspace, scope, permissions,
review — and calls **the same `AgentService`**. Its REST routes are already a
verb-to-tool mapping: `GET /notes` is `notes_list`, `GET /search` is
`notes_search`, and so on.

So remote MCP is not new behaviour over the notes. It is a second **envelope**
over a call path that is already authenticated, already scoped, and already
shared. What is missing is the transport and one piece of de-duplication.

## Transport

**One endpoint, `POST /v1/mcp`, carrying a single JSON-RPC 2.0 message and
answering with a single JSON-RPC response.** `Content-Type: application/json`,
same 16 MiB body cap, same admission semaphore, same `no-store` and security
headers every other response carries.

MCP's Streamable HTTP also defines a `GET` that opens an SSE stream for
server-initiated messages. **This contract does not open one.** None of the eight
tools notifies, samples, or elicits; a stream with nothing to carry is a listener
to maintain and an idle connection to bound, for no behaviour. A later tool that
genuinely pushes is the ADR that adds it.

`Mcp-Session-Id` is accepted and echoed when a client sends one, and never
required. The stdio server keeps `initialized`/`ready` across one connection
because stdio *is* the session; over HTTP each request carries its own
credential, so the handshake is informational rather than a gate. `initialize`
answers with the protocol version and `serverInfo`, `ping` answers empty, and
`tools/list` and `tools/call` are answered whether or not `initialize` was seen
on some earlier request. Refusing them would make correctness depend on state the
transport does not keep.

## Authentication and scope

**The credential is the one the REST API already uses** — `Authorization: Bearer
nt_<uuid>.<secret>`, compared in constant time against the stored digest. No
second credential type, no OAuth, no per-tool token. A change there is an ADR
against [ADR-043](decisions.md#adr-043--a-separate-owner-operated-rest-server-reuses-core-policy),
not a detail of this page.

Everything the server already enforces before `dispatch` applies unchanged, and
that is the reason this endpoint is cheap: loopback-or-trusted-proxy, the refusal
of any request carrying `Origin` (a browser must not reach this), the per-IP and
per-credential rate limits, the audit record naming only an allowlisted operation
and a hash of the path.

`tools/list` returns **only the tools the credential's permissions admit**, by
the same filter the stdio server applies — a credential without `Delete` is not
told `notes_delete` exists. Scope is the credential's `scope`, so a subfolder
credential sees a subtree and nothing above it. Neither is re-implemented here:
both come from the shared `AgentConfig`.

## The eight tools, and a correction to the roadmap

`roadmap.md` §0.7 lists six: `notes_list`, `notes_search`, `notes_read`,
`notes_create`, `notes_update`, `notes_move`. The code has **eight** — it also
carries `notes_append` and `notes_delete`. **Eight tools sit behind six permissions**, and the two that share are worth
knowing before you write a credential: `Read` admits `notes_list` as well as
`notes_read`, and `Update` admits `notes_append` as well as `notes_update`.
This page said *"each behind its own permission"* until `1.6.80`, which is the
claim somebody designing a least-privilege credential would act on and could
not achieve. The
code is the reality and the roadmap line is stale; correcting it is part of
producing this milestone, in the same pass, rather than shipping a contract that
disagrees with the source it describes.

Remote MCP exposes the same eight, filtered per credential. It adds none: a tool
that exists remotely and not locally would be exactly the second implementation
the roadmap forbids.

## The de-duplication this requires

`fn tools(&AgentConfig) -> Value` is today a private function inside
`crates/notes-mcp/src/main.rs`, and it is the single description of every tool's
name, schema, required arguments and annotations. The server cannot call it.

**It moves to `crates/notes-mcp/src/lib.rs`, with the binary keeping only its
stdio loop.** Then one function answers `tools/list` on both transports, and a
schema can never drift between them — which is the failure this milestone exists
to avoid, and the one nobody would notice until an agent sent an argument the
other half rejected.

The JSON-RPC envelope itself — request validation, error codes, the
`content`/`isError` result shape — moves with it, for the same reason.

## What this does not change

The desktop app still opens no listening port
([ADR-007](decisions.md#adr-007--the-desktop-app-opens-no-network-port-by-default)).
Local stdio MCP keeps working exactly as 0.3 shipped it, with its config file and
no server. `notes-server` remains optional, for one owner and their integrations.

Both of those are rows in [ACCEPTANCE-0.7.md](ACCEPTANCE-0.7.md), because a
milestone that adds a network transport is exactly when "the desktop app opens
no port" stops being checked by anybody.
