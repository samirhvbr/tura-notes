@echo off
REM Launcher for build-local.ps1: double-click it, or run it from cmd/Explorer.
REM It gets past two Windows traps: the .ps1 -> Notepad file association and
REM the ExecutionPolicy. Arguments are passed through:
REM   build-local.cmd -SkipNpmCi   /   build-local.cmd -SkipGitPull
REM The installer it builds is UNSIGNED and never published (ADR-024, ADR-097).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-local.ps1" %*
echo.
pause
