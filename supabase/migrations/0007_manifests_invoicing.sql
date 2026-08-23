-- =============================================================================
-- Manifests and invoicing
-- A manifest is the export/customs document listing every package traveling
-- together on one freight leg (e.g. "everything going out on the Aug 28
-- Banjul air freight run"). An invoice is per-package, for the client.
-- =============================================================================

create table manifests (
  id uuid primary key default uuid_generate_v4(),
  manifest_code text not null unique,  -- e.g. MAN-2608-0001
  title text not null,                 -- e.g. "Air Freight — Aug 28 — EDB to BJL"
  transport_mode transport_mode,
  carrier_name text,
  vehicle_ref text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table manifest_packages (
  manifest_id uuid not null references manifests (id) on delete cascade,
  package_id uuid not null references packages (id) on delete cascade,
  primary key (manifest_id, package_id)
);

-- Invoicing: the amount actually charged for shipping, distinct from
-- declared_value (which is the customs/insurance value of the goods inside).
alter table packages add column if not exists shipping_fee numeric(10, 2);

alter table manifests enable row level security;
alter table manifest_packages enable row level security;

create policy "manifests_staff_all" on manifests for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

create policy "manifest_packages_staff_all" on manifest_packages for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse'))
);

-- Couriers/clients can see which manifest a package they can already see
-- belongs to (read-only, joined through packages' own visibility rules).
create policy "manifest_packages_read_via_package" on manifest_packages for select using (
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
