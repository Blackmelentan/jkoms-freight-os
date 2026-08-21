import { useEffect, useRef } from 'react';

/**
 * useHidScanner
 * -------------
 * Most Bluetooth/USB barcode & QR scanners (Munbyn, Honeywell, Zebra,
 * generic "CCD" scanners, etc.) run in HID mode: to the OS they look like
 * a keyboard. They "type" the decoded string very fast and then send
 * Enter/Tab as a terminator. There is no Web Bluetooth API involved —
 * the browser just sees keydown events, indistinguishable from a human
 * typing, except for the speed.
 *
 * Strategy: listen globally for keydown, buffer characters, and use an
 * inter-keystroke timing gate to tell "scanner burst" apart from a human
 * typing in a nearby text field. If a human is actively focused on an
 * <input>/<textarea>, we back off and let that field behave normally
 * unless `captureEvenInInputs` is set (useful for a dedicated "scan"
 * input field where you *want* this hook to also fire).
 *
 * Usage:
 *   useHidScanner((code) => handleScan(code, 'bluetooth_hid'));
 */
interface HidScannerOptions {
  /** Max ms between keystrokes to still count as part of the same scan burst. Human typing is typically >80ms/key; scanners are usually <30ms/key. */
  maxInterKeyDelayMs?: number;
  /** Minimum characters before we treat a buffer as a valid scan (guards against stray Enter presses). */
  minLength?: number;
  /** Also fire while focus is inside an input/textarea (default: false — avoids double-handling on the manual entry field). */
  captureEvenInInputs?: boolean;
  enabled?: boolean;
}

export function useHidScanner(onScan: (code: string) => void, options: HidScannerOptions = {}) {
  const { maxInterKeyDelayMs = 40, minLength = 4, captureEvenInInputs = false, enabled = true } = options;

  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isFormField =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (isFormField && !captureEvenInInputs) return;

      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Terminator keys — scanners almost always send Enter (sometimes Tab).
      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = bufferRef.current.trim();
        bufferRef.current = '';
        if (code.length >= minLength) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }

      // Reset buffer if the gap since the last keystroke is too large —
      // this was a human typing, not a scanner burst.
      if (delta > maxInterKeyDelayMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
      }

      // Only accumulate printable single characters.
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onScan, maxInterKeyDelayMs, minLength, captureEvenInInputs, enabled]);
}
