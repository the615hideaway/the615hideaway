const MemberAuthUI = {
  init(options = {}) {
    const onAuthenticated = options.onAuthenticated || (() => {});
    const roleButtons = document.querySelectorAll('[data-member-role]');
    const panels = document.querySelectorAll('[data-member-panel]');

    const switchRole = (role) => {
      roleButtons.forEach((btn) => {
        const active = btn.dataset.memberRole === role;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      panels.forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.memberPanel !== role);
      });
    };

    roleButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchRole(btn.dataset.memberRole));
    });

    const bindLogin = (formId, errorId, loginFn, clearOtherSession) => {
      const form = document.getElementById(formId);
      const errorEl = document.getElementById(errorId);
      if (!form) return;

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.classList.remove('show');
        }

        const email = String(form.querySelector('[type="email"]')?.value || '').trim();
        const password = String(form.querySelector('[type="password"]')?.value || '').trim();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalHtml = submitBtn?.innerHTML;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing in…';
        }

        try {
          await loginFn(email, password);
          form.reset();
          onAuthenticated();
        } catch (err) {
          if (errorEl) {
            errorEl.textContent = err.message || 'Sign in failed.';
            errorEl.classList.add('show');
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalHtml;
          }
        }
      });
    };

    bindLogin('dj-login-form', 'dj-login-error', (email, password) => DjAuth.login(email, password));
    bindLogin('artist-login-form', 'artist-login-error', (email, password) => ArtistAuth.login(email, password));

    const defaultRole = AccountAuth.getRole() === 'artist' ? 'artist' : 'dj';
    switchRole(defaultRole);

    return { switchRole };
  },
};