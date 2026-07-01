(function () {
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const artistSearch = document.getElementById('artist-search');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const artistsGrid = document.getElementById('artists-grid');
  const connectionBanner = document.getElementById('connection-banner');

  let allArtists = [];
  let filteredArtists = [];

  function isAuthenticated() {
    return DjAuth.isAuthenticated();
  }

  function showApp() {
    loginGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    DjAuthUI.updateWelcome();
    SiteNav.init('artists');
    if (typeof TurnkeyPitch !== 'undefined') TurnkeyPitch.hideAppPromo();
    loadArtists();
  }

  function showLogin() {
    loginGate.classList.remove('hidden');
    appShell.classList.add('hidden');
  }

  function renderCover(song) {
    const url = Utils.resolveCoverUrl(song);
    if (url) {
      return `<img src="${Utils.escapeHtml(url)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
    }
    return '<div class="cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>';
  }

  function renderArtistCard(artist) {
    const favorite = DjFavorites.isFavorite(artist.name);
    return `
      <div class="artist-card-wrap ${favorite ? 'is-favorite-artist' : ''}">
        ${DjFavorites.buttonHtml(artist.name, 'artist-favorite-btn')}
        <a class="artist-card" href="artist.html?slug=${encodeURIComponent(artist.slug)}">
          <div class="artist-card-cover">${renderCover(artist.coverSong)}</div>
          <div class="artist-card-body">
            <h3>
              ${favorite ? '<i class="fa-solid fa-star artist-favorite-marker" aria-hidden="true"></i>' : ''}
              ${Utils.escapeHtml(artist.name)}
            </h3>
            <p class="artist-card-meta">
              <span>${artist.songCount} song${artist.songCount === 1 ? '' : 's'}</span>
              ${artist.maxYear ? `<span>Latest ${artist.maxYear}</span>` : ''}
            </p>
          </div>
          <span class="artist-card-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
        </a>
      </div>`;
  }

  function renderArtists() {
    if (!filteredArtists.length) {
      artistsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-user-music"></i>
          <p>No artists match your search.</p>
        </div>`;
      return;
    }

    artistsGrid.innerHTML = filteredArtists.map((artist) => renderArtistCard(artist)).join('');
    DjFavorites.bindButtons(artistsGrid, () => filterArtists());
  }

  function filterArtists() {
    const q = artistSearch.value.trim().toLowerCase();
    filteredArtists = q
      ? allArtists.filter((artist) => artist.name.toLowerCase().includes(q))
      : [...allArtists];
    filteredArtists = DjFavorites.sortArtists(filteredArtists);
    renderArtists();
  }

  async function loadArtists() {
    artistsGrid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading artists…</p>
      </div>`;

    try {
      const songs = await RadioDB.getAllSongs();
      connectionBanner.classList.add('hidden');
      connectionBanner.innerHTML = '';
      allArtists = Utils.groupSongsByArtist(songs);
      filteredArtists = [...allArtists];
      renderArtists();
    } catch (err) {
      connectionBanner.className = 'connection-banner error';
      connectionBanner.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div><strong>Catalog unavailable.</strong> ${Utils.escapeHtml(err.message)}</div>`;
      connectionBanner.classList.remove('hidden');
      artistsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Failed to load catalog: ${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
  }

  DjAuthUI.init({ onAuthenticated: showApp });
  SiteNav.bindLogout(logoutBtn, showLogin);

  artistSearch.addEventListener('input', Utils.debounce(filterArtists, 180));
  clearSearchBtn.addEventListener('click', () => {
    artistSearch.value = '';
    filterArtists();
  });

  if (isAuthenticated()) showApp();
  else showLogin();
})();