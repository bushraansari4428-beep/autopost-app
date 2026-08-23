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
  const [logs, setLogs] = useState<any[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);
  const [lowQueuePages, setLowQueuePages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isClearing, setIsClearing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resSources, resPages, resHistory, resMappings, resLogs] = await Promise.all([
        fetch('/api/sources', { headers, cache: 'no-store' }).catch(() => null),
        fetch('/api/pages', { headers, cache: 'no-store' }).catch(() => null),
        fetch('/api/history', { headers, cache: 'no-store' }).catch(() => null),
        fetch('/api/mappings', { headers, cache: 'no-store' }).catch(() => null),
        fetch('/api/logs', { headers, cache: 'no-store' }).catch(() => null)
      ]);

      let sourcesCount = 0;
      if (resSources && resSources.ok) {
        const sources = await resSources.json();
        if (Array.isArray(sources)) sourcesCount = sources.length;
      }

      let pagesCount = 0;
      let pagesList: any[] = [];
      if (resPages && resPages.ok) {
        pagesList = await resPages.json();
        if (Array.isArray(pagesList)) pagesCount = pagesList.length;
      }

      let successCount = 0;
      let failCount = 0;
      let recent: any[] = [];

      if (resHistory && resHistory.ok) {
        const history = await resHistory.json();
        if (Array.isArray(history)) {
          successCount = history.filter(h => h.status === 'COMPLETED' || h.status === 'SUCCESS').length;
          failCount = history.filter(h => h.status === 'FAILED' || h.status === 'ERROR').length;
          recent = history.slice(0, 5);
        }
      }

      let fetchedLogs: any[] = [];
      if (resLogs && resLogs.ok) {
        const parsedLogs = await resLogs.json();
        if (Array.isArray(parsedLogs)) {
          fetchedLogs = parsedLogs;
        }
      }

      let upcoming: any[] = [];
      let lowQueue: any[] = [];
      
      if (resMappings && resMappings.ok) {
        const mappings = await resMappings.json();
        if (Array.isArray(mappings)) {
          // Identify pages that have a cloud/local mapping and low queue count
          if (Array.isArray(pagesList)) {
            const cloudMappingPageIds = new Set(
              mappings
                .filter(m => m.source?.platform === 'MEGA_CLOUD' || m.source?.platform === 'LOCAL_FOLDER')
                .map(m => m.facebookPageId)
            );
            
            lowQueue = pagesList.filter(p => 
              cloudMappingPageIds.has(p.id) && 
              typeof p.cloudQueueCount === 'number' && 
              p.cloudQueueCount <= 2
            );
          }

          // Filter mappings that have a scheduledTime
          const scheduled = mappings.filter(m => m.scheduledTime && m.source?.platform === 'MEGA_CLOUD');
          // Parse "HH:mm" strings, convert to actual upcoming Dates, and sort them
          const now = new Date();
          upcoming = scheduled.map(m => {
            const [hours, minutes] = m.scheduledTime.split(':').map(Number);
            let nextRun = new Date();
            nextRun.setHours(hours, minutes, 0, 0);
            if (nextRun <= now && m.lastScheduledRun) {
              // If it already ran today, next run is tomorrow
              const lastRun = new Date(m.lastScheduledRun);
              if (lastRun.getDate() === now.getDate() && lastRun.getMonth() === now.getMonth()) {
                nextRun.setDate(nextRun.getDate() + 1);
              }
            } else if (nextRun <= now && !m.lastScheduledRun) {
              // Should run immediately
            }
            return { ...m, nextRunTime: nextRun };
          }).sort((a, b) => a.nextRunTime.getTime() - b.nextRunTime.getTime()).slice(0, 5);
        }
      }

      setStats({
        totalSources: sourcesCount,
        connectedPages: pagesCount,
        successfulUploads: successCount,
        failedUploads: failCount
      });
      setRecentUploads(recent);
      setLogs(fetchedLogs);
      setUpcomingSchedules(upcoming);
      setLowQueuePages(lowQueue);
    } catch (error) {
      console.error('Error fetching dashboard statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleClearFailed = async () => {
    setIsClearing(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch('/api/history/failed', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      await fetchDashboardData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-gray-400 mt-1">Live metrics and real-time activity across all connected channels.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleClearFailed}
            disabled={isClearing}
            className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 rounded-xl text-sm font-medium text-red-300 hover:text-red-200 transition-all flex items-center gap-2"
          >
            {isClearing ? 'Clearing...' : 'Clear Failed Logs'}
          </button>
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
      </div>

      {lowQueuePages.length > 0 && (
        <div className="mb-8 p-5 bg-red-900/20 border border-red-500/30 rounded-2xl flex items-start gap-4">
          <div className="p-2 bg-red-500/20 rounded-full mt-1">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-400">Low Cloud Queue Warning</h3>
            <p className="text-red-300 text-sm mt-1 mb-3">
              The following pages are running out of videos in their cloud queue. Please upload new videos to avoid missing scheduled posts.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lowQueuePages.map(page => (
                <div key={page.id} className="bg-red-950/40 border border-red-900/50 rounded-xl p-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-200 truncate pr-2">{page.name}</span>
                  <span className="text-xs font-bold px-2 py-1 bg-red-500/20 text-red-400 rounded-md whitespace-nowrap">
                    {page.cloudQueueCount} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="relative overflow-hidden p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl hover:border-gray-700 transition-all group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
          <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            Total Sources
          </p>
          <p className="text-4xl font-black text-white mt-3 tracking-tight">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.totalSources}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl hover:border-gray-700 transition-all group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
          <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            Connected FB Pages
          </p>
          <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 mt-3 tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-blue-400">...</span> : stats.connectedPages}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl hover:border-gray-700 transition-all group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-green-500/10 blur-3xl group-hover:bg-green-500/20 transition-all"></div>
          <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Successful Uploads
          </p>
          <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-300 mt-3 tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-green-400">...</span> : stats.successfulUploads}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-2xl hover:border-gray-700 transition-all group">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-red-500/10 blur-3xl group-hover:bg-red-500/20 transition-all"></div>
          <p className="text-gray-400 text-sm font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Failed Uploads
          </p>
          <p className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-rose-400 mt-3 tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-red-400">...</span> : stats.failedUploads}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col h-full">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-between">
            <span>Recent Uploads</span>
            <span className="text-xs font-normal px-2.5 py-1 bg-gray-800 rounded-full text-gray-400">Latest 5</span>
          </h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500 animate-pulse flex-1 flex items-center justify-center">Loading recent activity...</div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border border-dashed border-gray-800 rounded-xl flex-1 flex items-center justify-center">
              No uploads yet.
            </div>
          ) : (
            <div className="space-y-3.5 mt-2 flex-1">
              {recentUploads.map(item => (
                <div key={item.id} className="flex flex-col p-3.5 bg-gray-800/40 hover:bg-gray-800/70 rounded-xl border border-gray-700/50 transition-all">
                  <div className="flex items-start justify-between w-full">
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="font-semibold text-white text-sm truncate">
                        {item.video?.title || 'Unknown Video'}
                      </p>
                      <div className="flex flex-col text-xs mt-1.5 space-y-1">
                        <div className="flex items-center">
                          <span className="text-gray-400">Action:</span>
                          <span className={`font-semibold ml-1.5 ${item.facebookPostId === 'MEGA_CLOUD_UPLOAD' ? 'text-purple-400' : 'text-green-400'}`}>
                            {item.facebookPostId === 'MEGA_CLOUD_UPLOAD' ? 'Uploaded to Cloud' : 'Posted to Facebook'}
                          </span>
                          <span className="text-gray-600 mx-2">&bull;</span>
                          <span className="text-gray-400">{item.facebookPostId === 'MEGA_CLOUD_UPLOAD' ? 'Queue:' : 'Page:'}</span>
                          <span className="font-semibold text-blue-400 ml-1.5 truncate max-w-[150px]">{item.facebookPage?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-400">Source:</span>
                          <span className="font-medium text-gray-300 ml-1.5 truncate max-w-[200px]">
                            {item.video?.source?.platform === 'MEGA_CLOUD' ? 'Cloud Queue' : item.video?.source?.platform}
                            {item.video?.source?.name ? ` (${item.video.source.name})` : ''}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap uppercase tracking-wider ${
                        item.status === 'COMPLETED' || item.status === 'SUCCESS'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                          : item.status === 'FAILED' || item.status === 'ERROR'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        {item.status === 'COMPLETED' ? 'SUCCESS' : item.status}
                      </span>
                      {(item.status === 'COMPLETED' || item.status === 'SUCCESS') && item.facebookPostId && item.facebookPostId !== 'MEGA_CLOUD_UPLOAD' && (
                        <a 
                          href={`https://facebook.com/${item.facebookPostId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20"
                        >
                          View Post <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      )}
                    </div>
                  </div>
                  {(item.status === 'FAILED' || item.status === 'ERROR') && item.errorMessage && (
                    <div className="mt-2 text-xs text-red-400/90 bg-red-500/10 p-2 rounded-lg border border-red-500/10 line-clamp-2">
                      Error: {item.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl overflow-hidden shadow-xl flex flex-col font-mono text-sm h-[400px]">
          <div className="bg-gray-900/80 px-4 py-3 border-b border-gray-800 flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="ml-auto flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-green-500 font-bold">SYSTEM LOGS</span>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {loading && logs.length === 0 ? (
              <div className="text-gray-500 text-center py-10">Loading live logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-gray-500 text-center py-10">No system logs recorded yet.</div>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} className="flex gap-3 text-xs">
                  <span className="text-gray-600 shrink-0">[{new Date(log.createdAt).toLocaleTimeString()}]</span>
                  <span className={`shrink-0 font-bold ${
                    log.level === 'INFO' ? 'text-blue-400' :
                    log.level === 'WARN' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    [{log.level}]
                  </span>
                  <span className="text-gray-300 break-words">{log.message}</span>
                </div>
              ))
            )}
            <div className="flex gap-4 animate-pulse mt-4 text-xs">
              <span className="text-gray-600">[Waiting for new events...]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
