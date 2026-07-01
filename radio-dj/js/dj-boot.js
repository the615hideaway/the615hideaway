const DjBoot = {
  _authState: 'pending',

  markAuthenticated() {
    this._authState = 'authenticated';
  },

  markGuest() {
    if (this._authState === 'authenticated') return;
    this._authState = 'guest';
  },

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

    const session = await HideawayAuth.waitForSession();

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

    this._authState = 'pending';
    DjBoot._setAuthPending(true);

    const finishAuthenticated = () => {
      this.markAuthenticated();
      onAuthenticated?.();
    };

    const finishGuest = () => {
      this.markGuest();
      if (this._authState === 'authenticated') return;
      onGuest?.();
    };

    try {
      const cachedBeforeBoot = typeof DjAuth !== 'undefined' ? DjAuth.getSession()?.dj : null;
      if (typeof DjAuth !== 'undefined' && DjAuth.isExplicitlySignedOut?.() && !cachedBeforeBoot) {
        finishGuest();
        return;
      }

      if (typeof DjAuth !== 'undefined' && DjAuth.isExplicitlySignedOut?.() && cachedBeforeBoot) {
        DjAuth._clearSignedOutFlag();
      }

      await this.ready();

      if (typeof DjAuth !== 'undefined' && DjAuth.resolveSession) {
        await DjAuth.resolveSession();
      }

      if (authUi?.showBootMessage) {
        authUi.showBootMessage(finishAuthenticated);
      }

      if (authUi?.checkAfterBoot) {
        await authUi.checkAfterBoot();
      }

      if (typeof DjAuth !== 'undefined' && DjAuth.getSession()?.dj) {
        finishAuthenticated();
        return;
      }

      if (typeof HideawayAuth !== 'undefined' && typeof DjAuth !== 'undefined') {
        const session = await HideawayAuth.waitForSession(1500);
        if (session && !DjAuth.isExplicitlySignedOut?.()) {
          await DjAuth.resolveSession();
          if (DjAuth.getSession()?.dj) {
            finishAuthenticated();
            return;
          }
        }
      }

      finishGuest();
    } finally {
      DjBoot._setAuthPending(false);
    }
  }
};