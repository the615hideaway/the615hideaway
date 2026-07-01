(function () {
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const reporterLine = document.getElementById('dj-help-reporter');
  const songForm = document.getElementById('song-info-form');
  const bugForm = document.getElementById('site-bug-form');
  const songStatus = document.getElementById('song-form-status');
  const bugStatus = document.getElementById('bug-form-status');

  function isAuthenticated() {
    return DjAuth.isAuthenticated();
  }

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    DjAuthUI.updateWelcome();
    SiteNav.init('djHelp');
    renderReporter();
    applyPrefill();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
  }

  function renderReporter() {
    const dj = DjAuth.getDj();
    if (!dj || !reporterLine) return;

    const bits = [
      dj.name,
      dj.stationCallLetters || dj.station,
      dj.programName || dj.showName,
    ].filter(Boolean);

    reporterLine.textContent = bits.length
      ? `Reporting as ${bits.join(' · ')}`
      : `Reporting as ${dj.email || 'DJ'}`;
    reporterLine.classList.remove('hidden');
  }

  function setActiveTab(tabKey) {
    document.querySelectorAll('.dj-help-tab').forEach((btn) => {
      const active = btn.dataset.helpTab === tabKey;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-help-panel]').forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.helpPanel !== tabKey);
    });
  }

  function applyPrefill() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const artist = params.get('artist') || '';
    const song = params.get('song') || '';

    if (type === 'bug') {
      setActiveTab('bug');
      const page = params.get('page');
      if (page) document.getElementById('bug-page').value = page;
      return;
    }

    if (artist || song || type === 'song') {
      setActiveTab('song');
      if (artist) document.getElementById('song-artist').value = artist;
      if (song) document.getElementById('song-title').value = song;
    }
  }

  function showStatus(el, message, isError) {
    if (!el) return;
    el.classList.remove('hidden', 'is-error', 'is-success');
    el.classList.add(isError ? 'is-error' : 'is-success');
    el.textContent = message;
  }

  function clearStatus(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.textContent = '';
  }

  document.querySelectorAll('.dj-help-tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.helpTab));
  });

  songForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(songStatus);

    const submitBtn = songForm.querySelector('button[type="submit"]');
    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

    try {
      const result = await DjFeedback.submitSongInfo({
        artistName: document.getElementById('song-artist').value,
        songTitle: document.getElementById('song-title').value,
        issueType: document.getElementById('song-issue-type').value,
        correction: document.getElementById('song-correction').value,
        notes: document.getElementById('song-notes').value,
      });
      showStatus(songStatus, `Thanks — we got it (report ${result.reportId}). The Radio Now team will follow up if needed.`, false);
      songForm.reset();
      applyPrefill();
    } catch (err) {
      showStatus(songStatus, err.message || 'Could not send report. Try again or email radio@the615hideaway.com.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });

  bugForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearStatus(bugStatus);

    const submitBtn = bugForm.querySelector('button[type="submit"]');
    const original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';

    try {
      const result = await DjFeedback.submitSiteBug({
        page: document.getElementById('bug-page').value,
        whatHappened: document.getElementById('bug-what-happened').value,
        notes: document.getElementById('bug-notes').value,
      });
      showStatus(bugStatus, `Thanks — we got it (report ${result.reportId}). The Radio Now team will look into it.`, false);
      bugForm.reset();
    } catch (err) {
      showStatus(bugStatus, err.message || 'Could not send report. Try again or email radio@the615hideaway.com.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });

  DjAuthUI.init({ onAuthenticated: showApp });
  SiteNav.bindLogout(logoutBtn, showLogin);

  if (isAuthenticated()) showApp();
  else showLogin();
})();