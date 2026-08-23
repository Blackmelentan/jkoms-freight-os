-- =============================================================================
-- JKOMS Freight OS — full logistics blueprint migration
-- Builds out: multi-leg freight journey tracking (warehouse -> freight
-- transit -> customs/port -> local delivery), client accounts with a
-- shareable client code, geo-coordinate addresses (for regions without
-- formal street numbering), and two-sided delivery confirmation
-- (courier scans delivered, client separately confirms receipt).
-- =============================================================================

-- ---- Freight journey legs ----
-- scan_events (already built) is the append-only audit trail of *scans*.
-- shipment_legs is different: it's the *planned/logged journey* — bigger
-- grained steps a package moves through, most of which involve no barcode
-- scan at all (e.g. "departed Banjul Port aboard vessel MV Example, ETA in
-- 11 days"). Staff log these directly; couriers/warehouse update them as
-- the package physically moves.
create type leg_type as enum (
  'pickup',
  'warehouse_intake',
  'freight_transit',
  'customs',
  'port_arrival',
  'out_for_delivery',
  'delivered'
);

create type transport_mode as enum ('road', 'air', 'sea');
create type customs_status as enum ('not_applicable', 'pending', 'cleared', 'hold');

create table shipment_legs (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references packages (id) on delete cascade,
  leg_order int not null default 0,
  leg_type leg_type not null,
  transport_mode transport_mode,
  carrier_name text,           -- e.g. "Turkish Airlines Cargo", "Maersk"
  vehicle_ref text,             -- flight number / vessel name / plate number
  origin_label text,            -- free text: "Edinburgh Warehouse", "Banjul Port"
  destination_label text,
  customs_status customs_status not null default 'not_applicable',
  departed_at timestamptz,
  eta timestamptz,
  arrived_at timestamptz,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shipment_legs_package on shipment_legs (package_id, leg_order);

create trigger shipment_legs_set_updated_at
  before update on shipment_legs
  for each row execute procedure set_updated_at();

-- ---- Client accounts: shareable client code ----
-- A courier or warehouse staffer needs something short and speakable to
-- link a package to the right client account — a UUID doesn't work for
-- that. client_code is a short human code like "JKC-4821", generated once
-- per client account and shown prominently in their dashboard.
alter table profiles add column if not exists client_code text unique;

create or replace function generate_client_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'JKC-' || lpad(floor(random() * 10000)::text, 4, '0');
    exit when not exists (select 1 from profiles where client_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function assign_client_code()
returns trigger as $$
begin
  if new.role = 'client' and new.client_code is null then
    new.client_code := generate_client_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_assign_client_code on profiles;
create trigger profiles_assign_client_code
  before insert or update on profiles
  for each row execute procedure assign_client_code();

-- Backfill any existing client accounts that don't have a code yet.
update profiles set client_code = generate_client_code()
where role = 'client' and client_code is null;

-- ---- Geo-coordinate addresses ----
-- For regions without formal street numbering, a text address alone often
-- isn't enough for a courier to physically find the door. These are
-- optional companions to the existing text address fields, captured via
-- the browser's geolocation API at the moment someone is standing at the
-- location (usually the client setting their own home address, or a
-- courier pinning it on first successful delivery).
alter table packages add column if not exists sender_lat double precision;
alter table packages add column if not exists sender_lng double precision;
alter table packages add column if not exists recipient_lat double precision;
alter table packages add column if not exists recipient_lng double precision;

-- Clients can also save a default home location on their profile, reused
-- automatically next time a package is addressed to them.
alter table profiles add column if not exists home_address text;
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lng double precision;

-- ---- Two-sided delivery confirmation ----
-- Today "delivered" is set purely by a courier scan. That's one-sided —
-- add a separate client-side confirmation so both parties agree the
-- package actually changed hands, useful for dispute resolution.
alter table packages add column if not exists client_accepted boolean not null default false;
alter table packages add column if not exists client_accepted_at timestamptz;

-- =============================================================================
-- RLS for the new table
-- =============================================================================
alter table shipment_legs enable row level security;

create policy "shipment_legs_read" on shipment_legs for select using (
  exists (
    select 1 from packages p
    where p.id = package_id
      and (
        exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
        or p.assigned_courier_id = auth.uid()
        or p.client_id = auth.uid()
        or exists (
          select 1 from profiles
          where id = auth.uid() and role = 'client'
            and profiles.phone is not null and profiles.phone = p.recipient_phone
        )
      )
  )
);

create policy "shipment_legs_write_staff" on shipment_legs for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "shipment_legs_write_courier" on shipment_legs for insert with check (
  exists (
    select 1 from packages p
    where p.id = package_id and p.assigned_courier_id = auth.uid()
  )
);

-- Client delivery confirmation goes through a narrow RPC function rather
-- than a broad UPDATE policy — a row-level policy can't restrict *which
-- columns* change, so a plain "clients can update their own package" policy
-- would let a client silently edit tracking_code, sender info, etc. This
-- function only ever touches client_accepted/client_accepted_at, and only
-- when the package is already marked delivered.
create or replace function confirm_package_delivery(pkg_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_authorized boolean;
begin
  select exists (
    select 1 from packages p
    where p.id = pkg_id
      and p.status = 'delivered'
      and (
        p.client_id = auth.uid()
        or exists (
          select 1 from profiles
          where id = auth.uid() and role = 'client'
            and profiles.phone is not null and profiles.phone = p.recipient_phone
        )
      )
  ) into is_authorized;

  if not is_authorized then
    raise exception 'Not authorized to confirm this delivery';
  end if;

  update packages set client_accepted = true, client_accepted_at = now() where id = pkg_id;
end;
$$;

grant execute on function confirm_package_delivery(uuid) to authenticated;

alter publication supabase_realtime add table shipment_legs;
