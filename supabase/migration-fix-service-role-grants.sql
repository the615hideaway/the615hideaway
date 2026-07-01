-- Fix: service_role needs write access for catalog import + admin tasks
-- Run once in Supabase Dashboard → SQL Editor

grant select, insert, update, delete on table public.catalog_songs to service_role;
grant select, insert, update, delete on table public.catalog_spotlights to service_role;
grant select, insert, update, delete on table public.dj_activity to service_role;
grant select, insert, update, delete on table public.dj_feedback to service_role;
grant select, insert, update, delete on table public.artist_profiles to service_role;
grant select, insert, update, delete on table public.song_submissions to service_role;
grant select, insert, update, delete on table public.label_roster_access to service_role;
grant select, insert, update, delete on table public.dj_profiles to service_role;
grant select, insert, update, delete on table public.profiles to service_role;