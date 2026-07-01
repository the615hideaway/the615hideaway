const RadioDB = {
  catalogMeta: null,
  catalogPayload: null,
  catalogFetchPromise: null,
  catalogSessionKey: 'radio_now_catalog_cache',
  catalogSessionTtlMs: 2 * 60 * 1000,

  isScriptConfigured() {
    return !!(CONFIG.googleScriptUrl && CONFIG.googleScriptUrl.includes('script.google.com'));
  },

  zipSetupHint() {
    if (this.isScriptConfigured()) return '';
    return ' ZIP downloads need a one-time Apps Script setup: open your Radio Now Google Sheet → Extensions → Apps Script → paste google-apps-script/Code.gs → Deploy as Web app (Anyone) → paste the /exec URL into js/config.js as googleScriptUrl. See AUDIO-FIX-STEPS.txt in the repo.';
  },

  normalizeSong(raw, index) {
    const mp3Source = String(raw.mp3 || raw.MP3 || raw.MP3s || '').trim();
    const mp3 = mp3Source
      ? (String(raw.mp3 || '').includes('uc?export=download') ? raw.mp3 : Utils.toDriveDownload(mp3Source))
      : '';

    return {
      id: raw.id || `song-${index + 1}`,
      artistName: raw.artistName || '',
      songTitle: raw.songTitle || '',
      year: String(raw.year || '').replace(/\.0$/, ''),
      mp3,
      previewLink: mp3Source,
      previewStreamUrl: raw.previewStreamUrl || Utils.toPreviewStreamUrl(mp3Source),
      previewDriveId: raw.previewDriveId || Utils.extractDriveId(mp3Source) || '',
      wav: raw.wav || Utils.toDriveDownload(raw.WAV || ''),
      cover: raw.cover || raw.Cover || raw['Cover Art'] || '',
      coverDriveId: raw.coverDriveId || Utils.getCoverDriveId({ cover: raw.cover || raw.Cover, coverDriveId: raw.coverDriveId }),
      coverLocal: raw.coverLocal || '',
      coverThumbnailUrl: raw.coverThumbnailUrl || Utils.resolveCoverUrl({ cover: raw.cover || raw.Cover }),
      songTime: raw.songTime || '',
      description: raw.description || Utils.stripHtml(raw.Description || ''),
      musicStyle: raw.musicStyle || '',
      bandMemberLines: Array.isArray(raw.bandMemberLines) ? raw.bandMemberLines : [],
      bandMembers: raw.bandMembers || (Array.isArray(raw.bandMemberLines) ? raw.bandMemberLines.join('; ') : ''),
      songwriter: raw.songwriter || '',
      featuredArtist: raw.featuredArtist || '',
      website: raw.website || '',
      recordLabel: raw.recordLabel || '',
      releaseType: raw.releaseType || '',
      albumName: raw.albumName || '',
      contactEmail: raw.contactEmail || '',
      releaseDate: String(raw.releaseDate || '').trim(),
      spotlightPriority: parseInt(raw.spotlightPriority, 10) || 0,
      spotlightUntil: String(raw.spotlightUntil || '').trim(),
      spotlightBadge: String(raw.spotlightBadge || '').trim(),
    };
  },

  readSessionCatalog() {
    try {
      const raw = sessionStorage.getItem(this.catalogSessionKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.data?.songs?.length || !parsed.fetchedAt) return null;
      if (Date.now() - parsed.fetchedAt > this.catalogSessionTtlMs) return null;
      return parsed.data;
    } catch (err) {
      return null;
    }
  },

  writeSessionCatalog(data) {
    if (!data?.songs?.length) return;
    try {
      sessionStorage.setItem(this.catalogSessionKey, JSON.stringify({
        fetchedAt: Date.now(),
        data,
      }));
    } catch (err) {
      // sessionStorage full or unavailable
    }
  },

  invalidateCatalogCache() {
    this.catalogPayload = null;
    this.catalogMeta = null;
    this.catalogFetchPromise = null;
    try {
      sessionStorage.removeItem(this.catalogSessionKey);
    } catch (err) {
      // ignore
    }
  },

  async loadCatalogPayload() {
    if (CONFIG.useSupabaseCatalog && typeof SupabaseCatalog !== 'undefined') {
      try {
        const live = await SupabaseCatalog.fetchCatalogPayload();
        if ((live.songs || []).length) return live;
      } catch (err) {
        console.warn('Supabase catalog failed, using songs.json fallback:', err);
      }
    }

    if (CONFIG.catalogLiveFromSheet && typeof SheetCatalog !== 'undefined') {
      try {
        const live = await SheetCatalog.fetchCatalogPayload();
        if ((live.songs || []).length) return live;
      } catch (err) {
        console.warn('Live sheet catalog failed, using songs.json fallback:', err);
      }
    }

    const response = await fetch(CONFIG.songsDataUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load catalog from Google Sheet or ${CONFIG.songsDataUrl}.`);
    }
    return response.json();
  },

  async fetchCatalogData() {
    if (this.catalogPayload) return this.catalogPayload;

    const sessionData = this.readSessionCatalog();
    if (sessionData) {
      this.catalogPayload = sessionData;
      return sessionData;
    }

    if (this.catalogFetchPromise) return this.catalogFetchPromise;

    this.catalogFetchPromise = this.loadCatalogPayload()
      .then((data) => {
        this.catalogPayload = data;
        this.writeSessionCatalog(data);
        return data;
      })
      .finally(() => {
        this.catalogFetchPromise = null;
      });

    return this.catalogFetchPromise;
  },

  songsFromPayload(data) {
    this.catalogMeta = {
      syncedAt: data.syncedAt || null,
      songCount: data.songCount || (data.songs || []).length,
      source: data.source || 'json',
    };

    const songs = (data.songs || [])
      .map((song, i) => ({ ...this.normalizeSong(song, i), catalogIndex: i }))
      .filter((song) => song.artistName || song.songTitle);

    if (!songs.length) throw new Error('Catalog contains no songs.');

    if (typeof Spotlight !== 'undefined') {
      Spotlight.syncManualPickCount(songs);
    }

    return songs;
  },

  async getCatalogMeta() {
    if (this.catalogMeta) return this.catalogMeta;
    const data = await this.fetchCatalogData();
    this.songsFromPayload(data);
    return this.catalogMeta;
  },

  async getAllSongs() {
    const data = await this.fetchCatalogData();
    return this.songsFromPayload(data);
  },

  async downloadZip(songs, format = 'mp3', onProgress) {
    if (!songs.length) throw new Error('Download queue is empty.');
    if (format === 'wav') {
      throw new Error('WAV is not available for download here. Email the artist from song details to request broadcast WAV.');
    }

    return this.downloadZipClient(songs, format, onProgress);
  },

  async downloadOneSheetsZip(songs, onProgress) {
    if (!songs.length) throw new Error('No songs selected.');
    if (!window.JSZip) throw new Error('JSZip is not loaded');

    const zip = new JSZip();
    const usedNames = new Set();
    let added = 0;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      onProgress?.({
        current: i + 1,
        total: songs.length,
        added,
        status: 'onesheet',
        songTitle: song.songTitle,
      });

      const pdfBlob = await OneSheet.generatePdfBlob(song);
      let filename = OneSheet.pdfFilename(song);
      let suffix = 2;
      while (usedNames.has(filename.toLowerCase())) {
        const stem = filename.replace(/\.pdf$/i, '');
        filename = `${stem} (${suffix}).pdf`;
        suffix += 1;
      }
      usedNames.add(filename.toLowerCase());
      zip.file(filename, pdfBlob);
      added += 1;
    }

    onProgress?.({ current: songs.length, total: songs.length, added, status: 'zipping' });
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const downloadName = songs.length === 1
      ? OneSheet.pdfFilename(songs[0])
      : `${Utils.safeFilename(songs[0]?.artistName || 'Radio-Now', 'OneSheets', 'zip')}`;
    this.triggerBlobDownload(content, downloadName);

    onProgress?.({ current: songs.length, total: songs.length, added, status: 'done' });
  },

  async downloadSingleTrack(song, format = 'mp3') {
    const ext = format === 'wav' ? 'wav' : 'mp3';
    const candidates = Utils.getSongDownloadCandidates(song, format);
    if (!candidates.length) throw new Error(`No ${format.toUpperCase()} download link for this track.`);

    const blob = await this.fetchSongBlob(song, format);
    if (!(await Utils.isAudioBlob(blob))) {
      throw new Error('Downloaded file is not a valid audio file.');
    }

    this.triggerBlobDownload(blob, Utils.safeFilename(song.artistName, song.songTitle, ext));
  },

  songPayloadForZip(song, format) {
    return {
      id: song.id,
      artistName: song.artistName,
      songTitle: song.songTitle,
      year: song.year,
      songTime: song.songTime,
      musicStyle: song.musicStyle,
      description: song.description,
      bandMembers: song.bandMembers,
      bandMemberLines: song.bandMemberLines || [],
      songwriter: song.songwriter,
      featuredArtist: song.featuredArtist,
      website: song.website,
      recordLabel: song.recordLabel,
      contactEmail: song.contactEmail,
      cover: song.cover,
      mp3: song.mp3,
      wav: song.wav,
      previewDriveId: song.previewDriveId || Utils.extractDriveId(song.previewLink) || '',
      mp3DriveId: Utils.extractDriveId(song.mp3) || '',
      wavDriveId: Utils.extractDriveId(song.wav) || '',
      coverDriveId: Utils.extractDriveId(song.cover) || '',
      formatDriveId: Utils.getSongDriveId(song, format),
    };
  },

  async fetchCoverViaScript(driveId) {
    const url = Utils.scriptCoverUrl(driveId);
    if (!url) return null;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.dataBase64) {
      throw new Error(data.error || 'Cover proxy failed');
    }

    const blob = this.base64ToBlob(data.dataBase64, data.mimeType || 'image/jpeg');
    if (!(await Utils.isImageBlob(blob))) throw new Error('not an image');
    return blob;
  },

  async fetchAudioViaScript(driveId) {
    const url = Utils.scriptStreamUrl(driveId);
    if (!url) throw new Error('Stream proxy not configured');

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.success || !data.dataBase64) {
      throw new Error(data.error || 'Audio stream failed');
    }

    const blob = this.base64ToBlob(data.dataBase64, data.mimeType || 'application/octet-stream');
    if (!blob.size) throw new Error('Empty file');
    return blob;
  },

  async fetchCoverBlob(song) {
    const driveId = Utils.getCoverDriveId(song);
    const errors = [];

    if (song.coverLocal) {
      try {
        const response = await fetch(song.coverLocal, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (await Utils.isImageBlob(blob)) return blob;
        throw new Error('not an image');
      } catch (err) {
        errors.push(`local: ${err.message}`);
      }
    }

    if (driveId && this.isScriptConfigured()) {
      try {
        const blob = await this.fetchCoverViaScript(driveId);
        if (blob) return blob;
      } catch (err) {
        errors.push(`script: ${err.message}`);
      }
    }

    const candidates = Utils.getCoverDownloadCandidates(song);
    for (const url of candidates) {
      if (url === song.coverLocal) continue;
      try {
        const response = await fetch(url, { mode: 'cors', redirect: 'follow', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (!blob.size || blob.type === 'text/html') throw new Error('not an image');
        if (await Utils.isImageBlob(blob)) return blob;
        throw new Error('not an image');
      } catch (err) {
        errors.push(err.message);
      }
    }

    console.warn('Cover fetch failed:', song.songTitle, errors[errors.length - 1] || 'no sources');
    return null;
  },

  coverExtension(blob) {
    const type = blob?.type || '';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    return 'jpg';
  },

  async addSongPackageToZip(target, song, format, audioBlob, options = {}) {
    const ext = format === 'wav' ? 'wav' : 'mp3';
    const maxLength = options.shortNames ? 48 : 0;
    const baseName = Utils.songArtistName(song.songTitle, song.artistName, maxLength);
    const pdfName = options.shortNames
      ? 'OneSheet.pdf'
      : `${Utils.songArtistName(song.songTitle, song.artistName)} OneSheet.pdf`;

    target.file(`${baseName}.${ext}`, audioBlob);

    const coverBlob = await this.fetchCoverBlob(song);
    if (coverBlob) {
      target.file(`${baseName}.${this.coverExtension(coverBlob)}`, coverBlob);
    }

    const pdfBlob = await OneSheet.generatePdfBlob(song);
    target.file(pdfName, pdfBlob);
  },

  async upgradeZipOneSheetsToPdf(zipBlob, songs, onProgress) {
    if (!window.JSZip) return zipBlob;

    const zip = await JSZip.loadAsync(zipBlob);

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const folderName = Utils.zipFolderName(song.artistName, song.songTitle);
      const folder = zip.folder(folderName);
      if (!folder) continue;

      onProgress?.({
        current: i + 1,
        total: songs.length,
        added: songs.length,
        status: 'onesheet',
        songTitle: song.songTitle,
      });

      folder.remove('one-sheet.html');
      const pdfBlob = await OneSheet.generatePdfBlob(song);
      folder.file(OneSheet.pdfFilename(song), pdfBlob);
    }

    onProgress?.({ current: songs.length, total: songs.length, added: songs.length, status: 'zipping' });
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  },

  base64ToBlob(dataBase64, mimeType) {
    const bytes = atob(dataBase64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    return new Blob([buffer], { type: mimeType || 'application/octet-stream' });
  },

  async downloadZipViaScript(songs, format, onProgress) {
    onProgress?.({ current: 0, total: songs.length, added: 0, status: 'requesting' });

    const response = await fetch(CONFIG.googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'zip',
        format,
        songs: songs.map((s) => this.songPayloadForZip(s, format)),
      }),
    });

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(`Server ZIP failed (HTTP ${response.status}). Large files are built in your browser instead.`);
    }

    if (!data.success) throw new Error(data.error || 'Zip creation failed');

    let blob = this.base64ToBlob(data.zipBase64, 'application/zip');
    blob = await this.upgradeZipOneSheetsToPdf(blob, songs, onProgress);
    this.triggerBlobDownload(blob, data.filename || 'radio-now-selection.zip');

    onProgress?.({ current: songs.length, total: songs.length, added: data.added || songs.length, status: 'done' });

    if (data.skipped?.length) {
      throw new Error(`ZIP created with ${data.added || '?'} of ${songs.length} songs. Skipped: ${data.skipped.join('; ')}`);
    }
  },

  async fetchAudioBlob(url) {
    if (Utils.isScriptStreamUrl(url)) {
      const driveId = Utils.extractDriveId(url) || new URL(url).searchParams.get('id');
      if (driveId && this.isScriptConfigured()) {
        return this.fetchAudioViaScript(driveId);
      }
    }

    const response = await fetch(url, { mode: 'cors', redirect: 'follow', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    let blob = await response.blob();
    if (blob.type === 'text/html' || (blob.size < 8000 && blob.type !== 'audio/mpeg')) {
      const html = await blob.text();
      const confirmMatch = html.match(/confirm=([0-9A-Za-z_]+)/);
      const idMatch = url.match(/[?&]id=([^&]+)/);
      if (confirmMatch && idMatch) {
        const confirmUrl = `https://drive.usercontent.google.com/download?id=${idMatch[1]}&export=download&confirm=${confirmMatch[1]}`;
        const retry = await fetch(confirmUrl, { mode: 'cors', redirect: 'follow', credentials: 'omit' });
        if (!retry.ok) throw new Error(`Confirm fetch HTTP ${retry.status}`);
        blob = await retry.blob();
      }
    }

    if (!blob.size) throw new Error('Empty file');
    if (blob.type === 'text/html') throw new Error('Drive returned HTML instead of audio');
    return blob;
  },

  async fetchSongBlob(song, format) {
    const driveId = Utils.getSongDriveId(song, format);
    const errors = [];

    if (driveId && this.isScriptConfigured()) {
      try {
        const blob = await this.fetchAudioViaScript(driveId);
        if (await Utils.isAudioBlob(blob)) return blob;
        errors.push(`script: not audio (${blob.type || 'unknown'})`);
      } catch (err) {
        errors.push(`script: ${err.message}`);
      }
    }

    const candidates = Utils.getSongDownloadCandidates(song, format);
    if (!candidates.length && !errors.length) throw new Error(`No ${format.toUpperCase()} link`);

    for (const url of candidates) {
      if (Utils.isScriptStreamUrl(url)) continue;
      try {
        const blob = await this.fetchAudioBlob(url);
        if (await Utils.isAudioBlob(blob)) return blob;
        errors.push(`${url}: not audio (${blob.type || 'unknown'})`);
      } catch (err) {
        errors.push(`${url}: ${err.message}`);
      }
    }

    throw new Error(errors[errors.length - 1] || 'All download sources failed');
  },

  triggerBlobDownload(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  },

  triggerFileDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  async downloadFilesIndividually(songs, format) {
    const ext = format === 'wav' ? 'wav' : 'mp3';
    let started = 0;

    for (const song of songs) {
      const candidates = Utils.getSongDownloadCandidates(song, format);
      const url = candidates[0];
      if (!url) continue;
      const filename = Utils.safeFilename(song.artistName, song.songTitle, ext);
      this.triggerFileDownload(url, filename);
      started++;
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    if (!started) {
      throw new Error(`No ${format.toUpperCase()} download links found for queued songs.`);
    }
  },

  async downloadZipClient(songs, format, onProgress) {
    if (!window.JSZip) throw new Error('JSZip is not loaded');

    const zip = new JSZip();
    const usedNames = new Set();
    const errors = [];
    const useFolders = songs.length > 1;
    let added = 0;

    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      onProgress?.({ current: i + 1, total: songs.length, added, status: 'fetching', songTitle: song.songTitle });

      try {
        const audioBlob = await this.fetchSongBlob(song, format);
        let target = zip;
        const packageOptions = {};

        if (useFolders) {
          let folderName = Utils.zipFolderName(song.artistName, song.songTitle, { short: true });
          let suffix = 2;
          while (usedNames.has(folderName.toLowerCase())) {
            const stem = Utils.zipFolderName(song.artistName, song.songTitle, { short: true });
            folderName = `${stem} (${suffix})`;
            suffix += 1;
          }
          usedNames.add(folderName.toLowerCase());
          target = zip.folder(folderName);
          packageOptions.shortNames = true;
        }

        onProgress?.({
          current: i + 1,
          total: songs.length,
          added,
          status: 'onesheet',
          songTitle: song.songTitle,
        });
        await this.addSongPackageToZip(target, song, format, audioBlob, packageOptions);
        added++;
      } catch (err) {
        errors.push(`${song.songTitle}: ${err.message}`);
      }
    }

    if (!added) {
      const detail = errors.length ? errors.join('; ') : 'no download sources worked';
      throw new Error(`Could not build a ZIP (${detail}).${this.zipSetupHint()}`);
    }

    onProgress?.({ current: songs.length, total: songs.length, added, status: 'zipping' });
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    this.triggerBlobDownload(content, Utils.zipArchiveFilename(songs));

    onProgress?.({ current: songs.length, total: songs.length, added, status: 'done' });

    if (errors.length) {
      throw new Error(`ZIP created with ${added} of ${songs.length} songs. Could not include: ${errors.join('; ')}.${this.zipSetupHint()}`);
    }
  },
};