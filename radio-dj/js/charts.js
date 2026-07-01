const Charts = {
  isDownloadEvent(eventType) {
    const type = String(eventType || '').trim().toLowerCase();
    return type === 'downloaded'
      || type === 'download_mp3'
      || type === 'download_wav'
      || type === 'download_zip';
  },

  bumpChartCount(bucket, songId, meta) {
    if (!bucket[songId]) {
      bucket[songId] = {
        songId,
        songTitle: meta.songTitle || 'Untitled',
        artistName: meta.artistName || 'Unknown Artist',
        musicStyle: meta.musicStyle || '',
        count: 0,
      };
    }
    bucket[songId].count += 1;
    if (meta.songTitle) bucket[songId].songTitle = meta.songTitle;
    if (meta.artistName) bucket[songId].artistName = meta.artistName;
    if (meta.musicStyle) bucket[songId].musicStyle = meta.musicStyle;
  },

  sortChartEntries(bucket, limit) {
    return Object.keys(bucket)
      .map((key) => bucket[key])
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.songTitle).localeCompare(String(b.songTitle));
      })
      .slice(0, limit || 10);
  },

  async fetch(limit = 10) {
    const supabase = await HideawayAuth.init();
    const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('dj_activity')
      .select('event_type, song_id, song_title, artist_name, music_style, created_at')
      .gte('created_at', new Date(monthAgo).toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const weekCounts = {};
    const monthCounts = {};

    (data || []).forEach((row) => {
      if (!this.isDownloadEvent(row.event_type)) return;
      const songId = row.song_id;
      if (!songId) return;
      const ts = Date.parse(row.created_at);
      if (Number.isNaN(ts)) return;
      const meta = {
        songTitle: row.song_title,
        artistName: row.artist_name,
        musicStyle: row.music_style,
      };
      if (ts >= weekAgo) this.bumpChartCount(weekCounts, songId, meta);
      if (ts >= monthAgo) this.bumpChartCount(monthCounts, songId, meta);
    });

    return {
      success: true,
      week: this.sortChartEntries(weekCounts, limit),
      month: this.sortChartEntries(monthCounts, limit),
    };
  },

  renderList(container, items, emptyMessage, options = {}) {
    if (!container) return;

    const limit = options.limit > 0 ? options.limit : 0;
    const list = limit > 0 ? (items || []).slice(0, limit) : (items || []);

    if (!list.length) {
      container.innerHTML = `<p class="charts-empty">${Utils.escapeHtml(emptyMessage)}</p>`;
      return;
    }

    const showQueue = !!options.showQueue;
    const isQueued = typeof options.isQueued === 'function' ? options.isQueued : () => false;
    const itemClass = showQueue ? 'charts-item charts-item--with-queue' : 'charts-item';

    container.innerHTML = `
      <ol class="charts-list">
        ${list.map((item, index) => {
          const songId = item.songId || '';
          const queued = showQueue && songId && isQueued(songId);
          return `
          <li class="${itemClass}">
            <span class="charts-rank">${index + 1}</span>
            <div class="charts-copy">
              <strong>${Utils.escapeHtml(item.songTitle || 'Untitled')}</strong>
              <span>${Utils.escapeHtml(item.artistName || 'Unknown Artist')}${item.musicStyle ? ` · ${Utils.escapeHtml(item.musicStyle)}` : ''}</span>
            </div>
            <span class="charts-count" title="Downloads">${item.count}</span>
            ${showQueue && songId ? `
              <button
                type="button"
                class="btn btn-primary btn-sm charts-queue-btn ${queued ? 'active' : ''}"
                data-song-id="${Utils.escapeHtml(songId)}"
                title="${queued ? 'Remove from DJ queue' : 'Add to DJ queue'}"
                aria-pressed="${queued ? 'true' : 'false'}"
              >
                <i class="fa-solid ${queued ? 'fa-check' : 'fa-list-ul'}" aria-hidden="true"></i>
                <span class="charts-queue-label">${queued ? 'Queued' : 'Queue'}</span>
              </button>` : ''}
          </li>`;
        }).join('')}
      </ol>`;

    if (showQueue && typeof options.onQueueToggle === 'function') {
      container.querySelectorAll('.charts-queue-btn').forEach((btn) => {
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          options.onQueueToggle(btn.dataset.songId, btn);
        });
      });
    }
  },

  async loadInto(weekEl, monthEl, options = {}) {
    const limit = options.limit ?? 10;

    try {
      const data = await this.fetch(limit);
      const renderOptions = { ...options, limit };
      this.renderList(weekEl, data.week, 'No downloads yet this week.', renderOptions);
      this.renderList(monthEl, data.month, 'No downloads yet this month.', renderOptions);
      return data;
    } catch (err) {
      const message = err.message || 'Charts unavailable';
      if (weekEl) weekEl.innerHTML = `<p class="charts-empty">${Utils.escapeHtml(message)}</p>`;
      if (monthEl) monthEl.innerHTML = '';
      throw err;
    }
  },
};