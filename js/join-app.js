(function () {
  const formError = document.getElementById('form-error');
  const formSuccess = document.getElementById('form-success');
  const setupNotice = document.getElementById('setup-notice');
  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');
  const tabs = document.querySelectorAll('[data-auth-tab]');
  const panels = document.querySelectorAll('[data-auth-panel]');

  function showError(message) {
    formSuccess.classList.add('hidden');
    formError.textContent = message;
    formError.classList.remove('hidden');
  }

  function showSuccess(message) {
    formError.classList.add('hidden');
    formSuccess.textContent = message;
    formSuccess.classList.remove('hidden');
  }

  function clearMessages() {
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');
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
      clearMessages();
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
      setupNotice.classList.add('hidden');
    } catch (err) {
      setupNotice.classList.remove('hidden');
      setupNotice.textContent = err.message;
      signupForm.querySelector('button[type="submit"]').disabled = true;
      signinForm.querySelector('button[type="submit"]').disabled = true;
    }
  }

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();

    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !email || password.length < 8) {
      showError('Enter your name, email, and a password with at least 8 characters.');
      return;
    }

    try {
      const supabase = await HideawayAuth.init();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/account`
        }
      });

      if (error) throw error;

      if (data.session) {
        window.location.href = '/account';
        return;
      }

      showSuccess('Check your email to confirm your account, then sign in.');
      document.querySelector('[data-auth-tab="signin"]').click();
    } catch (err) {
      showError(err.message || 'Could not create account. Please try again.');
    }
  });

  signinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessages();

    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;

    try {
      const supabase = await HideawayAuth.init();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = '/account';
    } catch (err) {
      showError(err.message || 'Could not sign in. Check your email and password.');
    }
  });

  boot();
})();