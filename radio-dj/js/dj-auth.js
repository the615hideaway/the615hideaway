const DjAuth = {
  _restorePromise: null,

  async _getSupabase() {
    if (typeof HideawayAuth === 'undefined') {
      throw new Error('Supabase auth is not loaded. Refresh the page and try again.');
    }
    return HideawayAuth.init();
  },

  profileToRow(profile) {
    return {
      first_name: profile.firstName || '',
      last_name: profile.lastName || '',
      program_name: profile.programName || '',
      program_format: profile.programFormat || '',
      station_call_letters: profile.stationCallLetters || '',
      station_frequency: profile.stationFrequency || '',
      state: profile.state || '',
      station_website: profile.stationWebsite || '',
      program_website: profile.programWebsite || '',
      program_start_time: profile.programStartTime || '',
      program_end_time: profile.programEndTime || '',
      program_timezone: profile.programTimezone || '',
      program_days: profile.programDays || '',
      contact_email: profile.contactEmail || '',
      share_email: !!profile.shareEmail,
      profile_complete: true
    };
  },

  rowToPublic(row, session) {
    if (!row) return null;
    const email = session?.user?.email || row.contact_email || '';
    return {
      id: row.legacy_dj_id || session?.user?.id || '',
      name: [row.first_name, row.last_name].filter(Boolean).join(' ') || session?.user?.user_metadata?.display_name || email.split('@')[0],
      email,
      contactEmail: row.contact_email || email,
      station: row.station_call_letters || '',
      showName: row.program_name || '',
      shareEmail: !!row.share_email,
      status: 'active',
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      programName: row.program_name || '',
      programFormat: row.program_format || '',
      stationCallLetters: row.station_call_letters || '',
      stationFrequency: row.station_frequency || '',
      state: row.state || '',
      stationWebsite: row.station_website || '',
      programWebsite: row.program_website || '',
      programStartTime: row.program_start_time || '',
      programEndTime: row.program_end_time || '',
      programTimezone: row.program_timezone || '',
      programDays: row.program_days || ''
    };
  },

  fieldsToPayload(fields) {
    return {
      firstName: String(fields.firstName || '').trim(),
      lastName: String(fields.lastName || '').trim(),
      programName: String(fields.programName || '').trim(),
      programFormat: String(fields.programFormat || '').trim(),
      stationCallLetters: String(fields.stationCallLetters || '').trim(),
      stationFrequency: String(fields.stationFrequency || '').trim(),
      state: String(fields.state || '').trim(),
      stationWebsite: String(fields.stationWebsite || '').trim(),
      programWebsite: String(fields.programWebsite || '').trim(),
      programStartTime: String(fields.programStartTime || '').trim(),
      programEndTime: String(fields.programEndTime || '').trim(),
      programTimezone: String(fields.programTimezone || '').trim(),
      programDays: String(fields.programDays || '').trim(),
      contactEmail: String(fields.contactEmail || '').trim(),
      shareEmail: !!fields.shareEmail
    };
  },

  saveSession(data) {
    sessionStorage.setItem(CONFIG.djSessionKey, JSON.stringify({
      token: data.token || '',
      dj: data.dj
    }));
    sessionStorage.removeItem(CONFIG.authKey);
    sessionStorage.removeItem(CONFIG.artistSessionKey);
  },

  getSession() {
    const raw = sessionStorage.getItem(CONFIG.djSessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  },

  getDj() {
    return this.getSession()?.dj || null;
  },

  getToken() {
    return this.getSession()?.token || '';
  },

  isAuthenticated() {
    return !!this.getSession()?.dj;
  },

  async logout() {
    sessionStorage.removeItem(CONFIG.djSessionKey);
    sessionStorage.removeItem(CONFIG.authKey);
    sessionStorage.removeItem(CONFIG.artistSessionKey);
    try {
      await HideawayAuth.signOut();
    } catch (_) {}
  },

  async _ensureMemberProfile(supabase, session, memberType) {
    const meta = session.user.user_metadata || {};
    await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: meta.display_name || session.user.email.split('@')[0],
      member_type: memberType || meta.member_type || 'dj',
      role: memberType === 'dj' ? 'dj' : 'member'
    }, { onConflict: 'id' });
  },

  async _loadDjProfile(supabase, userId) {
    const { data, error } = await supabase
      .from('dj_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async _syncCatalogSession(session, profilePayload) {
    const response = await fetch('/api/radio-dj-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.access_token
      },
      body: JSON.stringify({ profile: profilePayload })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not connect your Radio Now catalog session.');
    }

    if (data.legacyDjId) {
      const supabase = await this._getSupabase();
      await supabase.from('dj_profiles').update({ legacy_dj_id: data.legacyDjId }).eq('id', session.user.id);
    }

    return data;
  },

  async _activateSession(session, profileRow, profilePayload) {
    let publicDj = this.rowToPublic(profileRow, session);
    let token = '';

    try {
      const bridge = await this._syncCatalogSession(session, profilePayload || {
        firstName: profileRow?.first_name,
        lastName: profileRow?.last_name,
        programName: profileRow?.program_name,
        programFormat: profileRow?.program_format,
        stationCallLetters: profileRow?.station_call_letters,
        stationFrequency: profileRow?.station_frequency,
        state: profileRow?.state,
        stationWebsite: profileRow?.station_website,
        programWebsite: profileRow?.program_website,
        programStartTime: profileRow?.program_start_time,
        programEndTime: profileRow?.program_end_time,
        programTimezone: profileRow?.program_timezone,
        programDays: profileRow?.program_days,
        contactEmail: profileRow?.contact_email,
        shareEmail: profileRow?.share_email,
        legacyDjId: profileRow?.legacy_dj_id
      });
      token = bridge.token || '';
      if (bridge.dj) publicDj = bridge.dj;
    } catch (err) {
      if (!profileRow?.profile_complete) throw err;
      console.warn('Catalog bridge unavailable:', err.message);
    }

    this.saveSession({ token, dj: publicDj });
    return publicDj;
  },

  async restoreSession() {
    if (this.isAuthenticated()) return this.getDj();
    if (this._restorePromise) return this._restorePromise;

    this._restorePromise = (async () => {
      try {
        const supabase = await this._getSupabase();
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return null;

        const profileRow = await this._loadDjProfile(supabase, session.user.id);
        if (!profileRow || !profileRow.profile_complete) return null;

        return await this._activateSession(session, profileRow);
      } catch (err) {
        console.warn('DJ session restore failed:', err.message);
        return null;
      } finally {
        this._restorePromise = null;
      }
    })();

    return this._restorePromise;
  },

  async login(email, password) {
    const supabase = await this._getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
    if (error) throw error;

    const session = data.session;
    await this._ensureMemberProfile(supabase, session, 'dj');

    const profileRow = await this._loadDjProfile(supabase, session.user.id);
    if (!profileRow || !profileRow.profile_complete) {
      throw new Error('Finish your DJ profile on the sign-up tab, or create a new DJ account with the same email.');
    }

    return this._activateSession(session, profileRow);
  },

  async signup(fields) {
    const payload = this.fieldsToPayload(fields);
    const email = String(fields.email || '').trim();
    const password = String(fields.password || '');

    if (!payload.firstName || !payload.lastName || !payload.programName || !payload.stationCallLetters || !email) {
      throw new Error('First name, last name, program name, station call letters, and email are required.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const supabase = await this._getSupabase();
    const displayName = [payload.firstName, payload.lastName].filter(Boolean).join(' ');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          member_type: 'dj'
        },
        emailRedirectTo: 'https://www.the615hideaway.com/radio-dj'
      }
    });
    if (error) throw error;

    if (!data.session) {
      throw new Error('Account created. Check your email to confirm, then sign in here with the same email and password.');
    }

    const session = data.session;
    await this._ensureMemberProfile(supabase, session, 'dj');

    const row = this.profileToRow({
      ...payload,
      contactEmail: payload.contactEmail || email
    });

    const { error: profileError } = await supabase.from('dj_profiles').upsert({
      id: session.user.id,
      ...row
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    return this._activateSession(session, { ...row, id: session.user.id }, payload);
  },

  async authRequest(action, payload = {}) {
    await this.restoreSession();
    const token = this.getToken();
    if (!token) {
      throw new Error('Radio Now catalog session is not linked yet. Sign out and sign in again.');
    }

    if (!CONFIG.googleScriptUrl || !CONFIG.googleScriptUrl.includes('script.google.com')) {
      throw new Error('Radio Now catalog service is not configured.');
    }

    const response = await fetch(CONFIG.googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...payload })
    });

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error('Could not reach the Radio Now catalog service.');
    }

    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  updateDjProfile(dj) {
    const session = this.getSession();
    if (!session) return;
    session.dj = { ...session.dj, ...dj };
    sessionStorage.setItem(CONFIG.djSessionKey, JSON.stringify(session));
  },

  async updateDjProfileRemote(fields) {
    const supabase = await this._getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Not signed in.');

    const payload = this.fieldsToPayload(fields);
    const row = this.profileToRow({
      ...payload,
      contactEmail: payload.contactEmail || session.user.email
    });

    const { error } = await supabase.from('dj_profiles').upsert({
      id: session.user.id,
      ...row
    }, { onConflict: 'id' });
    if (error) throw error;

    const bridge = await this._syncCatalogSession(session, payload);
    if (bridge.dj) {
      this.saveSession({ token: bridge.token || this.getToken(), dj: bridge.dj });
      return bridge.dj;
    }

    const publicDj = this.rowToPublic(row, session);
    this.updateDjProfile(publicDj);
    return publicDj;
  }
};