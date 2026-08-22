// supabase/functions/notify-status-change/index.ts
//
// Triggered by a Database Webhook on INSERT into scan_events (set up in the
// Supabase Dashboard — see the README section "Setting up notifications").
// Looks up the parent package, texts the recipient their new status via
// Africa's Talking (better Gambia/West Africa coverage and rates than
// Twilio, which is why it's the default here — swap the fetch call if you'd
// rather use Twilio or WhatsApp Business API).
//
// Required secrets (set via `supabase secrets set`):
//   AFRICASTALKING_USERNAME
//   AFRICASTALKING_API_KEY
//   AFRICASTALKING_SENDER_ID   (optional — omit to use the shared shortcode)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATUS_MESSAGES: Record<string, string> = {
  label_printed: 'has been labeled and is ready for pickup',
  picked_up: 'has been picked up by your courier',
  in_transit: 'is now in transit',
  at_depot: 'has arrived at a depot',
  out_for_delivery: 'is out for delivery',
  delivered: 'has been delivered',
  delivery_failed: 'delivery attempt failed — we will retry',
  returned: 'is being returned to sender',
  exception: 'has an exception — our team is on it'
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    // Database Webhook payload shape: { type: 'INSERT', table, record, ... }
    const record = payload.record;
    if (!record?.package_id || !record?.status) {
      return new Response('ignored: missing package_id/status', { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // service role — this runs server-side only
    );

    const { data: pkg, error } = await supabase
      .from('packages')
      .select('tracking_code, recipient_name, recipient_phone')
      .eq('id', record.package_id)
      .single();

    if (error || !pkg?.recipient_phone) {
      return new Response('no recipient phone on file', { status: 200 });
    }

    const phrase = STATUS_MESSAGES[record.status] ?? `status updated to ${record.status}`;
    const message = `JKOMS Global: Your shipment ${pkg.tracking_code} ${phrase}.`;

    const username = Deno.env.get('AFRICASTALKING_USERNAME');
    const apiKey = Deno.env.get('AFRICASTALKING_API_KEY');
    const senderId = Deno.env.get('AFRICASTALKING_SENDER_ID');

    if (!username || !apiKey) {
      return new Response('SMS provider not configured — skipped', { status: 200 });
    }

    const form = new URLSearchParams({
      username,
      to: pkg.recipient_phone,
      message,
      ...(senderId ? { from: senderId } : {})
    });

    const smsResponse = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: form.toString()
    });

    if (!smsResponse.ok) {
      const text = await smsResponse.text();
      return new Response(`SMS send failed: ${text}`, { status: 502 });
    }

    return new Response('sent', { status: 200 });
  } catch (err) {
    return new Response(`error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
});
