import { useRef, useState, PointerEvent } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

/**
 * SignaturePad
 * ------------
 * Plain canvas signature capture — no library dependency. Uses Pointer
 * Events so the same code handles mouse, touch, and stylus input, which
 * matters here since delivery confirmation usually happens on a courier's
 * phone screen where the recipient signs with a finger.
 */
export function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }

  function pointerPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#002062';
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasStroke) setHasStroke(true);
  }

  function handlePointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    emitChange();
  }

  function emitChange() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(hasStroke || drawing.current ? canvas.toDataURL('image/png') : null);
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange(null);
  }

  return (
    <div>
      <div className="relative rounded-md border border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="h-40 w-full touch-none rounded-md"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasStroke && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Sign here
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 hover:text-jkoms-navy"
      >
        <Eraser className="h-3 w-3" /> Clear
      </button>
    </div>
  );
}
