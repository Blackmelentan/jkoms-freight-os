import { forwardRef } from 'react';
import type { Manifest, Package } from '@/types';

interface ManifestDocumentProps {
  manifest: Manifest;
  packages: Package[];
}

/**
 * ManifestDocument
 * ----------------
 * The customs/export manifest — one document listing everything traveling
 * together on a single freight leg. Printed to a normal A4 page (unlike the
 * 4x6 thermal label), via the browser's print-to-PDF, so no PDF library
 * dependency is needed — same pattern as ShippingLabel.
 */
export const ManifestDocument = forwardRef<HTMLDivElement, ManifestDocumentProps>(function ManifestDocument(
  { manifest, packages },
  ref
) {
  const totalWeight = packages.reduce((sum, p) => sum + (p.weight_kg ?? 0), 0);
  const totalValue = packages.reduce((sum, p) => sum + (p.declared_value ?? 0), 0);

  return (
    <div ref={ref} id="print-manifest" className="print-label-area bg-white p-8 text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      <div className="mb-6 flex items-center justify-between border-b-4 border-black pb-4">
        <div>
          <img src="/assets/logo/logo-text-only-navy.png" alt="JKOMS" className="h-8 w-auto" style={{ filter: 'grayscale(1) contrast(2)' }} />
          <p className="mt-1 text-xs text-neutral-500">Export / Freight Manifest</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-mono font-bold">{manifest.manifest_code}</p>
          <p>{new Date(manifest.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <h1 className="mb-1 text-xl font-bold">{manifest.title}</h1>
      <div className="mb-6 grid grid-cols-3 gap-4 text-xs text-neutral-600">
        {manifest.transport_mode && <p>Mode: <span className="font-semibold capitalize text-black">{manifest.transport_mode}</span></p>}
        {manifest.carrier_name && <p>Carrier: <span className="font-semibold text-black">{manifest.carrier_name}</span></p>}
        {manifest.vehicle_ref && <p>Ref: <span className="font-semibold text-black">{manifest.vehicle_ref}</span></p>}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left uppercase">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Tracking Code</th>
            <th className="py-2 pr-2">Recipient</th>
            <th className="py-2 pr-2">Destination</th>
            <th className="py-2 pr-2 text-right">Weight (kg)</th>
            <th className="py-2 text-right">Declared Value</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p, i) => (
            <tr key={p.id} className="border-b border-neutral-200">
              <td className="py-1.5 pr-2 text-neutral-400">{i + 1}</td>
              <td className="py-1.5 pr-2 font-mono">{p.tracking_code}</td>
              <td className="py-1.5 pr-2">{p.recipient_name}</td>
              <td className="py-1.5 pr-2">{p.recipient_address}</td>
              <td className="py-1.5 pr-2 text-right">{p.weight_kg ?? '—'}</td>
              <td className="py-1.5 text-right">{p.declared_value ?? '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-semibold">
            <td colSpan={4} className="py-2 pr-2 text-right">
              {packages.length} package{packages.length === 1 ? '' : 's'} · Totals
            </td>
            <td className="py-2 pr-2 text-right">{totalWeight.toFixed(2)}</td>
            <td className="py-2 text-right">{totalValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {manifest.notes && (
        <div className="mt-6 border-t border-neutral-300 pt-3 text-xs text-neutral-600">
          <p className="mb-1 font-semibold uppercase text-neutral-500">Notes</p>
          <p>{manifest.notes}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-xs">
        <div>
          <p className="mb-8 border-b border-black">&nbsp;</p>
          <p className="text-neutral-500">Prepared by / Signature</p>
        </div>
        <div>
          <p className="mb-8 border-b border-black">&nbsp;</p>
          <p className="text-neutral-500">Customs / Receiving Officer</p>
        </div>
      </div>
    </div>
  );
});
