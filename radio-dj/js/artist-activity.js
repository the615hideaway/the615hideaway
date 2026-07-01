const ArtistActivity = {
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

  formatDjLine(item) {
    const parts = [];
    const name = [item.djFirstName, item.djLastName].filter(Boolean).join(' ') || item.djName;
    if (name) parts.push(name);
    const station = item.djStationCall || item.djStation;
    if (station) parts.push(station);
    const program = item.djProgramName || item.djShowName;
    if (program) parts.push(program);
    return parts.join(' · ');
  },

  formatProgramSchedule(item) {
    const parts = [];
    if (item.djProgramDays) parts.push(item.djProgramDays);
    if (item.djProgramStart || item.djProgramEnd) {
      const start = this.formatTime(item.djProgramStart);
      const end = this.formatTime(item.djProgramEnd);
      const range = [start, end].filter(Boolean).join(' – ');
      if (range) parts.push(range);
    }
    if (item.djProgramTimezone) parts.push(item.djProgramTimezone);
    return parts.join(' · ');
  },

  formatTime(value) {
    if (!value) return '';
    const match = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (!match) return value;
    const hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  },

  djProfileFields(item) {
    const fields = [
      { label: 'DJ', value: [item.djFirstName, item.djLastName].filter(Boolean).join(' ') || item.djName },
      { label: 'Program', value: item.djProgramName || item.djShowName },
      { label: 'Format', value: item.djProgramFormat },
      { label: 'Call letters', value: item.djStationCall || item.djStation },
      { label: 'Frequency', value: item.djStationFrequency },
      { label: 'State', value: item.djState },
      { label: 'Schedule', value: this.formatProgramSchedule(item) },
      { label: 'Station site', value: item.djStationWebsite, isLink: true },
      { label: 'Program page', value: item.djProgramWebsite, isLink: true },
    ];
    return fields.filter((field) => field.value);
  },

  renderDjProfileHtml(item) {
    const fields = this.djProfileFields(item);
    if (!fields.length) return '';

    return `
      <dl class="artist-dj-profile">
        ${fields.map((field) => `
          <div class="artist-dj-profile-row">
            <dt>${Utils.escapeHtml(field.label)}</dt>
            <dd>${field.isLink
    ? `<a href="${Utils.escapeHtml(field.value)}" target="_blank" rel="noopener">${Utils.escapeHtml(field.value)}</a>`
    : Utils.escapeHtml(field.value)}</dd>
          </div>`).join('')}
      </dl>`;
  },

  isDownloadEvent(eventType) {
    const type = String(eventType || '').trim().toLowerCase();
    return type === 'downloaded'
      || type === 'download_mp3'
      || type === 'download_wav'
      || type === 'download_zip';
  },

  computeStats(activity) {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    let weekCount = 0;
    let monthCount = 0;

    (activity || []).forEach((item) => {
      if (!this.isDownloadEvent(item.eventType)) return;
      const ts = Date.parse(item.timestamp);
      if (!Number.isNaN(ts)) {
        if (ts >= weekAgo) weekCount += 1;
        if (ts >= monthAgo) monthCount += 1;
      }
    });

    const downloads = (activity || []).filter((item) => this.isDownloadEvent(item.eventType));

    return {
      totalDownloads: downloads.length,
      thisWeek: weekCount,
      thisMonth: monthCount,
      uniqueSongs: new Set(downloads.map((item) => item.songId || `${item.artistName}|${item.songTitle}`)).size,
    };
  },

  bumpChartCount(bucket, songId, meta) {
    if (!bucket[songId]) {
      bucket[songId] = {
        songId,
        songTitle: meta.songTitle || 'Untitled',
        artistName: meta.artistName || 'Unknown Artist',
        musicStyle: meta.musicStyle || '',
        count: 0,
      };
    }
    bucket[songId].count += 1;
  },

  sortChartEntries(bucket, limit) {
    return Object.keys(bucket)
      .map((key) => bucket[key])
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.songTitle).localeCompare(String(b.songTitle));
      })
      .slice(0, limit || 10);
  },

  computeCharts(activity, limit = 10) {
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    const weekCounts = {};
    const monthCounts = {};

    (activity || []).forEach((item) => {
      if (!this.isDownloadEvent(item.eventType)) return;
      const songId = item.songId || `${item.artistName}|${item.songTitle}`;
      const meta = {
        songTitle: item.songTitle,
        artistName: item.artistName,
        musicStyle: item.musicStyle,
      };
      const ts = Date.parse(item.timestamp);
      if (!Number.isNaN(ts) && ts >= weekAgo) this.bumpChartCount(weekCounts, songId, meta);
      if (!Number.isNaN(ts) && ts >= monthAgo) this.bumpChartCount(monthCounts, songId, meta);
    });

    return {
      week: this.sortChartEntries(weekCounts, limit),
      month: this.sortChartEntries(monthCounts, limit),
    };
  },

  mapDjProfile(profile) {
    if (!profile) return {};
    return {
      djFirstName: profile.first_name || '',
      djLastName: profile.last_name || '',
      djName: [profile.first_name, profile.last_name].filter(Boolean).join(' ') || '',
      djStationCall: profile.station_call_letters || '',
      djStation: profile.station_call_letters || '',
      djProgramName: profile.program_name || '',
      djShowName: profile.program_name || '',
      djProgramFormat: profile.program_format || '',
      djStationFrequency: profile.station_frequency || '',
      djState: profile.state || '',
      djProgramDays: profile.program_days || '',
      djProgramStart: profile.program_start_time || '',
      djProgramEnd: profile.program_end_time || '',
      djProgramTimezone: profile.program_timezone || '',
      djStationWebsite: profile.station_website || '',
      djProgramWebsite: profile.program_website || '',
    };
  },

  mapActivityRow(row, djMap) {
    const dj = djMap[row.dj_user_id] || {};
    return {
      id: row.id,
      timestamp: row.created_at,
      eventType: row.event_type,
      songId: row.song_id,
      songTitle: row.song_title,
      artistName: row.artist_name,
      musicStyle: row.music_style,
      format: row.format,
      ...this.mapDjProfile(dj),
    };
  },

  normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  },

  async _catalogKeysForLabel(labelName) {
    if (typeof RadioDB === 'undefined') return new Set();
    try {
      const songs = await RadioDB.getAllSongs();
      const target = this.normalizeName(labelName);
      return new Set(
        songs
          .filter((song) => this.normalizeName(song.recordLabel) === target)
          .map((song) => `${this.normalizeName(song.artistName)}|${this.normalizeName(song.songTitle)}`),
      );
    } catch (_) {
      return new Set();
    }
  },

  async _fetchActivityForAccount(account) {
    const supabase = await HideawayAuth.init();
    const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
    const accountName = account?.artistName || '';

    const { data: rows, error } = await supabase
      .from('dj_activity')
      .select('id, dj_user_id, event_type, song_id, song_title, artist_name, music_style, format, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    let filtered = rows || [];
    if (isLabel) {
      const keys = await this._catalogKeysForLabel(accountName);
      filtered = filtered.filter((row) =>
        keys.has(`${this.normalizeName(row.artist_name)}|${this.normalizeName(row.song_title)}`),
      );
    } else {
      const target = this.normalizeName(accountName);
      filtered = filtered.filter((row) => this.normalizeName(row.artist_name) === target);
    }

    const userIds = [...new Set(filtered.map((row) => row.dj_user_id).filter(Boolean))];
    const djMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('dj_profiles')
        .select('*')
        .in('id', userIds);
      (profiles || []).forEach((profile) => {
        djMap[profile.id] = profile;
      });
    }

    return filtered.map((row) => this.mapActivityRow(row, djMap));
  },

  async _fetchSubmissions(userId) {
    const supabase = await HideawayAuth.init();
    const { data, error } = await supabase
      .from('song_submissions')
      .select('id, artist_name, song_title, status, created_at, payload')
      .eq('artist_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return [];
    return data || [];
  },

  async _fetchLabelAccess(userId) {
    const supabase = await HideawayAuth.init();
    const { data, error } = await supabase
      .from('label_roster_access')
      .select('id, status, artist_profile_id, artist_profiles(artist_name, contact_email)')
      .eq('label_user_id', userId)
      .eq('status', 'active');

    if (error) return [];
    return (data || []).map((row) => ({
      id: row.id,
      artistProfileId: row.artist_profile_id,
      artistName: row.artist_profiles?.artist_name || '',
      contactEmail: row.artist_profiles?.contact_email || '',
    }));
  },

  async buildDashboard(account) {
    if (!account) throw new Error('Not signed in.');

    const activity = await this._fetchActivityForAccount(account);
    const charts = this.computeCharts(activity, 10);
    const stats = this.computeStats(activity);

    const supabase = await HideawayAuth.init();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    const submissions = userId ? await this._fetchSubmissions(userId) : [];
    const labelAccess = userId && String(account.accountType).toLowerCase() !== 'label'
      ? []
      : (userId ? await this._fetchLabelAccess(userId) : []);

    return {
      success: true,
      artist: account,
      stats,
      activity,
      charts,
      profile: null,
      chartHistory: [],
      labelAccess,
      managedProfiles: labelAccess,
      submissions,
      musicStyles: [],
    };
  },

  async fetchDashboard() {
    const account = ArtistAuth.getArtist();
    if (!account) throw new Error('Not signed in.');
    return this.buildDashboard(account);
  },

  async fetchDemoDashboard() {
    const demoArtist = CONFIG.spotlight?.houseArtist || 'David Parmley';
    return this.buildDashboard({
      artistName: demoArtist,
      accountType: 'artist',
      email: '',
      status: 'active',
    });
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