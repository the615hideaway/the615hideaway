-- DJ directory visibility + feedback table (Supabase-only Radio Now)
-- Run in Supabase Dashboard → SQL Editor after migration-catalog.sql

create table if not exists public.dj_feedback (
  id uuid primary key default gen_random_uuid(),
  dj_user_id uuid references public.profiles(id) on delete set null,
  report_type text not null default '',
  status text not null default 'open',
  dj_name text default '',
  dj_email text default '',
  station text default '',
  program text default '',
  artist_name text default '',
  song_title text default '',
  issue_type text default '',
  correction text default '',
  notes text default '',
  page text default '',
  what_happened text default '',
  created_at timestamptz not null default now()
);

grant select, insert on table public.dj_feedback to authenticated;

alter table public.dj_feedback enable row level security;

drop policy if exists "DJs insert own feedback" on public.dj_feedback;
create policy "DJs insert own feedback"
  on public.dj_feedback for insert
  with check (auth.uid() = dj_user_id);

drop policy if exists "DJs read own feedback" on public.dj_feedback;
create policy "DJs read own feedback"
  on public.dj_feedback for select
  using (auth.uid() = dj_user_id);

drop policy if exists "Authenticated DJs can view directory profiles" on public.dj_profiles;
create policy "Authenticated DJs can view directory profiles"
  on public.dj_profiles for select
  using (
    auth.role() = 'authenticated'
    and profile_complete = true
  );