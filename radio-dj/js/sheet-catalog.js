/**
 * Loads the Radio Now catalog live from Google Sheets (Form Responses 1 + Sheet1).
 * New form submissions appear on the site as soon as someone refreshes — no GitHub sync wait.
 */
const SheetCatalog = {
  cellValue(cell) {
    if (!cell) return '';
    if (cell.f && String(cell.f).trim()) return String(cell.f).trim();
    if (cell.v == null) return '';
    if (typeof cell.v === 'number') return String(Math.round(cell.v));
    return String(cell.v).trim();
  },

  formatInstrumentLine(value) {
    const text = String(value || '').trim();
    const match = text.match(/^(.+?)\s*-\s*(.+)$/);
    return match ? `${match[1].trim()}: ${match[2].trim()}` : text;
  },

  buildBandMemberLines(record) {
    const lines = [];
    if (record['Lead Vocals']) lines.push(`Lead Vocals: ${record['Lead Vocals'].trim()}`);

    for (let n = 1; n <= 4; n += 1) {
      const value = record[`Harmony Vocals ${n}`];
      if (value) lines.push(`Harmony Vocals: ${value.trim()}`);
    }

    for (let n = 1; n <= 8; n += 1) {
      const value = record[`Instrument  Player ${n}`] || record[`Instrument Player ${n}`];
      if (value) lines.push(this.formatInstrumentLine(value));
    }

    if (record['Band Members']) {
      String(record['Band Members']).split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) lines.push(trimmed);
      });
    }

    return lines;
  },

  buildSongFromRecord(record, index) {
    const artist = record['Artist Name'];
    const title = record['Song Title'];
    if (!artist && !title) return null;

    const mp3 = record.MP3 || record.MP3s || '';
    const cover = record['Cover Art'] || record.Cover || '';
    const wav = record.WAV || '';
    const previewDriveId = Utils.extractDriveId(mp3) || '';
    const coverDriveId = Utils.extractDriveId(cover) || '';

    let previewStreamUrl = '';
    if (previewDriveId) {
      previewStreamUrl = Utils.toPreviewStreamUrl(mp3);
    } else if (/^https?:\/\//i.test(mp3)) {
      previewStreamUrl = mp3;
    }

    const bandMemberLines = this.buildBandMemberLines(record);
    const releaseType = record['TAG - Album/Single'] || record['Album/Single'] || '';
    const albumName = record['Album Title'] || record['Album Name'] || record.Album || '';
    const releaseDate = record['Release Date'] || record['Radio Now Release'] || record['Added Date'] || '';
    const spotlightPriority = record['Spotlight Priority'] || record.Spotlight || '';
    const spotlightUntil = record['Spotlight Until'] || record['Spotlight End'] || '';

    return {
      id: `song-${index}`,
      artistName: artist,
      songTitle: title,
      year: record.Year || '',
      mp3: Utils.toDriveDownload(mp3),
      previewLink: mp3,
      previewStreamUrl,
      previewDriveId,
      wav: Utils.toDriveDownload(wav),
      cover,
      coverDriveId,
      coverLocal: '',
      coverThumbnailUrl: Utils.toDriveThumbnail(cover),
      songTime: record['Song Time'] || '',
      description: Utils.stripHtml(record.Description || ''),
      musicStyle: record['Music Style'] || '',
      bandMemberLines,
      bandMembers: bandMemberLines.join('; '),
      songwriter: record.Songwriter || '',
      featuredArtist: record['Featured Artist'] || '',
      website: record.Website || '',
      recordLabel: record['Record Label'] || '',
      releaseType,
      albumName,
      contactEmail: record['Contact E-Mail'] || '',
      releaseDate,
      spotlightPriority,
      spotlightUntil,
    };
  },

  async fetchSheetRecords(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Sheet "${sheetName}" HTTP ${response.status}`);

    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?/);
    if (!match) throw new Error(`Sheet "${sheetName}" response could not be parsed`);

    const payload = JSON.parse(match[1]);
    const cols = (payload.table?.cols || []).map((col) => col.label || '');
    const rows = payload.table?.rows || [];

    return rows.map((row) => {
      const record = {};
      cols.forEach((label, i) => {
        if (!label) return;
        const cell = row.c?.[i];
        record[label] = this.cellValue(cell);
      });
      return record;
    });
  },

  applySpotlightRecords(records, songs) {
    if (!Array.isArray(records)) return;

    const map = new Map();
    records.forEach((record) => {
      const artist = record['Artist Name'];
      const title = record['Song Title'];
      if (!artist && !title) return;
      const priority = parseInt(record.Priority || record['Spotlight Priority'] || '', 10) || 0;
      if (priority <= 0) return;
      const key = `${artist}|${title}`.toLowerCase();
      map.set(key, {
        spotlightPriority: priority,
        spotlightUntil: record.Until || record['Spotlight Until'] || '',
        spotlightBadge: record.Badge || record['Spotlight Badge'] || 'Featured',
      });
    });

    if (typeof Spotlight !== 'undefined') {
      Spotlight.manualPickCount = map.size;
    }

    songs.forEach((song) => {
      const key = `${song.artistName}|${song.songTitle}`.toLowerCase();
      const spot = map.get(key);
      if (!spot) return;
      song.spotlightPriority = spot.spotlightPriority;
      song.spotlightUntil = spot.spotlightUntil;
      song.spotlightBadge = spot.spotlightBadge;
    });

    if (map.size === 0 && typeof Spotlight !== 'undefined') {
      Spotlight.applyAutoFill(songs);
    }
  },

  async fetchCatalogPayload() {
    const sheetId = CONFIG.googleSheetId;
    const sheetNames = CONFIG.catalogSheetNames || ['Form Responses 1', 'Sheet1'];
    const spotlightSheetName = CONFIG.spotlight?.spotlightSheetName || 'Spotlights';
    if (!sheetId) throw new Error('googleSheetId is not configured');

    const sheetFetches = sheetNames.map((sheetName) =>
      this.fetchSheetRecords(sheetId, sheetName)
        .then((records) => ({ sheetName, records }))
        .catch((err) => {
          console.warn(`SheetCatalog: skipping "${sheetName}"`, err);
          return { sheetName, records: null };
        })
    );

    const spotlightFetch = this.fetchSheetRecords(sheetId, spotlightSheetName).catch((err) => {
      console.warn('SheetCatalog: no spotlight overrides loaded', err);
      return null;
    });

    const [sheetResults, spotlightRecords] = await Promise.all([
      Promise.all(sheetFetches),
      spotlightFetch,
    ]);

    const catalog = new Map();
    let index = 0;

    sheetResults.forEach(({ records }) => {
      if (!records) return;
      records.forEach((record) => {
        const artist = record['Artist Name'];
        const title = record['Song Title'];
        if (!artist && !title) return;

        index += 1;
        const song = this.buildSongFromRecord(record, index);
        if (!song) return;

        const key = `${artist}|${title}`.toLowerCase();
        catalog.set(key, song);
      });
    });

    const songs = Array.from(catalog.values()).sort((a, b) => {
      const artistCmp = String(a.artistName).localeCompare(String(b.artistName));
      if (artistCmp !== 0) return artistCmp;
      return String(a.songTitle).localeCompare(String(b.songTitle));
    });

    songs.forEach((song, i) => {
      song.id = `song-${i + 1}`;
    });

    this.applySpotlightRecords(spotlightRecords, songs);

    return {
      success: true,
      source: 'google-sheet-live',
      sheetId,
      sheetNames,
      syncedAt: new Date().toISOString(),
      songCount: songs.length,
      songs,
    };
  },

  async mergeSpotlights(sheetId, songs) {
    const sheetName = CONFIG.spotlight?.spotlightSheetName || 'Spotlights';
    try {
      const records = await this.fetchSheetRecords(sheetId, sheetName);
      this.applySpotlightRecords(records, songs);
    } catch (err) {
      console.warn('SheetCatalog: no spotlight overrides loaded', err);
    }
  },
};