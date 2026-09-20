'use client';
import { useState, useEffect } from 'react';
import { 
  Youtube, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Play, 
  Sparkles, 
  Settings2, 
  Layers, 
  ShieldCheck, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp,
  Video,
  ArrowRight
} from 'lucide-react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function TiktokYoutubePage() {
  const [activeTab, setActiveTab] = useState<'mappings' | 'channels' | 'history'>('mappings');
  
  // Data states
  const [channels, setChannels] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalChannels: 0,
    activeMappings: 0,
    totalUploaded: 0,
    monitoringIntervalMinutes: 5,
  });

  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [syncingMappingId, setSyncingMappingId] = useState<string | null>(null);

  // Modals state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'mapping' | 'channel'; id: string; name: string } | null>(null);

  // Channel Form state
  const [channelForm, setChannelForm] = useState({
    refreshToken: '',
    clientId: '',
    clientSecret: '',
    customName: '',
  });
  const [isSubmittingChannel, setIsSubmittingChannel] = useState(false);

  // Mapping Form state
  const [mappingForm, setMappingForm] = useState({
    tiktokUrl: '',
    youtubeChannelId: '',
    customHashtags: '#Shorts #viral #fyp',
    privacyStatus: 'public',
  });
  const [isSubmittingMapping, setIsSubmittingMapping] = useState(false);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [channelsRes, mappingsRes, historyRes, statsRes] = await Promise.all([
        fetch('/api/tiktok-youtube/channels', { credentials: 'omit', headers: getHeaders() }),
        fetch('/api/tiktok-youtube/mappings', { credentials: 'omit', headers: getHeaders() }),
        fetch('/api/tiktok-youtube/history?limit=30', { credentials: 'omit', headers: getHeaders() }),
        fetch('/api/tiktok-youtube/stats', { credentials: 'omit', headers: getHeaders() }),
      ]);

      if (channelsRes.ok) setChannels(await channelsRes.json());
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.items || []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err: any) {
      console.error('Failed to load TikTok to YouTube data', err);
      addToast('Failed to load data from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Connect Channel
  const handleConnectChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.refreshToken) {
      addToast('Refresh token is required to connect YouTube.', 'error');
      return;
    }
    setIsSubmittingChannel(true);
    try {
      const res = await fetch('/api/tiktok-youtube/channels', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(channelForm),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`YouTube Channel "${data.name}" connected permanently!`, 'success');
        setShowChannelModal(false);
        setChannelForm({ refreshToken: '', clientId: '', clientSecret: '', customName: '' });
        fetchData();
      } else {
        addToast(`Connection failed: ${data.message || 'Check credentials'}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error connecting channel: ${err.message}`, 'error');
    } finally {
      setIsSubmittingChannel(false);
    }
  };

  // Create Mapping
  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingForm.tiktokUrl) {
      addToast('TikTok URL or username is required.', 'error');
      return;
    }
    if (!mappingForm.youtubeChannelId) {
      addToast('Please select a target YouTube Channel.', 'error');
      return;
    }
    setIsSubmittingMapping(true);
    try {
      const res = await fetch('/api/tiktok-youtube/mappings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(mappingForm),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`Mapping for @${data.tiktokUsername} created successfully!`, 'success');
        setShowMappingModal(false);
        setMappingForm({ tiktokUrl: '', youtubeChannelId: '', customHashtags: '#Shorts #viral #fyp', privacyStatus: 'public' });
        fetchData();
      } else {
        addToast(`Failed to create mapping: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error creating mapping: ${err.message}`, 'error');
    } finally {
      setIsSubmittingMapping(false);
    }
  };

  // Toggle Mapping Status (Active / Paused)
  const handleToggleMappingStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setMappings(prev => prev.map(m => m.id === id ? { ...m, status: newStatus } : m));
    try {
      const res = await fetch(`/api/tiktok-youtube/mappings/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        addToast(`Mapping set to ${newStatus}`, 'success');
      } else {
        fetchData();
        addToast('Failed to update mapping status', 'error');
      }
    } catch (_) {
      fetchData();
      addToast('Error updating status', 'error');
    }
  };

  // Trigger Manual Instant Sync
  const handleManualSync = async (id: string, username: string) => {
    setSyncingMappingId(id);
    addToast(`Scanning @${username} for newest videos & uploading to YouTube...`, 'info');
    try {
      const res = await fetch(`/api/tiktok-youtube/mappings/${id}/sync`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Sync completed successfully!', 'success');
        fetchData();
      } else {
        addToast(data.message || 'Sync encountered an issue.', 'error');
      }
    } catch (err: any) {
      addToast(`Sync error: ${err.message}`, 'error');
    } finally {
      setSyncingMappingId(null);
    }
  };

  // Confirm Delete
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id, name } = deleteConfirm;
    try {
      const endpoint = type === 'mapping' 
        ? `/api/tiktok-youtube/mappings/${id}` 
        : `/api/tiktok-youtube/channels/${id}`;
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast(`${type === 'mapping' ? 'Mapping' : 'Channel'} "${name}" deleted.`, 'success');
        fetchData();
      } else {
        addToast(`Failed to delete ${type}`, 'error');
      }
    } catch (err: any) {
      addToast(`Delete error: ${err.message}`, 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-rose-950/70 via-slate-900 to-indigo-950/70 border border-slate-800/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>TikTok ➔ YouTube Shorts AutoPost</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <span>Creator Sync & Reposter</span>
              <span className="text-rose-500 font-normal">|</span>
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-pink-400 to-indigo-400">
                5-10 Min AutoPost
              </span>
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Find unique TikTok creators not on YouTube, map them to your YouTube channels, and our automated engine will detect new videos within 5–10 minutes, download HD unwatermarked video streams, and publish them to YouTube Shorts with original captions & hashtags.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowChannelModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 font-semibold text-sm border border-slate-700/80 transition-all shadow-lg hover:shadow-slate-700/20 active:scale-95"
            >
              <Youtube className="w-4 h-4 text-red-500" />
              <span>Connect YouTube Channel</span>
            </button>
            <button
              onClick={() => {
                if (channels.length === 0) {
                  addToast('Please connect at least 1 YouTube Channel first before creating a mapping.', 'info');
                  setShowChannelModal(true);
                  return;
                }
                setShowMappingModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-sm shadow-xl shadow-rose-600/30 border border-rose-400/30 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>New Creator Mapping</span>
            </button>
          </div>
        </div>

        {/* Live Status Pill */}
        <div className="mt-6 pt-5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-semibold">Active Background Monitor:</span>
            <span>Checking active TikTok creators every 5 minutes</span>
          </div>
          <div className="flex items-center gap-4">
            <span>HD Unwatermarked Stream: <strong className="text-slate-200">Active</strong></span>
            <span>Duplicate Hash Protection (FFmpeg): <strong className="text-slate-200">Enabled</strong></span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected Channels</div>
            <div className="text-3xl font-black text-white">{stats.totalChannels || channels.length}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Youtube className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Mappings</div>
            <div className="text-3xl font-black text-white">{stats.activeMappings || mappings.filter(m => m.status === 'ACTIVE').length}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shorts Published</div>
            <div className="text-3xl font-black text-emerald-400">{stats.totalUploaded || history.filter(h => h.status === 'COMPLETED').length}</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl shadow-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auto-Sync Cycle</div>
            <div className="text-2xl font-black text-indigo-400">Every 5 Mins</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('mappings')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'mappings'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Creator Mappings ({mappings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'channels'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Youtube className="w-4 h-4" />
            <span>YouTube Channels ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>Sync History ({history.length})</span>
          </button>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-semibold transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TAB 1: MAPPINGS */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          {mappings.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Layers className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No Creator Mappings Yet</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Map your first TikTok creator to a connected YouTube channel to start automatic video syncing!
                </p>
              </div>
              <button
                onClick={() => {
                  if (channels.length === 0) {
                    addToast('Please connect a YouTube Channel first.', 'info');
                    setShowChannelModal(true);
                  } else {
                    setShowMappingModal(true);
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white text-sm font-semibold shadow-lg shadow-rose-600/25"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Mapping</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {mappings.map((mapping) => {
                const isSyncing = syncingMappingId === mapping.id;
                const channel = mapping.youtubeChannel;
                return (
                  <div
                    key={mapping.id}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg backdrop-blur-xl"
                  >
                    {/* Left: Source TikTok Creator */}
                    <div className="flex items-center gap-4 min-w-[280px]">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-white font-black text-lg shrink-0 shadow-md">
                        {mapping.tiktokUsername.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <a
                            href={mapping.tiktokUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-white hover:text-rose-400 transition-colors flex items-center gap-1.5"
                          >
                            <span>@{mapping.tiktokUsername}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          </a>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-cyan-400 border border-slate-700">
                            TikTok Creator
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-xs">
                          Hashtags: <span className="text-slate-300 font-medium">{mapping.customHashtags || '#Shorts'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Arrow Indicator */}
                    <div className="hidden lg:flex items-center justify-center px-4 text-slate-500">
                      <ArrowRight className="w-5 h-5 text-rose-500/70" />
                    </div>

                    {/* Middle: Target YouTube Channel */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      {channel?.thumbnailUrl ? (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.name}
                          className="w-10 h-10 rounded-full border border-slate-700 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold shrink-0">
                          <Youtube className="w-5 h-5" />
                        </div>
                      )}
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                          <span>{channel?.name || 'Target YouTube Channel'}</span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span>Privacy: <strong className="text-slate-300 uppercase text-[10px]">{mapping.privacyStatus}</strong></span>
                          <span>•</span>
                          <span>{mapping._count?.uploads || 0} Posted</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Last Sync info */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="text-left sm:text-right space-y-0.5">
                        <button
                          onClick={() => handleToggleMappingStatus(mapping.id, mapping.status)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                            mapping.status === 'ACTIVE'
                              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                              : 'bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25'
                          }`}
                        >
                          {mapping.status === 'ACTIVE' ? '● Sync Active' : '○ Paused'}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {mapping.lastChecked ? `Checked: ${new Date(mapping.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for initial scan'}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleManualSync(mapping.id, mapping.tiktokUsername)}
                          disabled={isSyncing}
                          title="Trigger immediate sync & upload test video"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600/80 to-red-600/80 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
                        >
                          <Play className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                        </button>

                        <button
                          onClick={() => setDeleteConfirm({ type: 'mapping', id: mapping.id, name: `@${mapping.tiktokUsername}` })}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete mapping"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONNECTED CHANNELS */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Authorized YouTube Channels</h3>
            <button
              onClick={() => setShowChannelModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold shadow-lg shadow-red-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Channel</span>
            </button>
          </div>

          {channels.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                <Youtube className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">No YouTube Channels Connected</h3>
                <p className="text-slate-400 text-sm max-w-md mx-auto">
                  Connect your YouTube channel using a permanent OAuth 2.0 refresh token so our server can upload Shorts automatically!
                </p>
              </div>
              <button
                onClick={() => setShowChannelModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold shadow-lg shadow-red-600/25"
              >
                <Plus className="w-4 h-4" />
                <span>Connect YouTube Channel</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 backdrop-blur-xl shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {channel.thumbnailUrl ? (
                        <img
                          src={channel.thumbnailUrl}
                          alt={channel.name}
                          className="w-12 h-12 rounded-full border-2 border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold">
                          <Youtube className="w-6 h-6" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-white text-base leading-snug">{channel.name}</h4>
                        <p className="text-xs text-slate-400">ID: {channel.channelId}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteConfirm({ type: 'channel', id: channel.id, name: channel.name })}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Disconnect channel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Session Status:</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Permanent OAuth Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Active Mappings:</span>
                      <span className="text-slate-200 font-semibold">{channel._count?.mappings || 0} creators</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Videos Uploaded:</span>
                      <span className="text-slate-200 font-semibold">{channel._count?.uploads || 0} videos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SYNC & UPLOAD HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
              <Clock className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-white font-bold text-base">No Videos Synced Yet</div>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">
                Once a mapped creator posts a new video, it will be automatically downloaded and published to YouTube Shorts here within 5-10 minutes.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-900/60 backdrop-blur-xl shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Video & Caption</th>
                      <th className="py-3 px-4 font-bold">Source Creator</th>
                      <th className="py-3 px-4 font-bold">YouTube Channel</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Published Date</th>
                      <th className="py-3 px-4 font-bold text-right">Links</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {history.map((item) => {
                      const isCompleted = item.status === 'COMPLETED';
                      const isProcessing = item.status === 'PROCESSING';
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-semibold text-white truncate" title={item.title}>
                              {item.title || `TikTok Video ${item.tiktokVideoId}`}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              ID: {item.tiktokVideoId}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <a
                              href={item.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:underline font-medium text-xs flex items-center gap-1"
                            >
                              <span>@{item.mapping?.tiktokUsername || 'creator'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-xs text-slate-200">
                            {item.youtubeChannel?.name || 'YouTube'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                                : isProcessing
                                ? 'bg-blue-500/15 border border-blue-500/30 text-blue-400 animate-pulse'
                                : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                            }`}>
                              {isCompleted && <CheckCircle className="w-3 h-3" />}
                              {isProcessing && <RefreshCw className="w-3 h-3 animate-spin" />}
                              {!isCompleted && !isProcessing && <AlertCircle className="w-3 h-3" />}
                              <span>{item.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-400">
                            {item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : new Date(item.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            {item.youtubeUrl ? (
                              <a
                                href={item.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-semibold text-xs border border-red-500/30 transition-colors"
                              >
                                <Youtube className="w-3.5 h-3.5" />
                                <span>Watch Shorts</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CONNECT YOUTUBE CHANNEL */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Youtube className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Connect YouTube Channel</h3>
                  <p className="text-xs text-slate-400">Permanent OAuth 2.0 connection — saves permanently</p>
                </div>
              </div>
              <button
                onClick={() => setShowChannelModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConnectChannel} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Google OAuth Refresh Token <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={channelForm.refreshToken}
                  onChange={(e) => setChannelForm({ ...channelForm, refreshToken: e.target.value })}
                  placeholder="Paste Google OAuth Refresh Token (e.g. 1//04...)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Google Client ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={channelForm.clientId}
                    onChange={(e) => setChannelForm({ ...channelForm, clientId: e.target.value })}
                    placeholder="Defaults to server env"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Client Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={channelForm.clientSecret}
                    onChange={(e) => setChannelForm({ ...channelForm, clientSecret: e.target.value })}
                    placeholder="Defaults to server env"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Custom Channel Label (Optional)
                </label>
                <input
                  type="text"
                  value={channelForm.customName}
                  onChange={(e) => setChannelForm({ ...channelForm, customName: e.target.value })}
                  placeholder="e.g. My Shorts Channel"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>

              {/* Collapsible Helper Guide */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
                    How do I get my Google OAuth Refresh Token?
                  </span>
                  {showHelpGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showHelpGuide && (
                  <div className="p-3.5 pt-0 text-[11px] text-slate-400 space-y-2 border-t border-slate-800/60">
                    <ol className="list-decimal list-inside space-y-1 text-slate-300">
                      <li>Go to <strong>Google Cloud Console</strong> & create a project.</li>
                      <li>Enable <strong>YouTube Data API v3</strong> in Library.</li>
                      <li>Go to <strong>OAuth Consent Screen</strong>, select External, and add scope: <code>https://www.googleapis.com/auth/youtube.upload</code>.</li>
                      <li>Create <strong>OAuth 2.0 Client ID</strong> (Web Application).</li>
                      <li>Use Google OAuth Playground (or OAuth flow) to authorize with YouTube scope & obtain the permanent <strong>refresh_token</strong>.</li>
                    </ol>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChannel}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-xs shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmittingChannel ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isSubmittingChannel ? 'Connecting...' : 'Verify & Connect Channel'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CREATOR MAPPING */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-white">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">New TikTok ➔ YouTube Mapping</h3>
                  <p className="text-xs text-slate-400">Map a TikTok creator to a YouTube channel</p>
                </div>
              </div>
              <button
                onClick={() => setShowMappingModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMapping} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  TikTok Creator Profile URL or Username <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={mappingForm.tiktokUrl}
                  onChange={(e) => setMappingForm({ ...mappingForm, tiktokUrl: e.target.value })}
                  placeholder="e.g. https://www.tiktok.com/@creator or @creator"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Any creator you discover that is not on YouTube. We will monitor them automatically.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Target YouTube Channel <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={mappingForm.youtubeChannelId}
                  onChange={(e) => setMappingForm({ ...mappingForm, youtubeChannelId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                >
                  <option value="">-- Select YouTube Channel --</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.channelId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Custom Hashtags (Appended to original caption)
                </label>
                <input
                  type="text"
                  value={mappingForm.customHashtags}
                  onChange={(e) => setMappingForm({ ...mappingForm, customHashtags: e.target.value })}
                  placeholder="#Shorts #viral #fyp"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Original caption and hashtags are preserved; custom tags are added cleanly.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Video Visibility / Privacy
                </label>
                <select
                  value={mappingForm.privacyStatus}
                  onChange={(e) => setMappingForm({ ...mappingForm, privacyStatus: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500 transition-colors"
                >
                  <option value="public">Public (Immediate viral reach)</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMapping}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-semibold text-xs shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                >
                  {isSubmittingMapping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{isSubmittingMapping ? 'Creating...' : 'Activate Mapping'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteConfirm && (
        <ConfirmModal
          isOpen={true}
          title={`Delete ${deleteConfirm.type === 'mapping' ? 'Mapping' : 'Channel'}`}
          message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleExecuteDelete}
          onClose={() => setDeleteConfirm(null)}
        />
      )}

      {/* TOAST CONTAINER */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
