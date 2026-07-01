-- DJ profiles for Radio Now (linked to Supabase auth)
-- Run in Supabase Dashboard → SQL Editor after schema.sql

create table if not exists public.dj_profiles (
  id uuid references public.profiles(id) on delete cascade not null primary key,
  first_name text not null default '',
  last_name text not null default '',
  program_name text not null default '',
  program_format text default '',
  station_call_letters text not null default '',
  station_frequency text default '',
  state text default '',
  station_website text default '',
  program_website text default '',
  program_start_time text default '',
  program_end_time text default '',
  program_timezone text default '',
  program_days text default '',
  contact_email text default '',
  share_email boolean not null default false,
  legacy_dj_id text default '',
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on table public.dj_profiles to authenticated;
grant select on table public.dj_profiles to anon;

alter table public.dj_profiles enable row level security;

drop policy if exists "DJ profiles viewable by owner" on public.dj_profiles;
create policy "DJ profiles viewable by owner"
  on public.dj_profiles for select
  using (auth.uid() = id);

drop policy if exists "DJs insert own profile" on public.dj_profiles;
create policy "DJs insert own profile"
  on public.dj_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "DJs update own profile" on public.dj_profiles;
create policy "DJs update own profile"
  on public.dj_profiles for update
  using (auth.uid() = id);