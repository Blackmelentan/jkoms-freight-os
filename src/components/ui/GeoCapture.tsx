import { useState } from 'react';
import { MapPin, Loader2, CheckCircle2 } from 'lucide-react';

interface GeoCaptureProps {
  lat: number | null;
  lng: number | null;
  onCapture: (lat: number, lng: number) => void;
  label?: string;
}

/**
 * GeoCapture
 * ----------
 * Many addresses in the network (rural Gambia, parts of Scotland) don't
 * have formal street numbers a courier can search for. This captures the
 * device's actual GPS coordinates at the moment someone is standing at the
 * location — most useful when the client fills this in themselves at home,
 * or a courier pins it on the doorstep during a successful first delivery.
 * Stored alongside (never instead of) the free-text address.
 */
export function GeoCapture({ lat, lng, onCapture, label = 'Pin exact location' }: GeoCaptureProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function capture() {
    if (!navigator.geolocation) {
      setError('Location services are not available on this device.');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        onCapture(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLoading(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — enable it in your browser settings to pin this address.'
            : 'Could not get your location. Try again outdoors or with a clearer signal.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const hasCoords = lat !== null && lng !== null;

  return (
    <div>
      <button
        type="button"
        onClick={capture}
        disabled={loading}
        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition ${
          hasCoords
            ? 'border-status-delivered/30 bg-status-delivered/5 text-status-delivered'
            : 'border-slate-300 text-slate-600 hover:border-jkoms-navy hover:text-jkoms-navy'
        }`}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : hasCoords ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <MapPin className="h-3.5 w-3.5" />
        )}
        {hasCoords ? `Pinned (${lat!.toFixed(5)}, ${lng!.toFixed(5)})` : label}
      </button>
      {error && <p className="mt-1 text-xs text-status-exception">{error}</p>}
    </div>
  );
}
