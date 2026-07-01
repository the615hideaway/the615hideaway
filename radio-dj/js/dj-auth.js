const DjAuth = {
  _restorePromise: null,
  _signedOut: false,
  _signingOut: false,
  signedOutKey: 'radio_now_signed_out',

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
    const payload = JSON.stringify({
      token: data.token || '',
      dj: data.dj
    });
    sessionStorage.setItem(CONFIG.djSessionKey, payload);
    try {
      localStorage.setItem(CONFIG.djSessionKey, payload);
    } catch (_) {}
    sessionStorage.removeItem(CONFIG.authKey);
    sessionStorage.removeItem(CONFIG.artistSessionKey);
  },

  getSession() {
    let raw = localStorage.getItem(CONFIG.djSessionKey);
    if (!raw) raw = sessionStorage.getItem(CONFIG.djSessionKey);
    if (raw) {
      try {
        sessionStorage.setItem(CONFIG.djSessionKey, raw);
      } catch (_) {}
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  },

  clearLocalSession() {
    sessionStorage.removeItem(CONFIG.djSessionKey);
    localStorage.removeItem(CONFIG.djSessionKey);
    sessionStorage.removeItem(CONFIG.authKey);
  },

  getDj() {
    return this.getSession()?.dj || null;
  },

  getToken() {
    return this.getSession()?.token || '';
  },

  isExplicitlySignedOut() {
    if (this._signedOut) return true;
    try {
      return localStorage.getItem(this.signedOutKey) === '1';
    } catch (_) {
      return false;
    }
  },

  _setSignedOutFlag() {
    this._signedOut = true;
    try {
      localStorage.setItem(this.signedOutKey, '1');
    } catch (_) {}
  },

  _clearSignedOutFlag() {
    this._signedOut = false;
    try {
      localStorage.removeItem(this.signedOutKey);
    } catch (_) {}
  },

  isAuthenticated() {
    if (this.isExplicitlySignedOut()) return false;
    return !!this.getSession()?.dj;
  },

  async ensureDjEmailOnCachedSession() {
    const cached = this.getSession();
    if (!cached?.dj) return;

    try {
      const supabase = await this._getSupabase();
      const { data } = await supabase.auth.getSession();
      const email = String(data.session?.user?.email || '').trim().toLowerCase();
      if (!email) return;

      let changed = false;
      if (!cached.dj.email) {
        cached.dj.email = email;
        changed = true;
      }
      if (!cached.dj.contactEmail) {
        cached.dj.contactEmail = email;
        changed = true;
      }
      if (changed) this.saveSession(cached);
    } catch (_) {}
  },

  _clearSupabaseAuthStorage() {
    try {
      localStorage.removeItem('the615hideaway-supabase-auth');
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
  },

  async logout() {
    this._signingOut = true;
    this._setSignedOutFlag();
    this.clearLocalSession();
    sessionStorage.removeItem(CONFIG.artistSessionKey);
    this._clearSupabaseAuthStorage();
    try {
      if (typeof HideawayAuth !== 'undefined' && HideawayAuth.signOut) {
        await HideawayAuth.signOut();
      } else {
        const supabase = await this._getSupabase();
        await supabase.auth.signOut({ scope: 'local' });
        if (typeof HideawayAuth !== 'undefined' && HideawayAuth.resetClient) {
          HideawayAuth.resetClient();
        }
      }
    } catch (_) {
      this._clearSupabaseAuthStorage();
      if (typeof HideawayAuth !== 'undefined' && HideawayAuth.resetClient) {
        HideawayAuth.resetClient();
      }
    }
    this._signingOut = false;
  },

  async _ensureMemberProfile(supabase, session, memberType) {
    const meta = session.user.user_metadata || {};
    await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: meta.display_name || session.user.email.split('@')[0],
      member_type: memberType || meta.member_type || 'dj',
      role: (memberType || meta.member_type) === 'dj' ? 'dj' : 'member'
    }, { onConflict: 'id' });
  },

  _metadataToProfileRow(meta, session) {
    const pending = meta?.dj_profile;
    if (!pending || typeof pending !== 'object') return null;

    return this.profileToRow({
      firstName: pending.first_name || pending.firstName || '',
      lastName: pending.last_name || pending.lastName || '',
      programName: pending.program_name || pending.programName || '',
      programFormat: pending.program_format || pending.programFormat || '',
      stationCallLetters: pending.station_call_letters || pending.stationCallLetters || '',
      stationFrequency: pending.station_frequency || pending.stationFrequency || '',
      state: pending.state || '',
      stationWebsite: pending.station_website || pending.stationWebsite || '',
      programWebsite: pending.program_website || pending.programWebsite || '',
      programStartTime: pending.program_start_time || pending.programStartTime || '',
      programEndTime: pending.program_end_time || pending.programEndTime || '',
      programTimezone: pending.program_timezone || pending.programTimezone || '',
      programDays: pending.program_days || pending.programDays || '',
      contactEmail: pending.contact_email || pending.contactEmail || session?.user?.email || '',
      shareEmail: !!(pending.share_email ?? pending.shareEmail)
    });
  },

  async _ensureDjProfileFromMetadata(supabase, session) {
    let profileRow = await this._loadDjProfile(supabase, session.user.id);
    if (profileRow?.profile_complete) return profileRow;

    const row = this._metadataToProfileRow(session.user.user_metadata || {}, session);
    if (!row) return profileRow;

    const { error } = await supabase.from('dj_profiles').upsert({
      id: session.user.id,
      ...row
    }, { onConflict: 'id' });
    if (error) throw error;

    return this._loadDjProfile(supabase, session.user.id);
  },

  async needsProfileCompletion() {
    const supabase = await this._getSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;

    const profileRow = await this._loadDjProfile(supabase, session.user.id);
    if (profileRow?.profile_complete) return false;

    const metaRow = this._metadataToProfileRow(session.user.user_metadata || {}, session);
    return !metaRow;
  },

  async saveProfileFromFields(fields) {
    const supabase = await this._getSupabase();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) throw new Error('Sign in first, then finish your DJ profile.');

    const payload = this.fieldsToPayload(fields);
    if (!payload.firstName || !payload.lastName || !payload.programName || !payload.stationCallLetters) {
      throw new Error('First name, last name, program name, and station call letters are required.');
    }

    const row = this.profileToRow({
      ...payload,
      contactEmail: payload.contactEmail || session.user.email
    });

    const djProfileMeta = {
      first_name: row.first_name,
      last_name: row.last_name,
      program_name: row.program_name,
      program_format: row.program_format,
      station_call_letters: row.station_call_letters,
      station_frequency: row.station_frequency,
      state: row.state,
      station_website: row.station_website,
      program_website: row.program_website,
      program_start_time: row.program_start_time,
      program_end_time: row.program_end_time,
      program_timezone: row.program_timezone,
      program_days: row.program_days,
      contact_email: row.contact_email,
      share_email: row.share_email
    };

    await supabase.auth.updateUser({
      data: {
        ...session.user.user_metadata,
        member_type: 'dj',
        display_name: [row.first_name, row.last_name].filter(Boolean).join(' ') || session.user.email.split('@')[0],
        dj_profile: djProfileMeta
      }
    });

    const { error: profileError } = await supabase.from('dj_profiles').upsert({
      id: session.user.id,
      ...row
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    const { data: refreshed } = await supabase.auth.getSession();
    return this.completeSessionSetup(refreshed.session || session);
  },

  async completeSessionSetup(session) {
    this._clearSignedOutFlag();
    const supabase = await this._getSupabase();
    await this._ensureMemberProfile(supabase, session, 'dj');
    await this._ensureDjProfileFromMetadata(supabase, session);
    return this._activateSessionLight(session);
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

  _mergePublicDj(publicDj, session, bridgeDj) {
    const email = String(session?.user?.email || publicDj?.email || '').trim();
    const merged = {
      ...publicDj,
      ...(bridgeDj || {}),
      email: String(bridgeDj?.email || publicDj?.email || email || '').trim(),
      contactEmail: String(bridgeDj?.contactEmail || publicDj?.contactEmail || email || '').trim(),
    };
    return merged;
  },

  _profileRowUsable(profileRow) {
    if (!profileRow) return false;
    if (profileRow.profile_complete) return true;
    return !!(
      profileRow.first_name
      && profileRow.last_name
      && profileRow.program_name
      && profileRow.station_call_letters
    );
  },

  _minimalDjFromSession(session, profileRow) {
    const row = profileRow || this._metadataToProfileRow(session.user.user_metadata || {}, session) || {
      first_name: '',
      last_name: '',
      program_name: '',
      station_call_letters: '',
      contact_email: session.user.email || '',
      profile_complete: false
    };
    return this._mergePublicDj(this.rowToPublic(row, session), session);
  },

  async _activateSessionLight(session) {
    const supabase = await this._getSupabase();
    await this._ensureMemberProfile(supabase, session, 'dj');

    const profileRow = await this._loadDjProfile(supabase, session.user.id);
    if (!this._profileRowUsable(profileRow)) throw new Error('PROFILE_INCOMPLETE');

    const publicDj = this._mergePublicDj(this.rowToPublic(profileRow, session), session);
    const token = this.getToken() || '';
    this.saveSession({ token, dj: publicDj });
    return publicDj;
  },

  async _getSupabaseSession(supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    try {
      const refreshed = await supabase.auth.refreshSession();
      return refreshed.data.session || null;
    } catch (_) {
      return null;
    }
  },

  async resolveSession() {
    if (this._signingOut) return null;

    if (this.isExplicitlySignedOut()) {
      this.clearLocalSession();
      return null;
    }

    const cached = this.getSession();
    const supabase = await this._getSupabase();
    const session = await this._getSupabaseSession(supabase);

    if (!session) {
      if (cached?.dj) {
        return cached.dj;
      }
      this.clearLocalSession();
      return null;
    }

    this._clearSignedOutFlag();

    if (cached?.dj) {
      await this.ensureDjEmailOnCachedSession();
      return cached.dj;
    }

    try {
      return await this._activateSessionLight(session);
    } catch (err) {
      if (String(err.message) === 'PROFILE_INCOMPLETE') {
        if (typeof DjBoot !== 'undefined') DjBoot._needsProfileCompletion = true;
        const publicDj = this._minimalDjFromSession(session);
        this.saveSession({ token: '', dj: publicDj });
        return publicDj;
      }
      console.warn('DJ session resolve failed:', err.message);
      if (cached?.dj) return cached.dj;
      return null;
    }
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
      publicDj = this._mergePublicDj(publicDj, session, bridge.dj);
    } catch (err) {
      if (!profileRow?.profile_complete) throw err;
      console.warn('Catalog bridge unavailable:', err.message);
      publicDj = this._mergePublicDj(publicDj, session);
    }

    this.saveSession({ token, dj: publicDj });
    return publicDj;
  },

  async restoreSession() {
    return this.resolveSession();
  },

  async login(email, password) {
    const supabase = await this._getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || '')
    });
    if (error) {
      const msg = String(error.message || '');
      if (msg.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please confirm your email first. Check your inbox and spam for a message from The 615 Hideaway, click the link, then sign in.');
      }
      throw error;
    }

    this._clearSignedOutFlag();
    try {
      return await this.completeSessionSetup(data.session);
    } catch (err) {
      if (String(err.message) === 'PROFILE_INCOMPLETE') {
        throw new Error('PROFILE_INCOMPLETE');
      }
      throw err;
    }
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

    const row = this.profileToRow({
      ...payload,
      contactEmail: payload.contactEmail || email
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          member_type: 'dj',
          dj_profile: {
            first_name: row.first_name,
            last_name: row.last_name,
            program_name: row.program_name,
            program_format: row.program_format,
            station_call_letters: row.station_call_letters,
            station_frequency: row.station_frequency,
            state: row.state,
            station_website: row.station_website,
            program_website: row.program_website,
            program_start_time: row.program_start_time,
            program_end_time: row.program_end_time,
            program_timezone: row.program_timezone,
            program_days: row.program_days,
            contact_email: row.contact_email,
            share_email: row.share_email
          }
        },
        emailRedirectTo: 'https://www.the615hideaway.com/radio-dj?confirmed=1'
      }
    });
    if (error) throw error;

    if (!data.session) {
      return {
        pendingConfirmation: true,
        email
      };
    }

    return this.completeSessionSetup(data.session);
  },

  async authRequest(action, payload = {}) {
    throw new Error(`"${action}" is no longer served by Google Sheets. Update the app to use Supabase for this action.`);
  },

  updateDjProfile(dj) {
    const session = this.getSession();
    if (!session) return;
    session.dj = { ...session.dj, ...dj };
    this.saveSession(session);
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

    const publicDj = this._mergePublicDj(this.rowToPublic(row, session), session);
    this.saveSession({ token: '', dj: publicDj });
    return publicDj;
  }
};