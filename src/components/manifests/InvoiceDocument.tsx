import { forwardRef } from 'react';
import type { Package } from '@/types';

interface InvoiceDocumentProps {
  pkg: Package;
}

/**
 * InvoiceDocument
 * ---------------
 * Client-facing invoice for a single shipment — separate from the customs
 * manifest (which is an internal/export document covering many packages).
 * shipping_fee is what was actually charged; declared_value is shown too
 * since it's relevant context but is a customs/insurance figure, not a
 * charge.
 */
export const InvoiceDocument = forwardRef<HTMLDivElement, InvoiceDocumentProps>(function InvoiceDocument({ pkg }, ref) {
  return (
    <div ref={ref} id="print-invoice" className="print-label-area bg-white p-8 text-black" style={{ width: '210mm', minHeight: '297mm', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}>
      <div className="mb-8 flex items-center justify-between border-b-4 border-black pb-4">
        <div>
          <img src="/assets/logo/logo-text-only-navy.png" alt="JKOMS" className="h-8 w-auto" style={{ filter: 'grayscale(1) contrast(2)' }} />
          <p className="mt-1 text-xs text-neutral-500">JKOMS Global Ltd — Shipping Invoice</p>
        </div>
        <div className="text-right text-xs">
          <p className="font-mono font-bold">{pkg.tracking_code}</p>
          <p>{new Date(pkg.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-8 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Sender</p>
          <p className="font-semibold">{pkg.sender_name}</p>
          <p className="text-neutral-600">{pkg.sender_address}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-neutral-500">Recipient</p>
          <p className="font-semibold">{pkg.recipient_name}</p>
          <p className="text-neutral-600">{pkg.recipient_address}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left uppercase text-xs">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-neutral-200">
            <td className="py-2 capitalize">{pkg.service_level.replace('_', ' ')} shipping service</td>
            <td className="py-2 text-right">{pkg.shipping_fee != null ? pkg.shipping_fee.toFixed(2) : '—'}</td>
          </tr>
          {pkg.weight_kg && (
            <tr className="border-b border-neutral-200 text-neutral-500">
              <td className="py-2 text-xs">Chargeable weight</td>
              <td className="py-2 text-right text-xs">{pkg.weight_kg} kg</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-black font-bold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{pkg.shipping_fee != null ? pkg.shipping_fee.toFixed(2) : '—'}</td>
          </tr>
        </tfoot>
      </table>

      {pkg.declared_value != null && (
        <p className="mt-4 text-xs text-neutral-500">
          Declared value for customs/insurance purposes: {pkg.declared_value.toFixed(2)} (not a charge)
        </p>
      )}

      <p className="mt-10 text-xs text-neutral-400">
        Questions about this invoice? Contact JKOMS Global Ltd quoting tracking code {pkg.tracking_code}.
      </p>
    </div>
  );
});
