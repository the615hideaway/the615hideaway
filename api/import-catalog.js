const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const serviceKey = process.env.RADIO_SERVICE_KEY || '';
  const provided = req.headers['x-service-key'] || '';
  if (!serviceKey || provided !== serviceKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({
      error: 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel to import the catalog.',
    });
    return;
  }

  const jsonPath = path.join(process.cwd(), 'radio-dj', 'data', 'songs.json');
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const songs = raw.songs || [];
  if (!songs.length) {
    res.status(400).json({ error: 'No songs found in radio-dj/data/songs.json' });
    return;
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
  const batchSize = 50;
  const errors = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const response = await fetch(`${supabaseUrl}/rest/v1/catalog_songs?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceKey,
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const text = await response.text();
      errors.push(`Batch ${i / batchSize + 1}: ${text}`);
    } else {
      imported += batch.length;
    }
  }

  res.status(errors.length ? 207 : 200).json({
    success: errors.length === 0,
    imported,
    total: rows.length,
    errors,
  });
};