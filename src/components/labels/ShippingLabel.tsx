import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { Package, Depot } from '@/types';

interface ShippingLabelProps {
  pkg: Package;
  originDepot?: Depot | null;
  destDepot?: Depot | null;
}

/**
 * ShippingLabel
 * -------------
 * Fixed at 4in x 6in — the standard Munbyn direct-thermal label size
 * (also matches most other thermal label printers, e.g. Zebra 2844/GK420,
 * Rollo). Laid out for readability at ~203dpi thermal print resolution:
 * high-contrast pure black on white, no gradients/photos (thermal heads
 * render flat color as solid black), generous type size for the address
 * block since paper labels are usually read at arm's length in a loading bay.
 *
 * The `id="print-label"` + `.print-label-area` class pairing is what the
 * global print stylesheet (src/index.css) isolates when the browser print
 * dialog fires from the Label Print page.
 */
export const ShippingLabel = forwardRef<HTMLDivElement, ShippingLabelProps>(function ShippingLabel(
  { pkg, originDepot, destDepot },
  ref
) {
  return (
    <div
      ref={ref}
      id="print-label"
      className="print-label-area flex flex-col justify-between bg-white p-4 text-black"
      style={{ width: '4in', height: '6in', fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
    >
      {/* Header: wordmark (monochrome — thermal heads don't render gradients) + service level */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <img src="/assets/logo/logo-text-only-navy.png" alt="JKOMS" className="h-7 w-auto" style={{ filter: 'grayscale(1) contrast(2)' }} />
        <span className="rounded border-2 border-black px-2 py-0.5 text-xs font-bold uppercase tracking-wide">
          {pkg.service_level.replace('_', ' ')}
        </span>
      </div>

      {/* Route: origin -> destination in large type — the thing a sorter glances at first */}
      <div className="flex items-center justify-between py-2 text-2xl font-black">
        <span>{originDepot?.code ?? '—'}</span>
        <span className="text-base">→</span>
        <span>{destDepot?.code ?? '—'}</span>
      </div>

      {/* Recipient block — the primary content, largest type on the label */}
      <div className="flex-1 border-y-2 border-black py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">Deliver To</p>
        <p className="text-lg font-bold leading-tight">{pkg.recipient_name}</p>
        <p className="text-sm leading-snug">{pkg.recipient_address}</p>
        <p className="text-sm font-semibold">{pkg.recipient_phone}</p>
      </div>

      {/* Sender block — smaller, secondary */}
      <div className="py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">From</p>
        <p className="text-xs leading-snug">
          {pkg.sender_name} — {pkg.sender_address}
        </p>
      </div>

      {/* QR + tracking code footer */}
      <div className="flex items-center justify-between border-t-2 border-black pt-2">
        <div>
          <p className="font-mono text-base font-bold">{pkg.tracking_code}</p>
          {pkg.weight_kg && <p className="text-xs">{pkg.weight_kg} kg</p>}
        </div>
        <QRCodeSVG value={pkg.qr_payload} size={72} fgColor="#000000" level="M" />
      </div>
    </div>
  );
});
