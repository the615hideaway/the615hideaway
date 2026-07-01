const ArtistPortalAuth = {
  loginUrl: 'artist-dashboard.html',

  isDemoMode() {
    return typeof Demo !== 'undefined' && Demo.isActive();
  },

  requireAuth() {
    if (this.isDemoMode()) return true;
    if (typeof ArtistAuth !== 'undefined' && ArtistAuth.isAuthenticated()) return true;
    const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'artist-dashboard.html');
    window.location.replace(`${this.loginUrl}?next=${next}`);
    return false;
  },

  showShell(loginGate, appShell) {
    if (loginGate) loginGate.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');
  },

  initPage(options = {}) {
    const loginGate = document.getElementById('login-gate');
    const appShell = document.getElementById('app-shell');
    const logoutBtn = document.getElementById('logout-btn');
    const activeNav = options.activeNav || 'spins';
    const onReady = options.onReady || (() => {});

    const boot = () => {
      this.showShell(loginGate, appShell);
      if (this.isDemoMode()) {
        Demo.applyMode();
        Demo.bindExit(logoutBtn);
      } else {
        ArtistAuthUI.updateWelcome();
      }
      if (typeof TurnkeyPitch !== 'undefined') TurnkeyPitch.hideAppPromo();

      const account = this.isDemoMode() ? null : ArtistAuth.getArtist();
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      if (typeof ArtistPortalNav !== 'undefined') {
        ArtistPortalNav.init(activeNav, { isLabel });
      }
      onReady({ account, isDemoMode: this.isDemoMode(), isLabel });
    };

    if (this.isDemoMode()) {
      boot();
      return;
    }

    SiteNav.bindLogout(logoutBtn, () => {
      window.location.replace(this.loginUrl);
    });

    (async () => {
      if (typeof HideawayAuth !== 'undefined') await HideawayAuth.init();
      if (typeof ArtistAuth !== 'undefined' && ArtistAuth.resolveSession) {
        await ArtistAuth.resolveSession();
      }
      if (ArtistAuth.isAuthenticated()) {
        boot();
        return;
      }
      this.requireAuth();
    })();
  },
};