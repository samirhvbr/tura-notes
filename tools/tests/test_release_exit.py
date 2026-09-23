#!/usr/bin/env python3
"""`tools/release.sh` exit status says what happened (R6-31).

Two ways it used to lie, each ending in a minor Release with no artifacts,
because `build.yml` read the Release workflow's conclusion:

- a create that failed because another run had just made the same Release
  counted as FAILED, so the workflow went red over the outcome it wanted;
- a stop for a low API budget (`publish` returns 9) was dropped in `--current`,
  so the workflow went green having published nothing.

A fake `gh` on PATH plays GitHub; nothing leaves the machine.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / 'tools/release.sh'

FAKE_GH = r'''#!/usr/bin/env bash
case "$1 $2" in
  "api rate_limit") echo "${FAKE_RATE:-5000}" ;;
  "release list") : ;;
  "release create") echo "${FAKE_CREATE_ERR:-HTTP 422: Validation Failed (already_exists)}" >&2; exit 1 ;;
  "release view")
    # `release view <ver>`: whether it exists now; `release view --json ...`: the badge.
    if [ "${3:-}" = "--repo" ] || [ "${3:-}" = "--json" ]; then echo "1.0.0"; exit 0; fi
    [ "${FAKE_EXISTS_AFTER:-0}" = "1" ] ;;
  "release edit") : ;;
  *) : ;;
esac
'''


def run(**env):
    with tempfile.TemporaryDirectory() as d:
        repo = Path(d) / 'repo'
        repo.mkdir()
        (repo / 'version.md').write_text('1.2.0\n')
        git = lambda *a: subprocess.run(['git', '-C', str(repo), *a], check=True, capture_output=True)
        git('init', '-q')
        git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x')
        git('add', 'version.md')
        git('-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', '1.2.0 - x')
        bin_dir = Path(d) / 'bin'
        bin_dir.mkdir()
        gh = bin_dir / 'gh'
        gh.write_text(FAKE_GH)
        gh.chmod(0o755)
        e = dict(os.environ, PATH=f'{bin_dir}:{os.environ["PATH"]}', **env)
        return subprocess.run(['bash', str(RELEASE), '--current', '--repo', 'o/r', '--ref', 'HEAD', '--sleep', '0'],
                              cwd=repo, env=e, capture_output=True, text=True)


class ReleaseExit(unittest.TestCase):
    def test_a_release_another_run_just_created_is_not_a_failure(self):
        r = run(FAKE_EXISTS_AFTER='1')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('created meanwhile by another run', r.stdout)

    def test_a_stop_for_a_low_api_budget_is_not_success(self):
        r = run(FAKE_RATE='10')
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('STOPPING', r.stderr)

    def test_a_create_that_failed_and_left_nothing_is_a_failure(self):
        r = run(FAKE_EXISTS_AFTER='0', FAKE_CREATE_ERR='HTTP 500')
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('FAILED', r.stderr)


if __name__ == '__main__':
    unittest.main()
