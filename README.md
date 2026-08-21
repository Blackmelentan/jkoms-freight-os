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
   in the SQL editor run the two files in `supabase/migrations/` in order
   (`0001_init.sql` first).

3. **Create your first admin user**: sign a user up normally (Supabase Auth
   → Users → Add user, or via the app's sign-up flow if you add one), then in
   the SQL editor:
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
   Opens on `http://localhost:5173`. The dev server also binds to your LAN
   (`host: true` in vite.config.ts) so you can open the same URL from a phone
   or handheld scanner on the same WiFi to test the camera/HID flows on real
   hardware.

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

## Suggested next steps (not built yet, worth planning for)

- **Courier assignment workflow**: currently `assigned_courier_id` exists on
  the schema but there's no UI to assign a courier to a package — worth a
  small admin panel once you have real courier accounts.
- **SMS/WhatsApp notifications** on status change (Twilio or Africa's
  Talking would fit the Gambia + Scotland dual-market context better than a
  US-only provider) — hook into a Supabase Edge Function triggered off
  `scan_events` inserts.
- **Proof of delivery**: photo capture + signature pad at the `delivered`
  scan step, stored in Supabase Storage, linked from `scan_events` via a new
  `attachment_url` column.
- **Multi-tenant client portal**: the `client` role exists in the schema but
  the RLS policy for it is a placeholder — decide how a client's shipments
  get linked to their auth account (email match on sender/recipient, or an
  explicit `client_id` foreign key) before exposing that role in production.
