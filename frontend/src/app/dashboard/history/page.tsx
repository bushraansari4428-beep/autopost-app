'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCw, 
  Search, 
  ExternalLink, 
  Trash2, 
  Video, 
  Share2,
  RefreshCw,
  Facebook
} from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'FAILED' | 'PENDING'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [clearingFailed, setClearingFailed] = useState(false);
  const itemsPerPage = 15;

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/history/${id}/retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await fetchHistory();
      }
    } catch (err) {
      console.error('Failed to retry upload:', err);
    } finally {
      setRetryingId(null);
    }
  };

  const handleClearFailed = async () => {
    if (!confirm('Are you sure you want to clear all failed upload history records?')) return;
    try {
      setClearingFailed(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/history/failed', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await fetchHistory();
      }
    } catch (err) {
      console.error('Failed to clear failed history:', err);
    } finally {
      setClearingFailed(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const total = history.length;
    const completed = history.filter(h => h.status === 'COMPLETED').length;
    const failed = history.filter(h => h.status === 'FAILED').length;
    const processing = history.filter(h => h.status === 'PROCESSING' || h.status === 'PENDING').length;
    return { total, completed, failed, processing };
  }, [history]);

  // Filtering
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && item.status !== 'COMPLETED') return false;
        if (statusFilter === 'FAILED' && item.status !== 'FAILED') return false;
        if (statusFilter === 'PENDING' && item.status !== 'PENDING' && item.status !== 'PROCESSING') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = (item.video?.title || item.video?.description || '').toLowerCase();
        const pageName = (item.facebookPage?.name || '').toLowerCase();
        const sourceName = (item.video?.source?.name || '').toLowerCase();
        const platform = (item.video?.source?.platform || '').toLowerCase();
        const error = (item.errorMessage || '').toLowerCase();
        return title.includes(query) || pageName.includes(query) || sourceName.includes(query) || platform.includes(query) || error.includes(query);
      }

      return true;
    });
  }, [history, statusFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage]);

  const getPlatformBadge = (platform?: string) => {
    const plat = (platform || 'UNKNOWN').toUpperCase();
    switch (plat) {
      case 'TIKTOK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
            🎵 TikTok
          </span>
        );
      case 'YOUTUBE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            ▶️ YouTube
          </span>
        );
      case 'INSTAGRAM':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            📸 Instagram
          </span>
        );
      case 'MEGA_CLOUD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ☁️ Mega Cloud
          </span>
        );
      case 'XIAOHONGSHU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            📕 RedNote
          </span>
        );
      case 'KUAISHOU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
            ⚡ Kuaishou
          </span>
        );
      case 'LOCAL_FOLDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            💻 Local PC
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-gray-700/50 text-gray-300 border border-gray-600">
            📹 {plat}
          </span>
        );
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Share2 className="w-8 h-8 text-blue-500" />
            Upload History
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Complete audit trail of all cross-posted videos, destination pages, sources, and delivery logs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats.failed > 0 && (
            <button
              onClick={handleClearFailed}
              disabled={clearingFailed}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {clearingFailed ? 'Clearing...' : 'Clear Failed Logs'}
            </button>
          )}
          <button
            onClick={fetchHistory}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gray-800/80 hover:bg-gray-700 border border-gray-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Uploads</p>
            <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Video className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Successful</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{stats.completed}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Failed</p>
            <p className="text-2xl font-black text-rose-400 mt-1">{stats.failed}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pending / Active</p>
            <p className="text-2xl font-black text-cyan-400 mt-1">{stats.processing}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search Control Bar */}
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search title, page, source..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'COMPLETED', 'FAILED', 'PENDING'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-gray-800/60 text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {st === 'ALL' ? `All (${stats.total})` : 
               st === 'COMPLETED' ? `Success (${stats.completed})` : 
               st === 'FAILED' ? `Failed (${stats.failed})` : 
               `Pending (${stats.processing})`}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="w-full">
          <table className="w-full table-fixed text-left text-sm text-gray-300">
            <thead className="bg-gray-950/80 text-gray-400 uppercase text-[11px] font-bold tracking-wider border-b border-gray-800">
              <tr>
                <th className="px-3.5 py-3.5 w-[18%]">Video Details</th>
                <th className="px-3.5 py-3.5 w-[13%]">Source Platform</th>
                <th className="px-3.5 py-3.5 w-[16%]">Destination Page</th>
                <th className="px-3.5 py-3.5 w-[19%]">Date & Time</th>
                <th className="px-3.5 py-3.5 w-[20%]">Status & Info</th>
                <th className="px-3.5 py-3.5 pr-6 w-[14%] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-sm font-medium">Loading full upload history...</p>
                    </div>
                  </td>
                </tr>
              ) : paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Video className="w-10 h-10 text-gray-600 mb-1" />
                      <p className="text-base font-semibold text-gray-300">No upload records found</p>
                      <p className="text-xs text-gray-500 max-w-sm">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Try clearing your filters or search query to see other records.'
                          : 'Connect a Source and Map it to a Facebook Page to start cross-posting.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((item) => {
                  const videoTitle = item.video?.title || item.video?.description || 'Untitled Video';
                  const pageName = item.facebookPage?.name || (item.facebookPageId ? `Page (${item.facebookPageId.slice(0, 8)}...)` : 'Facebook Page');
                  const pageId = item.facebookPage?.pageId || item.facebookPageId;
                  const sourceName = item.video?.source?.name || 'Connected Source';
                  const platform = item.video?.source?.platform;
                  const dateObj = new Date(item.createdAt);
                  const formattedDateOnly = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  const formattedTimeOnly = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  });

                  return (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors group">
                      {/* Video Title */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-gray-800/80 border border-gray-700/60 flex items-center justify-center shrink-0 text-blue-400">
                            <Video className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white truncate text-xs leading-tight" title={videoTitle}>
                              {videoTitle}
                            </p>
                            {item.video?.url && (
                              <a
                                href={item.video.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-gray-500 hover:text-blue-400 truncate block mt-0.5 transition-colors"
                              >
                                Source Video ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Source Platform */}
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div>{getPlatformBadge(platform)}</div>
                          <span className="text-[11px] font-medium text-gray-400 truncate" title={sourceName}>
                            {sourceName}
                          </span>
                        </div>
                      </td>

                      {/* Destination Facebook Page */}
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            <Facebook className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white text-xs truncate" title={pageName}>{pageName}</p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">ID: {pageId ? `${pageId.slice(0, 8)}...` : 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-gray-200 truncate">
                            {formattedDateOnly}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-blue-400 shrink-0" />
                            {formattedTimeOnly}
                          </span>
                        </div>
                      </td>

                      {/* Status & Diagnostic Info */}
                      <td className="px-3.5 py-3">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold w-fit ${
                              item.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : item.status === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse'
                            }`}
                          >
                            {item.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3" />}
                            {item.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                            {(item.status === 'PENDING' || item.status === 'PROCESSING') && <RotateCw className="w-3 h-3 animate-spin" />}
                            {item.status === 'COMPLETED' ? 'SUCCESS' : item.status}
                          </span>

                          {/* Error Message for Failed Uploads */}
                          {item.errorMessage && (
                            <p className="text-[10px] text-rose-400 truncate mt-0.5" title={item.errorMessage}>
                              {item.errorMessage}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 pr-6 text-right">
                        {item.status === 'FAILED' && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            disabled={retryingId === item.id}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className={`w-3 h-3 ${retryingId === item.id ? 'animate-spin' : ''}`} />
                            {retryingId === item.id ? 'Retrying...' : 'Retry'}
                          </button>
                        )}
                        {item.status === 'COMPLETED' && (
                          <a
                            href={
                              item.facebookPostId
                                ? `https://facebook.com/${item.facebookPostId}`
                                : `https://facebook.com/${item.facebookPage?.pageId || ''}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all shadow-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View Post
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-950/80 border-t border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Showing <span className="font-semibold text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
              <span className="font-semibold text-white">
                {Math.min(currentPage * itemsPerPage, filteredHistory.length)}
              </span>{' '}
              of <span className="font-semibold text-white">{filteredHistory.length}</span> records
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-gray-400 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
