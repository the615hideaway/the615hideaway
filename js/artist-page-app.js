(function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || window.location.pathname.split('/').filter(Boolean).pop();
  const root = document.getElementById('artist-page-root');

  function bandsintownEmbed(url) {
    if (!url) return '';
    const match = url.match(/\/a\/(\d+)/);
    const artistId = match ? 'id_' + match[1] : null;
    if (!artistId) {
      return '<p class="auth-footnote"><a href="' + HideawayUtils.escapeHtml(url) + '" target="_blank" rel="noopener">View tour dates on Bandsintown</a></p>';
    }
    return (
      '<div class="tour-widget-wrap">' +
      '<a class="bit-widget-initializer" data-artist-name="' + artistId + '" data-display-local-dates="false" data-display-past-dates="false" data-auto-style="false" data-background-color="rgba(20,20,20,1)" data-separator-color="rgba(42,42,42,1)" data-text-color="rgba(255,255,255,1)" data-link-color="rgba(255,213,79,1)" data-button-color="rgba(244,196,48,1)" data-button-label-color="rgba(17,17,17,1)" data-font="Inter" data-lang="en"></a>' +
      '</div>'
    );
  }

  function renderArtist(artist) {
    const photo = artist.photo_url
      ? '<img src="' + HideawayUtils.escapeHtml(artist.photo_url) + '" alt="' + HideawayUtils.escapeHtml(artist.display_name) + '" class="artist-page-photo">'
      : '<div class="artist-page-photo artist-page-photo--fallback">615</div>';

    const badge = artist.badge_text
      ? '<span class="artist-badge">' + HideawayUtils.escapeHtml(artist.badge_text) + '</span>'
      : '';

    const actions = [
      artist.streaming_url ? '<a href="' + HideawayUtils.escapeHtml(artist.streaming_url) + '" class="btn btn-primary" target="_blank" rel="noopener">Listen Now</a>' : '',
      artist.website_url ? '<a href="' + HideawayUtils.escapeHtml(artist.website_url) + '" class="btn btn-ghost" target="_blank" rel="noopener">Website</a>' : '',
      artist.bandsintown_url ? '<a href="' + HideawayUtils.escapeHtml(artist.bandsintown_url) + '" class="btn btn-ghost" target="_blank" rel="noopener">Tour Dates</a>' : ''
    ].filter(Boolean).join('');

    const booking = (artist.booking_email || artist.booking_phone)
      ? '<section class="section"><div class="container"><div class="section-header"><h2>Booking</h2></div><div class="contact-block">' +
        (artist.booking_email ? '<p>Email: <a href="mailto:' + HideawayUtils.escapeHtml(artist.booking_email) + '">' + HideawayUtils.escapeHtml(artist.booking_email) + '</a></p>' : '') +
        (artist.booking_phone ? '<p>Phone: <a href="tel:' + HideawayUtils.escapeHtml(artist.booking_phone.replace(/\D/g, '')) + '">' + HideawayUtils.escapeHtml(artist.booking_phone) + '</a></p>' : '') +
        '</div></div></section>'
      : '';

    root.innerHTML =
      '<section class="artist-hero"><div class="container artist-hero-grid"><div class="artist-photo">' + photo + '</div><div>' +
      badge +
      '<h1>' + HideawayUtils.escapeHtml(artist.display_name) + '</h1>' +
      '<p class="artist-bio">' + HideawayUtils.escapeHtml(artist.bio || 'Artist on The 615 Hideaway.') + '</p>' +
      '<div class="hero-actions">' + actions + '</div>' +
      '</div></div></section>' +
      (artist.bandsintown_url
        ? '<section class="section" id="tour-dates"><div class="container"><div class="section-header"><h2>Tour Dates</h2></div>' + bandsintownEmbed(artist.bandsintown_url) + '</div></section>'
        : '') +
      booking;

    if (artist.bandsintown_url && artist.bandsintown_url.match(/\/a\/(\d+)/)) {
      const script = document.createElement('script');
      script.src = 'https://widgetv3.bandsintown.com/main.min.js';
      script.charset = 'utf-8';
      document.body.appendChild(script);
    }

    document.title = artist.display_name + ' | The 615 Hideaway';
  }

  async function boot() {
    if (!slug || slug === 'page.html') {
      root.innerHTML = '<div class="container"><p class="auth-lead">Artist not found.</p></div>';
      return;
    }

    try {
      const supabase = await HideawayAuth.init();
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        root.innerHTML = '<div class="container"><p class="auth-lead">This artist page is not published yet.</p><p class="auth-footnote"><a href="/join">Join as an artist</a> to create yours.</p></div>';
        return;
      }

      renderArtist(data);
    } catch (err) {
      root.innerHTML = '<div class="container"><p class="auth-lead">Could not load artist page.</p></div>';
    }
  }

  boot();
})();