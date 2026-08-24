# JKOMS Freight OS — Full System Blueprint

Mapped from the live app + both prototype files (`JKOMS_Logistics_OS.html`,
`JKOMS_OS_System_UI.html`). Status: ✅ built · 🟡 partial · ⬜ not started.

## 1. Identity & Access
- ✅ Auth (Supabase), role-based (admin, warehouse, courier, client)
- ✅ Forced password change on first login
- ✅ Account management panel (admin edits any role/name/phone/depot)
- ✅ Row-level security enforced at the database layer, not just UI
- ⬜ Staff task assignment / "tasks done" counters (seen in prototype 2)
- ⬜ Depot-scoped staff visibility (a staffer only sees their depot's work)

## 2. Client / CRM
- ✅ Client accounts with shareable `client_code`
- ✅ Client portal (auto-filtered to their own shipments via RLS)
- ✅ Client delivery confirmation (two-sided, separate from courier scan)
- ⬜ Client profile enrichment: total spend, shipment count, "client since"
      year (prototype's `CLIENTS` array — CRM-style, not just contact info)
- ⬜ Client messaging (prototype: "Message Client", "Reference sent via
      WhatsApp") — beyond the SMS status-change notifier already scaffolded

## 3. Bookings (pre-shipment intake) — ✅ BUILT
The prototype's `BOOKINGS` array showed a stage we were missing: a client
(or staff on their behalf) submits a shipment **request** — service type,
destination, rough date — which goes to **Pending Review**, then staff
**Confirm** or **Decline** it. A confirmed booking hands off to the New
Package form pre-filled with the requester's details, and gets marked
**Converted** once the actual package is saved.

## 4. Packages / Shipments
- ✅ Package CRUD, QR generation, tracking codes
- ✅ Status pipeline (created → ... → delivered/exception/returned)
- ✅ Geo-coordinate addresses for no-street-number regions
- 🟡 Declared value is one lump number for customs/insurance purposes —
      ✅ now also supported by an itemized breakdown (`package_items`:
      category, description, quantity, unit price, running total) shown
      alongside it on Shipment Detail. The lump-sum field stays as a
      manually-set figure; it isn't auto-replaced by the item total.
- ✅ Client + courier linkage

## 5. Freight Journey
- ✅ Multi-leg tracking (`shipment_legs`): pickup → warehouse intake →
      freight transit (air/sea/road, carrier, flight/vessel ref) → customs
      (pending/cleared/hold) → port arrival → out for delivery → delivered
- ✅ Locker/consolidation network (UK ship-to addresses, client_code as
      reference)
- ⬜ Locker intake **scanning** specifically (today it's a manual dropdown
      at package-creation time, not a barcode scan workflow)

## 6. Containers — ✅ BUILT
Distinct from Manifests (which are export/customs paperwork for a batch).
A container is now the physical loading unit itself: container number,
seal number, mode, a closing/cutoff time with a "closes soon" warning,
and its own status lifecycle (loading → closed → in transit → arrived →
customs → released), with packages searchable/addable directly on the
container's detail view.

## 7. Manifests & Invoicing
- ✅ Export/customs manifests (batch of packages, printable A4)
- ✅ Per-package invoices (shipping fee vs. declared value, printable A4)
- ⬜ Auto-generated + auto-emailed invoice on status trigger (prototype:
      "Invoice generated and sent to client email") — currently manual

## 8. Scanning & Proof of Delivery
- ✅ Camera (WebRTC) + Bluetooth/USB HID scanner support
- ✅ Offline scan queue
- ✅ Proof of delivery: photo + signature capture
- ⬜ Standalone "Photo Evidence Log" as its own audit feed (prototype shows
      this separate from the delivery-specific POD — more like ongoing
      condition/damage documentation at any handling point, not just at
      delivery)

## 9. Fleet / Vehicles — ✅ BUILT
Two distinct concepts, now both modeled under one Fleet page with tabs:
  a) **Company fleet** (vans/trucks for local delivery — assigned driver + depot)
  b) **RORO cargo** (a client's own vehicle shipped as freight — make/model/
     VIN for customs, linked to the owning client account)
`shipment_legs.vehicle_ref` remains free text for the freight-leg
description (flight/vessel/vehicle reference on a journey leg); the new
`vehicles` table is the actual registry of fleet and client vehicles.

## 10. Procurement — ✅ BUILT
Suppliers directory (name, category, contact info) and purchase orders with
line items — quantity, unit cost, running total, and a status lifecycle
(draft → ordered → received → cancelled), auto-stamping the received date.
Internal-only (admin/warehouse), not visible to couriers or clients.

## 11. Analytics / Command Center
- ✅ Recharts dashboards: daily volume, status breakdown, service-level split
- ⬜ KPI tiles seen in prototype 2: On-Time Rate, Revenue YTD, Shipments YTD,
      Active Clients, Drivers Active — a proper "Command Center" summary
      view combining several of these in one glance
- ⬜ Revenue reporting (ties to `shipping_fee`, which now exists as a field
      but isn't rolled up anywhere yet)

## 12. Notifications
- ✅ SMS via Africa's Talking (Edge Function scaffold)
- ⬜ WhatsApp Business API (needs Meta verification, noted previously)
- ⬜ In-app activity feed / live ticker (prototype: "Staff Awa scanned...",
      "Driver Musa confirmed delivery...")

---

**Recommended build order from here:** Bookings intake → itemized package
contents → Containers → Fleet/vehicles → Procurement → Command Center →
everything else. This file will get updated as each ships.
