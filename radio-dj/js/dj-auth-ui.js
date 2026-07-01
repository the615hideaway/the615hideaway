const DjAuthUI = {
  init(options = {}) {
    const gate = document.getElementById('login-gate');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginError = document.getElementById('login-error');
    let signupError = document.getElementById('signup-error');
    const tabs = gate ? gate.querySelectorAll('[data-auth-tab]') : [];
    const panels = gate ? gate.querySelectorAll('[data-auth-panel]') : [];
    const onAuthenticated = options.onAuthenticated || (() => {});

    const ensureSignupError = () => {
      let el = document.getElementById('signup-error');
      if (el || !signupForm) return el;

      el = document.createElement('div');
      el.id = 'signup-error';
      el.className = 'login-error';
      el.setAttribute('role', 'alert');
      el.setAttribute('aria-live', 'polite');
      el.hidden = true;

      const submitBtn = signupForm.querySelector('button[type="submit"]');
      if (submitBtn) signupForm.insertBefore(el, submitBtn);
      else signupForm.appendChild(el);

      return el;
    };

    const showError = (el, message) => {
      if (!el || !message) return;
      el.textContent = message;
      el.hidden = false;
      el.classList.add('show');
    };

    const clearErrors = () => {
      [loginError, document.getElementById('signup-error')].forEach((el) => {
        if (!el) return;
        el.textContent = '';
        el.hidden = true;
        el.classList.remove('show');
      });
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

    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'signup' || tabParam === 'signin' || tabParam === 'login') {
      switchTab(tabParam === 'signup' ? 'signup' : 'login');
    }

    if (typeof DjSignupForm !== 'undefined') {
      DjSignupForm.mount();
    }

    const loginPassword = document.getElementById('login-password');
    if (loginPassword && !loginPassword.dataset.showToggle) {
      loginPassword.dataset.showToggle = '1';
      const showPassword = document.createElement('label');
      showPassword.className = 'login-show-password';
      showPassword.innerHTML = '<input type="checkbox"> Show password';
      showPassword.querySelector('input').addEventListener('change', (event) => {
        loginPassword.type = event.target.checked ? 'text' : 'password';
      });
      loginPassword.insertAdjacentElement('afterend', showPassword);
    }

    loginForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors();

      const email = String(document.getElementById('login-email')?.value || '').trim();
      const password = String(document.getElementById('login-password')?.value || '').trim();
      const submitBtn = loginForm.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';

      try {
        await DjAuth.login(email, password);
        loginForm.reset();
        DjAuthUI.updateWelcome();
        onAuthenticated();
      } catch (err) {
        showError(loginError, err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    signupForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearErrors();

      const submitBtn = signupForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating account…';

      try {
        const fields = typeof DjSignupForm !== 'undefined'
          ? DjSignupForm.collect()
          : {
            firstName: document.getElementById('signup-name')?.value || '',
            lastName: '',
            programName: document.getElementById('signup-show')?.value || '',
            stationCallLetters: document.getElementById('signup-station')?.value || '',
            email: document.getElementById('signup-email')?.value || '',
            password: document.getElementById('signup-password')?.value || '',
            shareEmail: !!document.getElementById('signup-share-email')?.checked,
          };
        await DjAuth.signup(fields);
        signupForm.reset();
        DjAuthUI.updateWelcome();
        onAuthenticated();
      } catch (err) {
        showError(ensureSignupError(), err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    return { switchTab, clearErrors };
  },

  updateWelcome() {
    const welcome = document.getElementById('dj-welcome');
    if (!welcome) return;

    const dj = DjAuth.getDj();
    if (!dj) {
      welcome.classList.add('hidden');
      welcome.textContent = '';
      return;
    }

    const name = [dj.firstName, dj.lastName].filter(Boolean).join(' ') || dj.name || dj.email;
    const station = dj.stationCallLetters || dj.station;
    const program = dj.programName || dj.showName;
    const tail = station || program;
    welcome.textContent = tail ? `${name} · ${tail}` : name;
    welcome.classList.remove('hidden');
  },

  bindLogout(button, onLogout) {
    button?.addEventListener('click', async () => {
      await DjAuth.logout();
      DjAuthUI.updateWelcome();
      onLogout();
    });
  },
};