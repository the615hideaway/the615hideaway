const DjFavorites = {
  storageKey: 'radio_now_dj_favorite_artists',

  isAvailable() {
    return typeof DjAuth !== 'undefined' && DjAuth.isAuthenticated();
  },

  normalizeArtist(name) {
    return String(name || '').trim().toLowerCase();
  },

  ownerKey() {
    const dj = DjAuth.getDj();
    return dj?.id || dj?.email || 'anonymous';
  },

  readStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  },

  load() {
    if (!this.isAvailable()) return [];
    const store = this.readStore();
    const list = store[this.ownerKey()];
    return Array.isArray(list) ? list.filter(Boolean) : [];
  },

  save(list) {
    const store = this.readStore();
    store[this.ownerKey()] = list;
    localStorage.setItem(this.storageKey, JSON.stringify(store));
  },

  isFavorite(artistName) {
    const key = this.normalizeArtist(artistName);
    if (!key) return false;
    return this.load().includes(key);
  },

  toggle(artistName) {
    const key = this.normalizeArtist(artistName);
    if (!key || !this.isAvailable()) return false;

    const list = this.load();
    const index = list.indexOf(key);
    if (index >= 0) list.splice(index, 1);
    else list.push(key);
    this.save(list);
    return index < 0;
  },

  sortArtists(artists) {
    if (!this.isAvailable()) return artists;

    const favorites = this.load();
    const favoriteSet = new Set(favorites);
    const picked = [];
    const rest = [];

    favorites.forEach((key) => {
      const match = artists.find((artist) => this.normalizeArtist(artist.name) === key);
      if (match) picked.push(match);
    });

    artists.forEach((artist) => {
      if (!favoriteSet.has(this.normalizeArtist(artist.name))) rest.push(artist);
    });

    return [...picked, ...rest];
  },

  sortSongs(songs) {
    if (!this.isAvailable()) return songs;

    const favorites = this.load();
    const favoriteSet = new Set(favorites);
    const favoriteSongs = [];
    const otherSongs = [];

    songs.forEach((song) => {
      if (favoriteSet.has(this.normalizeArtist(song.artistName))) favoriteSongs.push(song);
      else otherSongs.push(song);
    });

    return [...favoriteSongs, ...otherSongs];
  },

  buttonHtml(artistName, className = 'favorite-toggle') {
    if (!this.isAvailable()) return '';

    const favorite = this.isFavorite(artistName);
    const label = favorite ? 'Remove from favorites' : 'Favorite this artist';

    return `
      <button
        type="button"
        class="btn-icon ${className} ${favorite ? 'is-favorite' : ''}"
        data-artist="${Utils.escapeHtml(artistName)}"
        title="${label}"
        aria-label="${label}"
        aria-pressed="${favorite ? 'true' : 'false'}"
      >
        <i class="${favorite ? 'fa-solid' : 'fa-regular'} fa-star" aria-hidden="true"></i>
      </button>`;
  },

  bindButtons(root, onChange) {
    if (!root) return;

    root.querySelectorAll('.favorite-toggle, .artist-favorite-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        DjFavorites.toggle(btn.dataset.artist);
        if (typeof onChange === 'function') onChange();
      });
    });
  },
};