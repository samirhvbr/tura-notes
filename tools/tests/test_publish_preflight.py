"""Exercise the macOS publication preflight without a server or a build.

`build-local.sh` is the macOS pipeline end to end, so running it in a test means
faking a keychain, `xcrun`, `hdiutil` and notarisation. The two functions that
1.1.14 added are separable and are the part with the failure modes worth
pinning: one quotes remote arguments, the other decides whether the destination
is the destination. They are extracted from the script itself — so a rename or
a deletion fails this suite rather than silently testing nothing.
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


if __name__ == '__main__':
    unittest.main()
