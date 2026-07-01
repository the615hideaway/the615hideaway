const SONG_COLUMNS = [
  'id',
  'artist_name',
  'song_title',
  'year',
  'music_style',
  'song_time',
  'description',
  'songwriter',
  'featured_artist',
  'website',
  'record_label',
  'release_type',
  'album_name',
  'contact_email',
  'release_date',
  'mp3_url',
  'preview_url',
  'preview_stream_url',
  'preview_drive_id',
  'wav_url',
  'cover_url',
  'cover_drive_id',
  'cover_local',
  'cover_thumbnail_url',
  'band_members',
  'band_member_lines',
  'spotlight_priority',
  'spotlight_until',
  'spotlight_badge',
].join(',');

const SPOTLIGHT_COLUMNS = 'artist_name,song_title,priority,until_date,badge';

function parseContentRange(header) {
  if (!header) return null;
  const match = header.match(/\/(\d+|\*)/);
  if (!match || match[1] === '*') return null;
  return parseInt(match[1], 10);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ error: 'Supabase is not configured on the server.' });
    return;
  }

  const offset = Math.max(0, parseInt(req.query.offset || '0', 10) || 0);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit || '100', 10) || 100), 200);
  const includeSpotlights = req.query.spotlights === '1' || offset === 0;

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Accept-Profile': 'public',
    Prefer: 'count=exact',
  };

  try {
    const songsUrl = `${supabaseUrl}/rest/v1/catalog_songs?select=${SONG_COLUMNS}&order=artist_name.asc&offset=${offset}&limit=${limit}`;
    const requests = [fetch(songsUrl, { headers })];

    if (includeSpotlights) {
      const spotlightsUrl = `${supabaseUrl}/rest/v1/catalog_spotlights?select=${SPOTLIGHT_COLUMNS}`;
      requests.push(fetch(spotlightsUrl, { headers }));
    }

    const [songsRes, spotlightsRes] = await Promise.all(requests);

    if (!songsRes.ok) {
      const errBody = await songsRes.text();
      res.status(songsRes.status).json({ error: errBody || 'Could not load catalog songs.' });
      return;
    }

    const songs = await songsRes.json();
    const total = parseContentRange(songsRes.headers.get('content-range'));
    const count = Array.isArray(songs) ? songs.length : 0;
    const hasMore = total != null ? offset + count < total : count === limit;

    let spotlights = [];
    if (includeSpotlights && spotlightsRes) {
      if (spotlightsRes.ok) {
        spotlights = await spotlightsRes.json();
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({
      success: true,
      source: 'supabase',
      offset,
      limit,
      total: total ?? null,
      hasMore,
      songCount: count,
      songs: Array.isArray(songs) ? songs : [],
      spotlights: Array.isArray(spotlights) ? spotlights : [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Catalog request failed.' });
  }
};