module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Supabase is not configured on the server.' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim();
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
  const email = String(user?.email || '').trim().toLowerCase();

  if (!email) {
    res.status(401).json({ error: 'Signed-in user has no email.' });
    return;
  }

  let profile = {};
  try {
    profile = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch (_) {
    profile = {};
  }

  res.status(200).json({
    token: '',
    dj: mapDjFromProfile(profile, user),
    sheetLinked: false,
  });
};

function mapDjFromProfile(profile, user) {
  const firstName = String(profile.firstName || profile.first_name || '').trim();
  const lastName = String(profile.lastName || profile.last_name || '').trim();
  const name = [firstName, lastName].filter(Boolean).join(' ') || user?.user_metadata?.display_name || emailLocal(user?.email);

  return {
    id: profile.legacyDjId || profile.legacy_dj_id || user?.id || '',
    name,
    email: user?.email || '',
    contactEmail: profile.contactEmail || profile.contact_email || user?.email || '',
    station: profile.stationCallLetters || profile.station_call_letters || '',
    showName: profile.programName || profile.program_name || '',
    shareEmail: !!profile.shareEmail,
    firstName,
    lastName,
    programName: profile.programName || profile.program_name || '',
    programFormat: profile.programFormat || profile.program_format || '',
    stationCallLetters: profile.stationCallLetters || profile.station_call_letters || '',
    stationFrequency: profile.stationFrequency || profile.station_frequency || '',
    state: profile.state || '',
    stationWebsite: profile.stationWebsite || profile.station_website || '',
    programWebsite: profile.programWebsite || profile.program_website || '',
    programStartTime: profile.programStartTime || profile.program_start_time || '',
    programEndTime: profile.programEndTime || profile.program_end_time || '',
    programTimezone: profile.programTimezone || profile.program_timezone || '',
    programDays: profile.programDays || profile.program_days || '',
  };
}

function emailLocal(email) {
  return String(email || '').split('@')[0] || 'DJ';
}