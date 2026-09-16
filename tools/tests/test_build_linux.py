"""Exercise packaging orchestration with fake tools, without publishing."""
import os
import hashlib
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class LinuxBuild(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ['build-local.sh', 'deploy.sh', 'tools/build-linux.sh', 'tools/stamp-version.sh', 'tools/build-cache.py']:
            dest = self.root / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, dest)
        # Signing/transport are tested separately; this suite exercises build reuse.
        (self.root / 'tools/updater-release.py').write_text('import sys\n')
        self.config = self.root / 'apps/notes-app/src-tauri/tauri.conf.json'
        self.config.parent.mkdir(parents=True)
        self.original = '{"version": "0.0.0"}\n'
        self.config.write_text(self.original)
        (self.root / 'version.md').write_text('1.0.3\n')
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.env = dict(os.environ, PATH=str(self.bin) + ':' + os.environ['PATH'])
        for tool in ['cargo', 'node', 'cc', 'file', 'patchelf', 'pkg-config']:
            self.fake(tool, 'exit 0')
        self.fake('uname', 'echo Linux')
        self.fake('rustc', 'echo "host: aarch64-unknown-linux-gnu"')
        self.env['TEST_NPM_LOG'] = str(self.root / 'npm-calls.log')
        self.fake('npm', '''
echo "$*" >> "$TEST_NPM_LOG"
[ "${FAIL_BUILD:-0}" = 0 ] || exit 42
[ "$1" != ci ] || exit 0
[ "${EMPTY_BUILD:-0}" = 0 ] || exit 0
for target in deb appimage; do
  ext="$target"; [ "$target" != appimage ] || ext=AppImage
  mkdir -p "$CARGO_TARGET_DIR/release/bundle/$target"
  echo package > "$CARGO_TARGET_DIR/release/bundle/$target/Tura Notes_1.0.3_arm64.$ext"
done
''')
        self.fake('sha256sum', 'shasum -a 256 "$@"')

    def fake(self, name, body):
        p = self.bin / name
        p.write_text('#!/usr/bin/env bash\nset -e\n' + body + '\n')
        p.chmod(0o755)

    def run_build(self, *args):
        return subprocess.run(['bash', str(self.root / 'deploy.sh'), '--skip-git-pull', *args],
                              env=self.env, capture_output=True, text=True)

    def test_build_dispatches_and_restores_config(self):
        result = self.run_build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.config.read_text(), self.original)
        self.assertEqual(len(list(self.root.glob('target/**/*.sha256'))), 2)

    def test_failure_restores_config(self):
        self.env['FAIL_BUILD'] = '1'
        self.assertEqual(self.run_build().returncode, 42)
        self.assertEqual(self.config.read_text(), self.original)

    def test_stale_package_cannot_satisfy_missing_output(self):
        p = self.root / 'target/local-linux/aarch64-unknown-linux-gnu/release/bundle/deb/old.deb'
        p.parent.mkdir(parents=True)
        p.write_text('stale')
        self.env['EMPTY_BUILD'] = '1'
        self.assertNotEqual(self.run_build('--bundles', 'deb').returncode, 0)
        self.assertFalse(p.exists())
        self.assertEqual(self.config.read_text(), self.original)

    def test_publish_retry_reuses_build_without_toolchain_steps(self):
        self.fake('scp', 'exit 19')
        self.fake('ssh', 'exit 0')
        first = self.run_build('--publish')
        self.assertEqual(first.returncode, 19, first.stderr)
        self.env['FAIL_BUILD'] = '1'
        self.fake('node', 'exit 99')
        self.fake('pkg-config', 'exit 99')
        second = self.run_build('--publish')
        self.assertEqual(second.returncode, 19, second.stderr)
        self.assertIn('skipping npm ci and compilation', second.stdout)
        package = next(self.root.glob('target/**/*.deb'))
        self.env['UPLOAD_HASH'] = hashlib.sha256(package.read_bytes()).hexdigest()
        self.fake('scp', 'exit 0')
        self.fake('ssh', 'case "$*" in *sha256sum*) echo "$UPLOAD_HASH";; esac')
        third = self.run_build('--publish')
        self.assertEqual(third.returncode, 0, third.stderr)
        self.assertIn('Published:', third.stdout)

    def test_only_missing_format_is_built(self):
        self.assertEqual(self.run_build('--bundles', 'deb').returncode, 0)
        calls = Path(self.env['TEST_NPM_LOG'])
        calls.write_text('')
        result = self.run_build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Reusing deb', result.stdout)
        self.assertIn('run tauri build -- --bundles appimage', calls.read_text())
        self.assertNotIn('--bundles deb', calls.read_text())

    def test_changes_force_a_rebuild(self):
        for change in ['source', 'deleted_source', 'corrupt', 'missing', 'version', 'force']:
            with self.subTest(change=change):
                source = self.root / 'apps/notes-app/src/example.ts'
                source.parent.mkdir(exist_ok=True)
                source.write_text('original')
                self.env['FAIL_BUILD'] = '0'
                self.assertEqual(self.run_build('--force').returncode, 0)
                package = next(self.root.glob('target/**/*.deb'))
                args = []
                if change == 'source':
                    source.write_text('changed')
                elif change == 'deleted_source':
                    source.unlink()
                elif change == 'corrupt':
                    package.write_text('corrupt')
                elif change == 'missing':
                    package.unlink()
                elif change == 'version':
                    (self.root / 'version.md').write_text('1.0.99')
                else:
                    args = ['--force']
                self.env['FAIL_BUILD'] = '1'
                self.assertEqual(self.run_build(*args).returncode, 42)
                (self.root / 'version.md').write_text('1.0.3')

    def test_invalid_options_fail_before_build(self):
        for args in [('--bundles', 'dmg'), ('--bundles',), ('--bundles', 'deb,'),
                     ('--publish', '--no-sign')]:
            with self.subTest(args=args):
                self.assertEqual(self.run_build(*args).returncode, 2)
                self.assertEqual(self.config.read_text(), self.original)

    def test_failed_pull_warns_and_builds_the_local_checkout(self):
        # Succeed for rev-parse, fail for pull: a git that fails at everything
        # takes the "not a checkout" branch and never reaches the pull at all.
        self.fake('git', '[ "$1" != pull ] || exit 17')
        result = subprocess.run(['bash', str(self.root / 'deploy.sh')],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('Could not fast-forward', result.stderr)
        self.assertEqual(self.config.read_text(), self.original)

    def test_a_directory_that_is_not_a_checkout_still_builds(self):
        self.fake('git', 'exit 1')
        result = subprocess.run(['bash', str(self.root / 'deploy.sh')],
                                env=self.env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('Not a git checkout', result.stdout)

    def test_help_does_not_need_build_dependencies(self):
        self.fake('node', 'exit 99')
        result = self.run_build('--help')
        self.assertEqual(result.returncode, 0)
        self.assertIn('AppImage', result.stdout)

    def test_missing_libraries_fail_before_stamping(self):
        self.fake('pkg-config', 'exit 1')
        self.assertNotEqual(self.run_build().returncode, 0)
        self.assertEqual(self.config.read_text(), self.original)

    def test_missing_download_service_refuses_before_building(self):
        # The app path is a guess until something asks the server about it, and
        # asking after the build means paying for the build to learn it.
        self.fake('ssh', 'exit 1')
        self.fake('scp', 'exit 77')
        Path(self.env['TEST_NPM_LOG']).write_text('')
        result = self.run_build('--publish')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('no artisan', result.stderr.replace('(no artisan)', 'no artisan'))
        self.assertIn('ls -d /srv/www/', result.stderr)
        self.assertEqual(Path(self.env['TEST_NPM_LOG']).read_text(), '')
        self.assertEqual(self.config.read_text(), self.original)

    def test_unreachable_publish_host_is_named_as_such(self):
        self.fake('ssh', 'exit 255')
        result = self.run_build('--publish')
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn('Could not reach', result.stderr)
        self.assertNotIn('artisan', result.stderr)

    def test_publish_application_path_must_be_a_plain_absolute_path(self):
        for path in ['relative/app', '/srv/www/my app', '/srv/$(id)/app']:
            with self.subTest(path=path):
                self.env['TURA_PUBLISH_APP'] = path
                self.fake('ssh', 'exit 0')
                result = self.run_build('--publish')
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn('absolute publish application path', result.stderr)
        del self.env['TURA_PUBLISH_APP']

    def test_checksum_mismatch_prevents_ingestion(self):
        self.fake('scp', 'exit 0')
        self.fake('ssh', 'echo wrong-checksum')
        result = self.run_build('--publish', '--bundles', 'deb')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('not ingested', result.stderr)
        self.assertEqual(self.config.read_text(), self.original)


if __name__ == '__main__':
    unittest.main()
