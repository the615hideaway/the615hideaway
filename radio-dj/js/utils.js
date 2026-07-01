const Utils = {
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
  },

  extractDriveId(url) {
    if (!url) return null;
    const value = String(url);
    const fileMatch = value.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];
    const openMatch = value.match(/[?&]id=([^&]+)/);
    return openMatch ? openMatch[1] : null;
  },

  toDriveDownload(url) {
    const id = this.extractDriveId(url);
    if (!id) return url || '';
    return `https://drive.google.com/uc?export=download&id=${id}`;
  },

  toPreviewStreamUrl(previewLink) {
    const preview = String(previewLink || '').trim();
    if (!preview || preview.startsWith('wix:')) return '';

    const driveId = this.extractDriveId(preview);
    if (driveId) {
      return `https://drive.usercontent.google.com/download?id=${driveId}&export=download`;
    }

    if (/^https?:\/\//i.test(preview)) return preview;
    return '';
  },

  toDriveThumbnail(url) {
    const id = this.extractDriveId(url);
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : url || '';
  },

  resolvePreviewUrl(song) {
    if (song.previewStreamUrl) return song.previewStreamUrl;
    const mp3Source = song.mp3 || song.previewLink || '';
    return this.toPreviewStreamUrl(mp3Source);
  },

  resolveCoverUrl(song) {
    if (song.coverLocal) return song.coverLocal;
    if (song.coverThumbnailUrl) return song.coverThumbnailUrl;
    const cover = song.cover || '';
    if (this.extractDriveId(cover)) return this.toDriveThumbnail(cover);
    if (/^https?:\/\//i.test(cover)) return cover;
    return '';
  },

  sanitizeNamePart(value) {
    return String(value || '')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  songArtistName(title, artist, maxLength = 0) {
    let name = `${this.sanitizeNamePart(title) || 'Track'} - ${this.sanitizeNamePart(artist) || 'Unknown'}`;
    if (maxLength > 0 && name.length > maxLength) {
      name = name.slice(0, maxLength).replace(/[\s-]+$/, '').trim();
      if (!name) name = 'Track';
    }
    return name || 'Track';
  },

  safeFilename(artist, title, ext) {
    return `${this.songArtistName(title, artist)}.${ext}`;
  },

  zipFolderName(artist, title, options = {}) {
    const maxLength = options.short ? 48 : 0;
    return this.songArtistName(title, artist, maxLength);
  },

  zipArchiveFilename(songs) {
    if (songs.length === 1) {
      const song = songs[0];
      return `${this.songArtistName(song.songTitle, song.artistName)}.zip`;
    }
    return `Radio Now - ${songs.length} Songs.zip`;
  },

  scriptStreamUrl(driveId) {
    const id = String(driveId || '').trim();
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!id || !scriptUrl.includes('script.google.com')) return '';
    return `${scriptUrl.replace(/\/$/, '')}?action=stream&id=${encodeURIComponent(id)}`;
  },

  scriptMediaUrl(driveId) {
    const id = String(driveId || '').trim();
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!id || !scriptUrl.includes('script.google.com')) return '';
    return `${scriptUrl.replace(/\/$/, '')}?action=media&id=${encodeURIComponent(id)}`;
  },

  isScriptStreamUrl(url) {
    const value = String(url || '');
    return value.includes('script.google.com') && value.includes('action=stream');
  },

  isScriptMediaUrl(url) {
    const value = String(url || '');
    return value.includes('script.google.com') && value.includes('action=media');
  },

  driveApiMediaUrl(driveId) {
    const id = String(driveId || '').trim();
    const apiKey = String(CONFIG.googleApiKey || '').trim();
    if (!id || !apiKey) return '';
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(apiKey)}`;
  },

  scriptCoverUrl(driveId) {
    const id = String(driveId || '').trim();
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!id || !scriptUrl.includes('script.google.com')) return '';
    return `${scriptUrl.replace(/\/$/, '')}?action=cover&id=${encodeURIComponent(id)}`;
  },

  getCoverDriveId(song) {
    return song.coverDriveId || this.extractDriveId(song.cover || '') || '';
  },

  getCoverDownloadCandidates(song) {
    const urls = [];
    const driveId = this.getCoverDriveId(song);

    if (song.coverLocal) urls.push(song.coverLocal);

    if (driveId) {
      const api = this.driveApiMediaUrl(driveId);
      if (api) urls.push(api);
      urls.push(`https://drive.google.com/thumbnail?id=${driveId}&sz=w800`);
      urls.push(...this.getDriveDownloadUrls(driveId));
    }

    [song.coverThumbnailUrl, this.resolveCoverUrl(song), song.cover].forEach((url) => {
      if (url) urls.push(url);
    });

    return [...new Set(urls.filter(Boolean))];
  },

  coverDownloadUrl(song) {
    return this.getCoverDownloadCandidates(song)[0] || '';
  },

  uniqueZipFilename(usedNames, artist, title, ext) {
    let name = this.safeFilename(artist, title, ext);
    let counter = 2;
    while (usedNames.has(name.toLowerCase())) {
      const stem = this.safeFilename(artist, title, ext).replace(new RegExp(`\\.${ext}$`), '');
      name = `${stem} (${counter}).${ext}`;
      counter += 1;
    }
    usedNames.add(name.toLowerCase());
    return name;
  },

  getDriveDownloadUrls(driveId) {
    if (!driveId) return [];
    return [
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download`,
      `https://drive.usercontent.google.com/u/0/uc?id=${driveId}&export=download`,
      `https://drive.google.com/uc?export=download&id=${driveId}`,
    ];
  },

  getSongDriveId(song, format) {
    const primary = format === 'wav' && song.wav ? song.wav : song.mp3;
    const fallback = format === 'wav' ? song.mp3 : song.wav;
    return (
      this.extractDriveId(primary)
      || this.extractDriveId(fallback)
      || song.previewDriveId
      || this.extractDriveId(song.mp3)
      || this.extractDriveId(song.previewLink)
      || ''
    );
  },

  getSongDownloadCandidates(song, format) {
    const urls = [];
    const driveId = this.getSongDriveId(song, format);

    if (driveId) {
      const stream = this.scriptStreamUrl(driveId);
      const api = this.driveApiMediaUrl(driveId);
      if (stream) urls.push(stream);
      if (api) urls.push(api);
      urls.push(...this.getDriveDownloadUrls(driveId));
    }

    const primary = format === 'wav' && song.wav ? song.wav : song.mp3;
    const fallback = format === 'wav' ? song.mp3 : (song.wav || '');

    [primary, fallback, song.previewStreamUrl].forEach((url) => {
      if (!url) return;
      urls.push(url);
      const id = this.extractDriveId(url);
      if (id) {
        const stream = this.scriptStreamUrl(id);
        const api = this.driveApiMediaUrl(id);
        if (stream) urls.push(stream);
        if (api) urls.push(api);
        urls.push(...this.getDriveDownloadUrls(id));
      }
    });

    return [...new Set(urls.filter(Boolean))];
  },

  async isImageBlob(blob) {
    if (!blob || !blob.size) return false;
    if (blob.type && blob.type.startsWith('image/')) return true;

    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const isJpeg = header[0] === 0xff && header[1] === 0xd8;
    const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
    const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    return isJpeg || isPng || isWebp;
  },

  async isAudioBlob(blob) {
    if (!blob || !blob.size) return false;
    if (blob.type && blob.type.startsWith('audio/')) return true;
    if (blob.type && blob.type.includes('octet-stream') && blob.size > 50000) return true;

    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const isId3 = header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33;
    const isMp3Frame = header[0] === 0xff && (header[1] & 0xe0) === 0xe0;
    const isRiff = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
    return isId3 || isMp3Frame || isRiff;
  },

  formatDuration(value) {
    return value || '—';
  },

  formatSyncDate(iso) {
    if (!iso) return 'unknown date';
    const date = new Date(iso);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  },

  debounce(fn, wait = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  songYear(song) {
    return parseInt(String(song.year || ''), 10) || 0;
  },

  parseReleaseDateMs(song) {
    const raw = String(song?.releaseDate || '').trim();
    if (raw) {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
    const year = this.songYear(song);
    return year ? Date.parse(`${year}-12-31`) : 0;
  },

  compareSongsByReleaseDate(a, b) {
    const dateDiff = this.parseReleaseDateMs(b) - this.parseReleaseDateMs(a);
    if (dateDiff !== 0) return dateDiff;
    return this.compareSongsNewestFirst(a, b);
  },

  compareSongsNewestFirst(a, b) {
    const yearDiff = this.songYear(b) - this.songYear(a);
    if (yearDiff !== 0) return yearDiff;
    const indexDiff = (b.catalogIndex ?? -1) - (a.catalogIndex ?? -1);
    if (indexDiff !== 0) return indexDiff;
    return String(a.songTitle || '').localeCompare(String(b.songTitle || ''));
  },

  normalizeReleaseType(song) {
    return String(song?.releaseType || '').trim().toLowerCase();
  },

  isSingleRelease(song) {
    const type = this.normalizeReleaseType(song);
    return type === 'single' || type === 'singles';
  },

  groupArtistCatalog(songs) {
    const albumCounts = new Map();
    songs.forEach((song) => {
      const album = String(song.albumName || '').trim();
      if (album) albumCounts.set(album, (albumCounts.get(album) || 0) + 1);
    });

    const albums = new Map();
    const singles = [];

    songs.forEach((song) => {
      const album = String(song.albumName || '').trim();
      const type = this.normalizeReleaseType(song);

      if (this.isSingleRelease(song)) {
        singles.push(song);
        return;
      }

      const isAlbum = album && (
        type === 'album_track'
        || type === 'album'
        || albumCounts.get(album) >= 2
      );

      if (isAlbum) {
        if (!albums.has(album)) albums.set(album, []);
        albums.get(album).push(song);
      } else {
        singles.push(song);
      }
    });

    const albumSections = Array.from(albums.entries())
      .map(([name, tracks]) => ({
        name,
        songs: [...tracks].sort((a, b) => this.compareSongsByReleaseDate(a, b)),
      }))
      .sort((a, b) => {
        const newestA = this.parseReleaseDateMs(a.songs[0]);
        const newestB = this.parseReleaseDateMs(b.songs[0]);
        return newestB - newestA;
      });

    return {
      albums: albumSections,
      singles: [...singles].sort((a, b) => this.compareSongsByReleaseDate(a, b)),
    };
  },

  groupSongsByArtist(songs) {
    const groups = new Map();

    songs.forEach((song, index) => {
      const name = String(song.artistName || 'Unknown Artist').trim() || 'Unknown Artist';
      if (!groups.has(name)) {
        groups.set(name, {
          name,
          songs: [],
          maxYear: 0,
          newestIndex: -1,
        });
      }

      const group = groups.get(name);
      const entry = { ...song, catalogIndex: index };
      group.songs.push(entry);

      const year = this.songYear(song);
      if (year > group.maxYear) group.maxYear = year;
      if (index > group.newestIndex) group.newestIndex = index;
    });

    const usedSlugs = new Set();

    return Array.from(groups.values())
      .map((group) => {
        const sortedSongs = [...group.songs].sort((a, b) => this.compareSongsByReleaseDate(a, b));
        let slug = this.artistSlug(group.name);
        const baseSlug = slug;
        let suffix = 2;
        while (usedSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }
        usedSlugs.add(slug);

        return {
          name: group.name,
          slug,
          songs: sortedSongs,
          maxYear: group.maxYear,
          newestIndex: group.newestIndex,
          songCount: sortedSongs.length,
          coverSong: sortedSongs[0],
          website: sortedSongs[0]?.website || '',
        };
      })
      .sort((a, b) => {
        if (b.maxYear !== a.maxYear) return b.maxYear - a.maxYear;
        if (b.newestIndex !== a.newestIndex) return b.newestIndex - a.newestIndex;
        return a.name.localeCompare(b.name);
      });
  },

  artistSlug(name) {
    const slug = String(name || 'artist')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'artist';
  },

  _artistSlugCache: null,
  _artistSlugCacheSongs: null,

  resolveArtistSlug(artistName, songs) {
    const name = String(artistName || '').trim();
    if (!name) return '';

    if (Array.isArray(songs) && songs.length) {
      if (this._artistSlugCacheSongs !== songs) {
        this._artistSlugCache = new Map(
          this.groupSongsByArtist(songs).map((entry) => [entry.name, entry.slug]),
        );
        this._artistSlugCacheSongs = songs;
      }
      return this._artistSlugCache.get(name) || this.artistSlug(name);
    }

    return this.artistSlug(name);
  },

  artistPageHref(artistName, songs) {
    const name = String(artistName || '').trim();
    if (!name) return '';
    const slug = this.resolveArtistSlug(name, songs);
    return `artist.html?slug=${encodeURIComponent(slug)}`;
  },

  normalizeContactEmail(raw) {
    const value = String(raw || '').trim();
    if (!value) return '';
    const mailtoMatch = value.match(/mailto:([^?&\s>]+)/i);
    if (mailtoMatch) return mailtoMatch[1].trim();
    const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch) return emailMatch[0].trim();
    return value.split(/[;,]/)[0].trim();
  },

  wavRequestMailtoHref(song, dj) {
    if (typeof WavRequest === 'undefined') return '';
    const email = this.normalizeContactEmail(song?.contactEmail);
    if (!email) return '';
    const draft = WavRequest.draft(song, dj);
    const params = new URLSearchParams();
    params.set('subject', draft.subject);
    params.set('body', draft.body);
    return `mailto:${email}?${params.toString()}`;
  },

  openWavRequestMailto(song, dj) {
    const email = this.normalizeContactEmail(song?.contactEmail);
    const href = this.wavRequestMailtoHref(song, dj);
    if (!email || !href) return { ok: false, email: '' };

    const link = document.createElement('a');
    link.href = href;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();

    return { ok: true, email };
  },

  async copyText(text) {
    const value = String(text || '').trim();
    if (!value) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (err) {
      /* fall through */
    }

    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  },
};