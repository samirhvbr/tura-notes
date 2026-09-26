"""Hold the Windows build script to what it promises, without Windows.

`build-local.ps1` only runs on a Windows machine with MSVC, and nothing here has
PowerShell, so this suite reads the script instead of running it. That is weaker
than the Linux suite and it says so: what it guards are the properties a later
edit could quietly lose, and each of them has a reason in ADR-097.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class WindowsBuild(unittest.TestCase):
    def setUp(self):
        self.ps1 = (ROOT / 'build-local.ps1').read_bytes()
        self.script = self.ps1.decode('ascii')
        self.cmd = (ROOT / 'build-local.cmd').read_bytes()
        # The code alone: the help block and the comments name the very
        # things the assertions below forbid the code to do.
        body = self.script.split('#>', 1)[1]
        self.code = '\n'.join(l for l in body.splitlines() if not l.lstrip().startswith('#'))

    def test_the_launcher_is_crlf_and_bypasses_the_execution_policy(self):
        # cmd.exe misreads a batch file with bare LF endings; .gitattributes
        # pins `*.cmd` to CRLF on every checkout, and this is its witness.
        self.assertNotIn(b'\n', self.cmd.replace(b'\r\n', b''))
        self.assertIn(b'-ExecutionPolicy Bypass -File "%~dp0build-local.ps1" %*', self.cmd)

    def test_the_script_is_ascii(self):
        # Windows PowerShell 5.1 reads a BOM-less file in the ANSI code page,
        # so one em dash in a string turns into mojibake or a parse error.
        # `.decode('ascii')` in setUp is the assertion; this names it.
        self.assertTrue(self.script.isascii())

    def test_publish_is_refused_before_anything_runs(self):
        # ADR-024: no unsigned Windows artefact is published.
        refusal = self.code.index('if ($Publish) {')
        self.assertIn('exit 2', self.code[refusal:self.code.index('}', refusal)])
        for later in ('git pull', 'npm ci', 'tauri.mjs'):
            self.assertLess(refusal, self.code.index(later), later)

    def test_the_committed_config_is_never_written(self):
        # The version reaches Tauri as a --config file, so the committed 0.0.0
        # is never stamped and an interrupted build cannot leave it stamped.
        self.assertNotIn('tauri.conf.json', self.code)
        self.assertNotIn('stamp-version', self.code)
        self.assertRegex(self.code, r'tauri\.mjs\'\) build --bundles nsis --config \$versionConfig')

    def test_the_installer_is_renamed_and_checksummed(self):
        self.assertIn("-replace ' ', ''", self.script)
        self.assertIn('.sha256', self.script)
        self.assertIn("\"$hash  $($installer.Name)`n\"", self.script)

    def test_every_native_build_step_is_checked(self):
        # PowerShell 5.1 does not stop on a native command's non-zero exit.
        for command in ('npm ci', 'tauri build'):
            self.assertRegex(self.script, re.escape(f"Assert-Ok '{command}'"))

    def test_npm_scripts_run_through_git_bash_not_wsl(self):
        # `npm run build` -> `lint` calls a .sh script that cmd.exe cannot run.
        self.assertIn('$env:npm_config_script_shell = $bash', self.script)
        self.assertIn('git --exec-path', self.script)


if __name__ == '__main__':
    unittest.main()
