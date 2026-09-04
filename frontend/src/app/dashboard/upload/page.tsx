'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Cloud,
  Video,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ExternalLink,
  Clock,
  Layers,
  Calendar,
  CheckSquare,
  Square,
  X,
  Sparkles,
  Inbox
} from 'lucide-react';

interface CloudVideo {
  id: string;
  title: string;
  description?: string;
  url: string;
  originalId: string;
  createdAt: string;
  queuePosition: number;
  status: 'QUEUED' | 'POSTING' | 'FAILED';
}

interface QueueMeta {
  pageId: string;
  pageName: string;
  totalCount: number;
  scheduledTime: string | null;
  videosPerDay: number;
}

export default function CloudUploadPage() {
  const router = useRouter();
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Cloud queue states
  const [queueVideos, setQueueVideos] = useState<CloudVideo[]>([]);
  const [queueMeta, setQueueMeta] = useState<QueueMeta | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'single' | 'selected' | 'all';
    videoId?: string;
    videoTitle?: string;
    count?: number;
  }>({
    isOpen: false,
    type: 'single'
  });

  useEffect(() => {
    fetchPages();
  }, []);

  useEffect(() => {
    if (selectedPageId) {
      fetchCloudQueue(selectedPageId);
      setSelectedVideoIds([]);
      setSearchQuery('');
    }
  }, [selectedPageId]);

  const fetchPages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data);
        if (data.length > 0 && !selectedPageId) {
          setSelectedPageId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch pages', e);
    }
  };

  const fetchCloudQueue = async (pageId: string) => {
    if (!pageId) return;
    setIsQueueLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${pageId}/cloud-queue`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        setQueueVideos(data.videos || []);
        setQueueMeta(data);
      } else {
        console.error('Failed to fetch queue:', await res.text());
      }
    } catch (err) {
      console.error('Failed to fetch cloud queue', err);
    } finally {
      setIsQueueLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFiles = Array.from(e.dataTransfer.files).filter(
        f => f.type === 'video/mp4' || f.name.toLowerCase().endsWith('.mp4')
      );
      if (selectedFiles.length < e.dataTransfer.files.length) {
        setMessage({ type: 'error', text: 'Only MP4 videos are allowed.' });
      }
      setFiles(prev => [...prev, ...(selectedFiles as File[])]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(
        f => f.type === 'video/mp4' || f.name.toLowerCase().endsWith('.mp4')
      );
      if (selectedFiles.length < e.target.files.length) {
        setMessage({ type: 'error', text: 'Only MP4 videos are allowed.' });
      }
      setFiles(prev => [...prev, ...(selectedFiles as File[])]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage({ type: 'error', text: 'Please select video files to upload.' });
      return;
    }
    if (!selectedPageId) {
      setMessage({ type: 'error', text: 'Please select a Facebook Page.' });
      return;
    }

    setIsUploading(true);
    setMessage({ type: '', text: '' });
    const token = localStorage.getItem('token');

    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(i + 1);
      const formData = new FormData();
      formData.append('video', file);

      try {
        const res = await fetch(`/api/pages/${selectedPageId}/cloud-upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (res.ok) {
          successCount++;
        }
      } catch (e: any) {
        console.error('Upload failed for', file.name, e);
      }
    }

    if (successCount === files.length) {
      setMessage({
        type: 'success',
        text: `Successfully uploaded ${successCount} video(s) to Cloud! They are queued to post.`
      });
      setFiles([]);
    } else if (successCount > 0) {
      setMessage({
        type: 'success',
        text: `Uploaded ${successCount} out of ${files.length} videos successfully.`
      });
      setFiles(files.slice(successCount));
    } else {
      setMessage({ type: 'error', text: 'Upload failed for all videos.' });
    }

    setUploadProgress(0);
    setIsUploading(false);
    const fileInput = document.getElementById('video-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';

    // Refresh pages and the queue for the current page
    await fetchPages();
    await fetchCloudQueue(selectedPageId);
  };

  // Open single delete modal
  const openSingleDeleteModal = (videoId: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      videoId,
      videoTitle: title
    });
  };

  // Open selected delete modal
  const openSelectedDeleteModal = () => {
    if (selectedVideoIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'selected',
      count: selectedVideoIds.length
    });
  };

  // Open clear all modal
  const openClearAllModal = () => {
    if (queueVideos.length === 0) return;
    setConfirmModal({
      isOpen: true,
      type: 'all',
      count: queueVideos.length
    });
  };

  // Execute single delete
  const confirmDeleteSingle = async () => {
    if (!confirmModal.videoId || !selectedPageId) return;
    setDeletingVideoId(confirmModal.videoId);
    setIsActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${selectedPageId}/cloud-queue/${confirmModal.videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Video deleted from cloud queue.' });
        setQueueVideos(prev => prev.filter(v => v.id !== confirmModal.videoId));
        setSelectedVideoIds(prev => prev.filter(id => id !== confirmModal.videoId));
        fetchPages();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete video.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error occurred while deleting video.' });
    } finally {
      setIsActionLoading(false);
      setDeletingVideoId(null);
      setConfirmModal({ isOpen: false, type: 'single' });
    }
  };

  // Execute batch delete (selected or all)
  const confirmBatchDelete = async () => {
    if (!selectedPageId) return;
    setIsActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const isAll = confirmModal.type === 'all';
      const body = isAll ? {} : { videoIds: selectedVideoIds };
      const res = await fetch(`/api/pages/${selectedPageId}/cloud-queue`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Videos deleted successfully.' });
        if (isAll) {
          setQueueVideos([]);
          setSelectedVideoIds([]);
        } else {
          setQueueVideos(prev => prev.filter(v => !selectedVideoIds.includes(v.id)));
          setSelectedVideoIds([]);
        }
        fetchPages();
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete videos.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error occurred.' });
    } finally {
      setIsActionLoading(false);
      setConfirmModal({ isOpen: false, type: 'all' });
    }
  };

  // Multi-select toggle
  const toggleSelectVideo = (id: string) => {
    setSelectedVideoIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVideoIds.length === filteredVideos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(filteredVideos.map(v => v.id));
    }
  };

  // Filter videos by search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return queueVideos;
    const q = searchQuery.toLowerCase();
    return queueVideos.filter(
      v =>
        v.title?.toLowerCase().includes(q) ||
        v.originalId?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
    );
  }, [queueVideos, searchQuery]);

  const selectedPage = pages.find(p => p.id === selectedPageId);
  const selectedPageName = selectedPage?.name || 'Selected Page';
  const totalQueueCount = selectedPage?.cloudQueueCount || queueVideos.length || 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Top Banner Header */}
      <div className="bg-gray-900 p-6 md:p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <Cloud className="w-6 h-6" />
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Cloud Video Uploader & Queue
              </h1>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
              Upload local videos to Mega Cloud so the system posts them automatically to your Facebook Pages, even when your PC is turned off. Videos are auto-cleaned after posting!
            </p>
          </div>
          <div className="p-3 bg-gray-950/80 border border-gray-800 rounded-xl text-xs text-gray-400 shrink-0">
            <span className="font-semibold text-blue-400">Mega.nz Storage</span>
            <p className="text-gray-500 mt-0.5">Credentials configured in My Cloud Profile</p>
          </div>
        </div>
      </div>

      {/* Pages Cloud Status Bar */}
      {pages.length > 0 && (
        <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800/80 backdrop-blur">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Pages Cloud Queue Status
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {pages.length} Page{pages.length !== 1 ? 's' : ''} Connected
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {pages.map(page => {
              const isSelected = page.id === selectedPageId;
              const count = page.cloudQueueCount || 0;
              return (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center space-x-2.5 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500 ring-2 ring-blue-500/30'
                      : 'bg-gray-950/70 hover:bg-gray-800 text-gray-300 border border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <span className="truncate max-w-[160px]">{page.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : count > 0
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    {count} {count === 1 ? 'video' : 'videos'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Uploader Form Card */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl">
        {/* Page Selector */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-semibold text-gray-300">Select Target Facebook Page</label>
            {selectedPageId && (
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-400">Current Queue:</span>
                <span className="font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                  {totalQueueCount} video(s) remaining
                </span>
                {queueMeta?.scheduledTime && (
                  <span className="text-gray-400 bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-700 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>{queueMeta.scheduledTime} UTC ({queueMeta.videosPerDay}/day)</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <select
            value={selectedPageId}
            onChange={e => setSelectedPageId(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          >
            {pages.length === 0 && <option value="">No Pages Connected</option>}
            {pages.map(page => (
              <option key={page.id} value={page.id}>
                {page.name} ({page.cloudQueueCount || 0} videos in cloud)
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500">
            Videos uploaded here are assigned directly to {selectedPageName}'s cloud queue and will post automatically in sequence.
          </p>
        </div>

        {/* Drag & Drop Box */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : files.length > 0
              ? 'border-green-500/50 bg-green-500/5'
              : 'border-gray-700 hover:border-gray-600 bg-gray-950'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="video-upload"
            accept="video/mp4"
            multiple
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />

          <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
            {files.length > 0 ? (
              <div className="w-full max-h-60 overflow-y-auto z-10 relative space-y-2 pointer-events-auto text-left">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-base font-semibold text-white">
                    {files.length} video{files.length !== 1 ? 's' : ''} ready to upload
                  </p>
                  <p className="text-xs text-gray-500">Add more by dragging or clicking</p>
                </div>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-gray-900/90 p-3 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div className="w-9 h-9 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                        <p className="text-xs text-gray-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      disabled={isUploading}
                      className="text-red-400 hover:text-red-300 p-2 shrink-0 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
                  <Cloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Drag & drop MP4 videos here</p>
                  <p className="text-sm text-gray-400">or click to browse multiple files from your computer</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {message.text && (
          <div
            className={`mt-6 p-4 rounded-xl border flex items-start justify-between ${
              message.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <div className="flex items-start space-x-3">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              )}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
            <button
              onClick={() => setMessage({ type: '', text: '' })}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Upload Button */}
        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || !selectedPageId || isUploading}
            className={`w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200 flex justify-center items-center shadow-lg ${
              files.length === 0 || !selectedPageId || isUploading
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
            }`}
          >
            {isUploading ? (
              <>
                <RefreshCw className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                Uploading {uploadProgress} of {files.length}... Please wait
              </>
            ) : (
              `Upload & Schedule ${files.length > 0 ? `${files.length} Video${files.length > 1 ? 's' : ''}` : 'Videos'}`
            )}
          </button>
        </div>
      </div>

      {/* CLOUD QUEUE INSPECTION & MANAGEMENT SECTION */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 md:p-8 shadow-xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-800">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl md:text-2xl font-bold text-white">
                Cloud Queue for <span className="text-blue-400">{selectedPageName}</span>
              </h2>
              <span className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-bold">
                {queueVideos.length} Queued
              </span>
            </div>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Inspect video titles, posting order, or delete specific videos from this page's cloud queue.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => selectedPageId && fetchCloudQueue(selectedPageId)}
              disabled={isQueueLoading}
              className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 disabled:opacity-50"
              title="Refresh queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isQueueLoading ? 'animate-spin text-blue-400' : ''}`} />
              <span>Refresh</span>
            </button>

            {selectedVideoIds.length > 0 && (
              <button
                onClick={openSelectedDeleteModal}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedVideoIds.length})</span>
              </button>
            )}

            <button
              onClick={openClearAllModal}
              disabled={queueVideos.length === 0 || isActionLoading}
              className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2"
              title="Delete all videos in this page queue"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All Queue</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search and Select All */}
        {queueVideos.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 pb-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search queued videos by title..."
                className="w-full pl-10 pr-9 py-2 bg-gray-950 border border-gray-800 rounded-xl text-xs md:text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-3 text-xs text-gray-400">
              <button
                onClick={toggleSelectAll}
                className="flex items-center space-x-1.5 hover:text-white transition-colors"
              >
                {selectedVideoIds.length > 0 && selectedVideoIds.length === filteredVideos.length ? (
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                ) : (
                  <Square className="w-4 h-4 text-gray-500" />
                )}
                <span>Select All ({filteredVideos.length})</span>
              </button>
              <span>•</span>
              <span>
                Showing {filteredVideos.length} of {queueVideos.length} video{queueVideos.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Queue Items List */}
        <div className="mt-4 space-y-2.5">
          {isQueueLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto opacity-75" />
              <p className="text-sm text-gray-400">Loading queued videos for {selectedPageName}...</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="py-14 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-950/40 p-8 space-y-3">
              <div className="w-14 h-14 bg-gray-800/80 rounded-full flex items-center justify-center text-gray-500 mx-auto">
                <Inbox className="w-7 h-7" />
              </div>
              {searchQuery ? (
                <>
                  <h3 className="text-base font-semibold text-white">No videos match "{searchQuery}"</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Try clearing the search query to see all queued videos for this page.
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-2 text-xs text-blue-400 hover:underline"
                  >
                    Clear search filter
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-white">No Videos in Cloud Queue</h3>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    This page currently has no videos stored in Mega Cloud. Drag and drop MP4 videos in the uploader above to queue them!
                  </p>
                </>
              )}
            </div>
          ) : (
            filteredVideos.map((video, idx) => {
              const isSelected = selectedVideoIds.includes(video.id);
              const isNext = video.queuePosition === 1;
              const isBeingDeleted = deletingVideoId === video.id;

              return (
                <div
                  key={video.id}
                  className={`p-4 rounded-xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-500/10 border-blue-500/40'
                      : isNext
                      ? 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/50'
                      : 'bg-gray-950/70 border-gray-800/90 hover:border-gray-700 hover:bg-gray-950'
                  }`}
                >
                  {/* Left: Selection + Order Badge + Info */}
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleSelectVideo(video.id)}
                      className="mt-1 text-gray-400 hover:text-white shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-600" />
                      )}
                    </button>

                    {/* Order badge */}
                    <div className="shrink-0 mt-0.5">
                      {isNext ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold shadow-sm shadow-emerald-500/10">
                          <Sparkles className="w-3 h-3" />
                          <span>#1 Next to Post</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded-lg text-xs font-semibold">
                          #{video.queuePosition}
                        </span>
                      )}
                    </div>

                    {/* Video metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4
                          className="text-sm font-semibold text-white truncate hover:text-blue-300 transition-colors"
                          title={video.title}
                        >
                          {video.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-400">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          <span>
                            {video.createdAt
                              ? new Date(video.createdAt).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Just now'}
                          </span>
                        </span>

                        <span className="text-gray-600">•</span>

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            video.status === 'POSTING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : video.status === 'FAILED'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {video.status === 'POSTING'
                            ? 'Posting Now...'
                            : video.status === 'FAILED'
                            ? 'Failed (Will Retry)'
                            : 'Waiting in Queue'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-end space-x-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-800/60">
                    {video.url && (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-800/80 rounded-lg text-xs font-medium transition-all flex items-center space-x-1"
                        title="View file link on Mega Cloud"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mega</span>
                      </a>
                    )}

                    <button
                      onClick={() => openSingleDeleteModal(video.id, video.title)}
                      disabled={isBeingDeleted || isActionLoading}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 disabled:opacity-50"
                      title="Delete this video from queue"
                    >
                      {isBeingDeleted ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                {confirmModal.type === 'single'
                  ? 'Delete Video from Queue?'
                  : confirmModal.type === 'selected'
                  ? `Delete ${confirmModal.count} Selected Videos?`
                  : 'Clear Entire Cloud Queue?'}
              </h3>
            </div>

            <div className="text-sm text-gray-300 leading-relaxed">
              {confirmModal.type === 'single' ? (
                <p>
                  Are you sure you want to delete <strong className="text-white">"{confirmModal.videoTitle}"</strong> from{' '}
                  <span className="text-blue-400 font-semibold">{selectedPageName}</span>'s cloud queue?
                </p>
              ) : confirmModal.type === 'selected' ? (
                <p>
                  Are you sure you want to delete <strong className="text-white">{confirmModal.count} selected videos</strong> from{' '}
                  <span className="text-blue-400 font-semibold">{selectedPageName}</span>'s cloud queue?
                </p>
              ) : (
                <p>
                  Are you sure you want to permanently delete all <strong className="text-white">{confirmModal.count} videos</strong> from{' '}
                  <span className="text-blue-400 font-semibold">{selectedPageName}</span>'s cloud queue?
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                This will delete the video file from your Mega.nz cloud storage and remove it from the scheduling queue.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: 'single' })}
                disabled={isActionLoading}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.type === 'single' ? confirmDeleteSingle : confirmBatchDelete}
                disabled={isActionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/20 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>
                  {confirmModal.type === 'single'
                    ? 'Delete Video'
                    : confirmModal.type === 'selected'
                    ? 'Delete Selected'
                    : 'Clear All Queue'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
