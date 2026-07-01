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

  async log(song, eventType, format = '') {
    if (!DjAuth.isAuthenticated() || !song) return;

    try {
      await DjAuth.authRequest('dj_log', {
        eventType,
        songId: song.id || '',
        songTitle: song.songTitle || '',
        artistName: song.artistName || '',
        musicStyle: song.musicStyle || '',
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

  async fetchDashboard() {
    return DjAuth.authRequest('dj_dashboard');
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