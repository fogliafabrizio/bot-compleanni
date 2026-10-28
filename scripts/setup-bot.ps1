# setup-bot.ps1 - Primo setup e deploy del bot Compleanni su Cloudflare (Workers + D1)
# Da lanciare nella cartella del progetto (es. C:\Users\<te>\Projects\bot-compleanni),
# DOPO che la feature 001 e' implementata e i test sono verdi.
# Lancio: powershell -ExecutionPolicy Bypass -File .\setup-bot.ps1
# Requisiti: Node.js installato, bot creato con @BotFather.

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
if (-not (Test-Path ".\wrangler.jsonc")) { Fail "wrangler.jsonc non trovato: lancia lo script dalla cartella del progetto." }
npm install
Check "npm install fallito."

# 1. Login Cloudflare (apre il browser)
Step "1. Login a Cloudflare"
# "wrangler whoami" esce con codice 0 anche se non autenticato: si controlla il testo.
function Test-CfLogin { $o = (npx wrangler whoami 2>&1 | Out-String); return ($LASTEXITCODE -eq 0 -and $o -notmatch "not authenticated") }
if (-not (Test-CfLogin)) {
    npx wrangler login
    if (-not (Test-CfLogin)) { Fail "Login a Cloudflare non riuscito." }
    Write-Host "Login effettuato." -ForegroundColor Green
} else { Write-Host "Gia' loggato." -ForegroundColor Green }

# 2. Database D1 e aggiornamento wrangler.jsonc
Step "2. Database D1 '$DbName'"
$config = Get-Content ".\wrangler.jsonc" -Raw -Encoding UTF8
if ($config -match "REPLACE_ME") {
    $out = (npx wrangler d1 create $DbName 2>&1 | Out-String)
    Write-Host $out
    $m = [regex]::Match($out, '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})')
    if ($m.Success) { $dbId = $m.Groups[1].Value }
    else { $dbId = Read-Host "Non trovo il database_id nell'output (se il DB esiste gia', prendilo con 'npx wrangler d1 list'): incollalo qui" }
    if ($dbId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { Fail "database_id non valido: wrangler.jsonc non modificato." }
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
Write-Host $deployOut
if ($LASTEXITCODE -ne 0) {
    if ($deployOut -match "workers\.dev subdomain") {
        Fail "Manca il sottodominio workers.dev: lancia 'npx wrangler deploy' a mano, rispondi Y alla registrazione, poi rilancia questo script."
    }
    Fail "Deploy non riuscito."
}
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
Write-Host "Per i deploy successivi basta: npx wrangler d1 migrations apply $DbName --remote ; npx wrangler deploy"
