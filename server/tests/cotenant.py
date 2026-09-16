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

caddy = (cotenant / "Caddyfile").read_text()
for line in ["reverse_proxy 127.0.0.1:8787", "header_up -Origin", "max_size 16MB"]:
    assert line in caddy, f"the co-tenant Caddyfile no longer sets: {line}"

print("co-tenant loopback deployment smoke passed")
