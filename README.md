# JKOMS Freight OS

Logistics and freight management PWA for JKOMS Global Ltd — warehouse label
printing, courier scanning (camera + Bluetooth HID), live shipment tracking,
and analytics.

## Stack

| Layer      | Choice                                                  |
|------------|----------------------------------------------------------|
| Frontend   | React 18 + Vite + TypeScript + Tailwind CSS               |
| State      | Zustand (auth), local component state elsewhere          |
| Backend    | Supabase (Postgres + Auth + Realtime + Row Level Security)|
| Charts     | Recharts                                                  |
| QR codes   | qrcode.react                                              |
| Camera scan| html5-qrcode (WebRTC under the hood)                       |
| Printing   | react-to-print, CSS sized for Munbyn 4×6in thermal labels |
| PWA        | vite-plugin-pwa (offline shell + scan queue via localStorage)|

## Project structure

```
jkoms-logistics/
├── public/
│   └── assets/logo/            # brand assets (from the identity guide you sent)
├── src/
│   ├── components/
│   │   ├── layout/             # Header, Sidebar, MobileNav
│   │   ├── scanner/            # CameraScanner (WebRTC)
│   │   ├── labels/             # ShippingLabel (Munbyn 4x6 layout)
│   │   └── ui/                 # StatusPill, etc.
│   ├── hooks/
│   │   └── useHidScanner.ts    # Bluetooth/USB HID scanner listener
│   ├── lib/
│   │   └── supabase.ts         # Supabase client singleton
│   ├── pages/                  # one file per route
│   ├── store/
│   │   └── authStore.ts        # zustand auth state
│   ├── types/
│   │   └── index.ts            # domain types, mirrors the SQL schema
│   └── utils/
│       └── trackingCode.ts
├── supabase/
│   └── migrations/
│       ├── 0001_init.sql       # schema, RLS policies, realtime, seed depots
│       └── 0002_courier_performance_view.sql
└── vite.config.ts              # includes vite-plugin-pwa manifest
```

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), then
   in the SQL editor run the migration files in `supabase/migrations/` **in
   numeric order** — `0001_init.sql`, then `0002_courier_performance_view.sql`,
   then `0003_feature_completion.sql`.

3. **Create your first admin user**: sign a user up normally (Supabase Auth
   → Users → Add user), then in the SQL editor:
   ```sql
   update profiles set role = 'admin', full_name = 'Your Name' where id = 'the-user-uuid';
   ```

4. **Environment variables**
   ```bash
   cp .env.example .env.local
   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from
   # Supabase Dashboard -> Project Settings -> API
   ```

5. **Run it**
   ```bash
   npm run dev
   ```

## Managing accounts and roles

Sign in as admin and go to **Accounts** in the sidebar. New logins are still
created in Supabase Auth directly (the anon key the app ships with can never
create users — that needs the service_role key, which must never reach the
browser), but once a login exists, its role/name/phone/depot are all editable
right there in the app — no more manual SQL per account.

## Proof of delivery

When a courier sets the scan target to **Delivered**, the Scan page requires
a photo and/or a signature before the scan will submit. Photos upload to the
`proof-of-delivery` Storage bucket (created by migration 0003); the
signature is stored as a base64 PNG directly on the `scan_events` row. Both
show up on the Shipment Detail page once delivered.

## Courier assignment

On any Shipment Detail page, admin/warehouse users get a courier dropdown
(pulled from accounts with the `courier` role). Once assigned, that
courier's own login can see and update that specific package — enforced at
the RLS level, not just hidden in the UI.

## Client portal

Clients see only their own shipments automatically — enforced by the
`packages_read_client` RLS policy, which matches on `profiles.phone ==
packages.recipient_phone`. **To give a client visibility into their
shipments: when creating their account, set their profile phone number to
match the recipient phone number used on their packages.** Staff-only
actions (New Package, Scan, Print Labels) are hidden from the client's UI.

For exact linkage instead of a phone match (e.g. a client whose recipient
phone changes), `packages.client_id` also exists — set it directly on a
package to link it to a specific client account regardless of phone number.

## SMS/WhatsApp notifications

`supabase/functions/notify-status-change/index.ts` is a Supabase Edge
Function that texts the recipient whenever a package's status changes, via
Africa's Talking (better Gambia/West Africa coverage than Twilio — swap the
fetch call if you'd rather use something else).

To turn it on:
1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then from the project root:
   ```bash
   supabase functions deploy notify-status-change
   supabase secrets set AFRICASTALKING_USERNAME=your-username
   supabase secrets set AFRICASTALKING_API_KEY=your-api-key
   ```
2. In the Supabase Dashboard: **Database → Webhooks → Create a new webhook**
   - Table: `scan_events`
   - Events: `Insert`
   - Type: `Supabase Edge Functions`
   - Function: `notify-status-change`
3. Test it by making a scan — the recipient on that package should get a text.

If you'd rather not stand up an Edge Function yet, the app works fully
without this — it's an additive layer on top of the scan/status system, not
a dependency of it.

## Munbyn thermal printer setup

1. Install the Munbyn driver for your OS and add it as a standard system
   printer (USB or Bluetooth pairing, per the printer's manual).
2. On the **Print Labels** page, search for a package, then click **Print to
   Munbyn**.
3. In the browser print dialog:
   - Paper size: **4 × 6 in**
   - Margins: **None**
   - Scale: **100% / Actual size** — do *not* use "Fit to page," the label
     component is already sized exactly to the media.
4. The label is pure black-on-white with no gradients — thermal printheads
   render everything as solid black, so anything with a gradient (like the
   full-color logo) would print as a dark blob. The label uses the
   monochrome text-only wordmark instead.

## Bluetooth / USB HID scanner setup

Most handheld barcode/QR scanners (Munbyn's own scanner, Honeywell, Zebra,
generic "CCD" scanners) operate in **HID keyboard-emulation mode** — there's
no pairing flow beyond standard Bluetooth pairing at the OS level, and no Web
Bluetooth API involved. Once paired:

1. Go to the **Scan** page, switch to **BT / USB Scanner** mode.
2. Trigger a scan on the device. `useHidScanner` listens globally for the
   fast keystroke burst + Enter terminator that these scanners send, and
   fires the same handler the camera scanner uses.
3. No need to click into a text field first — the listener is global while
   that mode is active.

If a specific scanner model needs different config (some ship in "USB COM
port" mode instead of HID by default), reconfigure it to HID/keyboard mode
via its setup barcode sheet — that's a one-time scan on the device itself,
not something the app can change.

## Architecture notes & edge cases handled

- **Offline scan queue**: if a courier scans while offline (common in areas
  with patchy signal), scans are queued in `localStorage` and flushed
  automatically on reconnect (`ScanPage.tsx`). The PWA service worker also
  caches the last-known Supabase REST responses so the shell doesn't go
  blank.
- **Duplicate-scan protection**: both the camera scanner (debounce window)
  and the HID listener (processing lock) guard against a single physical
  scan firing the status-update mutation twice.
- **Tracking code collisions**: client generates a draft code, but the DB
  has a `UNIQUE` constraint as the real source of truth; on a rare collision
  the UI regenerates and asks the user to resubmit rather than silently
  overwriting.
- **Role-based access**: enforced at the database layer via Postgres RLS,
  not just hidden in the UI — a courier's Supabase session literally cannot
  read or write packages outside what's assigned to them, admin/warehouse
  see everything, clients are read-only.
- **Realtime everywhere it matters**: Dashboard, Shipments list, and
  Shipment Detail all subscribe to `postgres_changes` so a scan from a
  courier's phone appears on the warehouse dashboard within a second,
  without polling.
- **Audit trail**: `scan_events` is append-only — the current status lives
  on `packages`, but every transition is preserved for dispute resolution
  ("the courier says they delivered it, when exactly did that scan happen
  and from which method").

## Manifests & invoices

**Manifests** (sidebar, admin/warehouse) group multiple packages traveling
together on one freight leg into a single export/customs document — search
and add packages, set transport mode/carrier/vehicle ref, and it generates a
printable A4 document with a package table, totals, and signature lines for
the preparer and customs officer. Past manifests are listed and reopenable.

**Invoices** are per-package — an "Invoice" button on any Shipment Detail
page (admin/warehouse) generates a printable A4 invoice showing the
`shipping_fee` (what was actually charged) separately from `declared_value`
(the customs/insurance figure, clearly labeled as not a charge).

Both reuse the browser's print-to-PDF (same pattern as thermal labels) — no
PDF library dependency. In the print dialog, select **A4** paper size, not
the 4×6 thermal default.

## Still worth planning for (not built)

- **WhatsApp Business API** instead of/alongside plain SMS — Africa's
  Talking also supports this, but it needs a Meta Business verification
  process that takes a few days, so it wasn't wired in by default.
- **Bulk label printing** — Print Labels currently handles one package at a
  time; a warehouse processing a large batch might want multi-select +
  print-all.
- **Depot-level filtering** — packages/analytics currently show the whole
  network to admin/warehouse; a depot-scoped staff role (see only their
  depot's packages) isn't built, only the `depot_id` column exists on
  `profiles` for future use.
- **Locker intake scanning** — right now logging a package as "received at
  locker X" is a manual dropdown on package creation. A dedicated scan flow
  for locker intake (barcode on incoming UK parcels → auto-match by
  client_code in the address → notify client) would close the loop, but
  isn't built.
- **Auto-generated invoices sent by email** — invoices currently need a
  manual click + print; the prototype showed "Invoice generated and sent to
  client email" automatically on a status trigger, which would need an Edge
  Function similar to the SMS notification one.
