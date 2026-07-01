const ArtistBoot = {
  async bootPage(options = {}) {
    const { authUi, onAuthenticated, onGuest } = options;

    try {
      if (typeof DjAuth !== 'undefined' && DjAuth.isExplicitlySignedOut?.()) {
        onGuest?.();
        return;
      }

      if (typeof HideawayAuth !== 'undefined') {
        await HideawayAuth.init();
      }

      if (typeof ArtistAuth !== 'undefined' && ArtistAuth.resolveSession) {
        await ArtistAuth.resolveSession();
      }

      if (authUi?.checkAfterBoot) {
        const blocked = await authUi.checkAfterBoot();
        if (blocked) {
          onGuest?.();
          return;
        }
      }

      if (typeof ArtistAuth !== 'undefined' && ArtistAuth.isAuthenticated()) {
        onAuthenticated?.();
        return;
      }

      onGuest?.();
    } catch (err) {
      console.warn('Artist boot failed:', err.message);
      onGuest?.();
    }
  },
};