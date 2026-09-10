import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Loader2, Check, UserPlus, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import type { Profile, UserRole, Depot } from '@/types';

const ROLES: UserRole[] = ['admin', 'warehouse', 'courier', 'client'];

/**
 * AdminUsers
 * ----------
 * Role/account management for admins. Two important constraints baked in:
 *
 * 1. The Supabase anon key (what this app ships with) can never create auth
 *    users directly that requires the service_role key, which must never
 *    reach the browser. So "adding" a user here is a two-step handoff: the
 *    admin creates the login in Supabase Auth (dashboard), then comes back
 *    here to set that person's role/name/phone against the profile row that
 *    gets auto-created by the on_auth_user_created trigger.
 * 2. Editing an EXISTING user's role/details, though, works entirely in-app
 *    via the profiles_admin_update_all RLS policy that's the main thing
 *    this screen is for day to day.
 */
export function AdminUsers() {
  const myRole = useAuthStore((s) => s.profile?.role);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (myRole === 'admin') void load();
  }, [myRole]);

  if (myRole && myRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  async function load() {
    setLoading(true);
    const [{ data: profileData }, { data: depotData }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('depots').select('*')
    ]);
    setProfiles((profileData as Profile[]) ?? []);
    setDepots((depotData as Depot[]) ?? []);
    setLoading(false);
  }

  async function updateProfile(id: string, patch: Partial<Profile>) {
    setSavingId(id);
    const { error } = await supabase.from('profiles').update(patch).eq('id', id);
    setSavingId(null);
    if (!error) {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      setSavedId(id);
      setTimeout(() => setSavedId(null), 1200);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:px-6">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-jkoms-navy" />
        <h1 className="text-xl font-display text-jkoms-navy">Accounts & Roles</h1>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Manage what each signed-in account can see and do. New logins are created in Supabase, then
        cleared for access here.
      </p>

      <NewAccountInstructions />

      <div className="panel mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Client Code</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Depot</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="w-8 px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    <input
                      defaultValue={p.full_name}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== p.full_name) void updateProfile(p.id, { full_name: v });
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-jkoms-navy focus:outline-none"
                      placeholder="Unnamed"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={p.role}
                      onChange={(e) => void updateProfile(p.id, { role: e.target.value as UserRole })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-sm capitalize focus:border-jkoms-navy focus:outline-none"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-jkoms-steel">{p.client_code ?? '—'}</td>
                  <td className="px-5 py-3">
                    <input
                      defaultValue={p.phone ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value || null;
                        if (v !== p.phone) void updateProfile(p.id, { phone: v });
                      }}
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-jkoms-navy focus:outline-none"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={p.depot_id ?? ''}
                      onChange={(e) => void updateProfile(p.id, { depot_id: e.target.value || null })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-sm focus:border-jkoms-navy focus:outline-none"
                    >
                      <option value="">—</option>
                      {depots.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {savingId === p.id && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                    {savedId === p.id && <Check className="h-4 w-4 text-status-delivered" />}
                  </td>
                </tr>
              ))}
              {!loading && profiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No accounts found.
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

function NewAccountInstructions() {
  const [copied, setCopied] = useState(false);
  const sql = `After creating the login in Supabase Auth, set their role here:
update profiles set role = 'warehouse', full_name = 'Full Name'
where id = 'paste-the-user-uuid-here';`;

  return (
    <div className="rounded-md border border-dashed border-jkoms-steel/40 bg-jkoms-steel/5 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-jkoms-navy">
        <UserPlus className="h-4 w-4" /> Adding a new account
      </p>
      <ol className="list-inside list-decimal space-y-1 text-sm text-slate-600">
        <li>Supabase Dashboard → Authentication → Users → Add user (set email + password)</li>
        <li>Copy their User UID from that same screen</li>
        <li>They'll appear in the table below automatically just set their role there</li>
      </ol>
      <p className="mt-3 text-xs text-slate-400">
        Or run this directly in the SQL Editor right after creating the login:
      </p>
      <div className="mt-1 flex items-start gap-2 rounded bg-slate-900 p-3">
        <pre className="flex-1 overflow-x-auto text-xs text-slate-100">{sql}</pre>
        <button
          onClick={() => {
            navigator.clipboard.writeText(sql);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
