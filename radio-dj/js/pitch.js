const TurnkeyPitch = {
  namingExample: 'Song Title - Artist Name',

  benefitItem(icon, text) {
    return `<li><i class="fa-solid ${icon}" aria-hidden="true"></i><span>${text}</span></li>`;
  },

  infographicCard(type, page) {
    const isActive = page === type;
    const activeClass = isActive ? ' is-highlighted' : '';

    if (type === 'dj') {
      return `
        <article class="pitch-infographic-card pitch-infographic-card--dj${activeClass}">
          <header class="pitch-infographic-card-head">
            <span class="pitch-infographic-icon" aria-hidden="true"><i class="fa-solid fa-tower-broadcast"></i></span>
            <div>
              <p class="pitch-infographic-kicker">For radio programmers</p>
              <h3 class="pitch-infographic-title">DJs get this</h3>
            </div>
          </header>
          <ul class="pitch-benefit-list">
            ${this.benefitItem('fa-compact-disc', '<strong>Free DJ account</strong> — browse the full catalog')}
            ${this.benefitItem('fa-headphones', '<strong>Preview tracks</strong> before you commit')}
            ${this.benefitItem('fa-folder-open', '<strong>Turn-key folders</strong> — MP3, cover art &amp; one-sheet PDF')}
            ${this.benefitItem('fa-envelope', '<strong>WAV on request</strong> — email the artist from any song page')}
            ${this.benefitItem('fa-file-zipper', 'Named <em>' + this.namingExample + '</em> — drop straight into your library')}
            ${this.benefitItem('fa-chart-line', '<strong>Dashboard</strong> — track what you already downloaded')}
          </ul>
          <div class="pitch-infographic-ctas">
            <a href="index.html?demo=1" class="pitch-cta-btn pitch-cta-btn--primary">
              <i class="fa-solid fa-play" aria-hidden="true"></i>
              <span>Try demo catalog</span>
              <small>No sign-in — play &amp; preview one-sheet</small>
            </a>
            <a href="dj-dashboard.html?demo=1" class="pitch-cta-btn">
              <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
              <span>Preview DJ dashboard</span>
              <small>Real sample stats &amp; history</small>
            </a>
          </div>
        </article>`;
    }

    if (type === 'label') {
      return `
        <article class="pitch-infographic-card pitch-infographic-card--label${activeClass}">
          <header class="pitch-infographic-card-head">
            <span class="pitch-infographic-icon pitch-infographic-icon--label" aria-hidden="true"><i class="fa-solid fa-building"></i></span>
            <div>
              <p class="pitch-infographic-kicker">For record labels</p>
              <h3 class="pitch-infographic-title">Labels get this</h3>
            </div>
          </header>
          <ul class="pitch-benefit-list">
            ${this.benefitItem('fa-users', '<strong>Artist roster</strong> — create profiles for artists who won&apos;t log in')}
            ${this.benefitItem('fa-cloud-arrow-up', '<strong>Submit songs</strong> — send new singles from your dashboard')}
            ${this.benefitItem('fa-star', '<strong>Spotlight picks</strong> — feature catalog highlights for new stations')}
            ${this.benefitItem('fa-tower-broadcast', '<strong>See every spin</strong> — which DJs downloaded across your roster')}
            ${this.benefitItem('fa-share-nodes', '<strong>Charts to share</strong> — screenshot momentum for social')}
            ${this.benefitItem('fa-wand-magic-sparkles', '<strong>Turn-key promo</strong> — we build folders from <strong class="turnkey-price">$5</strong>/song')}
          </ul>
          <div class="pitch-infographic-ctas">
            <a href="artist-dashboard.html#label-signup" class="pitch-cta-btn pitch-cta-btn--primary pitch-cta-btn--label">
              <i class="fa-solid fa-building" aria-hidden="true"></i>
              <span>Create label account</span>
              <small>Sign up — roster &amp; song submit</small>
            </a>
            <a href="artist-dashboard.html?demo=1" class="pitch-cta-btn pitch-cta-btn--label-outline">
              <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
              <span>Preview label dashboard</span>
              <small>Sample spins, charts &amp; promo ZIPs</small>
            </a>
          </div>
        </article>`;
    }

    return `
      <article class="pitch-infographic-card pitch-infographic-card--artist${activeClass}">
        <header class="pitch-infographic-card-head">
          <span class="pitch-infographic-icon pitch-infographic-icon--artist" aria-hidden="true"><i class="fa-solid fa-microphone"></i></span>
          <div>
            <p class="pitch-infographic-kicker">For artists</p>
            <h3 class="pitch-infographic-title">Artists get this</h3>
          </div>
        </header>
        <ul class="pitch-benefit-list">
          ${this.benefitItem('fa-wand-magic-sparkles', '<strong>We build your promo</strong> — turn-key from <strong class="turnkey-price">$5</strong>')}
          ${this.benefitItem('fa-file-zipper', '<strong>Download your ZIP folders</strong> — MP3, cover &amp; one-sheet like DJs get')}
          ${this.benefitItem('fa-paper-plane', '<strong>Email or share</strong> with DJs not on Radio Now')}
          ${this.benefitItem('fa-tower-broadcast', '<strong>See every spin</strong> — station &amp; DJ info when shared')}
          ${this.benefitItem('fa-trophy', '<strong>Chart career history</strong> — best ranks for your next pitch sheet')}
          ${this.benefitItem('fa-share-nodes', '<strong>Charts to screenshot</strong> — post your radio momentum')}
        </ul>
        <div class="pitch-infographic-ctas">
          <a href="index.html?demo=1" class="pitch-cta-btn pitch-cta-btn--primary pitch-cta-btn--artist">
            <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
            <span>Try free one-sheet demo</span>
            <small>See the PDF DJs receive — no sign-in</small>
          </a>
          <a href="artist-dashboard.html?demo=1" class="pitch-cta-btn pitch-cta-btn--artist-outline">
            <i class="fa-solid fa-microphone" aria-hidden="true"></i>
            <span>Preview artist dashboard</span>
            <small>Real sample stats &amp; spin history</small>
          </a>
        </div>
      </article>`;
  },

  loginHeroHtml(page = 'dj') {
    return `
      <section class="turnkey-pitch turnkey-pitch--hero" aria-label="Radio Now for DJs, artists, and labels">
        <div class="turnkey-pitch-inner">
          <p class="turnkey-eyebrow"><i class="fa-solid fa-bolt"></i> One platform · Three audiences</p>
          <h2 class="turnkey-headline">Turn-key radio promo — built for DJs, artists &amp; labels</h2>
          <p class="turnkey-lead turnkey-lead--center">
            Every song = one folder with <strong>MP3, cover art &amp; PDF one-sheet</strong>, labeled <em>${this.namingExample}</em>.
            DJs download for airplay. Need WAV? Request it from the artist in one click.
          </p>
          <div class="pitch-infographic-grid pitch-infographic-grid--triple">
            ${this.infographicCard('dj', page)}
            ${this.infographicCard('artist', page)}
            ${this.infographicCard('label', page)}
          </div>
          <p class="pitch-infographic-footer">Pick your account type below to sign in or create a free account.</p>
        </div>
      </section>`;
  },

  catalogStripHtml() {
    return `
      <section class="turnkey-pitch turnkey-pitch--strip" aria-label="Turn-key downloads">
        <div class="turnkey-strip-main">
          <span class="turnkey-strip-badge"><i class="fa-solid fa-folder-open"></i> Turn-key folders</span>
          <p>Each song downloads as <strong>${this.namingExample}</strong> — MP3, cover art &amp; PDF one-sheet, named right and ready for your library.</p>
        </div>
        <p class="turnkey-strip-artist">Artists &amp; labels: full promo setup from <strong class="turnkey-price">$5</strong>/song. No tech required.</p>
      </section>`;
  },

  queueNoteHtml() {
    return `
      <p class="turnkey-queue-note">
        <i class="fa-solid fa-box-archive"></i>
        <span>Your ZIP unpacks into <strong>one folder per song</strong> — MP3, cover, and one-sheet PDF, each named <em>${this.namingExample}</em>. Unzip and go.</span>
      </p>`;
  },

  catalogStripDemoHtml() {
    return `
      <section class="turnkey-pitch turnkey-pitch--strip" aria-label="DJ catalog preview">
        <div class="turnkey-strip-main">
          <span class="turnkey-strip-badge"><i class="fa-solid fa-tower-broadcast"></i> FREE DJ account</span>
          <p>Preview the catalog, browse artists, and try a free one-sheet PDF. Sign up free to download full turn-key folders (<strong>${this.namingExample}</strong>).</p>
        </div>
      </section>`;
  },

  djDemoDetailNoteHtml() {
    return `
      <div class="turnkey-detail-note turnkey-detail-note--demo">
        <p class="turnkey-detail-kicker"><i class="fa-solid fa-tower-broadcast"></i> Free for DJs</p>
        <p class="turnkey-detail-title">FREE DJ account</p>
        <p class="turnkey-detail-copy">Browse the catalog, preview tracks, and download turn-key folders — MP3, cover art &amp; one-sheet PDF. Create a <strong>free DJ account</strong> to unlock full ZIP downloads.</p>
        <p class="turnkey-detail-copy">Try the sample one-sheet PDF below — the same pro sheet DJs get in every folder (<strong>${this.namingExample} OneSheet.pdf</strong>).</p>
      </div>`;
  },

  detailNoteHtml(isDemo = false) {
    if (isDemo) {
      return this.djDemoDetailNoteHtml();
    }

    return `
      <div class="turnkey-detail-note">
        <p class="turnkey-detail-kicker"><i class="fa-solid fa-folder-open"></i> Turn-key download</p>
        <p class="turnkey-detail-copy">Queue a ZIP with <strong>MP3</strong>, cover art, and <strong>OneSheet.pdf</strong>. Broadcast WAV is available on request — use the email button above.</p>
      </div>`;
  },

  shouldHideAppPromo() {
    if (typeof Demo !== 'undefined' && Demo.isActive()) return false;
    if (typeof DjAuth !== 'undefined' && DjAuth.isAuthenticated()) return true;
    if (typeof ArtistAuth !== 'undefined' && ArtistAuth.isAuthenticated()) return true;
    return false;
  },

  hideAppPromo() {
    ['turnkey-pitch-catalog', 'turnkey-pitch-queue'].forEach((id) => {
      const slot = document.getElementById(id);
      if (!slot) return;
      slot.innerHTML = '';
      slot.classList.add('hidden');
    });
  },

  mountCatalogPromo() {
    if (this.shouldHideAppPromo()) {
      this.hideAppPromo();
      return;
    }

    const catalogSlot = document.getElementById('turnkey-pitch-catalog');
    if (catalogSlot) {
      catalogSlot.classList.remove('hidden');
      const inDemo = typeof Demo !== 'undefined' && Demo.isActive();
      catalogSlot.innerHTML = inDemo ? this.catalogStripDemoHtml() : this.catalogStripHtml();
    }

    const queueSlot = document.getElementById('turnkey-pitch-queue');
    if (queueSlot) {
      queueSlot.classList.remove('hidden');
      queueSlot.innerHTML = this.queueNoteHtml();
    }
  },

  resolveLoginPage(loginSlot) {
    let page = loginSlot.dataset.page || 'dj';
    const hash = String(window.location.hash || '').replace('#', '').trim();
    if (hash === 'label-signup') return 'label';
    return page;
  },

  mount() {
    const loginSlot = document.getElementById('turnkey-pitch-login');
    if (loginSlot) {
      loginSlot.innerHTML = this.loginHeroHtml(this.resolveLoginPage(loginSlot));
    }

    this.mountCatalogPromo();
  },
};

TurnkeyPitch.mount();