$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Install Docker Desktop, then reopen PowerShell and run this script again."
}
docker info --format '{{.ServerVersion}}'
if ($LASTEXITCODE -ne 0) { throw "Start Docker Desktop and wait until its engine is running." }

if (-not (Test-Path .env)) {
    $content = [System.IO.File]::ReadAllText((Join-Path $PWD '.env.example'))
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        foreach ($key in @('BETTER_AUTH_SECRET', 'MEDIA_SIGNING_SECRET', 'PAYMENT_WEBHOOK_SECRET')) {
            $bytes = New-Object byte[] 32
            $rng.GetBytes($bytes)
            $secret = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
            $content = [regex]::Replace($content, "(?m)^$key=.*$", "$key=$secret")
        }
    } finally {
        $rng.Dispose()
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $PWD '.env'), $content, $encoding)
    Write-Host 'Created local .env with independent random secrets.'
} else {
    Write-Host 'Existing .env preserved.'
}

docker compose up -d --build --wait --wait-timeout 180
if ($LASTEXITCODE -ne 0) {
    throw "Startup failed. Run: docker compose logs --tail 100"
}

$response = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing
if ($response.StatusCode -ne 200) { throw 'Application health check failed.' }
Write-Host 'VELORA is running at http://localhost:3000'
Start-Process 'http://localhost:3000'
