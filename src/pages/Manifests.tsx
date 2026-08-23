import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FileText, Plus, Search, Printer, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { generateTrackingCode } from '@/utils/trackingCode';
import type { Manifest, Package, TransportMode } from '@/types';
import { ManifestDocument } from '@/components/manifests/ManifestDocument';

export function Manifests() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const profile = useAuthStore((s) => s.profile);
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Preview/print state — set when viewing an existing manifest
  const [previewing, setPreviewing] = useState<{ manifest: Manifest; packages: Package[] } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: previewing ? previewing.manifest.manifest_code : 'manifest'
  });

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await supabase.from('manifests').select('*').order('created_at', { ascending: false });
    setManifests((data as Manifest[]) ?? []);
    setLoading(false);
  }

  async function openManifest(m: Manifest) {
    const { data: links } = await supabase.from('manifest_packages').select('package_id').eq('manifest_id', m.id);
    const packageIds = (links ?? []).map((l) => l.package_id);
    if (packageIds.length === 0) {
      setPreviewing({ manifest: m, packages: [] });
      return;
    }
    const { data: pkgs } = await supabase.from('packages').select('*').in('id', packageIds);
    setPreviewing({ manifest: m, packages: (pkgs as Package[]) ?? [] });
  }

  if (myRole && myRole !== 'admin' && myRole !== 'warehouse') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <FileText className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Manifests</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">Export/customs documentation for a batch of packages traveling together.</p>

      {!creating && !previewing && (
        <button onClick={() => setCreating(true)} className="btn-primary mb-6 flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Manifest
        </button>
      )}

      {creating && (
        <NewManifestForm
          creatorId={profile?.id}
          onCancel={() => setCreating(false)}
          onCreated={(m) => {
            setCreating(false);
            void load();
            void openManifest(m);
          }}
        />
      )}

      {previewing && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setPreviewing(null)} className="text-sm text-slate-500 hover:text-jkoms-navy">
              ← Back to list
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-400">
            In the print dialog, select paper size <strong>A4</strong> (not the 4×6 thermal size) — this is a full-page document.
          </p>
          <div className="overflow-x-auto rounded-md border border-slate-200 shadow-panel">
            <div className="scale-[0.5] origin-top-left sm:scale-75 lg:scale-100">
              <ManifestDocument ref={printRef} manifest={previewing.manifest} packages={previewing.packages} />
            </div>
          </div>
        </div>
      )}

      {!creating && !previewing && (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {manifests.map((m) => (
                  <tr key={m.id} className="cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50" onClick={() => void openManifest(m)}>
                    <td className="px-5 py-3 font-mono text-jkoms-navy">{m.manifest_code}</td>
                    <td className="px-5 py-3">{m.title}</td>
                    <td className="px-5 py-3 capitalize text-slate-500">{m.transport_mode ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-400">{new Date(m.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {!loading && manifests.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      No manifests generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NewManifestForm({
  creatorId,
  onCancel,
  onCreated
}: {
  creatorId: string | undefined;
  onCancel: () => void;
  onCreated: (m: Manifest) => void;
}) {
  const [title, setTitle] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const [carrierName, setCarrierName] = useState('');
  const [vehicleRef, setVehicleRef] = useState('');
  const [notes, setNotes] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Package[]>([]);
  const [selected, setSelected] = useState<Package[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      void supabase
        .from('packages')
        .select('*')
        .or(`tracking_code.ilike.%${query}%,recipient_name.ilike.%${query}%`)
        .limit(8)
        .then(({ data }) => setResults((data as Package[]) ?? []));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  function toggleSelect(pkg: Package) {
    setSelected((prev) => (prev.some((p) => p.id === pkg.id) ? prev.filter((p) => p.id !== pkg.id) : [...prev, pkg]));
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError('Give this manifest a title.');
      return;
    }
    if (selected.length === 0) {
      setError('Add at least one package.');
      return;
    }
    setSaving(true);
    setError(null);

    const manifestCode = generateTrackingCode('MAN');
    const { data: manifest, error: insertError } = await supabase
      .from('manifests')
      .insert({
        manifest_code: manifestCode,
        title,
        transport_mode: transportMode || null,
        carrier_name: carrierName || null,
        vehicle_ref: vehicleRef || null,
        notes: notes || null,
        created_by: creatorId
      })
      .select()
      .single();

    if (insertError || !manifest) {
      setSaving(false);
      setError(insertError?.message ?? 'Could not create manifest.');
      return;
    }

    await supabase.from('manifest_packages').insert(selected.map((p) => ({ manifest_id: manifest.id, package_id: p.id })));

    setSaving(false);
    onCreated(manifest as Manifest);
  }

  return (
    <div className="panel mb-6 p-5">
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Air Freight — Aug 28 — EDB to BJL" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Transport Mode
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode | '')} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
            <option value="">—</option>
            <option value="road">Road</option>
            <option value="air">Air</option>
            <option value="sea">Sea</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Carrier
          <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Flight / Vessel Ref
          <input value={vehicleRef} onChange={(e) => setVehicleRef(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Add Packages</p>
      <label className="relative mb-2 flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tracking code or recipient…"
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        />
      </label>
      {results.length > 0 && (
        <ul className="mb-3 divide-y divide-slate-100 rounded-md border border-slate-200">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggleSelect(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-mono">{p.tracking_code}</span>
                <span className="text-slate-500">{p.recipient_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {selected.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-jkoms-navy/5 px-2.5 py-1 text-xs font-mono text-jkoms-navy">
              {p.tracking_code}
              <button onClick={() => toggleSelect(p)} className="text-slate-400 hover:text-status-exception">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-status-exception">{error}</p>}

      <div className="flex gap-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Manifest
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
