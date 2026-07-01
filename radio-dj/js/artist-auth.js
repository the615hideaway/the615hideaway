const ArtistAuth = {
  isScriptReady() {
    return !!(CONFIG.googleScriptUrl && CONFIG.googleScriptUrl.includes('script.google.com'));
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  isRetryableRequestError(err) {
    const message = String(err?.message || err || '').toLowerCase();
    return message.includes('timed out')
      || message.includes('timeout')
      || message.includes('network')
      || message.includes('failed to fetch')
      || message.includes('upload request failed')
      || message.includes('upload service returned');
  },

  async request(action, payload = {}, options = {}) {
    if (!this.isScriptReady()) {
      throw new Error('Artist sign-in is not configured yet. Redeploy Apps Script with the latest Code.gs.');
    }

    const label = options.label || action;
    let response;
    try {
      response = await fetch(CONFIG.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (err) {
      throw new Error(`Upload request failed (${label}). Google timed out or blocked the request — wait a moment and try again.`);
    }

    if (!response.ok) {
      throw new Error(`Upload service returned an error (${label}). Please try again.`);
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      throw new Error(`Upload service sent an invalid response (${label}). Redeploy Apps Script with the latest Code.gs.`);
    }

    if (!data.success) {
      throw new Error(data.error || `Request failed (${label}).`);
    }

    return data;
  },

  async requestWithRetry(action, payload = {}, options = {}) {
    const maxAttempts = options.maxAttempts || 4;
    const label = options.label || action;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.request(action, payload, { label });
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts && this.isRetryableRequestError(err)) {
          await this.sleep(700 * attempt);
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error(`Request failed (${label}).`);
  },

  saveSession(data) {
    sessionStorage.setItem(CONFIG.artistSessionKey, JSON.stringify({
      token: data.token,
      artist: data.artist,
    }));
    sessionStorage.removeItem(CONFIG.djSessionKey);
    sessionStorage.removeItem(CONFIG.authKey);
  },

  getSession() {
    const raw = sessionStorage.getItem(CONFIG.artistSessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  },

  getArtist() {
    return this.getSession()?.artist || null;
  },

  getToken() {
    return this.getSession()?.token || '';
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  logout() {
    sessionStorage.removeItem(CONFIG.artistSessionKey);
  },

  async login(email, password) {
    const data = await this.request('artist_login', {
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    this.saveSession(data);
    return data.artist;
  },

  async signup(fields) {
    const data = await this.request('artist_signup', {
      artistName: String(fields.artistName || '').trim(),
      email: String(fields.email || '').trim(),
      password: String(fields.password || ''),
    });
    this.saveSession(data);
    return data.artist;
  },

  async signupLabel(fields) {
    const data = await this.request('label_signup', {
      labelName: String(fields.labelName || '').trim(),
      email: String(fields.email || '').trim(),
      password: String(fields.password || ''),
    });
    this.saveSession(data);
    return data.artist;
  },

  isLabelAccount() {
    return String(this.getArtist()?.accountType || '').toLowerCase() === 'label';
  },

  async createArtistProfile(fields) {
    return this.authRequest('artist_profile_create', {
      artistName: String(fields.artistName || '').trim(),
      claimEmail: String(fields.claimEmail || '').trim(),
    });
  },

  async revokeLabelAccess(labelAccountId) {
    return this.authRequest('label_access_revoke', {
      labelAccountId: String(labelAccountId || '').trim(),
    });
  },

  uploadAuthPayload(fields = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Not signed in.');
    return { token, ...fields };
  },

  async uploadSubmissionAsset(fields) {
    const fileName = String(fields.fileName || '').trim() || 'file';
    return this.requestWithRetry('song_upload_asset', this.uploadAuthPayload({
      artistName: String(fields.artistName || '').trim(),
      songTitle: String(fields.songTitle || '').trim(),
      assetType: String(fields.assetType || '').trim(),
      fileName,
      mimeType: String(fields.mimeType || '').trim(),
      fileBase64: String(fields.fileBase64 || ''),
    }), { label: `${fileName} upload` });
  },

  async uploadSubmissionAssetStart(fields) {
    const fileName = String(fields.fileName || '').trim() || 'file';
    return this.requestWithRetry('song_upload_start', this.uploadAuthPayload({
      uploadId: String(fields.uploadId || '').trim(),
      artistName: String(fields.artistName || '').trim(),
      songTitle: String(fields.songTitle || '').trim(),
      assetType: String(fields.assetType || '').trim(),
      fileName,
      mimeType: String(fields.mimeType || '').trim(),
      totalChunks: fields.totalChunks,
    }), { label: `${fileName} start` });
  },

  async uploadSubmissionAssetChunk(fields) {
    const fileName = String(fields.fileName || '').trim() || 'file';
    const part = Number(fields.chunkIndex || 0) + 1;
    const total = Number(fields.totalChunks || 0);
    return this.requestWithRetry('song_upload_chunk', this.uploadAuthPayload({
      uploadId: String(fields.uploadId || '').trim(),
      chunkIndex: fields.chunkIndex,
      totalChunks: fields.totalChunks,
      chunkBase64: String(fields.chunkBase64 || ''),
    }), { label: `${fileName} part ${part} of ${total}` });
  },

  async uploadSubmissionAssetFinish(fields) {
    const fileName = String(fields.fileName || '').trim() || 'file';
    return this.requestWithRetry('song_upload_finish', this.uploadAuthPayload({
      uploadId: String(fields.uploadId || '').trim(),
    }), { label: `${fileName} finalize`, maxAttempts: 3 });
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
      leadVocals: String(fields.leadVocals || '').trim(),
      harmonyVocals: Array.isArray(fields.harmonyVocals) ? fields.harmonyVocals : [],
      instrumentPlayers: Array.isArray(fields.instrumentPlayers) ? fields.instrumentPlayers : [],
      recordLabel: String(fields.recordLabel || '').trim(),
      independent: !!fields.independent,
      releaseType: String(fields.releaseType || 'single').trim(),
      albumName: String(fields.albumName || '').trim(),
      description: String(fields.description || '').trim(),
      website: String(fields.website || '').trim(),
      contactEmail: String(fields.contactEmail || '').trim(),
      mp3Link: String(fields.mp3Link || '').trim(),
      wavLink: String(fields.wavLink || '').trim(),
      coverLink: String(fields.coverLink || '').trim(),
    };
  },

  async submitSong(fields) {
    return this.authRequest('song_submit', this.buildSongPayload(fields));
  },

  async updateSong(submissionId, fields) {
    return this.authRequest('song_update', {
      submissionId: String(submissionId || '').trim(),
      ...this.buildSongPayload(fields),
    });
  },

  async activate(email, password) {
    const data = await this.request('artist_activate', {
      email: String(email || '').trim(),
      password: String(password || ''),
    });
    this.saveSession(data);
    return data.artist;
  },

  async authRequest(action, payload = {}) {
    const token = this.getToken();
    if (!token) throw new Error('Not signed in.');
    return this.request(action, { token, ...payload });
  },

  updateArtistProfile(artist) {
    const session = this.getSession();
    if (!session) return;
    session.artist = { ...session.artist, ...artist };
    sessionStorage.setItem(CONFIG.artistSessionKey, JSON.stringify(session));
  },
};