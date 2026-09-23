# Self-hosted server and REST API

> **Status:** ACTIVE · Implemented in 0.18.0 · Milestone 0.5

`notes-server` is an optional process for one owner, their workspaces and their
integrations. It serves existing Markdown files through the same Rust core as
the desktop app and local MCP. The desktop app opens no listener. Pairing, sync
and remote MCP are milestones 0.6/0.7; this release is not a desktop sync setup.
The server can read its notes: there is no end-to-end encryption.

## Local operation

Build with `cargo build --locked -p notes-server`. Linux releases also include
a standalone archive and SHA-256 file. With the executable on PATH:

```sh
export NOTES_SERVER_DATA="$HOME/notes-server-data"
notes-server workspace create personal
notes-server token create laptop personal . read,create,update,move,delete,search /tmp/laptop.secret
notes-server serve
```

The default listener is `127.0.0.1:8787`. The token command prints only its
non-secret credential UUID and creates the secret file exclusively with mode
0600 on Unix. Import that file into the integration's secret store and remove
the transfer copy. Never paste the secret into shell arguments, logs, Git or a
URL. A second `token create` invocation must use a different output filename.
Use a separate credential for each device or agent; grant only its needed
comma-separated permissions. `-` grants none. A subfolder scope must already
exist. An optional final `review` argument restricts writes to `scope/proposals`
while retaining reads within scope. Create that proposals directory first.

`token list` shows redacted metadata. `token revoke UUID` takes an exclusive
administration lock, waits for authorized in-flight operations, and persists
revocation; no server restart is required. Credential creation/list/revocation
are operator CLI operations, never remote API routes. Tokens contain randomly
generated secrets; only BLAKE3 digests are persisted in `admin/tokens.json`.
These are high-entropy bearer secrets, not human passwords.

Folders under `workspaces/<name>` remain ordinary directories. The operator
can import files and create folders there. The API creates/moves/deletes notes,
not workspace roots or directories. Workspace names use `[a-z0-9_-]`, 1–64
characters. Note paths use the core's relative-path rules; absolute paths,
traversal, symlinks, hidden internals and non-Markdown writes are refused.

## Container and HTTPS

From the repository root, configure a real DNS name and start:

```sh
export NOTES_DOMAIN=notes.example.com
docker compose -f server/compose.yml up -d --build
docker compose -f server/compose.yml exec notes-server notes-server workspace create personal
```

Point DNS at the host and permit TCP 80/443 for certificate issuance and HTTPS.
The checked-in [Compose file](../server/compose.yml) publishes only Caddy's
ports. The notes process runs as UID/GID 10001, with a read-only container
filesystem, bounded `/tmp`, no Linux capabilities and the writable `/data`
volume. Its fixed private address is `172.30.90.3:8787`; it trusts only Caddy at
`172.30.90.2` with `X-Forwarded-Proto: https`. The backend network is internal;
Caddy has a separate edge network for certificate issuance. The backend rejects
other peers even if they forge forwarded headers. If that subnet overlaps an
existing network, update both addresses, the subnet and environment together.
Do not publish the backend port. Non-loopback startup requires a private bind
address and an explicit trusted proxy; unspecified/global addresses are refused.

To provision a container credential, create it at `/tmp/client.secret` with
`docker compose ... exec notes-server notes-server token create ...`, copy it
out with `docker compose ... cp notes-server:/tmp/client.secret /secure/client.secret`,
set the host copy to mode 0600, import it into the integration's secret store,
and remove both transfer files. `/tmp` is ephemeral and is not in `/data`.
Do not save a plaintext token in the data volume or a backup destination.

[server/.env.example](../server/.env.example) documents domain and port keys.
Native configuration uses `NOTES_SERVER_DATA`, `NOTES_SERVER_BIND` and
`NOTES_SERVER_TRUSTED_PROXY`. The production Caddyfile uses automatic publicly
trusted HTTPS; the separate test Caddyfile uses an internal CA only for CI.
Container base images are pinned by digest; CI builds and tests the local image.
No public image registry or hosted service is operated by this project.

## Co-tenant deployment behind an existing site

> Added in 1.1.15.

The Compose stack above assumes the host is the server's: Caddy takes 80 and 443
and reaches `notes-server` on a private Docker address nothing else can. **A host
that already serves a website has neither port to give**, and that is the host
this project actually has. The supported second shape is the native binary on
loopback, with whatever already terminates TLS there proxying one name to it.

Four files. The hostname below is this project's; it is the one thing to change on another host:

| File | What it is |
|---|---|
| [`server/cotenant/notes-server.service`](../server/cotenant/notes-server.service) | systemd unit: a system user, `/var/lib/notes-server` as `StateDirectory`, loopback bind, and a sandbox that permits no outbound address at all |
| [`server/cotenant/nginx-tura.conf`](../server/cotenant/nginx-tura.conf) | one nginx `server` block for the name |
| [`server/cotenant/apache-tura.conf`](../server/cotenant/apache-tura.conf) | the same, as an Apache vhost |
| [`server/cotenant/Caddyfile`](../server/cotenant/Caddyfile) | the same, when the existing front is Caddy |

The name is `tura.samirhv.com.br`, and it exists in DNS already. **No vhost
claims it yet**, so it currently answers from the server's default vhost — a
Matomo instance — which is worth knowing before a certificate request or a
pairing attempt is aimed at it and believed.

```sh
sudo useradd --system --home-dir /var/lib/notes-server --shell /usr/sbin/nologin notes
sudo install -m 0755 notes-server /usr/local/bin/notes-server
sudo install -m 0644 server/cotenant/notes-server.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now notes-server
sudo -u notes NOTES_SERVER_DATA=/var/lib/notes-server notes-server workspace create personal
```

`NOTES_SERVER_TRUSTED_PROXY=127.0.0.1` is what makes the front's configuration
load-bearing instead of advisory, and it has consequences worth stating before
they are discovered in production:

- **`X-Forwarded-Proto: https` is required on every request, `/healthz`
  included.** The health route is checked *after* the proxy gate, not in front
  of it, so a plain `curl http://127.0.0.1:8787/healthz` returns 403
  `https_required` on a server that is working perfectly. A front that omits the
  header produces a server that refuses everything *and* refuses the probe you
  would use to tell whether the server or the proxy is at fault.
- **The front must strip `Origin`.** The API refuses any request carrying one:
  it is a machine API with no CORS, and cookies there have no authority
  ([ADR-043](decisions.md#adr-043--a-separate-owner-operated-rest-server-reuses-core-policy)).
- **Raise the body limit.** A note is capped at 8 MiB and a request body at 16
  MiB; nginx defaults to 1 MiB and answers 413 itself, so an attachment bundle
  fails before the server sees it. Leave request *buffering* on: the server
  gives a body 15 seconds to arrive and buffering absorbs a slow phone.
- **The front must forward the client's address**, or the 120/min budget is
  charged to the front and becomes every device's budget put together — past
  three active devices that is tighter than the 60/min each credential already
  has, and one busy device locks the others out. Apache's `mod_proxy` and Caddy
  append `X-Forwarded-For` on their own; **nginx does not**, and the template
  carries the line that makes it. With a CDN proxying the name as well, set
  `NOTES_SERVER_TRUSTED_HOPS=2` — and only then, because counting a hop that is
  not there reads an entry the client supplied.

`python3 server/tests/cotenant.py` runs a real process in this configuration and
asserts each of those, that a created note lands as an ordinary `.md` file in
`workspaces/<name>/`, and that all four templates still carry the directives the
assertions depend on.

### The CDN in front, if there is one

`tura.samirhv.com.br` resolves to Cloudflare, not to the host. Two consequences,
neither of which the server can detect:

- **`X-Forwarded-Proto: https` is an assertion the front makes, not something it
  observes.** The templates set it unconditionally, which is correct when the
  front *is* the TLS endpoint. Behind a proxying CDN it is only true if the hop
  from the CDN to this host is also TLS — Cloudflare's **Full (strict)** mode.
  Under Flexible, the browser's connection is encrypted, the CDN-to-origin hop
  is plain HTTP, and the server is told `https` anyway. It then sends HSTS and
  accepts the request, having been lied to by its own configuration.
- **TLS terminates at the CDN, so the CDN sees the note bytes.** This server
  already reads its own notes — there is no end-to-end encryption — but that is
  one party the owner runs. A proxying CDN is a second one. Setting the record
  to DNS-only moves the TLS endpoint back to this host, and is the choice to
  make if that matters more than the CDN does.

A proxied record also complicates ACME HTTP-01, because the challenge is
answered by whatever the CDN forwards it to. Issue the certificate with the
record set to DNS-only and re-enable the proxy afterwards, or use DNS-01.

### Minting credentials from a web administration screen

`server/cotenant/tura-credential` exists for one deployment shape: a site on the
same host whose own administration screen creates and revokes sync credentials,
so a device is enrolled by downloading a file rather than by an ssh session.

It is a wrapper and not a sudoers line on `notes-server` itself, because the CLI
cannot be reached that way. `/var/lib/notes-server` is 0700 and owned by
`notes`, and `token create` writes the secret to a **new** file at mode 0600
owned by whoever ran it — so granting the web user `(notes) NOPASSWD:
notes-server token create *` buys it a file it cannot open. The secret has to
return over the pipe and the file has to be removed, which is what the wrapper
does. It also sets `NOTES_SERVER_DATA`, which sudo strips, and validates label,
workspace, permissions and credential id itself: the caller is a web
application, so "the caller validated it" is not a property this side may
assume. The grant is one reviewed script with no path argument:

```
www-data ALL=(notes) NOPASSWD: /usr/local/bin/tura-credential
```

The scope is always the whole workspace. Subfolder scoping is a real feature of
the server and not of that screen, and a flag no interface sets is a flag that
gets set wrong. `server/tests/cotenant.py` exercises the validation against a
fake CLI and asserts that a refused call never reaches it and that the secret
file does not outlive the call.

### Keeping it up to date

`server/cotenant/deploy-server.sh` updates a deployed server: it pulls the
checkout, reinstalls the unit, the vhost and the credential wrapper **when their
contents actually differ**, installs a new `notes-server` when the release line
moves, and checks health on loopback and then on the public name. It never
touches the data directory — a deploy that writes where the notes are is a
deploy that eventually loses somebody's notes, and backup is a separate,
explicit operation.

Two details worth stating. It derives the release carrying the binary from
`version.md` as `X.Y.0`, because assets are published on minor bumps, which
costs no GitHub API call. And it copies itself to `/run` and re-executes before
pulling: the script is inside the repository it updates, and bash reads a script
as it runs, so a pull underneath it makes what runs afterwards not reliably the
file that started.

**Where the checkout goes matters on a host with a deploy orchestrator.** A
scanner that runs every `/srv/www/*/deploy.sh` will find *this* repository's
root `deploy.sh`, which is the desktop packaging entry point
([ADR-072](decisions.md#adr-072--local-linux-packaging-shares-the-desktop-build-entry-point)),
and try to build the application on the web server. One level down is enough:

```
/srv/www/tura.example.com/
├── deploy.sh -> repo/server/cotenant/deploy-server.sh
└── repo/
```

### Reaching it from a client

The sync origin is a bare `https://host` — no path, no query, no user info —
and the client refuses a plain-HTTP origin unless it is a literal loopback
address with `--allow-private`.

**A tailnet address is "private" to the client.** `100.64.0.0/10` is CGNAT, and
`notes-sync-client` treats that range like RFC 1918: a name resolving into it is
refused unless the workspace was paired with `--allow-private`. Both deployments
are supported and the choice is not reversible without re-pairing:

| | Public name | Tailnet only |
|---|---|---|
| DNS | `tura.samirhv.com.br` at the public address | the name resolves to `100.64.x.y` |
| Certificate | ACME against the public name | `tailscale cert`, or ACME DNS-01 |
| Pairing | no flag | `--allow-private` |
| Reachable from | anywhere, including a phone on mobile data | only a device on the tailnet |

A phone off the tailnet is the case that decides it. **This project took the
public name** (ADR-076): `tura.samirhv.com.br` at the public address, an ACME
certificate for that name, and pairing with no flag. Neither column changes what
the server exposes — bearer credentials, per-credential permissions and scopes,
and the rate limits above — but the public one exposes it to the internet rather
than to a tailnet, so the credential is the whole boundary. Create one per
device, grant only what that device needs, and revoke rather than rotate the
workspace when one is lost.

## REST contract

The complete [OpenAPI 3.1 contract](../server/notes-server/openapi.json) is also
available at authenticated `GET /v1/openapi.json`. All `/v1` routes require
`Authorization: Bearer <credential>`. `/healthz` is minimal unauthenticated
liveness after peer/transport checks; it exposes no version or data.

| Route | Method | Permission and conditions |
|---|---|---|
| `/v1/workspaces` | GET | Returns only the credential's workspace, scope and permissions |
| `/v1/workspaces/{workspace}/notes` | GET | `read`; `limit` and `cursor` pagination |
| Same collection | POST | `create`; JSON `path`, `text`; `If-None-Match: *` |
| `/v1/workspaces/{workspace}/notes/{path}` | GET | `read`; returns text and ETag |
| Same note | PUT | `update`; JSON `text`; exact `If-Match` |
| Same note | PATCH | `update`; JSON `text` to append; exact `If-Match` |
| Same note | DELETE | `delete`; exact `If-Match`; explicit trash/permanent outcome |
| `/v1/workspaces/{workspace}/moves` | POST | `move`; JSON `from`, `to`; exact `If-Match` |
| `/v1/workspaces/{workspace}/search` | GET | `search`; literal `q`; `limit` and `cursor` |

**Paths are the only REST note address.** They are relative to the workspace,
including the scope prefix, and slash-separated. Encode special URL characters.
No note-ID routes or internal note IDs are exposed. Moves preserve core identity
and do not rewrite backlinks. GET the destination for its current ETag.

Use the exact opaque quoted ETag from a read/write in `If-Match`; it encodes the
complete core revision, including hash, size and timestamp. It is a precondition,
not a clock-based winner. Missing preconditions return 428; stale ones return
412, leaving the newer bytes intact. GET again and reconcile before retrying.
Create is exclusive; a name collision returns 409. Append retries with the same
ETag and text use durable core receipts and do not duplicate the append. A
retry with different text is invalid. Keep those receipts with operational
state. A lost response is not proof a write failed.

JSON rejects unknown fields. Text and final note size are limited to 8 MiB,
HTTP bodies to 16 MiB, body delivery to 15 seconds, query text to 4096 UTF-8
bytes, URI paths to 4096 bytes, result pages to 200 items and cursor to 1,000,000.
The default page size is 100. Follow `next_cursor` until null; cursors are offsets
in the current authorized results, not a snapshot. Concurrent edits can shift
pages. Search never enumerates or returns snippets outside scope. Original BOM
and newline policy are preserved; unsupported/mixed text opens read-only.

At most eight bodies/filesystem operations run simultaneously. Excess parallel
requests receive 503. Fixed one-minute windows permit 60 requests per credential
and 120 per actual connection address, returning 429 and `Retry-After: 60`. An
IPv6 address is charged by its /64, so a host holding a routed /64 has one
budget, not one per address. The windows live in memory in two tables, one for
addresses and one for credentials, each capped at 4096 live windows. **At the
cap the oldest window is evicted; a new key is never refused for want of
room** (since 1.8.16). The address is charged before authentication, so its
keys are chosen by whoever sends the request, and a refusing table let 4096
addresses lock every other caller out, including the deploy script's `/healthz`.
Eviction can hand a flooding client a fresh window. That is the direction this
control is allowed to fail in: towards letting one caller through, never
towards refusing everyone.
Behind a proxy the address budget is charged to the **client**, taken from the
last `X-Forwarded-For` entry — the one the trusted proxy appended, since
everything left of it came from the client and is forgeable.
`NOTES_SERVER_TRUSTED_HOPS` (default 1, maximum 8) says how many proxies stand
in front when more than one does. Setting it higher than the truth counts back
into an entry the client supplied and makes the budget forgeable; setting it
lower collapses the budget into one shared bucket, which is what shipped before.
Without a trusted proxy, or with a header nothing can be made of, the peer is
used. There is no unbounded request queue.
Credential storage is limited to 1024 entries, including revoked credentials.

All responses disable caching, MIME sniffing, framing and referrer disclosure;
HTTPS mode adds HSTS. Browser Origin headers are rejected, no CORS is enabled,
and cookies carry no authority. The machine API's CSRF exception and bearer
controls are recorded in ADR-043. Errors are stable codes without host paths,
stack traces or note contents. Unknown routes return 404, not an HTML home page.

## Audit and storage

`/data/workspaces` holds source files; `/data/state` holds core identity,
registries and append receipts; `/data/admin` holds credential digests/schema and
locks. `/data/audit` records time, credential UUID (or operator/anonymous), peer,
client, operation, outcome, request UUID and a short hash of the requested route.
`peer` is the transport hop, which behind a proxy is always the proxy; `client`
is the address the request was charged to, and both are kept, so a forged
`X-Forwarded-For` shows up beside the truth instead of replacing it. An MCP call
is recorded as `mcp:<tool>` for a tool call (checked against the catalogue,
`mcp:unknown` otherwise) or `mcp:<method>` for the rest, and its reference is a
hash of the `path` argument when there is one, so calls on one note correlate
without the note being named (since 1.8.17; before, every MCP call was
`create_or_move` on the same hash). The MCP outcome is the transport's: a tool
that refused inside a successful JSON-RPC answer is still `ok`. The
route reference allows correlating authorship without logging note paths or full
note IDs. Clients receive `X-Request-Id` for support. Authentication failures and
administrative actions are recorded. Mutation auditing starts before the core
call; an audit write failure refuses the operation. A post-write audit failure
returns an error even though the mutation may have completed: read before retry.

Audit retains five segments of about 10 MiB each, rotating oldest first. It
never records Authorization, note text, query text or plaintext tokens. Keep
exported backups under your own access/retention policy: they contain private
notes and authentication state. No telemetry or third-party content processing
is added. OS access to `/data` is owner-level authority and can bypass API scopes.

## Backup, restore and upgrades

Stop the server before backup. Also stop any other app/MCP/external writer using
these directories: unrelated editors do not honor the server lock. Back up the
whole data tree, not only a SQLite file or the notes directory.

Native example (archive outside the data directory):

```sh
notes-server backup /secure/backups/notes.tar.gz
notes-server restore /secure/backups/notes.tar.gz /srv/notes-restored
```

The archive is created exclusively; an existing destination is never replaced.
Backup refuses a running server, symlinks and special files. From 0.18.1,
regenerable process lock files are excluded while their guards remain held;
user files and SQLite operational state are included. Restore extracts
into a private staging directory, rejects links/traversal and unknown backup
schemas, and publishes only to a new destination. Failed extraction leaves the
previous data untouched. The restored core enrollment is rebound to the new
workspace paths with a preserved pre-restore index, keeping workspace and note
identities. Source note bytes are never rewritten. Review the restored data,
then set `NOTES_SERVER_DATA` to the restored directory and start the server.
Credential revocations are restored too; protect the original archive.

For Compose, stop `notes-server`, then run the same image with its existing
named data volume and a separate writable backup bind mount. For example:

```sh
docker compose -f server/compose.yml stop notes-server
# /secure/backups must be writable by container UID 10001.
notes_container="$(docker compose -f server/compose.yml ps -a -q notes-server)"
docker run --rm --network none --volumes-from "$notes_container" \
  -v /secure/backups:/backups notes-server:local backup /backups/notes.tar.gz
```

The one-off process has no network and reuses the stopped container's volume,
avoiding a competing static backend address. To restore, mount the target parent at `/restore` and the archive at `/backups`,
run `restore /backups/notes.tar.gz /restore/data /data` with the server stopped, then
use that resulting directory as the replacement `/data` bind mount. The optional
final argument records the eventual mounted data root (`/data`)
when it differs from the extraction path. This keeps core enrollment valid
when the restored directory is later mounted into a new container.
Keep the original named volume until the restored installation is verified.
Caddy's certificate/config volumes are separate; back those up separately or
allow Caddy to reissue certificates. Sync, trash and history are not backups.

Operational credentials and backup manifests use schema 1. A future credential
schema is refused without rewriting it. Core operational migrations retain
pre-migration copies; derived indexes can rebuild. Take a complete offline
backup before upgrading. On a failed upgrade, stop the new process and restore
a compatible backup into a fresh directory using the compatible older binary;
never ask an older server to overwrite future state.

## Validation and references

`cargo test -p notes-server` exercises the HTTP contract, permissions, revocation,
concurrent writes, append replay, pagination, rate limiting, HTTPS peer checks,
bounded bodies, audit redaction, backup restrictions and restored identity.
`python3 server/tests/smoke.py` runs an actual native TCP process and offline
restore. CI also builds the non-root image and exercises CRUD/revocation through
Caddy using its actual test CA, rather than disabling certificate validation. The container check also stops
the backend, backs up its volume with no network, restores into a new mount,
and verifies source bytes and revoked credentials.
Owner acceptance is tracked in [ACCEPTANCE-0.5.md](ACCEPTANCE-0.5.md).

Implementation references: [Axum 0.8](https://docs.rs/axum/0.8.9/axum/) and
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Synchronization inbox extension

Version 0.19.1 adds the separate scoped revision inbox documented in
[SYNC-0.6.md](SYNC-0.6.md). Its `sync/` data is included in offline backups;
its lock is excluded. Publication acknowledges storage, never live note
application. The REST note endpoints retain their existing behavior.
