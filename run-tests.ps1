$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

# Find browser
$browser = $null
$candidates = @(
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

foreach ($c in $candidates) {
    if (Test-Path $c) {
        $browser = $c
        break
    }
}

if (-not $browser) {
    Write-Error "No compatible browser (Chrome or Edge) found to run headless tests."
    exit 1
}

Write-Host "Running tests using: $browser" -ForegroundColor Cyan

$testFiles = @(
    (Join-Path $root "tests\test_resolution.html"),
    (Join-Path $root "tests\test_play_ui.html")
)

$totalPass = 0
$totalFail = 0


foreach ($tFile in $testFiles) {
    $tUri = "file:///" + $tFile.Replace('\', '/')
    Write-Host "Running test file: $tFile" -ForegroundColor Cyan
    Write-Host "----------------------------------------------------------"
    $tempFile = [System.IO.Path]::GetTempFileName()
    try {
        cmd.exe /c "`"$browser`" --headless=new --dump-dom `"$tUri`" > `"$tempFile`" 2>&1"
        $output = Get-Content $tempFile -Raw
    } finally {
        if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
    }

    $cleanOutput = $output -replace '(?s)<script[^>]*>.*?</script>', ''
    $passMatches = [regex]::Matches($cleanOutput, '<p class="pass">\[PASS\] ([^<]+)</p>')
    $failMatches = [regex]::Matches($cleanOutput, '<p class="fail">\[(FAIL|SYNTAX|FATAL)[^<]*\] ([^<]+)</p>')


    foreach ($m in $passMatches) {
        Write-Host "  [PASS] $($m.Groups[1].Value)" -ForegroundColor Green
    }
    foreach ($m in $failMatches) {
        Write-Host "  [FAIL] $($m.Groups[2].Value)" -ForegroundColor Red
    }

    $totalPass += $passMatches.Count
    $totalFail += $failMatches.Count
    Write-Host "----------------------------------------------------------"
}

if ($totalFail -eq 0 -and $totalPass -gt 0) {
    Write-Host "[SUCCESS] ALL TESTS PASSED ($totalPass passed, 0 failed)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAILURE] TESTS FAILED ($totalPass passed, $totalFail failed)" -ForegroundColor Red
    exit 1
}

