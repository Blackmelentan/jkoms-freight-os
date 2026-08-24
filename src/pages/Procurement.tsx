import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShoppingCart, Plus, Loader2, Building2, X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { generateTrackingCode } from '@/utils/trackingCode';
import type { Supplier, PurchaseOrder, PurchaseOrderItem, POStatus } from '@/types';
import { PO_STATUS_LABEL } from '@/types';

const CATEGORIES = ['Packaging', 'Fuel', 'Office Supplies', 'Equipment', 'Other'];
const STATUS_STYLE: Record<POStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  ordered: 'bg-jkoms-steel/10 text-jkoms-steel',
  received: 'bg-status-delivered/10 text-status-delivered',
  cancelled: 'bg-status-exception/10 text-status-exception'
};
const STATUS_FLOW: POStatus[] = ['draft', 'ordered', 'received', 'cancelled'];

export function Procurement() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const profile = useAuthStore((s) => s.profile);
  const [tab, setTab] = useState<'orders' | 'suppliers'>('orders');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [openOrder, setOpenOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [{ data: s }, { data: o }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
    ]);
    setSuppliers((s as Supplier[]) ?? []);
    setOrders((o as PurchaseOrder[]) ?? []);
    setLoading(false);
  }

  if (myRole && myRole !== 'admin' && myRole !== 'warehouse') {
    return <Navigate to="/" replace />;
  }

  const supplierMap: Record<string, Supplier> = {};
  suppliers.forEach((s) => (supplierMap[s.id] = s));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <ShoppingCart className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Procurement</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">Suppliers and purchase orders for packaging, fuel, and operational supplies.</p>

      <div className="mb-4 flex rounded-md border border-slate-200 bg-white p-1">
        <button onClick={() => { setTab('orders'); setOpenOrder(null); }} className={`flex-1 rounded py-2 text-sm font-medium ${tab === 'orders' ? 'bg-jkoms-navy text-white' : 'text-slate-500'}`}>
          Purchase Orders
        </button>
        <button onClick={() => { setTab('suppliers'); setOpenOrder(null); }} className={`flex-1 rounded py-2 text-sm font-medium ${tab === 'suppliers' ? 'bg-jkoms-navy text-white' : 'text-slate-500'}`}>
          Suppliers
        </button>
      </div>

      {tab === 'suppliers' && (
        <div>
          {!creatingSupplier && (
            <button onClick={() => setCreatingSupplier(true)} className="btn-primary mb-4 flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> Add Supplier
            </button>
          )}
          {creatingSupplier && (
            <SupplierForm onCancel={() => setCreatingSupplier(false)} onCreated={() => { setCreatingSupplier(false); void load(); }} />
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {suppliers.map((s) => (
              <div key={s.id} className="panel p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-jkoms-navy">
                    <Building2 className="h-4 w-4" /> {s.name}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{s.category}</span>
                </div>
                {s.contact_name && <p className="text-xs text-slate-500">{s.contact_name}</p>}
                {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
              </div>
            ))}
            {!loading && suppliers.length === 0 && <p className="panel col-span-full p-8 text-center text-sm text-slate-400">No suppliers yet.</p>}
          </div>
        </div>
      )}

      {tab === 'orders' && !openOrder && (
        <div>
          {!creatingOrder && (
            <button onClick={() => setCreatingOrder(true)} className="btn-primary mb-4 flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4" /> New Purchase Order
            </button>
          )}
          {creatingOrder && (
            <OrderForm
              suppliers={suppliers}
              creatorId={profile?.id}
              onCancel={() => setCreatingOrder(false)}
              onCreated={(po) => { setCreatingOrder(false); void load(); setOpenOrder(po); }}
            />
          )}
          {!creatingOrder && (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3 font-medium">PO Number</th>
                      <th className="px-5 py-3 font-medium">Supplier</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Order Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50" onClick={() => setOpenOrder(o)}>
                        <td className="px-5 py-3 font-mono text-jkoms-navy">{o.po_number}</td>
                        <td className="px-5 py-3 text-slate-600">{o.supplier_id ? supplierMap[o.supplier_id]?.name ?? '—' : '—'}</td>
                        <td className="px-5 py-3"><span className={`status-pill ${STATUS_STYLE[o.status]}`}>{PO_STATUS_LABEL[o.status]}</span></td>
                        <td className="px-5 py-3 text-slate-400">{o.order_date ?? '—'}</td>
                      </tr>
                    ))}
                    {!loading && orders.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">No purchase orders yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && openOrder && (
        <OrderDetail order={openOrder} supplier={openOrder.supplier_id ? supplierMap[openOrder.supplier_id] : undefined} onBack={() => { setOpenOrder(null); void load(); }} />
      )}
    </div>
  );
}

function SupplierForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from('suppliers').insert({
      name, category, contact_name: contactName || null, phone: phone || null, email: email || null
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="panel mb-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Contact Name
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && <p className="text-sm text-status-exception sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Supplier
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}

function OrderForm({
  suppliers,
  creatorId,
  onCancel,
  onCreated
}: {
  suppliers: Supplier[];
  creatorId: string | undefined;
  onCancel: () => void;
  onCreated: (po: PurchaseOrder) => void;
}) {
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: generateTrackingCode('PO'),
        supplier_id: supplierId || null,
        order_date: orderDate || null,
        expected_date: expectedDate || null,
        notes: notes || null,
        created_by: creatorId
      })
      .select()
      .single();
    setSaving(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create purchase order.');
      return;
    }
    onCreated(data as PurchaseOrder);
  }

  return (
    <div className="panel mb-4 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Supplier
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="">—</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Order Date
        <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Expected Date
        <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && <p className="text-sm text-status-exception sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create Order
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}

function OrderDetail({ order, supplier, onBack }: { order: PurchaseOrder; supplier?: Supplier; onBack: () => void }) {
  const [items, setItems] = useState<PurchaseOrderItem[]>([]);
  const [status, setStatus] = useState<POStatus>(order.status);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase.from('purchase_order_items').select('*').eq('po_id', order.id).order('created_at');
    setItems((data as PurchaseOrderItem[]) ?? []);
  }

  async function addItem() {
    if (!itemName.trim()) return;
    setSaving(true);
    await supabase.from('purchase_order_items').insert({
      po_id: order.id,
      item_name: itemName,
      quantity: Number(quantity) || 1,
      unit_cost: unitCost ? Number(unitCost) : null
    });
    setItemName('');
    setQuantity('1');
    setUnitCost('');
    setSaving(false);
    void load();
  }

  async function removeItem(id: string) {
    await supabase.from('purchase_order_items').delete().eq('id', id);
    void load();
  }

  async function updateStatus(newStatus: POStatus) {
    const patch: Partial<PurchaseOrder> = { status: newStatus };
    if (newStatus === 'received') patch.received_date = new Date().toISOString().slice(0, 10);
    await supabase.from('purchase_orders').update(patch).eq('id', order.id);
    setStatus(newStatus);
  }

  const total = items.reduce((sum, i) => sum + i.quantity * (i.unit_cost ?? 0), 0);

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-jkoms-navy">← Back to purchase orders</button>

      <div className="panel mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-lg font-semibold text-jkoms-navy">{order.po_number}</h2>
            {supplier && <p className="text-sm text-slate-500">{supplier.name}</p>}
          </div>
          <span className={`status-pill ${STATUS_STYLE[status]}`}>{PO_STATUS_LABEL[status]}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              onClick={() => void updateStatus(s)}
              disabled={s === status}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${s === status ? 'bg-jkoms-navy text-white' : 'border border-slate-200 text-slate-500 hover:border-jkoms-navy'}`}
            >
              {PO_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Line Items</p>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Item name" className="rounded border border-slate-300 px-2 py-1.5 text-xs sm:col-span-2" />
          <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Qty" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
          <input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="Unit cost" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
        </div>
        <button onClick={() => void addItem()} disabled={saving} className="btn-secondary mb-4 flex items-center gap-1.5 text-xs">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add Item
        </button>

        {items.length === 0 ? (
          <p className="text-sm text-slate-400">No items added yet.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="py-1.5 text-right font-medium">Qty</th>
                  <th className="py-1.5 text-right font-medium">Unit Cost</th>
                  <th className="w-6 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5">{i.item_name}</td>
                    <td className="py-1.5 text-right">{i.quantity}</td>
                    <td className="py-1.5 text-right">{i.unit_cost?.toFixed(2) ?? '—'}</td>
                    <td className="py-1.5 text-right">
                      <button onClick={() => void removeItem(i.id)} className="text-slate-300 hover:text-status-exception">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 flex items-center justify-end gap-1 text-right text-xs font-semibold text-jkoms-navy">
              {status === 'received' && <Check className="h-3 w-3 text-status-delivered" />} Total: {total.toFixed(2)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
