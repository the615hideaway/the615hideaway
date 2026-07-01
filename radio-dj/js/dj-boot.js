const DjBoot = {
  async ready() {
    if (typeof HideawayAuth !== 'undefined') {
      try {
        await HideawayAuth.init();
      } catch (err) {
        console.warn('Supabase init failed:', err.message);
      }
    }

    if (typeof DjAuth !== 'undefined' && DjAuth.restoreSession) {
      await DjAuth.restoreSession();
    }
  }
};