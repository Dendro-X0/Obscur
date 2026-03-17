param(
    [switch]$SkipInstall,
    [switch]$SkipAndroid,
    [switch]$Quick,
    [switch]$DryRun,
    [switch]$AllowNodeDrift
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$previousNativeErrorPref = $null
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -Scope Global -ErrorAction SilentlyContinue) {
    $previousNativeErrorPref = $Global:PSNativeCommandUseErrorActionPreference
    $Global:PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$runStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactsDir = Join-Path $repoRoot ".artifacts"
$runDir = Join-Path $artifactsDir "local-ci-$runStamp"

New-Item -ItemType Directory -Path $runDir -Force | Out-Null

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    $safeName = ($Name -replace "[^a-zA-Z0-9_-]", "_")
    $logPath = Join-Path $runDir "$safeName.log"

    Write-Host ""
    Write-Host "==> $Name"
    Write-Host "    log: $logPath"

    if ($DryRun) {
        Write-Host "    (dry-run) skipped"
        return
    }

    & cmd.exe /d /c "$Command 2>&1" | Tee-Object -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Name (exit code $LASTEXITCODE). See $logPath"
    }
}

Push-Location $repoRoot
try {
    $nodeVersion = (& node -v).Trim()
    $pnpmVersion = (& pnpm.cmd -v).Trim()
    Write-Host "Repo: $repoRoot"
    Write-Host "Node: $nodeVersion"
    Write-Host "pnpm: $pnpmVersion"
    Write-Host "Artifacts: $runDir"
    Write-Host "CI mode env: CI=true, GITHUB_ACTIONS=true"

    if (-not $nodeVersion.StartsWith("v20.")) {
        if ($AllowNodeDrift) {
            Write-Warning "CI uses Node 20.x. Current local Node is $nodeVersion (parity drift allowed by -AllowNodeDrift)."
        }
        else {
            throw "CI parity check failed: local Node is $nodeVersion, but CI uses Node 20.x. Switch to Node 20 and rerun (or pass -AllowNodeDrift)."
        }
    }

    if (-not $SkipAndroid) {
        $androidHome = $env:ANDROID_HOME
        $androidSdkRoot = $env:ANDROID_SDK_ROOT

        if ([string]::IsNullOrWhiteSpace($androidHome) -and [string]::IsNullOrWhiteSpace($androidSdkRoot)) {
            throw "Android parity check failed: ANDROID_HOME/ANDROID_SDK_ROOT is not set. Install Android SDK and export one of these variables."
        }
    }

    if (-not $SkipInstall) {
        Invoke-Step "install_frozen_lockfile" "pnpm.cmd install --frozen-lockfile"
    }

    $env:CI = "true"
    $env:GITHUB_ACTIONS = "true"

    Invoke-Step "version_check" "pnpm.cmd version:check"
    Invoke-Step "docs_check" "pnpm.cmd docs:check"
    Invoke-Step "release_test_pack_skip_preflight" "pnpm.cmd release:test-pack -- --skip-preflight"

    if (-not $Quick) {
        Invoke-Step "ci_scan_pwa_head" "pnpm.cmd ci:scan:pwa:head"
        Invoke-Step "release_preflight_dryrun_tag" "pnpm.cmd release:preflight -- --tag v0.9.0-beta-dryrun --allow-dirty 1"
        Invoke-Step "tauri_cargo_check_with_release_features" "cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml --features ""tauri/custom-protocol tauri/rustls-tls"""
    }

    if (-not $SkipAndroid) {
        Invoke-Step "android_build_apk_aab" "pnpm.cmd -C apps/desktop tauri android build --apk --aab"
    }

    Write-Host ""
    Write-Host "Local CI gate passed."
    Write-Host "Logs: $runDir"
}
catch {
    $message = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { $_.ToString() }
    Write-Host "ERROR: $message" -ForegroundColor Red
    Write-Host ""
    Write-Host "Local CI gate failed."
    Write-Host "Inspect logs in: $runDir"
    exit 1
}
finally {
    if ($null -ne $previousNativeErrorPref) {
        $Global:PSNativeCommandUseErrorActionPreference = $previousNativeErrorPref
    }
    Pop-Location
}
