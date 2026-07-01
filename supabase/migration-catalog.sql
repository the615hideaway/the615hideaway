-- Radio Now catalog + DJ activity + spotlights (Supabase-only)
-- Run in Supabase Dashboard → SQL Editor after schema.sql and migration-dj-profiles.sql

create table if not exists public.catalog_songs (
  id text primary key,
  artist_name text not null default '',
  song_title text not null default '',
  year text default '',
  music_style text default '',
  song_time text default '',
  description text default '',
  songwriter text default '',
  featured_artist text default '',
  website text default '',
  record_label text default '',
  release_type text default '',
  album_name text default '',
  contact_email text default '',
  release_date text default '',
  mp3_url text default '',
  preview_url text default '',
  preview_stream_url text default '',
  preview_drive_id text default '',
  wav_url text default '',
  cover_url text default '',
  cover_drive_id text default '',
  cover_local text default '',
  cover_thumbnail_url text default '',
  band_members text default '',
  band_member_lines jsonb not null default '[]'::jsonb,
  spotlight_priority int not null default 0,
  spotlight_until text default '',
  spotlight_badge text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_songs_artist_idx on public.catalog_songs (artist_name);
create index if not exists catalog_songs_style_idx on public.catalog_songs (music_style);

create table if not exists public.catalog_spotlights (
  id uuid primary key default gen_random_uuid(),
  artist_name text not null,
  song_title text not null,
  priority int not null default 85,
  until_date text default '',
  badge text default 'Featured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_name, song_title)
);

create table if not exists public.dj_activity (
  id uuid primary key default gen_random_uuid(),
  dj_user_id uuid references public.profiles(id) on delete cascade not null,
  event_type text not null default '',
  song_id text default '',
  song_title text default '',
  artist_name text default '',
  music_style text default '',
  format text default '',
  created_at timestamptz not null default now()
);

create index if not exists dj_activity_user_idx on public.dj_activity (dj_user_id, created_at desc);
create index if not exists dj_activity_created_idx on public.dj_activity (created_at desc);

grant select on table public.catalog_songs to anon, authenticated;
grant select on table public.catalog_spotlights to anon, authenticated;
grant select, insert on table public.dj_activity to authenticated;

alter table public.catalog_songs enable row level security;
alter table public.catalog_spotlights enable row level security;
alter table public.dj_activity enable row level security;

drop policy if exists "Catalog songs are public" on public.catalog_songs;
create policy "Catalog songs are public"
  on public.catalog_songs for select
  using (true);

drop policy if exists "Catalog spotlights are public" on public.catalog_spotlights;
create policy "Catalog spotlights are public"
  on public.catalog_spotlights for select
  using (true);

drop policy if exists "Admins manage catalog spotlights" on public.catalog_spotlights;
create policy "Admins manage catalog spotlights"
  on public.catalog_spotlights for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "DJs log own activity" on public.dj_activity;
create policy "DJs log own activity"
  on public.dj_activity for insert
  with check (auth.uid() = dj_user_id);

drop policy if exists "DJs read own activity" on public.dj_activity;
create policy "DJs read own activity"
  on public.dj_activity for select
  using (auth.uid() = dj_user_id);

drop policy if exists "Public chart activity is readable" on public.dj_activity;
create policy "Public chart activity is readable"
  on public.dj_activity for select
  using (true);

update public.profiles
set role = 'admin'
where lower(email) = 'the615hideaway@gmail.com';