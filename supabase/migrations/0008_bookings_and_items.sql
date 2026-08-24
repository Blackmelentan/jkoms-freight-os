-- =============================================================================
-- Bookings (pre-shipment intake) + itemized package contents
-- =============================================================================

-- ---- Bookings ----
-- The stage before a package exists: a client (or staff on their behalf)
-- requests a shipment — service type, destination, rough date — which staff
-- review and confirm before it becomes an actual packages row with a
-- tracking code. Today the app skips straight to package creation with no
-- intake/approval step; this closes that gap.
create type booking_status as enum ('pending_review', 'confirmed', 'converted', 'declined');

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  booking_ref text not null unique,       -- e.g. BK-2608-0001
  client_id uuid references profiles (id) on delete set null,
  requester_name text not null,
  requester_phone text,
  requester_email text,
  service_type text not null,             -- e.g. "Ocean Freight", "Air Cargo", "RORO", "Door to Door"
  destination text not null,
  preferred_date date,
  notes text,
  status booking_status not null default 'pending_review',
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  converted_package_id uuid references packages (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_bookings_status on bookings (status);
create index idx_bookings_client on bookings (client_id);

alter table bookings enable row level security;

create policy "bookings_staff_all" on bookings for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "bookings_client_read_own" on bookings for select using (
  client_id = auth.uid()
);

create policy "bookings_client_insert_own" on bookings for insert with check (
  client_id = auth.uid()
);

alter publication supabase_realtime add table bookings;

-- ---- Itemized package contents ----
-- Currently declared_value is one lump number for the whole package. For
-- customs, a per-item breakdown (category, description, purchase price) is
-- usually required — this table adds that without removing the summary
-- field, which stays as a manually-set customs/insurance total.
create table package_items (
  id uuid primary key default uuid_generate_v4(),
  package_id uuid not null references packages (id) on delete cascade,
  category text not null,       -- e.g. "Electronics", "Clothing", "Furniture", "General Goods"
  description text not null,
  quantity int not null default 1,
  unit_price numeric(10, 2),
  created_at timestamptz not null default now()
);

create index idx_package_items_package on package_items (package_id);

alter table package_items enable row level security;

create policy "package_items_read" on package_items for select using (
  exists (
    select 1 from packages p
    where p.id = package_id
      and (
        exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
        or p.assigned_courier_id = auth.uid()
        or p.client_id = auth.uid()
      )
  )
);

create policy "package_items_write_staff" on package_items for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);
