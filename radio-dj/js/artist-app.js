(function () {
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const artistProfile = document.getElementById('artist-profile');
  const artistSongs = document.getElementById('artist-songs');
  const queueList = document.getElementById('queue-list');
  const queueEmpty = document.getElementById('queue-empty');
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  const downloadList = document.getElementById('download-list');
  const downloadEmpty = document.getElementById('download-empty');
  const clearDownloadBtn = document.getElementById('clear-download-btn');
  const downloadZipBtn = document.getElementById('download-zip-btn');
  const nowPlaying = document.getElementById('now-playing');
  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingArtist = document.getElementById('now-playing-artist');
  const playQueueBtn = document.getElementById('play-queue-btn');
  const skipQueueBtn = document.getElementById('skip-queue-btn');
  const detailPanel = document.getElementById('detail-panel');

  let allSongs = [];
  let artist = null;
  let queue = [];
  let downloadQueue = [];
  let queuePlayIndex = -1;
  let currentPreviewId = null;
  let expandedDetailId = null;

  function getArtistSlug() {
    return new URLSearchParams(window.location.search).get('slug') || '';
  }

  function isAuthenticated() {
    return DjAuth.isAuthenticated();
  }

  function updateDownloadSetupNotice() {
    const notice = document.getElementById('download-setup-notice');
    if (!notice) return;
    notice.classList.toggle('hidden', RadioDB.isScriptConfigured());
  }

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    DjAuthUI.updateWelcome();
    SiteNav.init('artists');
    if (typeof TurnkeyPitch !== 'undefined') TurnkeyPitch.hideAppPromo();
    updateDownloadSetupNotice();
    if (typeof SpotlightAdmin !== 'undefined' && SpotlightAdmin.canManage()) {
      SpotlightAdmin.ensureLoaded().catch(() => {});
    }
    loadArtist();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
  }

  function saveQueue() {
    localStorage.setItem(CONFIG.queueKey, JSON.stringify(queue.map((s) => s.id)));
  }

  function saveDownloadQueue() {
    localStorage.setItem(CONFIG.downloadQueueKey, JSON.stringify(downloadQueue.map((s) => s.id)));
  }

  function syncQueuesFromSongs() {
    const storedQueueIds = JSON.parse(localStorage.getItem(CONFIG.queueKey) || '[]');
    queue = storedQueueIds.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    renderQueue();

    const storedDownloadIds = JSON.parse(localStorage.getItem(CONFIG.downloadQueueKey) || '[]');
    downloadQueue = storedDownloadIds.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    renderDownloadQueue();
    downloadZipBtn.disabled = downloadQueue.length === 0;
  }

  function renderContactEmailHtml(raw) {
    const email = Utils.normalizeContactEmail(raw);
    if (!email) return '—';
    return `<a href="mailto:${Utils.escapeHtml(email)}">${Utils.escapeHtml(email)}</a>`;
  }

  function renderWavRequestHtml(song) {
    const email = Utils.normalizeContactEmail(song.contactEmail);
    const contactLine = email
      ? renderContactEmailHtml(song.contactEmail)
      : 'the artist or label listed on this track';
    const canSend = typeof WavRequest !== 'undefined' && WavRequest.canSendForMe();
    const fromEmail = CONFIG.wavRequest?.fromEmail || 'radio@the615hideaway.com';

    return `
      <div class="detail-wav-request">
        <label><i class="fa-solid fa-envelope"></i> Need WAV for airplay?</label>
        <p>Turn-key folders include <strong>MP3</strong>, cover art, and a one-sheet PDF. For broadcast WAV, Radio Now can email the artist for you.</p>
        ${email
    ? `<div class="detail-wav-request-actions">
            ${canSend
    ? `<button type="button" class="btn btn-primary detail-wav-send-btn" id="detail-wav-send-btn">
                  <i class="fa-solid fa-paper-plane"></i> Send WAV request for me
                </button>
                <p class="detail-wav-request-note">One click — Radio Now emails ${Utils.escapeHtml(contactLine)} from <strong>${Utils.escapeHtml(fromEmail)}</strong> with your DJ name, station, show, and email so they can reply to you.</p>`
    : `<p class="detail-wav-request-note"><a href="dj-dashboard.html">Sign in with your DJ account</a> to send a WAV request in one click.</p>`}
            <p class="detail-wav-request-status hidden" id="detail-wav-request-status" role="status"></p>
          </div>`
    : `<p class="detail-wav-request-note">No contact email on file for this track — reach out to ${contactLine}.</p>`}
      </div>`;
  }

  function bindWavRequestButton(song) {
    const sendBtn = document.getElementById('detail-wav-send-btn');
    const status = document.getElementById('detail-wav-request-status');

    const showStatus = (message) => {
      if (!status) return;
      status.classList.remove('hidden');
      status.textContent = message;
    };

    sendBtn?.addEventListener('click', async () => {
      const original = sendBtn.innerHTML;
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
      try {
        const result = await WavRequest.sendForMe(song);
        showStatus(`Sent to ${result.sentTo}. The artist can reply directly to you at ${result.replyTo || 'your DJ email'}.`);
      } catch (err) {
        alert(err.message || 'Could not send WAV request.');
      } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = original;
      }
    });
  }

  function renderPlayButton(song) {
    if (!AudioPlayer.hasPreview(song)) {
      return '<span class="muted">No preview available</span>';
    }
    const isPlaying = currentPreviewId === song.id;
    return `
      <button type="button" class="btn btn-secondary preview-trigger-btn ${isPlaying ? 'is-playing' : ''}" data-id="${Utils.escapeHtml(song.id)}">
        <i class="fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}"></i>
        ${isPlaying ? 'Playing' : 'Play Preview'}
      </button>`;
  }

  function hideDetailPanel() {
    detailPanel.classList.add('hidden');
    detailPanel.innerHTML = '';
  }

  function renderSpotlightAdminHtml(song) {
    if (typeof SpotlightAdmin === 'undefined' || !SpotlightAdmin.canManage()) return '';
    const featured = SpotlightAdmin.isSongInSpotlight(song);
    const until = String(song.spotlightUntil || '').trim();
    const note = featured
      ? (until ? `In spotlight until ${until}. Click to remove.` : 'In spotlight. Click to remove.')
      : `Adds to spotlight for ${CONFIG.spotlight?.defaultDays || 30} days. Only you see this button.`;
    return `
        <div class="detail-spotlight-admin">
          <button type="button" class="btn btn-secondary detail-spotlight-btn${featured ? ' active' : ''}" id="detail-spotlight-btn">
            <i class="fa-solid fa-star"></i> ${featured ? 'Remove from Spotlight' : 'Add to Spotlight'}
          </button>
          <p class="detail-spotlight-note">${Utils.escapeHtml(note)}</p>
        </div>`;
  }

  async function refreshSongsAfterSpotlight(song) {
    allSongs = await RadioDB.getAllSongs();
    const artists = Utils.groupSongsByArtist(allSongs);
    artist = artists.find((entry) => entry.slug === getArtistSlug());
    if (!artist) return;
    syncQueuesFromSongs();
    renderProfile();
    renderSongs();
    const refreshed = allSongs.find((s) => s.id === song.id) || song;
    renderDetailPanel(refreshed, false);
  }

  function bindSpotlightAdminButton(song) {
    const btn = document.getElementById('detail-spotlight-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
      try {
        const result = await SpotlightAdmin.toggleSong(song);
        await refreshSongsAfterSpotlight(song);
        if (result.added) {
          detailPanel.querySelector('.detail-spotlight-note')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } catch (err) {
        alert(err.message || 'Could not update spotlight.');
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  function renderDetailPanel(song, shouldScroll = true) {
    const inQueue = queue.some((q) => q.id === song.id);
    const inDownload = downloadQueue.some((d) => d.id === song.id);
    const albumLine = song.albumName
      ? `<p class="detail-album"><i class="fa-solid fa-compact-disc" aria-hidden="true"></i> ${Utils.escapeHtml(song.albumName)}</p>`
      : '';

    detailPanel.innerHTML = `
      <div class="detail-panel-inner">
        <div class="detail-panel-header">
          <div class="detail-hero">
            <div class="detail-cover">${renderCover(song)}</div>
            <div class="detail-heading">
              <h2>${Utils.escapeHtml(song.songTitle)}</h2>
              <p class="detail-artist">${Utils.escapeHtml(song.artistName)}</p>
              ${albumLine}
              <div class="song-tags">
                ${song.year ? `<span>${Utils.escapeHtml(song.year)}</span>` : ''}
                ${song.songTime ? `<span>${Utils.escapeHtml(song.songTime)}</span>` : ''}
                ${song.musicStyle ? `<span>${Utils.escapeHtml(song.musicStyle)}</span>` : ''}
              </div>
            </div>
          </div>
          <button class="btn btn-ghost detail-close-btn" id="detail-close-btn" aria-label="Close details">
            <i class="fa-solid fa-xmark"></i> Close
          </button>
        </div>
        <div class="detail-preview">
          ${renderPlayButton(song)}
        </div>
        <div class="detail-queue-actions">
          <button class="btn btn-secondary add-download-detail-btn ${inDownload ? 'active' : ''}" data-id="${Utils.escapeHtml(song.id)}">
            <i class="fa-solid fa-download"></i> ${inDownload ? 'In Download Queue' : 'Add to Download Queue'}
          </button>
          <button class="btn btn-primary add-queue-detail-btn" data-id="${Utils.escapeHtml(song.id)}">
            <i class="fa-solid fa-list-ul"></i> ${inQueue ? 'In DJ Queue' : 'Add to DJ Queue'}
          </button>
        </div>
        ${renderSpotlightAdminHtml(song)}
        <div class="detail-description">
          <label>Description</label>
          <p>${Utils.escapeHtml(song.description || '—')}</p>
        </div>
        <div class="detail-grid">
          <div><label>Band Members</label>${OneSheet.renderBandMembersHtml(song)}</div>
          <div><label>Songwriter</label><p>${Utils.escapeHtml(song.songwriter || '—')}</p></div>
          <div><label>Featured Artist</label><p>${Utils.escapeHtml(song.featuredArtist || '—')}</p></div>
          <div><label>Record Label</label><p>${Utils.escapeHtml(song.recordLabel || '—')}</p></div>
          <div><label>Contact E-Mail</label><p>${renderContactEmailHtml(song.contactEmail)}</p></div>
          <div><label>Website</label><p>${song.website ? `<a href="${Utils.escapeHtml(song.website)}" target="_blank" rel="noopener">${Utils.escapeHtml(song.website)}</a>` : '—'}</p></div>
        </div>
        ${renderWavRequestHtml(song)}
        <div class="detail-downloads">
          <button class="btn btn-secondary download-onesheet-btn" type="button">
            <i class="fa-solid fa-file-pdf"></i> Download One-Sheet
          </button>
          ${song.mp3 ? `<button type="button" class="btn btn-secondary download-track-btn" data-format="mp3"><i class="fa-solid fa-download"></i> MP3</button>` : ''}
        </div>
        <p class="detail-report-wrap">
          <a href="dj-help.html?${new URLSearchParams({ type: 'song', artist: song.artistName || '', song: song.songTitle || '' }).toString()}" class="detail-report-link">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            Report wrong info for this song
          </a>
        </p>
        <div class="detail-panel-footer">
          <button class="btn btn-ghost detail-close-btn detail-close-btn--bottom" aria-label="Close details">
            <i class="fa-solid fa-xmark"></i> Close
          </button>
        </div>
      </div>`;

    detailPanel.querySelectorAll('.detail-close-btn').forEach((btn) => {
      btn.addEventListener('click', closeDetail);
    });
    detailPanel.querySelector('.add-queue-detail-btn').addEventListener('click', () => {
      toggleQueue(song.id);
      renderDetailPanel(allSongs.find((s) => s.id === song.id));
    });
    detailPanel.querySelector('.add-download-detail-btn').addEventListener('click', () => {
      toggleDownloadQueue(song.id);
      renderDetailPanel(allSongs.find((s) => s.id === song.id));
    });

    detailPanel.querySelectorAll('.download-track-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!song.mp3) return;
        RadioDB.triggerFileDownload(song.mp3, Utils.safeFilename(song.artistName, song.songTitle, 'mp3'));
        DjActivity.log(song, 'download_mp3', 'mp3');
      });
    });

    const downloadBtn = detailPanel.querySelector('.download-onesheet-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const originalHtml = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF…';
        try {
          await OneSheet.downloadOneSheet(song);
          DjActivity.log(song, 'download_onesheet', 'pdf');
        } catch (err) {
          alert(err.message || 'Could not download one-sheet PDF.');
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = originalHtml;
        }
      });
    }

    detailPanel.querySelectorAll('.preview-trigger-btn').forEach((btn) => {
      btn.addEventListener('click', () => playSongPreview(btn.dataset.id));
    });
    bindSpotlightAdminButton(song);
    bindWavRequestButton(song);
    detailPanel.classList.remove('hidden');
    if (shouldScroll) detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openDetail(id) {
    if (expandedDetailId === id) {
      closeDetail();
      return;
    }

    const song = allSongs.find((s) => s.id === id);
    if (!song) return;

    expandedDetailId = id;
    renderDetailPanel(song);
    renderSongs();
  }

  function closeDetail() {
    expandedDetailId = null;
    hideDetailPanel();
    renderSongs();
  }

  function refreshDetailPanelIfOpen() {
    if (!expandedDetailId) return;
    const song = allSongs.find((s) => s.id === expandedDetailId);
    if (song) renderDetailPanel(song, false);
    else closeDetail();
  }

  function renderCover(song) {
    const url = Utils.resolveCoverUrl(song);
    if (url) {
      return `<img src="${Utils.escapeHtml(url)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
    }
    return '<div class="cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>';
  }

  function artistQueuedCount() {
    if (!artist) return 0;
    return artist.songs.filter((song) => queue.some((q) => q.id === song.id)).length;
  }

  function allArtistSongsQueued() {
    return artist && artist.songs.length > 0 && artistQueuedCount() === artist.songs.length;
  }

  async function playSongPreview(id, fromQueueIndex = -1) {
    const song = allSongs.find((s) => s.id === id);
    if (!song || !AudioPlayer.hasPreview(song)) return;

    currentPreviewId = id;
    if (fromQueueIndex >= 0) queuePlayIndex = fromQueueIndex;

    nowPlayingTitle.textContent = song.songTitle;
    nowPlayingArtist.textContent = song.artistName;

    nowPlaying.classList.remove('hidden');

    const started = await AudioPlayer.playSong(song);
    if (!started) {
      console.warn('Preview failed:', song.songTitle);
    }

    renderSongs();
    refreshDetailPanelIfOpen();
  }

  function renderProfile() {
    if (!artist) return;

    const queued = artistQueuedCount();
    document.title = `${artist.name} — Radio Now`;

    artistProfile.innerHTML = `
      <div class="artist-profile-hero">
        <div class="artist-profile-cover">${renderCover(artist.coverSong)}</div>
        <div class="artist-profile-info">
          <div class="artist-profile-title-row">
            <h1>${Utils.escapeHtml(artist.name)}</h1>
            ${DjFavorites.buttonHtml(artist.name, 'artist-favorite-btn artist-favorite-btn--profile')}
          </div>
          <p class="artist-profile-meta">
            <span>${artist.songCount} song${artist.songCount === 1 ? '' : 's'}</span>
            ${artist.maxYear ? `<span>Latest release ${artist.maxYear}</span>` : ''}
            <span>${queued} in DJ queue</span>
          </p>
          ${artist.website ? `<a class="artist-website" href="${Utils.escapeHtml(artist.website)}" target="_blank" rel="noopener">${Utils.escapeHtml(artist.website)}</a>` : ''}
          <div class="artist-profile-actions">
            <button type="button" class="btn btn-primary" id="queue-all-btn">
              <i class="fa-solid fa-list-ul"></i>
              ${allArtistSongsQueued() ? 'All Songs Queued' : 'Queue All Songs'}
            </button>
            ${artist.songs.some((s) => AudioPlayer.hasPreview(s)) ? `
              <button type="button" class="btn btn-secondary" id="play-first-btn">
                <i class="fa-solid fa-play"></i> Play Newest
              </button>` : ''}
          </div>
        </div>
      </div>`;

    artistProfile.querySelector('#queue-all-btn').addEventListener('click', queueAllSongs);

    const playFirstBtn = artistProfile.querySelector('#play-first-btn');
    if (playFirstBtn && artist.songs[0]) {
      playFirstBtn.addEventListener('click', () => playSongPreview(artist.songs[0].id));
    }

    DjFavorites.bindButtons(artistProfile, () => renderProfile());
  }

  function renderSongRow(song) {
    const inQueue = queue.some((q) => q.id === song.id);
    const inDownload = downloadQueue.some((d) => d.id === song.id);
    const isPlaying = currentPreviewId === song.id;
    const isOpen = expandedDetailId === song.id;
    const hasPreview = AudioPlayer.hasPreview(song);
    const albumLine = song.albumName
      ? `<span class="profile-song-album">${Utils.escapeHtml(song.albumName)}</span>`
      : '';

    return `
      <div class="profile-song-row ${isOpen ? 'is-open' : ''} ${isPlaying ? 'is-previewing' : ''} ${inQueue ? 'in-queue' : ''} ${inDownload ? 'in-download' : ''}" data-id="${Utils.escapeHtml(song.id)}">
        <div class="profile-song-cover">${renderCover(song)}</div>
        <div class="profile-song-meta">
          <strong>${Utils.escapeHtml(song.songTitle)}</strong>
          ${albumLine}
          <span>
            ${song.year ? Utils.escapeHtml(song.year) : ''}
            ${song.musicStyle ? ` · ${Utils.escapeHtml(song.musicStyle)}` : ''}
            ${song.songTime ? ` · ${Utils.escapeHtml(song.songTime)}` : ''}
          </span>
        </div>
        <div class="profile-song-actions">
          <button type="button" class="btn btn-primary add-queue-btn ${inQueue ? 'active' : ''}" data-id="${Utils.escapeHtml(song.id)}">
            <i class="fa-solid ${inQueue ? 'fa-check' : 'fa-plus'}"></i> ${inQueue ? 'Queued' : 'Queue'}
          </button>
          <button type="button" class="btn btn-secondary add-download-row-btn ${inDownload ? 'active' : ''}" data-id="${Utils.escapeHtml(song.id)}">
            <i class="fa-solid fa-download"></i> ${inDownload ? 'In Downloads' : 'Download'}
          </button>
          ${hasPreview ? `
            <button type="button" class="btn btn-secondary preview-trigger-btn ${isPlaying ? 'is-playing' : ''}" data-id="${Utils.escapeHtml(song.id)}">
              <i class="fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}"></i> Play
            </button>` : ''}
          <button type="button" class="btn btn-secondary details-btn ${isOpen ? 'active' : ''}" data-id="${Utils.escapeHtml(song.id)}">
            Song Details
          </button>
        </div>
      </div>`;
  }

  function bindSongRows(root) {
    if (!root) return;

    root.querySelectorAll('.preview-trigger-btn').forEach((btn) => {
      btn.addEventListener('click', () => playSongPreview(btn.dataset.id));
    });

    root.querySelectorAll('.details-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDetail(btn.dataset.id));
    });

    root.querySelectorAll('.add-queue-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleQueue(btn.dataset.id));
    });

    root.querySelectorAll('.add-download-row-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleDownloadQueue(btn.dataset.id));
    });
  }

  function renderReleaseSection(title, icon, songs, note) {
    if (!songs.length) return '';

    return `
      <section class="profile-release-section">
        <div class="profile-release-header">
          <h3><i class="fa-solid ${icon}" aria-hidden="true"></i> ${title} <span class="profile-songs-count">(${songs.length})</span></h3>
          ${note ? `<p class="profile-songs-note">${note}</p>` : ''}
        </div>
        <div class="profile-song-list">
          ${songs.map((song) => renderSongRow(song)).join('')}
        </div>
      </section>`;
  }

  function renderAlbumSection(album) {
    return `
      <section class="profile-release-section profile-album-section">
        <div class="profile-release-header">
          <h3><i class="fa-solid fa-compact-disc" aria-hidden="true"></i> Album: ${Utils.escapeHtml(album.name)} <span class="profile-songs-count">(${album.songs.length})</span></h3>
        </div>
        <div class="profile-song-list">
          ${album.songs.map((song) => renderSongRow(song)).join('')}
        </div>
      </section>`;
  }

  function renderSongs() {
    if (!artist) return;

    const catalog = Utils.groupArtistCatalog(artist.songs);
    const albumSections = catalog.albums.map((album) => renderAlbumSection(album)).join('');
    const singlesSection = renderReleaseSection(
      'Singles',
      'fa-music',
      catalog.singles,
      'Standalone singles and tracks released one at a time.',
    );

    artistSongs.innerHTML = `
      <div class="profile-songs-header">
        <h2>Catalog <span class="profile-songs-count">(${artist.songCount})</span></h2>
        <p class="profile-songs-note">Albums and singles — newest releases listed first.</p>
      </div>
      ${albumSections}
      ${singlesSection}`;

    renderProfile();
    bindSongRows(artistSongs);
  }

  function queueAllSongs() {
    if (!artist) return;

    artist.songs.forEach((song) => {
      if (!queue.some((q) => q.id === song.id)) queue.push(song);
    });

    saveQueue();
    renderQueue();
    renderSongs();
  }

  function toggleQueue(id) {
    const song = allSongs.find((s) => s.id === id);
    if (!song) return;

    const index = queue.findIndex((q) => q.id === id);
    if (index >= 0) queue.splice(index, 1);
    else queue.push(song);

    saveQueue();
    renderQueue();
    renderSongs();
  }

  function toggleDownloadQueue(id) {
    const song = allSongs.find((s) => s.id === id);
    if (!song) return;

    const index = downloadQueue.findIndex((d) => d.id === id);
    if (index >= 0) downloadQueue.splice(index, 1);
    else downloadQueue.push(song);

    saveDownloadQueue();
    renderDownloadQueue();
    renderSongs();
    downloadZipBtn.disabled = downloadQueue.length === 0;
  }

  function renderQueue() {
    if (!queue.length) {
      queueList.innerHTML = '';
      queueEmpty.classList.remove('hidden');
      playQueueBtn.disabled = true;
      return;
    }

    queueEmpty.classList.add('hidden');
    playQueueBtn.disabled = false;

    queueList.innerHTML = queue.map((song, index) => `
      <div class="queue-item" data-id="${Utils.escapeHtml(song.id)}">
        <span class="queue-index">${index + 1}</span>
        <div class="queue-cover">${renderCover(song)}</div>
        <div class="queue-meta">
          <strong>${Utils.escapeHtml(song.songTitle)}</strong>
          <span>${Utils.escapeHtml(song.artistName)}</span>
        </div>
        <div class="queue-item-actions">
          <button class="btn-icon play-one-btn" data-id="${Utils.escapeHtml(song.id)}" title="Play preview">
            <i class="fa-solid fa-play"></i>
          </button>
          <button class="btn-icon remove-queue-btn" data-id="${Utils.escapeHtml(song.id)}" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `).join('');

    queueList.querySelectorAll('.remove-queue-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleQueue(btn.dataset.id));
    });

    queueList.querySelectorAll('.play-one-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = queue.findIndex((s) => s.id === btn.dataset.id);
        playSongPreview(btn.dataset.id, index);
      });
    });
  }

  function renderDownloadQueue() {
    if (!downloadQueue.length) {
      downloadList.innerHTML = '';
      downloadEmpty.classList.remove('hidden');
      return;
    }

    downloadEmpty.classList.add('hidden');
    downloadList.innerHTML = downloadQueue.map((song, index) => `
      <div class="queue-item download-item" data-id="${Utils.escapeHtml(song.id)}">
        <span class="queue-index">${index + 1}</span>
        <div class="queue-cover">${renderCover(song)}</div>
        <div class="queue-meta">
          <strong>${Utils.escapeHtml(song.songTitle)}</strong>
          <span>${Utils.escapeHtml(song.artistName)}</span>
        </div>
        <div class="queue-item-actions">
          <button class="btn-icon remove-download-btn" data-id="${Utils.escapeHtml(song.id)}" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `).join('');

    downloadList.querySelectorAll('.remove-download-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleDownloadQueue(btn.dataset.id));
    });
  }

  async function playCurrentQueueTrack() {
    if (queuePlayIndex < 0 || queuePlayIndex >= queue.length) {
      currentPreviewId = null;
      nowPlaying.classList.add('hidden');
      renderSongs();
      return;
    }

    await playSongPreview(queue[queuePlayIndex].id, queuePlayIndex);
  }

  async function loadArtist() {
    const slug = getArtistSlug();
    artistProfile.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading artist…</p>
      </div>`;
    artistSongs.innerHTML = '';

    try {
      allSongs = await RadioDB.getAllSongs();
      const artists = Utils.groupSongsByArtist(allSongs);
      artist = artists.find((entry) => entry.slug === slug);

      if (!artist) {
        artistProfile.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <p>Artist not found. <a href="artists.html">Back to all artists</a></p>
          </div>`;
        return;
      }

      syncQueuesFromSongs();
      renderProfile();
      renderSongs();
    } catch (err) {
      artistProfile.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Failed to load artist: ${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  DjAuthUI.init({ onAuthenticated: showApp });
  SiteNav.bindLogout(logoutBtn, showLogin);

  clearQueueBtn.addEventListener('click', () => {
    queue = [];
    queuePlayIndex = -1;
    currentPreviewId = null;
    saveQueue();
    renderQueue();
    renderSongs();
    nowPlaying.classList.add('hidden');
  });

  clearDownloadBtn.addEventListener('click', () => {
    downloadQueue = [];
    saveDownloadQueue();
    renderDownloadQueue();
    renderSongs();
    downloadZipBtn.disabled = true;
  });

  downloadZipBtn.addEventListener('click', async () => {
    if (!downloadQueue.length) return;

    const total = downloadQueue.length;
    downloadZipBtn.disabled = true;
    downloadZipBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing 0/${total}…`;

    try {
      const zipFormat = 'mp3';
      await RadioDB.downloadZip(downloadQueue, zipFormat, (progress) => {
        if (progress.status === 'onesheet') {
          downloadZipBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Adding PDF one-sheets ${progress.current}/${progress.total}…`;
          return;
        }
        if (progress.status === 'zipping') {
          downloadZipBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating ZIP…';
          return;
        }
        if (progress.status === 'done') {
          downloadZipBtn.innerHTML = '<i class="fa-solid fa-check"></i> ZIP ready';
          return;
        }
        downloadZipBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing ${progress.current}/${progress.total}…`;
      });
      DjActivity.logMany(downloadQueue, 'downloaded', zipFormat);
    } catch (err) {
      alert(err.message);
    } finally {
      downloadZipBtn.disabled = downloadQueue.length === 0;
      downloadZipBtn.innerHTML = '<i class="fa-solid fa-file-zipper"></i> Download MP3 ZIP';
    }
  });

  playQueueBtn.addEventListener('click', () => {
    if (!queue.length) return;
    queuePlayIndex = 0;
    playCurrentQueueTrack();
  });

  skipQueueBtn.addEventListener('click', () => {
    if (!queue.length) return;
    queuePlayIndex += 1;
    if (queuePlayIndex >= queue.length) {
      queuePlayIndex = -1;
      currentPreviewId = null;
      nowPlaying.classList.add('hidden');
      renderSongs();
      return;
    }
    playCurrentQueueTrack();
  });

  if (isAuthenticated()) showApp();
  else showLogin();
})();