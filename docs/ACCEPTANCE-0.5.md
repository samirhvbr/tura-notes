# Milestone 0.5 acceptance — self-hosting

> **Status:** ACTIVE · Implemented in 0.18.0; owner acceptance remains open.

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

The server integration suite covers conditional CRUD, durable append retries,
scopes, review mode, revoked credentials, bounded bodies, pagination, rate
limits, proxy peer checks, audit redaction, concurrent writes, future schemas,
backup exclusions and restored identities. The native TCP smoke exercises an
actual process and offline restore. The server CI job builds the container,
validates OpenAPI and exercises the API through certificate-verified Caddy TLS.
The project gate also runs the existing filesystem/core/frontend checks.

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

No public deployment, pairing UI, desktop synchronization, remote MCP or E2EE
is claimed by this milestone. Mobile completion remains in ACCEPTANCE-0.4.md.
