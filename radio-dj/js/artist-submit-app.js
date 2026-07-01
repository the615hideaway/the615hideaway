(function () {
  function mountSubmitPanel(account) {
    const openLink = document.getElementById('song-google-form-open-link');
    const formUrl = CONFIG.artistSongFormUrl || 'https://forms.gle/zFExL6otU1e7hJF59';
    if (openLink) openLink.href = formUrl;

    const note = document.getElementById('song-submit-note');
    if (note) {
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      note.textContent = isLabel
        ? 'Submit new releases for any artist on your roster. Upload MP3 + cover on the form; drop WAV in our shared folder with matching file names.'
        : 'Submit a new single to Radio Now. Upload MP3 + cover on the form; add WAV to our shared folder named like your MP3.';
    }
  }

  ArtistPortalAuth.initPage({
    activeNav: 'submit',
    onReady({ account, isDemoMode }) {
      const name = account?.artistName || (isDemoMode ? 'David Parmley' : '');
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      const title = document.getElementById('page-title');
      const copy = document.getElementById('page-copy');
      if (title) title.textContent = isLabel ? 'Submit a new song' : 'Submit a new song';
      if (copy && name) {
        copy.textContent = isLabel
          ? `${name} — MP3 + cover on the form; WAV in our shared folder (matching file name).`
          : `${name} — MP3 + cover on the form; WAV in our shared folder (matching file name).`;
      }
      mountSubmitPanel(account || { accountType: isDemoMode ? 'artist' : '' });
    },
  });
})();