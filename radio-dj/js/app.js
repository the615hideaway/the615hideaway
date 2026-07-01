(function () {
  const isDemoMode = Demo.isActive();
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const searchInput = document.getElementById('search-input');
  const styleFilter = document.getElementById('style-filter');
  const yearFilter = document.getElementById('year-filter');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const catalogGrid = document.getElementById('catalog-grid');
  const spotlightList = document.getElementById('spotlight-list');
  const statQueue = document.getElementById('stat-queue');
  const statDownload = document.getElementById('stat-download');
  const connectionBanner = document.getElementById('connection-banner');
  const queueList = document.getElementById('queue-list');
  const queueEmpty = document.getElementById('queue-empty');
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  const downloadList = document.getElementById('download-list');
  const downloadEmpty = document.getElementById('download-empty');
  const clearDownloadBtn = document.getElementById('clear-download-btn');
  const downloadZipBtn = document.getElementById('download-zip-btn');
  const detailPanel = document.getElementById('detail-panel');
  const catalogArtistBrowser = document.getElementById('catalog-artist-browser');
  const catalogNextSteps = document.getElementById('catalog-next-steps');
  const nowPlaying = document.getElementById('now-playing');

  const nowPlayingTitle = document.getElementById('now-playing-title');
  const nowPlayingArtist = document.getElementById('now-playing-artist');
  const playQueueBtn = document.getElementById('play-queue-btn');
  const skipQueueBtn = document.getElementById('skip-queue-btn');

  let allSongs = [];
  let filteredSongs = [];
  let queue = [];
  let downloadQueue = [];
  let queuePlayIndex = -1;
  let expandedDetailId = null;
  let currentPreviewId = null;
  const catalogRecentLimit = CONFIG.catalogPageSize || 20;

  function isAuthenticated() {
    return DjAuth.isAuthenticated();
  }

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    if (isDemoMode) {
      Demo.applyMode();
      Demo.bindExit(logoutBtn);
      SiteNav.init('catalog');
      TurnkeyPitch.mountCatalogPromo();
    } else {
      DjAuthUI.updateWelcome();
      SiteNav.init('catalog');
      TurnkeyPitch.hideAppPromo();
    }
    updateDownloadSetupNotice();
    loadQueuesFromStorage();
    if (typeof SpotlightAdmin !== 'undefined' && SpotlightAdmin.canManage()) {
      SpotlightAdmin.ensureLoaded().catch(() => {});
    }
    loadSongs();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
    if (!isDemoMode) TurnkeyPitch.mountCatalogPromo();
  }

  function triggerTrackedDownload(song, format) {
    if (isDemoMode) {
      alert('Sign up for a free DJ account to download MP3 files.');
      return;
    }
    if (!song.mp3) return;
    RadioDB.triggerFileDownload(song.mp3, Utils.safeFilename(song.artistName, song.songTitle, 'mp3'));
    DjActivity.log(song, 'download_mp3', 'mp3');
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

  function saveQueue() {
    localStorage.setItem(CONFIG.queueKey, JSON.stringify(queue.map((s) => s.id)));
  }

  function saveDownloadQueue() {
    localStorage.setItem(CONFIG.downloadQueueKey, JSON.stringify(downloadQueue.map((s) => s.id)));
  }

  function loadQueuesFromStorage() {
    try {
      const ids = JSON.parse(localStorage.getItem(CONFIG.queueKey) || '[]');
      queue = ids.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    } catch {
      queue = [];
    }

    try {
      const ids = JSON.parse(localStorage.getItem(CONFIG.downloadQueueKey) || '[]');
      downloadQueue = ids.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    } catch {
      downloadQueue = [];
    }
  }

  function renderCover(song) {
    const url = Utils.resolveCoverUrl(song);
    if (url) {
      return `<img src="${Utils.escapeHtml(url)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
    }
    return '<div class="cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>';
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

    renderCatalog();
    refreshDetailPanelIfOpen();
  }

  function bindPreviewButtons(root) {
    root.querySelectorAll('.preview-trigger-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSongPreview(btn.dataset.id);
      });
    });
  }

  function updateDownloadSetupNotice() {
    const notice = document.getElementById('download-setup-notice');
    if (!notice) return;
    notice.classList.toggle('hidden', RadioDB.isScriptConfigured());
  }

  function updateStats() {
    if (statQueue) statQueue.textContent = queue.length;
    if (statDownload) statDownload.textContent = downloadQueue.length;
    downloadZipBtn.disabled = downloadQueue.length === 0;
  }

  function populateFilters() {
    const styles = [...new Set(allSongs.map((s) => s.musicStyle).filter(Boolean))].sort();
    const years = [...new Set(allSongs.map((s) => s.year).filter(Boolean))].sort((a, b) => b - a);

    styleFilter.innerHTML = '<option value="">All styles</option>' +
      styles.map((s) => `<option value="${Utils.escapeHtml(s)}">${Utils.escapeHtml(s)}</option>`).join('');

    yearFilter.innerHTML = '<option value="">All years</option>' +
      years.map((y) => `<option value="${Utils.escapeHtml(y)}">${Utils.escapeHtml(y)}</option>`).join('');
  }

  function filterSongs() {
    const q = searchInput.value.trim().toLowerCase();
    const style = styleFilter.value;
    const year = yearFilter.value;

    filteredSongs = allSongs.filter((song) => {
      const haystack = [
        song.artistName,
        song.songTitle,
        song.musicStyle,
        song.songwriter,
        song.recordLabel,
        song.bandMembers,
        song.description,
      ].join(' ').toLowerCase();

      const matchesSearch = !q || haystack.includes(q);
      const matchesStyle = !style || song.musicStyle === style;
      const matchesYear = !year || song.year === year;
      return matchesSearch && matchesStyle && matchesYear;
    });

    filteredSongs = Spotlight.sortSongs(filteredSongs);
    filteredSongs = DjFavorites.sortSongs(filteredSongs);

    if (expandedDetailId && !filteredSongs.some((s) => s.id === expandedDetailId)) {
      expandedDetailId = null;
      hideDetailPanel();
    }

    renderCatalog();
    renderArtistBrowser();
    updateStats();
  }

  function renderArtistBrowser() {
    if (!catalogArtistBrowser) return;

    const artists = Utils.groupSongsByArtist(allSongs);
    if (!artists.length) {
      catalogArtistBrowser.classList.add('hidden');
      catalogArtistBrowser.innerHTML = '';
      return;
    }

    catalogArtistBrowser.classList.remove('hidden');
    catalogArtistBrowser.innerHTML = `
      <div class="catalog-artist-browser-inner">
        <div class="catalog-artist-browser-copy">
          <h2><i class="fa-solid fa-users" aria-hidden="true"></i> Browse by Artist</h2>
          <p>See what’s new below, then pick an artist to dig into back catalog, albums, and singles for your show.</p>
        </div>
        <div class="catalog-artist-browser-picker">
          <label for="catalog-artist-select">Choose an artist</label>
          <div class="catalog-artist-browser-controls">
            <select id="catalog-artist-select" class="catalog-artist-select" aria-label="Select an artist">
              <option value="">Choose an artist…</option>
              ${artists.map((entry) => `
                <option value="${Utils.escapeHtml(entry.slug)}">${Utils.escapeHtml(entry.name)}</option>
              `).join('')}
            </select>
            <a href="artists.html" class="btn btn-secondary btn-lg">
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              All Artists
            </a>
          </div>
        </div>
      </div>`;

    const select = catalogArtistBrowser.querySelector('#catalog-artist-select');
    select?.addEventListener('change', () => {
      const slug = select.value;
      if (!slug) return;
      window.location.href = `artist.html?slug=${encodeURIComponent(slug)}`;
    });
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

  function bindSpotlightAdminButton(song) {
    const btn = document.getElementById('detail-spotlight-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
      try {
        const result = await SpotlightAdmin.toggleSong(song);
        await loadSongs();
        const refreshed = allSongs.find((s) => s.id === song.id) || song;
        renderDetailPanel(refreshed, false);
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

  function renderArtistCatalogLink(song) {
    const artistName = String(song.artistName || '').trim();
    if (!artistName) return '';
    const href = Utils.artistPageHref(artistName, allSongs);
    return `
        <div class="detail-artist-actions">
          <a href="${Utils.escapeHtml(href)}" class="btn btn-secondary detail-artist-page-btn">
            <i class="fa-solid fa-user-music" aria-hidden="true"></i>
            Browse ${Utils.escapeHtml(artistName)} catalog
          </a>
        </div>`;
  }

  function renderDetailReportLink(song) {
    if (isDemoMode || !isAuthenticated()) return '';
    const params = new URLSearchParams({
      type: 'song',
      artist: song.artistName || '',
      song: song.songTitle || '',
    });
    return `
        <p class="detail-report-wrap">
          <a href="dj-help.html?${params.toString()}" class="detail-report-link">
            <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
            Report wrong info for this song
          </a>
        </p>`;
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
        ${renderArtistCatalogLink(song)}
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
          ${isDemoMode ? Demo.salesNoteHtml() : (isAuthenticated() ? '' : TurnkeyPitch.detailNoteHtml(false))}
          <button class="btn btn-secondary download-onesheet-btn" type="button">
            <i class="fa-solid fa-file-pdf"></i> Download One-Sheet
          </button>
          ${song.mp3 ? `<button type="button" class="btn btn-secondary download-track-btn" data-format="mp3"><i class="fa-solid fa-download"></i> MP3</button>` : ''}
        </div>
        ${renderDetailReportLink(song)}
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
      btn.addEventListener('click', () => triggerTrackedDownload(song, 'mp3'));
    });

    const downloadBtn = detailPanel.querySelector('.download-onesheet-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async () => {
        const originalHtml = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating PDF…';
        try {
          await OneSheet.downloadOneSheet(song);
          if (!isDemoMode) DjActivity.log(song, 'download_onesheet', 'pdf');
        } catch (err) {
          alert(err.message || 'Could not download one-sheet PDF.');
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.innerHTML = originalHtml;
        }
      });
    }

    bindPreviewButtons(detailPanel);
    bindWavRequestButton(song);
    bindSpotlightAdminButton(song);
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
    renderDetailPanel(song, false);
    renderCatalog();
  }

  function closeDetail() {
    expandedDetailId = null;
    hideDetailPanel();
    renderCatalog();
  }

  function refreshDetailPanelIfOpen() {
    if (!expandedDetailId) return;
    const song = allSongs.find((s) => s.id === expandedDetailId);
    if (song) renderDetailPanel(song, false);
    else closeDetail();
  }

  function renderSpotlightCard(song) {
    const isPlaying = currentPreviewId === song.id;
    const isOpen = expandedDetailId === song.id;
    const badge = Spotlight.badge(song);
    const hasPreview = AudioPlayer.hasPreview(song);

    return `
      <article class="spotlight-card ${isOpen ? 'is-open' : ''} ${isPlaying ? 'is-previewing' : ''}" data-id="${Utils.escapeHtml(song.id)}">
        <div class="spotlight-card-cover" aria-hidden="true">${renderCover(song)}</div>
        <div class="spotlight-card-body">
          ${badge ? `<span class="spotlight-card-badge">${Utils.escapeHtml(badge)}</span>` : ''}
          <p class="spotlight-card-artist">${Utils.escapeHtml(song.artistName || 'Unknown Artist')}</p>
          <p class="spotlight-card-title">${Utils.escapeHtml(song.songTitle || 'Untitled')}</p>
        </div>
        <div class="spotlight-card-actions">
          ${hasPreview ? `
            <button
              type="button"
              class="btn btn-secondary btn-sm preview-trigger-btn ${isPlaying ? 'is-playing' : ''}"
              data-id="${Utils.escapeHtml(song.id)}"
              aria-label="${isPlaying ? 'Playing preview' : 'Play preview'}"
            >
              <i class="fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}" aria-hidden="true"></i>
              ${isPlaying ? 'Playing' : 'Play'}
            </button>` : `
            <span class="spotlight-card-no-preview">No preview</span>`}
          <button
            type="button"
            class="btn btn-secondary btn-sm details-btn ${isOpen ? 'active' : ''}"
            data-id="${Utils.escapeHtml(song.id)}"
          >
            Details
          </button>
        </div>
      </article>`;
  }

  function initSpotlightDelegation() {
    if (!spotlightList || spotlightList.dataset.delegationBound) return;
    spotlightList.dataset.delegationBound = '1';
    spotlightList.addEventListener('click', (event) => {
      const previewBtn = event.target.closest('.preview-trigger-btn');
      if (previewBtn?.dataset.id) {
        event.preventDefault();
        playSongPreview(previewBtn.dataset.id);
        return;
      }
      const detailsBtn = event.target.closest('.details-btn');
      if (detailsBtn?.dataset.id) {
        event.preventDefault();
        openDetail(detailsBtn.dataset.id);
      }
    });
  }

  function renderCatalogRow(song) {
    const isPlaying = currentPreviewId === song.id;
    const isOpen = expandedDetailId === song.id;
    const inQueue = queue.some((q) => q.id === song.id);
    const inDownload = downloadQueue.some((d) => d.id === song.id);
    const badge = Spotlight.badge(song);
    const hasPreview = AudioPlayer.hasPreview(song);
    const albumLine = song.albumName
      ? `<p class="catalog-row-album">${Utils.escapeHtml(song.albumName)}</p>`
      : '';

    return `
      <article class="catalog-row ${isOpen ? 'is-open' : ''} ${isPlaying ? 'is-previewing' : ''} ${inQueue ? 'in-queue' : ''} ${inDownload ? 'in-download' : ''}" data-id="${Utils.escapeHtml(song.id)}">
        <div class="catalog-row-cover" aria-hidden="true">${renderCover(song)}</div>
        <div class="catalog-row-main">
          <p class="catalog-row-artist">${Utils.escapeHtml(song.artistName || 'Unknown Artist')}</p>
          <p class="catalog-row-title">${Utils.escapeHtml(song.songTitle || 'Untitled')}</p>
          ${albumLine}
          ${badge ? `<span class="catalog-row-badge">${Utils.escapeHtml(badge)}</span>` : ''}
        </div>
        <div class="catalog-row-actions">
          <button
            type="button"
            class="btn btn-primary add-queue-row-btn ${inQueue ? 'active' : ''}"
            data-id="${Utils.escapeHtml(song.id)}"
          >
            <i class="fa-solid ${inQueue ? 'fa-check' : 'fa-plus'}" aria-hidden="true"></i>
            ${inQueue ? 'Queued' : 'Queue'}
          </button>
          <button
            type="button"
            class="btn btn-secondary add-download-row-btn ${inDownload ? 'active' : ''}"
            data-id="${Utils.escapeHtml(song.id)}"
          >
            <i class="fa-solid fa-download" aria-hidden="true"></i>
            ${inDownload ? 'In Downloads' : 'Download'}
          </button>
          ${hasPreview ? `
            <button
              type="button"
              class="btn btn-secondary preview-trigger-btn ${isPlaying ? 'is-playing' : ''}"
              data-id="${Utils.escapeHtml(song.id)}"
              title="${isPlaying ? 'Playing preview' : 'Play preview'}"
              aria-label="${isPlaying ? 'Playing preview' : 'Play preview'}"
            >
              <i class="fa-solid ${isPlaying ? 'fa-volume-high' : 'fa-play'}" aria-hidden="true"></i>
              ${isPlaying ? 'Playing' : 'Play'}
            </button>` : ''}
          <button
            type="button"
            class="btn btn-secondary details-btn ${isOpen ? 'active' : ''}"
            data-id="${Utils.escapeHtml(song.id)}"
          >
            Song Details
          </button>
        </div>
      </article>`;
  }

  function bindCatalogRows(root) {
    if (!root) return;

    root.querySelectorAll('.details-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        openDetail(btn.dataset.id);
      });
    });

    root.querySelectorAll('.add-queue-row-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleQueue(btn.dataset.id);
      });
    });

    root.querySelectorAll('.add-download-row-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleDownloadQueue(btn.dataset.id);
      });
    });

    bindPreviewButtons(root);
  }

  function updateCatalogNextSteps(show) {
    if (!catalogNextSteps) return;
    catalogNextSteps.classList.toggle('hidden', !show);
  }

  function bindCatalogNextSteps() {
    const scrollBtn = document.getElementById('catalog-scroll-to-artists-btn');
    scrollBtn?.addEventListener('click', () => {
      catalogArtistBrowser?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const select = document.getElementById('catalog-artist-select');
      select?.focus();
    });
  }

  function getSpotlightSongs() {
    const maxSpotlightSlots = CONFIG.spotlight?.maxSlots || 20;
    return allSongs
      .filter((song) => Spotlight.score(song) > 0)
      .sort((a, b) => Spotlight.score(b) - Spotlight.score(a))
      .slice(0, maxSpotlightSlots);
  }

  function renderSpotlightSection(spotlightSongs) {
    if (!spotlightList) return;

    if (spotlightSongs.length) {
      spotlightList.classList.remove('hidden');
      spotlightList.innerHTML = `
        <div class="catalog-spotlight-header">
          <h2><i class="fa-solid fa-star" aria-hidden="true"></i> Spotlight</h2>
          <p class="catalog-spotlight-note">Featured on Radio Now — ${spotlightSongs.length} hand-picked release${spotlightSongs.length === 1 ? '' : 's'} for DJs</p>
        </div>
        <div class="spotlight-grid" role="list">
          ${spotlightSongs.map((song) => renderSpotlightCard(song)).join('')}
        </div>`;
      return;
    }

    spotlightList.classList.add('hidden');
    spotlightList.innerHTML = '';
  }

  function renderCatalog() {
    const spotlightSongs = getSpotlightSongs();
    renderSpotlightSection(spotlightSongs);

    if (!filteredSongs.length) {
      updateCatalogNextSteps(false);
      catalogGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-music"></i>
          <p>No songs match your search.</p>
        </div>`;
      return;
    }

    updateCatalogNextSteps(true);

    const catalogSongs = [...filteredSongs.filter((song) => Spotlight.score(song) === 0)]
      .sort((a, b) => Utils.compareSongsByReleaseDate(a, b))
      .slice(0, catalogRecentLimit);

    if (catalogSongs.length) {
      catalogGrid.innerHTML = `
        <div class="catalog-list-header">
          <h2>Latest Releases</h2>
          <p class="catalog-list-note">Showing the ${catalogSongs.length} most recent tracks by release date. Browse artist pages for full back catalog.</p>
        </div>
        <div class="catalog-list-inner">
          ${catalogSongs.map((song) => renderCatalogRow(song)).join('')}
        </div>`;
    } else {
      catalogGrid.innerHTML = spotlightSongs.length
        ? ''
        : `
        <div class="empty-state">
          <i class="fa-solid fa-music"></i>
          <p>No songs match your search.</p>
        </div>`;
    }

    bindCatalogRows(catalogGrid);
  }

  function toggleQueue(id) {
    const song = allSongs.find((s) => s.id === id);
    if (!song) return;

    const index = queue.findIndex((q) => q.id === id);
    if (index >= 0) queue.splice(index, 1);
    else queue.push(song);

    saveQueue();
    renderQueue();
    renderCatalog();
    refreshDetailPanelIfOpen();
    updateStats();
  }

  function toggleDownloadQueue(id) {
    const song = allSongs.find((s) => s.id === id);
    if (!song) return;

    const index = downloadQueue.findIndex((d) => d.id === id);
    if (index >= 0) downloadQueue.splice(index, 1);
    else downloadQueue.push(song);

    saveDownloadQueue();
    renderDownloadQueue();
    renderCatalog();
    refreshDetailPanelIfOpen();
    updateStats();
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
      renderCatalog();
      return;
    }

    await playSongPreview(queue[queuePlayIndex].id, queuePlayIndex);
  }

  async function loadSongs() {
    catalogGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading catalog…</p>
      </div>`;

    try {
      allSongs = await RadioDB.getAllSongs();
      connectionBanner.classList.add('hidden');
      connectionBanner.innerHTML = '';
      populateFilters();
      syncQueuesWithStorage();
      filterSongs();
      renderArtistBrowser();

    } catch (err) {
      connectionBanner.className = 'connection-banner error';
      connectionBanner.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><strong>Catalog unavailable.</strong> ${Utils.escapeHtml(err.message)}</div>`;
      connectionBanner.classList.remove('hidden');
      catalogGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Failed to load catalog: ${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  function syncQueuesWithStorage() {
    const storedQueueIds = JSON.parse(localStorage.getItem(CONFIG.queueKey) || '[]');
    queue = storedQueueIds.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    renderQueue();

    const storedDownloadIds = JSON.parse(localStorage.getItem(CONFIG.downloadQueueKey) || '[]');
    downloadQueue = storedDownloadIds.map((id) => allSongs.find((s) => s.id === id)).filter(Boolean);
    renderDownloadQueue();
  }

  bindCatalogNextSteps();
  initSpotlightDelegation();

  if (isDemoMode) {
    showApp();
  } else {
    const authUi = DjAuthUI.init({ onAuthenticated: showApp });
    SiteNav.bindLogout(logoutBtn, showLogin);
    DjBoot.ready().then(() => {
      authUi.showBootMessage(showApp);
      if (DjAuth.isAuthenticated()) showApp();
      else showLogin();
    });
  }

  searchInput.addEventListener('input', Utils.debounce(filterSongs, 180));
  styleFilter.addEventListener('change', filterSongs);
  yearFilter.addEventListener('change', filterSongs);
  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    styleFilter.value = '';
    yearFilter.value = '';
    filterSongs();
  });

  clearQueueBtn.addEventListener('click', () => {
    queue = [];
    queuePlayIndex = -1;
    currentPreviewId = null;
    saveQueue();
    renderQueue();
    renderCatalog();
    updateStats();
    nowPlaying.classList.add('hidden');
  });

  clearDownloadBtn.addEventListener('click', () => {
    downloadQueue = [];
    saveDownloadQueue();
    renderDownloadQueue();
    renderCatalog();
    updateStats();
  });

  downloadZipBtn.addEventListener('click', async () => {
    if (isDemoMode) {
      alert('Sign up for a free DJ account to download MP3 ZIP files.');
      return;
    }
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
      renderCatalog();
      return;
    }
    playCurrentQueueTrack();
  });

})();