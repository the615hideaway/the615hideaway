const SiteNav = {
  links: [
    { key: 'catalog', href: 'index.html', label: 'Catalog', roles: ['dj', 'guest'] },
    { key: 'yourMusic', href: 'artist-promo.html', label: 'Your Music', roles: ['artist'] },
    { key: 'artists', href: 'artists.html', label: 'Artists', roles: ['dj'] },
    { key: 'charts', href: 'charts.html', label: 'Charts', roles: ['dj', 'artist', 'guest'] },
    { key: 'djs', href: 'djs.html', label: 'DJs', roles: ['dj', 'artist'] },
    { key: 'djDashboard', href: 'dj-dashboard.html', label: 'DJ Dashboard', roles: ['dj'] },
    { key: 'djHelp', href: 'dj-help.html', label: 'Help Catalog', roles: ['dj'] },
    { key: 'djSpotlight', href: 'dj-spotlight.html', label: 'Spotlight', roles: ['dj'], spotlightAdmin: true },
    { key: 'artistDashboard', href: 'artist-dashboard.html', label: 'Spins', roles: ['artist'] },
  ],

  getRole() {
    if (typeof DjAuth !== 'undefined' && DjAuth.isAuthenticated()) return 'dj';
    if (typeof ArtistAuth !== 'undefined' && ArtistAuth.isAuthenticated()) return 'artist';
    return 'guest';
  },

  init(activeKey) {
    const nav = document.querySelector('[data-site-nav]');
    if (!nav) return;

    const role = this.getRole();
    const key = activeKey || nav.dataset.navActive || '';

    nav.innerHTML = this.links
      .filter((link) => {
        if (!link.roles.includes(role)) return false;
        if (link.spotlightAdmin) {
          return typeof Spotlight !== 'undefined' && Spotlight.isAdminDj(DjAuth.getDj());
        }
        return true;
      })
      .map((link) => {
        const active = link.key === key ? ' active' : '';
        return `<a href="${link.href}" class="nav-link${active}">${link.label}</a>`;
      })
      .join('');

    this.updateHeaderActions();
  },

  updateHeaderActions() {
    const role = this.getRole();
    const logoutBtn = document.getElementById('logout-btn');
    const signInBtn = document.querySelector('[data-signin-btn]');
    const djWelcome = document.getElementById('dj-welcome');
    const artistWelcome = document.getElementById('artist-welcome');

    if (djWelcome) {
      djWelcome.classList.add('hidden');
      djWelcome.textContent = '';
    }
    if (artistWelcome) {
      artistWelcome.classList.add('hidden');
      artistWelcome.textContent = '';
    }

    if (role === 'dj' && typeof DjAuthUI !== 'undefined') {
      DjAuthUI.updateWelcome();
    } else if (role === 'artist' && typeof ArtistAuthUI !== 'undefined') {
      ArtistAuthUI.updateWelcome();
    }

    if (logoutBtn) logoutBtn.classList.toggle('hidden', role === 'guest');
    if (signInBtn) signInBtn.classList.toggle('hidden', role !== 'guest');
  },

  bindLogout(button, onLogout) {
    button?.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await AccountAuth.logout();
        if (typeof DjAuthUI !== 'undefined') DjAuthUI.updateWelcome();
        if (typeof ArtistAuthUI !== 'undefined') ArtistAuthUI.updateWelcome();
        const nav = document.querySelector('[data-site-nav]');
        this.init(nav?.dataset.navActive);
        onLogout?.();
      } finally {
        button.disabled = false;
      }
    });
  },
};