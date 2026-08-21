import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { generateTrackingCode } from '@/utils/trackingCode';
import { useAuthStore } from '@/store/authStore';
import type { Depot } from '@/types';
import { Loader2, Printer } from 'lucide-react';

interface FormState {
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  origin_depot_id: string;
  destination_depot_id: string;
  weight_kg: string;
  declared_value: string;
  service_level: 'standard' | 'express' | 'same_day';
  notes: string;
}

const EMPTY_FORM: FormState = {
  sender_name: '',
  sender_phone: '',
  sender_address: '',
  recipient_name: '',
  recipient_phone: '',
  recipient_address: '',
  origin_depot_id: '',
  destination_depot_id: '',
  weight_kg: '',
  declared_value: '',
  service_level: 'standard',
  notes: ''
};

export function PackageCreate() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [draftCode, setDraftCode] = useState(generateTrackingCode());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from('depots').select('*').then(({ data }) => setDepots((data as Depot[]) ?? []));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('packages')
      .insert({
        tracking_code: draftCode,
        qr_payload: draftCode,
        status: 'created',
        sender_name: form.sender_name,
        sender_phone: form.sender_phone || null,
        sender_address: form.sender_address,
        recipient_name: form.recipient_name,
        recipient_phone: form.recipient_phone,
        recipient_address: form.recipient_address,
        origin_depot_id: form.origin_depot_id || null,
        destination_depot_id: form.destination_depot_id || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        declared_value: form.declared_value ? Number(form.declared_value) : null,
        service_level: form.service_level,
        notes: form.notes || null,
        created_by: profile.id
      })
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      // Unique violation on tracking_code (rare race) — regenerate and let the user retry.
      if (insertError.code === '23505') {
        setDraftCode(generateTrackingCode());
        setError('That tracking code was just taken — a new one has been generated. Please submit again.');
      } else {
        setError(insertError.message);
      }
      return;
    }

    // Straight to the label print screen with this package pre-selected.
    navigate('/labels', { state: { justCreatedId: data.id } });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
      <h1 className="mb-1 text-xl font-display text-jkoms-navy">New Package</h1>
      <p className="mb-6 text-sm text-slate-500">
        Tracking code <span className="font-mono text-jkoms-navy">{draftCode}</span> will be assigned on save.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        <form onSubmit={handleSubmit} className="panel flex flex-col gap-6 p-5">
          <Section title="Sender">
            <Field label="Name" value={form.sender_name} onChange={(v) => update('sender_name', v)} required />
            <Field label="Phone" value={form.sender_phone} onChange={(v) => update('sender_phone', v)} />
            <Field
              label="Address"
              value={form.sender_address}
              onChange={(v) => update('sender_address', v)}
              required
              full
              textarea
            />
          </Section>

          <Section title="Recipient">
            <Field label="Name" value={form.recipient_name} onChange={(v) => update('recipient_name', v)} required />
            <Field label="Phone" value={form.recipient_phone} onChange={(v) => update('recipient_phone', v)} required />
            <Field
              label="Address"
              value={form.recipient_address}
              onChange={(v) => update('recipient_address', v)}
              required
              full
              textarea
            />
          </Section>

          <Section title="Routing & Service">
            <SelectField
              label="Origin Depot"
              value={form.origin_depot_id}
              onChange={(v) => update('origin_depot_id', v)}
              options={depots.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            />
            <SelectField
              label="Destination Depot"
              value={form.destination_depot_id}
              onChange={(v) => update('destination_depot_id', v)}
              options={depots.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
            />
            <SelectField
              label="Service Level"
              value={form.service_level}
              onChange={(v) => update('service_level', v as FormState['service_level'])}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'express', label: 'Express' },
                { value: 'same_day', label: 'Same Day' }
              ]}
            />
            <Field label="Weight (kg)" type="number" value={form.weight_kg} onChange={(v) => update('weight_kg', v)} />
            <Field
              label="Declared Value"
              type="number"
              value={form.declared_value}
              onChange={(v) => update('declared_value', v)}
            />
            <Field label="Notes" value={form.notes} onChange={(v) => update('notes', v)} full textarea />
          </Section>

          {error && <p className="text-sm text-status-exception">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Printer className="h-4 w-4" />
            Save & Continue to Label
          </button>
        </form>

        <div className="panel flex h-fit flex-col items-center gap-3 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">QR Preview</p>
          <div className="rounded-md border border-slate-200 p-3">
            <QRCodeSVG value={draftCode} size={160} fgColor="#002062" level="M" includeMargin />
          </div>
          <p className="font-mono text-sm text-jkoms-navy">{draftCode}</p>
          <p className="text-center text-xs text-slate-400">
            Final label is generated on the Print Labels screen after saving.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="col-span-full mb-1 text-sm font-semibold text-jkoms-navy">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  full,
  textarea,
  type = 'text'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  full?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-medium text-slate-700 ${full ? 'sm:col-span-2' : ''}`}>
      {label}
      {required && <span className="text-status-exception">*</span>}
      {textarea ? (
        <textarea
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
        />
      )}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
