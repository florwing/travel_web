create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 320
    and position('@' in email) > 1
  ),
  role text not null default 'viewer' check (role = 'viewer'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (trip_id, email)
);

create index trip_members_email_idx on public.trip_members (email);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;

create or replace function private.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.trips as t
      where t.id = target_trip_id
        and t.owner_id = (select auth.uid())
    ),
    false
  );
$$;

create or replace function private.can_view_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.trips as t
        where t.id = target_trip_id
          and t.owner_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.trip_members as tm
        join auth.users as u
          on lower(u.email) = tm.email
        where tm.trip_id = target_trip_id
          and u.id = (select auth.uid())
          and u.email_confirmed_at is not null
      )
    ),
    false
  );
$$;

create or replace function private.is_own_membership(member_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and exists (
      select 1
      from auth.users as u
      where u.id = (select auth.uid())
        and u.email_confirmed_at is not null
        and lower(u.email) = lower(member_email)
    ),
    false
  );
$$;

create or replace function private.object_trip_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function private.can_view_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_trip(private.object_trip_id(object_name));
$$;

create or replace function private.is_storage_owner(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_trip_owner(private.object_trip_id(object_name));
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function private.is_trip_owner(uuid) from public, anon, authenticated;
revoke all on function private.can_view_trip(uuid) from public, anon, authenticated;
revoke all on function private.is_own_membership(text) from public, anon, authenticated;
revoke all on function private.object_trip_id(text) from public, anon, authenticated;
revoke all on function private.can_view_storage_object(text) from public, anon, authenticated;
revoke all on function private.is_storage_owner(text) from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

grant execute on function private.is_trip_owner(uuid) to authenticated;
grant execute on function private.can_view_trip(uuid) to authenticated;
grant execute on function private.is_own_membership(text) to authenticated;
grant execute on function private.object_trip_id(text) to authenticated;
grant execute on function private.can_view_storage_object(text) to authenticated;
grant execute on function private.is_storage_owner(text) to authenticated;

create trigger set_trips_updated_at
before update on public.trips
for each row execute function private.set_updated_at();

create policy trips_select_owner_or_member
on public.trips
for select
to authenticated
using (private.can_view_trip(id));

create policy trips_insert_owner
on public.trips
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and owner_id = (select auth.uid())
);

create policy trips_update_owner
on public.trips
for update
to authenticated
using (private.is_trip_owner(id))
with check (
  private.is_trip_owner(id)
  and owner_id = (select auth.uid())
);

create policy trips_delete_owner
on public.trips
for delete
to authenticated
using (private.is_trip_owner(id));

create policy trip_members_select_owner_or_self
on public.trip_members
for select
to authenticated
using (
  private.is_trip_owner(trip_id)
  or private.is_own_membership(email)
);

create policy trip_members_insert_owner
on public.trip_members
for insert
to authenticated
with check (private.is_trip_owner(trip_id));

create policy trip_members_update_owner
on public.trip_members
for update
to authenticated
using (private.is_trip_owner(trip_id))
with check (private.is_trip_owner(trip_id));

create policy trip_members_delete_owner
on public.trip_members
for delete
to authenticated
using (private.is_trip_owner(trip_id));

revoke all on public.trips from anon, authenticated;
revoke all on public.trip_members from anon, authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'travel-files',
  'travel-files',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy travel_files_select_owner_or_member
on storage.objects
for select
to authenticated
using (
  bucket_id = 'travel-files'
  and private.can_view_storage_object(name)
);

create policy travel_files_insert_owner
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'travel-files'
  and private.is_storage_owner(name)
);

create policy travel_files_update_owner
on storage.objects
for update
to authenticated
using (
  bucket_id = 'travel-files'
  and private.is_storage_owner(name)
)
with check (
  bucket_id = 'travel-files'
  and private.is_storage_owner(name)
);

create policy travel_files_delete_owner
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'travel-files'
  and private.is_storage_owner(name)
);
