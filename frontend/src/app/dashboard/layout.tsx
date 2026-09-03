'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Globe, 
  Workflow, 
  CloudUpload, 
  History, 
  Users, 
  Settings, 
  User, 
  LogOut,
  Sparkles,
  Bell
} from 'lucide-react';
import NotificationDrawer, { AlertItem } from '@/components/NotificationDrawer';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState('USER');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.replace('/login');
        return;
      }
      // Decode JWT token payload (base64)
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload && payload.role) {
        setRole(payload.role);
      }

      // Initialize App Theme from localStorage
      const savedTheme = localStorage.getItem('app_theme');
      if (savedTheme === 'day') {
        document.body.classList.add('day-mode');
      } else {
        document.body.classList.remove('day-mode');
      }

      // Global Fetch Interceptor for Auto-Logout when user is deleted/expires
      const originalFetch = window.fetch;
      window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.replace('/login');
        }
        return response;
      };

      return () => {
        window.fetch = originalFetch;
      };
    } catch (e) {
      console.error('Failed to parse token or apply theme', e);
      window.location.replace('/login');
    }
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = async (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ alertId })
      });
    } catch (_) {}
  };

  const handleDismissAll = async () => {
    const ids = alerts.map(a => a.id);
    setAlerts([]);
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ alertIds: ids })
      });
    } catch (_) {}
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Sources', href: '/dashboard/sources', icon: Layers },
    { name: 'Facebook Pages', href: '/dashboard/pages', icon: Globe },
    { name: 'Mappings', href: '/dashboard/mappings', icon: Workflow },
    { name: 'Upload to Cloud', href: '/dashboard/upload', icon: CloudUpload },
    { name: 'Upload History', href: '/dashboard/history', icon: History },
  ];

  const adminItems = [
    { name: 'Users', href: '/dashboard/users', icon: Users },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Ultra-Modern HD Sidebar */}
      <aside className="w-64 bg-slate-900/95 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col justify-between overflow-hidden shrink-0 shadow-2xl z-20">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Container (Enlarged to fit perfectly) */}
          <div className="w-full h-28 mb-2 border-b border-slate-800/80 flex items-center justify-center bg-slate-950/90 px-3 overflow-hidden shrink-0">
            <Link href="/dashboard" className="w-full h-full flex items-center justify-center focus:outline-none">
              <img 
                src="/logo.png" 
                alt="AutoPost by NOOR Ali" 
                className="w-full h-full max-w-[245px] object-contain transform scale-[1.65] drop-shadow-lg transition-transform duration-200 hover:scale-[1.7]" 
              />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3.5 py-2 space-y-1 custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/25'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                  }`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Emergency Alerts & Mishaps Button */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className={`w-full group flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 text-left ${
                alerts.length > 0
                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  alerts.length > 0 ? 'text-red-400 animate-bounce' : 'text-slate-400 group-hover:text-red-400'
                }`} />
                <span>Alerts & Issues</span>
              </div>
              {alerts.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-black bg-red-500 text-white rounded-full animate-pulse shadow-md shadow-red-500/40">
                  {alerts.length}
                </span>
              )}
            </button>

            {role === 'ADMIN' && (
              <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1">
                <div className="px-3 pb-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Admin Controls</span>
                </div>
                {adminItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/25'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-400'
                      }`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Profile and Logout Section */}
        <div className="p-3 border-t border-slate-800/80 shrink-0 space-y-1 bg-slate-950/40">
          <Link 
            href="/dashboard/profile"
            className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
              pathname === '/dashboard/profile'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <User className={`w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                pathname === '/dashboard/profile' ? 'text-blue-400' : 'text-slate-400 group-hover:text-blue-400'
              }`} />
              <span>My Cloud Profile</span>
            </div>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wide border border-slate-700/60">
              {role}
            </span>
          </Link>

          <Link 
            href="/" 
            onClick={() => localStorage.removeItem('token')}
            className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-semibold text-sm tracking-wide transition-all duration-200"
          >
            <LogOut className="w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 text-rose-400" />
            <span>Logout</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 sm:p-10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 custom-scrollbar">
        {children}
      </main>

      {/* Emergency Notifications Drawer */}
      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        alerts={alerts}
        onDismiss={handleDismiss}
        onDismissAll={handleDismissAll}
      />
    </div>
  );
}
