(function () {
  const authMessage = document.getElementById('auth-message');
  const gate = document.getElementById('portal-gate');
  const panel = document.getElementById('portal-panel');
  const form = document.getElementById('artist-form');
  const previewLink = document.getElementById('preview-link');
  const publishBtn = document.getElementById('publish-btn');
  const unpublishBtn = document.getElementById('unpublish-btn');
  const statusBadge = document.getElementById('status-badge');
  const pageUrl = document.getElementById('page-url');

  let currentArtist = null;

  function showMessage(message, type) {
    authMessage.textContent = message;
    authMessage.className = 'auth-alert auth-alert--' + type;
    authMessage.classList.remove('hidden');
  }

  function field(id) {
    return document.getElementById(id);
  }

  function fillForm(artist) {
    field('display-name').value = artist.display_name || '';
    field('slug').value = artist.slug || '';
    field('bio').value = artist.bio || '';
    field('photo-url').value = artist.photo_url || '';
    field('bandsintown-url').value = artist.bandsintown_url || '';
    field('streaming-url').value = artist.streaming_url || '';
    field('website-url').value = artist.website_url || '';
    field('booking-email').value = artist.booking_email || '';
    field('booking-phone').value = artist.booking_phone || '';
    field('badge-text').value = artist.badge_text || '';

    const isPublished = artist.status === 'published';
    statusBadge.textContent = isPublished ? 'Published' : 'Draft';
    statusBadge.className = 'status-badge ' + (isPublished ? 'status-badge--live' : 'status-badge--draft');
    publishBtn.classList.toggle('hidden', isPublished);
    unpublishBtn.classList.toggle('hidden', !isPublished);
    previewLink.href = '/artists/' + encodeURIComponent(artist.slug);
    previewLink.classList.toggle('hidden', !isPublished);
    pageUrl.textContent = isPublished
      ? 'https://www.the615hideaway.com/artists/' + artist.slug
      : 'Publish your page to get a live URL.';
  }

  function formPayload() {
    return {
      display_name: field('display-name').value.trim(),
      slug: HideawayUtils.slugify(field('slug').value.trim() || field('display-name').value),
      bio: field('bio').value.trim(),
      photo_url: field('photo-url').value.trim(),
      bandsintown_url: field('bandsintown-url').value.trim(),
      streaming_url: field('streaming-url').value.trim(),
      website_url: field('website-url').value.trim(),
      booking_email: field('booking-email').value.trim(),
      booking_phone: field('booking-phone').value.trim(),
      badge_text: field('badge-text').value.trim(),
      updated_at: new Date().toISOString()
    };
  }

  async function loadOrCreateArtist(session, profile) {
    const supabase = await HideawayAuth.init();
    const { data: existing, error } = await supabase
      .from('artists')
      .select('*')
      .eq('owner_id', session.user.id)
      .maybeSingle();

    if (error) throw error;
    if (existing) return existing;

    const displayName = profile?.display_name || session.user.email.split('@')[0];
    const slug = HideawayUtils.slugify(displayName);
    const { data: created, error: insertError } = await supabase
      .from('artists')
      .insert({
        owner_id: session.user.id,
        slug,
        display_name: displayName,
        status: 'draft'
      })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return created;
  }

  async function saveArtist(extra) {
    const supabase = await HideawayAuth.init();
    const payload = Object.assign(formPayload(), extra || {});
    const { data, error } = await supabase
      .from('artists')
      .update(payload)
      .eq('id', currentArtist.id)
      .select('*')
      .single();

    if (error) throw error;
    currentArtist = data;
    fillForm(currentArtist);
    return data;
  }

  async function boot() {
    try {
      const session = await HideawayAuth.getSession();
      if (!session) {
        window.location.href = '/join';
        return;
      }

      const profile = await HideawayAuth.getProfile();
      if (profile?.member_type !== 'artist' && profile?.role !== 'artist' && profile?.role !== 'admin') {
        showMessage('Artist portal is for artist accounts. Sign up as an Artist or contact the label.', 'warn');
        return;
      }

      currentArtist = await loadOrCreateArtist(session, profile);
      fillForm(currentArtist);
      gate.classList.add('hidden');
      panel.classList.remove('hidden');
    } catch (err) {
      showMessage(err.message, 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await saveArtist();
      showMessage('Saved! Your draft is updated.', 'success');
    } catch (err) {
      showMessage(err.message || 'Could not save.', 'error');
    }
  });

  publishBtn.addEventListener('click', async () => {
    try {
      await saveArtist({ status: 'published' });
      showMessage('Your artist page is live!', 'success');
    } catch (err) {
      showMessage(err.message || 'Could not publish. Slug may already be taken.', 'error');
    }
  });

  unpublishBtn.addEventListener('click', async () => {
    try {
      await saveArtist({ status: 'draft' });
      showMessage('Page unpublished — back to draft.', 'success');
    } catch (err) {
      showMessage(err.message || 'Could not unpublish.', 'error');
    }
  });

  field('display-name').addEventListener('blur', () => {
    if (!field('slug').value.trim()) {
      field('slug').value = HideawayUtils.slugify(field('display-name').value);
    }
  });

  boot();
})();