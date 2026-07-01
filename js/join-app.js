(function () {
  const authMessage = document.getElementById('auth-message');
  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');
  const signupType = document.getElementById('signup-type');
  const djRedirectPanel = document.getElementById('dj-redirect-panel');
  const memberAuthTabs = document.getElementById('member-auth-tabs');
  const memberForms = document.querySelectorAll('[data-member-form]');
  const joinLead = document.getElementById('join-lead');
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const panels = document.querySelectorAll('[data-auth-panel]');

  const LEADS = {
    default: 'Create a free Supabase-backed account for new music alerts, Artist Mindset articles, and members-only updates.',
    artist: 'Create your free artist account, then edit and publish your page at the615hideaway.com/artists/your-name.',
    dj: 'DJs use the same account system. Create your full DJ profile on Radio Now with station and program details.',
    industry: 'Create your industry account. Label and publicist tools roll out on the main site.',
    festival: 'Create your festival or venue account. Field guide and locator listings are coming soon.'
  };

  function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = 'auth-alert auth-alert--' + type;
    authMessage.classList.remove('hidden');
  }

  function clearMessage() {
    authMessage.textContent = '';
    authMessage.className = 'auth-alert hidden';
  }

  function isDjType() {
    return signupType && signupType.value === 'dj';
  }

  function updateMemberTypeUi() {
    const dj = isDjType();
    djRedirectPanel?.classList.toggle('hidden', !dj);
    memberAuthTabs?.classList.toggle('hidden', dj);
    memberForms.forEach((form) => form.classList.toggle('hidden', dj));

    if (joinLead) {
      joinLead.textContent = LEADS[signupType?.value] || LEADS.default;
    }
  }

  function redirectAfterAuth(memberType) {
    if (memberType === 'dj') {
      window.location.href = '/radio-dj';
      return;
    }
    if (memberType === 'artist') {
      window.location.href = '/artist-portal';
      return;
    }
    window.location.href = '/account';
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.authTab;
      tabs.forEach((t) => {
        t.classList.toggle('active', t.dataset.authTab === target);
        t.setAttribute('aria-selected', t.dataset.authTab === target ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.authPanel !== target);
      });
      clearMessage();
    });
  });

  signupType?.addEventListener('change', updateMemberTypeUi);

  async function boot() {
    try {
      const supabase = await HideawayAuth.init();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const profile = await HideawayAuth.getProfile();
        redirectAfterAuth(profile?.member_type || data.session.user.user_metadata?.member_type || 'fan');
        return;
      }
      clearMessage();
    } catch (err) {
      showMessage(err.message, 'warn');
      signupForm.querySelector('button[type="submit"]').disabled = true;
      signinForm.querySelector('button[type="submit"]').disabled = true;
    }

    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type && signupType) {
      const option = signupType.querySelector('option[value="' + type + '"]');
      if (option) signupType.value = type;
    }

    if (params.get('tab') === 'signin') {
      document.querySelector('[data-auth-tab="signin"]')?.click();
    }

    updateMemberTypeUi();
  }

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const name = document.getElementById('signup-name').value.trim();
    const memberType = document.getElementById('signup-type').value;
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (memberType === 'dj') {
      window.location.href = '/radio-dj?tab=signup';
      return;
    }

    if (!name || !email || password.length < 8) {
      showMessage('Enter your name, email, and a password with at least 8 characters.', 'error');
      return;
    }

    try {
      const supabase = await HideawayAuth.init();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name, member_type: memberType },
          emailRedirectTo: 'https://www.the615hideaway.com/account'
        }
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          display_name: name,
          member_type: memberType,
          role: memberType === 'artist' ? 'artist' : 'member'
        });

        if (memberType === 'artist') {
          await supabase.from('artists').upsert({
            owner_id: data.user.id,
            slug: HideawayUtils.slugify(name),
            display_name: name,
            status: 'draft'
          }, { onConflict: 'owner_id' });
        }
      }

      if (data.session) {
        redirectAfterAuth(memberType);
        return;
      }

      showMessage('Account created! Check your email to confirm, then sign in.', 'success');
      document.querySelector('[data-auth-tab="signin"]').click();
    } catch (err) {
      showMessage(err.message || 'Could not create account. Please try again.', 'error');
    }
  });

  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    try {
      const supabase = await HideawayAuth.init();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await HideawayAuth.getProfile();
      redirectAfterAuth(profile?.member_type || 'fan');
    } catch (err) {
      showMessage(err.message || 'Could not sign in. Check your email and password.', 'error');
    }
  });

  boot();
})();