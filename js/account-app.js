(function () {
  const ROADMAPS = {
    fan: {
      label: 'Fan / Listener',
      now: ['New music alerts from David Parmley and the roster', 'Artist Mindset articles (rolling out next)'],
      next: 'Bluegrass Hideaway member videos, trivia, and email preferences',
      eta: 'Phase 2 — starts Wednesday'
    },
    artist: {
      label: 'Artist',
      now: ['Your account is saved — we know you\'re an artist', 'David Parmley\'s profile is the template for roster pages'],
      next: 'Your own artist page at /artists/your-name after roster review, plus /distribute track submissions',
      eta: 'Artist pages — Phase 2 (Wednesday+). Roster review required.'
    },
    dj: {
      label: 'DJ / Radio Programmer',
      now: ['Radio Now catalog is live now (separate login for now)', 'Your DJ account here will link to it later'],
      next: '/radio-dj portal — stream, preview, and download broadcast files with one login',
      eta: 'Phase 2 — Wednesday+'
    },
    festival: {
      label: 'Festival / Venue',
      now: ['Account saved with festival/venue intent'],
      next: '/field-guide/locator — map listing for jams, picking circles, and festivals',
      eta: 'Phase 3 — after core site rebuild'
    },
    industry: {
      label: 'Label / Publicist / Industry',
      now: ['Account saved for industry access'],
      next: '/publicist PR upload wire and label admin tools',
      eta: 'Phase 3 — after artist & DJ portals'
    }
  };

  const gate = document.getElementById('account-gate');
  const panel = document.getElementById('account-panel');
  const setupNotice = document.getElementById('setup-notice');
  const welcomeName = document.getElementById('welcome-name');
  const memberEmail = document.getElementById('member-email');
  const memberType = document.getElementById('member-type');
  const memberRole = document.getElementById('member-role');
  const memberSince = document.getElementById('member-since');
  const roadmapLabel = document.getElementById('roadmap-label');
  const roadmapNow = document.getElementById('roadmap-now');
  const roadmapNext = document.getElementById('roadmap-next');
  const roadmapEta = document.getElementById('roadmap-eta');
  const logoutBtn = document.getElementById('logout-btn');

  function formatDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function renderRoadmap(type) {
    const roadmap = ROADMAPS[type] || ROADMAPS.fan;
    roadmapLabel.textContent = roadmap.label;
    roadmapNow.innerHTML = roadmap.now.map((item) => `<li>${item}</li>`).join('');
    roadmapNext.textContent = roadmap.next;
    roadmapEta.textContent = roadmap.eta;
  }

  async function boot() {
    try {
      const session = await HideawayAuth.getSession();
      if (!session) {
        window.location.href = '/join';
        return;
      }

      setupNotice.classList.add('hidden');
      const profile = await HideawayAuth.getProfile();
      const type = profile?.member_type || session.user.user_metadata?.member_type || 'fan';

      welcomeName.textContent = profile?.display_name || session.user.email;
      memberEmail.textContent = profile?.email || session.user.email;
      memberType.textContent = (ROADMAPS[type] || ROADMAPS.fan).label;
      memberRole.textContent = profile?.role || 'member';
      memberSince.textContent = formatDate(profile?.created_at || session.user.created_at);
      renderRoadmap(type);

      gate.classList.add('hidden');
      panel.classList.remove('hidden');
    } catch (err) {
      setupNotice.classList.remove('hidden');
      setupNotice.textContent = err.message;
    }
  }

  logoutBtn.addEventListener('click', async () => {
    try {
      await HideawayAuth.signOut();
      window.location.href = '/';
    } catch (err) {
      alert(err.message || 'Could not sign out.');
    }
  });

  boot();
})();