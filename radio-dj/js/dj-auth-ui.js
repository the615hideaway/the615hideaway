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
    let profileCompletionActive = false;

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

    const ensureSignupNotice = () => {
      let el = document.getElementById('signup-notice');
      if (el || !signupForm) return el;

      el = document.createElement('div');
      el.id = 'signup-notice';
      el.className = 'login-notice';
      el.hidden = true;

      const submitBtn = signupForm.querySelector('button[type="submit"]');
      if (submitBtn) signupForm.insertBefore(el, submitBtn);
      else signupForm.appendChild(el);

      return el;
    };

    const showAlert = (el, message, type) => {
      if (!el || !message) return;
      el.textContent = message;
      el.hidden = false;
      el.classList.remove('login-error', 'login-notice');
      el.classList.add(type === 'success' ? 'login-notice' : 'login-error', 'show');
    };

    const showError = (el, message) => showAlert(el, message, 'error');

    const showSuccess = (el, message) => showAlert(el, message, 'success');

    const clearErrors = () => {
      [loginError, document.getElementById('signup-error'), document.getElementById('signup-notice')].forEach((el) => {
        if (!el) return;
        el.textContent = '';
        el.hidden = true;
        el.classList.remove('show', 'login-error', 'login-notice');
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

    const showProfileCompletion = async () => {
      profileCompletionActive = true;
      switchTab('signup');
      if (typeof DjSignupForm !== 'undefined') {
        DjSignupForm.mount({ mode: 'complete' });
        await DjSignupForm.prefillFromSession('complete');
      }
      showSuccess(
        ensureSignupNotice(),
        'You are signed in. Add your station and program details, then save to open the catalog.'
      );
    };

    const isCompleteMode = () =>
      profileCompletionActive || signupForm?.dataset.djSignupMode === 'complete';

    if (typeof DjSignupForm !== 'undefined') {
      DjSignupForm.mount();
    }

    const loginPassword = document.getElementById('login-password');
    if (loginPassword && !loginPassword.dataset.showToggle) {
      loginPassword.dataset.showToggle = '1';
      const showPassword = document.createElement('label');
      showPassword.className = 'login-show-password';
      showPassword.innerHTML = '<input type="checkbox" aria-label="Show Password"> Show Password';
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
        if (typeof DjBoot !== 'undefined') DjBoot.markAuthenticated();
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
        const completeMode = isCompleteMode();
        const fields = typeof DjSignupForm !== 'undefined'
          ? DjSignupForm.collect(completeMode ? 'complete' : 'signup')
          : {
            firstName: document.getElementById('signup-name')?.value || '',
            lastName: '',
            programName: document.getElementById('signup-show')?.value || '',
            stationCallLetters: document.getElementById('signup-station')?.value || '',
            email: document.getElementById('signup-email')?.value || '',
            password: document.getElementById('signup-password')?.value || '',
            shareEmail: !!document.getElementById('signup-share-email')?.checked,
          };

        if (completeMode) {
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving profile…';
          await DjAuth.saveProfileFromFields(fields);
          profileCompletionActive = false;
          signupForm.reset();
          DjAuthUI.updateWelcome();
          if (typeof DjBoot !== 'undefined') DjBoot.markAuthenticated();
          onAuthenticated();
          return;
        }

        const result = await DjAuth.signup(fields);
        if (result?.pendingConfirmation) {
          signupForm.reset();
          showSuccess(
            ensureSignupNotice(),
            'Account created for ' + result.email + '. Check your inbox (and spam) for a confirmation email from The 615 Hideaway. Click the link, then sign in below with the same password.'
          );
          switchTab('login');
          const loginEmail = document.getElementById('login-email');
          if (loginEmail) loginEmail.value = result.email;
          return;
        }
        signupForm.reset();
        DjAuthUI.updateWelcome();
        if (typeof DjBoot !== 'undefined') DjBoot.markAuthenticated();
        onAuthenticated();
      } catch (err) {
        showError(ensureSignupError(), err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });

    const checkAfterBoot = async () => {
      if (typeof DjAuth !== 'undefined' && DjAuth.getSession()?.dj) {
        await DjAuth.ensureDjEmailOnCachedSession();
        return false;
      }

      if (typeof DjBoot !== 'undefined' && DjBoot.needsProfileCompletion?.()) {
        DjBoot.consumeNeedsProfileCompletion();
        await showProfileCompletion();
        return true;
      }

      try {
        if (await DjAuth.needsProfileCompletion()) {
          await showProfileCompletion();
          return true;
        }
      } catch (_) {}

      return false;
    };

    return { switchTab, clearErrors, showBootMessage, showProfileCompletion, checkAfterBoot };
  },

  showBootMessage(onAuthenticated) {
    const gate = document.getElementById('login-gate');
    if (!gate) return;

    const loginError = document.getElementById('login-error');
    const bootMessage = typeof DjBoot !== 'undefined' ? DjBoot.consumeMessage() : '';
    if (!bootMessage) return;

    const needsProfile = bootMessage.toLowerCase().includes('finish your dj profile');
    const isSuccess = bootMessage.toLowerCase().includes('confirmed') || bootMessage.toLowerCase().includes('welcome');
    if (isSuccess && typeof DjAuth !== 'undefined' && DjAuth.isAuthenticated()) {
      onAuthenticated?.();
      return;
    }
    if (needsProfile) return;

    if (loginError) {
      loginError.textContent = bootMessage;
      loginError.hidden = false;
      loginError.classList.remove('login-notice');
      loginError.classList.add(isSuccess ? 'login-notice' : 'login-error', 'show');
    }

    const tabs = gate.querySelectorAll('[data-auth-tab]');
    const panels = gate.querySelectorAll('[data-auth-panel]');
    tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.authTab === 'login');
    });
    panels.forEach((panel) => {
      panel.classList.toggle('hidden', panel.dataset.authPanel !== 'login');
    });
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
      button.disabled = true;
      try {
        if (typeof AccountAuth !== 'undefined') {
          await AccountAuth.logout();
        } else {
          await DjAuth.logout();
        }
        DjAuthUI.updateWelcome();
        if (typeof ArtistAuthUI !== 'undefined') ArtistAuthUI.updateWelcome();
        if (typeof SiteNav !== 'undefined') {
          const nav = document.querySelector('[data-site-nav]');
          SiteNav.init(nav?.dataset.navActive);
        }
        onLogout?.();
      } finally {
        button.disabled = false;
      }
    });
  },
};