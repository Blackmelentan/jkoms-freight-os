-- =============================================================================
-- Lockers / consolidation addresses
-- Supports the "ship to a UK address, we consolidate and freight it out"
-- model from the prototypes — a client shops online, ships to one of these
-- addresses (using their client_code as a reference so incoming parcels can
-- be matched to their account), and staff log intake against a package once
-- it physically arrives.
-- =============================================================================

create table lockers (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,          -- e.g. "LDN-01"
  label text not null,                -- e.g. "London Consolidation Locker"
  address text not null,              -- full postal address clients ship to
  country text not null default 'United Kingdom',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table packages add column if not exists locker_id uuid references lockers (id) on delete set null;
create index if not exists idx_packages_locker on packages (locker_id);

alter table lockers enable row level security;

-- Every authenticated user can see active lockers — clients need this to
-- know where to ship their online orders.
create policy "lockers_read_all" on lockers for select using (auth.role() = 'authenticated');

create policy "lockers_write_admin" on lockers for all using (
  is_admin()
);

-- Seed one starter locker so the feature isn't empty on first load — edit
-- or add more from the Lockers page.
insert into lockers (code, label, address, country) values
  ('LDN-01', 'London Consolidation Locker', 'Unit 4, JKOMS Global Ltd, 12 Freight Way, London, E1 6AN', 'United Kingdom')
on conflict (code) do nothing;
