import { useEffect, useState } from 'react';
import { Truck, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CourierOption } from '@/types';

interface CourierAssignProps {
  packageId: string;
  currentCourierId: string | null;
  onAssigned: (courierId: string | null) => void;
}

/**
 * CourierAssign
 * -------------
 * Lets admin/warehouse staff assign (or reassign) a courier to a package.
 * Reads from the `couriers_available` view (profiles filtered to role =
 * 'courier'), writes straight to packages.assigned_courier_id. RLS already
 * enforces that once assigned, the courier's own session can read/update
 * that package — this component just handles the staff side of setting it.
 */
export function CourierAssign({ packageId, currentCourierId, onAssigned }: CourierAssignProps) {
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    void supabase
      .from('couriers_available')
      .select('*')
      .then(({ data }) => setCouriers((data as CourierOption[]) ?? []));
  }, []);

  async function handleChange(courierId: string) {
    setSaving(true);
    const value = courierId || null;
    const { error } = await supabase
      .from('packages')
      .update({ assigned_courier_id: value })
      .eq('id', packageId);
    setSaving(false);
    if (!error) {
      onAssigned(value);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    }
  }

  return (
    <div className="panel p-5">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Truck className="h-3.5 w-3.5" /> Assigned Courier
      </p>
      <div className="flex items-center gap-2">
        <select
          value={currentCourierId ?? ''}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        >
          <option value="">Unassigned</option>
          {couriers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.phone || c.id.slice(0, 8)}
            </option>
          ))}
        </select>
        {justSaved && <Check className="h-4 w-4 shrink-0 text-status-delivered" />}
      </div>
      {couriers.length === 0 && (
        <p className="mt-2 text-xs text-slate-400">
          No courier accounts yet — create one in Supabase Auth and set their profile role to "courier".
        </p>
      )}
    </div>
  );
}
