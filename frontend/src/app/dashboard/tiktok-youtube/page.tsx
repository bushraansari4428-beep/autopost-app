'use client';
import { useState, useEffect, useMemo } from 'react';
import { 
  Youtube, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  Clock, 
  Play, 
  Layers, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  Cloud,
  UploadCloud,
  Send,
  Folder
} from 'lucide-react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

interface CloudVideoItem {
  id: string;
  filename: string;
  title: string;
  description?: string;
  url: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  youtubeVideoId?: string;
  youtubeUrl?: string;
  errorMessage?: string;
  uploadedAt?: string;
  createdAt: string;
}

export default function TiktokYoutubePage() {
  const [activeTab, setActiveTab] = useState<'mappings' | 'cloud' | 'channels' | 'history'>('mappings');
  
  // Data states
  const [channels, setChannels] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalChannels: 0,
    activeMappings: 0,
    totalUploaded: 0,
  });

  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [syncingMappingId, setSyncingMappingId] = useState<string | null>(null);

  // Modals state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHelpGuide, setShowHelpGuide] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'mapping' | 'channel' | 'cloudVideo' | 'clearQueue'; id: string; name: string } | null>(null);

  // Cloud Tab state
  const [selectedCloudChannelId, setSelectedCloudChannelId] = useState<string>('');
  const [cloudQueue, setCloudQueue] = useState<CloudVideoItem[]>([]);
  const [cloudMeta, setCloudMeta] = useState<any>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [isPostingNext, setIsPostingNext] = useState(false);
  const [cloudFiles, setCloudFiles] = useState<File[]>([]);
  const [isUploadingCloud, setIsUploadingCloud] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Schedule Form State
  const [scheduleForm, setScheduleForm] = useState({
    scheduledTime: '12:00, 18:00',
    videosPerDay: 2,
    customHashtags: '#Shorts #viral #fyp #AI',
    privacyStatus: 'public',
  });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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
        fetch('/api/tiktok-youtube/history?limit=50', { credentials: 'omit', headers: getHeaders() }),
        fetch('/api/tiktok-youtube/stats', { credentials: 'omit', headers: getHeaders() }),
      ]);

      if (channelsRes.ok) {
        const chData = await channelsRes.json();
        setChannels(chData);
        if (chData.length > 0 && !selectedCloudChannelId) {
          setSelectedCloudChannelId(chData[0].id);
        }
      }
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.items || []);
      }
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err: any) {
      console.error('Failed to load data', err);
      addToast('Failed to load data from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchCloudQueue = async (channelId: string) => {
    if (!channelId) return;
    setIsQueueLoading(true);
    try {
      const res = await fetch(`/api/tiktok-youtube/channels/${channelId}/cloud-queue`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setCloudMeta(data.channel);
        setCloudQueue(data.videos || []);
        if (data.channel) {
          setScheduleForm({
            scheduledTime: data.channel.scheduledTime || '12:00',
            videosPerDay: data.channel.videosPerDay || 1,
            customHashtags: data.channel.customHashtags || '#Shorts #viral #fyp #AI',
            privacyStatus: data.channel.privacyStatus || 'public',
          });
        }
      }
    } catch (e) {
      console.error('Failed to load cloud queue', e);
    } finally {
      setIsQueueLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCloudChannelId) {
      fetchCloudQueue(selectedCloudChannelId);
    }
  }, [selectedCloudChannelId]);

  const handleConnectChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.refreshToken) {
      addToast('Refresh token is required.', 'error');
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
        addToast(`YouTube Channel "${data.name}" connected!`, 'success');
        setShowChannelModal(false);
        setChannelForm({ refreshToken: '', clientId: '', clientSecret: '', customName: '' });
        fetchData();
        if (!selectedCloudChannelId) {
          setSelectedCloudChannelId(data.id);
        }
      } else {
        addToast(`Connection failed: ${data.message || 'Check credentials'}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error connecting channel: ${err.message}`, 'error');
    } finally {
      setIsSubmittingChannel(false);
    }
  };

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
        addToast(`Mapping for @${data.tiktokUsername} created!`, 'success');
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

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCloudChannelId) return;
    setIsSavingSchedule(true);
    try {
      const res = await fetch(`/api/tiktok-youtube/channels/${selectedCloudChannelId}/cloud-schedule`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(scheduleForm),
      });
      if (res.ok) {
        addToast('Schedule updated successfully!', 'success');
        setShowScheduleModal(false);
        fetchCloudQueue(selectedCloudChannelId);
      } else {
        addToast('Failed to update schedule', 'error');
      }
    } catch (e: any) {
      addToast(`Error saving schedule: ${e.message}`, 'error');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleBulkCloudUpload = async () => {
    if (cloudFiles.length === 0 || !selectedCloudChannelId) {
      addToast('Please select at least 1 video file (.mp4).', 'error');
      return;
    }
    setIsUploadingCloud(true);
    setUploadProgress(0);

    const token = localStorage.getItem('token');
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < cloudFiles.length; i++) {
      const file = cloudFiles[i];
      const formData = new FormData();
      formData.append('video', file);

      try {
        const res = await fetch(`/api/tiktok-youtube/channels/${selectedCloudChannelId}/cloud-upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
      setUploadProgress(Math.round(((i + 1) / cloudFiles.length) * 100));
    }

    setIsUploadingCloud(false);
    setCloudFiles([]);
    setUploadProgress(0);

    if (successCount > 0) {
      addToast(`Uploaded ${successCount} video(s) to Cloud Queue!`, 'success');
      fetchCloudQueue(selectedCloudChannelId);
    }
    if (failCount > 0) {
      addToast(`Failed to upload ${failCount} video(s).`, 'error');
    }
  };

  const handlePostNextVideo = async () => {
    if (!selectedCloudChannelId) return;
    setIsPostingNext(true);
    addToast('Posting next queued video to YouTube Shorts...', 'info');
    try {
      const res = await fetch(`/api/tiktok-youtube/channels/${selectedCloudChannelId}/post-next`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Video posted to YouTube Shorts!', 'success');
        fetchCloudQueue(selectedCloudChannelId);
        fetchData();
      } else {
        addToast(`Upload failed: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (e: any) {
      addToast(`Error posting video: ${e.message}`, 'error');
    } finally {
      setIsPostingNext(false);
    }
  };

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
        addToast('Failed to update status', 'error');
      }
    } catch (_) {
      fetchData();
      addToast('Error updating status', 'error');
    }
  };

  const handleManualSync = async (id: string, username: string) => {
    setSyncingMappingId(id);
    addToast(`Scanning @${username} for newest videos...`, 'info');
    try {
      const res = await fetch(`/api/tiktok-youtube/mappings/${id}/sync`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(data.message || 'Sync completed!', 'success');
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

  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    try {
      let endpoint = '';
      if (type === 'mapping') endpoint = `/api/tiktok-youtube/mappings/${id}`;
      else if (type === 'channel') endpoint = `/api/tiktok-youtube/channels/${id}`;
      else if (type === 'cloudVideo') endpoint = `/api/tiktok-youtube/channels/${selectedCloudChannelId}/cloud-queue/${id}`;
      else if (type === 'clearQueue') endpoint = `/api/tiktok-youtube/channels/${selectedCloudChannelId}/cloud-queue`;

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        addToast('Deleted successfully.', 'success');
        if (type === 'cloudVideo' || type === 'clearQueue') {
          fetchCloudQueue(selectedCloudChannelId);
        } else {
          fetchData();
        }
      } else {
        addToast('Failed to delete', 'error');
      }
    } catch (err: any) {
      addToast(`Delete error: ${err.message}`, 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6 pb-12">
      {/* Executive Clean Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Youtube className="w-8 h-8 text-red-500 shrink-0" />
            <span>TikTok ➔ YouTube Automation</span>
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Auto-post TikTok creators & schedule Cloud AI videos to YouTube Shorts.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowChannelModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm border border-gray-700 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4 text-red-400" />
            <span>Connect Channel</span>
          </button>
          <button
            onClick={() => {
              if (channels.length === 0) {
                addToast('Please connect a YouTube channel first.', 'info');
                setShowChannelModal(true);
                return;
              }
              setShowMappingModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-600/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>New TikTok Mapping</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Channels</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalChannels || channels.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <Youtube className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">TikTok Mappings</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.activeMappings || mappings.filter(m => m.status === 'ACTIVE').length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cloud Queue</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{cloudQueue.filter(v => v.status === 'PENDING').length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Shorts Posted</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.totalUploaded || history.filter(h => h.status === 'COMPLETED').length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Modern Tabs Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-gray-900/60 p-1.5 rounded-2xl border border-gray-800 inline-flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab('mappings')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'mappings'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>TikTok Mappings ({mappings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'cloud'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud Upload & Schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'channels'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>Channels ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>History ({history.length})</span>
          </button>
        </div>

        <button
          onClick={() => {
            fetchData();
            if (selectedCloudChannelId) fetchCloudQueue(selectedCloudChannelId);
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white text-xs font-medium transition-all active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TAB 1: TIKTOK CREATOR MAPPINGS */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          {mappings.length === 0 ? (
            <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
              <Layers className="w-10 h-10 text-gray-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">No Creator Mappings Configured</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                  Link a TikTok creator to a YouTube channel. New videos will be automatically downloaded and posted to YouTube Shorts.
                </p>
              </div>
              <button
                onClick={() => {
                  if (channels.length === 0) {
                    addToast('Connect a YouTube Channel first.', 'info');
                    setShowChannelModal(true);
                  } else {
                    setShowMappingModal(true);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-600/25 transition-all"
              >
                + Add First Mapping
              </button>
            </div>
          ) : (
            <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900/80 text-gray-300 uppercase font-semibold text-xs border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4">TikTok Creator</th>
                    <th className="px-6 py-4">Target Channel</th>
                    <th className="px-6 py-4">Hashtags</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {mappings.map((mapping) => {
                    const isSyncing = syncingMappingId === mapping.id;
                    const channel = mapping.youtubeChannel;
                    return (
                      <tr key={mapping.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 font-bold flex items-center justify-center shrink-0">
                              {mapping.tiktokUsername.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <a
                                href={mapping.tiktokUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-white hover:text-cyan-400 flex items-center gap-1.5 truncate"
                              >
                                <span>@{mapping.tiktokUsername}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              </a>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {channel?.thumbnailUrl ? (
                              <img src={channel.thumbnailUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                                <Youtube className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <span className="font-medium text-white truncate max-w-[180px]">{channel?.name || 'Channel'}</span>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs font-mono text-gray-300">
                          <span className="truncate block max-w-[200px]" title={mapping.customHashtags}>
                            {mapping.customHashtags || '#Shorts'}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleMappingStatus(mapping.id, mapping.status)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              mapping.status === 'ACTIVE'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                            }`}
                          >
                            {mapping.status === 'ACTIVE' ? 'Active' : 'Paused'}
                          </button>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleManualSync(mapping.id, mapping.tiktokUsername)}
                              disabled={isSyncing}
                              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                            >
                              <Play className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                            </button>

                            <button
                              onClick={() => setDeleteConfirm({ type: 'mapping', id: mapping.id, name: `@${mapping.tiktokUsername}` })}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLOUD UPLOAD & SCHEDULE */}
      {activeTab === 'cloud' && (
        <div className="space-y-6">
          {/* Channel Selector & Settings Bar */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="text-gray-400 font-semibold text-sm shrink-0">Channel:</span>
              <select
                value={selectedCloudChannelId}
                onChange={(e) => setSelectedCloudChannelId(e.target.value)}
                className="px-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white font-medium text-sm focus:outline-none focus:border-indigo-500 w-full md:w-64"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {cloudMeta && (
              <div className="flex items-center gap-5 flex-wrap text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="text-gray-400">Folder:</span>
                  <span className="font-mono text-white text-xs">{cloudMeta.cloudFolderName || `[YouTube] ${cloudMeta.name}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-gray-400">Schedule:</span>
                  <span className="font-semibold text-white">{cloudMeta.scheduledTime || 'OFF'}</span>
                  <span className="text-xs text-gray-400">({cloudMeta.videosPerDay || 1}/day)</span>
                </div>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/20 transition-all"
                >
                  Edit Schedule
                </button>
              </div>
            )}
          </div>

          {/* Bulk Uploader Card */}
          <div className="bg-gray-900/40 backdrop-blur-xl border border-dashed border-gray-700 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <UploadCloud className="w-10 h-10 text-indigo-400 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Upload AI Videos to YouTube Cloud</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Video filename automatically becomes the title & caption on YouTube Shorts.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              <input
                type="file"
                multiple
                accept="video/mp4,video/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setCloudFiles(Array.from(e.target.files));
                  }
                }}
                id="cloud-file-input"
                className="hidden"
              />
              <label
                htmlFor="cloud-file-input"
                className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold cursor-pointer border border-gray-700 shadow-md transition-all active:scale-95"
              >
                Select MP4 Files
              </label>

              {cloudFiles.length > 0 && (
                <div className="w-full max-w-md p-4 rounded-2xl bg-gray-950 border border-gray-800 space-y-3 text-left">
                  <div className="flex justify-between items-center text-xs text-gray-300 font-medium">
                    <span>{cloudFiles.length} file(s) selected</span>
                    <button onClick={() => setCloudFiles([])} className="text-red-400 hover:underline text-xs">Clear</button>
                  </div>
                  <button
                    onClick={handleBulkCloudUpload}
                    disabled={isUploadingCloud}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25"
                  >
                    {isUploadingCloud ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading... {uploadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload to Cloud Queue</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Queue Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Cloud Queue ({cloudQueue.length})</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePostNextVideo}
                  disabled={isPostingNext || cloudQueue.filter(v => v.status === 'PENDING').length === 0}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-md shadow-green-600/20"
                >
                  <Send className={`w-3.5 h-3.5 ${isPostingNext ? 'animate-spin' : ''}`} />
                  <span>{isPostingNext ? 'Posting...' : 'Post Next Now'}</span>
                </button>
                {cloudQueue.length > 0 && (
                  <button
                    onClick={() => setDeleteConfirm({ type: 'clearQueue', id: selectedCloudChannelId, name: 'entire queue' })}
                    className="text-gray-500 hover:text-red-400 font-medium text-xs px-3 py-2"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {isQueueLoading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading queue...</div>
            ) : cloudQueue.length === 0 ? (
              <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 text-center text-sm text-gray-500 shadow-xl">
                Cloud queue is empty. Upload MP4 videos above to schedule automated daily posting.
              </div>
            ) : (
              <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-gray-900/80 text-gray-300 uppercase font-semibold text-xs border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 w-12">#</th>
                      <th className="px-6 py-4">Title / Filename</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {cloudQueue.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{idx + 1}</td>
                        <td className="px-6 py-4 max-w-sm">
                          <div className="font-semibold text-white truncate" title={item.title}>{item.title}</div>
                          <div className="text-xs text-gray-500 truncate">{item.filename}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            item.status === 'COMPLETED'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : item.status === 'PROCESSING'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                              : item.status === 'FAILED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {item.status === 'COMPLETED' ? 'POSTED' : item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            {item.youtubeUrl && (
                              <a
                                href={item.youtubeUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-gray-800 transition-colors"
                                title="View Shorts"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => setDeleteConfirm({ type: 'cloudVideo', id: item.id, name: item.title })}
                              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CHANNELS */}
      {activeTab === 'channels' && (
        <div className="space-y-4">
          {channels.length === 0 ? (
            <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-12 text-center space-y-4 shadow-xl">
              <Youtube className="w-10 h-10 text-gray-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">No YouTube Channels Connected</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
                  Connect your YouTube channel via Google OAuth refresh token for permanent automated uploads.
                </p>
              </div>
              <button
                onClick={() => setShowChannelModal(true)}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-lg shadow-red-600/25 transition-all"
              >
                + Connect YouTube Channel
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {channel.thumbnailUrl ? (
                        <img src={channel.thumbnailUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                          <Youtube className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-white text-base truncate">{channel.name}</div>
                        <div className="text-xs text-gray-500 font-mono truncate">ID: {channel.channelId}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => setDeleteConfirm({ type: 'channel', id: channel.id, name: channel.name })}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-gray-800/80 space-y-1.5 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Cloud Folder:</span>
                      <span className="font-mono text-indigo-300 font-medium">{channel.cloudFolderName || `[YouTube] ${channel.name}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily Schedule:</span>
                      <span className="text-white font-medium">{channel.scheduledTime || 'OFF'} ({channel.videosPerDay || 1}/day)</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedCloudChannelId(channel.id);
                        setActiveTab('cloud');
                      }}
                      className="w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-xs border border-indigo-500/30 transition-all text-center"
                    >
                      Open Cloud Queue
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCloudChannelId(channel.id);
                        setShowScheduleModal(true);
                      }}
                      className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-all"
                      title="Schedule Settings"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl p-12 text-center text-sm text-gray-500 shadow-xl">
              No videos posted yet. Mapped TikTok videos and scheduled Cloud uploads will appear here.
            </div>
          ) : (
            <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-900/80 text-gray-300 uppercase font-semibold text-xs border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4">Channel</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Shorts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 max-w-sm font-medium text-white truncate" title={item.title}>
                        {item.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.tiktokUrl ? (
                          <a href={item.tiktokUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-medium">
                            @{item.mapping?.tiktokUsername || 'creator'}
                          </a>
                        ) : (
                          <span className="text-indigo-400 font-medium">Cloud AI</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                        {item.youtubeChannel?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          item.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                        {new Date(item.uploadedAt || item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {item.youtubeUrl ? (
                          <a
                            href={item.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-medium text-xs hover:underline"
                          >
                            <span>Watch</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white">YouTube Cloud Schedule</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Times (PKT, Comma-separated)</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.scheduledTime}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledTime: e.target.value })}
                  placeholder="12:00, 18:00"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold text-xs">Videos Per Day</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={scheduleForm.videosPerDay}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, videosPerDay: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-300 font-semibold text-xs">Privacy</label>
                  <select
                    value={scheduleForm.privacyStatus}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, privacyStatus: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Custom Hashtags</label>
                <input
                  type="text"
                  value={scheduleForm.customHashtags}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, customHashtags: e.target.value })}
                  placeholder="#Shorts #viral #fyp"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSchedule}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/25 transition-all"
                >
                  {isSavingSchedule ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONNECT CHANNEL */}
      {showChannelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white">Connect YouTube Channel</h3>
              <button onClick={() => setShowChannelModal(false)} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleConnectChannel} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Google OAuth Refresh Token *</label>
                <textarea
                  required
                  rows={3}
                  value={channelForm.refreshToken}
                  onChange={(e) => setChannelForm({ ...channelForm, refreshToken: e.target.value })}
                  placeholder="Paste refresh token"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Channel Label (Optional)</label>
                <input
                  type="text"
                  value={channelForm.customName}
                  onChange={(e) => setChannelForm({ ...channelForm, customName: e.target.value })}
                  placeholder="e.g. My AI Channel"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Collapsible guide */}
              <div className="border border-gray-800 rounded-2xl overflow-hidden bg-gray-950/40">
                <button
                  type="button"
                  onClick={() => setShowHelpGuide(!showHelpGuide)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-gray-400 hover:text-white"
                >
                  <span>How to get Refresh Token?</span>
                  {showHelpGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showHelpGuide && (
                  <div className="p-4 pt-0 text-xs text-gray-400 space-y-1.5 border-t border-gray-800">
                    <p>1. Open Google Cloud Console & enable YouTube Data API v3.</p>
                    <p>2. Create OAuth 2.0 Web Client ID.</p>
                    <p>3. Use OAuth Playground to authorize scope: <code className="text-red-400">https://www.googleapis.com/auth/youtube.upload</code></p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowChannelModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChannel}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-md shadow-red-600/25 transition-all"
                >
                  {isSubmittingChannel ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MAPPING */}
      {showMappingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <h3 className="text-lg font-bold text-white">New TikTok Mapping</h3>
              <button onClick={() => setShowMappingModal(false)} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateMapping} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">TikTok Creator URL / Handle *</label>
                <input
                  type="text"
                  required
                  value={mappingForm.tiktokUrl}
                  onChange={(e) => setMappingForm({ ...mappingForm, tiktokUrl: e.target.value })}
                  placeholder="@creator or https://www.tiktok.com/@creator"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Target YouTube Channel *</label>
                <select
                  required
                  value={mappingForm.youtubeChannelId}
                  onChange={(e) => setMappingForm({ ...mappingForm, youtubeChannelId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                >
                  <option value="">-- Select Channel --</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-300 font-semibold text-xs">Hashtags (Appended to caption)</label>
                <input
                  type="text"
                  value={mappingForm.customHashtags}
                  onChange={(e) => setMappingForm({ ...mappingForm, customHashtags: e.target.value })}
                  placeholder="#Shorts #viral #fyp"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 rounded-xl text-gray-400 hover:text-white text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMapping}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm shadow-md shadow-red-600/25 transition-all"
                >
                  {isSubmittingMapping ? 'Creating...' : 'Create Mapping'}
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
          title="Confirm Delete"
          message={`Are you sure you want to delete "${deleteConfirm.name}"?`}
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
