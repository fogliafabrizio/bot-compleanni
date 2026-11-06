# setup-bot.ps1 - Primo setup e deploy del bot Compleanni su Cloudflare (Workers + D1)
# Da lanciare dalla cartella principale del progetto, su main, DOPO la feature 001:
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-bot.ps1
# Requisiti: Node.js installato, bot creato con @BotFather. Si puo' rilanciare: salta i passi gia' fatti.

# "Continue" e non "Stop": in PowerShell 5.1 l'output su stderr di npx/wrangler
# verrebbe trattato come errore bloccante. Gli errori si controllano con $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$DbName = "birthday-bot-db"

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`n[ERRORE] $msg" -ForegroundColor Red; exit 1 }
function Check($msg) { if ($LASTEXITCODE -ne 0) { Fail $msg } }

# 0. Controlli
Step "0. Controllo prerequisiti"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js non trovato." }
if (-not (Test-Path ".\wrangler.jsonc")) { Fail "wrangler.jsonc non trovato: lancia lo script dalla cartella principale del progetto." }
npm install
Check "npm install fallito."

# 1. Login Cloudflare (apre il browser).
# 'wrangler whoami' esce con 0 anche quando NON sei loggato: va letto il testo.
Step "1. Login a Cloudflare"
$who = (npx wrangler whoami 2>&1 | Out-String)
if ($who -match "not authenticated" -or $who -notmatch "logged in") {
    Write-Host "Non sei loggato: si apre il browser, accedi (o crea un account gratuito) e autorizza Wrangler." -ForegroundColor Yellow
    npx wrangler login
    Check "Login a Cloudflare non riuscito."
    $who = (npx wrangler whoami 2>&1 | Out-String)
    if ($who -notmatch "logged in") { Fail "Login non riuscito: rilancia lo script." }
}
Write-Host "Login Cloudflare OK" -ForegroundColor Green

function Get-DbId {
    $json = (npx wrangler d1 list --json 2>$null | Out-String)
    try {
        $db = ($json | ConvertFrom-Json) | Where-Object { $_.name -eq $DbName } | Select-Object -First 1
        if ($db) { return $db.uuid }
    } catch { }
    return $null
}

# 2. Database D1 e aggiornamento wrangler.jsonc
Step "2. Database D1 '$DbName'"
$config = Get-Content ".\wrangler.jsonc" -Raw
if ($config -match "REPLACE_ME") {
    $dbId = Get-DbId
    if (-not $dbId) {
        # Lanciato senza catturare l'output, cosi' wrangler resta interattivo
        npx wrangler d1 create $DbName
        $dbId = Get-DbId
    } else {
        Write-Host "Il database esiste gia', lo riuso." -ForegroundColor Yellow
    }
    if (-not $dbId) { Fail "Non riesco a trovare il database '$DbName'. Controlla con 'npx wrangler d1 list'." }
    $config = $config.Replace("REPLACE_ME", $dbId)
    [IO.File]::WriteAllText((Resolve-Path ".\wrangler.jsonc"), $config, (New-Object System.Text.UTF8Encoding $false))
    Write-Host "database_id impostato: $dbId" -ForegroundColor Green
} else {
    Write-Host "database_id gia' presente in wrangler.jsonc, salto la creazione." -ForegroundColor Yellow
}

# 3. Migration sul DB remoto
Step "3. Applicazione migration"
npx wrangler d1 migrations apply $DbName --remote
Check "Migration non applicate."

# 4. Deploy (prima dei secret, cosi' il Worker esiste gia')
Step "4. Deploy del Worker"
$deployOut = (npx wrangler deploy 2>&1 | Out-String)
$deployExit = $LASTEXITCODE
Write-Host $deployOut
if ($deployExit -ne 0) { Fail "Deploy non riuscito." }
$u = [regex]::Match($deployOut, 'https://[^\s]+\.workers\.dev')
if ($u.Success) { $workerUrl = $u.Value }
else { $workerUrl = Read-Host "Non trovo l'URL del Worker: incollalo (es. https://bot-compleanni.xxx.workers.dev)" }

# 5. Secret
Step "5. Configurazione secret"
$token   = Read-Host "Token del bot (da @BotFather)"
$ownerId = Read-Host "Il tuo ID Telegram numerico (scrivi a @userinfobot per saperlo)"
if ($ownerId -notmatch '^\d+$') { Fail "L'ID Telegram deve essere un numero." }
$secret  = [guid]::NewGuid().ToString("N")

$token   | npx wrangler secret put TELEGRAM_BOT_TOKEN; Check "Secret TELEGRAM_BOT_TOKEN non impostato."
$ownerId | npx wrangler secret put OWNER_TELEGRAM_ID;  Check "Secret OWNER_TELEGRAM_ID non impostato."
$secret  | npx wrangler secret put WEBHOOK_SECRET;     Check "Secret WEBHOOK_SECRET non impostato."

# 6. Registrazione webhook su Telegram con token segreto (RNF-03)
Step "6. Registrazione webhook"
$body = @{
    url                  = "$workerUrl/webhook"
    secret_token         = $secret
    allowed_updates      = '["message","callback_query"]'
    drop_pending_updates = "true"
}
try {
    $res = Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$token/setWebhook" -Body $body
    if ($res.ok) { Write-Host "Webhook registrato su $workerUrl/webhook" -ForegroundColor Green }
    else { Fail "Errore webhook: $($res.description)" }
    $info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$token/getWebhookInfo"
    Write-Host ("Stato webhook: " + ($info.result | ConvertTo-Json -Compress))
} catch { Fail "Chiamata a Telegram fallita (token corretto?): $($_.Exception.Message)" }

Step "Fatto! Apri il bot su Telegram e scrivi /start"
Write-Host "Ricordati di fare commit di wrangler.jsonc (ora contiene il database_id, che non e' un segreto)."
Write-Host "Per i deploy successivi: powershell -ExecutionPolicy Bypass -File .\scripts\deploy.ps1"