const DjFeedback = {
  async _submit(reportType, fields) {
    const dj = DjAuth.getDj();
    if (!dj) throw new Error('Sign in with your DJ account first.');

    const supabase = await HideawayAuth.init();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Sign in with your DJ account first.');

    const payload = {
      dj_user_id: session.user.id,
      report_type: reportType,
      dj_name: [dj.firstName, dj.lastName].filter(Boolean).join(' ') || dj.name || '',
      dj_email: dj.contactEmail || dj.email || session.user.email || '',
      station: dj.stationCallLetters || dj.station || '',
      program: dj.programName || dj.showName || '',
      artist_name: String(fields.artistName || '').trim(),
      song_title: String(fields.songTitle || '').trim(),
      issue_type: String(fields.issueType || '').trim(),
      correction: String(fields.correction || '').trim(),
      notes: String(fields.notes || '').trim(),
      page: String(fields.page || '').trim(),
      what_happened: String(fields.whatHappened || '').trim(),
    };

    const { data, error } = await supabase
      .from('dj_feedback')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;

    try {
      await fetch('/api/radio-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          type: 'dj_feedback',
          reportId: data.id,
          ...payload,
        }),
      });
    } catch (_) {}

    return { success: true, reportId: data.id };
  },

  async submitSongInfo(fields) {
    if (!String(fields.artistName || '').trim() || !String(fields.songTitle || '').trim()) {
      throw new Error('Artist name and song title are required.');
    }
    return this._submit('song_info', fields);
  },

  async submitSiteBug(fields) {
    return this._submit('site_bug', fields);
  },
};