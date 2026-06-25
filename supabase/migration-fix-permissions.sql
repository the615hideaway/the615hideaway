-- FIX: "permission denied for table profiles"
-- Run this in Supabase → SQL Editor → Run

grant usage on schema public to anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.profiles to anon;

grant select, insert, update on table public.artists to authenticated;
grant select on table public.artists to anon;

-- Re-apply RLS policies (safe to re-run)
alter table public.profiles enable row level security;

drop policy if exists "Profiles viewable by owner" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;

create policy "Profiles viewable by owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

alter table public.artists enable row level security;

drop policy if exists "Published artists are public" on public.artists;
drop policy if exists "Owners can view own artist page" on public.artists;
drop policy if exists "Owners can insert own artist page" on public.artists;
drop policy if exists "Owners can update own artist page" on public.artists;

create policy "Published artists are public"
  on public.artists for select
  to anon, authenticated
  using (status = 'published');

create policy "Owners can view own artist page"
  on public.artists for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can insert own artist page"
  on public.artists for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "Owners can update own artist page"
  on public.artists for update
  to authenticated
  using (auth.uid() = owner_id);