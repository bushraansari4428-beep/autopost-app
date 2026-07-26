'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [role, setRole] = useState('USER');

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        // Decode JWT token payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.role) {
          setRole(payload.role);
        }
      }
    } catch (e) {
      console.error('Failed to parse token');
    }
  }, []);

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between overflow-hidden">
        <div>
          <div className="pt-5 pb-5 px-3 mb-6 border-b border-gray-800/80 flex items-center justify-center overflow-hidden bg-gray-950/40">
            <Link href="/dashboard" className="w-full flex items-center justify-center focus:outline-none">
              <img src="/logo.png" alt="AutoPost by NOOR Ali" className="w-full h-20 object-contain transform sm:scale-[1.35] hover:scale-[1.40] transition-transform drop-shadow-lg" />
            </Link>
          </div>
          <nav className="space-y-2 px-5">
            <Link href="/dashboard" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/dashboard/sources" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Sources</Link>
            <Link href="/dashboard/pages" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Facebook Pages</Link>
            <Link href="/dashboard/mappings" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Mappings</Link>
            <Link href="/dashboard/history" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Upload History</Link>
            {role === 'ADMIN' && (
              <>
                <Link href="/dashboard/logs" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Logs</Link>
                <Link href="/dashboard/users" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Users</Link>
                <Link href="/dashboard/settings" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">Settings</Link>
              </>
            )}
          </nav>
        </div>
        <div className="p-5 border-t border-gray-800 mt-4">
          <Link href="/" className="block px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors font-medium" onClick={() => localStorage.removeItem('token')}>Logout</Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 bg-gradient-to-br from-gray-950 to-gray-900">
        {children}
      </main>
    </div>
  );
}
