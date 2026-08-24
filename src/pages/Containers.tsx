import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Container as ContainerIcon, Plus, Search, X, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Container, ContainerStatus, TransportMode, Package } from '@/types';
import { CONTAINER_STATUS_LABEL } from '@/types';

const STATUS_STYLE: Record<ContainerStatus, string> = {
  loading: 'bg-amber-100 text-amber-700',
  closed: 'bg-jkoms-steel/10 text-jkoms-steel',
  in_transit: 'bg-jkoms-steel/10 text-jkoms-steel',
  arrived: 'bg-status-delivered/10 text-status-delivered',
  customs: 'bg-status-exception/10 text-status-exception',
  released: 'bg-status-delivered/10 text-status-delivered'
};

const STATUS_FLOW: ContainerStatus[] = ['loading', 'closed', 'in_transit', 'arrived', 'customs', 'released'];

export function Containers() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const profile = useAuthStore((s) => s.profile);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Container | null>(null);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('containers-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data } = await supabase.from('containers').select('*').order('created_at', { ascending: false });
    setContainers((data as Container[]) ?? []);
    setLoading(false);
  }

  if (myRole && myRole !== 'admin' && myRole !== 'warehouse') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <ContainerIcon className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Containers</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">Physical loading units — separate from export manifests, which are the paperwork.</p>

      {!creating && !open && (
        <button onClick={() => setCreating(true)} className="btn-primary mb-6 flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Container
        </button>
      )}

      {creating && (
        <NewContainerForm
          creatorId={profile?.id}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {open && <ContainerDetail container={open} onBack={() => { setOpen(null); void load(); }} />}

      {!creating && !open && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {containers.map((c) => (
            <ContainerCard key={c.id} container={c} onOpen={() => setOpen(c)} />
          ))}
          {!loading && containers.length === 0 && (
            <p className="panel col-span-full p-8 text-center text-sm text-slate-400">No containers yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ContainerCard({ container, onOpen }: { container: Container; onOpen: () => void }) {
  const closingSoon = container.closing_at && new Date(container.closing_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  return (
    <button onClick={onOpen} className="panel p-4 text-left transition hover:border-jkoms-navy/30">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-jkoms-navy">{container.container_number}</span>
        <span className={`status-pill ${STATUS_STYLE[container.status]}`}>{CONTAINER_STATUS_LABEL[container.status]}</span>
      </div>
      <p className="text-xs capitalize text-slate-500">{container.transport_mode} · {container.carrier_name ?? 'No carrier set'}</p>
      {container.destination_port && <p className="text-xs text-slate-400">→ {container.destination_port}</p>}
      {container.closing_at && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${closingSoon ? 'font-semibold text-status-exception' : 'text-slate-400'}`}>
          <Clock className="h-3 w-3" />
          {closingSoon ? 'Closes soon: ' : 'Closes: '}
          {new Date(container.closing_at).toLocaleString()}
        </p>
      )}
    </button>
  );
}

function ContainerDetail({ container, onBack }: { container: Container; onBack: () => void }) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Package[]>([]);
  const [status, setStatus] = useState<ContainerStatus>(container.status);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPackages();
  }, []);

  async function loadPackages() {
    const { data: links } = await supabase.from('container_packages').select('package_id').eq('container_id', container.id);
    const ids = (links ?? []).map((l) => l.package_id);
    if (ids.length === 0) {
      setPackages([]);
      return;
    }
    const { data } = await supabase.from('packages').select('*').in('id', ids);
    setPackages((data as Package[]) ?? []);
  }

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
        .limit(6)
        .then(({ data }) => setResults((data as Package[]) ?? []));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function addPackage(pkg: Package) {
    await supabase.from('container_packages').insert({ container_id: container.id, package_id: pkg.id });
    setQuery('');
    setResults([]);
    void loadPackages();
  }

  async function removePackage(pkgId: string) {
    await supabase.from('container_packages').delete().eq('container_id', container.id).eq('package_id', pkgId);
    void loadPackages();
  }

  async function updateStatus(newStatus: ContainerStatus) {
    setSaving(true);
    const patch: Partial<Container> = { status: newStatus };
    if (newStatus === 'in_transit' && !container.departed_at) patch.departed_at = new Date().toISOString();
    if (newStatus === 'arrived' && !container.arrived_at) patch.arrived_at = new Date().toISOString();
    await supabase.from('containers').update(patch).eq('id', container.id);
    setStatus(newStatus);
    setSaving(false);
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 text-sm text-slate-500 hover:text-jkoms-navy">← Back to containers</button>

      <div className="panel mb-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-lg font-semibold text-jkoms-navy">{container.container_number}</h2>
          <span className={`status-pill ${STATUS_STYLE[status]}`}>{CONTAINER_STATUS_LABEL[status]}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FLOW.map((s) => (
            <button
              key={s}
              onClick={() => void updateStatus(s)}
              disabled={saving || s === status}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                s === status ? 'bg-jkoms-navy text-white' : 'border border-slate-200 text-slate-500 hover:border-jkoms-navy'
              }`}
            >
              {CONTAINER_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Packages in this container ({packages.length})</p>
        <label className="relative mb-3 flex items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracking code or recipient to add…"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
          />
        </label>
        {results.length > 0 && (
          <ul className="mb-3 divide-y divide-slate-100 rounded-md border border-slate-200">
            {results.map((p) => (
              <li key={p.id}>
                <button onClick={() => void addPackage(p)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50">
                  <span className="font-mono">{p.tracking_code}</span>
                  <span className="text-slate-500">{p.recipient_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {packages.length === 0 ? (
          <p className="text-sm text-slate-400">No packages loaded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {packages.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-mono text-jkoms-navy">{p.tracking_code}</span>{' '}
                  <span className="text-slate-500">{p.recipient_name}</span>
                </span>
                <button onClick={() => void removePackage(p.id)} className="text-slate-300 hover:text-status-exception">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewContainerForm({ creatorId, onCancel, onCreated }: { creatorId: string | undefined; onCancel: () => void; onCreated: () => void }) {
  const [containerNumber, setContainerNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('sea');
  const [carrierName, setCarrierName] = useState('');
  const [destinationPort, setDestinationPort] = useState('');
  const [closingAt, setClosingAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!containerNumber.trim()) {
      setError('Container number is required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('containers').insert({
      container_number: containerNumber,
      seal_number: sealNumber || null,
      transport_mode: transportMode,
      carrier_name: carrierName || null,
      destination_port: destinationPort || null,
      closing_at: closingAt ? new Date(closingAt).toISOString() : null,
      created_by: creatorId
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'That container number is already in use.' : insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="panel mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Container Number
        <input value={containerNumber} onChange={(e) => setContainerNumber(e.target.value)} placeholder="MSKU-1234567" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Seal Number
        <input value={sealNumber} onChange={(e) => setSealNumber(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Transport Mode
        <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          <option value="sea">Sea</option>
          <option value="road">Road (RORO)</option>
          <option value="air">Air</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Carrier
        <input value={carrierName} onChange={(e) => setCarrierName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Destination Port
        <input value={destinationPort} onChange={(e) => setDestinationPort(e.target.value)} placeholder="Banjul Port" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Closing / Cutoff Time
        <input type="datetime-local" value={closingAt} onChange={(e) => setClosingAt(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && <p className="text-sm text-status-exception sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Container
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
