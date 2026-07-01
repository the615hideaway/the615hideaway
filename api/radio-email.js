module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY || '';
  const fromEmail = process.env.RADIO_FROM_EMAIL || 'radio@the615hideaway.com';
  const adminEmail = process.env.RADIO_ADMIN_EMAIL || 'the615hideaway@gmail.com';

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Supabase is not configured on the server.' });
    return;
  }

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!userResponse.ok) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }

  const userPayload = await userResponse.json();
  const user = userPayload?.user || userPayload;

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    body = {};
  }

  if (!resendKey) {
    res.status(503).json({
      error: 'Email sending is not configured yet. Add RESEND_API_KEY in Vercel, or use the mailto fallback.',
    });
    return;
  }

  const type = String(body.type || '').trim();

  if (type === 'wav_request') {
    const artistName = String(body.artistName || '').trim();
    const songTitle = String(body.songTitle || '').trim();
    const contactEmail = normalizeEmail(body.contactEmail);
    const recordLabel = String(body.recordLabel || '').trim();

    if (!artistName || !songTitle) {
      res.status(400).json({ error: 'Song info is required.' });
      return;
    }
    if (!contactEmail) {
      res.status(400).json({ error: 'This song has no contact email listed.' });
      return;
    }

    const profile = await loadDjProfile(supabaseUrl, supabaseAnonKey, accessToken, user.id);
    const djName = displayName(profile, user);
    const replyTo = normalizeEmail(profile?.contact_email) || normalizeEmail(user.email);
    const subject = `DJ requests WAV for your song — ${songTitle} — ${artistName}`;

    const html = emailShell('WAV request from a Radio Now DJ', [
      'A Radio Now DJ is requesting a broadcast WAV file for airplay.',
      line('Song', songTitle),
      line('Artist', artistName),
      recordLabel ? line('Label', recordLabel) : '',
      line('DJ name', djName),
      line('Station', profile?.station_call_letters || '—'),
      line('Show', profile?.program_name || '—'),
      line('DJ email', replyTo || '—'),
      'Please reply with the WAV file or a download link when you can.',
    ].filter(Boolean));

    await sendResend(resendKey, {
      from: `Radio Now <${fromEmail}>`,
      to: [contactEmail],
      reply_to: replyTo || undefined,
      subject,
      html,
    });

    res.status(200).json({
      success: true,
      sentTo: contactEmail,
      replyTo,
      subject,
    });
    return;
  }

  if (type === 'dj_feedback') {
    const reportType = String(body.report_type || body.reportType || '').trim();
    const subject = reportType === 'site_bug'
      ? `Radio Now site bug — ${body.page || 'unknown page'}`
      : `Radio Now catalog correction — ${body.song_title || body.songTitle || 'song'}`;

    const html = emailShell('DJ feedback from Radio Now', [
      line('Report ID', body.reportId || '—'),
      line('Type', reportType),
      line('DJ', body.dj_name || body.djName || '—'),
      line('Email', body.dj_email || body.djEmail || '—'),
      line('Station', body.station || '—'),
      line('Program', body.program || '—'),
      body.artist_name || body.artistName ? line('Artist', body.artist_name || body.artistName) : '',
      body.song_title || body.songTitle ? line('Song', body.song_title || body.songTitle) : '',
      body.issue_type || body.issueType ? line('Issue', body.issue_type || body.issueType) : '',
      body.correction ? line('Correction', body.correction) : '',
      body.page ? line('Page', body.page) : '',
      body.what_happened || body.whatHappened ? line('What happened', body.what_happened || body.whatHappened) : '',
      body.notes ? line('Notes', body.notes) : '',
    ].filter(Boolean));

    await sendResend(resendKey, {
      from: `Radio Now <${fromEmail}>`,
      to: [adminEmail],
      reply_to: normalizeEmail(body.dj_email || body.djEmail) || undefined,
      subject,
      html,
    });

    res.status(200).json({ success: true });
    return;
  }

  res.status(400).json({ error: 'Unknown email type.' });
};

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email.includes('@') ? email : '';
}

function displayName(profile, user) {
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  return name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Radio Now DJ';
}

async function loadDjProfile(supabaseUrl, supabaseAnonKey, accessToken, userId) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/dj_profiles?id=eq.${userId}&select=*`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
    },
  );

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function line(label, value) {
  return `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`;
}

function emailShell(title, lines) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111;">
      <h2 style="margin:0 0 16px;">${escapeHtml(title)}</h2>
      ${lines.map((entry) => `<p style="margin:0 0 10px;">${entry}</p>`).join('')}
      <p style="margin:16px 0 0;color:#555;">Radio Now — (615) Hideaway Entertainment</p>
    </div>`;
}

async function sendResend(apiKey, payload) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Email service failed.';
    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch (_) {}
    throw new Error(message);
  }
}