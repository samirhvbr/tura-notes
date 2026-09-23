#!/usr/bin/env python3
"""THIRD-PARTY-NOTICES.md: the licenses of everything the shipped binaries and
the webview bundle contain (R6-33).

Every package said "MIT (c) Samir" while statically linking hundreds of crates,
six of them MPL-2.0, and shipping a JavaScript bundle of npm packages, and not
one of their required notices went anywhere. This file is generated from the
lockfiles, committed, installed by every package format, and kept current by
the gate the same way the generated TypeScript is.

    tools/third-party.py            regenerate THIRD-PARTY-NOTICES.md
    tools/third-party.py --check    fail if it is stale or a license is not allowed

Rust: the normal (not build, not dev) dependency closure of the four binaries
that ship. npm: the production dependency closure of `apps/notes-app`, read
from `node_modules`; `--check` without `node_modules` checks the Rust half and
says so.
"""
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "THIRD-PARTY-NOTICES.md"
APP = ROOT / "apps/notes-app"
SHIPPED = {"notes-app", "notes-server", "notes-mcp", "notes-sync-client"}

# A permissive or weak-copyleft license whose terms this distribution meets by
# carrying the notice and, for MPL-2.0, naming where the unmodified source is.
ALLOWED = {
    "MIT", "MIT-0", "Apache-2.0", "Apache-2.0 WITH LLVM-exception", "BSD-2-Clause",
    "BSD-3-Clause", "ISC", "Zlib", "Unicode-3.0", "Unicode-DFS-2016", "MPL-2.0",
    "CC0-1.0", "0BSD", "BSL-1.0", "Unlicense", "CDLA-Permissive-2.0", "BlueOak-1.0.0",
}
NOTICE_FILE = re.compile(r"^(licen[cs]e|copying|notice)([-._].*)?$", re.I)


def allowed(expr: str) -> bool:
    """An SPDX expression is allowed if some OR-branch has every AND-term allowed."""
    expr = expr.replace("/", " OR ").strip("() ")
    for branch in re.split(r"\s+OR\s+", expr):
        terms = [t.strip("() ") for t in re.split(r"\s+AND\s+", branch)]
        if all(t in ALLOWED for t in terms):
            return True
    return False


def texts(directory: pathlib.Path) -> list[str]:
    found = []
    if directory.is_dir():
        for f in sorted(directory.iterdir()):
            if f.is_file() and NOTICE_FILE.match(f.name):
                found.append(f.read_text(errors="replace").strip())
    return found


def rust() -> list[dict]:
    meta = json.loads(subprocess.run(
        ["cargo", "metadata", "--format-version", "1", "--locked"],
        cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    packages = {p["id"]: p for p in meta["packages"]}
    nodes = {n["id"]: n for n in meta["resolve"]["nodes"]}
    members = set(meta["workspace_members"])
    todo = [i for i in members if packages[i]["name"] in SHIPPED]
    seen = set()
    while todo:
        pid = todo.pop()
        if pid in seen:
            continue
        seen.add(pid)
        for dep in nodes[pid]["deps"]:
            if any(k["kind"] is None for k in dep["dep_kinds"]):
                todo.append(dep["pkg"])
    out = []
    for pid in seen - members:
        p = packages[pid]
        out.append({
            "name": p["name"], "version": p["version"], "license": p.get("license") or "",
            "source": p.get("repository") or f"https://crates.io/crates/{p['name']}",
            "texts": texts(pathlib.Path(p["manifest_path"]).parent), "ecosystem": "Rust",
        })
    return out


def npm() -> list[dict] | None:
    modules = APP / "node_modules"
    if not modules.is_dir():
        return None
    tree = json.loads(subprocess.run(
        ["npm", "ls", "--omit=dev", "--all", "--json", "--long"], cwd=APP,
        capture_output=True, text=True).stdout or "{}")
    found = {}

    def walk(deps):
        for name, d in (deps or {}).items():
            # An optional peer nobody installed is listed and absent: it is not
            # in the bundle, so it has nothing to declare.
            path = d.get("path")
            if not path or not pathlib.Path(path).is_dir() or d.get("missing"):
                continue
            if (name, d.get("version")) not in found:
                found[(name, d.get("version"))] = pathlib.Path(path)
                walk(d.get("dependencies"))
    walk(tree.get("dependencies"))
    out = []
    for (name, version), directory in sorted(found.items(), key=lambda x: (x[0][0], x[0][1] or "")):
        manifest = directory / "package.json"
        pkg = json.loads(manifest.read_text()) if manifest.is_file() else {}
        lic = pkg.get("license") or ""
        if isinstance(lic, dict):
            lic = lic.get("type", "")
        repo = pkg.get("repository") or ""
        if isinstance(repo, dict):
            repo = repo.get("url", "")
        out.append({
            "name": name, "version": version or pkg.get("version", ""), "license": lic,
            "source": repo or f"https://www.npmjs.com/package/{name}",
            "texts": texts(directory), "ecosystem": "npm",
        })
    return out


def render(items: list[dict], npm_included: bool) -> str:
    items = sorted(items, key=lambda i: (i["ecosystem"], i["name"].lower(), i["version"]))
    lines = [
        "# Third-party notices",
        "",
        "Tura Notes is MIT-licensed (see `LICENSE`). The binaries and the application",
        "bundle also contain the packages below, each under its own license. This file",
        "is generated by `tools/third-party.py` from `Cargo.lock` and",
        "`apps/notes-app/package-lock.json`; do not edit it by hand.",
        "",
        "## MPL-2.0 components",
        "",
        "These are used unmodified. Their source is available at the locations named",
        "here, as MPL-2.0 section 3.2 requires.",
        "",
    ]
    mpl = [i for i in items if "MPL-2.0" in i["license"]]
    lines += [f"- `{i['name']}` {i['version']} — {i['source']}" for i in mpl] or ["- none"]
    lines += ["", "## Packages", "", "| Package | Version | License | Source |", "|---|---|---|---|"]
    lines += [f"| {i['ecosystem']}: `{i['name']}` | {i['version']} | {i['license'] or 'UNKNOWN'} | {i['source']} |"
              for i in items]
    if not npm_included:
        lines += ["", "*npm packages were not listed: `node_modules` was absent when this was generated.*"]
    lines += ["", "## License texts", "",
              "Each text is given once, followed by the packages that ship it.", ""]
    groups: dict[str, tuple[str, list[str]]] = {}
    for i in items:
        for text in i["texts"]:
            key = hashlib.sha256(text.encode()).hexdigest()
            groups.setdefault(key, (text, []))[1].append(f"{i['name']} {i['version']}")
    for text, users in sorted(groups.values(), key=lambda g: g[1][0].lower()):
        lines += [f"### {', '.join(users)}", "", "```text", text.replace("```", "'''"), "```", ""]
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    check = "--check" in sys.argv
    items = rust()
    js = npm()
    problems = [f"{i['ecosystem']} {i['name']} {i['version']}: license '{i['license'] or 'none'}' is not allowed"
                for i in items + (js or []) if not allowed(i["license"])]
    if js is None and check:
        print("third-party: node_modules absent, checking the Rust half only", file=sys.stderr)
    if check:
        committed = OUT.read_text() if OUT.exists() else ""
        if js is not None and render(items + js, True) != committed:
            problems.append("THIRD-PARTY-NOTICES.md is stale: run tools/third-party.py")
        if js is None:
            # Without node_modules only the Rust rows can be compared: exactly
            # these, and no others.
            rows = lambda text: sorted(l for l in text.splitlines() if l.startswith("| Rust: "))
            if rows(render(items, False)) != rows(committed):
                problems.append("THIRD-PARTY-NOTICES.md is stale: run tools/third-party.py")
    else:
        OUT.write_text(render(items + (js or []), js is not None))
    for p in problems:
        print(p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
