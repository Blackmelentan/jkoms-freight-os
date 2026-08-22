import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Bluetooth, CheckCircle2, XCircle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useHidScanner } from '@/hooks/useHidScanner';
import { CameraScanner } from '@/components/scanner/CameraScanner';
import { SignaturePad } from '@/components/scanner/SignaturePad';
import { PhotoCapture } from '@/components/scanner/PhotoCapture';
import type { Package, ScanEvent, ShipmentStatus } from '@/types';
import { SHIPMENT_STATUS_LABEL, SHIPMENT_STATUS_ORDER } from '@/types';

type ScanMode = 'camera' | 'bluetooth';

interface ScanResult {
  code: string;
  pkg: Package | null;
  newStatus: ShipmentStatus | null;
  ok: boolean;
  message: string;
  at: number;
}

// Simple queue entry for scans made while offline — flushed when connectivity returns.
interface QueuedScan {
  code: string;
  status: ShipmentStatus;
  method: 'camera' | 'bluetooth_hid';
  queuedAt: number;
}
const QUEUE_KEY = 'jkoms_offline_scan_queue';

export function ScanPage() {
  const profile = useAuthStore((s) => s.profile);
  const [mode, setMode] = useState<ScanMode>('camera');
  const [targetStatus, setTargetStatus] = useState<ShipmentStatus>('picked_up');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [queueSize, setQueueSize] = useState(0);
  const processingLock = useRef(false);

  // Proof of delivery — only relevant/required when targetStatus is 'delivered'.
  const [podPhoto, setPodPhoto] = useState<File | null>(null);
  const [podSignature, setPodSignature] = useState<string | null>(null);
  const isDeliveryScan = targetStatus === 'delivered';
  const podReady = !isDeliveryScan || !!podPhoto || !!podSignature;

  useEffect(() => {
    setQueueSize(readQueue().length);
    const flush = () => void flushQueue();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  const processScan = useCallback(
    async (code: string, method: 'camera' | 'bluetooth_hid') => {
      // Guard against double-fires (camera cooldown + a stray Bluetooth Enter, etc.)
      if (processingLock.current) return;
      if (isDeliveryScan && !podReady) {
        pushResult({
          code,
          pkg: null,
          newStatus: null,
          ok: false,
          message: 'Capture a photo or signature before confirming delivery.',
          at: Date.now()
        });
        return;
      }
      processingLock.current = true;
      setProcessing(true);

      if (!navigator.onLine) {
        // Offline queue can't carry a File object through localStorage/JSON,
        // so delivery scans with a photo attached simply aren't queueable —
        // require connectivity for those specifically.
        if (isDeliveryScan && podPhoto) {
          pushResult({
            code,
            pkg: null,
            newStatus: null,
            ok: false,
            message: 'Photo proof needs a connection to upload — reconnect and try again.',
            at: Date.now()
          });
          processing_reset();
          return;
        }
        enqueue({ code, status: targetStatus, method, queuedAt: Date.now() });
        setQueueSize(readQueue().length);
        pushResult({
          code,
          pkg: null,
          newStatus: targetStatus,
          ok: true,
          message: 'Offline — scan queued and will sync automatically.',
          at: Date.now()
        });
        processing_reset();
        return;
      }

      const result = await applyScan(code, targetStatus, method, profile?.id, podPhoto, podSignature);
      pushResult(result);
      if (result.ok && isDeliveryScan) {
        setPodPhoto(null);
        setPodSignature(null);
      }
      processing_reset();

      function processing_reset() {
        setProcessing(false);
        // Small cooldown so a Bluetooth scanner's terminator key can't
        // immediately re-trigger on the same physical scan.
        setTimeout(() => {
          processingLock.current = false;
        }, 600);
      }
    },
    [targetStatus, profile?.id, isDeliveryScan, podReady, podPhoto, podSignature]
  );

  function pushResult(result: ScanResult) {
    setLastResult(result);
    setHistory((h) => [result, ...h].slice(0, 15));
  }

  async function flushQueue() {
    const queue = readQueue();
    if (queue.length === 0) return;
    for (const item of queue) {
      const result = await applyScan(item.code, item.status, item.method, profile?.id, null, null);
      pushResult(result);
    }
    localStorage.removeItem(QUEUE_KEY);
    setQueueSize(0);
  }

  // --- Bluetooth HID listener (always active while this page is mounted) ---
  useHidScanner(
    (code) => {
      void processScan(code, 'bluetooth_hid');
    },
    { enabled: mode === 'bluetooth', captureEvenInInputs: false }
  );

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setManualCode('');
    void processScan(code, 'bluetooth_hid'); // manual entry treated like a keyed scan
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
      <h1 className="mb-1 text-xl font-display text-jkoms-navy">Scan</h1>
      <p className="mb-6 text-sm text-slate-500">
        Scan a package to update its status. Works with the device camera or a Bluetooth/USB HID scanner.
      </p>

      {queueSize > 0 && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {queueSize} scan{queueSize > 1 ? 's' : ''} queued offline — will sync when back online.
        </div>
      )}

      {/* Target status selector — what this batch of scans will set */}
      <label className="mb-4 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
        Set status to
        <select
          value={targetStatus}
          onChange={(e) => setTargetStatus(e.target.value as ShipmentStatus)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        >
          {SHIPMENT_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </option>
          ))}
          <option value="delivery_failed">{SHIPMENT_STATUS_LABEL.delivery_failed}</option>
          <option value="exception">{SHIPMENT_STATUS_LABEL.exception}</option>
        </select>
      </label>

      {isDeliveryScan && (
        <div className="mb-4 rounded-md border border-jkoms-navy/15 bg-jkoms-navy/5 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-jkoms-navy">
            <ShieldCheck className="h-4 w-4" /> Proof of Delivery
          </p>
          <p className="mb-3 text-xs text-slate-500">Capture a photo, a signature, or both before scanning.</p>
          <div className="flex flex-wrap gap-4">
            <PhotoCapture onChange={setPodPhoto} />
            <div className="w-full max-w-xs">
              <SignaturePad onChange={setPodSignature} />
            </div>
          </div>
        </div>
      )}

      {/* Mode toggle */}
      <div className="mb-4 flex rounded-md border border-slate-200 bg-white p-1">
        <button
          onClick={() => setMode('camera')}
          className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-sm font-medium ${
            mode === 'camera' ? 'bg-jkoms-navy text-white' : 'text-slate-500'
          }`}
        >
          <Camera className="h-4 w-4" /> Camera
        </button>
        <button
          onClick={() => setMode('bluetooth')}
          className={`flex flex-1 items-center justify-center gap-2 rounded py-2 text-sm font-medium ${
            mode === 'bluetooth' ? 'bg-jkoms-navy text-white' : 'text-slate-500'
          }`}
        >
          <Bluetooth className="h-4 w-4" /> BT / USB Scanner
        </button>
      </div>

      {mode === 'camera' ? (
        <CameraScanner active={mode === 'camera'} onDecode={(text) => void processScan(text, 'camera')} />
      ) : (
        <div className="rounded-lg border border-dashed border-jkoms-steel/40 bg-jkoms-steel/5 p-8 text-center">
          <Bluetooth className="mx-auto mb-2 h-8 w-8 text-jkoms-steel" />
          <p className="text-sm text-slate-600">
            Ready. Pair your scanner in HID mode via Bluetooth/USB, then trigger a scan — it'll be captured
            automatically, no need to click into a field first.
          </p>
        </div>
      )}

      {/* Manual fallback — always available regardless of mode */}
      <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Or type tracking code manually…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2.5 text-sm font-mono focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        />
        <button type="submit" className="btn-secondary text-sm">
          Submit
        </button>
      </form>

      {/* Last scan result — big, obvious feedback for someone mid-workflow */}
      {(processing || lastResult) && (
        <div
          className={`mt-6 flex items-center gap-3 rounded-lg p-4 ${
            processing
              ? 'bg-slate-100'
              : lastResult?.ok
              ? 'bg-status-delivered/10'
              : 'bg-status-exception/10'
          }`}
        >
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : lastResult?.ok ? (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-status-delivered" />
          ) : (
            <XCircle className="h-6 w-6 shrink-0 text-status-exception" />
          )}
          <div>
            <p className="font-mono text-sm font-semibold text-jkoms-navy">
              {processing ? 'Processing…' : lastResult?.code}
            </p>
            {!processing && <p className="text-sm text-slate-600">{lastResult?.message}</p>}
          </div>
        </div>
      )}

      {/* Recent scan history */}
      {history.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Recent Scans</p>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-100 bg-white">
            {history.map((r, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="font-mono">{r.code}</span>
                <span className={r.ok ? 'text-status-delivered' : 'text-status-exception'}>
                  {r.ok ? '✓' : '✗'} {new Date(r.at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared scan-application logic (used by live scans and queue flush alike)
// ---------------------------------------------------------------------------
async function applyScan(
  code: string,
  status: ShipmentStatus,
  method: 'camera' | 'bluetooth_hid',
  scannedBy: string | undefined,
  podPhoto: File | null,
  podSignature: string | null
): Promise<ScanResult> {
  const trimmed = code.trim();

  const { data: pkg, error: findError } = await supabase
    .from('packages')
    .select('*')
    .eq('tracking_code', trimmed)
    .single();

  if (findError || !pkg) {
    return { code: trimmed, pkg: null, newStatus: null, ok: false, message: 'No package found with that code.', at: Date.now() };
  }

  const { error: updateError } = await supabase.from('packages').update({ status }).eq('id', pkg.id);

  if (updateError) {
    return { code: trimmed, pkg, newStatus: null, ok: false, message: updateError.message, at: Date.now() };
  }

  // Upload proof-of-delivery photo, if provided, before writing the scan event
  // so the event row can carry the resulting public URL in one insert.
  let attachmentUrl: string | null = null;
  if (podPhoto) {
    const path = `${pkg.id}/${Date.now()}-${podPhoto.name}`;
    const { error: uploadError } = await supabase.storage.from('proof-of-delivery').upload(path, podPhoto);
    if (!uploadError) {
      attachmentUrl = supabase.storage.from('proof-of-delivery').getPublicUrl(path).data.publicUrl;
    }
  }

  const scanEvent: Partial<ScanEvent> = {
    package_id: pkg.id,
    scanned_by: scannedBy,
    status,
    scan_method: method,
    attachment_url: attachmentUrl,
    signature_data: podSignature
  };
  await supabase.from('scan_events').insert(scanEvent);

  return {
    code: trimmed,
    pkg,
    newStatus: status,
    ok: true,
    message: `${pkg.recipient_name} — status updated to ${SHIPMENT_STATUS_LABEL[status]}.`,
    at: Date.now()
  };
}

function readQueue(): QueuedScan[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedScan[];
  } catch {
    return [];
  }
}

function enqueue(item: QueuedScan) {
  const queue = readQueue();
  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}
