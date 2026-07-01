(function () {
  const promoContent = document.getElementById('artist-promo-content');
  const setupNotice = document.getElementById('artist-promo-setup-notice');
  let mySongs = [];

  function normalizeArtistName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function songsForAccount(account, songs) {
    if (!account) return [];
    const isLabel = String(account.accountType || '').toLowerCase() === 'label';
    const target = normalizeArtistName(account.artistName);
    return songs.filter((song) => normalizeArtistName(isLabel ? song.recordLabel : song.artistName) === target);
  }

  function renderCover(song) {
    const url = Utils.resolveCoverUrl(song);
    if (url) {
      return `<img src="${Utils.escapeHtml(url)}" alt="" loading="lazy" onerror="this.classList.add('broken')">`;
    }
    return '<div class="cover-fallback"><i class="fa-solid fa-compact-disc"></i></div>';
  }

  async function downloadPromoZip(songs, button) {
    if (!songs.length || !button) return;
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building ZIP…';

    try {
      await RadioDB.downloadZip(songs, 'mp3', (progress) => {
        if (progress.status === 'zipping') {
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating ZIP…';
        } else if (progress.status === 'done') {
          button.innerHTML = '<i class="fa-solid fa-check"></i> Ready';
        } else {
          button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${progress.current}/${progress.total}…`;
        }
      });
    } catch (err) {
      alert(err.message || 'Could not download promo ZIP.');
    } finally {
      button.disabled = false;
      button.innerHTML = originalHtml;
    }
  }

  function renderPromoList() {
    if (!promoContent) return;

    if (!mySongs.length) {
      promoContent.innerHTML = `
        <div class="empty-state dj-empty-state">
          <i class="fa-solid fa-folder-open"></i>
          <p>No promo folders yet. After your song is on the catalog, download turn-key ZIPs here — one song at a time.</p>
        </div>`;
      return;
    }

    promoContent.innerHTML = `
      <div class="artist-promo-list artist-promo-list--compact">
        ${mySongs.map((song) => `
          <article class="artist-promo-item" data-id="${Utils.escapeHtml(song.id)}">
            <div class="artist-promo-cover">${renderCover(song)}</div>
            <div class="artist-promo-copy">
              <h3>${Utils.escapeHtml(song.songTitle || 'Untitled')}</h3>
              <p>${Utils.escapeHtml(song.artistName || '')}${song.year ? ` · ${Utils.escapeHtml(song.year)}` : ''}</p>
            </div>
            <div class="artist-promo-buttons">
              <button type="button" class="btn btn-primary btn-sm download-promo-btn" data-id="${Utils.escapeHtml(song.id)}">
                <i class="fa-solid fa-file-zipper"></i> ZIP
              </button>
              <button type="button" class="btn btn-ghost btn-sm download-onesheet-btn" data-id="${Utils.escapeHtml(song.id)}">
                <i class="fa-solid fa-file-pdf"></i> PDF
              </button>
            </div>
          </article>`).join('')}
      </div>`;

    promoContent.querySelectorAll('.download-promo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const song = mySongs.find((s) => s.id === btn.dataset.id);
        if (song) downloadPromoZip([song], btn);
      });
    });

    promoContent.querySelectorAll('.download-onesheet-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const song = mySongs.find((s) => s.id === btn.dataset.id);
        if (!song) return;
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          await OneSheet.downloadOneSheet(song);
        } catch (err) {
          alert(err.message || 'Could not download one-sheet PDF.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });
    });
  }

  async function loadPromo(account) {
    if (!promoContent) return;
    promoContent.innerHTML = '<div class="empty-state dj-empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading promo folders…</p></div>';

    try {
      const allSongs = await RadioDB.getAllSongs();
      mySongs = songsForAccount(account, allSongs);
      renderPromoList();
    } catch (err) {
      promoContent.innerHTML = `<div class="empty-state dj-empty-state"><p>${Utils.escapeHtml(err.message)}</p></div>`;
    }
  }

  ArtistPortalAuth.initPage({
    activeNav: 'promo',
    onReady({ account, isDemoMode }) {
      if (setupNotice) {
        setupNotice.classList.toggle('hidden', RadioDB.isScriptConfigured());
      }
      const isLabel = String(account?.accountType || '').toLowerCase() === 'label';
      const name = account?.artistName || (isDemoMode ? 'David Parmley' : '');
      const copy = document.getElementById('page-copy');
      if (copy) {
        copy.textContent = isLabel
          ? `${name} — download one promo ZIP at a time for DJs not on Radio Now.`
          : `${name} — download your turn-key promo ZIP for DJs not on Radio Now.`;
      }
      if (isDemoMode) {
        promoContent.innerHTML = `
          <div class="empty-state dj-empty-state">
            <p>Demo preview — create an account to download full promo ZIPs.</p>
          </div>`;
        return;
      }
      loadPromo(account);
    },
  });
})();