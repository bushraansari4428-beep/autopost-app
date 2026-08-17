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

  const navItems = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Sources', href: '/dashboard/sources' },
    { name: 'Facebook Pages', href: '/dashboard/pages' },
    { name: 'Mappings', href: '/dashboard/mappings' },
    { name: 'Upload to Cloud', href: '/dashboard/upload' },
    { name: 'Upload History', href: '/dashboard/history' },
  ];

  const adminItems = [
    { name: 'Users', href: '/dashboard/users' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between overflow-hidden shrink-0 shadow-lg z-20">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo Container */}
          <div className="w-full h-28 mb-3 border-b border-gray-800 flex items-center justify-center bg-[#05070c] px-4 overflow-hidden shrink-0">
            <Link href="/dashboard" className="w-full h-full flex items-center justify-center focus:outline-none">
              <img 
                src="/logo.png" 
                alt="AutoPost by NOOR Ali" 
                className="w-full h-full max-w-[240px] object-contain transform scale-[1.5] drop-shadow-lg transition-transform duration-200 hover:scale-[1.55]" 
              />
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-4 py-2.5 rounded-xl font-bold tracking-wide transition-colors duration-150 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}

            {role === 'ADMIN' && (
              <div className="pt-3 mt-3 border-t border-gray-800/80 space-y-1.5">
                {adminItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2.5 rounded-xl font-bold tracking-wide transition-colors duration-150 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Profile and Logout Section */}
        <div className="p-4 border-t border-gray-800 shrink-0 space-y-2">
          <Link 
            href="/dashboard/profile"
            className={`block w-full px-4 py-2.5 rounded-xl font-bold tracking-wide transition-colors text-left ${
              pathname === '/dashboard/profile'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/20'
                : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
            }`}
          >
            My Profile
          </Link>
          <Link 
            href="/" 
            onClick={() => localStorage.removeItem('token')}
            className="block w-full px-4 py-2.5 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 font-bold tracking-wide transition-colors text-left"
          >
            Logout
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
