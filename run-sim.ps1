$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$simHtml = Join-Path $root "tests\sim_games.html"
$simUri = "file:///" + $simHtml.Replace('\', '/')
$jsonOut = Join-Path $root "tests\sim_results.json"

$browser = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $browser)) {
    $browser = "C:\Program Files\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $browser)) {
    Write-Error "Chrome executable not found."
    exit 1
}

Write-Host "Running 10-Game Full Count Simulation via Chrome Headless..." -ForegroundColor Cyan
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    cmd.exe /c "`"$browser`" --headless=new --dump-dom `"$simUri`" > `"$tempFile`" 2>&1"
    $output = Get-Content $tempFile -Raw -Encoding UTF8
} finally {
    if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
}

# Extract JSON from <pre id="results-json">
if ($output -match '(?s)<pre id="results-json"[^>]*>(.*?)</pre>') {
    $jsonText = $matches[1]
    # Decode HTML entities if any
    $jsonText = [System.Net.WebUtility]::HtmlDecode($jsonText)
    Set-Content -Path $jsonOut -Value $jsonText -Encoding UTF8
    Write-Host "[SUCCESS] Simulation results saved to $jsonOut" -ForegroundColor Green
    
    $data = $jsonText | ConvertFrom-Json
    Write-Host ""
    Write-Host "================== FULL COUNT 10-GAME SIMULATION SUMMARY ==================" -ForegroundColor Yellow
    Write-Host "Total Games: $($data.summary.totalGames) | Total PAs: $($data.summary.totalPAs)" -ForegroundColor White
    Write-Host "Total Runs: $($data.summary.totalRuns) (Avg: $($data.summary.avgRunsPerGame)/gm) | Total Hits: $($data.summary.totalHits)" -ForegroundColor White
    Write-Host "Home Wins: $($data.summary.homeWins) | Away Wins: $($data.summary.awayWins) | Ties: $($data.summary.ties)" -ForegroundColor White
    Write-Host "---------------------------------------------------------------------------"
    foreach ($g in $data.games) {
        $winnerColor = if ($g.winner -eq "host") { "Green" } else { "Cyan" }
        Write-Host ("Game {0,2}: {1,-26} {2,2} vs {3,-26} {4,2} ({5} inn) -> Winner: {6}" -f `
            $g.id, $g.rosters.guest.name, $g.finalScore.guest, $g.rosters.host.name, $g.finalScore.host, $g.inningsPlayed, $g.winnerName) -ForegroundColor $winnerColor
    }
    Write-Host "===========================================================================" -ForegroundColor Yellow
    exit 0
} else {
    Write-Error "Could not find simulation results in DOM output."
    exit 1
}
