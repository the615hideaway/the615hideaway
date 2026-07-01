#!/usr/bin/env node
/**
 * Quick live-site health check — run: npm run check:live
 */
const SITE = process.env.SITE_URL || 'https://www.the615hideaway.com';

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { res, text, json };
}

async function main() {
  console.log(`Checking ${SITE} …\n`);

  try {
    const home = await fetch(`${SITE}/radio-dj/`);
    if (home.ok) pass('Site up', `HTTP ${home.status} /radio-dj/`);
    else fail('Site up', `HTTP ${home.status} /radio-dj/`);
  } catch (err) {
    fail('Site up', err.message);
  }

  const { res: cfgRes, json: cfg } = await fetchJson(`${SITE}/api/supabase-config`);
  if (cfgRes.ok && cfg?.url && cfg?.anonKey) {
    pass('SUPABASE_URL + SUPABASE_ANON_KEY', cfg.url);
  } else {
    fail('SUPABASE_URL + SUPABASE_ANON_KEY', cfgRes.ok ? 'empty values' : `HTTP ${cfgRes.status}`);
  }

  if (cfg?.url && cfg?.anonKey) {
    const { res: catRes, json: songs } = await fetchJson(
      `${cfg.url}/rest/v1/catalog_songs?select=id&limit=5`,
      {
        headers: {
          apikey: cfg.anonKey,
          Authorization: `Bearer ${cfg.anonKey}`,
        },
      },
    );
    if (catRes.ok) {
      const count = Array.isArray(songs) ? songs.length : 0;
      if (count > 0) pass('Supabase catalog', `${count}+ songs visible`);
      else fail('Supabase catalog', 'catalog_songs is empty — run npm run import:catalog after migrations');
    } else {
      fail('Supabase catalog', songs?.message || `HTTP ${catRes.status}`);
    }
  }

  const { res: importRes, json: importJson } = await fetchJson(`${SITE}/api/import-catalog`, {
    method: 'POST',
    headers: { 'x-service-key': 'health-check-probe' },
  });
  if (importRes.status === 401) {
    pass('RADIO_SERVICE_KEY', 'set (wrong probe key correctly rejected)');
  } else if (importRes.status === 500 && importJson?.error?.includes('SERVICE_ROLE')) {
    fail('SUPABASE_SERVICE_ROLE_KEY', importJson.error);
  } else {
    fail('Import API', importJson?.error || `HTTP ${importRes.status}`);
  }

  const { res: emailRes, json: emailJson } = await fetchJson(`${SITE}/api/radio-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'wav_request' }),
  });
  if (emailRes.status === 401 && emailJson?.error === 'Not signed in.') {
    pass('radio-email API', 'reachable (auth required before Resend check)');
  } else if (emailRes.status === 503) {
    fail('RESEND_API_KEY', emailJson?.error || 'not configured');
  } else {
    fail('radio-email API', emailJson?.error || `HTTP ${emailRes.status}`);
  }

  let ok = 0;
  let bad = 0;
  for (const c of checks) {
    const icon = c.ok ? '✓' : '✗';
    console.log(`${icon} ${c.name}`);
    console.log(`  ${c.detail}\n`);
    if (c.ok) ok += 1;
    else bad += 1;
  }

  console.log(`Result: ${ok} passed, ${bad} failed`);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});