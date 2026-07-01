const DjBoot = {
  async ready() {
    if (typeof HideawayAuth === 'undefined') return null;

    try {
      await HideawayAuth.init();
    } catch (err) {
      console.warn('Supabase init failed:', err.message);
      return null;
    }

    const hashError = HideawayAuth.parseAuthHashError();
    if (hashError) {
      HideawayAuth.clearAuthHash();
      DjBoot._confirmationMessage = hashError.description || 'That confirmation link did not work. Try signing in or sign up again.';
      return null;
    }

    const supabase = await HideawayAuth.init();
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (session && typeof DjAuth !== 'undefined' && DjAuth.completeSessionSetup) {
      try {
        await DjAuth.completeSessionSetup(session);
        const params = new URLSearchParams(window.location.search);
        if (params.get('confirmed') === '1') {
          DjBoot._confirmationMessage = 'Email confirmed — welcome to Radio Now.';
          history.replaceState(null, '', window.location.pathname + '?tab=signin');
        }
        HideawayAuth.clearAuthHash();
        return session;
      } catch (err) {
        if (String(err.message) === 'PROFILE_INCOMPLETE') {
          DjBoot._needsProfileCompletion = true;
          DjBoot._confirmationMessage = 'You are signed in. Finish your DJ profile below to open the Radio Now catalog.';
          HideawayAuth.clearAuthHash();
          return session;
        }
        console.warn('DJ session setup:', err.message);
      }
    }

    if (typeof DjAuth !== 'undefined' && DjAuth.restoreSession) {
      await DjAuth.restoreSession();
    }

    return session;
  },

  consumeMessage() {
    const message = DjBoot._confirmationMessage || '';
    DjBoot._confirmationMessage = '';
    return message;
  },

  needsProfileCompletion() {
    return !!DjBoot._needsProfileCompletion;
  },

  consumeNeedsProfileCompletion() {
    const flag = !!DjBoot._needsProfileCompletion;
    DjBoot._needsProfileCompletion = false;
    return flag;
  },

  async bootPage(options = {}) {
    const { authUi, onAuthenticated, onGuest } = options;

    await this.ready();

    if (authUi) {
      if (typeof authUi.showBootMessage === 'function') {
        authUi.showBootMessage(onAuthenticated);
      }
      if (typeof authUi.checkAfterBoot === 'function') {
        const needsProfile = await authUi.checkAfterBoot();
        if (needsProfile) {
          onGuest?.();
          return;
        }
      }
    } else if (typeof DjAuth !== 'undefined' && DjAuth.restoreSession) {
      await DjAuth.restoreSession();
    }

    if (typeof DjAuth !== 'undefined' && DjAuth.isAuthenticated()) {
      onAuthenticated?.();
      return;
    }

    onGuest?.();
  }
};