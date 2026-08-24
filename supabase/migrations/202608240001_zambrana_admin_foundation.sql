begin;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  brand text not null,
  model text not null,
  full_name text not null,
  type text,
  year integer,
  mileage integer,
  transmission text,
  fuel text,
  price_amount numeric(14, 2),
  currency text not null default 'ARS',
  color text,
  status text not null default 'available',
  short_description text,
  description text,
  highlights jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  featured_order integer,
  legacy_source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint vehicles_brand_not_blank_check check (btrim(brand) <> ''),
  constraint vehicles_model_not_blank_check check (btrim(model) <> ''),
  constraint vehicles_full_name_not_blank_check check (btrim(full_name) <> ''),
  constraint vehicles_year_check check (year is null or year between 1886 and 2100),
  constraint vehicles_mileage_check check (mileage is null or mileage >= 0),
  constraint vehicles_price_amount_check check (price_amount is null or price_amount >= 0),
  constraint vehicles_currency_check check (currency in ('ARS', 'USD')),
  constraint vehicles_status_check check (status in ('available', 'reserved', 'preparing', 'sold')),
  constraint vehicles_highlights_array_check check (jsonb_typeof(highlights) = 'array'),
  constraint vehicles_featured_order_check
    check (
      (is_featured and featured_order is not null and featured_order >= 0)
      or (not is_featured and featured_order is null)
    )
);

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  storage_path text not null unique,
  position integer not null default 0,
  is_cover boolean not null default false,
  alt_text text,
  mime_type text,
  width integer,
  height integer,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint vehicle_images_position_check check (position >= 0),
  constraint vehicle_images_mime_type_check
    check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint vehicle_images_width_check check (width is null or width > 0),
  constraint vehicle_images_height_check check (height is null or height > 0),
  constraint vehicle_images_size_bytes_check check (size_bytes is null or size_bytes >= 0),
  constraint vehicle_images_storage_path_check
    check (storage_path ~ '^vehicles/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
);

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor',
  active boolean not null default true,
  constraint admin_profiles_role_check check (role in ('admin', 'editor'))
);

create index if not exists vehicle_images_vehicle_id_position_idx
  on public.vehicle_images (vehicle_id, position, id);

create unique index if not exists vehicle_images_one_cover_per_vehicle_idx
  on public.vehicle_images (vehicle_id)
  where is_cover;

create index if not exists vehicles_status_idx on public.vehicles (status);

create index if not exists vehicles_public_catalog_idx
  on public.vehicles (is_featured desc, featured_order asc, created_at desc)
  where is_published;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = (select auth.uid())
      and active = true
      and role in ('admin', 'editor')
  );
$$;

revoke all on function public.is_active_admin() from public, anon;
grant execute on function public.is_active_admin() to authenticated;

create or replace function public.set_vehicle_cover(
  p_vehicle_id uuid,
  p_image_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.vehicle_images
    where id = p_image_id and vehicle_id = p_vehicle_id
  ) then
    raise exception 'image does not belong to vehicle' using errcode = '22023';
  end if;

  update public.vehicle_images
  set is_cover = (id = p_image_id)
  where vehicle_id = p_vehicle_id;
end;
$$;

revoke all on function public.set_vehicle_cover(uuid, uuid) from public, anon;
grant execute on function public.set_vehicle_cover(uuid, uuid) to authenticated;

create or replace function public.reorder_vehicle_images(
  p_vehicle_id uuid,
  p_image_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count integer;
  received_count integer;
begin
  if not public.is_active_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select count(*) into expected_count
  from public.vehicle_images
  where vehicle_id = p_vehicle_id;

  select count(distinct input.image_id) into received_count
  from unnest(coalesce(p_image_ids, array[]::uuid[])) as input(image_id);

  if expected_count <> cardinality(coalesce(p_image_ids, array[]::uuid[]))
    or received_count <> expected_count
    or (
      select count(*)
      from public.vehicle_images
      where vehicle_id = p_vehicle_id
        and id = any(coalesce(p_image_ids, array[]::uuid[]))
    ) <> expected_count then
    raise exception 'image list must contain every vehicle image exactly once'
      using errcode = '22023';
  end if;

  update public.vehicle_images as image
  set position = ordered.ordinality - 1
  from unnest(p_image_ids) with ordinality as ordered(image_id, ordinality)
  where image.id = ordered.image_id
    and image.vehicle_id = p_vehicle_id;
end;
$$;

revoke all on function public.reorder_vehicle_images(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_vehicle_images(uuid, uuid[]) to authenticated;

alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.admin_profiles enable row level security;

revoke all on table public.vehicles from anon, authenticated;
revoke all on table public.vehicle_images from anon, authenticated;
revoke all on table public.admin_profiles from anon, authenticated;

grant select on table public.vehicles, public.vehicle_images to anon, authenticated;
grant insert, update, delete on table public.vehicles, public.vehicle_images to authenticated;
grant select on table public.admin_profiles to authenticated;

drop policy if exists vehicles_public_read on public.vehicles;
create policy vehicles_public_read
on public.vehicles for select to anon, authenticated
using (is_published = true);

drop policy if exists vehicles_admin_read on public.vehicles;
create policy vehicles_admin_read
on public.vehicles for select to authenticated
using ((select public.is_active_admin()));

drop policy if exists vehicles_admin_insert on public.vehicles;
create policy vehicles_admin_insert
on public.vehicles for insert to authenticated
with check ((select public.is_active_admin()));

drop policy if exists vehicles_admin_update on public.vehicles;
create policy vehicles_admin_update
on public.vehicles for update to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

drop policy if exists vehicles_admin_delete on public.vehicles;
create policy vehicles_admin_delete
on public.vehicles for delete to authenticated
using ((select public.is_active_admin()));

drop policy if exists vehicle_images_public_read on public.vehicle_images;
create policy vehicle_images_public_read
on public.vehicle_images for select to anon, authenticated
using (
  exists (
    select 1 from public.vehicles
    where vehicles.id = vehicle_images.vehicle_id
      and vehicles.is_published = true
  )
);

drop policy if exists vehicle_images_admin_read on public.vehicle_images;
create policy vehicle_images_admin_read
on public.vehicle_images for select to authenticated
using ((select public.is_active_admin()));

drop policy if exists vehicle_images_admin_insert on public.vehicle_images;
create policy vehicle_images_admin_insert
on public.vehicle_images for insert to authenticated
with check ((select public.is_active_admin()));

drop policy if exists vehicle_images_admin_update on public.vehicle_images;
create policy vehicle_images_admin_update
on public.vehicle_images for update to authenticated
using ((select public.is_active_admin()))
with check ((select public.is_active_admin()));

drop policy if exists vehicle_images_admin_delete on public.vehicle_images;
create policy vehicle_images_admin_delete
on public.vehicle_images for delete to authenticated
using ((select public.is_active_admin()));

drop policy if exists admin_profiles_read_own on public.admin_profiles;
create policy admin_profiles_read_own
on public.admin_profiles for select to authenticated
using (id = (select auth.uid()));

-- The bucket stays private at the transport level so unpublished images cannot
-- be fetched through an unprotected public URL. Anonymous reads are still
-- supported through the Storage API and the SELECT policy below.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'vehicle-images',
  'vehicle-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vehicle_images_storage_public_read on storage.objects;
create policy vehicle_images_storage_public_read
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'vehicle-images'
  and exists (
    select 1
    from public.vehicle_images as image
    join public.vehicles as vehicle on vehicle.id = image.vehicle_id
    where image.storage_path = storage.objects.name
      and vehicle.is_published = true
  )
);

drop policy if exists vehicle_images_storage_admin_read on storage.objects;
create policy vehicle_images_storage_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'vehicle-images'
  and (select public.is_active_admin())
);

drop policy if exists vehicle_images_storage_admin_insert on storage.objects;
create policy vehicle_images_storage_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (select public.is_active_admin())
  and name ~ '^vehicles/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
);

drop policy if exists vehicle_images_storage_admin_update on storage.objects;
create policy vehicle_images_storage_admin_update
on storage.objects for update to authenticated
using (
  bucket_id = 'vehicle-images'
  and (select public.is_active_admin())
)
with check (
  bucket_id = 'vehicle-images'
  and (select public.is_active_admin())
  and name ~ '^vehicles/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
);

drop policy if exists vehicle_images_storage_admin_delete on storage.objects;
create policy vehicle_images_storage_admin_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'vehicle-images'
  and (select public.is_active_admin())
);

commit;
