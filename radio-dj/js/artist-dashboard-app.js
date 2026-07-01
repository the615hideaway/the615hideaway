(function () {
  const isDemoMode = typeof Demo !== 'undefined' && Demo.isActive();
  const loginGate = document.getElementById('login-gate');
  const appShell = document.getElementById('app-shell');
  const logoutBtn = document.getElementById('logout-btn');
  const artistDisplayName = document.getElementById('artist-display-name');
  const dashboardSubtitle = document.getElementById('dashboard-subtitle');
  const dashboardStats = document.getElementById('dashboard-stats');
  const songPicker = document.getElementById('song-picker');
  const songInfographic = document.getElementById('song-infographic');
  const spinLines = document.getElementById('spin-lines');
  const spinLinesMeta = document.getElementById('spin-lines-meta');
  const featuredBanner = document.getElementById('artist-featured-banner');

  let dashboardData = null;
  let selectedSongKey = '';
  let catalogCache = null;
  let catalogLoading = null;

  function normalizeKey(artistName, songTitle) {
    return `${String(artistName || '').trim().toLowerCase()}|${String(songTitle || '').trim().toLowerCase()}`;
  }

  function setArtistHeader(name, options = {}) {
    const display = String(name || '').trim();
    const isLabel = options.isLabel;

    if (artistDisplayName) {
      artistDisplayName.textContent = isLabel
        ? (display ? `${display}` : 'Your label')
        : (display || 'Your artist');
    }

    if (dashboardSubtitle) {
      if (options.demo) {
        dashboardSubtitle.textContent = 'Screenshot-ready spin stats — see which DJs downloaded your music.';
        return;
      }
      dashboardSubtitle.textContent = isLabel
        ? 'Radio airplay at a glance for your roster on Radio Now.'
        : 'Screenshot-ready spin stats — see which DJs downloaded your music.';
    }
  }

  function collectSongs(data) {
    const map = new Map();
    const add = (artistName, songTitle, songId, musicStyle) => {
      const title = String(songTitle || '').trim();
      if (!title) return;
      const key = normalizeKey(artistName, title);
      if (!map.has(key)) {
        map.set(key, {
          key,
          artistName: String(artistName || '').trim(),
          songTitle: title,
          songId: String(songId || '').trim(),
          musicStyle: String(musicStyle || '').trim(),
        });
      }
    };

    (data.activity || []).forEach((item) => {
      add(item.artistName, item.songTitle, item.songId, item.musicStyle);
    });

    const charts = data.charts || {};
    [...(charts.week || []), ...(charts.month || [])].forEach((item) => {
      add(item.artistName, item.songTitle, item.songId, item.musicStyle);
    });

    (data.chartHistory || []).forEach((item) => {
      add(data.artist?.artistName, item.songTitle, '', '');
    });

    return Array.from(map.values()).sort((a, b) => a.songTitle.localeCompare(b.songTitle));
  }

  function songsForAccount(account, songs) {
    if (!account) return songs;
    const isLabel = String(account.accountType || '').toLowerCase() === 'label';
    const target = String(account.artistName || '').trim().toLowerCase();
    return songs.filter((song) => {
      const field = isLabel ? song.recordLabel : song.artistName;
      return String(field || '').trim().toLowerCase() === target;
    });
  }

  function catalogSortScore(song) {
    const year = parseInt(String(song?.year || '').trim(), 10) || 0;
    const releaseTs = Date.parse(song?.releaseDate || '') || 0;
    return releaseTs || (year * 10000);
  }

  async function enrichSongsFromCatalog(songs, account) {
    const catalog = await fetchCatalogOnce();
    const roster = songsForAccount(account, catalog);
    const map = new Map(songs.map((s) => [s.key, s]));

    roster.forEach((entry) => {
      const key = normalizeKey(entry.artistName, entry.songTitle);
      if (map.has(key)) return;
      map.set(key, {
        key,
        artistName: String(entry.artistName || '').trim(),
        songTitle: String(entry.songTitle || '').trim(),
        songId: String(entry.id || '').trim(),
        musicStyle: String(entry.musicStyle || '').trim(),
      });
    });

    const catalogByKey = new Map(roster.map((entry) => [
      normalizeKey(entry.artistName, entry.songTitle),
      entry,
    ]));

    return Array.from(map.values()).sort((a, b) => {
      const scoreA = catalogSortScore(catalogByKey.get(a.key) || a);
      const scoreB = catalogSortScore(catalogByKey.get(b.key) || b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.songTitle.localeCompare(b.songTitle);
    });
  }

  async function resolveLatestSongKey(songs, account) {
    const catalog = await fetchCatalogOnce();
    const roster = songsForAccount(account, catalog)
      .sort((a, b) => catalogSortScore(b) - catalogSortScore(a));

    if (roster.length) {
      return normalizeKey(roster[0].artistName, roster[0].songTitle);
    }

    if (!songs.length) return '';

    const keys = new Set(songs.map((s) => s.key));
    let latestKey = songs[0].key;
    let latestTs = 0;
    (dashboardData?.activity || []).forEach((item) => {
      const key = normalizeKey(item.artistName, item.songTitle);
      if (!keys.has(key)) return;
      const ts = Date.parse(item.timestamp);
      if (!Number.isNaN(ts) && ts > latestTs) {
        latestTs = ts;
        latestKey = key;
      }
    });
    return latestKey;
  }

  function buildCreditsHtml(catalogSong) {
    if (!catalogSong) return '';

    const blocks = [];

    if (catalogSong.songwriter) {
      blocks.push(`
        <div class="spin-infographic-credit-block">
          <p class="spin-infographic-credit-label">Songwriter</p>
          <p class="spin-infographic-credit-value">${Utils.escapeHtml(catalogSong.songwriter)}</p>
        </div>`);
    }

    const lines = Array.isArray(catalogSong.bandMemberLines)
      ? catalogSong.bandMemberLines.filter(Boolean)
      : String(catalogSong.bandMembers || '').split(';').map((s) => s.trim()).filter(Boolean);

    if (lines.length) {
      blocks.push(`
        <div class="spin-infographic-credit-block">
          <p class="spin-infographic-credit-label">Musicians</p>
          <ul class="spin-infographic-musicians">
            ${lines.map((line) => `<li>${Utils.escapeHtml(line)}</li>`).join('')}
          </ul>
        </div>`);
    }

    if (catalogSong.featuredArtist) {
      blocks.push(`
        <div class="spin-infographic-credit-block">
          <p class="spin-infographic-credit-label">Featured artist</p>
          <p class="spin-infographic-credit-value">${Utils.escapeHtml(catalogSong.featuredArtist)}</p>
        </div>`);
    }

    if (!blocks.length) return '';
    return `<div class="spin-infographic-credits">${blocks.join('')}</div>`;
  }

  function songStats(data, song) {
    const key = song.key;
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const monthAgo = now - (30 * 24 * 60 * 60 * 1000);
    let total = 0;
    let week = 0;
    let month = 0;
    const djs = {};

    (data.activity || []).forEach((item) => {
      if (normalizeKey(item.artistName, item.songTitle) !== key) return;
      total += 1;
      const ts = Date.parse(item.timestamp);
      if (!Number.isNaN(ts)) {
        if (ts >= weekAgo) week += 1;
        if (ts >= monthAgo) month += 1;
      }
      const dj = ArtistActivity.formatDjLine(item);
      if (dj) djs[dj] = true;
    });

    const charts = data.charts || {};
    const weekRank = (charts.week || []).findIndex((item) => normalizeKey(item.artistName, item.songTitle) === key);
    const monthRank = (charts.month || []).findIndex((item) => normalizeKey(item.artistName, item.songTitle) === key);

    const history = (data.chartHistory || []).find((item) =>
      String(item.songTitle || '').trim().toLowerCase() === song.songTitle.toLowerCase(),
    );

    return {
      total,
      week,
      month,
      uniqueDjs: Object.keys(djs).length,
      weekRank: weekRank >= 0 ? weekRank + 1 : 0,
      monthRank: monthRank >= 0 ? monthRank + 1 : 0,
      bestWeekRank: history?.bestWeekRank || 0,
      bestMonthRank: history?.bestMonthRank || 0,
    };
  }

  async function fetchCatalogOnce() {
    if (catalogCache) return catalogCache;
    if (!catalogLoading) {
      catalogLoading = RadioDB.getAllSongs()
        .then((songs) => {
          catalogCache = songs;
          return songs;
        })
        .catch(() => []);
    }
    return catalogLoading;
  }

  async function findCatalogSong(song) {
    const songs = await fetchCatalogOnce();
    return songs.find((entry) => normalizeKey(entry.artistName, entry.songTitle) === song.key) || null;
  }

  function renderSongMetrics(stats) {
    if (!dashboardStats) return;

    const items = [
      { label: 'DJ spins', value: stats.total, hero: true },
      { label: 'This week', value: stats.week },
      { label: 'This month', value: stats.month },
      { label: 'DJs', value: stats.uniqueDjs },
    ];

    dashboardStats.classList.remove('hidden');
    dashboardStats.innerHTML = items.map((item) => `
      <div class="spin-stat-pill${item.hero ? ' spin-stat-pill--hero' : ''}">
        <span class="spin-stat-pill-value">${item.value}</span>
        <span class="spin-stat-pill-label">${item.label}</span>
      </div>`).join('');
  }

  function hideSongMetrics() {
    if (!dashboardStats) return;
    dashboardStats.classList.add('hidden');
    dashboardStats.innerHTML = '';
  }

  function renderSongPicker(songs) {
    if (!songPicker) return;

    if (!songs.length) {
      songPicker.innerHTML = `
        <p class="spin-picker-empty">No spins logged yet. When DJs download from the catalog, pick a song here for a shareable stats card.</p>`;
      return;
    }

      songPicker.innerHTML = `
      <label for="spin-song-select" class="spin-picker-label">Your songs</label>
      <select id="spin-song-select" class="spin-song-select" aria-label="Choose a song">
        ${songs.map((song) => {
          const label = song.artistName
            ? `${song.songTitle} — ${song.artistName}`
            : song.songTitle;
          return `<option value="${Utils.escapeHtml(song.key)}"${selectedSongKey === song.key ? ' selected' : ''}>${Utils.escapeHtml(label)}</option>`;
        }).join('')}
      </select>
      <p class="spin-picker-hint">Newest releases first</p>`;

    document.getElementById('spin-song-select')?.addEventListener('change', (event) => {
      selectSong(songs, event.target.value || '');
    });
  }

  function selectSong(songs, key) {
    selectedSongKey = key || '';
    renderSongPicker(songs);
    const song = songs.find((s) => s.key === selectedSongKey);
    loadSongInfographic(song);
    renderSpinLines(dashboardData?.activity || [], selectedSongKey);
  }

  async function loadSongInfographic(song) {
    if (!songInfographic) return;

    if (!song) {
      songInfographic.classList.add('hidden');
      songInfographic.innerHTML = '';
      hideSongMetrics();
      return;
    }

    songInfographic.classList.remove('hidden');
    songInfographic.innerHTML = `
      <div class="spin-infographic spin-infographic--loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading latest release…</p>
      </div>`;

    const stats = songStats(dashboardData, song);
    renderSongMetrics(stats);

    const catalogSong = await findCatalogSong(song);
    const coverUrl = catalogSong ? Utils.resolveCoverUrl(catalogSong) : '';
    const creditsHtml = buildCreditsHtml(catalogSong);

    const metaBits = [
      catalogSong?.year || '',
      catalogSong?.songTime || '',
      catalogSong?.recordLabel || '',
    ].filter(Boolean);

    const rankBits = [];
    if (stats.weekRank) rankBits.push(`#${stats.weekRank} this week`);
    if (stats.monthRank) rankBits.push(`#${stats.monthRank} this month`);
    if (stats.bestWeekRank) rankBits.push(`Best week #${stats.bestWeekRank}`);
    if (stats.bestMonthRank) rankBits.push(`Best month #${stats.bestMonthRank}`);

    songInfographic.innerHTML = `
      <article class="spin-infographic" aria-label="Spin stats for ${Utils.escapeHtml(song.songTitle)}">
        <div class="spin-infographic-brand">
          <img src="assets/logo.png" alt="" class="spin-infographic-logo">
          <span>Radio Now</span>
        </div>
        <div class="spin-infographic-body">
          <div class="spin-infographic-cover">
            ${coverUrl
    ? `<img src="${Utils.escapeHtml(coverUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('spin-infographic-cover--fallback')">`
    : '<i class="fa-solid fa-compact-disc" aria-hidden="true"></i>'}
          </div>
          <div class="spin-infographic-copy">
            <p class="spin-infographic-eyebrow">${Utils.escapeHtml(catalogSong?.musicStyle || song.musicStyle || 'Bluegrass')}</p>
            <h2 class="spin-infographic-title">${Utils.escapeHtml(song.songTitle)}</h2>
            <p class="spin-infographic-artist">${Utils.escapeHtml(song.artistName)}</p>
            ${metaBits.length ? `<p class="spin-infographic-meta-line">${metaBits.map((b) => Utils.escapeHtml(b)).join(' · ')}</p>` : ''}
          </div>
        </div>
        ${creditsHtml}
        ${rankBits.length ? `<p class="spin-infographic-ranks">${rankBits.map((b) => Utils.escapeHtml(b)).join(' · ')}</p>` : ''}
        <p class="spin-infographic-foot">Screenshot and share — real DJ download activity on Radio Now.</p>
      </article>`;
  }

  function renderSpinLines(activity, filterKey = '') {
    if (!spinLines) return;

    let items = activity || [];
    if (filterKey) {
      items = items.filter((item) => normalizeKey(item.artistName, item.songTitle) === filterKey);
    }

    if (spinLinesMeta) {
      spinLinesMeta.textContent = filterKey
        ? `${items.length} spin${items.length === 1 ? '' : 's'}`
        : `${items.length} total`;
    }

    if (!items.length) {
      spinLines.innerHTML = `
        <div class="spin-lines-empty">
          <i class="fa-solid fa-tower-broadcast"></i>
          <p>${filterKey ? 'No spins for this song yet.' : 'No spins logged yet. Share your music with DJs on Radio Now.'}</p>
        </div>`;
      return;
    }

    spinLines.innerHTML = items.map((item) => {
      const djLine = ArtistActivity.formatDjLine(item) || 'DJ';
      const songLine = [item.songTitle, item.artistName].filter(Boolean).join(' · ');
      const format = ArtistActivity.formatLabel(item.eventType, item.format);
      const when = ArtistActivity.formatTimestamp(item.timestamp);

      return `
        <article class="spin-line">
          <div class="spin-line-main">
            <p class="spin-line-dj"><i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i> ${Utils.escapeHtml(djLine)}</p>
            ${!filterKey && songLine ? `<p class="spin-line-song">${Utils.escapeHtml(songLine)}</p>` : ''}
          </div>
          <div class="spin-line-meta">
            <span class="spin-line-format">${Utils.escapeHtml(format)}</span>
            <span class="spin-line-date">${Utils.escapeHtml(when)}</span>
          </div>
          <a href="djs.html" class="spin-line-dj-link btn btn-ghost btn-sm" title="DJ Member Directory">
            <i class="fa-solid fa-users" aria-hidden="true"></i>
            <span class="spin-line-dj-link-text">DJs</span>
          </a>
        </article>`;
    }).join('');
  }

  function renderFeaturedBanner(account) {
    if (!featuredBanner || typeof Spotlight === 'undefined') return;

    const brandName = 'Radio Now';

    fetchCatalogOnce().then((catalog) => {
      const roster = songsForAccount(account, catalog);
      const picks = Spotlight.sortSongs(roster.filter((song) => Spotlight.isManualPick(song)));

      if (!picks.length) {
        featuredBanner.classList.add('hidden');
        featuredBanner.innerHTML = '';
        return;
      }

      const preview = picks.slice(0, 3);
      const more = picks.length - preview.length;

      featuredBanner.classList.remove('hidden');
      featuredBanner.innerHTML = `
        <div class="artist-featured-banner-inner">
          <div class="artist-featured-banner-head">
            <h2><i class="fa-solid fa-star"></i> Featured by ${Utils.escapeHtml(brandName)}</h2>
            <a href="artist-spotlight.html" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <div class="artist-featured-banner-chips">
            ${preview.map((song) => `
              <div class="artist-featured-chip">
                <strong>${Utils.escapeHtml(song.songTitle)}</strong>
                <span>${Utils.escapeHtml(song.artistName)}</span>
              </div>`).join('')}
            ${more > 0 ? `<div class="artist-featured-chip"><strong>+${more} more</strong><span>on Featured tab</span></div>` : ''}
          </div>
        </div>`;
    }).catch(() => {
      featuredBanner.classList.add('hidden');
    });
  }

  function renderLabelAccess(items) {
    const panel = document.getElementById('label-access-panel');
    const list = document.getElementById('label-access-list');
    if (!panel || !list) return;

    if (!items?.length) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = items.map((item) => `
      <article class="label-access-item">
        <div>
          <strong>${Utils.escapeHtml(item.labelName || 'Label')}</strong>
          <p class="muted">Access since ${Utils.escapeHtml(ArtistActivity.formatTimestamp(item.grantedAt))}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm revoke-label-btn" data-label-id="${Utils.escapeHtml(item.labelAccountId)}">
          Remove
        </button>
      </article>`).join('');

    list.querySelectorAll('.revoke-label-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remove this label\'s access?')) return;
        btn.disabled = true;
        try {
          const result = await ArtistAuth.revokeLabelAccess(btn.dataset.labelId);
          renderLabelAccess(result.labelAccess || []);
        } catch (err) {
          alert(err.message || 'Could not remove access.');
          btn.disabled = false;
        }
      });
    });
  }

  async function loadDashboard() {
    const artist = isDemoMode ? null : ArtistAuth.getArtist();
    const artistName = artist?.artistName || '';
    const isLabel = String(artist?.accountType || '').toLowerCase() === 'label';

    setArtistHeader(artistName, { demo: isDemoMode, isLabel });

    hideSongMetrics();
    if (spinLines) {
      spinLines.innerHTML = '<div class="spin-lines-empty"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading spins…</p></div>';
    }

    try {
      const data = isDemoMode
        ? await ArtistActivity.fetchDemoDashboard()
        : await ArtistActivity.fetchDashboard();

      dashboardData = data;
      const resolved = data.artist || artist;
      const resolvedName = resolved?.artistName || artistName;
      const resolvedIsLabel = String(resolved?.accountType || '').toLowerCase() === 'label';

      setArtistHeader(resolvedName, { demo: isDemoMode, isLabel: resolvedIsLabel });

      if (!isDemoMode && resolved) {
        ArtistAuth.updateArtistProfile(resolved);
        ArtistAuthUI.updateWelcome();
        ArtistPortalNav.init('spins', { isLabel: resolvedIsLabel });
      } else if (isDemoMode && typeof ArtistPortalNav !== 'undefined') {
        ArtistPortalNav.init('spins', { isLabel: false });
      }

      let songs = collectSongs(data);
      songs = await enrichSongsFromCatalog(songs, resolved);
      selectedSongKey = await resolveLatestSongKey(songs, resolved);
      renderSongPicker(songs);

      if (selectedSongKey) {
        const song = songs.find((s) => s.key === selectedSongKey);
        await loadSongInfographic(song);
        renderSpinLines(data.activity || [], selectedSongKey);
      } else {
        renderSpinLines(data.activity || [], '');
        if (songInfographic) {
          songInfographic.classList.add('hidden');
          songInfographic.innerHTML = '';
        }
        hideSongMetrics();
      }

      if (!resolvedIsLabel) {
        renderLabelAccess(data.labelAccess || []);
      }

      if (resolved && !isDemoMode) {
        renderFeaturedBanner(resolved);
      } else if (featuredBanner) {
        featuredBanner.classList.add('hidden');
      }
    } catch (err) {
      if (spinLines) {
        spinLines.innerHTML = `<div class="spin-lines-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>${Utils.escapeHtml(err.message)}</p></div>`;
      }
    }
  }

  function showApp() {
    loginGate?.classList.add('hidden');
    appShell?.classList.remove('hidden');

    if (isDemoMode) {
      Demo.applyMode();
      Demo.bindExit(logoutBtn);
      ArtistPortalNav.init('spins', { isLabel: false });
    } else {
      ArtistAuthUI.updateWelcome();
      const isLabel = String(ArtistAuth.getArtist()?.accountType || '').toLowerCase() === 'label';
      ArtistPortalNav.init('spins', { isLabel });
    }

    if (typeof TurnkeyPitch !== 'undefined') TurnkeyPitch.hideAppPromo();
    loadDashboard();
  }

  function showLogin() {
    loginGate?.classList.remove('hidden');
    appShell?.classList.add('hidden');
  }

  if (isDemoMode) {
    showApp();
  } else {
    const authUi = ArtistAuthUI.init({ onAuthenticated: showApp });
    SiteNav.bindLogout(logoutBtn, showLogin);
    ArtistBoot.bootPage({
      authUi,
      onAuthenticated: showApp,
      onGuest: showLogin,
    });
  }
})();