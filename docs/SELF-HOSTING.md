# Run your own sync server

> **Status:** `ACTIVE` · Added in 1.1.20. The server is milestone 0.5; the
> desktop pairing panel is 0.6.

**What this gets you.** Your notes on more than one machine, without an account
anywhere and without a company in the middle. The server keeps them the way the
app does: `.md` files in ordinary directories, on a machine you control.

**What it does not get you: end-to-end encryption.** The server reads its own
notes. Anyone with operating-system access to its data directory has them, and
so does anyone who takes the machine. That is a stated boundary
([ADR-043](decisions.md#adr-043--a-separate-owner-operated-rest-server-reuses-core-policy)),
not a gap to route around — do not put notes on a server you would not trust
with the notes.

**You do not need any of this to use Tura Notes.** One machine, one folder, no
server, is the normal case. A server is what you add when you want a second
machine.

---

## What you need

- **A Linux machine that is on when you want to sync.** A small VPS is enough;
  so is a machine at home you leave running.
- **A DNS name pointing at it** — `notes.example.com`, not a bare IP address.
  The app requires HTTPS, and a certificate is issued against a name. (The one
  exception is a tailnet; see [Other ways to run it](#other-ways-to-run-it).)
- **TCP 80 and 443 reachable**, for the certificate and for sync itself.
- **Docker with the Compose plugin, and git.**

Disk is your notes plus their history. Markdown is small: a few thousand notes
is tens of megabytes, not gigabytes.

---

## The short path

Five steps. The first three are on the server, the last two in the app.

### 1. Start it

```sh
git clone https://github.com/samirhvbr/tura-notes.git
cd tura-notes
export NOTES_DOMAIN=notes.example.com
docker compose -f server/compose.yml up -d --build
```

Caddy obtains the certificate itself, which is why the name has to resolve and
the two ports have to be open *before* this runs. When it is up:

```sh
curl https://notes.example.com/healthz
```

`{"status":"ok"}` means the server is answering through TLS. Nothing else is
exposed: the notes process listens on a private address only Caddy can reach.

### 2. Create a workspace

```sh
docker compose -f server/compose.yml exec notes-server \
  notes-server workspace create personal
```

One workspace is one folder of notes. The name takes lowercase letters, digits,
`-` and `_`, up to 64 characters.

### 3. Create one credential per device

```sh
docker compose -f server/compose.yml exec notes-server \
  notes-server token create laptop personal . read,create,update,move,delete /tmp/laptop.secret
```

`laptop` is a label for your own benefit, `personal` is the workspace, `.` means
the whole workspace rather than a subfolder, and the list is the permissions
synchronization actually uses. Then take it off the server:

```sh
docker compose -f server/compose.yml cp notes-server:/tmp/laptop.secret ./laptop.secret
chmod 600 ./laptop.secret
```

Move that file to the device by a means you trust, then delete both transfer
copies. **Never paste the secret into a command line, a chat window or a note** —
it is a bearer secret, so whoever reads it is the device.

**One credential per device, always.** Two devices sharing one credential cannot
be told apart, which means the one you lose cannot be revoked without cutting off
the one you kept.

### 4. Point the app at it

At the top of the window there is a collapsible **Device sync** strip. Open it
and fill in **Pair or reconnect**.

**Start with Test connection, before you close anything.** Fill in just
**Server address** and **Credential file (outside notes)** and press it. It is
the one remote call that runs with your workspace open, because it writes
nothing, and it answers the two questions the rest of this page cannot:

- **Connected** — the address reaches your server and the credential works. It
  also fills in **Server workspace** for you, because the credential decides
  which workspace it is for and the server is the only thing that knows the
  name. If that field already says something different, you are told rather than
  overruled.
- Anything else names the step that failed — an address that cannot be used, a
  credential file the wrong permissions or the wrong contents, nothing
  answering, a credential the server rejected, or *something answered and it was
  not this API*. That last one is the common case on a host that already serves
  other sites: the name resolves, the web server answers, and what answers is
  the default site rather than Tura.

**Then close your workspace.** Pairing is disabled while a folder is open, and
the panel says so.

| Field | What goes in it |
|---|---|
| Local notes folder | the folder holding your `.md` files |
| Private sync queue folder (outside notes) | a new, empty folder somewhere else — bookkeeping, and it must not live inside your notes |
| Credential file (outside notes) | the `.secret` file you moved to this device |
| Server address | `https://notes.example.com` — the bare origin, no path, no trailing anything |
| Server workspace | `personal` |
| Subfolder scope (optional) | empty syncs the whole workspace |
| Pairing mode | below — this is the one to get right |

**Pairing mode** says what the two sides are to each other:

- **Send local folder to empty inbox** — the first device. Your notes go up, and
  the server's inbox for that workspace has to be empty.
- **Receive into empty local folder** — a second device with nothing to keep.
  Point it at an empty folder.
- **Reconcile existing folders** — both sides already have notes. You get a
  preview listing what would be sent, received, linked as already identical, or
  flagged as a conflict, and **nothing happens until you press Confirm this
  pairing**.

Then **Create pairing and review**.

### 5. Turn transfer on

In **Background transfer**: enable scheduled transfer, choose an interval
(120–3600 seconds), and decide whether to allow metered connections and battery
power. **Save transfer settings**. **Transfer now** runs one immediately.

**Transfer moves revisions; it does not touch your folder.** Writing received
notes into it is a separate, explicit step — **Apply received files** — with the
workspace closed. Nothing arrives underneath you while you are typing, which is
the whole reason the two are separate.

---

## Keeping it

**Back it up, and back up the whole data tree** — not just the notes directory
and not just a database file. Stop the server first, and stop anything else
writing in those directories. The procedure, including restoring into a fresh
directory and verifying it before switching over, is in
[SERVER-0.5.md](SERVER-0.5.md#backup-restore-and-upgrades). Sync is not a backup:
it copies your mistakes to the other machine promptly and correctly.

**When a device is lost, revoke its credential** — do not rotate the workspace:

```sh
docker compose -f server/compose.yml exec notes-server notes-server token revoke <uuid>
```

`token list` prints the labels and UUIDs, redacted. Revocation takes effect
without a restart, and the other devices are untouched.

**Upgrading:** take a complete offline backup first, and never point an older
server at newer data.

---

## Other ways to run it

The three are described in full in
[SERVER-0.5.md](SERVER-0.5.md); this is what each one is for.

**Your server already serves a website.** Then it has neither port 80 nor 443 to
give, and the Compose stack above will not start. Run the binary on loopback
under systemd and let the site's existing nginx, Apache or Caddy proxy one name
to it: [Co-tenant deployment](SERVER-0.5.md#co-tenant-deployment-behind-an-existing-site),
with a unit file and all three front templates in
[`server/cotenant/`](../server/cotenant/).

**You want no public surface at all.** Put the server on a tailnet and let the
name resolve to its `100.64.x.y` address. The app treats that range as private,
so you must tick **Allow private network addresses for this server** when
pairing — and the price is that a phone off the tailnet does not sync. Changing
your mind later means pairing every device again.

**You would rather not use Docker.** The Linux release carries a standalone
`notes-server` archive, its SHA-256 and a `.minisig` signature. It is attached
to **minor** releases (`X.Y.0`), not to patches, so take the newest `X.Y.0` from
[Releases](https://github.com/samirhvbr/tura-notes/releases) — x86_64 only;
another architecture builds with `cargo build --locked -p notes-server`. The
native configuration is `NOTES_SERVER_DATA`, `NOTES_SERVER_BIND` and
`NOTES_SERVER_TRUSTED_PROXY`, and [Local operation](SERVER-0.5.md#local-operation)
covers it.

**Check the signature, not only the checksum.** The `.sha256` beside the archive
comes from the same URL as the archive, so it tells you the download arrived
intact and nothing about where it came from — whoever could serve you a
different archive could serve its digest too. The `.minisig` is signed with a
key that CI never holds
([ADR-081](decisions.md#adr-081--the-server-binary-is-signed-with-a-key-ci-never-holds-and-a-deploy-that-cannot-verify-changes-nothing)),
and its public half is committed at
[`server/cotenant/notes-server.pub`](../server/cotenant/notes-server.pub):

```bash
minisign -Vm notes-server-X.Y.0-x86_64-linux.tar.gz -p server/cotenant/notes-server.pub
```

`server/cotenant/deploy-server.sh` does this for you and refuses to install
anything that does not verify — without stopping the server already running,
because a signature that does not match is far more often a publishing mistake
than an attack.

### Signing a release (maintainer)

Only the person holding the private half does this, and it is why the deploy can
trust a binary at all. The key is generated once and **never** enters the
repository or CI:

```bash
tools/sign-server-release.sh init     # once; writes the public half into the repo
tools/sign-server-release.sh 1.5.0    # per minor release
```

`init` refuses to overwrite an existing key: regenerating over one in use
invalidates every signature already published, and the symptom shows up in a
deploy, on a host that is serving. The private half belongs in a backup outside
the repository — losing it means rotating the key and re-signing, which is a
commit of the new public half and a re-run of the second command.

---

## When it does not work

**The app refuses the address.** It takes a bare `https://` origin: no path, no
query, no username. `https://notes.example.com` is right,
`https://notes.example.com/v1` and `https://user@notes.example.com` are not. A
plain `http://` origin is refused outright except at a literal loopback address.

**The app says the address is private.** The server's name resolves into a
private or carrier-grade range — `10.x`, `192.168.x`, `172.16–31.x` or
`100.64–127.x`. That is the tailnet case above: tick **Allow private network
addresses for this server**, or give the server a public name.

**Everything returns 403 `https_required`.** The server is behind a proxy that
is not sending `X-Forwarded-Proto: https`. This cannot happen with the Compose
stack, which configures Caddy for you; it is the usual mistake when putting the
server behind a front of your own. Note that `/healthz` is behind that same
check, so a health probe failing is not evidence the server is down.

**A note or an attachment fails with 413.** A front of your own is capping the
request body below the server's 16 MiB. The templates in
[`server/cotenant/`](../server/cotenant/) set it correctly.

**Sync stops with 429, and one busy device locks the others out.** There are two
budgets in a one-minute window: 60 requests per credential, and 120 per client
address. The second is the one that bites, because **behind a front that does
not forward the client's address, all your devices share one bucket** — past
three active devices that is tighter than the per-credential limit each of them
already has, so the machine doing a first sync starves the rest.

Caddy and Apache's `mod_proxy` append `X-Forwarded-For` on their own; **nginx
does not**, and the template in [`server/cotenant/`](../server/cotenant/) carries
the line that makes it. If a CDN proxies the name as well, there are two proxies
in front and the server has to be told so:

```sh
NOTES_SERVER_TRUSTED_HOPS=2
```

Set it to the number of proxies that are **really** there — default 1, maximum 8.
Too high reads an entry the client supplied, which makes the budget forgeable;
too low collapses every device back into one bucket, which is the symptom you
started with.

**Everything works, and the connection is not as private as it looks.** If a CDN
proxies the name, check that it is in **Full (strict)** rather than Flexible.
Under Flexible the browser's half is encrypted, the hop from the CDN to your
server is plain HTTP, and the front still asserts `X-Forwarded-Proto: https` — so
the server sends HSTS and accepts the request, having been lied to by your own
configuration. **Nothing on this machine can detect that**, which is why it is a
thing to go and look at rather than a thing that will fail loudly. Setting the
DNS record to DNS-only moves TLS termination back to your server, and is the
choice to make if it matters that the CDN can read the notes in transit.

**`curl https://.../healthz` never answers.** The certificate has not been
issued — the name does not resolve to this machine yet, or 80 is closed.
`docker compose -f server/compose.yml logs caddy` says which.
