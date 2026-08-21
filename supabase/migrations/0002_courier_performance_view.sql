-- Optional helper view for the Analytics page / future courier leaderboard.
-- Not currently queried by the frontend (Analytics.tsx aggregates client-side
-- from the last 30 days of packages), but ready to wire in once volumes grow
-- large enough that client-side aggregation stops being practical.

create or replace view courier_performance as
select
  p.assigned_courier_id as courier_id,
  prof.full_name as courier_name,
  count(*) filter (where p.status = 'delivered') as delivered_count,
  count(*) filter (where p.status = 'delivery_failed') as failed_count,
  avg(
    extract(epoch from (p.updated_at - p.created_at)) / 3600.0
  ) filter (where p.status = 'delivered') as avg_delivery_hours
from packages p
join profiles prof on prof.id = p.assigned_courier_id
where p.assigned_courier_id is not null
group by p.assigned_courier_id, prof.full_name;
