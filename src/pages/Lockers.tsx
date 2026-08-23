import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Package as PackageIcon, Plus, Loader2, MapPinned, Copy, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Locker } from '@/types';

/**
 * Lockers
 * -------
 * Manages the consolidation addresses clients ship their online orders to
 * (the "UK locker" model from the prototypes). Admin/warehouse only — the
 * client-facing view of this same data lives on the Dashboard, scoped to
 * active lockers only, with instructions rather than management controls.
 */
export function Lockers() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase.from('lockers').select('*').order('created_at', { ascending: false });
    setLockers((data as Locker[]) ?? []);
    setLoading(false);
  }

  if (myRole && myRole !== 'admin' && myRole !== 'warehouse') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <MapPinned className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Lockers</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Consolidation addresses clients ship their online orders to before the freight leg out.
      </p>

      <button onClick={() => setShowForm((v) => !v)} className="btn-secondary mb-4 flex items-center gap-2 text-sm">
        <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Add Locker'}
      </button>

      {showForm && (
        <LockerForm
          onDone={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : lockers.length === 0 ? (
        <p className="panel p-8 text-center text-sm text-slate-400">No lockers set up yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lockers.map((l) => (
            <LockerCard key={l.id} locker={l} onToggled={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function LockerCard({ locker, onToggled }: { locker: Locker; onToggled: () => void }) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function toggleActive() {
    setToggling(true);
    await supabase.from('lockers').update({ active: !locker.active }).eq('id', locker.id);
    setToggling(false);
    onToggled();
  }

  return (
    <div className={`panel p-4 ${!locker.active ? 'opacity-50' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-jkoms-steel">{locker.code}</span>
        <button
          onClick={() => void toggleActive()}
          disabled={toggling}
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            locker.active ? 'bg-status-delivered/10 text-status-delivered' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {locker.active ? 'Active' : 'Inactive'}
        </button>
      </div>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-jkoms-navy">
        <PackageIcon className="h-3.5 w-3.5" /> {locker.label}
      </p>
      <p className="text-xs text-slate-500">{locker.address}</p>
      <p className="text-xs text-slate-400">{locker.country}</p>
      <button
        onClick={() => {
          navigator.clipboard.writeText(locker.address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="mt-2 flex items-center gap-1 text-xs text-slate-400 hover:text-jkoms-navy"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy address
      </button>
    </div>
  );
}

function LockerForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('United Kingdom');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code || !label || !address) {
      setError('Code, label, and address are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('lockers').insert({ code, label, address, country });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'That locker code is already in use.' : insertError.message);
      return;
    }
    onDone();
  }

  return (
    <div className="panel mb-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Code
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LDN-02" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Label
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Glasgow Consolidation Locker" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Full Address
        <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Country
        <input value={country} onChange={(e) => setCountry(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && <p className="text-xs text-status-exception sm:col-span-2">{error}</p>}
      <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center justify-center gap-2 text-sm sm:col-span-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Locker
      </button>
    </div>
  );
}
