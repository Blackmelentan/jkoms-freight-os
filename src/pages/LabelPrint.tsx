import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Package, Depot } from '@/types';
import { ShippingLabel } from '@/components/labels/ShippingLabel';

export function LabelPrint() {
  const location = useLocation();
  const justCreatedId = (location.state as { justCreatedId?: string } | null)?.justCreatedId;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Package[]>([]);
  const [selected, setSelected] = useState<Package | null>(null);
  const [depots, setDepots] = useState<Record<string, Depot>>({});
  const labelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void supabase.from('depots').select('*').then(({ data }) => {
      const map: Record<string, Depot> = {};
      (data as Depot[] | null)?.forEach((d) => (map[d.id] = d));
      setDepots(map);
    });
  }, []);

  useEffect(() => {
    if (justCreatedId) void loadById(justCreatedId);
  }, [justCreatedId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timeout);
  }, [query]);

  async function loadById(id: string) {
    const { data } = await supabase.from('packages').select('*').eq('id', id).single();
    if (data) setSelected(data as Package);
  }

  async function search(q: string) {
    const { data } = await supabase
      .from('packages')
      .select('*')
      .or(`tracking_code.ilike.%${q}%,recipient_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    setResults((data as Package[]) ?? []);
  }

  const handlePrint = useReactToPrint({
    content: () => labelRef.current,
    documentTitle: selected ? `label-${selected.tracking_code}` : 'jkoms-label',
    onAfterPrint: async () => {
      // Move status forward once the label has actually gone to the printer.
      if (selected && selected.status === 'created') {
        await supabase.from('packages').update({ status: 'label_printed' }).eq('id', selected.id);
        setSelected({ ...selected, status: 'label_printed' });
      }
    }
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <h1 className="mb-1 text-xl font-display text-jkoms-navy">Print Labels</h1>
      <p className="mb-6 text-sm text-slate-500">
        Formatted for a 4×6in direct-thermal label on a Munbyn (or compatible) printer.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="panel mb-4 p-4">
            <label className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tracking code or recipient…"
                className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
              />
            </label>
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-100">
                {results.map((pkg) => (
                  <li key={pkg.id}>
                    <button
                      onClick={() => {
                        setSelected(pkg);
                        setQuery('');
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-jkoms-navy"
                    >
                      <span className="font-mono">{pkg.tracking_code}</span>
                      <span className="text-slate-500">{pkg.recipient_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selected ? (
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Print to Munbyn
            </button>
          ) : (
            <p className="text-sm text-slate-400">Search for a package above to preview its label.</p>
          )}

          <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
            <p className="mb-1 font-semibold text-slate-600">Munbyn setup notes</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Install the Munbyn driver, then add it as a standard printer on this device.</li>
              <li>In the print dialog: paper size 4×6in, margins "None," scale 100%.</li>
              <li>Windows: disable "Fit to page" the label CSS is already sized exactly.</li>
              <li>macOS: select "Actual size" in the print panel, not "Scale to fit."</li>
            </ul>
          </div>
        </div>

        {/* Live preview — this same node is what react-to-print sends to the printer */}
        <div className="flex justify-center">
          {selected ? (
            <div className="scale-90 origin-top border border-slate-200 shadow-panel md:scale-100">
              <ShippingLabel
                ref={labelRef}
                pkg={selected}
                originDepot={selected.origin_depot_id ? depots[selected.origin_depot_id] : null}
                destDepot={selected.destination_depot_id ? depots[selected.destination_depot_id] : null}
              />
            </div>
          ) : (
            <div className="flex h-[6in] w-[4in] max-w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-400">
              No label selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
