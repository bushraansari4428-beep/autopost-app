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
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between overflow-hidden shrink-0">
        <div>
          <div className="w-full h-28 mb-4 border-b border-gray-800 flex items-center justify-center bg-[#06080d] px-2">
            <Link href="/dashboard" className="w-full h-full flex items-center justify-center focus:outline-none">
              <img src="/logo.png" alt="AutoPost by NOOR Ali" className="w-full h-full max-w-[240px] object-contain drop-shadow-lg transition-transform duration-200 hover:scale-[1.03]" />
            </Link>
          </div>
          <nav className="space-y-2 px-5">
            <Link href="/dashboard" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Dashboard</Link>
            <Link href="/dashboard/sources" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Sources</Link>
            <Link href="/dashboard/pages" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Facebook Pages</Link>
            <Link href="/dashboard/mappings" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Mappings</Link>
            <Link href="/dashboard/history" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Upload History</Link>
            {role === 'ADMIN' && (
              <>
                <Link href="/dashboard/logs" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Logs</Link>
                <Link href="/dashboard/users" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Users</Link>
                <Link href="/dashboard/settings" className="block px-4 py-3 rounded-xl hover:bg-gray-800 text-gray-400 hover:text-white transition-colors font-medium">Settings</Link>
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
