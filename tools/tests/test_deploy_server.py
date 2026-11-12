"""Exercise a failed co-tenant deployment and its retry with no host changes."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[2] / 'server/cotenant'


class DeployRetry(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        repo = self.root / 'repo'
        (repo / '.git').mkdir(parents=True)
        (repo / 'version.md').write_text('1.12.1\n')
        shutil.copytree(SOURCE, repo / 'server/cotenant')
        self.script = self.root / 'deploy.sh'
        script = (SOURCE / 'deploy-server.sh').read_text()
        for name in ['BINARY', 'WRAPPER', 'UNIT', 'VHOST', 'STAMP', 'HELPER']:
            script, count = re.subn(rf'^{name}=/[^\n]+$', f'{name}="{self.root / name}"',
                                    script, flags=re.MULTILINE)
            self.assertEqual(count, 1, name)
        # No competing deploy in this fixture. Leave the real host lock alone.
        lock = 'exec 9>/run/tura-deploy.lock\nflock -n 9 || fail '
        script, count = re.subn(re.escape(lock) + r'[^\n]+', ':', script)
        self.assertEqual(count, 1)
        # The Linux script uses Bash's timestamp format, unavailable in macOS Bash 3.
        self.script.write_text(script.replace("printf '[%(%H:%M:%S)T] %s\\n' -1", "printf '%s\\n'"))
        self.env = dict(os.environ, PATH=f'{self.bin}:{os.environ["PATH"]}',
                        TURA_DEPLOY_PINNED='1', TURA_DEPLOY_PINNED_FILE='',
                        TURA_REPO=str(repo), TEST_CALLS=str(self.root / 'calls'))
        self.fake('id', 'if [ "$1" = -u ]; then echo 0; else echo tester; fi')
        self.fake('stat', 'echo tester')
        self.fake('git', 'case "$3" in rev-parse) echo abc123;; esac')
        self.fake('sha256sum', 'exit 0')
        self.fake('minisign', 'exit 0')
        self.fake('tar', 'echo new-binary > notes-server')
        self.fake('sleep', 'exit 0')
        self.fake('curl', '''
case "$1" in
  -fsSLO) echo download >> "$TEST_CALLS" ;;
  *) echo health >> "$TEST_CALLS"; [ "${FAIL_STEP:-}" != health ] ;;
esac
''')
        self.fake('systemctl', '''
echo "$1" >> "$TEST_CALLS"
[ "${FAIL_STEP:-}" != "$1" ]
''')

    def fake(self, name, body):
        path = self.bin / name
        path.write_text('#!/usr/bin/env bash\n' + body + '\n')
        path.chmod(0o755)

    def deploy(self, fail=''):
        return subprocess.run(['bash', str(self.script)], env=dict(self.env, FAIL_STEP=fail),
                              capture_output=True, text=True, timeout=10)

    def assert_retry_applies(self):
        calls = Path(self.env['TEST_CALLS'])
        calls.write_text('')
        retried = self.deploy()
        self.assertEqual(retried.returncode, 0, retried.stdout + retried.stderr)
        self.assertEqual(calls.read_text().splitlines(),
                         ['daemon-reload', 'restart', 'health', 'health', 'health'])
        calls.write_text('')
        unchanged = self.deploy()
        self.assertEqual(unchanged.returncode, 0, unchanged.stdout + unchanged.stderr)
        self.assertEqual(calls.read_text(), '')

    def test_a_failed_restart_is_retried_without_redownloading_the_binary(self):
        failed = self.deploy('restart')
        self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
        self.assertEqual((self.root / 'BINARY').read_text(), 'new-binary\n')
        self.assert_retry_applies()

    def test_a_failed_daemon_reload_is_retried_for_a_unit_only_change(self):
        (self.root / 'STAMP').write_text('1.12.0\n')
        binary = self.root / 'BINARY'
        binary.write_text('installed-binary\n')
        binary.chmod(0o755)
        failed = self.deploy('daemon-reload')
        self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
        self.assertTrue((self.root / 'UNIT').is_file())
        self.assertEqual(binary.read_text(), 'installed-binary\n')
        self.assert_retry_applies()

    def test_a_failed_loopback_check_keeps_the_restart_pending(self):
        failed = self.deploy('health')
        self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
        self.assertIn('loopback', failed.stdout)
        self.assert_retry_applies()

    def test_a_current_stamp_does_not_hide_a_missing_or_non_executable_binary(self):
        initial = self.deploy()
        self.assertEqual(initial.returncode, 0, initial.stdout + initial.stderr)
        binary = self.root / 'BINARY'
        calls = Path(self.env['TEST_CALLS'])
        for fault in ('non-executable', 'missing'):
            with self.subTest(fault=fault):
                if fault == 'non-executable':
                    binary.chmod(0o644)
                else:
                    binary.unlink()
                calls.write_text('')
                recovered = self.deploy()
                self.assertEqual(recovered.returncode, 0, recovered.stdout + recovered.stderr)
                self.assertTrue(os.access(binary, os.X_OK))
                self.assertEqual(binary.read_text(), 'new-binary\n')
                self.assertEqual(calls.read_text().splitlines(),
                                 ['download', 'download', 'download', 'daemon-reload',
                                  'restart', 'health', 'health', 'health'])

    def test_a_directory_at_the_binary_path_is_refused_without_downloading(self):
        (self.root / 'STAMP').write_text('1.12.0\n')
        binary = self.root / 'BINARY'
        binary.mkdir()
        failed = self.deploy()
        self.assertEqual(failed.returncode, 1, failed.stdout + failed.stderr)
        self.assertIn('é um diretório', failed.stdout)
        self.assertEqual(list(binary.iterdir()), [])
        self.assertFalse(Path(self.env['TEST_CALLS']).exists())


if __name__ == '__main__':
    unittest.main()
