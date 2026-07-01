const CONFIG = {
  basePath: '/radio-dj',
  mainSiteUrl: 'https://www.the615hideaway.com',
  siteName: 'Radio Now — (615) Hideaway Entertainment',
  authKey: 'radio_now_auth',
  djSessionKey: 'radio_now_dj_session',
  artistSessionKey: 'radio_now_artist_session',

  // Catalog: Supabase (migration-catalog.sql + /api/import-catalog)
  useSupabaseCatalog: true,
  songsDataUrl: 'data/songs.json',

  // Song submissions: Supabase Storage + song_submissions table
  useSupabaseSubmissions: true,
  submissionContactEmail: 'radio@the615hideaway.com',

  queueKey: 'radio_now_queue',
  downloadQueueKey: 'radio_now_download_queue',
  catalogPageSize: 20,

  wavRequest: {
    fromEmail: 'radio@the615hideaway.com',
    fromName: 'Radio Now',
  },

  spotlight: {
    houseArtist: 'David Parmley',
    labelName: '615 Hideaway Records',
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