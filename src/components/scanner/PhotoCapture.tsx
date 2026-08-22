import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoCaptureProps {
  onChange: (file: File | null) => void;
}

/**
 * PhotoCapture
 * ------------
 * Deliberately NOT reusing CameraScanner's live WebRTC feed here — proof-of-
 * delivery just needs one still photo, and `<input type="file" capture>`
 * opens the native camera app directly on mobile with zero extra JS, which
 * is lighter and more reliable than holding a getUserMedia stream open for
 * a single shot.
 */
export function PhotoCapture({ onChange }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handleFile(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="Delivery proof preview" className="h-32 w-32 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow-panel hover:text-status-exception"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-32 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-jkoms-navy hover:text-jkoms-navy"
        >
          <Camera className="h-6 w-6" />
          <span className="text-xs">Take photo</span>
        </button>
      )}
    </div>
  );
}
