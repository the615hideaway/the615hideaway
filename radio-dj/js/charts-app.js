(function () {
  const weekEl = document.getElementById('charts-week');
  const monthEl = document.getElementById('charts-month');
  const logoutBtn = document.getElementById('logout-btn');

  SiteNav.bindLogout(logoutBtn, () => SiteNav.init('charts'));

  async function init() {
    weekEl.innerHTML = '<p class="charts-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading charts…</p>';
    monthEl.innerHTML = '';

    try {
      await Charts.loadInto(weekEl, monthEl, { limit: 50 });
    } catch (err) {
      weekEl.innerHTML = `<p class="charts-empty">${Utils.escapeHtml(err.message)}</p>`;
      monthEl.innerHTML = '';
    }
  }

  DjBoot.bootPage({
    onAuthenticated: () => SiteNav.init('charts'),
    onGuest: () => SiteNav.init('charts'),
  }).then(init);
})();