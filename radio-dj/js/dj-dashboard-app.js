(function () {
  const isDemoMode = Demo.isActive();
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const profilePanel = document.getElementById('profile-panel');
  const profileEditor = document.getElementById('profile-editor');
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const closeProfileBtn = document.getElementById('close-profile-btn');
  const profileForm = document.getElementById('dj-profile-form');
  const dashboardTitle = document.getElementById('dashboard-title');
  const dashboardStats = document.getElementById('dashboard-stats');
  const dashboardHistory = document.getElementById('dashboard-history');
  const historyCount = document.getElementById('history-count');
  const shareEmailToggle = document.getElementById('share-email-toggle');
  const shareEmailStatus = document.getElementById('share-email-status');
  const profileSaveStatus = document.getElementById('profile-save-status');
  const saveProfileBtn = document.getElementById('save-profile-btn');

  function showSpotlightAdminLink() {
    const link = document.getElementById('spotlight-admin-link');
    if (!link || typeof Spotlight === 'undefined') return;
    link.classList.toggle('hidden', !Spotlight.isAdminDj(DjAuth.getDj()));
  }

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    if (isDemoMode) {
      Demo.applyMode();
      Demo.bindExit(logoutBtn);
      if (profilePanel) profilePanel.classList.add('hidden');
    } else {
      DjAuthUI.updateWelcome();
      SiteNav.init('djDashboard');
      showSpotlightAdminLink();
      if (typeof TurnkeyPitch !== 'undefined') TurnkeyPitch.hideAppPromo();
      if (typeof DjSignupForm !== 'undefined') DjSignupForm.mountProfile();
    }
    loadDashboard();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
  }

  function renderStats(stats) {
    const items = [
      { label: 'Total Downloads', value: stats.totalDownloads || 0 },
      { label: 'This Week', value: stats.thisWeek || 0 },
      { label: 'This Month', value: stats.thisMonth || 0 },
      { label: 'Unique Songs', value: stats.uniqueSongs || 0 },
    ];

    dashboardStats.innerHTML = items.map((item) => `
      <div class="dj-stat-card">
        <span class="dj-stat-value">${item.value}</span>
        <label>${item.label}</label>
      </div>`).join('');
  }

  function renderHistory(activity) {
    historyCount.textContent = `${activity.length} recorded`;

    if (!activity.length) {
      dashboardHistory.innerHTML = `
        <div class="empty-state dj-empty-state">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <p>No downloads logged yet. Grab a song from the catalog and it will show up here.</p>
        </div>`;
      return;
    }

    dashboardHistory.innerHTML = `
      <div class="dj-history-list">
        ${activity.map((item) => `
          <article class="dj-history-item">
            <div class="dj-history-main">
              <h3>${Utils.escapeHtml(item.songTitle || 'Untitled')}</h3>
              <p>${Utils.escapeHtml(item.artistName || 'Unknown Artist')}${item.musicStyle ? ` · ${Utils.escapeHtml(item.musicStyle)}` : ''}</p>
            </div>
            <div class="dj-history-meta">
              <span class="dj-history-type">${Utils.escapeHtml(DjActivity.formatLabel(item.eventType, item.format))}</span>
              <span class="dj-history-date">${Utils.escapeHtml(DjActivity.formatTimestamp(item.timestamp))}</span>
            </div>
          </article>
        `).join('')}
      </div>`;
  }

  function updateShareEmailUi(dj) {
    const enabled = !!dj?.shareEmail;
    if (shareEmailToggle) shareEmailToggle.checked = enabled;
    if (shareEmailStatus) {
      const contact = dj?.contactEmail || dj?.email || 'your DJ contact email';
      shareEmailStatus.textContent = enabled
        ? `Artists can see ${contact} on future downloads.`
        : 'Your DJ contact email is hidden from artists.';
    }
  }

  function setProfileSaveStatus(message, isError = false) {
    if (!profileSaveStatus) return;
    profileSaveStatus.textContent = message || '';
    profileSaveStatus.classList.toggle('dj-panel-status--error', !!isError);
  }

  function openProfileEditor() {
    profilePanel?.classList.add('hidden');
    profileEditor?.classList.remove('hidden');
    if (profileEditor) profileEditor.setAttribute('aria-hidden', 'false');
    if (editProfileBtn) editProfileBtn.setAttribute('aria-expanded', 'true');
    profileEditor?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeProfileEditor() {
    profileEditor?.classList.add('hidden');
    profilePanel?.classList.remove('hidden');
    if (profileEditor) profileEditor.setAttribute('aria-hidden', 'true');
    if (editProfileBtn) editProfileBtn.setAttribute('aria-expanded', 'false');
    setProfileSaveStatus('');
  }

  function fillProfileForm(dj) {
    if (!dj || typeof DjSignupForm === 'undefined') return;
    DjSignupForm.fillFromDj(dj);
    updateShareEmailUi(dj);
  }

  function updateDashboardTitle(dj) {
    if (!dj) return;
    const name = [dj.firstName, dj.lastName].filter(Boolean).join(' ') || dj.name;
    dashboardTitle.textContent = name ? `${name}, your download history` : 'Your download history';
  }

  async function loadDashboard() {
    const dj = isDemoMode ? null : DjAuth.getDj();
    dashboardTitle.textContent = isDemoMode
      ? 'Demo DJ dashboard'
      : (dj?.name ? `${dj.name}, your download history` : 'Your download history');
    dashboardStats.innerHTML = `
      <div class="dj-stat-card">
        <span class="dj-stat-value"><i class="fa-solid fa-spinner fa-spin"></i></span>
        <label>Loading</label>
      </div>`;
    dashboardHistory.innerHTML = `
      <div class="empty-state dj-empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading your dashboard…</p>
      </div>`;

    try {
      const data = isDemoMode
        ? await DjActivity.fetchDemoDashboard()
        : await DjActivity.fetchDashboard();

      if (isDemoMode && data.dj?.name) {
        dashboardTitle.textContent = `${data.dj.name} — demo dashboard`;
        const copy = document.querySelector('.dj-dashboard-copy');
        if (copy) {
          copy.textContent = 'Read-only preview of a real DJ dashboard and download history. Create your own account to track your station.';
        }
      } else if (!isDemoMode) {
        DjAuth.updateDjProfile(data.dj);
        DjAuthUI.updateWelcome();
      SiteNav.init('djDashboard');
        fillProfileForm(data.dj);
        updateDashboardTitle(data.dj);
      }

      renderStats(data.stats || {});
      renderHistory(data.activity || []);
    } catch (err) {
      dashboardStats.innerHTML = '';
      dashboardHistory.innerHTML = `
        <div class="empty-state dj-empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  shareEmailToggle?.addEventListener('change', () => {
    updateShareEmailUi({
      ...DjAuth.getDj(),
      shareEmail: !!shareEmailToggle.checked,
    });
  });

  editProfileBtn?.addEventListener('click', openProfileEditor);
  closeProfileBtn?.addEventListener('click', closeProfileEditor);

  profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isDemoMode || typeof DjSignupForm === 'undefined') return;

    const originalHtml = saveProfileBtn?.innerHTML;
    if (saveProfileBtn) {
      saveProfileBtn.disabled = true;
      saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
    }
    setProfileSaveStatus('');

    try {
      const dj = await DjActivity.updateProfile(DjSignupForm.collectProfile());
      fillProfileForm(dj);
      updateDashboardTitle(dj);
      DjAuthUI.updateWelcome();
      SiteNav.init('djDashboard');
      setProfileSaveStatus('Profile saved.');
      closeProfileEditor();
    } catch (err) {
      setProfileSaveStatus(err.message || 'Could not save profile.', true);
    } finally {
      if (saveProfileBtn) {
        saveProfileBtn.disabled = false;
        saveProfileBtn.innerHTML = originalHtml;
      }
    }
  });

  if (isDemoMode) {
    showApp();
  } else {
    const authUi = DjAuthUI.init({ onAuthenticated: showApp });
    SiteNav.bindLogout(logoutBtn, showLogin);
    DjBoot.bootPage({
      authUi,
      onAuthenticated: showApp,
      onGuest: showLogin,
    });
  }
})();