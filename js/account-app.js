(function () {
  const gate = document.getElementById('account-gate');
  const panel = document.getElementById('account-panel');
  const setupNotice = document.getElementById('setup-notice');
  const welcomeName = document.getElementById('welcome-name');
  const memberEmail = document.getElementById('member-email');
  const memberRole = document.getElementById('member-role');
  const memberSince = document.getElementById('member-since');
  const logoutBtn = document.getElementById('logout-btn');

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  async function boot() {
    try {
      const session = await HideawayAuth.getSession();
      if (!session) {
        window.location.href = '/join';
        return;
      }

      setupNotice.classList.add('hidden');
      const profile = await HideawayAuth.getProfile();

      welcomeName.textContent = profile?.display_name || session.user.email;
      memberEmail.textContent = profile?.email || session.user.email;
      memberRole.textContent = profile?.role || 'member';
      memberSince.textContent = formatDate(profile?.created_at || session.user.created_at);

      gate.classList.add('hidden');
      panel.classList.remove('hidden');
    } catch (err) {
      setupNotice.classList.remove('hidden');
      setupNotice.textContent = err.message;
    }
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      await HideawayAuth.signOut();
      window.location.href = '/';
    } catch (err) {
      alert(err.message || 'Could not sign out.');
    }
  });

  boot();
})();