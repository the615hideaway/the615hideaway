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

    if (session) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('confirmed') === '1') {
        DjBoot._confirmationMessage = 'Email confirmed — welcome to Radio Now.';
        history.replaceState(null, '', window.location.pathname + '?tab=signin');
      }
      HideawayAuth.clearAuthHash();
    }

    return session;
  },

  _setAuthPending(pending) {
    document.body.classList.toggle('auth-booting', !!pending);
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

    DjBoot._setAuthPending(true);

    try {
      if (typeof DjAuth !== 'undefined' && DjAuth.isExplicitlySignedOut?.()) {
        onGuest?.();
        return;
      }

      await this.ready();

      if (typeof DjAuth !== 'undefined' && DjAuth.resolveSession) {
        await DjAuth.resolveSession();
      }

      if (authUi?.showBootMessage) {
        authUi.showBootMessage(onAuthenticated);
      }

      if (authUi?.checkAfterBoot) {
        const needsProfile = await authUi.checkAfterBoot();
        if (needsProfile) {
          onGuest?.();
          return;
        }
      }

      if (typeof DjAuth !== 'undefined' && DjAuth.getSession()?.dj) {
        onAuthenticated?.();
        return;
      }

      onGuest?.();
    } finally {
      DjBoot._setAuthPending(false);
    }
  }
};