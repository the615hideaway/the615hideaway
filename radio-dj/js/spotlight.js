const Spotlight = {
  manualPickCount: 0,

  config() {
    return CONFIG.spotlight || {};
  },

  normalize(value) {
    return String(value || '').trim().toLowerCase();
  },

  startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  parseDateOnly(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const date = this.startOfDay(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = this.startOfDay(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  parseReleaseDate(song) {
    const raw = String(song?.releaseDate || '').trim();
    if (raw) {
      const parsed = this.parseDateOnly(raw);
      if (parsed) return parsed;
    }

    const year = parseInt(String(song?.year || ''), 10);
    if (year) return this.startOfDay(`${year}-12-31`);
    return null;
  },

  daysSince(date) {
    const today = this.startOfDay(new Date());
    return Math.floor((today.getTime() - date.getTime()) / 86400000);
  },

  isLabelNewRelease(song) {
    const cfg = this.config();
    if (this.normalize(song?.recordLabel) !== this.normalize(cfg.labelName)) return false;
    const release = this.parseReleaseDate(song);
    if (!release) return false;
    const days = this.daysSince(release);
    return days >= 0 && days <= (cfg.labelNewReleaseDays ?? 30);
  },

  isAdminDj(dj) {
    if (!dj) return false;
    const cfg = this.config();
    const name = String(dj.name || '').trim().toLowerCase();
    const email = String(dj.email || dj.contactEmail || '').trim().toLowerCase();
    const names = cfg.spotlightAdminDjs || [];
    const emails = cfg.spotlightAdminEmails || [];
    return names.some((entry) => String(entry || '').trim().toLowerCase() === name)
      || emails.some((entry) => String(entry || '').trim().toLowerCase() === email);
  },

  isManualPick(song) {
    const manualPriority = parseInt(song?.spotlightPriority, 10) || 0;
    const until = this.parseDateOnly(song?.spotlightUntil);
    const today = this.startOfDay(new Date());
    return manualPriority > 0 && (!until || until >= today);
  },

  defaultUntilDate() {
    const days = this.config().defaultDays ?? 30;
    const date = this.startOfDay(new Date());
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  },

  isNewCatalogSong(song) {
    if (this.isLabelNewRelease(song)) return true;
    const release = this.parseReleaseDate(song);
    if (!release) return false;
    const days = this.daysSince(release);
    const windowDays = this.config().labelNewReleaseDays ?? 30;
    return days >= 0 && days <= windowDays;
  },

  shufflePick(items, count) {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  },

  applyAutoFill(songs) {
    const cfg = this.config();
    const count = cfg.autoFillCount ?? 5;
    const score = cfg.autoFillScore ?? 80;
    const until = this.defaultUntilDate();
    const badge = 'New Release';

    songs.forEach((song) => {
      song.spotlightAutoFilled = false;
    });

    let pool = songs.filter((song) => this.isNewCatalogSong(song));
    if (pool.length < count) {
      const extras = [...songs].sort((a, b) => Utils.compareSongsNewestFirst(a, b));
      pool = [...new Set([...pool, ...extras])];
    }

    this.shufflePick(pool, count).forEach((song) => {
      song.spotlightAutoFilled = true;
      song.spotlightPriority = score;
      song.spotlightUntil = until;
      song.spotlightBadge = badge;
    });
  },

  syncManualPickCount(songs) {
    const today = this.startOfDay(new Date());
    this.manualPickCount = (songs || []).filter((song) => {
      const priority = parseInt(song?.spotlightPriority, 10) || 0;
      const until = this.parseDateOnly(song?.spotlightUntil);
      return priority > 0 && (!until || until >= today);
    }).length;
  },

  score(song) {
    const cfg = this.config();
    const today = this.startOfDay(new Date());
    let score = 0;

    const manualPriority = parseInt(song?.spotlightPriority, 10) || 0;
    const until = this.parseDateOnly(song?.spotlightUntil);
    const manualActive = manualPriority > 0 && (!until || until >= today);
    if (manualActive) score = manualPriority;

    if (this.manualPickCount === 0) {
      if (score > 0) return score;
      return song?.spotlightAutoFilled ? (cfg.autoFillScore ?? 80) : 0;
    }

    if (cfg.autoFeatureHouseArtist !== false
      && this.normalize(song?.artistName) === this.normalize(cfg.houseArtist)) {
      score = Math.max(score, cfg.houseArtistScore ?? 100);
    }

    if (cfg.autoFeatureNewReleases !== false && this.isLabelNewRelease(song)) {
      score = Math.max(score, cfg.labelNewReleaseScore ?? 75);
    }

    return score;
  },

  badge(song) {
    if (this.score(song) <= 0) return '';
    if (song?.spotlightBadge) return String(song.spotlightBadge).trim();
    const cfg = this.config();
    if (this.manualPickCount === 0 && song?.spotlightAutoFilled) return 'New Release';
    const manualPriority = parseInt(song?.spotlightPriority, 10) || 0;
    const until = this.parseDateOnly(song?.spotlightUntil);
    const today = this.startOfDay(new Date());
    const manualActive = manualPriority > 0 && (!until || until >= today);
    if (manualActive) return 'Featured';
    if (cfg.autoFeatureHouseArtist !== false
      && this.normalize(song?.artistName) === this.normalize(cfg.houseArtist)) return 'Featured';
    if (cfg.autoFeatureNewReleases !== false && this.isLabelNewRelease(song)) return 'New Release';
    return 'Spotlight';
  },

  sortSongs(songs) {
    return [...songs].sort((a, b) => {
      const scoreDiff = this.score(b) - this.score(a);
      if (scoreDiff !== 0) return scoreDiff;
      return Utils.compareSongsByReleaseDate(a, b);
    });
  },
};