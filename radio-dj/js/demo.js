const Demo = {
  isActive() {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  },

  applyMode() {
    if (!this.isActive()) return;
    document.body.classList.add('demo-mode');

    const banner = document.getElementById('demo-banner');
    if (banner) banner.classList.remove('hidden');

    const welcome = document.getElementById('dj-welcome') || document.getElementById('artist-welcome');
    if (welcome) {
      welcome.textContent = 'Demo preview';
      welcome.classList.remove('hidden');
    }
  },

  bindExit(button) {
    if (!this.isActive() || !button) return;
    button.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Exit demo';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'index.html';
    });
  },

  salesNoteHtml() {
    return TurnkeyPitch.djDemoDetailNoteHtml();
  },
};