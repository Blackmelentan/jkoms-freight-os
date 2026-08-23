import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackagePlus, ScanLine, Printer, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Package, ShipmentStatus } from '@/types';
import { StatusPill } from '@/components/ui/StatusPill';
import { useAuthStore } from '@/store/authStore';

interface Counts {
  total: number;
  inTransit: number;
  deliveredToday: number;
  exceptions: number;
}

export function Dashboard() {
  const profile = useAuthStore((s) => s.profile);
  const isStaff = profile?.role === 'admin' || profile?.role === 'warehouse';
  const isCourier = profile?.role === 'courier';
  const [recent, setRecent] = useState<Package[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, inTransit: 0, deliveredToday: 0, exceptions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();

    // Live updates: any insert/update on packages refreshes the dashboard
    // without a manual refresh — this is the "real-time database updates"
    // requirement, surfaced where warehouse staff actually look first.
    const channel = supabase
      .channel('dashboard-packages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages' }, () => {
        void loadData();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function loadData() {
    const { data: recentData } = await supabase
      .from('packages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8);

    if (recentData) setRecent(recentData as Package[]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ count: total }, { count: inTransit }, { count: deliveredToday }, { count: exceptions }] =
      await Promise.all([
        supabase.from('packages').select('*', { count: 'exact', head: true }),
        supabase
          .from('packages')
          .select('*', { count: 'exact', head: true })
          .in('status', ['in_transit', 'out_for_delivery', 'picked_up'] as ShipmentStatus[]),
        supabase
          .from('packages')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered')
          .gte('updated_at', todayStart.toISOString()),
        supabase
          .from('packages')
          .select('*', { count: 'exact', head: true })
          .in('status', ['exception', 'delivery_failed'] as ShipmentStatus[])
      ]);

    setCounts({
      total: total ?? 0,
      inTransit: inTransit ?? 0,
      deliveredToday: deliveredToday ?? 0,
      exceptions: exceptions ?? 0
    });
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-display text-jkoms-navy">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-slate-500">
            {profile?.role === 'client'
              ? 'Track your shipments below.'
              : "Here's what's moving through the network right now."}
          </p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <Link to="/packages/new" className="btn-primary flex items-center gap-2 text-sm">
              <PackagePlus className="h-4 w-4" /> New Package
            </Link>
          )}
          {(isStaff || isCourier) && (
            <Link to="/scan" className="btn-secondary flex items-center gap-2 text-sm">
              <ScanLine className="h-4 w-4" /> Scan
            </Link>
          )}
        </div>
      </div>

      {profile?.role === 'client' && profile.client_code && (
        <div className="mb-6 flex items-center justify-between rounded-md border border-jkoms-navy/15 bg-jkoms-navy/5 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Your Client Code</p>
            <p className="font-mono text-lg font-bold text-jkoms-navy">{profile.client_code}</p>
          </div>
          <p className="max-w-xs text-right text-xs text-slate-500">
            Give this to a courier or warehouse staffer to link a package to your account.
          </p>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={profile?.role === 'client' ? 'My Shipments' : 'Total Shipments'} value={counts.total} loading={loading} />
        <StatCard label="In Transit" value={counts.inTransit} loading={loading} accent="text-jkoms-steel" />
        <StatCard label="Delivered Today" value={counts.deliveredToday} loading={loading} accent="text-status-delivered" />
        <StatCard
          label="Exceptions"
          value={counts.exceptions}
          loading={loading}
          accent="text-status-exception"
          icon={counts.exceptions > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : undefined}
        />
      </div>

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-jkoms-navy">Recent Packages</h2>
          <Link to="/shipments" className="text-sm font-medium text-jkoms-steel hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Tracking Code</th>
                <th className="px-5 py-3 font-medium">Recipient</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((pkg) => (
                <tr key={pkg.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/shipments/${pkg.id}`} className="font-mono text-jkoms-navy hover:underline">
                      {pkg.tracking_code}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{pkg.recipient_name}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={pkg.status} />
                  </td>
                  <td className="px-5 py-3 text-slate-400">
                    {new Date(pkg.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!loading && recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No packages yet.{' '}
                    <Link to="/packages/new" className="text-jkoms-steel hover:underline">
                      Create the first one
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isStaff && (
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Printer className="h-3.5 w-3.5" />
          Printing labels? Head to the{' '}
          <Link to="/labels" className="text-jkoms-steel hover:underline">
            Print Labels
          </Link>{' '}
          screen for the Munbyn-formatted layout.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  accent = 'text-jkoms-navy',
  icon
}: {
  label: string;
  value: number;
  loading: boolean;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel px-4 py-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`flex items-center gap-1.5 text-2xl font-display ${accent}`}>
        {loading ? '—' : value}
        {icon}
      </p>
    </div>
  );
}
