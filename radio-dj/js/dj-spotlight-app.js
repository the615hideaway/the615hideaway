(function initDjSpotlightAdmin() {
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const host = document.getElementById('spotlight-admin-content');
  if (!host) return;

  let catalogSongs = [];
  let picks = [];
  let maxSlots = CONFIG.spotlight?.maxSlots || 20;

  function pickKey(item) {
    return `${item.artistName}|${item.songTitle}`.toLowerCase();
  }

  function renderDenied(message) {
    host.innerHTML = `
      <section class="dj-panel">
        <p class="queue-warning"><i class="fa-solid fa-lock"></i> ${Utils.escapeHtml(message)}</p>
        <a href="dj-dashboard.html" class="btn btn-secondary">Back to Dashboard</a>
      </section>`;
  }

  function renderLoading() {
    host.innerHTML = `
      <section class="dj-panel spotlight-admin-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading catalog…</p>
      </section>`;
  }

  function renderError(message) {
    host.innerHTML = `
      <section class="dj-panel">
        <p class="login-error show">${Utils.escapeHtml(message)}</p>
        <button type="button" class="btn btn-secondary" id="spotlight-retry-btn">Try again</button>
      </section>`;
    document.getElementById('spotlight-retry-btn')?.addEventListener('click', () => boot());
  }

  function syncPicksFromServer(serverPicks) {
    picks = (serverPicks || []).map((item) => ({
      artistName: item.artistName,
      songTitle: item.songTitle,
      priority: item.priority || 80,
      until: item.until || '',
      badge: item.badge || 'Featured',
    }));
  }

  function render() {
    const pickedKeys = new Set(picks.map(pickKey));
    const query = (document.getElementById('spotlight-search')?.value || '').trim().toLowerCase();
    const available = catalogSongs
      .filter((song) => !pickedKeys.has(pickKey(song)))
      .filter((song) => {
        if (!query) return true;
        const hay = `${song.artistName} ${song.songTitle}`.toLowerCase();
        return hay.includes(query);
      })
      .slice(0, 40);

    host.innerHTML = `
      <section class="dj-panel dj-panel--wide spotlight-admin-card">
        <div class="spotlight-admin-toolbar">
          <div>
            <h2><i class="fa-solid fa-star"></i> Featured picks</h2>
            <p class="dj-panel-note">${picks.length} of ${maxSlots} slots used. Higher priority appears first. New releases can still auto-feature for ${CONFIG.spotlight?.labelNewReleaseDays || 30} days.</p>
          </div>
          <button type="button" class="btn btn-primary" id="spotlight-save-btn"${picks.length ? '' : ' disabled'}>
            <i class="fa-solid fa-floppy-disk"></i> Save spotlight
          </button>
        </div>

        <div id="spotlight-save-status" class="spotlight-save-status hidden" role="status"></div>

        ${picks.length
    ? `<ul class="spotlight-pick-list">
            ${picks.map((pick, index) => `
              <li class="spotlight-pick-item" data-index="${index}">
                <div class="spotlight-pick-main">
                  <strong>${Utils.escapeHtml(pick.songTitle)}</strong>
                  <span>${Utils.escapeHtml(pick.artistName)}</span>
                </div>
                <label class="spotlight-pick-field">
                  <span>Priority</span>
                  <input type="number" min="1" max="100" value="${pick.priority}" data-field="priority" data-index="${index}">
                </label>
                <label class="spotlight-pick-field">
                  <span>Until</span>
                  <input type="date" value="${Utils.escapeHtml(pick.until || '')}" data-field="until" data-index="${index}">
                </label>
                <label class="spotlight-pick-field">
                  <span>Badge</span>
                  <input type="text" maxlength="24" value="${Utils.escapeHtml(pick.badge || 'Featured')}" data-field="badge" data-index="${index}">
                </label>
                <button type="button" class="btn btn-ghost btn-sm spotlight-pick-remove" data-index="${index}" aria-label="Remove">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </li>`).join('')}
          </ul>`
    : `<p class="spin-picker-empty">No hand-picked spotlights yet. Add songs below to feature classics for new stations.</p>`}

        <div class="spotlight-add-section">
          <label for="spotlight-search" class="spin-picker-label">Add a song</label>
          <input type="search" id="spotlight-search" class="spotlight-search-input" placeholder="Search artist or title…" autocomplete="off">
          <ul class="spotlight-add-list">
            ${available.length
    ? available.map((song) => `
                <li>
                  <button type="button" class="spotlight-add-btn" data-artist="${Utils.escapeHtml(song.artistName)}" data-title="${Utils.escapeHtml(song.songTitle)}">
                    <strong>${Utils.escapeHtml(song.songTitle)}</strong>
                    <span>${Utils.escapeHtml(song.artistName)}</span>
                  </button>
                </li>`).join('')
    : '<li class="spotlight-add-empty">No matching songs or catalog fully picked.</li>'}
          </ul>
        </div>
      </section>`;

    document.getElementById('spotlight-search')?.addEventListener('input', render);

    host.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('change', () => {
        const index = parseInt(input.dataset.index, 10);
        const field = input.dataset.field;
        if (!picks[index] || !field) return;
        if (field === 'priority') {
          picks[index].priority = Math.min(100, Math.max(1, parseInt(input.value, 10) || 80));
        } else {
          picks[index][field] = input.value;
        }
      });
    });

    host.querySelectorAll('.spotlight-pick-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        picks.splice(index, 1);
        render();
      });
    });

    host.querySelectorAll('.spotlight-add-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (picks.length >= maxSlots) {
          alert(`Maximum ${maxSlots} spotlight songs. Remove one to add another.`);
          return;
        }
        picks.push({
          artistName: btn.dataset.artist || '',
          songTitle: btn.dataset.title || '',
          priority: 85,
          until: Spotlight.defaultUntilDate(),
          badge: 'Featured',
        });
        render();
      });
    });

    document.getElementById('spotlight-save-btn')?.addEventListener('click', savePicks);
  }

  async function savePicks() {
    const btn = document.getElementById('spotlight-save-btn');
    const status = document.getElementById('spotlight-save-status');
    if (!btn) return;

    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

    try {
      const data = await DjAuth.authRequest('spotlight_admin_save', {
        spotlights: picks.map((pick) => ({
          artistName: pick.artistName,
          songTitle: pick.songTitle,
          priority: pick.priority,
          until: pick.until,
          badge: pick.badge,
        })),
      });
      syncPicksFromServer(data.spotlights);
      if (typeof RadioDB !== 'undefined') RadioDB.invalidateCatalogCache();
      if (status) {
        status.classList.remove('hidden');
        status.textContent = `Saved ${data.saved || picks.length} spotlight pick${(data.saved || picks.length) === 1 ? '' : 's'}. Refresh the DJ catalog to see changes.`;
      }
      render();
    } catch (err) {
      alert(err.message || 'Could not save spotlights.');
    } finally {
      btn.disabled = picks.length === 0;
      btn.innerHTML = original;
    }
  }

  async function boot() {
    renderLoading();
    try {
      const [songs, spotlightData] = await Promise.all([
        RadioDB.getAllSongs(),
        DjAuth.authRequest('spotlight_admin_list'),
      ]);
      catalogSongs = songs;
      maxSlots = spotlightData.maxSlots || maxSlots;
      syncPicksFromServer(spotlightData.spotlights);
      render();
    } catch (err) {
      renderError(err.message || 'Could not load spotlight admin.');
    }
  }

  function showApp() {
    loginGate?.classList.add('hidden');
    appShell?.classList.remove('hidden');
    DjAuthUI.updateWelcome();
    SiteNav.init('djSpotlight');

    if (!Spotlight.isAdminDj(DjAuth.getDj())) {
      renderDenied('Spotlight picks are managed from the Sammy Passamano DJ account.');
      return;
    }

    boot();
  }

  function showLogin() {
    loginGate?.classList.remove('hidden');
    appShell?.classList.add('hidden');
  }

  const authUi = DjAuthUI.init({ onAuthenticated: showApp });
  SiteNav.bindLogout(logoutBtn, showLogin);
  DjBoot.bootPage({
    authUi,
    onAuthenticated: showApp,
    onGuest: showLogin,
  });
})();