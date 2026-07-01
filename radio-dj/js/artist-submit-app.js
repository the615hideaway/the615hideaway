(function () {
  function mountSubmitPanel(account) {
    const note = document.getElementById('song-submit-note');
    const artistInput = document.getElementById('submit-artist-name');
    const emailInput = document.getElementById('submit-contact-email');

    if (artistInput && account?.artistName) {
      artistInput.value = account.artistName;
    }
    if (emailInput && account?.email) {
      emailInput.value = account.email;
    }

    if (note) {
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      note.textContent = isLabel
        ? 'Submit new releases for any artist on your roster. Files upload to Supabase Storage; we review before publishing.'
        : 'Submit a new single to Radio Now. MP3 + cover upload to Supabase; we add approved songs to the catalog.';
    }
  }

  function bindSubmitForm(account) {
    const form = document.getElementById('song-submit-form');
    const status = document.getElementById('song-submit-status');
    const submitBtn = document.getElementById('song-submit-btn');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (status) {
        status.classList.add('hidden');
        status.textContent = '';
      }

      const original = submitBtn?.innerHTML;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
      }

      try {
        await ArtistAuth.submitSong({
          artistName: document.getElementById('submit-artist-name')?.value || account?.artistName || '',
          songTitle: document.getElementById('submit-song-title')?.value || '',
          year: document.getElementById('submit-year')?.value || '',
          musicStyle: document.getElementById('submit-music-style')?.value || '',
          contactEmail: document.getElementById('submit-contact-email')?.value || account?.email || '',
          description: document.getElementById('submit-description')?.value || '',
          mp3File: document.getElementById('submit-mp3')?.files?.[0] || null,
          coverFile: document.getElementById('submit-cover')?.files?.[0] || null,
          wavFile: document.getElementById('submit-wav')?.files?.[0] || null,
        });

        form.reset();
        mountSubmitPanel(account);
        if (status) {
          status.classList.remove('hidden');
          status.classList.add('login-notice');
          status.textContent = 'Submitted! Radio Now will review and email you when your song is live.';
        }
      } catch (err) {
        if (status) {
          status.classList.remove('hidden');
          status.textContent = err.message || 'Submission failed.';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
        }
      }
    });
  }

  ArtistPortalAuth.initPage({
    activeNav: 'submit',
    onReady({ account, isDemoMode }) {
      const name = account?.artistName || (isDemoMode ? 'David Parmley' : '');
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      const title = document.getElementById('page-title');
      const copy = document.getElementById('page-copy');
      if (title) title.textContent = 'Submit a new song';
      if (copy && name) {
        copy.textContent = isLabel
          ? `${name} — upload MP3 + cover for roster artists. Stored in Supabase until approved.`
          : `${name} — upload MP3 + cover. Stored in Supabase until approved.`;
      }
      mountSubmitPanel(account || { accountType: isDemoMode ? 'artist' : '' });
      if (!isDemoMode) bindSubmitForm(account);
    },
  });
})();