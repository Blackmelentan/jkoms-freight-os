import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { PackageCreate } from '@/pages/PackageCreate';
import { LabelPrint } from '@/pages/LabelPrint';
import { ScanPage } from '@/pages/ScanPage';
import { Shipments } from '@/pages/Shipments';
import { ShipmentDetail } from '@/pages/ShipmentDetail';
import { Analytics } from '@/pages/Analytics';
import { AdminUsers } from '@/pages/AdminUsers';

function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Loading…</div>
    );
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <AuthedLayout>{children}</AuthedLayout>;
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/packages/new" element={<RequireAuth><PackageCreate /></RequireAuth>} />
      <Route path="/labels" element={<RequireAuth><LabelPrint /></RequireAuth>} />
      <Route path="/scan" element={<RequireAuth><ScanPage /></RequireAuth>} />
      <Route path="/shipments" element={<RequireAuth><Shipments /></RequireAuth>} />
      <Route path="/shipments/:id" element={<RequireAuth><ShipmentDetail /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
      <Route path="/accounts" element={<RequireAuth><AdminUsers /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
