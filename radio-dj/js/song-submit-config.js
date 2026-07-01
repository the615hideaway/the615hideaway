const SongSubmitConfig = {
  musicStyles: [
    'Bluegrass',
    'Traditional Bluegrass',
    'Modern Bluegrass',
    'Progressive Bluegrass',
    'Bluegrass Gospel',
    'Gospel',
    'Country',
    'Americana',
    'Folk',
    'Holiday Music',
    'Instrumental',
  ],

  musicStyleOptionsHtml(selected = '') {
    const value = String(selected || '').trim();
    return [
      '<option value="">Select music style</option>',
      ...this.musicStyles.map((style) => {
        const sel = style === value ? ' selected' : '';
        return `<option value="${Utils.escapeHtml(style)}"${sel}>${Utils.escapeHtml(style)}</option>`;
      }),
    ].join('');
  },

  mountMusicStyleSelect(selectId = 'submit-music-style', selected = '') {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = this.musicStyleOptionsHtml(selected);
    select.required = true;
  },
};