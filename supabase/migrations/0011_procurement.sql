-- =============================================================================
-- Procurement — suppliers, purchase orders, received-stock tracking
-- Internal operations only (packaging materials, thermal label rolls, fuel,
-- office supplies) — not visible to couriers or clients.
-- =============================================================================

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text not null default 'other',   -- e.g. "Packaging", "Fuel", "Office Supplies", "Equipment"
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create type po_status as enum ('draft', 'ordered', 'received', 'cancelled');

create table purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null unique,      -- e.g. PO-2608-0001
  supplier_id uuid references suppliers (id) on delete set null,
  status po_status not null default 'draft',
  order_date date,
  expected_date date,
  received_date date,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger purchase_orders_set_updated_at
  before update on purchase_orders
  for each row execute procedure set_updated_at();

create table purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders (id) on delete cascade,
  item_name text not null,
  quantity int not null default 1,
  unit_cost numeric(10, 2),
  created_at timestamptz not null default now()
);

create index idx_po_items_po on purchase_order_items (po_id);
create index idx_po_supplier on purchase_orders (supplier_id);
create index idx_po_status on purchase_orders (status);

alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;

create policy "suppliers_staff_all" on suppliers for all using (is_staff());
create policy "purchase_orders_staff_all" on purchase_orders for all using (is_staff());
create policy "po_items_staff_all" on purchase_order_items for all using (is_staff());
