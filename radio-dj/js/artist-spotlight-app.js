(function initArtistFeaturedSpotlight() {
  const host = document.getElementById('artist-featured-content');
  const intro = document.getElementById('featured-intro');
  if (!host) return;

  function songsForAccount(account, songs) {
    if (!account) return [];
    const isLabel = String(account.accountType || '').toLowerCase() === 'label';
    const target = String(account.artistName || '').trim().toLowerCase();
    return songs.filter((song) => {
      const field = isLabel ? song.recordLabel : song.artistName;
      return String(field || '').trim().toLowerCase() === target;
    });
  }

  function featuredPicks(songs) {
    return Spotlight.sortSongs(
      songs.filter((song) => Spotlight.isManualPick(song)),
    );
  }

  function renderLoading() {
    host.innerHTML = `
      <section class="artist-portal-card spotlight-admin-loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading featured picks…</p>
      </section>`;
  }

  function renderError(message) {
    host.innerHTML = `
      <section class="artist-portal-card">
        <p class="login-error show">${Utils.escapeHtml(message)}</p>
        <button type="button" class="btn btn-secondary" id="featured-retry-btn">Try again</button>
      </section>`;
    document.getElementById('featured-retry-btn')?.addEventListener('click', () => boot());
  }

  function formatUntil(until) {
    const raw = String(until || '').trim();
    if (!raw) return '';
    const date = Spotlight.parseDateOnly(raw);
    if (!date) return raw;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function renderFeatured(account, picks, isLabel) {
    if (intro) {
      intro.textContent = isLabel
        ? 'Songs from your roster featured by Radio Now at the top of the DJ catalog.'
        : 'When Radio Now features your music at the top of the DJ catalog, it shows up here.';
    }

    if (!picks.length) {
      host.innerHTML = `
        <section class="artist-portal-card artist-featured-empty">
          <p class="spin-picker-empty"><i class="fa-solid fa-star"></i> No featured picks for ${isLabel ? 'your roster' : 'you'} right now. New label releases may still auto-feature for ${CONFIG.spotlight?.labelNewReleaseDays || 30} days on the DJ catalog.</p>
          <a href="artist-dashboard.html" class="btn btn-secondary">Back to Spins</a>
        </section>`;
      return;
    }

    host.innerHTML = `
      <section class="artist-portal-card artist-featured-card">
        <div class="artist-featured-header">
          <h2 class="artist-portal-card-title"><i class="fa-solid fa-star"></i> ${picks.length} featured ${picks.length === 1 ? 'song' : 'songs'}</h2>
          <p class="artist-portal-card-note">Featured by Radio Now · visible at the top of the DJ catalog</p>
        </div>
        <ul class="artist-featured-list">
          ${picks.map((song) => {
            const badge = Spotlight.badge(song) || 'Featured';
            const until = formatUntil(song.spotlightUntil);
            return `
              <li class="artist-featured-item">
                <div class="artist-featured-main">
                  <span class="artist-featured-badge">${Utils.escapeHtml(badge)}</span>
                  <strong>${Utils.escapeHtml(song.songTitle)}</strong>
                  <span>${Utils.escapeHtml(song.artistName)}</span>
                  ${song.musicStyle ? `<span class="artist-featured-style">${Utils.escapeHtml(song.musicStyle)}</span>` : ''}
                </div>
                ${until ? `<p class="artist-featured-until">Featured until ${Utils.escapeHtml(until)}</p>` : ''}
              </li>`;
          }).join('')}
        </ul>
      </section>`;
  }

  async function boot(account, isLabel) {
    renderLoading();
    try {
      const catalog = await RadioDB.getAllSongs();
      const roster = songsForAccount(account, catalog);
      const picks = featuredPicks(roster);
      renderFeatured(account, picks, isLabel);
    } catch (err) {
      renderError(err.message || 'Could not load featured spotlight.');
    }
  }

  ArtistPortalAuth.initPage({
    activeNav: 'spotlight',
    onReady({ account, isDemoMode, isLabel }) {
      if (isDemoMode) {
        renderFeatured(
          { artistName: CONFIG.spotlight?.houseArtist || 'David Parmley', accountType: 'artist' },
          [],
          false,
        );
        return;
      }
      boot(account, isLabel);
    },
  });
})();