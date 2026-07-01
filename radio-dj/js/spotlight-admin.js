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

  rowToPick(row) {
    return {
      artistName: row.artist_name,
      songTitle: row.song_title,
      priority: row.priority,
      until: row.until_date,
      badge: row.badge,
    };
  },

  pickToRow(pick) {
    return {
      artist_name: pick.artistName,
      song_title: pick.songTitle,
      priority: parseInt(pick.priority, 10) || 85,
      until_date: pick.until || '',
      badge: pick.badge || 'Featured',
      updated_at: new Date().toISOString(),
    };
  },

  async ensureLoaded() {
    if (!this.canManage()) return [];
    if (this.loaded) return this.picks;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      const supabase = await HideawayAuth.init();
      const { data, error } = await supabase
        .from('catalog_spotlights')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      this.picks = (data || []).map((row) => this.rowToPick(row));
      this.loaded = true;
      this.loading = null;
      return this.picks;
    })().catch((err) => {
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

  async saveAll(picks) {
    if (!this.canManage()) throw new Error('Not authorized to manage spotlights.');

    const supabase = await HideawayAuth.init();
    const { error: deleteError } = await supabase
      .from('catalog_spotlights')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) throw deleteError;

    if (picks.length) {
      const { error: insertError } = await supabase
        .from('catalog_spotlights')
        .insert(picks.map((pick) => this.pickToRow(pick)));
      if (insertError) throw insertError;
    }

    this.picks = picks;
    this.loaded = true;
    if (typeof RadioDB !== 'undefined') RadioDB.invalidateCatalogCache();
    return {
      success: true,
      spotlights: this.picks,
      saved: this.picks.length,
      maxSlots: CONFIG.spotlight?.maxSlots || 20,
    };
  },

  async fetchAdminList() {
    await this.ensureLoaded();
    return {
      success: true,
      spotlights: this.picks,
      maxSlots: CONFIG.spotlight?.maxSlots || 20,
      defaultDays: CONFIG.spotlight?.defaultDays || 30,
    };
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

    const supabase = await HideawayAuth.init();
    const { error: deleteError } = await supabase.from('catalog_spotlights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) throw deleteError;

    if (next.length) {
      const { error: insertError } = await supabase
        .from('catalog_spotlights')
        .insert(next.map((pick) => this.pickToRow(pick)));
      if (insertError) throw insertError;
    }

    this.picks = next;
    this.loaded = true;
    if (typeof RadioDB !== 'undefined') RadioDB.invalidateCatalogCache();
    return { added: !exists, spotlights: this.picks };
  },
};