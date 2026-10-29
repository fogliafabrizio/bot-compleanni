# smoke-postman.ps1 - Prepara i test locali con Postman (vedi postman/README.md).
# Applica le migration e il seed sul D1 locale, genera l'environment Postman gia' compilato
# con i valori di .dev.vars, avvia wrangler dev in una nuova finestra e l'helper della collection
# (postman/helper.mjs) in questa. Le risposte del bot arrivano su Telegram.
# Lancio, dalla cartella del progetto: powershell -ExecutionPolicy Bypass -File .\scripts\smoke-postman.ps1

# "Continue" e non "Stop": in PowerShell 5.1 l'output su stderr di npx/wrangler
# verrebbe trattato come errore bloccante. Gli errori si controllano con $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$DbName = "birthday-bot-db"
$EnvOut = "postman\locale.local.postman_environment.json"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`n[ERRORE] $msg" -ForegroundColor Red; exit 1 }
function Check($msg) { if ($LASTEXITCODE -ne 0) { Fail $msg } }

# 0. Controlli e lettura di .dev.vars
Step "0. Controllo prerequisiti"
if (-not (Test-Path ".\wrangler.jsonc")) { Fail "wrangler.jsonc non trovato: lancia lo script dalla cartella del progetto." }
if (-not (Test-Path ".\.dev.vars")) { Fail ".dev.vars non trovato: copia .dev.vars.example e compila i valori." }
$vars = @{}
foreach ($line in Get-Content ".\.dev.vars" -Encoding UTF8) {
    if ($line -match '^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$') { $vars[$Matches[1]] = $Matches[2] }
}
foreach ($k in "TELEGRAM_BOT_TOKEN", "OWNER_TELEGRAM_ID", "WEBHOOK_SECRET") {
    if (-not $vars[$k]) { Fail "$k vuoto in .dev.vars." }
}
if ($vars["OWNER_TELEGRAM_ID"] -notmatch '^\d+$') { Fail "OWNER_TELEGRAM_ID deve essere un numero." }

# 1. D1 locale: migration e dati di prova (il seed tocca solo gli id 9001-9006, 9101-9106, 9201-9202)
Step "1. Migration e seed sul D1 locale"
npx wrangler d1 migrations apply $DbName --local
Check "Migration locali non applicate."
npx wrangler d1 execute $DbName --local --file postman/seed-smoke.sql
Check "Seed non applicato."

# 2. Environment Postman compilato (ignorato da git: contiene il secret)
Step "2. Environment Postman"
$envJson = Get-Content "postman\locale.postman_environment.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$envJson.name = "bot-compleanni locale (compilato)"
foreach ($v in $envJson.values) {
    if ($v.key -eq "webhookSecret") { $v.value = $vars["WEBHOOK_SECRET"] }
    if ($v.key -eq "ownerId") { $v.value = $vars["OWNER_TELEGRAM_ID"] }
}
[IO.File]::WriteAllText((Join-Path (Get-Location) $EnvOut), ($envJson | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
Write-Host "Creato $EnvOut" -ForegroundColor Green
Write-Host "In Postman importa:"
Write-Host "  - postman\bot-compleanni.postman_collection.json"
Write-Host "  - $EnvOut  (poi selezionalo in alto a destra)"
Write-Host "Apri la chat del bot su Telegram e lancia le cartelle in ordine (Runner o una alla volta)."

# 3. Worker locale in una nuova finestra; --test-scheduled abilita /__scheduled (cartella 10)
Step "3. Avvio wrangler dev su http://localhost:8787 (nuova finestra)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx wrangler dev --test-scheduled" -WorkingDirectory (Get-Location)

# 4. Helper della collection (resta in primo piano: Ctrl+C per fermarlo)
Step "4. Avvio helper su http://localhost:8788"
node postman/helper.mjs
