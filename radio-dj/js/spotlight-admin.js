const SpotlightAdmin = {
  picks: [],
  loaded: false,
  loading: null,

  canManage() {
    return typeof DjAuth !== 'undefined'
      && DjAuth.isAuthenticated()
      && typeof Spotlight !== 'undefined'
      && Spotlight.isAdminDj(DjAuth.getDj());
  },

  pickKey(artistName, songTitle) {
    return `${String(artistName || '').trim()}|${String(songTitle || '').trim()}`.toLowerCase();
  },

  songKey(song) {
    return this.pickKey(song?.artistName, song?.songTitle);
  },

  invalidate() {
    this.loaded = false;
    this.picks = [];
    this.loading = null;
  },

  async ensureLoaded() {
    if (!this.canManage()) return [];
    if (this.loaded) return this.picks;
    if (this.loading) return this.loading;

    this.loading = DjAuth.authRequest('spotlight_admin_list')
      .then((data) => {
        this.picks = data.spotlights || [];
        this.loaded = true;
        this.loading = null;
        return this.picks;
      })
      .catch((err) => {
        this.loading = null;
        throw err;
      });

    return this.loading;
  },

  isSongInSpotlight(song) {
    const key = this.songKey(song);
    if (this.loaded) {
      return this.picks.some((pick) => this.pickKey(pick.artistName, pick.songTitle) === key);
    }
    return typeof Spotlight !== 'undefined' && Spotlight.isManualPick(song);
  },

  async toggleSong(song) {
    if (!this.canManage()) throw new Error('Not authorized to manage spotlights.');
    await this.ensureLoaded();

    const key = this.songKey(song);
    const exists = this.picks.some((pick) => this.pickKey(pick.artistName, pick.songTitle) === key);
    let next;

    if (exists) {
      next = this.picks.filter((pick) => this.pickKey(pick.artistName, pick.songTitle) !== key);
    } else {
      const maxSlots = CONFIG.spotlight?.maxSlots || 20;
      if (this.picks.length >= maxSlots) {
        throw new Error(`Maximum ${maxSlots} spotlight songs. Remove one from Spotlight admin first.`);
      }
      next = [
        ...this.picks,
        {
          artistName: song.artistName,
          songTitle: song.songTitle,
          priority: 85,
          until: Spotlight.defaultUntilDate(),
          badge: 'Featured',
        },
      ];
    }

    const data = await DjAuth.authRequest('spotlight_admin_save', { spotlights: next });
    this.picks = data.spotlights || [];
    this.loaded = true;
    if (typeof RadioDB !== 'undefined') RadioDB.invalidateCatalogCache();
    return { added: !exists, spotlights: this.picks };
  },
};