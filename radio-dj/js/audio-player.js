const AudioPlayer = {
  getDriveId(song) {
    return song.previewDriveId || Utils.extractDriveId(song.mp3) || Utils.extractDriveId(song.previewLink) || '';
  },

  getEmbedUrl(driveId) {
    return `https://drive.google.com/file/d/${driveId}/preview`;
  },

  hasPreview(song) {
    return !!(this.getDriveId(song) || song.previewStreamUrl || song.previewLink);
  },

  renderNowPlaying(song) {
    const container = document.getElementById('now-playing-player');
    if (!container) return;

    const driveId = this.getDriveId(song);
    const title = Utils.escapeHtml(song.songTitle || 'track');

    if (driveId) {
      container.innerHTML = `
        <div class="preview-embed-host preview-embed-host--now-playing">
          <iframe class="preview-iframe preview-iframe--now-playing"
            src="${Utils.escapeHtml(this.getEmbedUrl(driveId))}"
            title="Now playing: ${title}"
            sandbox="allow-scripts allow-same-origin"
            allow="autoplay"
            referrerpolicy="no-referrer-when-downgrade"></iframe>
          <div class="preview-popout-shield" aria-hidden="true" title=""></div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="now-playing-fallback muted">
        <i class="fa-solid fa-circle-exclamation"></i>
        Preview unavailable for this track.
      </div>`;
  },

  async playSong(song) {
    if (!this.hasPreview(song)) return false;
    this.renderNowPlaying(song);
    return true;
  },
};