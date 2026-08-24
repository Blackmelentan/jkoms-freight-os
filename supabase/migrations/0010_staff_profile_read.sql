-- =============================================================================
-- Fix: warehouse staff couldn't read other accounts' profile rows
-- Only the admin-check policy (profiles_admin_read_all) allowed reading
-- profiles beyond your own row. Warehouse accounts need this too — for the
-- courier-assignment dropdown, client name/code lookups on the Shipments
-- table, etc. — since operationally they need the same visibility as admin
-- into who's who, just not the ability to edit roles.
-- =============================================================================

create or replace function is_staff()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('admin', 'warehouse')
  );
$$;

grant execute on function is_staff() to authenticated;

create policy "profiles_staff_read_all" on profiles for select using (
  is_staff()
);
