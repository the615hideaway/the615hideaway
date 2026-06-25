-- Run once in Supabase SQL Editor (if you already ran schema.sql earlier)

alter table public.profiles
  add column if not exists member_type text not null default 'fan'
  check (member_type in ('fan', 'artist', 'dj', 'festival', 'industry'));

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