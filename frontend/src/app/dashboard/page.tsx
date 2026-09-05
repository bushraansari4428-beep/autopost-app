'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Layers, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  RotateCw, 
  Trash2, 
  Terminal, 
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';

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
                .filter(m => 
                  (m.source?.platform === 'MEGA_CLOUD' || m.source?.platform === 'LOCAL_FOLDER') &&
                  m.status !== 'PAUSED'
                )
                .map(m => m.facebookPageId)
            );
            
            lowQueue = pagesList.filter(p => 
              cloudMappingPageIds.has(p.id) && 
              typeof p.cloudQueueCount === 'number' && 
              p.cloudQueueCount <= 2
            );
          }

          // Filter mappings that have a scheduledTime and are ACTIVE
          const scheduled = mappings.filter(m => m.scheduledTime && m.source?.platform === 'MEGA_CLOUD' && m.status !== 'PAUSED');
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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Live metrics, real-time activity and automation pipelines.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={handleClearFailed}
            disabled={isClearing}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearing ? 'Clearing...' : 'Clear Failed Logs'}</span>
          </button>
          <button 
            onClick={() => { setLoading(true); fetchDashboardData(); }}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Enterprise-Grade Low Video Inventory Alert */}
      {lowQueuePages.length > 0 && (
        <div className="relative overflow-hidden bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-950 border border-rose-500/30 rounded-2xl shadow-xl shadow-rose-950/20 p-4 sm:p-5 transition-all">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-rose-500/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-rose-500/15 border border-rose-500/30 rounded-xl shrink-0 text-rose-400 shadow-sm shadow-rose-500/10">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Low Video Inventory Alert
                  </h3>
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-full shrink-0">
                    {lowQueuePages.length} {lowQueuePages.length === 1 ? 'Page Needs' : 'Pages Need'} Attention
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Active connected pages with 2 or fewer videos in cloud storage. Upload more videos to prevent missed posting schedules.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/upload"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <span>Upload to Cloud</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </Link>
          </div>

          {/* Structured Responsive Grid of Page Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 pt-3.5">
            {lowQueuePages.map(page => {
              const isEmpty = page.cloudQueueCount === 0;
              return (
                <div 
                  key={page.id} 
                  className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    isEmpty
                      ? 'bg-rose-950/40 border-rose-500/40 hover:border-rose-500/60 shadow-sm shadow-rose-950/20'
                      : 'bg-amber-950/30 border-amber-500/30 hover:border-amber-500/50'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isEmpty ? 'bg-rose-500 animate-ping' : 'bg-amber-400'}`} />
                    <span className="font-semibold text-xs text-slate-200 truncate" title={page.name}>
                      {page.name}
                    </span>
                  </div>
                  
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[10px] whitespace-nowrap shrink-0 ${
                    isEmpty 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {isEmpty ? '0 left (Empty)' : `${page.cloudQueueCount} left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Sources */}
        <div className="relative overflow-hidden p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl hover:border-slate-700 transition-all group">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-slate-500/10 blur-2xl group-hover:bg-slate-500/20 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sources</span>
            <div className="p-2 bg-slate-800/80 rounded-xl text-slate-400 group-hover:text-white transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-white mt-3 font-mono tracking-tight">
            {loading ? <span className="animate-pulse opacity-50">...</span> : stats.totalSources}
          </p>
        </div>

        {/* Card 2: Connected FB Pages */}
        <div className="relative overflow-hidden p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl hover:border-blue-500/40 transition-all group">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-blue-500/15 blur-2xl group-hover:bg-blue-500/25 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Connected FB Pages</span>
            <div className="p-2 bg-blue-500/15 rounded-xl text-blue-400 group-hover:text-blue-300 transition-colors">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300 mt-3 font-mono tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-blue-400">...</span> : stats.connectedPages}
          </p>
        </div>

        {/* Card 3: Successful Uploads */}
        <div className="relative overflow-hidden p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl hover:border-emerald-500/40 transition-all group">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-emerald-500/15 blur-2xl group-hover:bg-emerald-500/25 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Successful Uploads</span>
            <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-400 group-hover:text-emerald-300 transition-colors">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300 mt-3 font-mono tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-emerald-400">...</span> : stats.successfulUploads}
          </p>
        </div>

        {/* Card 4: Failed Uploads */}
        <div className="relative overflow-hidden p-5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-xl hover:border-rose-500/40 transition-all group">
          <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 rounded-full bg-rose-500/15 blur-2xl group-hover:bg-rose-500/25 transition-all"></div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Failed Uploads</span>
            <div className="p-2 bg-rose-500/15 rounded-xl text-rose-400 group-hover:text-rose-300 transition-colors">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-red-400 mt-3 font-mono tracking-tight">
            {loading ? <span className="animate-pulse opacity-50 text-rose-400">...</span> : stats.failedUploads}
          </p>
        </div>
      </div>

      {/* Grid: Recent Uploads & System Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Recent Uploads Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/70">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-blue-400" />
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Recent Uploads</h2>
            </div>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 bg-slate-800/80 border border-slate-700/60 rounded-md text-slate-400">
              Latest 5
            </span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500 animate-pulse flex-1 flex items-center justify-center font-medium text-xs">
              Loading recent activity...
            </div>
          ) : recentUploads.length === 0 ? (
            <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-2xl flex-1 flex items-center justify-center text-xs">
              No uploads recorded yet.
            </div>
          ) : (
            <div className="space-y-3.5 flex-1">
              {recentUploads.map(item => (
                <div key={item.id} className="p-4 bg-slate-800/40 hover:bg-slate-800/70 rounded-2xl border border-slate-700/50 transition-all shadow-sm flex flex-col gap-2.5">
                  {/* Top: Video Title & Status / View Post */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-slate-100 text-sm leading-snug break-words flex-1">
                      {item.video?.title || 'Unknown Video'}
                    </p>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold whitespace-nowrap uppercase tracking-wider flex items-center gap-1.5 ${
                        item.status === 'COMPLETED' || item.status === 'SUCCESS'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                          : item.status === 'FAILED' || item.status === 'ERROR'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'COMPLETED' || item.status === 'SUCCESS' ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                        <span>{item.status === 'COMPLETED' ? 'SUCCESS' : item.status}</span>
                      </div>

                      {(item.status === 'COMPLETED' || item.status === 'SUCCESS') && item.facebookPostId && item.facebookPostId !== 'MEGA_CLOUD_UPLOAD' && (
                        <a 
                          href={`https://facebook.com/${item.facebookPostId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-lg border border-blue-500/20 shadow-sm"
                        >
                          <span>View Post</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Middle: Complete Details (Action, Destination Page, Source Origin) */}
                  <div className="flex flex-col text-xs space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40">
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                      <span className="text-slate-400 font-medium">Action:</span>
                      <span className={`font-semibold ${item.facebookPostId === 'MEGA_CLOUD_UPLOAD' ? 'text-purple-400' : 'text-emerald-400'}`}>
                        {item.facebookPostId === 'MEGA_CLOUD_UPLOAD' ? 'Uploaded to Cloud' : 'Posted to Facebook'}
                      </span>
                      <span className="text-slate-600 hidden sm:inline">&bull;</span>
                      <span className="text-slate-400 font-medium">Page:</span>
                      <span className="font-semibold text-blue-400">
                        {item.facebookPage?.name || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                      <span className="text-slate-400 font-medium">Source:</span>
                      <span className="font-semibold text-slate-200">
                        {item.video?.source?.platform === 'MEGA_CLOUD' ? 'Cloud Queue' : item.video?.source?.platform}
                        {item.video?.source?.name ? ` (${item.video.source.name})` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Date & Time */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-400" />
                      <span>{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  {(item.status === 'FAILED' || item.status === 'ERROR') && item.errorMessage && (
                    <div className="mt-1 text-xs text-rose-300 font-mono bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 line-clamp-2">
                      Error: {item.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* macOS Terminal-Style System Logs */}
        <div className="bg-[#07090E] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[440px]">
          {/* Terminal Window Header */}
          <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600"></div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-emerald-400 font-mono font-bold tracking-wider">LIVE LOGS</span>
            </div>
          </div>

          {/* Terminal Content Area */}
          <div className="p-4 flex-1 overflow-y-auto space-y-2 font-mono text-[12px] leading-relaxed custom-scrollbar">
            {loading && logs.length === 0 ? (
              <div className="text-slate-500 text-center py-12">Loading live logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-slate-500 text-center py-12">No system logs recorded yet.</div>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} className="flex gap-2.5 items-start">
                  <span className="text-slate-500 shrink-0 font-mono text-[11px]">
                    [{new Date(log.createdAt).toLocaleTimeString()}]
                  </span>
                  <span className={`shrink-0 font-bold font-mono text-[10px] px-1.5 py-0.2 rounded border ${
                    log.level === 'INFO' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                    log.level === 'WARN' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 
                    'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {log.level}
                  </span>
                  <span className="text-slate-200 break-words font-mono text-[12px]">{log.message}</span>
                </div>
              ))
            )}
            <div className="flex items-center gap-2 text-slate-500 mt-3 pt-2 border-t border-slate-900 text-[11px] font-mono">
              <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse"></span>
              <span>listening to backend worker events...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
