import type { ShipmentStatus } from '@/types';
import { SHIPMENT_STATUS_LABEL } from '@/types';

const STATUS_STYLE: Record<ShipmentStatus, string> = {
  created: 'bg-slate-100 text-slate-600',
  label_printed: 'bg-slate-100 text-slate-600',
  picked_up: 'bg-jkoms-steel/10 text-jkoms-steel',
  in_transit: 'bg-jkoms-steel/10 text-jkoms-steel',
  at_depot: 'bg-amber-100 text-amber-700',
  out_for_delivery: 'bg-amber-100 text-amber-700',
  delivered: 'bg-status-delivered/10 text-status-delivered',
  delivery_failed: 'bg-status-exception/10 text-status-exception',
  returned: 'bg-status-returned/10 text-status-returned',
  exception: 'bg-status-exception/10 text-status-exception'
};

export function StatusPill({ status }: { status: ShipmentStatus }) {
  return <span className={`status-pill ${STATUS_STYLE[status]}`}>{SHIPMENT_STATUS_LABEL[status]}</span>;
}
