"""Check real merge histories without losing versions from either parent."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

CHECKER = Path(__file__).resolve().parents[1] / 'changelog-versions.py'


class ChangelogVersions(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.env = dict(os.environ, GIT_CONFIG_GLOBAL=os.devnull, GIT_CONFIG_NOSYSTEM='1')
        self.git('init', '--quiet', '--initial-branch=master')
        self.git('config', 'user.name', 'Version checker fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('config', 'commit.gpgsign', 'false')
        (self.root / 'tools').mkdir()
        shutil.copyfile(CHECKER, self.root / 'tools/changelog-versions.py')

    def git(self, *args, check=True):
        return subprocess.run(['git', '-C', str(self.root), *args], env=self.env,
                              capture_output=True, text=True, check=check)

    def commit_version(self, version):
        (self.root / 'version.md').write_text(version + '\n')
        self.git('add', 'version.md')
        self.git('commit', '--quiet', '-m', version)

    def merge_versions(self, resolved):
        self.commit_version('1.0.0')
        self.git('checkout', '--quiet', '-b', 'queued')
        self.commit_version('1.0.2')
        self.git('checkout', '--quiet', 'master')
        self.commit_version('1.0.1')
        conflict = self.git('merge', '--no-commit', 'queued', check=False)
        self.assertEqual(conflict.returncode, 1, conflict.stdout + conflict.stderr)
        self.commit_version(resolved)

    def check_versions(self, versions):
        (self.root / 'CHANGELOG.md').write_text(
            '\n'.join(f'## {version} - fixture version\n' for version in versions))
        return subprocess.run([sys.executable, str(self.root / 'tools/changelog-versions.py')],
                              env=self.env, capture_output=True, text=True, timeout=10)

    def test_a_merge_keeps_the_versions_from_both_parents(self):
        # Choosing one parent's file makes the default path-history walk omit
        # the other parent's committed version.
        self.merge_versions('1.0.2')
        result = self.check_versions(['1.0.2', '1.0.1', '1.0.0'])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_a_version_introduced_by_merge_resolution_is_committed(self):
        self.merge_versions('1.0.3')
        (self.root / 'version.md').write_text('1.0.4\n')
        result = self.check_versions(['1.0.4', '1.0.3', '1.0.2', '1.0.1', '1.0.0'])
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_a_genuinely_absent_version_is_refused(self):
        self.commit_version('1.0.0')
        (self.root / 'version.md').write_text('1.0.2\n')
        result = self.check_versions(['1.0.2', '1.0.1', '1.0.0'])
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn('1.0.1', result.stderr)
        self.assertNotIn('1.0.2', result.stderr)


if __name__ == '__main__':
    unittest.main()
