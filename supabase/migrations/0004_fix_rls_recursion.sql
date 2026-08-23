-- =============================================================================
-- Fix: infinite recursion in profiles RLS policies
-- Cause: profiles_admin_read_all / profiles_admin_update_all check "is this
-- user an admin?" via a query on `profiles` from inside a policy defined ON
-- `profiles` — Postgres has to re-apply that same policy to answer the
-- inner query, which re-triggers the same check, forever. Fix: move the
-- admin check into a SECURITY DEFINER function, which runs as the function
-- owner (bypassing RLS internally) rather than as the querying user.
-- =============================================================================

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function is_admin() to authenticated;

drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles for select using (
  id = auth.uid() or is_admin()
);

drop policy if exists "profiles_admin_read_all" on profiles;
create policy "profiles_admin_read_all" on profiles for select using (
  is_admin()
);

drop policy if exists "profiles_admin_update_all" on profiles;
create policy "profiles_admin_update_all" on profiles for update using (
  is_admin()
);
