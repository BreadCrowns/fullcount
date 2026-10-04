$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$testHtml = Join-Path $root "tests\test_resolution.html"
$testUri = "file:///" + $testHtml.Replace('\', '/')

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
Write-Host "Test file: $testHtml" -ForegroundColor Gray
Write-Host "----------------------------------------------------------"

$tempFile = [System.IO.Path]::GetTempFileName()
try {
    cmd.exe /c "`"$browser`" --headless=new --dump-dom `"$testUri`" > `"$tempFile`" 2>&1"
    $output = Get-Content $tempFile -Raw
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
}

$passMatches = [regex]::Matches($output, '<p class="pass">\[PASS\] ([^<]+)</p>')
$failMatches = [regex]::Matches($output, '<p class="fail">\[FAIL\] ([^<]+)</p>')

foreach ($m in $passMatches) {
    Write-Host "  [PASS] $($m.Groups[1].Value)" -ForegroundColor Green
}

foreach ($m in $failMatches) {
    Write-Host "  [FAIL] $($m.Groups[1].Value)" -ForegroundColor Red
}

$passCount = $passMatches.Count
$failCount = $failMatches.Count

Write-Host "----------------------------------------------------------"
if ($failCount -eq 0 -and $passCount -gt 0) {
    Write-Host "[SUCCESS] ALL TESTS PASSED ($passCount passed, 0 failed)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAILURE] TESTS FAILED ($passCount passed, $failCount failed)" -ForegroundColor Red
    exit 1
}
