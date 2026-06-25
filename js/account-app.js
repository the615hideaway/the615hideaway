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
      now: ['Edit your artist page in the Artist Portal', 'Bio, photo, streaming, Bandsintown, booking — you control it'],
      next: 'Publish at /artists/your-name — your live artist website on the615hideaway.com',
      eta: 'Live now — publish when your page is ready'
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
  const gateMessage = document.getElementById('account-gate-message');
  const gateError = document.getElementById('account-gate-error');
  const gateActions = document.getElementById('account-gate-actions');
  const panel = document.getElementById('account-panel');
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
  const artistPortalBtn = document.getElementById('artist-portal-btn');

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
    roadmapNow.innerHTML = roadmap.now.map((item) => '<li>' + item + '</li>').join('');
    roadmapNext.textContent = roadmap.next;
    roadmapEta.textContent = roadmap.eta;
  }

  function showGateError(message, showActions) {
    gateMessage.classList.add('hidden');
    gateError.textContent = message;
    gateError.classList.remove('hidden');
    gate.classList.remove('hidden');
    panel.classList.add('hidden');
    if (showActions) gateActions.classList.remove('hidden');
  }

  async function boot() {
    try {
      await HideawayAuth.init();

      const hashError = HideawayAuth.parseAuthHashError();
      if (hashError) {
        HideawayAuth.clearAuthHash();
      }

      const session = await HideawayAuth.getSession();

      if (!session) {
        if (hashError) {
          showGateError(
            'That email link expired — but your account may already be active. Sign in below.',
            true
          );
          return;
        }
        window.location.href = '/join';
        return;
      }

      if (hashError) {
        HideawayAuth.clearAuthHash();
      }

      const profile = await HideawayAuth.getProfile();
      const type = profile?.member_type || session.user.user_metadata?.member_type || 'fan';

      welcomeName.textContent = profile?.display_name || session.user.email;
      memberEmail.textContent = profile?.email || session.user.email;
      memberType.textContent = (ROADMAPS[type] || ROADMAPS.fan).label;
      memberRole.textContent = profile?.role || 'member';
      memberSince.textContent = formatDate(profile?.created_at || session.user.created_at);
      renderRoadmap(type);

      if (artistPortalBtn && (type === 'artist' || profile?.role === 'artist' || profile?.role === 'admin')) {
        artistPortalBtn.classList.remove('hidden');
      }

      gate.classList.add('hidden');
      panel.classList.remove('hidden');
    } catch (err) {
      showGateError(
        (err.message || 'Could not load your account.') +
          ' Try signing in again. Artists: run migration-member-type.sql and migration-artists.sql in Supabase if this persists.',
        true
      );
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