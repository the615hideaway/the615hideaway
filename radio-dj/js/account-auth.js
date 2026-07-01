const AccountAuth = {
  getRole() {
    if (DjAuth.isAuthenticated()) return 'dj';
    if (ArtistAuth.isAuthenticated()) return 'artist';
    return null;
  },

  isAuthenticated() {
    return !!this.getRole();
  },

  async logout() {
    await DjAuth.logout();
    ArtistAuth.logout();
  },

  async authRequest(action, payload = {}) {
    const role = this.getRole();
    if (role === 'dj') return DjAuth.authRequest(action, payload);
    if (role === 'artist') return ArtistAuth.authRequest(action, payload);
    throw new Error('Not signed in.');
  },
};