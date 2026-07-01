-- Artist / label portal (Supabase-only — replaces Google Sheets artist accounts)
-- Run in Supabase Dashboard → SQL Editor after migration-dj-profiles.sql

create table if not exists public.artist_profiles (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  artist_name text not null default '',
  account_type text not null default 'artist'
    check (account_type in ('artist', 'label')),
  contact_email text default '',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'pending')),
  legacy_artist_id text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_profiles_name_idx on public.artist_profiles (artist_name);
create index if not exists artist_profiles_type_idx on public.artist_profiles (account_type);

create table if not exists public.song_submissions (
  id uuid primary key default gen_random_uuid(),
  artist_user_id uuid references public.profiles(id) on delete set null,
  artist_name text not null default '',
  song_title text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  mp3_url text default '',
  wav_url text default '',
  cover_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists song_submissions_user_idx on public.song_submissions (artist_user_id, created_at desc);

create table if not exists public.label_roster_access (
  id uuid primary key default gen_random_uuid(),
  label_user_id uuid references public.profiles(id) on delete cascade not null,
  artist_profile_id uuid references public.artist_profiles(id) on delete cascade not null,
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  unique (label_user_id, artist_profile_id)
);

grant select, insert, update on table public.artist_profiles to authenticated;
grant select, insert, update on table public.song_submissions to authenticated;
grant select, insert, update on table public.label_roster_access to authenticated;

alter table public.artist_profiles enable row level security;
alter table public.song_submissions enable row level security;
alter table public.label_roster_access enable row level security;

drop policy if exists "Artists view own profile" on public.artist_profiles;
create policy "Artists view own profile"
  on public.artist_profiles for select
  using (auth.uid() = id);

drop policy if exists "Artists insert own profile" on public.artist_profiles;
create policy "Artists insert own profile"
  on public.artist_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Artists update own profile" on public.artist_profiles;
create policy "Artists update own profile"
  on public.artist_profiles for update
  using (auth.uid() = id);

drop policy if exists "Authenticated users view active artist names" on public.artist_profiles;
create policy "Authenticated users view active artist names"
  on public.artist_profiles for select
  using (auth.role() = 'authenticated' and status = 'active');

drop policy if exists "Artists manage own submissions" on public.song_submissions;
create policy "Artists manage own submissions"
  on public.song_submissions for all
  using (auth.uid() = artist_user_id)
  with check (auth.uid() = artist_user_id);

drop policy if exists "Labels manage roster access" on public.label_roster_access;
create policy "Labels manage roster access"
  on public.label_roster_access for all
  using (auth.uid() = label_user_id)
  with check (auth.uid() = label_user_id);

drop policy if exists "Labels view roster artist profiles" on public.artist_profiles;
create policy "Labels view roster artist profiles"
  on public.artist_profiles for select
  using (
    exists (
      select 1 from public.label_roster_access
      where label_roster_access.artist_profile_id = artist_profiles.id
        and label_roster_access.label_user_id = auth.uid()
        and label_roster_access.status = 'active'
    )
  );

-- Storage bucket for artist uploads (Dashboard → Storage → New bucket "radio-submissions", private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('radio-submissions', 'radio-submissions', false, 104857600)
on conflict (id) do nothing;

drop policy if exists "Artists upload own submission files" on storage.objects;
create policy "Artists upload own submission files"
  on storage.objects for insert
  with check (
    bucket_id = 'radio-submissions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Artists read own submission files" on storage.objects;
create policy "Artists read own submission files"
  on storage.objects for select
  using (
    bucket_id = 'radio-submissions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );