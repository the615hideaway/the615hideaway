const FileUploadField = {
  files: new Map(),

  render(options = {}) {
    const id = String(options.id || '').trim();
    const label = options.label || 'File';
    const accept = options.accept || '';
    const hint = options.hint || 'Choose your file — it uploads to Radio Now when you submit.';

    return `
      <div class="form-field file-upload-field" data-file-upload="${Utils.escapeHtml(id)}">
        <label for="${Utils.escapeHtml(id)}-file">${Utils.escapeHtml(label)}</label>
        <div class="file-upload-dropzone" id="${Utils.escapeHtml(id)}-dropzone">
          <input
            type="file"
            class="file-upload-input"
            id="${Utils.escapeHtml(id)}-file"
            accept="${Utils.escapeHtml(accept)}"
            hidden
          >
          <button type="button" class="btn btn-secondary file-upload-btn" data-file-trigger="${Utils.escapeHtml(id)}-file">
            <i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i>
            Choose file
          </button>
          <p class="file-upload-status" id="${Utils.escapeHtml(id)}-status" aria-live="polite">No file selected</p>
          <p class="file-upload-hint">${Utils.escapeHtml(hint)}</p>
        </div>
      </div>`;
  },

  bind(root = document) {
    root.querySelectorAll('[data-file-upload]').forEach((field) => {
      if (field.dataset.bound === 'true') return;
      field.dataset.bound = 'true';

      const id = field.dataset.fileUpload;
      const fileInput = field.querySelector('.file-upload-input');
      const trigger = field.querySelector('[data-file-trigger]');
      const status = field.querySelector('.file-upload-status');

      trigger?.addEventListener('click', () => fileInput?.click());

      fileInput?.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) {
          this.files.delete(id);
          if (status) {
            status.textContent = 'No file selected';
            status.classList.remove('has-file');
          }
          return;
        }

        this.files.set(id, file);
        if (status) {
          status.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${Utils.escapeHtml(file.name)} ready to upload`;
          status.classList.add('has-file');
        }
      });
    });
  },

  getFile(id) {
    return this.files.get(id) || null;
  },

  hasFile(id) {
    return this.files.has(id);
  },

  readBase64(id) {
    const file = this.getFile(id);
    if (!file) return Promise.resolve('');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsDataURL(file);
    });
  },

  reset(id) {
    const fileInput = document.getElementById(`${id}-file`);
    const status = document.getElementById(`${id}-status`);

    this.files.delete(id);
    if (fileInput) fileInput.value = '';
    if (status) {
      status.textContent = 'No file selected';
      status.classList.remove('has-file');
    }
  },

  resetAll(ids = []) {
    ids.forEach((id) => this.reset(id));
  },

  setOnFileStatus(id, message) {
    const status = document.getElementById(`${id}-status`);
    if (!status) return;
    status.innerHTML = `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> ${Utils.escapeHtml(message)}`;
    status.classList.add('has-file');
    status.classList.remove('is-uploading');
  },
};