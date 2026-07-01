(function (global) {
  let client = null;
  let initPromise = null;

  function resetClient() {
    client = null;
    initPromise = null;
  }

  async function init() {
    if (client) return client;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const res = await fetch('/api/supabase-config');
      const config = await res.json();

      if (!config.url || !config.anonKey) {
        throw new Error('Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in Vercel.');
      }

      client = global.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'the615hideaway-supabase-auth',
          storage: window.localStorage
        }
      });

      return client;
    })();

    return initPromise;
  }

  function parseAuthHashError() {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || !hash.includes('error=')) return null;
    const params = new URLSearchParams(hash);
    return {
      code: params.get('error_code') || params.get('error'),
      description: (params.get('error_description') || 'Authentication link failed.')
        .replace(/\+/g, ' ')
    };
  }

  function clearAuthHash() {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  async function getSession() {
    const supabase = await init();
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async function waitForSession(timeoutMs = 4000) {
    const supabase = await init();
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    return new Promise((resolve) => {
      let settled = false;
      let subscription = null;

      const finish = (session) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription?.unsubscribe();
        resolve(session || null);
      };

      const listener = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          finish(session);
        }
      });
      subscription = listener.data?.subscription || listener.subscription;

      const timer = setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        finish(retry.session);
      }, timeoutMs);
    });
  }

  async function ensureProfile(session) {
    const supabase = await init();
    const meta = session.user.user_metadata || {};
    const payload = {
      id: session.user.id,
      email: session.user.email,
      display_name: meta.display_name || session.user.email.split('@')[0],
      member_type: meta.member_type || 'fan'
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error && !String(error.message).includes('member_type')) {
      throw error;
    }

    if (!error) return;

    const { error: fallbackError } = await supabase.from('profiles').upsert({
      id: session.user.id,
      email: session.user.email,
      display_name: payload.display_name
    }, { onConflict: 'id' });

    if (fallbackError) throw fallbackError;
  }

  async function getProfile() {
    const supabase = await init();
    const session = await getSession();
    if (!session) return null;

    let { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, member_type, created_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error && String(error.message).includes('member_type')) {
      const fallback = await supabase
        .from('profiles')
        .select('id, email, display_name, role, created_at')
        .eq('id', session.user.id)
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
      if (data) data.member_type = session.user.user_metadata?.member_type || 'fan';
    }

    if (error) throw error;

    if (!data) {
      await ensureProfile(session);
      return getProfile();
    }

    return data;
  }

  async function signOut() {
    try {
      const supabase = await init();
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {}
    resetClient();
  }

  async function updateNavAuthLink(linkId) {
    const link = document.getElementById(linkId || 'nav-auth-link');
    if (!link) return;

    try {
      const session = await getSession();
      if (session) {
        link.textContent = 'My Account';
        link.href = '/account';
      } else {
        link.textContent = 'Join';
        link.href = '/join';
      }
    } catch (_) {
      link.textContent = 'Join';
      link.href = '/join';
    }
  }

  global.HideawayAuth = {
    init,
    resetClient,
    parseAuthHashError,
    clearAuthHash,
    getSession,
    waitForSession,
    getProfile,
    ensureProfile,
    signOut,
    updateNavAuthLink
  };
})(window);