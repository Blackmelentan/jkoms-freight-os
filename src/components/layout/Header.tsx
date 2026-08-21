import { LogOut, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

export function Header() {
  const { profile, signOut } = useAuthStore();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <img
          src="/assets/logo/logo-horizontal-full-color.png"
          alt="JKOMS Global Ltd"
          className="h-9 w-auto"
        />
        <span className="hidden rounded bg-jkoms-navy/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-jkoms-navy/70 sm:inline">
          Freight OS
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-1.5 text-xs font-medium ${
            online ? 'text-status-delivered' : 'text-status-exception'
          }`}
          title={online ? 'Connected' : 'Offline — scans will queue locally'}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
        </div>

        {profile && (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-jkoms-navy">{profile.full_name}</p>
            <p className="text-xs capitalize text-slate-500">{profile.role}</p>
          </div>
        )}

        <button
          onClick={() => void signOut()}
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-jkoms-navy"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
