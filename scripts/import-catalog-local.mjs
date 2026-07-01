#!/usr/bin/env node
/**
 * Import songs.json directly into Supabase (no Vercel API).
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Get service role from Supabase → Settings → API → service_role
 * Run: npm run import:catalog:local
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

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Copy both from Supabase Dashboard → Project Settings → API');
  process.exit(1);
}

const jsonPath = resolve(root, 'radio-dj', 'data', 'songs.json');
const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
const songs = raw.songs || [];

if (!songs.length) {
  console.error('No songs in radio-dj/data/songs.json');
  process.exit(1);
}

const rows = songs.map((song) => ({
  id: song.id,
  artist_name: song.artistName || '',
  song_title: song.songTitle || '',
  year: String(song.year || ''),
  music_style: song.musicStyle || '',
  song_time: song.songTime || '',
  description: song.description || '',
  songwriter: song.songwriter || '',
  featured_artist: song.featuredArtist || '',
  website: song.website || '',
  record_label: song.recordLabel || '',
  release_type: song.releaseType || '',
  album_name: song.albumName || '',
  contact_email: song.contactEmail || '',
  release_date: song.releaseDate || '',
  mp3_url: song.mp3 || '',
  preview_url: song.previewLink || '',
  preview_stream_url: song.previewStreamUrl || '',
  preview_drive_id: song.previewDriveId || '',
  wav_url: song.wav || '',
  cover_url: song.cover || '',
  cover_drive_id: song.coverDriveId || '',
  cover_local: song.coverLocal || '',
  cover_thumbnail_url: song.coverThumbnailUrl || '',
  band_members: song.bandMembers || '',
  band_member_lines: song.bandMemberLines || [],
  spotlight_priority: parseInt(song.spotlightPriority, 10) || 0,
  spotlight_until: song.spotlightUntil || '',
  spotlight_badge: song.spotlightBadge || '',
  updated_at: new Date().toISOString(),
}));

let imported = 0;
const errors = [];
const batchSize = 50;

for (let i = 0; i < rows.length; i += batchSize) {
  const batch = rows.slice(i, i + batchSize);
  const response = await fetch(`${supabaseUrl}/rest/v1/catalog_songs?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(batch),
  });

  if (!response.ok) {
    errors.push(`Batch ${i / batchSize + 1}: ${await response.text()}`);
  } else {
    imported += batch.length;
  }
}

console.log(JSON.stringify({ success: errors.length === 0, imported, total: rows.length, errors }, null, 2));
process.exit(errors.length ? 1 : 0);