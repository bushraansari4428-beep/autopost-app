'use client';
import { useState, useEffect } from 'react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Upload History</h1>
        <p className="text-gray-400 mt-1">Review the status of your cross-posted videos.</p>
      </div>

      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900/80 text-gray-300 uppercase font-semibold border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Video Title</th>
              <th className="px-6 py-4">Destination Page</th>
              <th className="px-6 py-4">Date & Time</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading history...</td>
              </tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-lg mb-2">No upload history yet.</p>
                  <p className="text-sm">Connect a Source and Map it to a Facebook Page to start cross-posting.</p>
                </td>
              </tr>
            ) : (
              history.map(item => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-5 font-medium text-white max-w-xs truncate">{item.video?.title || 'Unknown Video'}</td>
                  <td className="px-6 py-5">{item.facebookPageId}</td>
                  <td className="px-6 py-5">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      item.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                      item.status === 'FAILED' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                    }`}>
                      {item.status}
                    </span>
                    {item.errorMessage && <p className="text-xs text-red-400 mt-1 truncate max-w-xs">{item.errorMessage}</p>}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {item.status === 'FAILED' && (
                      <button className="text-blue-400 hover:text-blue-300 transition-colors font-medium">Retry</button>
                    )}
                    {item.status === 'COMPLETED' && (
                      <button className="text-gray-500 hover:text-gray-300 transition-colors">View Post</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
