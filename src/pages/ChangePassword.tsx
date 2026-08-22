import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, KeyRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

/**
 * ChangePassword
 * --------------
 * Shown once, forced, whenever profiles.must_change_password is true — the
 * normal state for any account an admin hand-creates with a temporary
 * password (the standard path here, since self-signup is off and password
 * reset emails are unreliable on the default Supabase sender). Clears the
 * flag on success so this never shows again for that account.
 */
export function ChangePassword() {
  const profile = useAuthStore((s) => s.profile);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (profile && !profile.must_change_password) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setSaving(false);
      setError(authError.message);
      return;
    }

    if (profile) {
      await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile.id);
    }
    setSaving(false);
    setDone(true);
    setTimeout(() => window.location.replace('/'), 800);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-jkoms-navy" />
          <h1 className="text-xl font-display text-jkoms-navy">Set a new password</h1>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          This account was created with a temporary password. Set your own before continuing.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Confirm password
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
            />
          </label>

          {error && <p className="text-sm text-status-exception">{error}</p>}
          {done && <p className="text-sm text-status-delivered">Password updated — redirecting…</p>}

          <button type="submit" disabled={saving || done} className="btn-primary flex items-center justify-center gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Set password & continue
          </button>
        </form>
      </div>
    </div>
  );
}
