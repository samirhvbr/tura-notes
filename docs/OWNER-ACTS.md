# The two acts only the owner can perform

> **Status:** `ACTIVE` · Written 17/09/2026 against the scripts as they are, not
> against what the queue says they are. Every command below was read out of
> `tools/sign-server-release.sh` and `.github/workflows/build.yml`; the one
> detail the queue had wrong is called out where it matters.

Neither of these is something an agent does. One holds a private key that must
never reach this repository or CI; the other publishes artifacts. What an agent
*can* do is make sure the steps are right before you spend a evening on them,
which is what this page is.

---

## 1. Sign the server binary

`server/cotenant/deploy-server.sh` refuses to install a tarball it cannot
verify, so until this is done the deploy changes nothing —
[ADR-081](decisions.md#adr-081--the-server-binary-is-signed-with-a-key-ci-never-holds-and-a-deploy-that-cannot-verify-changes-nothing).
Confirmed today: `server/cotenant/notes-server.pub` does not exist yet.

### Once, ever: generate the pair

```bash
tools/sign-server-release.sh init
```

It writes the private half to `~/.config/tura-notes/notes-server.key` (mode
`0600`, directory `0700`) and the public half to
`server/cotenant/notes-server.pub`. Override the private location with
`TURA_SERVER_KEY` if you keep keys elsewhere.

**It refuses rather than overwriting either half**, and that refusal is the whole
safety of the step: regenerating over a key in use silently invalidates every
signature already published, and the symptom appears on a host that is serving.

Then two things, in this order:

```bash
git add server/cotenant/notes-server.pub
# commit it with the usual X.Y.Z subject; the deploy verifies against this file
```

Back up the **private** half somewhere outside the tree. It is not in git by
design and it is not in CI by design: it is a separate key from the updater's,
because the updater's ships inside every installed desktop application, and one
key that pushes both desktop updates and server binaries is one compromise with
two blast radii.

### Per release: sign

```bash
tools/sign-server-release.sh 1.6.0
```

**Only `X.Y.0` is accepted, and this is where the queue was wrong.** It said
"sign the current version"; the script refuses anything that is not a minor,
because attachments are built on minor releases only (ADR-036) and a patch
Release carries none. At the time of writing the version to sign is **1.6.0**,
whose `notes-server-1.6.0-x86_64-linux.tar.gz` and its `.sha256` are both
attached — checked, not assumed.

What it does, in order, and why the order is the point:

1. Downloads the tarball and its `.sha256` from the Release.
2. **Verifies the checksum before signing.** Signing a truncated download
   publishes a valid signature over wrong bytes, which is worse than not signing:
   it passes the deploy's verification and installs a binary that does not run.
3. Signs with the private half.
4. **Verifies against the committed public half**, not against the key that just
   signed. This is what catches the wrong pair — an old key, a restored backup —
   here rather than on a host that is serving.
5. Uploads `…​.minisig` to the Release.

Prerequisites, both present on this machine: `minisign` and `gh`.

---

## 2. Recover the 1.4.0 attachments

`1.4.0` has **zero** attachments; `1.5.0` and `1.6.0` have fourteen each —
measured, and the queue item was corrected at 1.6.3 because it named the wrong
release. While 1.4.0 stays empty, `deploy-server.sh` derives `X.Y.0` and would
fetch a file that is not there.

The cause is fixed at 1.5.5: the cancelling concurrency moved down to the jobs
and is keyed by version, so a minor is no longer cancelled by the push that
follows it. What is left is recovering what was already lost.

```bash
gh workflow run build.yml --repo samirhvbr/tura-notes -f version=1.4.0
```

The `version` input exists for exactly this and defaults to `version.md` at
`HEAD` when omitted — which is **not** what you want here, so pass it.

Then confirm, rather than assuming the run implies the artifacts:

```bash
gh release view 1.4.0 --json assets -q '.assets | length'   # expect 14, not 0
```

---

## What neither of these is

Neither is acceptance. A signed binary and a recovered attachment are
preconditions for the 0.5 walk, not evidence of it — no acceptance in this
repository is inferred from a command succeeding, which is written into
`.continue/README.md` and holds here too.
