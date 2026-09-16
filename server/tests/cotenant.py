#!/usr/bin/env python3
"""Real TCP acceptance for a co-tenant deployment: loopback, behind a foreign TLS front.

`server/compose.yml` assumes the host is the server's: Caddy takes 80 and 443 and
`notes-server` sits on a private Docker address that only Caddy can reach. A host
that already serves a site has neither port to give, and that is the host this
project actually has — the one behind samirhv.com.br. The supported answer is the
native binary on loopback with the existing front proxying one name to it, which
is `NOTES_SERVER_TRUSTED_PROXY=127.0.0.1`.

That configuration has properties the templates in `server/cotenant/` depend on,
and which are invisible until something exercises them: `/healthz` is behind the
proxy gate rather than in front of it, a missing `X-Forwarded-Proto` is refused
rather than downgraded, and an `Origin` header is refused outright. Each one is
a way for a plausible front-end configuration to produce a server that answers
nothing, so each one is asserted here.

Creates only a disposable workspace under a temporary directory.
"""
import json
import pathlib
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
BINARY = ROOT / "target/debug/notes-server"
PROXY = {"X-Forwarded-Proto": "https"}

repository_before = sorted(p.name for p in ROOT.iterdir())

if not BINARY.exists():
    sys.exit("build it first: cargo build -p notes-server")

with tempfile.TemporaryDirectory() as temp:
    temp = pathlib.Path(temp)
    data = temp / "data"
    env = dict(os.environ, NOTES_SERVER_DATA=str(data))
    env.pop("NOTES_SYNC_CA_FILE", None)

    def cli(*args):
        return subprocess.check_output([str(BINARY), *args], env=env,
                                       stderr=subprocess.PIPE).decode().strip()

    cli("workspace", "create", "cotenant")
    cli("token", "create", "front", "cotenant", ".",
        "read,create,update,move,delete,search", str(temp / "front.secret"))
    token = (temp / "front.secret").read_text()

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    # Exactly what server/cotenant/notes-server.service sets.
    env["NOTES_SERVER_BIND"] = f"127.0.0.1:{port}"
    env["NOTES_SERVER_TRUSTED_PROXY"] = "127.0.0.1"
    base = f"http://127.0.0.1:{port}"

    def request(method, path, value=None, headers=None, auth=True):
        h = {"Content-Type": "application/json"}
        if auth:
            h["Authorization"] = "Bearer " + token
        h.update(headers or {})
        req = urllib.request.Request(base + path, method=method, headers=h,
                                     data=None if value is None else json.dumps(value).encode())
        try:
            response = urllib.request.urlopen(req, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, json.load(response)

    proc = subprocess.Popen([str(BINARY), "serve"], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                if request("GET", "/healthz", headers=PROXY, auth=False)[0] == 200:
                    break
            except (urllib.error.URLError, ConnectionError, ValueError):
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError("the co-tenant server did not become healthy")

        # `/healthz` is checked AFTER the proxy gate, so the obvious systemd or
        # monitoring probe — plain curl at the loopback port — reports a server
        # that is refusing everything as a server that is down. The health check
        # has to carry the header, and the template says so because of this line.
        status, _, body = request("GET", "/healthz", auth=False)
        assert status == 403 and body["error"] == "https_required", (status, body)

        # A front that terminates TLS and forwards without the header produces a
        # server that answers 403 to every route, including the one an operator
        # would use to decide whether the server or the proxy is at fault.
        status, _, body = request("GET", "/v1/workspaces", headers={"X-Forwarded-Proto": "http"})
        assert status == 403 and body["error"] == "https_required", (status, body)

        status, headers, body = request("GET", "/v1/workspaces", headers=PROXY)
        assert status == 200, (status, body)
        assert [w["name"] for w in body["workspaces"]] == ["cotenant"], body
        # HSTS appears only when a trusted proxy is configured; its presence is
        # how this mode differs from the loopback-only development default.
        assert headers["strict-transport-security"] == "max-age=31536000", dict(headers)

        # `proxy_set_header Origin ""` in the nginx template is not decoration:
        # any front that passes a browser's Origin through refuses the request.
        status, _, body = request("GET", "/v1/workspaces",
                                  headers={**PROXY, "Origin": "https://notes.example.com"})
        assert status == 403 and body["error"] == "browser_origin_denied", (status, body)

        # The point of the whole arrangement: the bytes land as an ordinary .md
        # file in an ordinary directory on that host, which is ADR-001 holding on
        # the server side too. Nothing about being remote makes it a database row.
        text = "# Remote\n\nStored as a file.\n"
        status, _, body = request("POST", "/v1/workspaces/cotenant/notes",
                                  {"path": "remote.md", "text": text},
                                  headers={**PROXY, "If-None-Match": "*"})
        assert status == 201, (status, body)
        on_disk = data / "workspaces/cotenant/remote.md"
        assert on_disk.read_text() == text, on_disk.read_text()

        status, _, body = request("GET", "/v1/workspaces/cotenant/notes/remote.md", headers=PROXY)
        assert status == 200 and body["text"] == text, (status, body)
    finally:
        proc.terminate()
        proc.wait(timeout=15)

# The templates are the deployment. A directive dropped from one of them fails
# the same way a missing one always has — silently, in production, as a server
# that answers 403 to everything — so the properties proven above are asserted
# against the files that are supposed to produce them.
cotenant = ROOT / "server/cotenant"
unit = (cotenant / "notes-server.service").read_text()
for line in ["Environment=NOTES_SERVER_BIND=127.0.0.1:8787",
             "Environment=NOTES_SERVER_TRUSTED_PROXY=127.0.0.1",
             "Environment=NOTES_SERVER_DATA=/var/lib/notes-server",
             "StateDirectory=notes-server"]:
    assert line in unit, f"notes-server.service no longer sets: {line}"

nginx = (cotenant / "nginx-tura.conf").read_text()
for line in ["proxy_set_header X-Forwarded-Proto https;",
             "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
             'proxy_set_header Origin "";',
             "proxy_pass http://127.0.0.1:8787;",
             "client_max_body_size 16m;"]:
    assert line in nginx, f"nginx-tura.conf no longer sets: {line}"

apache = (cotenant / "apache-tura.conf").read_text()
for line in ['RequestHeader set X-Forwarded-Proto "https"',
             "RequestHeader unset Origin",
             "ProxyPass        / http://127.0.0.1:8787/",
             "LimitRequestBody 16777216"]:
    assert line in apache, f"apache-tura.conf no longer sets: {line}"
# HTTP-only on purpose: `certbot --apache` clones this vhost into the TLS one.
# A hand-written *:443 naming a certificate that is not on disk yet stops Apache
# from starting, which on a co-tenant host takes the other sites with it.
# A directive, not the comment that explains why there isn't one.
tls_vhosts = [l for l in apache.splitlines()
              if l.strip().startswith("<VirtualHost") and ":443" in l]
assert not tls_vhosts, "the Apache template hand-writes a TLS vhost again"
assert "ProxyPass /.well-known/acme-challenge/ !" in apache, "certbot's challenge path is proxied away"

caddy = (cotenant / "Caddyfile").read_text()
for line in ["reverse_proxy 127.0.0.1:8787", "header_up -Origin", "max_size 16MB"]:
    assert line in caddy, f"the co-tenant Caddyfile no longer sets: {line}"

# ── The credential wrapper the site's admin screen calls ────────────────────
# It runs as `notes` behind one sudoers line and is handed arguments by a web
# application, so "the caller validated it" is not a property it may assume.
# Exercised against a fake notes-server: what is asserted is the validation and
# the handling of the secret, not the CLI it wraps.
wrapper = ROOT / "server/cotenant/tura-credential"
assert os.access(wrapper, os.X_OK), "tura-credential is not executable"

with tempfile.TemporaryDirectory() as temp:
    temp = pathlib.Path(temp)
    fake = temp / "notes-server"
    log = temp / "calls.log"
    fake.write_text(
        "#!/bin/sh\n"
        f'echo "$@" >> {log}\n'
        'if [ "$1" = token ] && [ "$2" = create ]; then\n'
        '  umask 077; printf %s "the-secret-bytes" > "$7"; echo "credential-uuid"\n'
        "fi\n"
    )
    fake.chmod(0o755)
    env = dict(os.environ, TURA_CREDENTIAL_BINARY=str(fake), TURA_CREDENTIAL_DATA=str(temp / "data"))

    def wrap(*args):
        # cwd inside the temporary directory, deliberately. The first version of
        # this suite ran here, and its fake CLI wrote the fixture secret to the
        # wrong argument — so a file named `read,create,update,move,delete`
        # appeared in the repository root and `git add -A` committed it. A test
        # that writes relative paths should not be able to reach the checkout.
        return subprocess.run(["sh", str(wrapper), *args], env=env, cwd=temp,
                              capture_output=True, text=True)

    created = wrap("create", "samir", "personal", "read,create,update,move,delete")
    assert created.returncode == 0, created.stderr
    assert created.stdout == "the-secret-bytes", repr(created.stdout)
    # The only durable copy is the one just handed over.
    assert not list(temp.glob("tura-credential.*")), "the secret file outlived the call"
    assert "token create samir personal . read,create,update,move,delete" in log.read_text()

    # A web application supplies these. Each one reaches a shell and the server's
    # own argument list, and each is refused here rather than there.
    for bad in [("create", "samir; rm -rf /", "personal", "read"),
                ("create", "samir", "Personal", "read"),
                ("create", "samir", "personal", "read,root"),
                ("create", "samir", "personal", "read,create,admin"),
                ("create", "samir", "personal", "READ"),
                ("create", "samir", "personal"),
                ("revoke", "not-a-uuid"),
                ("revoke",),
                ("list", "extra"),
                ("destroy", "everything"),
                ()]:
        refused = wrap(*bad)
        assert refused.returncode == 2, f"accepted {bad!r}: {refused.stdout!r}"

    before = log.read_text()
    wrap("create", "samir", "personal", "read,delete-everything")
    assert log.read_text() == before, "a refused call still reached notes-server"

    ok = wrap("revoke", "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0")
    assert ok.returncode == 0, ok.stderr
    assert "token revoke 0f1e2d3c" in log.read_text()

# ── The server-side deploy script ───────────────────────────────────────────
deploy = (cotenant / "deploy-server.sh").read_text()
assert os.access(cotenant / "deploy-server.sh", os.X_OK), "deploy-server.sh is not executable"

# It derives the release that carries the binary from version.md rather than
# asking the GitHub API, because assets are published on minor bumps. The
# derivation is one line of shell and wrong by one character is a 404 at 2am.
for version, expected in [("1.1.26", "1.1.0"), ("1.1.0", "1.1.0"), ("2.0.5", "2.0.0"),
                          ("0.20.20", "0.20.0"), ("10.11.12", "10.11.0")]:
    derived = subprocess.run(["sh", "-c", f'version={version}; echo "${{version%.*}}.0"'],
                             capture_output=True, text=True, check=True).stdout.strip()
    assert derived == expected, f"{version} derived {derived}, expected {expected}"

# The notes live in the data directory. A deploy that writes there is a deploy
# that eventually loses somebody's notes, so it may read the path and never
# write it — backup and restore are separate, explicit operations.
for line in deploy.splitlines():
    bare = line.split("#", 1)[0]
    if "/var/lib/notes-server" not in bare:
        continue
    assert not any(bare.lstrip().startswith(w) for w in ("install", "rm ", "mv ", "cp ", "chown", "chmod", "tar ")), \
        f"deploy-server.sh writes into the data directory: {line.strip()}"

# The checksum is verified before anything reaches /usr/local/bin: a truncated
# tarball installs a binary that exists and does not execute.
assert deploy.index("sha256sum -c") < deploy.index('install -m 0755 "$tmp/notes-server"'), \
    "the binary is installed before its checksum is verified"

# It does not touch Apache at all. The vhost is co-managed by certbot, which
# CLONES it into `-le-ssl.conf` at issuance — so reinstalling the original would
# update the half almost nobody reaches and leave TLS on the old directives, in
# silence. Half a configuration updated is worse than none, because nobody
# suspects it. Warn, and leave it to a human.
for forbidden in ["systemctl reload apache2", "systemctl restart apache2", "a2ensite"]:
    for line in deploy.splitlines():
        assert forbidden not in line.split("#", 1)[0], f"deploy-server.sh now touches Apache: {line.strip()}"
assert "$VHOST" in deploy, "the vhost is no longer even compared"

# And the guard for the whole class, not just that one mistake: nothing in this
# suite may add a file to the checkout. A stray write is invisible in a passing
# run and arrives in the next commit.
assert sorted(p.name for p in ROOT.iterdir()) == repository_before, \
    "this suite wrote into the repository root"

print("co-tenant loopback deployment smoke passed")
