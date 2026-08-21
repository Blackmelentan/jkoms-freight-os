-- =============================================================================
-- JKOMS Freight OS — initial schema
-- Run in Supabase SQL editor, or via `supabase db push` if using the CLI.
-- =============================================================================

-- ---- Extensions ----
create extension if not exists "uuid-ossp";

-- ---- Enums ----
create type user_role as enum ('admin', 'warehouse', 'courier', 'client');

create type shipment_status as enum (
  'created',
  'label_printed',
  'picked_up',
  'in_transit',
  'at_depot',
  'out_for_delivery',
  'delivered',
  'delivery_failed',
  'returned',
  'exception'
);

create type service_level as enum ('standard', 'express', 'same_day');
create type scan_method as enum ('camera', 'bluetooth_hid', 'manual');

-- ---- Depots ----
create table depots (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text not null unique, -- e.g. 'BJL'
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- ---- Profiles (extends auth.users) ----
-- Created automatically via trigger below whenever a new auth user signs up.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role user_role not null default 'client',
  phone text,
  depot_id uuid references depots (id) on delete set null,
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'client');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---- Packages ----
create table packages (
  id uuid primary key default uuid_generate_v4(),
  tracking_code text not null unique,
  qr_payload text not null,
  status shipment_status not null default 'created',

  sender_name text not null,
  sender_phone text,
  sender_address text not null,

  recipient_name text not null,
  recipient_phone text not null,
  recipient_address text not null,

  origin_depot_id uuid references depots (id) on delete set null,
  destination_depot_id uuid references depots (id) on delete set null,
  assigned_courier_id uuid references profiles (id) on delete set null,

  weight_kg numeric(8, 2),
  declared_value numeric(12, 2),
  service_level service_level not null default 'standard',
  notes text,

  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_packages_status on packages (status);
create index idx_packages_tracking_code on packages (tracking_code);
create index idx_packages_created_at on packages (created_at desc);
create index idx_packages_assigned_courier on packages (assigned_courier_id);

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger packages_set_updated_at
  before update on packages
  for each row execute procedure set_updated_at();

-- ---- Scan events (append-only audit trail) ----
create table scan_events (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references packages (id) on delete cascade,
  scanned_by uuid references profiles (id),
  status shipment_status not null,
  scan_method scan_method not null,
  lat double precision,
  lng double precision,
  device_note text,
  created_at timestamptz not null default now()
);

create index idx_scan_events_package on scan_events (package_id, created_at desc);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table profiles enable row level security;
alter table depots enable row level security;
alter table packages enable row level security;
alter table scan_events enable row level security;

-- Everyone signed in can read depots (needed for dropdowns, label printing).
create policy "depots_read_all" on depots for select using (auth.role() = 'authenticated');
create policy "depots_write_admin" on depots for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Profiles: users read their own row; admins read all.
create policy "profiles_read_own" on profiles for select using (
  id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "profiles_update_own" on profiles for update using (id = auth.uid());

-- Packages:
--  - admin/warehouse: full read/write
--  - courier: read/write only packages assigned to them
--  - client: read-only, only their own shipments (matched by sender/recipient — adjust to your auth model)
create policy "packages_read_staff" on packages for select using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'warehouse')
  )
);
create policy "packages_read_courier" on packages for select using (
  assigned_courier_id = auth.uid()
);
create policy "packages_write_staff" on packages for all using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'warehouse')
  )
);
create policy "packages_update_courier" on packages for update using (
  assigned_courier_id = auth.uid()
);

-- PLACEHOLDER — client role read access.
-- This matches on the recipient's phone number stored on the profile, which
-- is a weak link (phone numbers change, aren't verified here). Before
-- exposing the client role in production, replace this with a proper
-- `client_id` foreign key on packages set at creation time, or a verified
-- phone/email match. Left in place (rather than omitted) so the client role
-- isn't silently locked out of all data if it's enabled before that's done.
create policy "packages_read_client" on packages for select using (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'client'
      and profiles.phone is not null
      and profiles.phone = packages.recipient_phone
  )
);

-- Scan events: any authenticated staff/courier can insert; read follows the
-- same visibility as the parent package.
create policy "scan_events_insert" on scan_events for insert with check (
  exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'warehouse', 'courier')
  )
);
create policy "scan_events_read" on scan_events for select using (
  exists (
    select 1 from packages p
    where p.id = package_id
      and (
        exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
        or p.assigned_courier_id = auth.uid()
      )
  )
);

-- =============================================================================
-- Realtime — enable postgres_changes broadcast on the tables the UI subscribes to
-- =============================================================================
alter publication supabase_realtime add table packages;
alter publication supabase_realtime add table scan_events;

-- =============================================================================
-- Seed data (optional — comment out for production)
-- =============================================================================
insert into depots (name, code, address) values
  ('Banjul Depot', 'BJL', 'Banjul, The Gambia'),
  ('Serrekunda Depot', 'SRK', 'Serrekunda, The Gambia'),
  ('Glasgow Hub', 'GLA', 'Glasgow, Scotland');
