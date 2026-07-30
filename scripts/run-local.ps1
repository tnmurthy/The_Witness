# =============================================================================
# scripts/run-local.ps1
# The Witness — Full Bootstrap Runner (Windows PowerShell)
#
# Run from the project root:
#   .\scripts\run-local.ps1 2>&1 | Tee-Object bootstrap-output.txt
# =============================================================================

$ErrorActionPreference = "Continue"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  The Witness — Full Bootstrap Sequence" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ── Load .env.local ───────────────────────────────────────────────────────────
if (-not (Test-Path ".env.local")) {
    Write-Host "ERROR: .env.local not found" -ForegroundColor Red
    Write-Host "Copy .env.example to .env.local and fill in your Supabase values."
    exit 1
}

Get-Content ".env.local" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
        $key = $Matches[1].Trim()
        $val = $Matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($key, $val, "Process")
    }
}
Write-Host "OK  .env.local loaded" -ForegroundColor Green
Write-Host "    URL: $env:NEXT_PUBLIC_SUPABASE_URL"
Write-Host ""

# ── Install dependencies ──────────────────────────────────────────────────────
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install --silent
Write-Host "OK  npm install complete" -ForegroundColor Green
Write-Host ""

# ── Bootstrap ─────────────────────────────────────────────────────────────────
Write-Host "Running bootstrap (migrations + storage + realtime + RLS)..." -ForegroundColor Yellow
Write-Host ""
node scripts/bootstrap.js
Write-Host ""

# ── RLS Validation ────────────────────────────────────────────────────────────
Write-Host "Running RLS validation..." -ForegroundColor Yellow
Write-Host ""
node scripts/validate-rls.js
Write-Host ""

# ── Generate types ────────────────────────────────────────────────────────────
Write-Host "Generating TypeScript types from live schema..." -ForegroundColor Yellow
$env:TYPEGEN_DB_URL = $env:SUPABASE_DB_URL
node scripts/generate-db-types.js | Out-File -FilePath "src/lib/supabase/database.types.ts" -Encoding utf8
Write-Host "OK  Types generated" -ForegroundColor Green
Write-Host ""

# ── Auth smoke test ────────────────────────────────────────────────────────────
Write-Host "Auth smoke test (trigger + profile creation)..." -ForegroundColor Yellow
node -e @"
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
async function run() {
  const email = 'smoke-' + Date.now() + '@test.invalid';
  const { data, error } = await admin.auth.admin.createUser({ email, password: 'Test123!', email_confirm: true });
  if (error) { console.log('FAIL:', error.message); return; }
  const uid = data.user.id;
  console.log('OK  User created:', uid);
  await new Promise(r => setTimeout(r, 2000));
  const { data: p, error: pe } = await admin.from('profiles').select('id,role').eq('id', uid).single();
  if (pe || !p) console.log('FAIL  Profile not created by trigger:', pe?.message);
  else console.log('OK  Profile created by trigger, role:', p.role);
  await admin.auth.admin.deleteUser(uid);
  console.log('OK  Cleaned up');
}
run().catch(e => console.log('ERROR:', e.message));
"@
Write-Host ""

# ── Storage smoke test ────────────────────────────────────────────────────────
Write-Host "Storage smoke test (publication-logos bucket)..." -ForegroundColor Yellow
node -e @"
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
async function run() {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const path = 'smoke-test/test.png';
  const { error } = await admin.storage.from('publication-logos').upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) { console.log('FAIL upload:', error.message); return; }
  console.log('OK  Uploaded test image to publication-logos');
  const { data: { publicUrl } } = admin.storage.from('publication-logos').getPublicUrl(path);
  console.log('OK  Public URL:', publicUrl);
  await admin.storage.from('publication-logos').remove([path]);
  console.log('OK  Cleaned up');
}
run().catch(e => console.log('ERROR:', e.message));
"@
Write-Host ""

# ── AI smoke test ─────────────────────────────────────────────────────────────
if ($env:OPENAI_API_KEY) {
    Write-Host "AI smoke test (OpenAI)..." -ForegroundColor Yellow
    node -e @"
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 10, messages: [{ role: 'user', content: 'Say: OK' }] })
}).then(r => r.json()).then(d => console.log('OK  OpenAI:', d.choices?.[0]?.message?.content ?? JSON.stringify(d).slice(0,80)))
  .catch(e => console.log('FAIL:', e.message));
"@
    Write-Host ""
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Done. Paste the full output above to Claude." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
