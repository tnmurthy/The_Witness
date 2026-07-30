#!/bin/bash
# =============================================================================
# scripts/run-local.sh
# The Witness — Full Local Bootstrap Runner
#
# Run this from your machine (not the Claude sandbox) from the project root.
# It runs the complete bootstrap + validation sequence and captures all output.
#
# Usage:
#   chmod +x scripts/run-local.sh
#   ./scripts/run-local.sh 2>&1 | tee bootstrap-output.txt
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  The Witness — Full Bootstrap Sequence${NC}"
echo -e "${BOLD}================================================${NC}"
echo ""

# ── 1. Check .env.local ───────────────────────────────────────────────────────
if [ ! -f .env.local ]; then
  echo -e "${RED}ERROR: .env.local not found.${NC}"
  echo "Copy .env.example to .env.local and fill in:"
  echo "  NEXT_PUBLIC_SUPABASE_URL"
  echo "  NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "  SUPABASE_SERVICE_ROLE_KEY"
  echo "  SUPABASE_DB_URL"
  exit 1
fi

# Load env
export $(grep -v '^#' .env.local | grep -v '^$' | xargs)

echo -e "${GREEN}✓${NC}  .env.local loaded"
echo "    URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# ── 2. Install dependencies ───────────────────────────────────────────────────
echo -e "${BOLD}Installing dependencies...${NC}"
npm install --silent
echo -e "${GREEN}✓${NC}  npm install complete"
echo ""

# ── 3. Bootstrap ─────────────────────────────────────────────────────────────
echo -e "${BOLD}Running bootstrap (migrations + storage + realtime + RLS smoke test)...${NC}"
echo ""
node scripts/bootstrap.js
echo ""

# ── 4. RLS validation ────────────────────────────────────────────────────────
echo -e "${BOLD}Running RLS validation against real Supabase sessions...${NC}"
echo ""
node scripts/validate-rls.js
echo ""

# ── 5. Generate types ─────────────────────────────────────────────────────────
echo -e "${BOLD}Generating TypeScript types from live schema...${NC}"
TYPEGEN_DB_URL="$SUPABASE_DB_URL" node scripts/generate-db-types.js > src/lib/supabase/database.types.ts 2>&1 && \
  echo -e "${GREEN}✓${NC}  Types generated → src/lib/supabase/database.types.ts" || \
  echo -e "${YELLOW}⚠${NC}  Type generation failed (non-fatal, using existing types)"
echo ""

# ── 6. Health check ───────────────────────────────────────────────────────────
echo -e "${BOLD}Starting dev server for health check...${NC}"
npm run dev &
DEV_PID=$!
sleep 8

HEALTH=$(curl -s http://localhost:3000/api/health 2>/dev/null)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✓${NC}  /api/health → OK"
  echo "    $HEALTH"
else
  echo -e "${YELLOW}⚠${NC}  /api/health response: $HEALTH"
fi

kill $DEV_PID 2>/dev/null
echo ""

# ── 7. Auth smoke test ────────────────────────────────────────────────────────
echo -e "${BOLD}Auth smoke test (sign-up → profile row creation)...${NC}"
node -e "
const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

const email = 'smoke-test-' + Date.now() + '@witness-test.invalid';
const password = 'SmokeTest123!';

async function run() {
  // Create user
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) { console.log('FAIL create user:', error.message); return; }
  const uid = data.user.id;
  console.log('✓  Auth user created:', uid);

  // Wait for trigger
  await new Promise(r => setTimeout(r, 1500));

  // Verify profile row was auto-created by on_auth_user_created trigger
  const { data: profile, error: pe } = await admin.from('profiles').select('id, role').eq('id', uid).single();
  if (pe || !profile) { console.log('FAIL profile not created:', pe?.message); }
  else { console.log('✓  Profile auto-created by trigger, role:', profile.role); }

  // Cleanup
  await admin.auth.admin.deleteUser(uid);
  console.log('✓  Test user cleaned up');
}
run().catch(e => console.log('ERROR:', e.message));
" 2>&1
echo ""

# ── 8. Storage smoke test ────────────────────────────────────────────────────
echo -e "${BOLD}Storage smoke test (publication-logos bucket)...${NC}"
node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
async function run() {
  // Upload a 1x1 PNG
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const path = 'smoke-test/test-' + Date.now() + '.png';
  const { error } = await admin.storage.from('publication-logos').upload(path, png, { contentType: 'image/png' });
  if (error) { console.log('FAIL upload:', error.message); return; }
  console.log('✓  Uploaded to publication-logos:', path);

  // Get public URL
  const { data: { publicUrl } } = admin.storage.from('publication-logos').getPublicUrl(path);
  console.log('✓  Public URL:', publicUrl);

  // Delete
  await admin.storage.from('publication-logos').remove([path]);
  console.log('✓  Test file deleted');
}
run().catch(e => console.log('ERROR:', e.message));
" 2>&1
echo ""

# ── 9. AI smoke test ─────────────────────────────────────────────────────────
if [ -n "$OPENAI_API_KEY" ] || [ -n "$ANTHROPIC_API_KEY" ]; then
  echo -e "${BOLD}AI provider smoke test...${NC}"
  node -e "
  async function run() {
    const key = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
    
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 20, messages: [{ role: 'user', content: 'Say: AI OK' }] })
      });
      const d = await res.json();
      console.log('✓  Anthropic API reachable:', d.content?.[0]?.text?.trim() ?? JSON.stringify(d).slice(0,60));
    } else {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 20, messages: [{ role: 'user', content: 'Say: AI OK' }] })
      });
      const d = await res.json();
      console.log('✓  OpenAI API reachable:', d.choices?.[0]?.message?.content?.trim() ?? JSON.stringify(d).slice(0,60));
    }
  }
  run().catch(e => console.log('AI ERROR:', e.message));
  " 2>&1
else
  echo -e "${YELLOW}⚠${NC}  No AI key set — skipping AI smoke test"
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}================================================${NC}"
echo -e "${BOLD}  Bootstrap sequence complete.${NC}"
echo -e "${BOLD}  Paste the full output above back to Claude.${NC}"
echo -e "${BOLD}================================================${NC}"
