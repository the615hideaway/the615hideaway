// Add these functions to your Radio Now Code.gs, then redeploy Apps Script.
// Set Script Property RADIO_SERVICE_KEY to match Vercel env RADIO_SERVICE_KEY.

function getRadioServiceKey_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('RADIO_SERVICE_KEY');
  if (!key) {
    throw new Error('RADIO_SERVICE_KEY is not set in Apps Script project properties.');
  }
  return key;
}

function requireRadioServiceKey_(body) {
  var incoming = String((body && body.serviceKey) || '').trim();
  if (!incoming || incoming !== getRadioServiceKey_()) {
    throw new Error('Unauthorized catalog bridge request.');
  }
}

function hashPasswordPlaceholder_() {
  return hashPassword_(Utilities.getUuid());
}

function djSessionForSupabase_(body) {
  requireRadioServiceKey_(body);

  var email = normalizeEmail_(body.email);
  if (!email) throw new Error('Email is required.');

  var profile = body.profile || {};
  var dj = findDjByEmail_(email);
  var created = false;

  if (!dj) {
    var djId = 'dj-' + Utilities.getUuid().slice(0, 8);
    var createdAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    var hashed = hashPasswordPlaceholder_();
    dj = buildDjFromSignup_(Object.assign({ email: email }, profile), djId, hashed, createdAt);
    appendRowByHeaders_(getDjSheet_(), dj);
    created = true;
  } else if (profile && Object.keys(profile).length) {
    dj = updateDjFromSupabaseProfile_(dj, profile);
  }

  if (String(dj.status).toLowerCase() !== 'active') {
    dj.status = 'active';
    updateDjRowByEmail_(dj);
  }

  return {
    success: true,
    token: createSessionToken_(dj),
    dj: publicDj_(dj),
    created: created,
  };
}

function updateDjFromSupabaseProfile_(dj, profile) {
  var firstName = String(profile.firstName || profile.first_name || dj.first_name || '').trim();
  var lastName = String(profile.lastName || profile.last_name || dj.last_name || '').trim();
  var programName = String(profile.programName || profile.program_name || dj.program_name || dj.show_name || '').trim();
  var stationCall = String(profile.stationCallLetters || profile.station_call_letters || dj.station_call_letters || dj.station || '').trim();

  if (firstName) dj.first_name = firstName;
  if (lastName) dj.last_name = lastName;
  if (programName) {
    dj.program_name = programName;
    dj.show_name = programName;
  }
  if (stationCall) {
    dj.station_call_letters = stationCall;
    dj.station = stationCall;
  }

  dj.program_format = String(profile.programFormat || profile.program_format || dj.program_format || '').trim();
  dj.station_frequency = String(profile.stationFrequency || profile.station_frequency || dj.station_frequency || '').trim();
  dj.state = String(profile.state || dj.state || '').trim();
  dj.station_website = String(profile.stationWebsite || profile.station_website || dj.station_website || '').trim();
  dj.program_website = String(profile.programWebsite || profile.program_website || dj.program_website || '').trim();
  dj.program_start_time = String(profile.programStartTime || profile.program_start_time || dj.program_start_time || '').trim();
  dj.program_end_time = String(profile.programEndTime || profile.program_end_time || dj.program_end_time || '').trim();
  dj.program_timezone = String(profile.programTimezone || profile.program_timezone || dj.program_timezone || '').trim();
  dj.program_days = String(profile.programDays || profile.program_days || dj.program_days || '').trim();

  var contactEmail = normalizeEmail_(profile.contactEmail || profile.contact_email || dj.dj_contact_email || dj.email);
  if (contactEmail) dj.dj_contact_email = contactEmail;

  if (typeof profile.shareEmail !== 'undefined') {
    dj.share_email = shareEmailValue_(!!profile.shareEmail);
  }

  dj.name = djFullName_(dj.first_name, dj.last_name, dj.name);
  updateDjRowByEmail_(dj);
  return dj;
}

function updateDjRowByEmail_(dj) {
  var sheet = getDjSheet_();
  var headerMap = getDjHeaderMap_(sheet);
  var rows = sheet.getDataRange().getValues();
  var email = normalizeEmail_(dj.email);

  for (var i = 1; i < rows.length; i++) {
    var rowDj = djRowToObject_(rows[i], headerMap);
    if (normalizeEmail_(rowDj.email) !== email) continue;

    Object.keys(headerMap).forEach(function (key) {
      if (typeof dj[key] !== 'undefined') {
        sheet.getRange(i + 1, headerMap[key]).setValue(dj[key]);
      }
    });
    return;
  }
}

// In doPost, add before the final return:
// if (action === 'dj_session_for_supabase') {
//   return jsonResponse_(djSessionForSupabase_(body));
// }