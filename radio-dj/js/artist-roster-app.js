(function () {
  function renderRoster(items) {
    const list = document.getElementById('label-roster-list');
    if (!list) return;

    if (!items?.length) {
      list.innerHTML = `
        <div class="empty-state dj-empty-state">
          <i class="fa-solid fa-users"></i>
          <p>No artist profiles yet. Create one below — artists can claim it later.</p>
        </div>`;
      return;
    }

    list.innerHTML = items.map((entry) => {
      const profile = entry.profile || {};
      const status = profile.ownershipStatus === 'claimed' ? 'Claimed' : 'Unclaimed';
      return `
        <article class="label-roster-item">
          <strong>${Utils.escapeHtml(profile.artistName || 'Artist')}</strong>
          <span class="label-roster-status">${Utils.escapeHtml(status)}</span>
        </article>`;
    }).join('');
  }

  function bindCreateProfileForm(onCreated) {
    const form = document.getElementById('create-profile-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    const errorEl = document.getElementById('create-profile-error');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorEl?.classList.remove('show');

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating…';

      try {
        await ArtistAuth.createArtistProfile({
          artistName: document.getElementById('create-profile-artist-name')?.value || '',
          claimEmail: document.getElementById('create-profile-claim-email')?.value || '',
        });
        form.reset();
        await onCreated();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.classList.add('show');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  }

  async function loadRoster() {
    const data = await ArtistActivity.fetchDashboard();
    renderRoster(data.managedProfiles || []);
    return data;
  }

  ArtistPortalAuth.initPage({
    activeNav: 'roster',
    onReady({ account, isDemoMode, isLabel }) {
      if (!isLabel && !isDemoMode) {
        window.location.replace('artist-dashboard.html');
        return;
      }

      const name = account?.artistName || 'Your label';
      const copy = document.getElementById('page-copy');
      if (copy) copy.textContent = `${name} — artist profiles for your roster. Artists can claim later and keep chart history.`;

      if (isDemoMode) {
        renderRoster([]);
        return;
      }

      bindCreateProfileForm(loadRoster);
      loadRoster();
    },
  });
})();