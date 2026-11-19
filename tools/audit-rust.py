#!/usr/bin/env python3
"""Audit the full lockfile and check whether chrono is used on any target."""

import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
packages = subprocess.check_output(
    ["cargo", "tree", "--color", "never", "--locked", "--workspace", "--all-features", "--target", "all",
     "--prefix", "none", "--format", "{p}"],
    cwd=root, text=True,
).splitlines()
if not packages:
    sys.exit("cargo tree returned no packages")

audit = ["cargo", "audit", "--deny", "warnings"]
# Cargo locks serde_with's optional chrono adapter even when no workspace
# feature builds it. If any target starts using it, report the advisory again.
if not any(package.startswith("chrono v") for package in packages):
    audit.extend(["--ignore", "RUSTSEC-2026-0543"])
sys.exit(subprocess.run(audit, cwd=root).returncode)
