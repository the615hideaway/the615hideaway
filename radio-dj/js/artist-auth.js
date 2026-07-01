const ArtistAuth = {
  async _getSupabase() {
    if (typeof HideawayAuth === 'undefined') {
      throw new Error('Supabase auth is not loaded. Refresh the page and try again.');
    }
    return HideawayAuth.init();
  },

  isExplicitlySignedOut() {
    return typeof DjAuth !== 'undefined' && DjAuth.isExplicitlySignedOut();
  },

  rowToPublic(row, session) {
    if (!row) return null;
    const email = session?.user?.email || row.contact_email || '';
    return {
      id: row.legacy_artist_id || session?.user?.id || '',
      artistName: row.artist_name || session?.user?.user_metadata?.display_name || '',
      email,
      contactEmail: row.contact_email || email,
      accountType: row.account_type || 'artist',
      status: row.status || 'active',
    };
  },

  saveSession(data) {
    const payload = JSON.stringify({ artist: data.artist || data });
    sessionStorage.setItem(CONFIG.artistSessionKey, payload);
    try {
      localStorage.setItem(CONFIG.artistSessionKey, payload);
    } catch (_) {}
    sessionStorage.removeItem(CONFIG.djSessionKey);
    localStorage.removeItem(CONFIG.djSessionKey);
    sessionStorage.removeItem(CONFIG.authKey);
  },

  getSession() {
    let raw = localStorage.getItem(CONFIG.artistSessionKey);
    if (!raw) raw = sessionStorage.getItem(CONFIG.artistSessionKey);
    if (raw) {
      try {
        sessionStorage.setItem(CONFIG.artistSessionKey, raw);
      } catch (_) {}
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },

  clearLocalSession() {
    sessionStorage.removeItem(CONFIG.artistSessionKey);
    localStorage.removeItem(CONFIG.artistSessionKey);
  },

  getArtist() {
    return this.getSession()?.artist || null;
  },

  getToken() {
    return '';
  },

  isAuthenticated() {
    if (this.isExplicitlySignedOut()) return false;
    return !!this.getSession()?.artist;
  },

  isLabelAccount() {
    return String(this.getArtist()?.accountType || '').toLowerCase() === 'label';
  },

  logout() {
    this.clearLocalSession();
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

  async _loadArtistProfile(supabase, userId) {
    const { data, error } = await supabase
      .from('artist_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async _ensureMemberProfile(supabase, session, memberType) {
    const meta = session.user.user_metadata || {};
    await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: meta.display_name || session.user.email.split('@')[0],
      member_type: memberType,
      role: memberType === 'label' ? 'artist' : 'artist',
    }, { onConflict: 'id' });
  },

  async _activateSession(session) {
    const supabase = await this._getSupabase();
    const profileRow = await this._loadArtistProfile(supabase, session.user.id);
    if (!profileRow || String(profileRow.status).toLowerCase() !== 'active') {
      throw new Error('Artist account not found or inactive.');
    }

    const publicArtist = this.rowToPublic(profileRow, session);
    this.saveSession({ artist: publicArtist });
    if (typeof DjAuth !== 'undefined' && DjAuth._clearSignedOutFlag) {
      DjAuth._clearSignedOutFlag();
    }
    return publicArtist;
  },

  async resolveSession() {
    if (this.isExplicitlySignedOut()) {
      this.clearLocalSession();
      return null;
    }

    const cached = this.getSession();
    const supabase = await this._getSupabase();
    const session = await this._getSupabaseSession(supabase);

    if (!session) {
      return cached?.artist || null;
    }

    if (cached?.artist) return cached.artist;

    try {
      return await this._activateSession(session);
    } catch (err) {
      console.warn('Artist session resolve failed:', err.message);
      return cached?.artist || null;
    }
  },

  async login(email, password) {
    const supabase = await this._getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    if (error) {
      const msg = String(error.message || '');
      if (msg.toLowerCase().includes('email not confirmed')) {
        throw new Error('Please confirm your email first, then sign in.');
      }
      throw error;
    }

    return this._activateSession(data.session);
  },

  async _signupAccount(fields, accountType) {
    const email = String(fields.email || '').trim();
    const password = String(fields.password || '');
    const displayName = accountType === 'label'
      ? String(fields.labelName || '').trim()
      : String(fields.artistName || '').trim();

    if (!displayName || !email) {
      throw new Error('Name and email are required.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const supabase = await this._getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          member_type: accountType,
          artist_name: displayName,
        },
        emailRedirectTo: 'https://www.the615hideaway.com/radio-dj/artist-dashboard.html?confirmed=1',
      },
    });
    if (error) throw error;

    if (!data.session) {
      return { pendingConfirmation: true, email, artistName: displayName };
    }

    await this._ensureMemberProfile(supabase, data.session, accountType);
    const { error: profileError } = await supabase.from('artist_profiles').upsert({
      id: data.session.user.id,
      artist_name: displayName,
      account_type: accountType,
      contact_email: email,
      status: 'active',
    }, { onConflict: 'id' });
    if (profileError) throw profileError;

    return this._activateSession(data.session);
  },

  async signup(fields) {
    const result = await this._signupAccount(fields, 'artist');
    if (result?.pendingConfirmation) return result;
    return result;
  },

  async signupLabel(fields) {
    const result = await this._signupAccount(fields, 'label');
    if (result?.pendingConfirmation) return result;
    return result;
  },

  async activate(email, password) {
    return this.login(email, password);
  },

  async createArtistProfile(fields) {
    const artistName = String(fields.artistName || '').trim();
    if (!artistName) throw new Error('Artist name is required.');
    throw new Error(`To add "${artistName}" to your roster, email radio@the615hideaway.com — artist accounts are created in Supabase.`);
  },

  async revokeLabelAccess(labelAccountId) {
    const supabase = await this._getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Not signed in.');

    const { error } = await supabase
      .from('label_roster_access')
      .update({ status: 'revoked' })
      .eq('label_user_id', session.user.id)
      .eq('artist_profile_id', String(labelAccountId || '').trim());

    if (error) throw error;
    return { success: true };
  },

  buildSongPayload(fields) {
    return {
      artistName: String(fields.artistName || '').trim(),
      songTitle: String(fields.songTitle || '').trim(),
      year: String(fields.year || '').trim(),
      songTime: String(fields.songTime || '').trim(),
      musicStyle: String(fields.musicStyle || '').trim(),
      songwriter: String(fields.songwriter || '').trim(),
      featuredArtist: String(fields.featuredArtist || '').trim(),
      recordLabel: String(fields.recordLabel || '').trim(),
      releaseType: String(fields.releaseType || 'single').trim(),
      albumName: String(fields.albumName || '').trim(),
      description: String(fields.description || '').trim(),
      website: String(fields.website || '').trim(),
      contactEmail: String(fields.contactEmail || '').trim(),
    };
  },

  async _uploadFile(file, assetType, meta) {
    const supabase = await this._getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Not signed in.');

    const safeName = String(file.name || assetType).replace(/[^a-zA-Z0-9._-]+/g, '_');
    const path = `${session.user.id}/${Date.now()}-${assetType}-${safeName}`;

    const { error } = await supabase.storage
      .from('radio-submissions')
      .upload(path, file, { upsert: false, contentType: file.type || undefined });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('radio-submissions').getPublicUrl(path);
    return urlData?.publicUrl || path;
  },

  async uploadSubmissionAsset(fields) {
    throw new Error('Use submitSong with file fields — uploads go to Supabase Storage.');
  },

  async uploadSubmissionAssetStart() {
    throw new Error('Chunked uploads are no longer used. Submit files with submitSong.');
  },

  async uploadSubmissionAssetChunk() {
    throw new Error('Chunked uploads are no longer used.');
  },

  async uploadSubmissionAssetFinish() {
    throw new Error('Chunked uploads are no longer used.');
  },

  async submitSong(fields) {
    const supabase = await this._getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Not signed in.');

    const artist = this.getArtist();
    const payload = this.buildSongPayload(fields);
    if (!payload.artistName || !payload.songTitle) {
      throw new Error('Artist name and song title are required.');
    }

    let mp3Url = String(fields.mp3Link || '').trim();
    let coverUrl = String(fields.coverLink || '').trim();
    let wavUrl = String(fields.wavLink || '').trim();

    if (fields.mp3File instanceof File) mp3Url = await this._uploadFile(fields.mp3File, 'mp3', payload);
    if (fields.coverFile instanceof File) coverUrl = await this._uploadFile(fields.coverFile, 'cover', payload);
    if (fields.wavFile instanceof File) wavUrl = await this._uploadFile(fields.wavFile, 'wav', payload);

    const { data, error } = await supabase.from('song_submissions').insert({
      artist_user_id: session.user.id,
      artist_name: payload.artistName || artist?.artistName || '',
      song_title: payload.songTitle,
      status: 'pending',
      payload,
      mp3_url: mp3Url,
      wav_url: wavUrl,
      cover_url: coverUrl,
    }).select('id').single();

    if (error) throw error;

    try {
      await fetch('/api/radio-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          type: 'song_submission',
          submissionId: data.id,
          ...payload,
          mp3Url,
          coverUrl,
          wavUrl,
          submitterEmail: artist?.email || session.user.email,
        }),
      });
    } catch (_) {}

    return { success: true, submissionId: data.id };
  },

  async updateSong(submissionId, fields) {
    const supabase = await this._getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw new Error('Not signed in.');

    const payload = this.buildSongPayload(fields);
    const { error } = await supabase
      .from('song_submissions')
      .update({ payload, artist_name: payload.artistName, song_title: payload.songTitle })
      .eq('id', String(submissionId || '').trim())
      .eq('artist_user_id', session.user.id);

    if (error) throw error;
    return { success: true };
  },

  async authRequest(action, payload = {}) {
    throw new Error(`"${action}" is no longer served by Google Sheets. This action uses Supabase now.`);
  },

  updateArtistProfile(artist) {
    const session = this.getSession();
    if (!session) return;
    session.artist = { ...session.artist, ...artist };
    this.saveSession(session);
  },
};