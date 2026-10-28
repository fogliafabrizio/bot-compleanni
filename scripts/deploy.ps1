# deploy.ps1 - Deploy successivi del bot Compleanni (dopo il merge di ogni feature su main)
# Lancio dalla cartella del progetto: powershell -ExecutionPolicy Bypass -File .\deploy.ps1

$ErrorActionPreference = "Continue"
$DbName = "birthday-bot-db"

function Fail($msg) { Write-Host "`n[ERRORE] $msg" -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".\wrangler.jsonc")) { Fail "Lancia lo script dalla cartella del progetto." }
if ((Get-Content ".\wrangler.jsonc" -Raw) -match "REPLACE_ME") { Fail "Primo deploy non ancora fatto: lancia prima setup-bot.ps1." }

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
    $ans = Read-Host "Sei sul branch '$branch', non su main. Continuare comunque? (s/N)"
    if ($ans -notmatch '^[sSyY]') { exit 0 }
}

Write-Host "`n=== Test ===" -ForegroundColor Cyan
npm test
if ($LASTEXITCODE -ne 0) { Fail "Test falliti: deploy annullato." }

Write-Host "`n=== Migration ===" -ForegroundColor Cyan
npx wrangler d1 migrations apply $DbName --remote
if ($LASTEXITCODE -ne 0) { Fail "Migration non applicate." }

Write-Host "`n=== Deploy ===" -ForegroundColor Cyan
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { Fail "Deploy non riuscito." }

Write-Host "`nDeploy completato. Prova il bot su Telegram." -ForegroundColor Green
