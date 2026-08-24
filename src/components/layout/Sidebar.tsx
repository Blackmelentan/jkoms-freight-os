import { NavLink } from 'react-router-dom';
import { LayoutDashboard, PackagePlus, ScanLine, BarChart3, Truck, Printer, ShieldCheck, MapPinned, FileText, ClipboardList } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { UserRole } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'warehouse', 'courier', 'client'] },
  { to: '/bookings', label: 'Bookings', icon: ClipboardList, roles: ['admin', 'warehouse', 'client'] },
  { to: '/packages/new', label: 'New Package', icon: PackagePlus, roles: ['admin', 'warehouse'] },
  { to: '/labels', label: 'Print Labels', icon: Printer, roles: ['admin', 'warehouse'] },
  { to: '/scan', label: 'Scan', icon: ScanLine, roles: ['admin', 'warehouse', 'courier'] },
  { to: '/shipments', label: 'Shipments', icon: Truck, roles: ['admin', 'warehouse', 'courier', 'client'] },
  { to: '/lockers', label: 'Lockers', icon: MapPinned, roles: ['admin', 'warehouse'] },
  { to: '/manifests', label: 'Manifests', icon: FileText, roles: ['admin', 'warehouse'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'warehouse'] },
  { to: '/accounts', label: 'Accounts', icon: ShieldCheck, roles: ['admin'] }
];

export function Sidebar() {
  const role = useAuthStore((s) => s.profile?.role ?? 'client');
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
      <ul className="flex flex-col gap-1 p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-jkoms-navy text-white'
                    : 'text-slate-600 hover:bg-jkoms-navy/5 hover:text-jkoms-navy'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
