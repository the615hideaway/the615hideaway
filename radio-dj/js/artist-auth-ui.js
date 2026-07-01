const ArtistAuthUI = {
  init(options = {}) {
    const gate = document.getElementById('login-gate');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const labelSignupForm = document.getElementById('label-signup-form');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    const labelSignupError = document.getElementById('label-signup-error');
    const tabs = gate ? gate.querySelectorAll('[data-auth-tab]') : [];
    const panels = gate ? gate.querySelectorAll('[data-auth-panel]') : [];
    const onAuthenticated = options.onAuthenticated || (() => {});

    const showError = (el, message) => {
      if (!el) return;
      el.textContent = message;
      el.classList.add('show');
    };

    const clearErrors = () => {
      loginError?.classList.remove('show');
      signupError?.classList.remove('show');
      labelSignupError?.classList.remove('show');
    };

    const switchTab = (tabName) => {
      tabs.forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.authTab === tabName);
      });
      panels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.authPanel !== tabName);
      });
      clearErrors();
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.authTab));
    });

    const hashTab = String(window.location.hash || '').replace('#', '').trim();
    if (hashTab && gate?.querySelector(`[data-auth-tab="${hashTab}"]`)) {
      switchTab(hashTab);
    }

    if (hashTab === 'label-signup' && gate) {
      gate.querySelectorAll('.account-role-card').forEach((card) => {
        const isLabel = card.classList.contains('account-role-card--label');
        card.classList.toggle('is-active', isLabel);
        if (isLabel) card.setAttribute('aria-current', 'page');
        else card.removeAttribute('aria-current');
      });
    }

    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors();

      const email = document.getElementById('login-email')?.value || '';
      const password = document.getElementById('login-password')?.value || '';
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

      try {
        await ArtistAuth.login(email, password);
        loginForm.reset();
        ArtistAuthUI.updateWelcome();
        onAuthenticated();
      } catch (err) {
        showError(loginError, err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    labelSignupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors();

      const password = document.getElementById('label-signup-password')?.value || '';
      const confirm = document.getElementById('label-signup-password-confirm')?.value || '';
      const submitBtn = labelSignupForm.querySelector('button[type="submit"]');

      if (password !== confirm) {
        showError(labelSignupError, 'Passwords do not match.');
        return;
      }

      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';

      try {
        await ArtistAuth.signupLabel({
          labelName: document.getElementById('signup-label-name')?.value || '',
          email: document.getElementById('label-signup-email')?.value || '',
          password,
        });
        labelSignupForm.reset();
        ArtistAuthUI.updateWelcome();
        onAuthenticated();
      } catch (err) {
        showError(labelSignupError, err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    signupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors();

      const password = document.getElementById('signup-password')?.value || '';
      const confirm = document.getElementById('signup-password-confirm')?.value || '';
      const submitBtn = signupForm.querySelector('button[type="submit"]');

      if (password !== confirm) {
        showError(signupError, 'Passwords do not match.');
        return;
      }

      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';

      try {
        await ArtistAuth.signup({
          artistName: document.getElementById('signup-artist-name')?.value || '',
          email: document.getElementById('signup-email')?.value || '',
          password,
        });
        signupForm.reset();
        ArtistAuthUI.updateWelcome();
        onAuthenticated();
      } catch (err) {
        showError(signupError, err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    return { switchTab, clearErrors };
  },

  updateWelcome() {
    const welcome = document.getElementById('artist-welcome');
    if (!welcome) return;

    const artist = ArtistAuth.getArtist();
    if (!artist) {
      welcome.classList.add('hidden');
      welcome.textContent = '';
      return;
    }

    const prefix = String(artist.accountType || '').toLowerCase() === 'label' ? 'Label: ' : '';
    welcome.textContent = prefix + (artist.artistName || artist.email);
    welcome.classList.remove('hidden');
  },

  bindLogout(button, onLogout) {
    button?.addEventListener('click', () => {
      ArtistAuth.logout();
      ArtistAuthUI.updateWelcome();
      onLogout();
    });
  },
};