const WavRequest = {
  config() {
    return CONFIG.wavRequest || {};
  },

  getDjProfile() {
    if (typeof DjAuth === 'undefined' || !DjAuth.isAuthenticated()) return null;
    return DjAuth.getDj();
  },

  draft(song, dj) {
    const to = Utils.normalizeContactEmail(song?.contactEmail);
    const title = Utils.songArtistName(song?.songTitle, song?.artistName);
    const djName = dj?.name || 'Your DJ name';
    const station = dj?.stationCallLetters || dj?.station || 'Your station';
    const show = dj?.programName || dj?.showName || 'Your show';
    const djEmail = dj?.contactEmail || dj?.email || 'your@email.com';
    const labelLine = song?.recordLabel ? `Label: ${song.recordLabel}\n` : '';

    const subject = `DJ requests WAV for your song — ${title}`;
    const body = `Hello,

A Radio Now DJ is requesting a broadcast WAV file for airplay:

Song: ${song.songTitle}
Artist: ${song.artistName}
${labelLine}
DJ details:
• DJ name: ${djName}
• Station: ${station}
• Show: ${show}
• Email: ${djEmail}

Please reply with the WAV file or a download link when you can.

Thank you!
Radio Now — (615) Hideaway Entertainment`;

    return { to, subject, body };
  },

  copyBlock(song, dj) {
    const { to, subject, body } = this.draft(song, dj);
    return `To: ${to}\nSubject: ${subject}\n\n${body}`;
  },

  canSendForMe() {
    return !!this.getDjProfile();
  },

  async sendForMe(song) {
    const dj = this.getDjProfile();
    if (!dj) throw new Error('Sign in with your DJ account to send a WAV request.');

    return DjAuth.authRequest('wav_request_send', {
      songId: song.id || '',
      songTitle: song.songTitle || '',
      artistName: song.artistName || '',
      recordLabel: song.recordLabel || '',
      contactEmail: song.contactEmail || '',
      musicStyle: song.musicStyle || '',
    });
  },
};