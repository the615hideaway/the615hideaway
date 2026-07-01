const ArtistPortalNav = {
  items: [
    { key: 'spins', href: 'artist-dashboard.html', label: 'Spins', icon: 'fa-chart-line' },
    { key: 'submit', href: 'artist-submit.html', label: 'Submit', icon: 'fa-cloud-arrow-up' },
    { key: 'promo', href: 'artist-promo.html', label: 'Promo', icon: 'fa-folder-open' },
    { key: 'djRequests', href: 'artist-dj-requests.html', label: 'DJ Requests', icon: 'fa-envelope' },
    { key: 'spotlight', href: 'artist-spotlight.html', label: 'Featured', icon: 'fa-star' },
    { key: 'roster', href: 'artist-roster.html', label: 'Roster', icon: 'fa-users', labelOnly: true },
  ],

  init(activeKey, options = {}) {
    const nav = document.querySelector('[data-artist-portal-nav]');
    if (!nav) return;

    const isLabel = !!options.isLabel;
    const links = this.items.filter((item) => !item.labelOnly || isLabel);

    nav.innerHTML = `
      <div class="artist-portal-nav-inner" role="navigation" aria-label="Artist portal">
        ${links.map((item) => {
          const active = item.key === activeKey ? ' is-active' : '';
          return `
            <a href="${item.href}" class="artist-portal-nav-link${active}"${active ? ' aria-current="page"' : ''}>
              <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
              <span>${Utils.escapeHtml(item.label)}</span>
            </a>`;
        }).join('')}
      </div>`;
  },
};