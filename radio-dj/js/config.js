const CONFIG = {
  basePath: '/radio-dj',
  mainSiteUrl: 'https://www.the615hideaway.com',
  siteName: 'Radio Now — (615) Hideaway Entertainment',
  // Legacy shared-password key (no longer used for sign-in).
  authKey: 'radio_now_auth',
  djSessionKey: 'radio_now_dj_session',
  artistSessionKey: 'radio_now_artist_session',

  // Live catalog: reads Form Responses 1 directly (new songs show on refresh).
  // songs.json is only a fallback if the sheet fetch fails.
  catalogLiveFromSheet: true,
  catalogSheetNames: ['Form Responses 1', 'Sheet1'],
  songsDataUrl: 'data/songs.json',

  // Required for ZIP downloads: deploy google-apps-script/Code.gs from your sheet
  // (Extensions → Apps Script → Deploy as Web app → Anyone). See AUDIO-FIX-STEPS.txt.
  googleScriptUrl: 'https://script.google.com/macros/s/AKfycbxhREXi6EDdwIfIunoXbZfuBjbHPIDCoFLye-o51dJss4bvhOQQjMH23WHraY1Af2JRVw/exec',

  // Artist song submissions — Google Form (reliable file uploads up to 100 MB each).
  // Song submissions use your Google Form (link opens in new tab).
  useGoogleFormForSubmissions: true,
  artistSongFormEmbed: false,
  artistSongFormUrl: 'https://forms.gle/zFExL6otU1e7hJF59',
  artistSongFormEmbedUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfN8NL5Dg5Vs1VKifayK8itcCfmlPQmYiyhf5nvEmfi-qwYWQ/viewform?embedded=true',
  // Optional pre-fill after you create a pre-filled link in Google Forms (⋮ → Get pre-filled link).
  artistSongFormPrefill: {
    artistName: '',
    contactEmail: '',
  },

  // Demo dashboards: DJ "Sammy Passamano", artist "David Parmley" (see Code.gs DEMO_DJ_NAME / DEMO_ARTIST_NAME).

  // Optional fallback: Google Cloud API key with Drive API enabled (public files only).
  googleApiKey: '',

  // Used only by scripts/sync-sheet-to-json.ps1 (not loaded live by the site).
  googleSheetId: '1EXNdRluPjwyaY5ktt-qHI2bNF7IT5bD1udnCgkKNdkU',
  sheetName: 'Form Responses 1',

  queueKey: 'radio_now_queue',
  downloadQueueKey: 'radio_now_download_queue',

  catalogPageSize: 20,

  // WAV files stay in the label Drive folder (not DJ downloads). Match MP3 naming.
  wavFolderId: '137edNXYOv3xTVy7q4o1NKcTGMyshzR7MtN1BthqeXydD1Gwq-0V7JsRQR-9tXSYR45rsILzX',
  wavNamingExample: 'Song Title - Artist Name.wav',

  wavRequest: {
    fromEmail: 'radio@the615hideaway.com',
    fromName: 'Radio Now',
  },

  spotlight: {
    houseArtist: 'David Parmley',
    labelName: '615 Hideaway Records',
    spotlightSheetName: 'Spotlights',
    spotlightAdminDjs: ['Sammy Passamano'],
    spotlightAdminEmails: ['the615hideaway@gmail.com'],
    spotlightCuratorName: 'Radio Now',
    autoFeatureHouseArtist: false,
    autoFeatureNewReleases: true,
    labelNewReleaseDays: 30,
    labelNewReleaseScore: 75,
    houseArtistScore: 100,
    maxSlots: 20,
    defaultDays: 30,
    autoFillCount: 5,
    autoFillScore: 80,
  },
};