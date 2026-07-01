(function () {
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const djSearch = document.getElementById('dj-search');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const djList = document.getElementById('dj-directory-list');
  const djDetailPanel = document.getElementById('dj-detail-panel');
  const statDjs = document.getElementById('stat-djs');

  let allDjs = [];
  let filteredDjs = [];
  let expandedDjId = null;

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    SiteNav.init('djs');
    loadDjs();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
    closeDetail();
  }

  function closeDetail() {
    expandedDjId = null;
    if (djDetailPanel) {
      djDetailPanel.classList.add('hidden');
      djDetailPanel.innerHTML = '';
    }
    renderList();
  }

  function renderDetail(dj) {
    const fields = DjDirectory.profileFields(dj);
    const program = dj.programName || dj.showName;
    const station = dj.stationCallLetters || dj.station;

    djDetailPanel.innerHTML = `
      <div class="detail-panel-inner">
        <div class="detail-panel-header">
          <div class="detail-hero detail-hero--dj">
            <div class="detail-cover detail-cover--dj">
              <div class="dj-directory-avatar"><i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i></div>
            </div>
            <div class="detail-heading">
              <h2>${Utils.escapeHtml(DjDirectory.displayName(dj))}</h2>
              <p class="detail-artist">${Utils.escapeHtml(station || program || 'Radio programmer')}</p>
              <div class="song-tags">
                ${program ? `<span>${Utils.escapeHtml(program)}</span>` : ''}
                ${dj.programFormat ? `<span>${Utils.escapeHtml(dj.programFormat)}</span>` : ''}
                ${dj.state ? `<span>${Utils.escapeHtml(dj.state)}</span>` : ''}
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-ghost detail-close-btn" id="dj-detail-close-btn" aria-label="Close details">
            <i class="fa-solid fa-xmark"></i> Close
          </button>
        </div>
        <dl class="artist-dj-profile dj-directory-profile">
          ${fields.map((field) => `
            <div class="artist-dj-profile-row">
              <dt>${Utils.escapeHtml(field.label)}</dt>
              <dd>${DjDirectory.renderFieldValue(field)}</dd>
            </div>`).join('')}
        </dl>
        <div class="detail-panel-footer">
          <button type="button" class="btn btn-ghost detail-close-btn detail-close-btn--bottom" aria-label="Close details">
            <i class="fa-solid fa-xmark"></i> Close
          </button>
        </div>
      </div>`;

    djDetailPanel.querySelectorAll('.detail-close-btn').forEach((btn) => {
      btn.addEventListener('click', closeDetail);
    });
    djDetailPanel.classList.remove('hidden');
    djDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openDetail(id) {
    if (expandedDjId === id) {
      closeDetail();
      return;
    }

    const dj = allDjs.find((item) => item.id === id);
    if (!dj) return;

    expandedDjId = id;
    renderDetail(dj);
    renderList();
  }

  function renderList() {
    statDjs.textContent = filteredDjs.length;

    if (!filteredDjs.length) {
      djList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-tower-broadcast"></i>
          <p>No DJs match your search.</p>
        </div>`;
      return;
    }

    djList.innerHTML = filteredDjs.map((dj, index) => {
      const isOpen = expandedDjId === dj.id;
      return `
        <button
          type="button"
          class="dj-directory-item${isOpen ? ' is-open' : ''}"
          data-dj-id="${Utils.escapeHtml(dj.id)}"
          aria-expanded="${isOpen ? 'true' : 'false'}"
        >
          <span class="dj-directory-rank">${index + 1}</span>
          <span class="dj-directory-main">
            <span class="dj-directory-name">${Utils.escapeHtml(DjDirectory.displayName(dj))}</span>
            <span class="dj-directory-meta">${Utils.escapeHtml(DjDirectory.summaryLine(dj))}</span>
          </span>
          <span class="dj-directory-chevron" aria-hidden="true"><i class="fa-solid fa-chevron-${isOpen ? 'up' : 'down'}"></i></span>
        </button>`;
    }).join('');

    djList.querySelectorAll('.dj-directory-item').forEach((btn) => {
      btn.addEventListener('click', () => openDetail(btn.dataset.djId));
    });
  }

  function filterDjs() {
    const q = djSearch.value.trim().toLowerCase();
    filteredDjs = q
      ? allDjs.filter((dj) => {
        const haystack = [
          DjDirectory.displayName(dj),
          dj.programName,
          dj.showName,
          dj.stationCallLetters,
          dj.station,
          dj.state,
          dj.programFormat,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      : [...allDjs];
    renderList();
  }

  async function loadDjs() {
    djList.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading DJs…</p>
      </div>`;

    try {
      allDjs = await DjDirectory.fetchAll();
      filteredDjs = [...allDjs];
      closeDetail();
      renderList();
    } catch (err) {
      djList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  MemberAuthUI.init({ onAuthenticated: showApp });
  SiteNav.bindLogout(logoutBtn, showLogin);

  djSearch?.addEventListener('input', Utils.debounce(filterDjs, 180));
  clearSearchBtn?.addEventListener('click', () => {
    djSearch.value = '';
    filterDjs();
  });

  DjBoot.bootPage({
    onAuthenticated: showApp,
    onGuest: showLogin,
  });
})();