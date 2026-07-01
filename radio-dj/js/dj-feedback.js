const DjFeedback = {
  async submitSongInfo(fields) {
    return DjAuth.authRequest('dj_feedback_submit', {
      reportType: 'song_info',
      artistName: String(fields.artistName || '').trim(),
      songTitle: String(fields.songTitle || '').trim(),
      issueType: String(fields.issueType || '').trim(),
      correction: String(fields.correction || '').trim(),
      notes: String(fields.notes || '').trim(),
    });
  },

  async submitSiteBug(fields) {
    return DjAuth.authRequest('dj_feedback_submit', {
      reportType: 'site_bug',
      page: String(fields.page || '').trim(),
      whatHappened: String(fields.whatHappened || '').trim(),
      notes: String(fields.notes || '').trim(),
    });
  },
};