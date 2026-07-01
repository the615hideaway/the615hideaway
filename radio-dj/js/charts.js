const Charts = {
  async fetch(limit = 10) {
    const scriptUrl = String(CONFIG.googleScriptUrl || '').trim();
    if (!scriptUrl.includes('script.google.com')) {
      throw new Error('Charts need Apps Script setup.');
    }

    const url = `${scriptUrl.replace(/\/$/, '')}?action=charts&limit=${encodeURIComponent(limit)}`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Charts unavailable');
    return data;
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