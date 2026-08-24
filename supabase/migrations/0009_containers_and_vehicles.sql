-- =============================================================================
-- Containers (physical loading units) + Vehicles (company fleet & RORO cargo)
-- =============================================================================

-- ---- Containers ----
-- Distinct from manifests (export/customs paperwork for a batch). A
-- container is the physical loading unit itself: container number, seal
-- number, a closing/cutoff time, and which shipments are physically loaded
-- inside. One manifest can correspond to one container, but they're
-- tracked separately since a container has its own physical lifecycle
-- (loading -> closed -> in transit -> arrived -> cleared) independent of
-- when the paperwork was generated.
create type container_status as enum ('loading', 'closed', 'in_transit', 'arrived', 'customs', 'released');

create table containers (
  id uuid primary key default uuid_generate_v4(),
  container_number text not null unique,   -- e.g. MSKU-1234567
  seal_number text,
  transport_mode transport_mode not null default 'sea',
  carrier_name text,
  destination_port text,
  status container_status not null default 'loading',
  closing_at timestamptz,      -- cutoff for adding more packages
  departed_at timestamptz,
  arrived_at timestamptz,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger containers_set_updated_at
  before update on containers
  for each row execute procedure set_updated_at();

create table container_packages (
  container_id uuid not null references containers (id) on delete cascade,
  package_id uuid not null references packages (id) on delete cascade,
  primary key (container_id, package_id)
);

alter table containers enable row level security;
alter table container_packages enable row level security;

create policy "containers_staff_all" on containers for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "container_packages_staff_all" on container_packages for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "container_packages_read_via_package" on container_packages for select using (
  exists (
    select 1 from packages p
    where p.id = package_id
      and (p.assigned_courier_id = auth.uid() or p.client_id = auth.uid())
  )
);

alter publication supabase_realtime add table containers;

-- ---- Vehicles: company fleet + RORO client cargo ----
-- Two different lifecycles bundled under one table with a type discriminator:
--   fleet_van / fleet_truck — company delivery vehicles, assigned to a driver
--   client_vehicle          — a client's own car being shipped as RORO cargo,
--                              linked to the package record that tracks it
create type vehicle_type as enum ('fleet_van', 'fleet_truck', 'client_vehicle');
create type vehicle_status as enum ('active', 'maintenance', 'retired', 'awaiting_shipment', 'shipped', 'delivered');

create table vehicles (
  id uuid primary key default uuid_generate_v4(),
  vehicle_type vehicle_type not null,
  registration_plate text,
  make text,
  model text,
  year int,
  color text,
  vin text,                     -- vehicle identification number — relevant for RORO customs
  owner_client_id uuid references profiles (id) on delete set null,   -- for client_vehicle
  package_id uuid references packages (id) on delete set null,        -- for client_vehicle, links to its shipment
  assigned_driver_id uuid references profiles (id) on delete set null, -- for fleet vehicles
  depot_id uuid references depots (id) on delete set null,
  status vehicle_status not null default 'active',
  notes text,
  created_at timestamptz not null default now()
);

create index idx_vehicles_type on vehicles (vehicle_type);
create index idx_vehicles_owner on vehicles (owner_client_id);

alter table vehicles enable row level security;

create policy "vehicles_staff_all" on vehicles for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "vehicles_read_own_client" on vehicles for select using (
  owner_client_id = auth.uid()
);

create policy "vehicles_read_own_driver" on vehicles for select using (
  assigned_driver_id = auth.uid()
);
