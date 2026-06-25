-- The 615 Hideaway — member profiles
-- Run this in Supabase Dashboard → SQL Editor

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  display_name text,
  role text not null default 'member'
    check (role in ('member', 'dj', 'artist', 'admin')),
  member_type text not null default 'fan'
    check (member_type in ('fan', 'artist', 'dj', 'festival', 'industry')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles viewable by owner" on public.profiles;
create policy "Profiles viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, member_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'member_type', 'fan')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();