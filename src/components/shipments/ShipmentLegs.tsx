import { useEffect, useState } from 'react';
import { Plane, Ship, Truck, Plus, Loader2, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { ShipmentLeg, LegType, TransportMode, CustomsStatus } from '@/types';
import { LEG_TYPE_LABEL } from '@/types';

const TRANSPORT_ICON: Record<TransportMode, typeof Plane> = { air: Plane, sea: Ship, road: Truck };

interface ShipmentLegsProps {
  packageId: string;
}

/**
 * ShipmentLegs
 * ------------
 * The freight journey itself — bigger-grained than scan_events (which logs
 * individual barcode scans). This is where "departed Edinburgh via road to
 * Glasgow Hub, then air freight BA-XXXX to Banjul, held at customs 2 days,
 * cleared, out for local delivery" actually gets recorded. Staff log each
 * leg as it happens; couriers can add pickup/delivery legs from the field.
 */
export function ShipmentLegs({ packageId }: ShipmentLegsProps) {
  const profile = useAuthStore((s) => s.profile);
  const canWrite = profile?.role === 'admin' || profile?.role === 'warehouse';
  const [legs, setLegs] = useState<ShipmentLeg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`legs-${packageId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shipment_legs', filter: `package_id=eq.${packageId}` },
        () => void load()
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [packageId]);

  async function load() {
    const { data } = await supabase
      .from('shipment_legs')
      .select('*')
      .eq('package_id', packageId)
      .order('leg_order', { ascending: true });
    setLegs((data as ShipmentLeg[]) ?? []);
    setLoading(false);
  }

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Freight Journey</p>
        {canWrite && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-jkoms-steel hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add Leg
          </button>
        )}
      </div>

      {showForm && (
        <LegForm
          packageId={packageId}
          nextOrder={legs.length}
          onDone={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : legs.length === 0 ? (
        <p className="text-sm text-slate-400">No journey legs logged yet.</p>
      ) : (
        <ol className="relative ml-2 border-l-2 border-slate-100 pl-5">
          {legs.map((leg) => {
            const Icon = leg.transport_mode ? TRANSPORT_ICON[leg.transport_mode] : Truck;
            return (
              <li key={leg.id} className="mb-5 last:mb-0">
                <span className="absolute -ml-[30px] mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-jkoms-navy text-white">
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-jkoms-navy">{LEG_TYPE_LABEL[leg.leg_type]}</p>
                  {leg.customs_status !== 'not_applicable' && <CustomsPill status={leg.customs_status} />}
                </div>
                {(leg.origin_label || leg.destination_label) && (
                  <p className="text-sm text-slate-600">
                    {leg.origin_label ?? '—'} <span className="text-slate-300">→</span> {leg.destination_label ?? '—'}
                  </p>
                )}
                {(leg.carrier_name || leg.vehicle_ref) && (
                  <p className="text-xs text-slate-500">
                    {leg.carrier_name}
                    {leg.carrier_name && leg.vehicle_ref && ' · '}
                    {leg.vehicle_ref}
                  </p>
                )}
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  {leg.arrived_at
                    ? `Arrived ${new Date(leg.arrived_at).toLocaleString()}`
                    : leg.eta
                    ? `ETA ${new Date(leg.eta).toLocaleDateString()}`
                    : leg.departed_at
                    ? `Departed ${new Date(leg.departed_at).toLocaleString()}`
                    : new Date(leg.created_at).toLocaleDateString()}
                </p>
                {leg.notes && <p className="mt-1 text-xs text-slate-500">{leg.notes}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function CustomsPill({ status }: { status: CustomsStatus }) {
  const style =
    status === 'cleared'
      ? 'bg-status-delivered/10 text-status-delivered'
      : status === 'hold'
      ? 'bg-status-exception/10 text-status-exception'
      : 'bg-amber-100 text-amber-700';
  const Icon = status === 'cleared' ? ShieldCheck : ShieldAlert;
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${style}`}>
      <Icon className="h-3 w-3" /> Customs {status.replace('_', ' ')}
    </span>
  );
}

const LEG_TYPES: LegType[] = [
  'pickup',
  'warehouse_intake',
  'freight_transit',
  'customs',
  'port_arrival',
  'out_for_delivery',
  'delivered'
];

function LegForm({ packageId, nextOrder, onDone }: { packageId: string; nextOrder: number; onDone: () => void }) {
  const profile = useAuthStore((s) => s.profile);
  const [legType, setLegType] = useState<LegType>('freight_transit');
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [carrierName, setCarrierName] = useState('');
  const [vehicleRef, setVehicleRef] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [customsStatus, setCustomsStatus] = useState<CustomsStatus>('not_applicable');
  const [eta, setEta] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setSaving(true);
    await supabase.from('shipment_legs').insert({
      package_id: packageId,
      leg_order: nextOrder,
      leg_type: legType,
      transport_mode: transportMode || null,
      carrier_name: carrierName || null,
      vehicle_ref: vehicleRef || null,
      origin_label: origin || null,
      destination_label: destination || null,
      customs_status: customsStatus,
      eta: eta ? new Date(eta).toISOString() : null,
      notes: notes || null,
      created_by: profile?.id
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Leg Type
        <select
          value={legType}
          onChange={(e) => setLegType(e.target.value as LegType)}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {LEG_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEG_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Transport Mode
        <select
          value={transportMode}
          onChange={(e) => setTransportMode(e.target.value as TransportMode | '')}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">—</option>
          <option value="road">Road</option>
          <option value="air">Air</option>
          <option value="sea">Sea</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Origin
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Edinburgh Warehouse" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Destination
        <input value={destination} onChange={(e) => setDestination(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Banjul Port" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Carrier
        <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Turkish Airlines Cargo" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Flight / Vessel / Vehicle Ref
        <input value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="TK-1873" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Customs Status
        <select
          value={customsStatus}
          onChange={(e) => setCustomsStatus(e.target.value as CustomsStatus)}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="not_applicable">Not applicable</option>
          <option value="pending">Pending</option>
          <option value="cleared">Cleared</option>
          <option value="hold">Hold</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        ETA
        <input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" placeholder="Held for export declaration paperwork" />
      </label>
      <button
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="btn-primary flex items-center justify-center gap-2 text-sm sm:col-span-2"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Log Leg
      </button>
    </div>
  );
}
