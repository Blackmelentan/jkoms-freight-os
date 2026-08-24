import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Truck, Plus, Loader2, Car, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Vehicle, VehicleType, Profile, Depot } from '@/types';
import { VEHICLE_TYPE_LABEL } from '@/types';

export function Vehicles() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'fleet' | 'roro'>('fleet');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [{ data: v }, { data: d }, { data: dep }] = await Promise.all([
      supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'courier'),
      supabase.from('depots').select('*')
    ]);
    setVehicles((v as Vehicle[]) ?? []);
    setDrivers((d as Profile[]) ?? []);
    setDepots((dep as Depot[]) ?? []);
    setLoading(false);
  }

  if (myRole && myRole !== 'admin' && myRole !== 'warehouse') {
    return <Navigate to="/" replace />;
  }

  const fleet = vehicles.filter((v) => v.vehicle_type !== 'client_vehicle');
  const roro = vehicles.filter((v) => v.vehicle_type === 'client_vehicle');
  const driverMap: Record<string, Profile> = {};
  drivers.forEach((d) => (driverMap[d.id] = d));
  const depotMap: Record<string, Depot> = {};
  depots.forEach((d) => (depotMap[d.id] = d));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <Truck className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Fleet & Vehicles</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">Company delivery fleet and client vehicles shipped as RORO cargo.</p>

      <div className="mb-4 flex rounded-md border border-slate-200 bg-white p-1">
        <button
          onClick={() => setTab('fleet')}
          className={`flex-1 rounded py-2 text-sm font-medium ${tab === 'fleet' ? 'bg-jkoms-navy text-white' : 'text-slate-500'}`}
        >
          Company Fleet
        </button>
        <button
          onClick={() => setTab('roro')}
          className={`flex-1 rounded py-2 text-sm font-medium ${tab === 'roro' ? 'bg-jkoms-navy text-white' : 'text-slate-500'}`}
        >
          RORO Cargo (Client Vehicles)
        </button>
      </div>

      {!creating && (
        <button onClick={() => setCreating(true)} className="btn-primary mb-6 flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> Add {tab === 'fleet' ? 'Fleet Vehicle' : 'Client Vehicle'}
        </button>
      )}

      {creating && (
        <VehicleForm
          defaultType={tab === 'fleet' ? 'fleet_van' : 'client_vehicle'}
          drivers={drivers}
          depots={depots}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {!creating && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(tab === 'fleet' ? fleet : roro).map((v) => (
            <VehicleCard key={v.id} vehicle={v} driver={v.assigned_driver_id ? driverMap[v.assigned_driver_id] : undefined} depot={v.depot_id ? depotMap[v.depot_id] : undefined} />
          ))}
          {!loading && (tab === 'fleet' ? fleet : roro).length === 0 && (
            <p className="panel col-span-full p-8 text-center text-sm text-slate-400">
              No {tab === 'fleet' ? 'fleet vehicles' : 'RORO cargo'} yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function VehicleCard({ vehicle, driver, depot }: { vehicle: Vehicle; driver?: Profile; depot?: Depot }) {
  const isFleet = vehicle.vehicle_type !== 'client_vehicle';
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-jkoms-navy">
          <Car className="h-4 w-4" />
          {vehicle.make} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
        </span>
        <span className="rounded-full bg-jkoms-navy/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-jkoms-navy">
          {VEHICLE_TYPE_LABEL[vehicle.vehicle_type]}
        </span>
      </div>
      {vehicle.registration_plate && <p className="font-mono text-xs text-slate-500">{vehicle.registration_plate}</p>}
      {vehicle.color && <p className="text-xs text-slate-400">{vehicle.color}</p>}
      {vehicle.vin && <p className="text-xs text-slate-400">VIN: {vehicle.vin}</p>}
      {isFleet && driver && (
        <p className="mt-2 flex items-center gap-1 text-xs text-jkoms-steel">
          <User className="h-3 w-3" /> {driver.full_name}
        </p>
      )}
      {isFleet && depot && <p className="text-xs text-slate-400">{depot.name}</p>}
      <p className="mt-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 inline-block">
        {vehicle.status.replace('_', ' ')}
      </p>
    </div>
  );
}

function VehicleForm({
  defaultType,
  drivers,
  depots,
  onCancel,
  onCreated
}: {
  defaultType: VehicleType;
  drivers: Profile[];
  depots: Depot[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [vehicleType, setVehicleType] = useState<VehicleType>(defaultType);
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [vin, setVin] = useState('');
  const [driverId, setDriverId] = useState('');
  const [depotId, setDepotId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFleet = vehicleType !== 'client_vehicle';

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('vehicles').insert({
      vehicle_type: vehicleType,
      registration_plate: plate || null,
      make: make || null,
      model: model || null,
      year: year ? Number(year) : null,
      color: color || null,
      vin: vin || null,
      assigned_driver_id: isFleet && driverId ? driverId : null,
      depot_id: isFleet && depotId ? depotId : null,
      status: isFleet ? 'active' : 'awaiting_shipment'
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="panel mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Vehicle Type
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="fleet_van">Fleet Van</option>
          <option value="fleet_truck">Fleet Truck</option>
          <option value="client_vehicle">Client Vehicle (RORO)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Registration Plate
        <input value={plate} onChange={(e) => setPlate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Make
        <input value={make} onChange={(e) => setMake(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Model
        <input value={model} onChange={(e) => setModel(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Year
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Color
        <input value={color} onChange={(e) => setColor(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {!isFleet && (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
          VIN (for customs)
          <input value={vin} onChange={(e) => setVin(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
      )}
      {isFleet && (
        <>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Assigned Driver
            <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="">Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Depot
            <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="">—</option>
              {depots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
        </>
      )}
      {error && <p className="text-sm text-status-exception sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Vehicle
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
