param(
    [int]$Port = 8080,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.md'   = 'text/markdown; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$url = "http://localhost:$Port/"
$listener.Prefixes.Add($url)

try {
    $listener.Start()
} catch {
    Write-Host "Port $Port is in use. Trying port $($Port + 1)..." -ForegroundColor Yellow
    $Port = $Port + 1
    $listener = New-Object System.Net.HttpListener
    $url = "http://localhost:$Port/"
    $listener.Prefixes.Add($url)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [FULL COUNT] Local Development Server" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Serving files from : $root"
Write-Host " URL                : $url" -ForegroundColor Yellow
Write-Host " Lobby page         : ${url}index.html" -ForegroundColor Yellow
Write-Host " Unit tests         : ${url}tests/test_resolution.html" -ForegroundColor Yellow
Write-Host " Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

if (-not $NoBrowser) {
    try { Start-Process "${url}index.html" } catch {}
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = $request.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($path)) {
                $path = 'index.html'
            }

            $filePath = [System.IO.Path]::Combine($root, $path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))

            if ([System.IO.File]::Exists($filePath)) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }
                
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $mime
                $response.ContentLength64 = $bytes.Length
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.Headers.Add("Access-Control-Allow-Origin", "*")
                $response.StatusCode = 200

                if ($request.HttpMethod -ne 'HEAD') {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                Write-Host "[$($response.StatusCode)] $($request.HttpMethod) $path" -ForegroundColor DarkGreen
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
                $response.ContentType = "text/plain"
                $response.ContentLength64 = $errBytes.Length
                if ($request.HttpMethod -ne 'HEAD') {
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                }
                Write-Host "[404] $($request.HttpMethod) $path" -ForegroundColor Red
            }
        } catch {
            Write-Host "Error handling request: $_" -ForegroundColor Red
        } finally {
            try { $response.Close() } catch {}
        }
    }
} finally {
    try { $listener.Stop() } catch {}
    try { $listener.Close() } catch {}
    Write-Host "Server stopped." -ForegroundColor Yellow
}
