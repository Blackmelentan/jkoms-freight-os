import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Package, ShipmentStatus, Depot, Profile } from '@/types';
import { SHIPMENT_STATUS_LABEL } from '@/types';
import { StatusPill } from '@/components/ui/StatusPill';

const ALL_STATUSES = Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[];

export function Shipments() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [depots, setDepots] = useState<Record<string, Depot>>({});
  const [people, setPeople] = useState<Record<string, Profile>>({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    void loadLookups();

    const channel = supabase
      .channel('shipments-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [statusFilter]);

  async function loadLookups() {
    const [{ data: depotData }, { data: peopleData }] = await Promise.all([
      supabase.from('depots').select('*'),
      supabase.from('profiles').select('*')
    ]);
    const depotMap: Record<string, Depot> = {};
    (depotData as Depot[] | null)?.forEach((d) => (depotMap[d.id] = d));
    setDepots(depotMap);
    const peopleMap: Record<string, Profile> = {};
    (peopleData as Profile[] | null)?.forEach((p) => (peopleMap[p.id] = p));
    setPeople(peopleMap);
  }

  async function load() {
    setLoading(true);
    let q = supabase.from('packages').select('*').order('created_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data } = await q;
    setPackages((data as Package[]) ?? []);
    setLoading(false);
  }

  const filtered = packages.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.tracking_code.toLowerCase().includes(q) ||
      p.recipient_name.toLowerCase().includes(q) ||
      p.sender_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <h1 className="mb-6 text-xl font-display text-jkoms-navy">Shipments</h1>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex flex-1 items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracking code, sender, or recipient…"
            className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | 'all')}
          className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm"
        >
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Tracking Code</th>
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Weight</th>
                <th className="px-5 py-3 font-medium">Courier</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Fee</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg) => {
                const originCode = pkg.origin_depot_id ? depots[pkg.origin_depot_id]?.code : null;
                const destCode = pkg.destination_depot_id ? depots[pkg.destination_depot_id]?.code : null;
                const courier = pkg.assigned_courier_id ? people[pkg.assigned_courier_id] : null;
                const client = pkg.client_id ? people[pkg.client_id] : null;
                return (
                  <tr key={pkg.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/shipments/${pkg.id}`} className="font-mono text-jkoms-navy hover:underline">
                        {pkg.tracking_code}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{pkg.recipient_name}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {originCode ?? '—'} <span className="text-slate-300">→</span> {destCode ?? '—'}
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-500">{pkg.service_level.replace('_', ' ')}</td>
                    <td className="px-5 py-3 text-slate-500">{pkg.weight_kg ? `${pkg.weight_kg} kg` : '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{courier?.full_name ?? '—'}</td>
                    <td className="px-5 py-3 font-mono text-xs text-jkoms-steel">{client?.client_code ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{pkg.shipping_fee != null ? pkg.shipping_fee.toFixed(2) : '—'}</td>
                    <td className="px-5 py-3">
                      <StatusPill status={pkg.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-400">{new Date(pkg.updated_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400">
                    No shipments match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
