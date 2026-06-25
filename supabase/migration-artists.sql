-- Artist-owned pages — run in Supabase SQL Editor

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade not null unique,
  slug text not null unique,
  display_name text not null,
  bio text default '',
  photo_url text default '',
  bandsintown_url text default '',
  streaming_url text default '',
  website_url text default '',
  booking_email text default '',
  booking_phone text default '',
  badge_text text default '',
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artists_slug_idx on public.artists (slug);
create index if not exists artists_status_idx on public.artists (status);

grant select, insert, update on table public.artists to authenticated;
grant select on table public.artists to anon;

alter table public.artists enable row level security;

drop policy if exists "Published artists are public" on public.artists;
create policy "Published artists are public"
  on public.artists for select
  using (status = 'published');

drop policy if exists "Owners can view own artist page" on public.artists;
create policy "Owners can view own artist page"
  on public.artists for select
  using (auth.uid() = owner_id);

drop policy if exists "Owners can insert own artist page" on public.artists;
create policy "Owners can insert own artist page"
  on public.artists for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Owners can update own artist page" on public.artists;
create policy "Owners can update own artist page"
  on public.artists for update
  using (auth.uid() = owner_id);