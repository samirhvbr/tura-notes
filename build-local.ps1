#requires -Version 5.1
<#
  build-local.ps1 - the local Windows build of Tura Notes: an NSIS installer
  (`*-setup.exe`) and its `.sha256`, UNSIGNED and NEVER PUBLISHED.

  Launch it with build-local.cmd (double-click, or from cmd/Explorer), which
  gets past the .ps1 -> Notepad association and the ExecutionPolicy.

  WHY IT DOES NOT PUBLISH. ADR-024: no unsigned Windows artefact is published,
  because an unsigned installer trips SmartScreen and teaches its user to click
  past the warning that exists to protect them. There is no OV code-signing
  certificate yet, so what this produces is for testing on your own machine.
  `-Publish` exists only to say no, because `build-local.sh --publish` exists
  and the reflex carries over (ADR-097).

  PREREQUISITES (install once, then reopen the terminal):
    - Node 22.22.2+, 24.15+ or 26+   winget install OpenJS.NodeJS.LTS
    - Rust, MSVC toolchain           winget install Rustlang.Rustup
                                     rustup default stable-msvc
    - MSVC C++ build tools           Visual Studio Build Tools, workload
                                     "Desktop development with C++"
    - Git for Windows (Git Bash)     winget install Git.Git
    - WebView2                       ships with Windows 10 (current) and 11
  NSIS itself is downloaded by the Tauri bundler on the first build.

  USAGE (from the repository root, or double-click build-local.cmd):
    .\build-local.ps1                 # sync, npm ci, build the installer
    .\build-local.ps1 -SkipNpmCi      # dependencies already installed
    .\build-local.ps1 -SkipGitPull    # build this checkout, do not sync first

  OUTPUT: target\local-windows\<host-triple>\release\bundle\nsis\
          TuraNotes_<version>_x64-setup.exe and TuraNotes_<version>_x64-setup.exe.sha256
  The first build compiles the whole Rust tree (10-20 min); later ones are
  incremental.

  Norm: docs/runbook.md "Local Windows installer" - docs/decisions.md ADR-024, ADR-097
#>
param(
  [switch]$SkipNpmCi,
  [switch]$SkipGitPull,
  [switch]$Publish
)

$ErrorActionPreference = 'Stop'

if ($Publish) {
  Write-Host 'Windows is not published: no unsigned Windows artefact is (ADR-024),' -ForegroundColor Red
  Write-Host 'and there is no OV code-signing certificate yet. Nothing was built.' -ForegroundColor Red
  exit 2
}

$root = $PSScriptRoot
Set-Location $root

# -- Clock: total wall time and time per step, as tools/build-clock.sh prints it
# for the macOS and Linux halves, so the three platforms can be compared.
$script:buildStart = Get-Date
$script:phases = New-Object System.Collections.ArrayList
$script:phCur = $null
$script:phStart = $script:buildStart
function Format-Elapsed([TimeSpan]$d) {
  if ($d.TotalHours -ge 1) { '{0}h {1:00}m {2:00}s' -f [int][Math]::Floor($d.TotalHours), $d.Minutes, $d.Seconds }
  elseif ($d.TotalMinutes -ge 1) { '{0}m {1:00}s' -f [int][Math]::Floor($d.TotalMinutes), $d.Seconds }
  else { '{0}s' -f [int][Math]::Floor($d.TotalSeconds) }
}
function Step([string]$label) {
  $now = Get-Date
  if ($script:phCur) {
    [void]$script:phases.Add([pscustomobject]@{ Name = $script:phCur; Span = $now - $script:phStart })
  }
  $script:phCur = $label
  $script:phStart = $now
  Write-Host ('==> [{0}] {1}' -f (Format-Elapsed ($now - $script:buildStart)), $label) -ForegroundColor Cyan
}
function Show-BuildSummary {
  if ($script:phCur) {
    [void]$script:phases.Add([pscustomobject]@{ Name = $script:phCur; Span = (Get-Date) - $script:phStart })
    $script:phCur = $null
  }
  Write-Host "`nTime per step (Windows):" -ForegroundColor Green
  foreach ($p in $script:phases) { Write-Host ('{0,9}  {1}' -f (Format-Elapsed $p.Span), $p.Name) }
  Write-Host '          --------'
  Write-Host ('{0,9}  TOTAL' -f (Format-Elapsed ((Get-Date) - $script:buildStart)))
}
trap {
  Write-Host ("`nBuild aborted after {0} (Windows)." -f (Format-Elapsed ((Get-Date) - $script:buildStart))) -ForegroundColor Red
  break
}

# PowerShell 5.1 does not treat a native command's non-zero exit as an error -
# only a cmdlet's. Without this after every native command a failed step passes
# in silence and the script reports an installer it did not build.
function Assert-Ok([string]$what) {
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE). Fix the error above and run again." }
}

# -- Git sync: the same rule as tools/build-linux.sh. --ff-only never creates a
# merge, and a pull that cannot fast-forward (offline, detached HEAD, diverged
# branch) builds the local checkout and says so instead of aborting.
Step '[git] sync with the remote (git pull --ff-only)'
if ($SkipGitPull) {
  Write-Host '    Skipping the pull: -SkipGitPull.'
} elseif (-not (Test-Path (Join-Path $root '.git'))) {
  Write-Host '    Not a git checkout; building what is here.'
} elseif (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host '    git is not on PATH; building the local checkout as it is.' -ForegroundColor Yellow
} else {
  git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    Write-Host '    Could not fast-forward; building the local checkout as it is.' -ForegroundColor Yellow
  }
}

Step '[prerequisites] check the toolchain (Node, Rust MSVC, Git Bash)'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (-not (Get-Command cargo -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $cargoBin 'cargo.exe'))) {
  $env:Path = "$cargoBin;$env:Path"
}
foreach ($t in @(
    @{ c = 'node';  h = 'winget install OpenJS.NodeJS.LTS' },
    @{ c = 'npm';   h = 'installed with Node: winget install OpenJS.NodeJS.LTS' },
    @{ c = 'cargo'; h = 'winget install Rustlang.Rustup ; rustup default stable-msvc' },
    @{ c = 'rustc'; h = 'winget install Rustlang.Rustup ; rustup default stable-msvc' },
    @{ c = 'git';   h = 'winget install Git.Git' }
  )) {
  if (-not (Get-Command $t.c -ErrorAction SilentlyContinue)) {
    throw "Missing prerequisite: '$($t.c)' is not on PATH.`n    $($t.h)`n    Then reopen the terminal."
  }
}

$nodeVersion = (node -p process.versions.node).Trim(); Assert-Ok 'node -p'
$n = @($nodeVersion.Split('.') | ForEach-Object { [int]$_ })
if (-not (($n[0] -eq 22 -and ($n[1] -gt 22 -or ($n[1] -eq 22 -and $n[2] -ge 2))) -or
          ($n[0] -eq 24 -and $n[1] -ge 15) -or $n[0] -ge 26)) {
  throw "Node $nodeVersion is too old: use Node 22.22.2+, 24.15+ or 26+ (winget install OpenJS.NodeJS.LTS)."
}

$hostTriple = ''
foreach ($line in (rustc -vV)) { if ($line -like 'host: *') { $hostTriple = $line.Substring(6).Trim() } }
Assert-Ok 'rustc -vV'
if ($hostTriple -notlike '*-pc-windows-msvc') {
  throw ("Rust's host is '$hostTriple'; Tauri on Windows needs the MSVC toolchain.`n" +
         "    rustup default stable-msvc`n" +
         "    and Visual Studio Build Tools with the 'Desktop development with C++' workload.")
}

# npm runs package scripts through cmd.exe on Windows, and cmd.exe cannot run
# `../../tools/no-blocking-dialogs.sh`, which `npm run build` -> `lint` calls.
# Git Bash can. It is found from git itself: the `bash` first on PATH may be
# WSL's System32\bash.exe, which runs in another operating system. Set for this
# process only - the user's npm configuration is not touched.
$gitExec = (git --exec-path).Trim().Replace('/', '\'); Assert-Ok 'git --exec-path'
$gitRoot = Split-Path (Split-Path (Split-Path $gitExec -Parent) -Parent) -Parent
$bash = @('bin\bash.exe', 'usr\bin\bash.exe') |
  ForEach-Object { Join-Path $gitRoot $_ } |
  Where-Object { Test-Path $_ } |
  Select-Object -First 1
if (-not $bash) { throw "Git Bash not found under $gitRoot. Install Git for Windows: winget install Git.Git" }
$env:npm_config_script_shell = $bash
Write-Host "    node $nodeVersion - rust $hostTriple - npm scripts through $bash"

# -- Version: the first X.Y.Z in version.md, the single authority (ADR-011).
# It is handed to Tauri as a --config file rather than stamped into
# tauri.conf.json, so the committed `0.0.0` is never rewritten, there is no
# backup to restore, and an interrupted build cannot leave a stamped tree
# behind for the next commit to trip over (ADR-097).
$versionMatch = [regex]::Match((Get-Content (Join-Path $root 'version.md') -Raw), '\d+\.\d+\.\d+')
if (-not $versionMatch.Success) { throw 'version.md has no version (X.Y.Z).' }
$version = $versionMatch.Value

$output = Join-Path $root "target\local-windows\$hostTriple"
$env:CARGO_TARGET_DIR = $output
$bundle = Join-Path $output 'release\bundle\nsis'
# Success is decided by the installer on disk, so an installer left by an
# earlier run must not be there to be found when this build fails.
if (Test-Path $bundle) { Remove-Item -Recurse -Force $bundle }

$versionConfig = Join-Path ([IO.Path]::GetTempPath()) "tura-notes-version-$PID.json"
[IO.File]::WriteAllText($versionConfig, "{`"version`":`"$version`"}", (New-Object Text.UTF8Encoding $false))
try {
  Push-Location (Join-Path $root 'apps\notes-app')
  try {
    Step '[1/3] frontend dependencies (npm ci)'
    if ($SkipNpmCi) { Write-Host '    (skipped: -SkipNpmCi)' } else { npm ci; Assert-Ok 'npm ci' }

    Step "[2/3] tauri build (compile and bundle: nsis, version $version)"
    node (Join-Path $root 'tools\tauri.mjs') build --bundles nsis --config $versionConfig
    Assert-Ok 'tauri build'
  } finally {
    Pop-Location
  }
} finally {
  Remove-Item -Force $versionConfig -ErrorAction SilentlyContinue
}

# -- Names and checksums, as tools/name-bundles.sh does on the other two
# platforms: `Tura Notes_1.9.5_x64-setup.exe` -> `TuraNotes_1.9.5_x64-setup.exe`.
# A space in a released filename is %20 in every URL and a word boundary in
# every careless script. Regular files only; -Force because the file just built
# replaces a rename left by an earlier run of the same version.
Step '[3/3] canonical names and checksums'
Get-ChildItem -LiteralPath $bundle -File | Where-Object { $_.Name -like '* *' } | ForEach-Object {
  $clean = $_.Name -replace ' ', ''
  Move-Item -LiteralPath $_.FullName -Destination (Join-Path $bundle $clean) -Force
  Write-Host "    $($_.Name) -> $clean"
}
$installers = @(Get-ChildItem -LiteralPath $bundle -File -Filter "*_${version}_*-setup.exe")
if ($installers.Count -ne 1) {
  throw "Expected one NSIS installer for $version in $bundle, found $($installers.Count)."
}
$installer = $installers[0]
# sha256sum's format - lowercase hash, two spaces, name, LF - so the file
# checks with `sha256sum -c` like the Linux and macOS ones.
$hash = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText("$($installer.FullName).sha256", "$hash  $($installer.Name)`n", (New-Object Text.UTF8Encoding $false))

Write-Host "`nTura Notes ${version}: $($installer.FullName)" -ForegroundColor Green
Write-Host "SHA-256: $hash"
Write-Host 'UNSIGNED: SmartScreen will warn. For local testing only - not publishable (ADR-024).' -ForegroundColor Yellow
Show-BuildSummary
