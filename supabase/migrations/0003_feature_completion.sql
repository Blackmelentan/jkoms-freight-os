-- =============================================================================
-- JKOMS Freight OS — feature completion migration
-- Adds: proof-of-delivery attachments, client account linkage, courier
-- assignment helper view, and the storage bucket + policies for POD photos.
-- Run this in the SQL Editor after 0001_init.sql and 0002_courier_performance_view.sql.
-- =============================================================================

-- ---- Proof of delivery: attachment on scan events ----
alter table scan_events add column if not exists attachment_url text;
alter table scan_events add column if not exists signature_data text; -- base64 PNG of signature pad

-- ---- Client portal: explicit link instead of the placeholder phone match ----
-- A client profile can now be tied to specific packages directly, which is
-- more reliable than matching on phone number (numbers change, get reused).
alter table packages add column if not exists client_id uuid references profiles (id) on delete set null;
create index if not exists idx_packages_client on packages (client_id);

-- Replace the earlier placeholder policy with one that checks client_id first
-- and falls back to the phone match for packages created before this column existed.
drop policy if exists "packages_read_client" on packages;
create policy "packages_read_client" on packages for select using (
  exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'client'
      and (
        packages.client_id = auth.uid()
        or (profiles.phone is not null and profiles.phone = packages.recipient_phone)
      )
  )
);

-- ---- Courier assignment: convenience view for the admin assignment UI ----
create or replace view couriers_available as
select id, full_name, phone, depot_id
from profiles
where role = 'courier'
order by full_name;

-- ---- Storage bucket for proof-of-delivery photos ----
insert into storage.buckets (id, name, public)
values ('proof-of-delivery', 'proof-of-delivery', true)
on conflict (id) do update set public = true;

-- Staff (admin/warehouse) and couriers can upload. Bucket is public for read
-- (delivery photos aren't highly sensitive and this avoids signed-URL
-- plumbing) — public buckets serve objects directly via their public URL,
-- so no separate read policy is needed for that path.
create policy "pod_upload_staff_courier"
  on storage.objects for insert
  with check (
    bucket_id = 'proof-of-delivery'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'warehouse', 'courier')
    )
  );

-- ---- Admin account management ----
-- Admins can view and edit ANY profile (role, name, phone, depot), not just
-- their own. Needed for the in-app admin user-management panel — without
-- this, admins could only ever change their own row.
create policy "profiles_admin_read_all" on profiles for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "profiles_admin_update_all" on profiles for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
