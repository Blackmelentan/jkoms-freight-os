import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, PackageSearch } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { PackageItem } from '@/types';

const CATEGORIES = ['Electronics', 'Clothing', 'Furniture', 'Food & Groceries', 'Documents', 'General Goods'];

interface PackageItemsProps {
  packageId: string;
}

/**
 * PackageItems
 * ------------
 * Itemized customs contents — category, description, quantity, and
 * per-item price. Complements (doesn't replace) the single declared_value
 * field on the package, which staff still set manually as the overall
 * customs/insurance figure. This gives the line-item breakdown customs
 * paperwork usually wants, and shows a running total for reference.
 */
export function PackageItems({ packageId }: PackageItemsProps) {
  const profile = useAuthStore((s) => s.profile);
  const canWrite = profile?.role === 'admin' || profile?.role === 'warehouse';
  const [items, setItems] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void load();
  }, [packageId]);

  async function load() {
    const { data } = await supabase.from('package_items').select('*').eq('package_id', packageId).order('created_at');
    setItems((data as PackageItem[]) ?? []);
    setLoading(false);
  }

  async function removeItem(id: string) {
    await supabase.from('package_items').delete().eq('id', id);
    void load();
  }

  const total = items.reduce((sum, i) => sum + i.quantity * (i.unit_price ?? 0), 0);

  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <PackageSearch className="h-3.5 w-3.5" /> Contents (Customs Declaration)
        </p>
        {canWrite && (
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-jkoms-steel hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        )}
      </div>

      {showForm && (
        <ItemForm
          packageId={packageId}
          onDone={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">No itemized contents recorded.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 font-medium">Category</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 text-right font-medium">Unit Price</th>
                {canWrite && <th className="w-6 py-1.5"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5">{item.description}</td>
                  <td className="py-1.5 text-slate-500">{item.category}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">{item.unit_price?.toFixed(2) ?? '—'}</td>
                  {canWrite && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => void removeItem(item.id)} className="text-slate-300 hover:text-status-exception">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-right text-xs font-semibold text-jkoms-navy">Itemized total: {total.toFixed(2)}</p>
        </>
      )}
    </div>
  );
}

function ItemForm({ packageId, onDone }: { packageId: string; onDone: () => void }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!description.trim()) return;
    setSaving(true);
    await supabase.from('package_items').insert({
      package_id: packageId,
      category,
      description,
      quantity: Number(quantity) || 1,
      unit_price: unitPrice ? Number(unitPrice) : null
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 sm:grid-cols-4">
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-1">
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-1" />
      <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
      <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Unit price" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
      <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center justify-center gap-1.5 py-1.5 text-xs sm:col-span-4">
        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
        Add
      </button>
    </div>
  );
}
