const DjSignupForm = {
  timezones: [
    'Eastern',
    'Central',
    'Mountain',
    'Pacific',
    'Alaska',
    'Hawaii',
  ],

  formats: [
    'Bluegrass',
    'Americana',
    'Folk',
    'Country',
    'Gospel',
    'Mixed / Multi-format',
    'Other',
  ],

  idPrefix(mode = 'signup') {
    return mode === 'profile' ? 'profile' : 'signup';
  },

  fieldId(name, mode = 'signup') {
    return `${this.idPrefix(mode)}-${name}`;
  },

  fieldsHtml(options = {}) {
    const mode = options.mode || 'signup';
    const p = (name) => this.fieldId(name, mode);
    const isProfile = mode === 'profile';
    const isComplete = mode === 'complete';

    const formatOptions = this.formats.map((value) =>
      `<option value="${Utils.escapeHtml(value)}">${Utils.escapeHtml(value)}</option>`,
    ).join('');

    const timezoneOptions = this.timezones.map((value) =>
      `<option value="${Utils.escapeHtml(value)}">${Utils.escapeHtml(value)}</option>`,
    ).join('');

    const shareOptionHtml = `
            <div class="dj-signup-option">
              <p class="dj-signup-option-label">Email sharing (optional)</p>
              <label class="checkbox-field checkbox-field--panel">
                <input type="checkbox" id="${p('share-email')}">
                <span>Share my DJ contact email with artists when I download their music</span>
              </label>
            </div>`;

    const note = isComplete
      ? 'You are signed in. Add your station and program details below, then save to open the Radio Now catalog.'
      : isProfile
        ? 'Artists see these station and program details when they download your music. Your login email stays private — only your DJ contact email can be shared below.'
        : 'Artists see your station and program details when they download your music. Set a DJ contact email if you want artists to reach you on a different address than your login.';

    const contactSection = `
        <fieldset class="dj-signup-section">
          <legend>Contact</legend>
          <div class="dj-signup-grid">
            <div>
              <label for="${p('contact-email')}">DJ Contact Email</label>
              <input type="email" id="${p('contact-email')}" placeholder="promo@station.com" autocomplete="email">
              <p class="field-help">Email artists and labels can use to reach you when you download their music.</p>
            </div>
          </div>
        </fieldset>`;

    const accountSection = (isProfile || isComplete) ? (contactSection + (isComplete ? shareOptionHtml : '')) : `
        <fieldset class="dj-signup-section">
          <legend>Account</legend>
          <div class="dj-signup-grid">
            <div>
              <label for="${p('email')}">Login Email</label>
              <input type="email" id="${p('email')}" placeholder="you@station.com" autocomplete="email" required>
            </div>
            <div>
              <label for="${p('contact-email')}">DJ Contact Email</label>
              <input type="email" id="${p('contact-email')}" placeholder="promo@station.com" autocomplete="email">
              <p class="field-help">Can differ from your login. Artists see this when sharing is enabled.</p>
            </div>
            <div>
              <label for="${p('password')}">Password</label>
              <input type="password" id="${p('password')}" placeholder="At least 8 characters" autocomplete="new-password" minlength="8" required>
            </div>
            ${shareOptionHtml}
          </div>
        </fieldset>`;

    const intro = isComplete
      ? '<h2 class="dj-signup-intro">Finish your DJ profile</h2>'
      : isProfile
        ? '<h2 class="dj-signup-intro">Update your DJ profile</h2>'
        : '<h2 class="dj-signup-intro">Create your free DJ account</h2>';

    return `
      <div class="dj-signup-form dashboard-form ${isProfile ? 'dj-signup-form--profile' : ''}">
        ${intro}
        <p class="auth-panel-note">${note}</p>

        <fieldset class="dj-signup-section">
          <legend>Your name</legend>
          <div class="dj-signup-grid dj-signup-grid--2">
            <div>
              <label for="${p('first-name')}">First Name</label>
              <input type="text" id="${p('first-name')}" placeholder="Sammy" autocomplete="given-name" required>
            </div>
            <div>
              <label for="${p('last-name')}">Last Name</label>
              <input type="text" id="${p('last-name')}" placeholder="Passamano" autocomplete="family-name" required>
            </div>
          </div>
        </fieldset>

        <fieldset class="dj-signup-section">
          <legend>Program</legend>
          <div class="dj-signup-grid">
            <div>
              <label for="${p('program-name')}">Program Name</label>
              <input type="text" id="${p('program-name')}" placeholder="Radio Now" required>
            </div>
            <div>
              <label for="${p('program-format')}">Program Format</label>
              <select id="${p('program-format')}">
                <option value="">Select format</option>
                ${formatOptions}
              </select>
            </div>
            <div>
              <label for="${p('program-days')}">Day of Program</label>
              <input type="text" id="${p('program-days')}" placeholder="Saturday, Sunday">
            </div>
            <div class="dj-signup-grid dj-signup-grid--3">
              <div>
                <label for="${p('program-start')}">Program Start Time</label>
                <input type="time" id="${p('program-start')}">
              </div>
              <div>
                <label for="${p('program-end')}">Program End Time</label>
                <input type="time" id="${p('program-end')}">
              </div>
              <div>
                <label for="${p('program-timezone')}">Time Zone</label>
                <select id="${p('program-timezone')}">
                  <option value="">Select time zone</option>
                  ${timezoneOptions}
                </select>
              </div>
            </div>
            <div>
              <label for="${p('program-website')}">Program Website / Page</label>
              <input type="url" id="${p('program-website')}" placeholder="https://">
            </div>
          </div>
        </fieldset>

        <fieldset class="dj-signup-section">
          <legend>Station</legend>
          <div class="dj-signup-grid dj-signup-grid--2">
            <div>
              <label for="${p('station-call')}">Station Call Letters</label>
              <input type="text" id="${p('station-call')}" placeholder="WMTS" required>
            </div>
            <div>
              <label for="${p('station-frequency')}">Radio Station Frequency</label>
              <input type="text" id="${p('station-frequency')}" placeholder="88.3 FM">
            </div>
            <div>
              <label for="${p('state')}">State</label>
              <input type="text" id="${p('state')}" placeholder="TN" autocomplete="address-level1">
            </div>
            <div>
              <label for="${p('station-website')}">Station Website</label>
              <input type="url" id="${p('station-website')}" placeholder="https://">
            </div>
          </div>
        </fieldset>
        ${accountSection}
      </div>`;
  },

  mount(options = {}) {
    const form = document.getElementById('signup-form');
    if (!form) return;

    const mode = options.mode || form.dataset.djSignupMode || 'signup';
    if (form.dataset.djSignupMounted === '1' && form.dataset.djSignupMode === mode) return;

    const submitBtn = form.querySelector('button[type="submit"]');
    const existingHost = document.getElementById('dj-signup-fields');
    if (existingHost) existingHost.remove();

    Array.from(form.children).forEach((child) => {
      if (child === submitBtn) return;
      if (child.id === 'signup-error' || child.id === 'signup-notice') return;
      if (child.classList.contains('login-error') || child.classList.contains('login-notice')) return;
      child.remove();
    });

    const fieldsHost = document.createElement('div');
    fieldsHost.id = 'dj-signup-fields';
    fieldsHost.innerHTML = this.fieldsHtml({ mode });
    if (submitBtn) form.insertBefore(fieldsHost, submitBtn);
    else form.appendChild(fieldsHost);

    if (submitBtn && mode === 'complete') {
      submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save profile &amp; open catalog';
    }

    form.dataset.djSignupMounted = '1';
    form.dataset.djSignupMode = mode;
  },

  mountProfile(containerId = 'dj-profile-fields') {
    const host = document.getElementById(containerId);
    if (!host || host.dataset.djProfileMounted === '1') return;
    host.innerHTML = this.fieldsHtml({ mode: 'profile' });
    host.dataset.djProfileMounted = '1';
  },

  fieldValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    return String(el.value || '').trim();
  },

  collectFields(mode = 'signup') {
    const p = (name) => this.fieldId(name, mode);
    return {
      firstName: this.fieldValue(p('first-name')),
      lastName: this.fieldValue(p('last-name')),
      programName: this.fieldValue(p('program-name')),
      programFormat: this.fieldValue(p('program-format')),
      stationCallLetters: this.fieldValue(p('station-call')),
      stationFrequency: this.fieldValue(p('station-frequency')),
      state: this.fieldValue(p('state')),
      stationWebsite: this.fieldValue(p('station-website')),
      programWebsite: this.fieldValue(p('program-website')),
      programStartTime: this.fieldValue(p('program-start')),
      programEndTime: this.fieldValue(p('program-end')),
      programTimezone: this.fieldValue(p('program-timezone')),
      programDays: this.fieldValue(p('program-days')),
      contactEmail: this.fieldValue(p('contact-email')),
    };
  },

  collect(mode = 'signup') {
    const p = (name) => this.fieldId(name, mode);
    const payload = {
      ...this.collectFields(mode),
      shareEmail: !!document.getElementById(p('share-email'))?.checked,
    };

    if (mode === 'signup') {
      payload.email = this.fieldValue(p('email'));
      payload.password = this.fieldValue(p('password'));
    }

    return payload;
  },

  collectProfile() {
    return {
      ...this.collectFields('profile'),
      shareEmail: !!document.getElementById('share-email-toggle')?.checked,
    };
  },

  async prefillFromSession(mode = 'complete') {
    if (typeof HideawayAuth === 'undefined') return;

    const supabase = await HideawayAuth.init();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return;

    const meta = session.user.user_metadata || {};
    const pending = meta.dj_profile;
    const p = (name) => this.fieldId(name, mode);
    const setValue = (name, value) => {
      const el = document.getElementById(p(name));
      if (el && value) el.value = value;
    };

    if (!pending || typeof pending !== 'object') {
      setValue('contact-email', session.user.email || '');
      return;
    }

    setValue('first-name', pending.first_name || pending.firstName || '');
    setValue('last-name', pending.last_name || pending.lastName || '');
    setValue('program-name', pending.program_name || pending.programName || '');
    setValue('program-format', pending.program_format || pending.programFormat || '');
    setValue('program-days', pending.program_days || pending.programDays || '');
    setValue('program-start', pending.program_start_time || pending.programStartTime || '');
    setValue('program-end', pending.program_end_time || pending.programEndTime || '');
    setValue('program-timezone', pending.program_timezone || pending.programTimezone || '');
    setValue('program-website', pending.program_website || pending.programWebsite || '');
    setValue('station-call', pending.station_call_letters || pending.stationCallLetters || '');
    setValue('station-frequency', pending.station_frequency || pending.stationFrequency || '');
    setValue('state', pending.state || '');
    setValue('station-website', pending.station_website || pending.stationWebsite || '');
    setValue('contact-email', pending.contact_email || pending.contactEmail || session.user.email || '');

    const shareToggle = document.getElementById(p('share-email'));
    if (shareToggle) shareToggle.checked = !!(pending.share_email ?? pending.shareEmail);
  },

  fillFromDj(dj) {
    if (!dj) return;

    let firstName = dj.firstName || '';
    let lastName = dj.lastName || '';
    if (!firstName && !lastName && dj.name) {
      const parts = String(dj.name).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }

    const values = {
      'profile-first-name': firstName,
      'profile-last-name': lastName,
      'profile-program-name': dj.programName || dj.showName || '',
      'profile-program-format': dj.programFormat || '',
      'profile-program-days': dj.programDays || '',
      'profile-program-start': dj.programStartTime || '',
      'profile-program-end': dj.programEndTime || '',
      'profile-program-timezone': dj.programTimezone || '',
      'profile-program-website': dj.programWebsite || '',
      'profile-station-call': dj.stationCallLetters || dj.station || '',
      'profile-station-frequency': dj.stationFrequency || '',
      'profile-state': dj.state || '',
      'profile-station-website': dj.stationWebsite || '',
      'profile-contact-email': dj.contactEmail || dj.email || '',
    };

    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = value || '';
    });

    const shareToggle = document.getElementById('share-email-toggle');
    if (shareToggle) shareToggle.checked = !!dj.shareEmail;
  },
};