import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ScanLine, Truck, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

/** Bottom tab bar shown on small screens — couriers mostly live in Scan + Shipments. */
export function MobileNav() {
  const role = useAuthStore((s) => s.profile?.role ?? 'client');

  const items = [
    { to: '/', label: 'Home', icon: LayoutDashboard, roles: ['admin', 'warehouse', 'courier', 'client'] },
    { to: '/scan', label: 'Scan', icon: ScanLine, roles: ['admin', 'warehouse', 'courier'] },
    { to: '/shipments', label: 'Shipments', icon: Truck, roles: ['admin', 'warehouse', 'courier', 'client'] },
    { to: '/analytics', label: 'Stats', icon: BarChart3, roles: ['admin', 'warehouse'] }
  ].filter((i) => i.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-200 bg-white md:hidden">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isActive ? 'text-jkoms-navy' : 'text-slate-400'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
