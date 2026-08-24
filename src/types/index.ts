// ---------------------------------------------------------------------------
// JKOMS Freight OS — core domain types
// These mirror the Supabase schema in supabase/migrations/0001_init.sql.
// Keep the two in sync when either changes.
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'warehouse' | 'courier' | 'client';

export interface Profile {
  id: string; // == auth.users.id
  full_name: string;
  role: UserRole;
  phone: string | null;
  depot_id: string | null;
  must_change_password: boolean;
  client_code: string | null;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  created_at: string;
}

export interface Depot {
  id: string;
  name: string;
  code: string; // e.g. "BJL" for Banjul depot
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export type ShipmentStatus =
  | 'created'
  | 'label_printed'
  | 'picked_up'
  | 'in_transit'
  | 'at_depot'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'returned'
  | 'exception';

export const SHIPMENT_STATUS_ORDER: ShipmentStatus[] = [
  'created',
  'label_printed',
  'picked_up',
  'in_transit',
  'at_depot',
  'out_for_delivery',
  'delivered'
];

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  created: 'Created',
  label_printed: 'Label Printed',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  at_depot: 'At Depot',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  delivery_failed: 'Delivery Failed',
  returned: 'Returned',
  exception: 'Exception'
};

export type BookingStatus = 'pending_review' | 'confirmed' | 'converted' | 'declined';

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_review: 'Pending Review',
  confirmed: 'Confirmed',
  converted: 'Converted',
  declined: 'Declined'
};

export interface Booking {
  id: string;
  booking_ref: string;
  client_id: string | null;
  requester_name: string;
  requester_phone: string | null;
  requester_email: string | null;
  service_type: string;
  destination: string;
  preferred_date: string | null;
  notes: string | null;
  status: BookingStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  converted_package_id: string | null;
  created_at: string;
}

export interface PackageItem {
  id: string;
  package_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number | null;
  created_at: string;
}

export interface Manifest {
  id: string;
  manifest_code: string;
  title: string;
  transport_mode: TransportMode | null;
  carrier_name: string | null;
  vehicle_ref: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Locker {
  id: string;
  code: string;
  label: string;
  address: string;
  country: string;
  active: boolean;
  created_at: string;
}

export interface Package {
  id: string;
  tracking_code: string; // human-readable, e.g. JKG-2608-000482
  qr_payload: string; // what's encoded in the QR — usually just tracking_code
  status: ShipmentStatus;
  sender_name: string;
  sender_phone: string | null;
  sender_address: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  origin_depot_id: string | null;
  destination_depot_id: string | null;
  assigned_courier_id: string | null;
  locker_id: string | null;
  client_id: string | null;
  weight_kg: number | null;
  declared_value: number | null;
  shipping_fee: number | null;
  service_level: 'standard' | 'express' | 'same_day';
  notes: string | null;
  sender_lat: number | null;
  sender_lng: number | null;
  recipient_lat: number | null;
  recipient_lng: number | null;
  client_accepted: boolean;
  client_accepted_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type LegType =
  | 'pickup'
  | 'warehouse_intake'
  | 'freight_transit'
  | 'customs'
  | 'port_arrival'
  | 'out_for_delivery'
  | 'delivered';

export const LEG_TYPE_LABEL: Record<LegType, string> = {
  pickup: 'Pickup',
  warehouse_intake: 'Warehouse Intake',
  freight_transit: 'Freight Transit',
  customs: 'Customs',
  port_arrival: 'Port Arrival',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered'
};

export type TransportMode = 'road' | 'air' | 'sea';
export type CustomsStatus = 'not_applicable' | 'pending' | 'cleared' | 'hold';

export interface ShipmentLeg {
  id: string;
  package_id: string;
  leg_order: number;
  leg_type: LegType;
  transport_mode: TransportMode | null;
  carrier_name: string | null;
  vehicle_ref: string | null;
  origin_label: string | null;
  destination_label: string | null;
  customs_status: CustomsStatus;
  departed_at: string | null;
  eta: string | null;
  arrived_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScanEvent {
  id: string;
  package_id: string;
  scanned_by: string;
  status: ShipmentStatus;
  scan_method: 'camera' | 'bluetooth_hid' | 'manual';
  lat: number | null;
  lng: number | null;
  device_note: string | null;
  attachment_url: string | null;
  signature_data: string | null;
  created_at: string;
}

export interface CourierOption {
  id: string;
  full_name: string;
  phone: string | null;
  depot_id: string | null;
}

export interface PackageWithLatestScan extends Package {
  latest_scan?: ScanEvent;
}

// Aggregate shape used by the Analytics page (built from Supabase views/RPCs)
export interface DailyVolume {
  day: string; // ISO date
  created: number;
  delivered: number;
  exceptions: number;
}

export interface StatusBreakdown {
  status: ShipmentStatus;
  count: number;
}

export interface CourierPerformance {
  courier_id: string;
  courier_name: string;
  delivered_count: number;
  failed_count: number;
  avg_delivery_hours: number;
}
