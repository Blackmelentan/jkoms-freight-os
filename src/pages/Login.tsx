import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

export function Login() {
  const { session, signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Brand panel — mirrors the dark-background primary lockup from the identity guide */}
      <div className="relative hidden items-center justify-center overflow-hidden bg-jkoms-navyDark md:flex">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(79,121,167,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(79,121,167,0.4) 1px, transparent 1px)',
            backgroundSize: '32px 32px'
          }}
        />
        <div className="relative z-10 flex flex-col items-center gap-6 px-10 text-center">
          <img
            src="/assets/logo/logo-dark-background.png"
            alt="JKOMS Global Ltd"
            className="w-full max-w-sm"
          />
          <p className="max-w-xs text-sm text-jkoms-silver/80">
            Freight and logistics operations warehouse, courier, and depot workflows in one system.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white px-6 py-16">
        <div className="w-full max-w-sm">
          <img
            src="/assets/logo/logo-horizontal-full-color.png"
            alt="JKOMS Global Ltd"
            className="mb-8 h-10 w-auto md:hidden"
          />
          <h1 className="mb-1 text-2xl font-display text-jkoms-navy">Sign in</h1>
          <p className="mb-8 text-sm text-slate-500">Access the freight operations console.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
                placeholder="you@jkomsglobal.com"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-jkoms-navy focus:outline-none focus:ring-1 focus:ring-jkoms-navy"
                placeholder="••••••••"
              />
            </label>

            {error && <p className="text-sm text-status-exception">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary mt-2 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400">
            Accounts are provisioned by your depot administrator. Contact your admin if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
