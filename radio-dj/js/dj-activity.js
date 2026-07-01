const DjActivity = {
  eventLabels: {
    download_mp3: 'MP3 download',
    download_wav: 'WAV download',
    download_zip: 'Downloaded',
    downloaded: 'Downloaded',
    download_onesheet: 'One-sheet PDF',
    wav_request: 'WAV request sent',
  },

  formatLabel(eventType, format) {
    if (this.eventLabels[eventType]) return this.eventLabels[eventType];
    if (format) return String(format).toUpperCase();
    return 'Download';
  },

  isDownloadEvent(eventType) {
    const type = String(eventType || '').trim().toLowerCase();
    return type === 'downloaded'
      || type === 'download_mp3'
      || type === 'download_wav'
      || type === 'download_zip';
  },

  async _getUserId() {
    const session = await HideawayAuth.getSession();
    return session?.user?.id || null;
  },

  async log(song, eventType, format = '') {
    if (!DjAuth.isAuthenticated() || !song) return;

    const userId = await this._getUserId();
    if (!userId) return;

    try {
      const supabase = await HideawayAuth.init();
      await supabase.from('dj_activity').insert({
        dj_user_id: userId,
        event_type: eventType,
        song_id: song.id || '',
        song_title: song.songTitle || '',
        artist_name: song.artistName || '',
        music_style: song.musicStyle || '',
        format,
      });
    } catch (err) {
      console.warn('Activity log failed:', err.message);
    }
  },

  async logMany(songs, eventType, format = '') {
    if (!Array.isArray(songs) || !songs.length) return;
    await Promise.all(songs.map((song) => this.log(song, eventType, format)));
  },

  computeStats(activity) {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    const uniqueSongs = {};
    let weekCount = 0;
    let monthCount = 0;

    activity.forEach((item) => {
      if (item.songId) uniqueSongs[item.songId] = true;
      const ts = Date.parse(item.timestamp);
      if (!Number.isNaN(ts)) {
        if (ts >= weekAgo) weekCount += 1;
        if (ts >= monthAgo) monthCount += 1;
      }
    });

    return {
      totalDownloads: activity.length,
      thisWeek: weekCount,
      thisMonth: monthCount,
      uniqueSongs: Object.keys(uniqueSongs).length,
    };
  },

  async fetchDashboard() {
    const userId = await this._getUserId();
    if (!userId) throw new Error('Not signed in.');

    const supabase = await HideawayAuth.init();
    const { data, error } = await supabase
      .from('dj_activity')
      .select('id, event_type, song_id, song_title, artist_name, music_style, format, created_at')
      .eq('dj_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) throw error;

    const activity = (data || []).map((row) => ({
      id: row.id,
      timestamp: row.created_at,
      eventType: row.event_type,
      songId: row.song_id,
      songTitle: row.song_title,
      artistName: row.artist_name,
      musicStyle: row.music_style,
      format: row.format,
    }));

    return {
      success: true,
      dj: DjAuth.getDj(),
      stats: this.computeStats(activity),
      activity,
    };
  },

  async fetchDemoDashboard() {
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!scriptUrl.includes('script.google.com')) {
      throw new Error('Demo dashboard needs Apps Script setup.');
    }

    const url = `${scriptUrl.replace(/\/$/, '')}?action=demo_dashboard`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Demo dashboard unavailable');
    return data;
  },

  async updateProfile(fields) {
    const dj = await DjAuth.updateDjProfileRemote(fields);
    DjAuth.updateDjProfile(dj);
    return dj;
  },

  async updateShareEmail(shareEmail) {
    return this.updateProfile({ shareEmail: !!shareEmail });
  },

  formatTimestamp(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  },
};