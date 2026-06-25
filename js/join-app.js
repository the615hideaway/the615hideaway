(function () {
  const authMessage = document.getElementById('auth-message');
  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const panels = document.querySelectorAll('[data-auth-panel]');

  function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = 'auth-alert auth-alert--' + type;
    authMessage.classList.remove('hidden');
  }

  function clearMessage() {
    authMessage.textContent = '';
    authMessage.className = 'auth-alert hidden';
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

  async function boot() {
    try {
      const supabase = await HideawayAuth.init();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        window.location.href = '/account';
        return;
      }
      clearMessage();
    } catch (err) {
      showMessage(err.message, 'warn');
      signupForm.querySelector('button[type="submit"]').disabled = true;
      signinForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();

    const name = document.getElementById('signup-name').value.trim();
    const memberType = document.getElementById('signup-type').value;
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

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
          member_type: memberType
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
        window.location.href = '/account';
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
      window.location.href = '/account';
    } catch (err) {
      showMessage(err.message || 'Could not sign in. Check your email and password.', 'error');
    }
  });

  boot();
})();