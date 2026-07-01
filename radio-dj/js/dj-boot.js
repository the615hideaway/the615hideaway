const DjBoot = {
  async ready() {
    if (typeof HideawayAuth === 'undefined') return null;

    DjBoot._initAuthListener();

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
    const session = await DjBoot._waitForSupabaseSession(supabase);

    if (typeof DjAuth !== 'undefined' && DjAuth.getSession()?.dj) {
      await DjAuth.ensureDjEmailOnCachedSession();
      HideawayAuth.clearAuthHash();
      return session;
    }

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

    if (typeof DjAuth !== 'undefined' && DjAuth.resolveSession) {
      await DjAuth.resolveSession();
    }

    return session;
  },

  _initAuthListener() {
    if (DjBoot._authListenerReady || typeof HideawayAuth === 'undefined') return;
    DjBoot._authListenerReady = true;

    HideawayAuth.init().then((supabase) => {
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (!session || typeof DjAuth === 'undefined') return;
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          if (!DjAuth.getSession()?.dj) {
            await DjAuth.resolveSession();
          }
        }
        if (event === 'SIGNED_OUT') {
          DjAuth.clearLocalSession();
        }
      });
    }).catch(() => {});
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

  async _waitForSupabaseSession(supabase, maxMs = 5000) {
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  },

  async bootPage(options = {}) {
    const { authUi, onAuthenticated, onGuest } = options;
    const mayStaySignedIn = typeof DjAuth !== 'undefined'
      && (DjAuth.getSession()?.dj || DjAuth._hasSupabaseAuthToken?.());

    DjBoot._setAuthPending(true);

    try {
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
        await DjAuth.ensureDjEmailOnCachedSession();
        onAuthenticated?.();
        return;
      }

      if (mayStaySignedIn && typeof DjAuth !== 'undefined' && DjAuth._hasSupabaseAuthToken?.()) {
        await DjAuth.forceRestoreFromSupabase();
        if (DjAuth.getSession()?.dj) {
          await DjAuth.ensureDjEmailOnCachedSession();
          onAuthenticated?.();
          return;
        }
      }

      onGuest?.();
    } finally {
      DjBoot._setAuthPending(false);
    }
  }
};