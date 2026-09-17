#!/usr/bin/env python3
"""Remote MCP over the real server process, with a real credential.

Separate from `smoke.py` on purpose, and not because the flows differ: that suite
already spends most of a 120/min per-IP budget, and appending to it would make
this test the thing that pushes it over. Its own process means its own rate
buckets, so neither can starve the other.

Creates only disposable test workspaces. Credentials stay in private temporary
files and are never printed.
"""
import json
import os
import pathlib
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
binary = str(root / "target/debug/notes-server")
env = os.environ.copy()


def run(args):
    return subprocess.check_output(args, cwd=root, env=env, stderr=subprocess.PIPE).decode().strip()


with tempfile.TemporaryDirectory() as temp:
    temp = pathlib.Path(temp)
    env["NOTES_SERVER_DATA"] = str(temp / "data")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env["NOTES_SERVER_BIND"] = f"127.0.0.1:{port}"
    base = f"http://127.0.0.1:{port}"

    def cli(*args):
        return run([binary, *args])

    cli("workspace", "create", "agents")
    (temp / "data/workspaces/agents/notes").mkdir(parents=True, exist_ok=True)
    (temp / "data/workspaces/agents/private.md").write_text("OUT_OF_SCOPE_MARKER\n")
    cli("token", "create", "wide", "agents", ".", "read,create,update,search",
        str(temp / "wide.secret"))
    cli("token", "create", "narrow", "agents", "notes", "read", str(temp / "narrow.secret"))
    wide = (temp / "wide.secret").read_text()
    narrow = (temp / "narrow.secret").read_text()

    proc = subprocess.Popen([binary, "serve"], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def rpc(message, token=None, headers=None, expect=200):
        request = urllib.request.Request(
            base + "/v1/mcp",
            data=json.dumps(message).encode(),
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + (token or wide),
                     **(headers or {})},
            method="POST")
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            assert response.status == expect, f"{response.status} != {expect} for {message.get('method')}"
            raw = response.read()
            return (json.loads(raw) if raw else None), response.headers

    def call(name, arguments, token=None):
        answer, _ = rpc({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                         "params": {"name": name, "arguments": arguments}}, token)
        result = answer["result"]
        # The tool's own payload is a JSON document carried as MCP text content.
        return json.loads(result["content"][0]["text"]), result["isError"]

    try:
        for _ in range(100):
            try:
                urllib.request.urlopen(base + "/healthz", timeout=5).close()
                break
            except (urllib.error.URLError, ConnectionError):
                time.sleep(0.1)
        else:
            raise RuntimeError("server did not become healthy")

        # The handshake answers, and the session header is echoed rather than
        # demanded — there is no connection here to keep a session on.
        hello, headers = rpc({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                              "params": {"protocolVersion": "2025-11-25"}},
                             headers={"Mcp-Session-Id": "s-1"})
        assert hello["result"]["protocolVersion"] == "2025-11-25"
        assert hello["result"]["serverInfo"]["name"] == "notes-mcp"
        assert headers["Mcp-Session-Id"] == "s-1"

        # A notification carries no id and no reply.
        empty, _ = rpc({"jsonrpc": "2.0", "method": "notifications/initialized"}, expect=202)
        assert empty is None

        # tools/list is answered without a prior initialize on this request, and
        # carries exactly what these four permissions admit.
        listed, _ = rpc({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        names = sorted(t["name"] for t in listed["result"]["tools"])
        assert names == ["notes_append", "notes_create", "notes_list", "notes_read",
                         "notes_search", "notes_update"], names

        # Create, then read back the base_rev the next write needs.
        created, failed = call("notes_create", {"path": "notes/agent.md", "text": "first\r\n"})
        assert not failed, created
        read, failed = call("notes_read", {"path": "notes/agent.md"})
        # The core hands agents normalized text and keeps the file's own line
        # endings on disk. MCP must not be the layer that loses that.
        assert not failed and read["text"] == "first\n", read
        assert read["base_rev"]["size"] == 7, read["base_rev"]
        base_rev = read["base_rev"]

        # The base_rev a read handed out is accepted by the update that follows.
        updated, failed = call("notes_update",
                               {"path": "notes/agent.md", "text": "second\n",
                                "base_rev": base_rev})
        assert not failed, updated

        # And replaying the same one is refused, because it is stale now.
        stale, failed = call("notes_update",
                             {"path": "notes/agent.md", "text": "third\r\n",
                              "base_rev": base_rev})
        assert failed, stale

        # Byte preservation survives the round trip: the note was created with
        # CRLF, the update was sent with LF, and the file still ends CRLF.
        on_disk = (temp / "data/workspaces/agents/notes/agent.md").read_bytes()
        assert on_disk == b"second\r\n", on_disk

        # A narrower credential is told about less, and cannot read above its
        # scope even by naming the path directly.
        listed, _ = rpc({"jsonrpc": "2.0", "id": 3, "method": "tools/list"}, narrow)
        assert sorted(t["name"] for t in listed["result"]["tools"]) == ["notes_list", "notes_read"]
        denied, failed = call("notes_read", {"path": "private.md"}, narrow)
        assert failed, denied
        assert "OUT_OF_SCOPE_MARKER" not in json.dumps(denied)

        # An unauthenticated call never reaches the catalogue.
        request = urllib.request.Request(
            base + "/v1/mcp", data=b'{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
            headers={"Content-Type": "application/json"}, method="POST")
        try:
            urllib.request.urlopen(request, timeout=10).close()
            raise AssertionError("an unauthenticated MCP call was answered")
        except urllib.error.HTTPError as error:
            assert error.code == 401, error.code

        print("remote MCP smoke passed")
    finally:
        proc.terminate()
        proc.wait(timeout=15)
