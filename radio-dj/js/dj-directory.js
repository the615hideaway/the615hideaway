const DjDirectory = {
  async fetchAll() {
    const data = await AccountAuth.authRequest('dj_directory');
    return Array.isArray(data.djs) ? data.djs : [];
  },

  displayName(dj) {
    const name = [dj.firstName, dj.lastName].filter(Boolean).join(' ');
    return name || dj.name || 'DJ';
  },

  summaryLine(dj) {
    const parts = [];
    const station = dj.stationCallLetters || dj.station;
    const program = dj.programName || dj.showName;
    if (station) parts.push(station);
    if (program) parts.push(program);
    if (dj.state) parts.push(dj.state);
    return parts.join(' · ') || 'Station profile';
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

  formatSchedule(dj) {
    const parts = [];
    if (dj.programDays) parts.push(dj.programDays);
    if (dj.programStartTime || dj.programEndTime) {
      const start = this.formatTime(dj.programStartTime);
      const end = this.formatTime(dj.programEndTime);
      const range = [start, end].filter(Boolean).join(' – ');
      if (range) parts.push(range);
    }
    if (dj.programTimezone) parts.push(dj.programTimezone);
    return parts.join(' · ');
  },

  profileFields(dj) {
    const fields = [
      { label: 'DJ', value: this.displayName(dj) },
      { label: 'Program', value: dj.programName || dj.showName },
      { label: 'Format', value: dj.programFormat },
      { label: 'Call letters', value: dj.stationCallLetters || dj.station },
      { label: 'Frequency', value: dj.stationFrequency },
      { label: 'State', value: dj.state },
      { label: 'Schedule', value: this.formatSchedule(dj) },
      { label: 'Station site', value: dj.stationWebsite, isLink: true },
      { label: 'Program page', value: dj.programWebsite, isLink: true },
    ];

    if (dj.email) {
      fields.push({ label: 'Contact email', value: dj.email, isEmail: true });
    }

    return fields.filter((field) => field.value);
  },

  renderFieldValue(field) {
    if (field.isEmail) {
      return `<a href="mailto:${Utils.escapeHtml(field.value)}">${Utils.escapeHtml(field.value)}</a>`;
    }
    if (field.isLink) {
      return `<a href="${Utils.escapeHtml(field.value)}" target="_blank" rel="noopener">${Utils.escapeHtml(field.value)}</a>`;
    }
    return Utils.escapeHtml(field.value);
  },
};