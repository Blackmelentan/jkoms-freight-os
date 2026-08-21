import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Package, ShipmentStatus } from '@/types';
import { SHIPMENT_STATUS_LABEL } from '@/types';

const STATUS_COLORS: Record<ShipmentStatus, string> = {
  created: '#C0C0C0',
  label_printed: '#C0C0C0',
  picked_up: '#4F79A7',
  in_transit: '#4F79A7',
  at_depot: '#D97706',
  out_for_delivery: '#D97706',
  delivered: '#1F8A4C',
  delivery_failed: '#C0392B',
  returned: '#B7791F',
  exception: '#C0392B'
};

export function Analytics() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from('packages')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });
    setPackages((data as Package[]) ?? []);
    setLoading(false);
  }

  const dailyVolume = buildDailyVolume(packages);
  const statusBreakdown = buildStatusBreakdown(packages);
  const serviceLevelSplit = buildServiceLevelSplit(packages);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <h1 className="mb-1 text-xl font-display text-jkoms-navy">Analytics</h1>
      <p className="mb-6 text-sm text-slate-500">Last 30 days of shipment activity.</p>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : packages.length === 0 ? (
        <p className="panel p-8 text-center text-sm text-slate-400">No shipment data in the last 30 days yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="panel p-5 lg:col-span-2">
            <p className="mb-4 text-sm font-semibold text-jkoms-navy">Created vs Delivered — Daily</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" name="Created" stroke="#002062" strokeWidth={2} dot={false} />
                <Line
                  type="monotone"
                  dataKey="delivered"
                  name="Delivered"
                  stroke="#1F8A4C"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="exceptions"
                  name="Exceptions"
                  stroke="#C0392B"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-5">
            <p className="mb-4 text-sm font-semibold text-jkoms-navy">Status Breakdown</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="count" nameKey="label" innerRadius={55} outerRadius={90}>
                  {statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="panel p-5">
            <p className="mb-4 text-sm font-semibold text-jkoms-navy">Service Level Split</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serviceLevelSplit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4F79A7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDailyVolume(packages: Package[]) {
  const map = new Map<string, { created: number; delivered: number; exceptions: number }>();
  for (const p of packages) {
    const day = new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (!map.has(day)) map.set(day, { created: 0, delivered: 0, exceptions: 0 });
    map.get(day)!.created += 1;
    if (p.status === 'delivered') map.get(day)!.delivered += 1;
    if (p.status === 'exception' || p.status === 'delivery_failed') map.get(day)!.exceptions += 1;
  }
  return Array.from(map.entries()).map(([day, v]) => ({ day, ...v }));
}

function buildStatusBreakdown(packages: Package[]) {
  const counts = new Map<ShipmentStatus, number>();
  for (const p of packages) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  return Array.from(counts.entries()).map(([status, count]) => ({
    status,
    label: SHIPMENT_STATUS_LABEL[status],
    count
  }));
}

function buildServiceLevelSplit(packages: Package[]) {
  const counts = new Map<string, number>();
  for (const p of packages) counts.set(p.service_level, (counts.get(p.service_level) ?? 0) + 1);
  return Array.from(counts.entries()).map(([level, count]) => ({
    label: level.replace('_', ' '),
    count
  }));
}
