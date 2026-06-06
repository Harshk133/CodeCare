# SwasthyaAI — Android Build Script (PowerShell)
# Usage: .\scripts\build-android.ps1
#
# What this script does:
#  1. Builds the Next.js static export (out/)
#  2. Initialises the Android Capacitor project if it doesn't exist yet
#  3. Patches AndroidManifest.xml with required permissions
#  4. Syncs web assets into the Android project
#  5. Opens Android Studio (or runs on a connected device if -Device flag is used)

param(
    [switch]$Device,    # pass -Device to run on connected device instead of opening Studio
    [switch]$SkipBuild  # pass -SkipBuild to reuse the existing out/ folder
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

Write-Host "`n🏗️  SwasthyaAI Android Build" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n"

# ── 1. Build Next.js static export ───────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Host "📦 Building Next.js static export..." -ForegroundColor Yellow
    Set-Location $Root
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Next.js build failed." }
    Write-Host "✅ Build complete → out/`n"
} else {
    Write-Host "⏩ Skipping build (using existing out/)."
}

# ── 2. Add Android platform if not present ────────────────────────────────────
$AndroidDir = Join-Path $Root "android"
if (-not (Test-Path $AndroidDir)) {
    Write-Host "📱 Initialising Android platform..." -ForegroundColor Yellow
    npx cap add android
    if ($LASTEXITCODE -ne 0) { throw "npx cap add android failed." }
    Write-Host "✅ Android project created.`n"
} else {
    Write-Host "✅ Android platform already exists.`n"
}

# ── 3. Patch AndroidManifest.xml with required permissions ───────────────────
$Manifest = Join-Path $Root "android\app\src\main\AndroidManifest.xml"
if (Test-Path $Manifest) {
    $xml = Get-Content $Manifest -Raw

    $permissions = @(
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.CAMERA'
    )

    $changed = $false
    foreach ($perm in $permissions) {
        $tag = "<uses-permission android:name=`"$perm`" />"
        if ($xml -notmatch [regex]::Escape($perm)) {
            # Insert before the <application> tag
            $xml = $xml -replace '(<application)', "$tag`n    `$1"
            $changed = $true
            Write-Host "  ✚ Added: $perm"
        } else {
            Write-Host "  ✓ Already present: $perm"
        }
    }

    if ($changed) {
        $xml | Set-Content $Manifest -Encoding utf8
        Write-Host "`n✅ AndroidManifest.xml patched.`n"
    } else {
        Write-Host "`n✅ AndroidManifest.xml already up-to-date.`n"
    }
} else {
    Write-Host "⚠️  AndroidManifest.xml not found — run after npx cap add android." -ForegroundColor Yellow
}

# ── 4. Sync web assets into Android project ──────────────────────────────────
Write-Host "🔄 Syncing web assets to Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "npx cap sync failed." }
Write-Host "✅ Sync complete.`n"

# ── 5. Open Studio or run on device ──────────────────────────────────────────
if ($Device) {
    Write-Host "📱 Running on connected Android device..." -ForegroundColor Cyan
    npx cap run android
} else {
    Write-Host "🎯 Opening Android Studio..." -ForegroundColor Cyan
    npx cap open android
}

Write-Host "`n🎉 Done! SwasthyaAI is ready for Android.`n" -ForegroundColor Green
