import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Package, ScanEvent, Depot } from '@/types';
import { SHIPMENT_STATUS_LABEL } from '@/types';
import { StatusPill } from '@/components/ui/StatusPill';

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const [pkg, setPkg] = useState<Package | null>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [depots, setDepots] = useState<Record<string, Depot>>({});

  useEffect(() => {
    if (!id) return;
    void load(id);

    const channel = supabase
      .channel(`shipment-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages', filter: `id=eq.${id}` }, () =>
        void load(id)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scan_events', filter: `package_id=eq.${id}` },
        () => void load(id)
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [id]);

  async function load(packageId: string) {
    const [{ data: pkgData }, { data: eventData }, { data: depotData }] = await Promise.all([
      supabase.from('packages').select('*').eq('id', packageId).single(),
      supabase
        .from('scan_events')
        .select('*')
        .eq('package_id', packageId)
        .order('created_at', { ascending: false }),
      supabase.from('depots').select('*')
    ]);
    setPkg(pkgData as Package);
    setEvents((eventData as ScanEvent[]) ?? []);
    const map: Record<string, Depot> = {};
    (depotData as Depot[] | null)?.forEach((d) => (map[d.id] = d));
    setDepots(map);
  }

  if (!pkg) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <Link to="/shipments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-jkoms-navy">
        <ArrowLeft className="h-4 w-4" /> Back to shipments
      </Link>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-mono text-2xl font-display text-jkoms-navy">{pkg.tracking_code}</h1>
          <div className="mt-1"><StatusPill status={pkg.status} /></div>
        </div>
        <Link to="/labels" state={{ justCreatedId: pkg.id }} className="btn-secondary flex items-center gap-2 text-sm">
          <Printer className="h-4 w-4" /> Reprint Label
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sender</p>
          <p className="font-medium text-slate-800">{pkg.sender_name}</p>
          <p className="text-sm text-slate-500">{pkg.sender_address}</p>
          {pkg.sender_phone && <p className="text-sm text-slate-500">{pkg.sender_phone}</p>}
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recipient</p>
          <p className="font-medium text-slate-800">{pkg.recipient_name}</p>
          <p className="text-sm text-slate-500">{pkg.recipient_address}</p>
          <p className="text-sm text-slate-500">{pkg.recipient_phone}</p>
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Route</p>
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <MapPin className="h-4 w-4 text-jkoms-steel" />
            {pkg.origin_depot_id ? depots[pkg.origin_depot_id]?.name : 'Unassigned'}
            <span className="text-slate-300">→</span>
            {pkg.destination_depot_id ? depots[pkg.destination_depot_id]?.name : 'Unassigned'}
          </p>
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Details</p>
          <p className="text-sm text-slate-700 capitalize">Service: {pkg.service_level.replace('_', ' ')}</p>
          {pkg.weight_kg && <p className="text-sm text-slate-700">Weight: {pkg.weight_kg} kg</p>}
          {pkg.declared_value && <p className="text-sm text-slate-700">Declared value: {pkg.declared_value}</p>}
        </div>
      </div>

      <div className="panel mt-4 p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Scan History</p>
        {events.length === 0 ? (
          <p className="text-sm text-slate-400">No scans recorded yet.</p>
        ) : (
          <ol className="relative ml-2 border-l-2 border-slate-100 pl-5">
            {events.map((e) => (
              <li key={e.id} className="mb-5 last:mb-0">
                <span className="absolute -ml-[26px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-jkoms-steel" />
                <p className="text-sm font-semibold text-jkoms-navy">{SHIPMENT_STATUS_LABEL[e.status]}</p>
                <p className="text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleString()} · via {e.scan_method.replace('_', ' ')}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
