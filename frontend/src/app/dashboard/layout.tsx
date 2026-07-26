'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState('USER');
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
    } catch (e) {
      console.error('Failed to parse token or apply theme', e);
      window.location.replace('/login');
    }
  }, []);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊', description: 'Command Center' },
    { name: 'Sources', href: '/dashboard/sources', icon: '📺', description: 'Video Platforms' },
    { name: 'Facebook Pages', href: '/dashboard/pages', icon: '📘', description: 'Linked Profiles' },
    { name: 'Mappings', href: '/dashboard/mappings', icon: '🔄', description: 'Auto Sync Rules' },
    { name: 'Upload History', href: '/dashboard/history', icon: '⏱️', description: 'Publish Log' },
  ];

  const adminItems = [
    { name: 'Logs', href: '/dashboard/logs', icon: '🛰️', description: 'System Diagnostics' },
    { name: 'Users', href: '/dashboard/users', icon: '👥', description: 'Client Management' },
    { name: 'Settings', href: '/dashboard/settings', icon: '⚙️', description: 'Engine Config' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800/80 flex flex-col justify-between overflow-hidden shrink-0 shadow-2xl z-20">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Container */}
          <div className="w-full h-28 mb-2 border-b border-gray-800/80 flex items-center justify-center bg-[#05070c] px-4 overflow-hidden shrink-0 shadow-inner">
            <Link href="/dashboard" className="w-full h-full flex items-center justify-center focus:outline-none group">
              <img 
                src="/logo.png" 
                alt="AutoPost by NOOR Ali" 
                className="w-full h-full max-w-[240px] object-contain transform scale-[1.5] drop-shadow-2xl transition-transform duration-300 group-hover:scale-[1.55]" 
              />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-2 custom-scrollbar">
            <div className="space-y-1.5">
              <p className="px-3 text-[11px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 opacity-80">
                Core Modules
              </p>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-bold tracking-wide transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white font-extrabold shadow-lg shadow-blue-500/30 border-l-4 border-cyan-400 scale-[1.02]'
                        : 'bg-gray-950/30 hover:bg-gradient-to-r hover:from-gray-800/90 hover:to-gray-800/40 text-gray-200 hover:text-white border border-gray-800/50 hover:border-gray-700 hover:border-l-4 hover:border-l-blue-500 hover:shadow-md'
                    }`}
                  >
                    <span className="text-xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200 shrink-0">
                      {item.icon}
                    </span>
                    <div className="flex flex-col truncate">
                      <span className="leading-tight">{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {role === 'ADMIN' && (
              <div className="pt-5 space-y-1.5 border-t border-gray-800/60 mt-4">
                <p className="px-3 text-[11px] font-extrabold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <span>👑 Admin Console</span>
                </p>
                {adminItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-[15px] font-bold tracking-wide transition-all duration-200 group ${
                        isActive
                          ? 'bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 text-white font-extrabold shadow-lg shadow-purple-500/30 border-l-4 border-pink-400 scale-[1.02]'
                          : 'bg-gray-950/30 hover:bg-gradient-to-r hover:from-gray-800/90 hover:to-gray-800/40 text-gray-200 hover:text-white border border-gray-800/50 hover:border-gray-700 hover:border-l-4 hover:border-l-purple-500 hover:shadow-md'
                      }`}
                    >
                      <span className="text-xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200 shrink-0">
                        {item.icon}
                      </span>
                      <div className="flex flex-col truncate">
                        <span className="leading-tight">{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Logout Section */}
        <div className="p-4 border-t border-gray-800/80 bg-[#070a12]/80 shrink-0">
          <Link 
            href="/" 
            onClick={() => localStorage.removeItem('token')}
            className="flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 font-extrabold text-[15px] tracking-wide transition-all duration-200 shadow-sm hover:shadow-red-500/10 group"
          >
            <span className="text-lg group-hover:-translate-x-1 transition-transform">🔒</span>
            <span>Secure Logout</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 custom-scrollbar">
        {children}
      </main>
    </div>
  );
}
