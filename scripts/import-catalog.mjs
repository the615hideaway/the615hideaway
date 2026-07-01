#!/usr/bin/env node
/**
 * Import songs.json into Supabase catalog.
 * Needs RADIO_SERVICE_KEY in .env.local or environment.
 * Run: npm run import:catalog
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envPath = resolve(root, '.env.local');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (value && !process.env[key]) process.env[key] = value;
  }
}

const SITE = process.env.SITE_URL || 'https://www.the615hideaway.com';
const key = process.env.RADIO_SERVICE_KEY || '';

if (!key) {
  console.error('Missing RADIO_SERVICE_KEY.');
  console.error('Add it to .env.local (see .env.local.example) or set the env var, then retry.');
  process.exit(1);
}

const res = await fetch(`${SITE}/api/import-catalog`, {
  method: 'POST',
  headers: { 'x-service-key': key },
});

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch (_) {
  data = { raw: text };
}

console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(data, null, 2));
process.exit(res.ok ? 0 : 1);