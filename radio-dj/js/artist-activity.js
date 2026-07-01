const ArtistActivity = {
  eventLabels: {
    download_mp3: 'MP3 download',
    download_wav: 'WAV download',
    download_zip: 'Downloaded',
    downloaded: 'Downloaded',
    download_onesheet: 'One-sheet PDF',
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

  async fetchDashboard() {
    return ArtistAuth.authRequest('artist_dashboard');
  },

  async fetchDemoDashboard() {
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!scriptUrl.includes('script.google.com')) {
      throw new Error('Demo dashboard needs Apps Script setup.');
    }

    const url = `${scriptUrl.replace(/\/$/, '')}?action=demo_artist_dashboard`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Demo artist dashboard unavailable');
    return data;
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