import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Check, X, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { generateTrackingCode } from '@/utils/trackingCode';
import type { Booking, BookingStatus } from '@/types';
import { BOOKING_STATUS_LABEL } from '@/types';

const SERVICE_TYPES = ['Ocean Freight', 'Air Cargo', 'RORO (Vehicle)', 'Door to Door', 'Locker Consolidation'];

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending_review: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-jkoms-steel/10 text-jkoms-steel',
  converted: 'bg-status-delivered/10 text-status-delivered',
  declined: 'bg-status-exception/10 text-status-exception'
};

/**
 * Bookings
 * --------
 * The intake stage before a package exists. Clients submit a request here
 * (service type, destination, rough date); staff review and confirm/decline
 * before it becomes an actual tracked package. Same page serves both roles
 * the view just changes based on who's looking.
 */
export function Bookings() {
  const profile = useAuthStore((s) => s.profile);
  const isStaff = profile?.role === 'admin' || profile?.role === 'warehouse';
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('bookings-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, []);

  async function load() {
    const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(booking: Booking, status: BookingStatus) {
    await supabase
      .from('bookings')
      .update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq('id', booking.id);
    void load();
  }

  function convertToPackage(booking: Booking) {
    // Hands off to the existing New Package form, pre-filled from the
    // booking staff still fill in the actual address/weight details that
    // a booking request doesn't capture, but don't retype the basics.
    navigate('/packages/new', {
      state: {
        fromBooking: {
          id: booking.id,
          sender_name: booking.requester_name,
          sender_phone: booking.requester_phone,
          notes: `From booking ${booking.booking_ref}: ${booking.service_type} to ${booking.destination}. ${booking.notes ?? ''}`.trim()
        }
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Bookings</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        {isStaff ? 'Shipment requests awaiting review.' : 'Request a shipment — we\'ll confirm before it\'s booked in.'}
      </p>

      {!showForm && (
        <button onClick={() => setShowForm(true)} className="btn-primary mb-6 flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Booking Request
        </button>
      )}

      {showForm && (
        <BookingForm
          clientId={profile?.role === 'client' ? profile.id : null}
          defaultName={profile?.full_name}
          defaultPhone={profile?.phone}
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Ref</th>
                <th className="px-5 py-3 font-medium">Requester</th>
                <th className="px-5 py-3 font-medium">Service</th>
                <th className="px-5 py-3 font-medium">Destination</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isStaff && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {bookings
                .filter((b) => isStaff || b.client_id === profile?.id)
                .map((b) => (
                  <tr key={b.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-mono text-jkoms-navy">{b.booking_ref}</td>
                    <td className="px-5 py-3 text-slate-600">{b.requester_name}</td>
                    <td className="px-5 py-3 text-slate-600">{b.service_type}</td>
                    <td className="px-5 py-3 text-slate-600">{b.destination}</td>
                    <td className="px-5 py-3">
                      <span className={`status-pill ${STATUS_STYLE[b.status]}`}>{BOOKING_STATUS_LABEL[b.status]}</span>
                    </td>
                    {isStaff && (
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {b.status === 'pending_review' && (
                            <>
                              <button onClick={() => void updateStatus(b, 'confirmed')} className="text-status-delivered hover:underline" title="Confirm">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => void updateStatus(b, 'declined')} className="text-status-exception hover:underline" title="Decline">
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <button onClick={() => convertToPackage(b)} className="flex items-center gap-1 text-xs font-medium text-jkoms-steel hover:underline">
                              Convert to Package <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              {!loading && bookings.length === 0 && (
                <tr>
                  <td colSpan={isStaff ? 6 : 5} className="px-5 py-10 text-center text-slate-400">
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BookingForm({
  clientId,
  defaultName,
  defaultPhone,
  onCancel,
  onCreated
}: {
  clientId: string | null;
  defaultName?: string;
  defaultPhone?: string | null;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(defaultName ?? '');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [email, setEmail] = useState('');
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [destination, setDestination] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name || !destination) {
      setError('Name and destination are required.');
      return;
    }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('bookings').insert({
      booking_ref: generateTrackingCode('BK'),
      client_id: clientId,
      requester_name: name,
      requester_phone: phone || null,
      requester_email: email || null,
      service_type: serviceType,
      destination,
      preferred_date: preferredDate || null,
      notes: notes || null
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="panel mb-6 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Phone
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Service Type
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Destination
        <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Banjul, The Gambia" className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Preferred Date
        <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      {error && <p className="text-sm text-status-exception sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button onClick={() => void handleSubmit()} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit Request
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </div>
  );
}
