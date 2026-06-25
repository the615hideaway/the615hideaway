(function (global) {
  let client = null;
  let initPromise = null;

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
          detectSessionInUrl: true
        }
      });

      return client;
    })();

    return initPromise;
  }

  async function getSession() {
    const supabase = await init();
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async function getProfile() {
    const supabase = await init();
    const session = await getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, created_at')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function signOut() {
    const supabase = await init();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async function updateNavAuthLink(linkId) {
    const link = document.getElementById(linkId || 'nav-auth-link');
    if (!link) return;

    try {
      const session = await getSession();
      if (session) {
        link.textContent = 'My Account';
        link.href = '/account';
        link.classList.add('active');
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
    getSession,
    getProfile,
    signOut,
    updateNavAuthLink
  };
})(window);