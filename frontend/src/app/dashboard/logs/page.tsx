'use client';
import { useState } from 'react';

export default function LogsPage() {
  const [logs, setLogs] = useState([
    { id: '1', level: 'INFO', message: 'Monitoring job started for Source ID: 1', time: '14:35:01' },
    { id: '2', level: 'WARN', message: 'Rate limit approaching for Facebook Page ID: 1029', time: '14:32:15' },
    { id: '3', level: 'ERROR', message: 'Failed to download video from YouTube', time: '14:30:00' },
  ]);

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
        </div>
        <div className="p-6 flex-1 overflow-y-auto space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex gap-4">
              <span className="text-gray-500 shrink-0">[{log.time}]</span>
              <span className={`shrink-0 font-bold ${
                log.level === 'INFO' ? 'text-blue-400' :
                log.level === 'WARN' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                [{log.level}]
              </span>
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
          <div className="flex gap-4 animate-pulse">
            <span className="text-gray-600">[Waiting...]</span>
          </div>
        </div>
      </div>
    </div>
  );
}
