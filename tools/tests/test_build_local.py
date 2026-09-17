"""Exercise the parts of build-local.sh that do not need a real macOS build.

`build-local.sh` is the macOS pipeline end to end, so running it in a test means
faking a keychain, `xcrun`, `hdiutil` and notarisation — which is why the two
bugs this file covers both survived so long. What is testable is separable: the
publication preflight's two functions, extracted from the script itself so a
rename fails this suite rather than silently testing nothing, and the ordering
of the version stamp against the source fingerprint, which is an ordering and
not a computation.
"""
import os
from pathlib import Path
import re
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def preflight_source():
    script = (ROOT / 'build-local.sh').read_text()
    match = re.search(r'^_q\(\) \{.*?(?=^publish_release\(\) \{)', script, re.S | re.M)
    assert match, 'build-local.sh no longer defines _q before publish_release'
    source = match.group(0)
    assert 'publish_preflight() {' in source, 'publish_preflight moved out of the block'
    return source


class Preflight(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + ':' + os.environ['PATH'])
        self.source = preflight_source()

    def fake_ssh(self, body):
        p = self.bin / 'ssh'
        p.write_text('#!/usr/bin/env bash\n' + body + '\n')
        p.chmod(0o755)

    def run_preflight(self, host='b3sys@host', stage='/tmp', app='/srv/www/site/app'):
        script = (
            'set -uo pipefail\n'
            f'PUBLISH_HOST={host!r}\nPUBLISH_STAGE={stage!r}\nPUBLISH_APP={app!r}\n'
            + self.source
            + '\npublish_preflight\n'
        )
        return subprocess.run(['bash', '-c', script], env=self.env,
                              capture_output=True, text=True)

    def test_a_present_artisan_is_accepted(self):
        self.fake_ssh('exit 0')
        self.assertEqual(self.run_preflight().returncode, 0)

    def test_a_missing_artisan_names_the_command_that_finds_the_path(self):
        self.fake_ssh('exit 1')
        result = self.run_preflight()
        self.assertEqual(result.returncode, 1)
        self.assertIn('no download service', result.stderr)
        self.assertIn("ls -d /srv/www/*/", result.stderr)
        self.assertIn('TURA_PUBLISH_APP=', result.stderr)

    def test_an_unreachable_host_is_reported_as_unreachable(self):
        self.fake_ssh('exit 255')
        result = self.run_preflight()
        self.assertEqual(result.returncode, 1)
        self.assertIn('could not reach', result.stderr)
        self.assertNotIn('artisan', result.stderr)

    def test_the_probe_asks_about_artisan_under_the_application_path(self):
        log = self.root / 'ssh.log'
        self.fake_ssh(f'echo "$*" > {log}\nexit 0')
        self.assertEqual(self.run_preflight(app='/srv/www/samirhv.com.br/samirhv').returncode, 0)
        # shlex.quote leaves an already-safe path bare; what matters is that the
        # probe asks about artisan under the configured application path.
        self.assertIn('test -f /srv/www/samirhv.com.br/samirhv/artisan', log.read_text())

    def test_shell_characters_are_refused_before_any_connection(self):
        # --dest and the TURA_* variables reach a remote shell. A path that can
        # end an argument there must not survive to be quoted by hand.
        self.fake_ssh('exit 0')
        for kind, value in [('host', 'host; rm -rf /'), ('host', '-oProxyCommand=x'),
                            ('stage', '/tmp/$(id)'), ('stage', 'relative'),
                            ('app', '/srv/www/my app'), ('app', '/srv/`id`/app')]:
            with self.subTest(kind=kind, value=value):
                result = self.run_preflight(**{kind: value})
                self.assertEqual(result.returncode, 1)
                self.assertRegex(result.stderr, r'invalid publish host|remote paths must be absolute')

    def test_quoting_survives_a_space_and_a_quote(self):
        script = self.source + '''\n_q "a b'c"\n'''
        result = subprocess.run(['bash', '-c', 'set -uo pipefail\n' + script],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        quoted = result.stdout.strip()
        echoed = subprocess.run(['bash', '-c', f'printf %s {quoted}'],
                                capture_output=True, text=True).stdout
        self.assertEqual(echoed, "a b'c")


class Fingerprint(unittest.TestCase):
    """The stamp is inside the fingerprint, so the order of the two is the bug.

    `tools/stamp-version.sh` rewrites `apps/notes-app/src-tauri/tauri.conf.json`,
    which is under one of `tools/build-cache.py`'s INPUTS. `SOURCE_HASH` is taken
    before stamping. Comparing it against a fingerprint taken while the tree is
    still stamped compares two different files — so the "sources changed during
    the build" guard fired on every macOS build that compiled, after the
    notarisation round-trip, and refused to record a build that was correct.
    """

    CONFIG = ROOT / 'apps/notes-app/src-tauri/tauri.conf.json'

    def fingerprint(self):
        return subprocess.run(['python3', str(ROOT / 'tools/build-cache.py'), 'fingerprint'],
                              cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()

    def test_stamping_moves_the_fingerprint(self):
        original = self.CONFIG.read_bytes()
        before = self.fingerprint()
        try:
            subprocess.run(['bash', str(ROOT / 'tools/stamp-version.sh')], cwd=ROOT,
                           check=True, stdout=subprocess.DEVNULL)
            self.assertNotEqual(self.CONFIG.read_bytes(), original, 'stamping wrote nothing')
            self.assertNotEqual(before, self.fingerprint(),
                                'the stamped config is outside the fingerprint; this test is moot')
        finally:
            self.CONFIG.write_bytes(original)
        self.assertEqual(self.CONFIG.read_bytes(), original)
        self.assertEqual(before, self.fingerprint())

    def test_the_rename_happens_before_anything_hashes_the_name(self):
        # The sha256 sidecar, the updater payload name and the published URL all
        # carry the filename. Renaming after any of them would publish a file
        # under a name nothing else agrees with.
        script = (ROOT / 'build-local.sh').read_text()
        rename = script.index('tools/name-bundles.sh')
        for later in ['_sha256 "$dmg" | awk', 'updater-release.py prepare', 'publish_release "$dmg"']:
            self.assertLess(rename, script.index(later), f'the rename now happens after: {later}')

    def test_the_application_bundle_keeps_its_name(self):
        # ADR-069 froze the installed identities. `Tura Notes.app` is one: rename
        # it and the next release installs beside the old one instead of over it.
        # Only the tarball around it is renamed.
        script = (ROOT / 'build-local.sh').read_text()
        self.assertIn("""-C "$ROOT/target/release/bundle/macos" 'Tura Notes.app'""", script)
        self.assertIn('TuraNotes.app.tar.gz', script)
        helper = (ROOT / 'tools/name-bundles.sh').read_text()
        self.assertIn('-type f', helper, 'the helper could reach a directory, and .app is one')

    def test_the_ingest_allocates_a_terminal_for_sudo(self):
        # `ssh host "cmd"` allocates no tty, so the remote sudo cannot prompt and
        # refuses — after the build, the notarisation and a verified upload.
        script = (ROOT / 'build-local.sh').read_text()
        ingest = [l for l in script.splitlines() if 'php artisan files:add' in l and l.strip().startswith(('ssh', 'if ! ssh'))]
        self.assertEqual(len(ingest), 1, 'build-local.sh no longer ingests with one ssh call')
        self.assertIn('ssh -t ', ingest[0], 'the ingest cannot prompt for a sudo password')

        linux = (ROOT / 'tools/build-linux.sh').read_text()
        self.assertIn('ssh -t "$host" "cd $(quote "$app") && sudo -u www-data', linux)

    def test_the_placeholder_is_restored_before_the_fingerprint_is_compared(self):
        script = (ROOT / 'build-local.sh').read_text().splitlines()
        restore = [i for i, l in enumerate(script)
                   if 'cp "$CONFIG_BACKUP" "$CONFIG_PATH"; rm -f' in l]
        # The assignment on line ~621 also mentions both; the comparison is the
        # one that tests the hash rather than producing it.
        compare = [i for i, l in enumerate(script) if '= "$SOURCE_HASH" ]' in l]
        self.assertEqual(len(restore), 1, 'build-local.sh no longer restores the config inline')
        self.assertEqual(len(compare), 1, 'build-local.sh no longer compares the fingerprint')
        self.assertLess(restore[0], compare[0],
                        'the fingerprint is compared against a stamped tree and can never match')


if __name__ == '__main__':
    unittest.main()
