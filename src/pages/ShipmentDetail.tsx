import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, MapPin, Printer, CheckCircle2, Loader2, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Package, ScanEvent, Depot, Locker } from '@/types';
import { SHIPMENT_STATUS_LABEL } from '@/types';
import { StatusPill } from '@/components/ui/StatusPill';
import { CourierAssign } from '@/components/shipments/CourierAssign';
import { ShipmentLegs } from '@/components/shipments/ShipmentLegs';
import { InvoiceDocument } from '@/components/manifests/InvoiceDocument';
import { useAuthStore } from '@/store/authStore';

export function ShipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const myRole = useAuthStore((s) => s.profile?.role);
  const [pkg, setPkg] = useState<Package | null>(null);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [depots, setDepots] = useState<Record<string, Depot>>({});
  const [lockers, setLockers] = useState<Record<string, Locker>>({});
  const invoiceRef = useRef<HTMLDivElement>(null);
  const handlePrintInvoice = useReactToPrint({ content: () => invoiceRef.current, documentTitle: pkg ? `invoice-${pkg.tracking_code}` : 'invoice' });

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
    const [{ data: pkgData }, { data: eventData }, { data: depotData }, { data: lockerData }] = await Promise.all([
      supabase.from('packages').select('*').eq('id', packageId).single(),
      supabase
        .from('scan_events')
        .select('*')
        .eq('package_id', packageId)
        .order('created_at', { ascending: false }),
      supabase.from('depots').select('*'),
      supabase.from('lockers').select('*')
    ]);
    setPkg(pkgData as Package);
    setEvents((eventData as ScanEvent[]) ?? []);
    const map: Record<string, Depot> = {};
    (depotData as Depot[] | null)?.forEach((d) => (map[d.id] = d));
    setDepots(map);
    const lockerMap: Record<string, Locker> = {};
    (lockerData as Locker[] | null)?.forEach((l) => (lockerMap[l.id] = l));
    setLockers(lockerMap);
  }

  if (!pkg) {
    return <div className="px-6 py-10 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-6 md:px-6">
      <Link to="/shipments" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-jkoms-navy">
        <ArrowLeft className="h-4 w-4" /> Back to shipments
      </Link>

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-mono text-2xl font-display text-jkoms-navy">{pkg.tracking_code}</h1>
          <div className="mt-1"><StatusPill status={pkg.status} /></div>
        </div>
        <div className="flex gap-2">
          {(myRole === 'admin' || myRole === 'warehouse') && (
            <button onClick={handlePrintInvoice} className="btn-secondary flex items-center gap-2 text-sm">
              <Receipt className="h-4 w-4" /> Invoice
            </button>
          )}
          <Link to="/labels" state={{ justCreatedId: pkg.id }} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer className="h-4 w-4" /> Reprint Label
          </Link>
        </div>
      </div>

      {myRole === 'client' && pkg.status === 'delivered' && !pkg.client_accepted && (
        <ClientConfirmBanner packageId={pkg.id} onConfirmed={() => setPkg({ ...pkg, client_accepted: true, client_accepted_at: new Date().toISOString() })} />
      )}
      {pkg.client_accepted && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-status-delivered/10 px-4 py-3 text-sm text-status-delivered">
          <CheckCircle2 className="h-4 w-4" />
          Receipt confirmed by recipient{pkg.client_accepted_at ? ` on ${new Date(pkg.client_accepted_at).toLocaleString()}` : ''}.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sender</p>
          <p className="font-medium text-slate-800">{pkg.sender_name}</p>
          <p className="text-sm text-slate-500">{pkg.sender_address}</p>
          {pkg.sender_phone && <p className="text-sm text-slate-500">{pkg.sender_phone}</p>}
          {pkg.sender_lat && pkg.sender_lng && (
            <a
              href={`https://maps.google.com/?q=${pkg.sender_lat},${pkg.sender_lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-jkoms-steel hover:underline"
            >
              <MapPin className="h-3 w-3" /> Pinned location
            </a>
          )}
        </div>
        <div className="panel p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Recipient</p>
          <p className="font-medium text-slate-800">{pkg.recipient_name}</p>
          <p className="text-sm text-slate-500">{pkg.recipient_address}</p>
          <p className="text-sm text-slate-500">{pkg.recipient_phone}</p>
          {pkg.recipient_lat && pkg.recipient_lng && (
            <a
              href={`https://maps.google.com/?q=${pkg.recipient_lat},${pkg.recipient_lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-jkoms-steel hover:underline"
            >
              <MapPin className="h-3 w-3" /> Pinned location
            </a>
          )}
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
          {pkg.shipping_fee != null && <p className="text-sm text-slate-700">Shipping fee: {pkg.shipping_fee}</p>}
          {pkg.locker_id && lockers[pkg.locker_id] && (
            <p className="text-sm text-slate-700">Received at: {lockers[pkg.locker_id].label}</p>
          )}
        </div>
        {(myRole === 'admin' || myRole === 'warehouse') && (
          <CourierAssign
            packageId={pkg.id}
            currentCourierId={pkg.assigned_courier_id}
            onAssigned={(courierId) => setPkg({ ...pkg, assigned_courier_id: courierId })}
          />
        )}
      </div>

      <div className="mt-4">
        <ShipmentLegs packageId={pkg.id} />
      </div>

      {events.some((e) => e.attachment_url || e.signature_data) && (
        <div className="panel mt-4 p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Proof of Delivery</p>
          {events
            .filter((e) => e.attachment_url || e.signature_data)
            .map((e) => (
              <div key={e.id} className="mb-4 flex flex-wrap gap-4 last:mb-0">
                {e.attachment_url && (
                  <img
                    src={e.attachment_url}
                    alt="Delivery proof"
                    className="h-32 w-32 rounded-md border border-slate-200 object-cover"
                  />
                )}
                {e.signature_data && (
                  <img
                    src={e.signature_data}
                    alt="Recipient signature"
                    className="h-32 w-48 rounded-md border border-slate-200 bg-white object-contain"
                  />
                )}
              </div>
            ))}
        </div>
      )}

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
      <div className="pointer-events-none absolute -left-[9999px] top-0">
        <InvoiceDocument ref={invoiceRef} pkg={pkg} />
      </div>
    </div>
  );
}

function ClientConfirmBanner({ packageId, onConfirmed }: { packageId: string; onConfirmed: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('confirm_package_delivery', { pkg_id: packageId });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onConfirmed();
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-md border border-jkoms-navy/20 bg-jkoms-navy/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-jkoms-navy">This package was marked delivered. Did you receive it?</p>
      <button onClick={() => void confirm()} disabled={saving} className="btn-primary flex items-center justify-center gap-2 text-sm">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirm I received this
      </button>
      {error && <p className="text-xs text-status-exception">{error}</p>}
    </div>
  );
}
