import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraOff, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  onDecode: (text: string) => void;
  /** Debounce so the same code sitting in frame doesn't fire repeatedly. */
  cooldownMs?: number;
  active: boolean;
}

/**
 * CameraScanner
 * -------------
 * Thin wrapper around html5-qrcode, which itself uses getUserMedia (WebRTC)
 * under the hood to pull frames from the device camera and decode them
 * in-browser — no images ever leave the device. We constrain the decoder
 * to QR + the common 1D formats couriers actually receive (Code128 is what
 * most carrier-generated labels use; QR is what our own warehouse prints).
 */
const SCAN_REGION_ID = 'jkoms-camera-scan-region';

export function CameraScanner({ onDecode, cooldownMs = 1500, active }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastDecodeRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;

    const scanner = new Html5Qrcode(SCAN_REGION_ID, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13
      ],
      verbose: false
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' }, // rear camera — this is a handheld/warehouse scan tool
        { fps: 12, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0 },
        (decodedText) => {
          const now = Date.now();
          const { text, at } = lastDecodeRef.current;
          if (decodedText === text && now - at < cooldownMs) return; // debounce repeat frames
          lastDecodeRef.current = { text: decodedText, at: now };
          onDecode(decodedText);
        },
        () => {
          // Per-frame decode failures are normal (empty frame, motion blur) — ignore.
        }
      )
      .then(() => setReady(true))
      .catch((err) => {
        setError(
          err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings to scan.'
            : 'Could not start the camera. Another app may be using it, or no camera is available.'
        );
      });

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          /* already stopped */
        });
      scannerRef.current = null;
      setReady(false);
    };
  }, [active, cooldownMs, onDecode]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-status-exception/30 bg-status-exception/5 p-8 text-center">
        <CameraOff className="h-8 w-8 text-status-exception" />
        <p className="text-sm text-slate-700">{error}</p>
        <button className="btn-secondary text-sm" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-black">
      <div id={SCAN_REGION_ID} className="mx-auto w-full max-w-md" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
          Starting camera…
        </div>
      )}
    </div>
  );
}
