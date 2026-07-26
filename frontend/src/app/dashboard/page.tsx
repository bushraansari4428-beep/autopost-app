'use client';
import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalSources: 0,
    connectedPages: 0,
    successfulUploads: 0,
    failedUploads: 0
  });
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resSources, resPages, resHistory] = await Promise.all([
        fetch('/api/sources', { headers }).catch(() => null),
        fetch('/api/pages', { headers }).catch(() => null),
        fetch('/api/history', { headers }).catch(() => null)
      ]);

      let sourcesCount = 0;
      if (resSources && resSources.ok) {
        const sources = await resSources.json();
        if (Array.isArray(sources)) sourcesCount = sources.length;
      }

      let pagesCount = 0;
      if (resPages && resPages.ok) {
        const pages = await resPages.json();
        if (Array.isArray(pages)) pagesCount = pages.length;
      }

      let successCount = 0;
      let failCount = 0;
      let recent: any[] = [];
      let pending: any[] = [];

      if (resHistory && resHistory.ok) {
        const history = await resHistory.json();
        if (Array.isArray(history)) {
          successCount = history.filter(h => h.status === 'COMPLETED' || h.status === 'SUCCESS').length;
          failCount = history.filter(h => h.status === 'FAILED' || h.status === 'ERROR').length;
          pending = history.filter(h => h.status === 'PENDING' || h.status === 'PROCESSING' || h.status === 'IN_PROGRESS');
          // Get up to 5 most recent completed/failed items
          recent = history.slice(0, 5);
        }
      }

      setStats({
        totalSources: sourcesCount,
        connectedPages: pagesCount,
        successfulUploads: successCount,
        failedUploads: failCount
      });
      setRecentUploads(recent);
      setPendingQueue(pending);
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Optional polling every 30s to keep dashboard live
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">Live metrics and real-time activity across all connected channels.</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchDashboardData(); }}
          className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 rounded-xl text-sm font-medium text-gray-300 hover:text-white transition-all flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Stats
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:border-gray-700 transition-all">
          <p className="text-gray-400 text-sm font-medium">Total Sources</p>
          <p className="text-4xl font-extrabold text-white mt-2">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.totalSources}
          </p>
        </div>
        <div className="p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:border-gray-700 transition-all">
          <p className="text-gray-400 text-sm font-medium">Connected FB Pages</p>
          <p className="text-4xl font-extrabold text-blue-400 mt-2">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.connectedPages}
          </p>
        </div>
        <div className="p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:border-gray-700 transition-all">
          <p className="text-gray-400 text-sm font-medium">Successful Uploads</p>
          <p className="text-4xl font-extrabold text-green-400 mt-2">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.successfulUploads}
          </p>
        </div>
        <div className="p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-xl hover:border-gray-700 transition-all">
          <p className="text-gray-400 text-sm font-medium">Failed Uploads</p>
          <p className="text-4xl font-extrabold text-red-400 mt-2">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.failedUploads}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
            <span>Recent Uploads</span>
            <span className="text-xs font-normal px-2.5 py-1 bg-gray-800 rounded-full text-gray-400">Latest 5</span>
          </h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500 animate-pulse">Loading recent activity...</div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl">
              No uploads yet.
            </div>
          ) : (
            <div className="space-y-3.5 mt-4">
              {recentUploads.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-gray-800/50 hover:bg-gray-800/80 rounded-xl border border-gray-700/50 transition-all">
                  <div className="min-w-0 flex-1 mr-4">
                    <p className="font-semibold text-white text-sm truncate">
                      {item.video?.title || 'Instagram / Reel Post'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Destination: <span className="text-gray-300">{item.facebookPageId || 'Facebook Page'}</span> • {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                    item.status === 'COMPLETED' || item.status === 'SUCCESS'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : item.status === 'FAILED'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  }`}>
                    {item.status === 'COMPLETED' ? 'SUCCESS' : item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
            <span>Queue Status</span>
            <span className="text-xs font-normal px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              {pendingQueue.length} Pending
            </span>
          </h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500 animate-pulse">Checking active queue...</div>
          ) : pendingQueue.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center">
              <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Queue is empty and up to date.</span>
            </div>
          ) : (
            <div className="space-y-3 mt-4">
              {pendingQueue.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3.5 bg-blue-900/20 border border-blue-500/30 rounded-xl animate-pulse">
                  <div className="min-w-0 flex-1 mr-4">
                    <p className="font-semibold text-blue-200 text-sm truncate">
                      Processing: {item.video?.title || 'Queue Item'}
                    </p>
                    <p className="text-xs text-blue-400 mt-0.5">Target Page ID: {item.facebookPageId}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full text-xs font-bold whitespace-nowrap">
                    PROCESSING
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
