# Milestone 0.5 acceptance — self-hosting

> **Status:** ACTIVE · Implemented in 0.18.0; owner acceptance remains open.
> The walk below was written against 0.18.0 and is extended at the bottom with
> everything the server grew afterwards — the deployment that is actually
> running, the way it is updated, and the signature that gates the update.

The executable, versioned REST contract, credential administration, conditional
writes, scoped search, container/HTTPS setup and offline backup/restore exist.
See [SERVER-0.5.md](SERVER-0.5.md) for the operator procedure and limits.
Automated tests do not substitute for the owner's installed-release walk and
repeat on the following release.

## Automated coverage

The co-tenant suite (`server/tests/cotenant.py`, 1.1.15) runs a real process
behind a trusted loopback proxy and asserts the gate that mode depends on: a
missing or non-`https` `X-Forwarded-Proto` is refused on every route including
`/healthz`, an `Origin` header is refused, a created note lands as an ordinary
file under `workspaces/`, and the three templates in `server/cotenant/` still
carry the directives those assertions depend on.

**The smoke suite runs at production limits, and that is load-bearing.** It gives
each phase a fresh window by restarting the process — the limiter's buckets live
in memory for the life of `Server::new` — rather than by loosening anything:
120/min per address and 60/min per credential, exactly as production runs them.
A credential per phase cannot do that job, because the per-IP bucket is checked
**before** authentication and every request in the suite arrives from the same
loopback address. Any future change that makes the suite pass by raising a limit
has removed the coverage rather than fixed the test.

The server integration suite covers conditional CRUD, durable append retries,
scopes, review mode, revoked credentials, bounded bodies, pagination, rate
limits, proxy peer checks, audit redaction, concurrent writes, future schemas,
backup exclusions and restored identities. The native TCP smoke exercises an
actual process and offline restore. The server CI job builds the container,
validates OpenAPI and exercises the API through certificate-verified Caddy TLS.
The project gate also runs the existing filesystem/core/frontend checks.

### The operator CLI, run from the page that documents it — 19/09/2026

Not a walk and not a tick: a machine check of what
[SERVER-0.5.md](SERVER-0.5.md#local-operation) prints, executed verbatim against
a throwaway data directory.

| Claim | Observed |
|---|---|
| `workspace create` then `token create` then `serve` work as printed | They do; the sequence needs nothing the page does not mention |
| `token create` prints **only** the credential UUID | One UUID on stdout, and nothing else |
| The secret file is created exclusively, mode `0600` | `600`, and a second `token create` onto the same filename is refused with `File exists (os error 17)` |
| `token list` is redacted | Label, scope, permissions, review and revoked flags — no secret, no digest |
| `-` grants no permissions | The listed credential carries `[]` |
| Workspace names are `[a-z0-9_-]` | `invalid workspace name` on one with capitals and a space |

**And every refusal exits non-zero** — reused filename, invalid name, unknown
workspace, unknown subcommand, all `1`. Checked deliberately rather than
assumed, because
[ADR-084](decisions.md#adr-084--a-step-that-publishes-installs-or-deletes-is-verified-by-reading-back-what-it-changed)
exists precisely for the case where a refusal reports success and the script
around it believes the work happened.

None of this is the walk below: it says the commands behave as documented, not
that a deployment serves the owner's notes over TLS to their devices.

### The audit keeps what it promises to keep — 19/09/2026

The same run, continued: server started, a note created through the documented
`POST` with `If-None-Match: *`, a read, a search. Three distinct markers were
planted — one in the note's **text**, one in its **path**, one in the **search
query** — and then the audit was grepped for all three.

| Must not be there | Found |
|---|---|
| Note text | 0 |
| Note path | 0 |
| Query text | 0 |
| The credential secret | 0 |
| The word `Authorization` | 0 |

What is there is what the page says: the credential UUID as `actor`, an
allowlisted `operation`, the `peer`, a `request` UUID, the `result`, a short
`target_ref` hash and the time. **And the correlation works** — the
`X-Request-Id` handed back to the client appears in the audit, which is what
makes a support question answerable without asking anybody what they were
editing.

Three more behaviours fell out of the same session, each a documented refusal:
`PUT` without `If-Match` answers **428 `if_match_required`**, a request with no
credential answers **401**, and `ss -ltn` shows the listener on
**`127.0.0.1:8787`** and nowhere else.

The walk's audit step stays: a machine confirming these markers are absent is not
the owner reading a real session's audit and recognising that nothing in it
describes their notes.

## Owner walk

- [ ] Install the released Linux server or build its pinned container; provision
      a dedicated workspace and least-privilege integration credential.
- [ ] Exercise the documented HTTPS setup on the owner's host; confirm the
      backend port is not publicly exposed and invalid credentials are refused.
- [ ] For the co-tenant deployment: confirm `ss -ltnp` shows 8787 on 127.0.0.1
      only, that the public name answers over TLS, and that the same request
      without `X-Forwarded-Proto: https` is refused — the header is what the
      whole arrangement rests on, and it is set by a file the owner edits.
- [ ] Read/edit a note from a REST client, provoke a stale write and confirm the
      newer bytes survive; confirm scope and review restrictions.
- [ ] Revoke a credential while the server runs and confirm subsequent access
      fails; inspect the bounded audit without revealing secrets or note text.
- [ ] Stop writers, back up, restore into a new directory/volume, and verify
      source bytes and identities before switching the active data mount.
- [ ] Repeat the installed-release walk on the following release.

No pairing UI, desktop synchronization or E2EE is claimed by this milestone.
Mobile completion remains in ACCEPTANCE-0.4.md; remote MCP is 0.7 and is
specified in [MCP-0.7.md](MCP-0.7.md). **The line about "no public deployment"
was true when it was written and is not now** — see below.

---

## What shipped after this walk was written

0.18.0 delivered a server. What arrived afterwards is the part that makes one a
*deployment*: a public name, a CDN in front of it, a script that updates it, a
signature that gates the update, and a way to mint a credential without an ssh
session. None of it had a box.

**`tura.samirhv.com.br` has been answering since 16/09/2026.** That it answers
is not acceptance — it is the precondition for these steps, which is exactly
why the queue item said so when it left.

### The two things the server cannot detect about its own deployment

Both are assertions made by something in front of it, and a server that is lied
to cannot tell.

- [ ] **The CDN is in Full (strict), or the record is DNS-only.** The templates
      set `X-Forwarded-Proto: https` unconditionally, which is correct when the
      front *is* the TLS endpoint. Under Cloudflare's **Flexible**, the browser's
      connection is encrypted, the CDN-to-origin hop is plain HTTP, and the
      server is told `https` anyway — it then sends HSTS and accepts the request.
      Read the mode in the Cloudflare dashboard, then confirm it from the origin
      side rather than from the dashboard alone. **Nothing in the repository can
      check this**, which is the whole reason it is a box.
- [ ] **The CDN sees the note bytes, and that was a decision.** There is no
      end-to-end encryption; the server reads its own notes, and that is one
      party the owner runs. A proxying CDN is a second one. Confirm this is still
      the intended trade — DNS-only moves the TLS endpoint back to this host —
      and that ACME was issued the way the CDN allows (DNS-only during HTTP-01,
      or DNS-01).
- [ ] **`NOTES_SERVER_TRUSTED_HOPS` equals the number of proxies that are really
      there.** With a CDN proxying the name as well as the local front, it is
      `2`. Too high reads an entry the client supplied and makes the 120/min
      address budget forgeable; too low collapses every device into one shared
      bucket. Walk the low case deliberately: from two devices at once, confirm
      one busy device does **not** lock the other out with `429`.

### The public name is the boundary now

[ADR-076](decisions.md#adr-076--the-cloud-copy-of-the-notes-is-a-co-tenant-on-the-sites-own-server) chose the public name over a tailnet, because a
phone off the tailnet is the case that decides it. What that costs is that the
credential is the entire boundary.

- [ ] **One credential per device, each granted only what that device needs.**
      List them and confirm there is no shared one. A lost device is answered by
      revoking its credential, never by rotating the workspace.
- [ ] **The limits are real, and they are the right shape.** Provoke each:
      `429` with `Retry-After: 60` at 60 requests in a minute for one credential
      and at 120 for one address; `503` past eight simultaneous bodies; `413`
      from the *server* rather than from the front on an oversized body — the
      front's own limit must be raised past 16 MiB or an attachment bundle fails
      before the server ever sees it.
- [ ] **`Origin` is refused, on every route.** It is a machine API with no CORS
      and cookies there have no authority. Send one and confirm the refusal
      survives the front, which is supposed to strip it.

### Updating a running server

- [ ] **`deploy-server.sh` replaces only what differs, and never the data.**
      Run it with nothing changed and confirm it reinstalls nothing; change one
      template and confirm it reinstalls that one. Then confirm — by timestamp,
      not by trust — that `/data` was not touched. A deploy that writes where
      the notes are is a deploy that eventually loses somebody's notes.
- [ ] **It survives updating the repository it lives in.** The script copies
      itself to `/run` and re-executes before pulling, because bash reads a
      script as it runs. Confirm an update that changes the script itself
      completes rather than running half of two versions.
- [ ] **The checkout is one level down from the orchestrator's reach.** If the
      host has a scanner that runs every `/srv/www/*/deploy.sh`, confirm it finds
      the symlink to `deploy-server.sh` and **not** this repository's root
      `deploy.sh`, which is the desktop packaging entry point
      ([ADR-072](decisions.md#adr-072--local-linux-packaging-shares-the-desktop-build-entry-point))
      and would try to build the application on the web server.
- [ ] **Health is checked on loopback and then on the public name.** Both, in
      that order: loopback alone passes while the front is broken, and the public
      name alone cannot tell you which of the two is at fault.

### The signature, which is what makes the update refusable

- [ ] **A deploy that cannot verify changes nothing.** This is blocked until
      [OWNER-ACTS.md](OWNER-ACTS.md) §1 has been performed —
      `server/cotenant/notes-server.pub` does not exist yet, so *every* deploy is
      currently in the refusing state. Once the key exists, walk the refusal
      deliberately: truncate the `.minisig`, run the deploy, and confirm the
      installed binary is unchanged. A signature check nobody has seen refuse is
      a signature check nobody knows is wired up
      ([ADR-081](decisions.md#adr-081--the-server-binary-is-signed-with-a-key-ci-never-holds-and-a-deploy-that-cannot-verify-changes-nothing)).
- [ ] **The private half is not in this repository and not in CI, and is backed
      up somewhere outside the tree.** It is a different key from the updater's
      on purpose: the updater's ships inside every installed desktop
      application, and one key that pushes both is one compromise with two blast
      radii.

### Minting a credential without an ssh session

Only if that deployment shape is in use.

- [ ] **`tura-credential` returns the secret over the pipe and leaves no file.**
      Mint one from the web administration screen, then look for the file: `token
      create` writes mode 0600 owned by whoever ran it, and the whole reason the
      wrapper exists rather than a sudoers line on `notes-server` is that the web
      user would be granted a file it cannot open. Confirm nothing is left behind.
- [ ] **The grant is one reviewed script with no path argument**, and the wrapper
      validates label, workspace, permissions and credential id itself — the
      caller is a web application, so "the caller validated it" is not a property
      this side may assume. Confirm a refused call never reaches the CLI.
- [ ] **The scope from that screen is always the whole workspace.** Subfolder
      scoping is a real feature of the server and not of that screen. Confirm the
      screen does not appear to offer it: a flag no interface sets is a flag that
      gets set wrong.

### Audit, and what it must never contain

- [ ] **Grep the audit for what should not be there.** After a session of real
      use: no `Authorization` value, no note text, no query text, no plaintext
      token, no note path. What *should* be there is the credential UUID, the
      peer, the operation, the outcome, the request UUID and a short route hash —
      enough to correlate authorship without logging what was written.
- [ ] **`X-Request-Id` on a client response matches a line in the audit.** That
      correlation is the entire support story; check it once rather than assuming
      it.
- [ ] **Rotation holds at five segments.** Generate enough traffic to roll one
      and confirm the oldest is dropped rather than the disk filling.

### Upgrading, and the one move that is never allowed

- [ ] **A complete offline backup precedes the upgrade**, and a failed upgrade is
      answered by restoring a compatible backup into a **fresh** directory with
      the compatible older binary. Walk it once on a throwaway data directory.
      **Never ask an older server to overwrite future state** — that is the move
      with no recovery, and the walk exists so the first time it is considered is
      not the night it is needed.
- [ ] **Repeat the whole of this page on the following release.**
