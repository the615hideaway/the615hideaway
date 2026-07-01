const SupabaseCatalog = {
  rowToSong(row) {
    return {
      id: row.id,
      artistName: row.artist_name || '',
      songTitle: row.song_title || '',
      year: row.year || '',
      mp3: row.mp3_url || '',
      previewLink: row.preview_url || '',
      previewStreamUrl: row.preview_stream_url || '',
      previewDriveId: row.preview_drive_id || '',
      wav: row.wav_url || '',
      cover: row.cover_url || '',
      coverDriveId: row.cover_drive_id || '',
      coverLocal: row.cover_local || '',
      coverThumbnailUrl: row.cover_thumbnail_url || '',
      songTime: row.song_time || '',
      description: row.description || '',
      musicStyle: row.music_style || '',
      bandMemberLines: Array.isArray(row.band_member_lines) ? row.band_member_lines : [],
      bandMembers: row.band_members || '',
      songwriter: row.songwriter || '',
      featuredArtist: row.featured_artist || '',
      website: row.website || '',
      recordLabel: row.record_label || '',
      releaseType: row.release_type || '',
      albumName: row.album_name || '',
      contactEmail: row.contact_email || '',
      releaseDate: row.release_date || '',
      spotlightPriority: parseInt(row.spotlight_priority, 10) || 0,
      spotlightUntil: row.spotlight_until || '',
      spotlightBadge: row.spotlight_badge || '',
    };
  },

  pickKey(artistName, songTitle) {
    return `${String(artistName || '').trim()}|${String(songTitle || '').trim()}`.toLowerCase();
  },

  applySpotlights(songs, spotlights) {
    if (!spotlights?.length) return songs;
    const map = new Map(
      spotlights.map((pick) => [this.pickKey(pick.artist_name, pick.song_title), pick]),
    );

    return songs.map((song) => {
      const pick = map.get(this.pickKey(song.artistName, song.songTitle));
      if (!pick) return song;
      return {
        ...song,
        spotlightPriority: parseInt(pick.priority, 10) || song.spotlightPriority || 0,
        spotlightUntil: pick.until_date || pick.until || song.spotlightUntil || '',
        spotlightBadge: pick.badge || song.spotlightBadge || 'Featured',
      };
    });
  },

  async fetchCatalogViaApi() {
    const batchSize = 100;
    let offset = 0;
    let spotlights = [];
    const allRows = [];
    let total = null;

    while (true) {
      const apiBase = `${window.location.origin}/api/catalog`;
      const response = await fetch(`${apiBase}?offset=${offset}&limit=${batchSize}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || `Catalog API failed (HTTP ${response.status}).`);
      }

      const rows = Array.isArray(payload.songs) ? payload.songs : [];
      if (offset === 0 && Array.isArray(payload.spotlights)) {
        spotlights = payload.spotlights;
      }

      allRows.push(...rows);
      total = payload.total ?? total;

      if (!payload.hasMore || !rows.length) break;
      offset += batchSize;

      if (offset > 5000) break;
    }

    if (!allRows.length) {
      throw new Error('Supabase catalog is empty. Run the catalog import after migration-catalog.sql.');
    }

    return { rows: allRows, spotlights, total };
  },

  async fetchCatalogViaClient() {
    const supabase = await HideawayAuth.init();

    const [{ data: songs, error: songsError }, { data: spotlights, error: spotlightsError }] = await Promise.all([
      supabase.from('catalog_songs').select('*').order('artist_name', { ascending: true }),
      supabase.from('catalog_spotlights').select('*'),
    ]);

    if (songsError) throw songsError;
    if (spotlightsError) throw spotlightsError;
    if (!songs?.length) {
      throw new Error('Supabase catalog is empty. Run the catalog import after migration-catalog.sql.');
    }

    return { rows: songs, spotlights: spotlights || [], total: songs.length };
  },

  async fetchCatalogPayload() {
    let rows = [];
    let spotlights = [];
    let total = null;

    try {
      const apiResult = await this.fetchCatalogViaApi();
      rows = apiResult.rows;
      spotlights = apiResult.spotlights;
      total = apiResult.total;
    } catch (apiErr) {
      console.warn('Catalog API failed, trying direct Supabase client:', apiErr.message);
      const clientResult = await this.fetchCatalogViaClient();
      rows = clientResult.rows;
      spotlights = clientResult.spotlights;
      total = clientResult.total;
    }

    const normalized = this.applySpotlights(
      rows.map((row) => this.rowToSong(row)),
      spotlights,
    );

    return {
      success: true,
      source: 'supabase',
      syncedAt: new Date().toISOString(),
      songCount: total ?? normalized.length,
      songs: normalized,
    };
  },
};