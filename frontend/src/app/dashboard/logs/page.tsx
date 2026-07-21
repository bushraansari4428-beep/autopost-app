'use client';
import { useState, useEffect } from 'react';

interface SystemLog {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Logs</h1>
        <p className="text-gray-400 mt-1">Live monitoring and debug information from background workers.</p>
      </div>

      <div className="flex-1 bg-[#0A0A0A] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-mono text-sm">
        <div className="bg-gray-900/80 px-4 py-3 border-b border-gray-800 flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs text-green-500 font-bold">LIVE</span>
          </div>
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-2">
          {loading && logs.length === 0 ? (
            <div className="text-gray-500">Loading live logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500">No system logs recorded yet.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-4">
                <span className="text-gray-500 shrink-0">[{new Date(log.createdAt).toLocaleTimeString()}]</span>
                <span className={`shrink-0 font-bold ${
                  log.level === 'INFO' ? 'text-blue-400' :
                  log.level === 'WARN' ? 'text-yellow-400' : 'text-red-400'
                }`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300">{log.message}</span>
              </div>
            ))
          )}
          <div className="flex gap-4 animate-pulse mt-4">
            <span className="text-gray-600">[Waiting for new events...]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
