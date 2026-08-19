'use client';
import { useState, useEffect } from 'react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<any | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<{ id: string; name: string } | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  // Form state
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('YOUTUBE');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSources = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sources', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSources(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSource(null);
    setName('');
    setUrl('');
    setPlatform('YOUTUBE');
    setErrorMsg('');
    setShowModal(true);
  };

  const handleOpenEditModal = (source: any) => {
    setEditingSource(source);
    setName(source.name || '');
    setPlatform(source.platform || 'YOUTUBE');
    setUrl(source.url || '');
    setErrorMsg('');
    setShowModal(true);
  };

  const deleteSource = async (id: string, sourceName: string) => {
    setDeletingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/sources/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        addToast(`Source "${sourceName}" deleted successfully`, 'success');
      } else {
        const text = await res.text();
        addToast(`Failed to delete source: ${text}`, 'error');
      }
      await fetchSources();
    } catch (error: any) {
      console.error('Error deleting source:', error);
      addToast('Network error while deleting source.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const endpoint = editingSource ? `/api/sources/${editingSource.id}` : '/api/sources';
      const method = editingSource ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, platform, url })
      });
      
      if (res.ok) {
        setShowModal(false);
        setName('');
        setUrl('');
        setPlatform('YOUTUBE');
        setEditingSource(null);
        await fetchSources();
      } else {
        const errText = await res.text();
        console.error('Failed response:', errText);
        setErrorMsg('Error: ' + errText);
      }
    } catch (err: any) {
      console.error('Failed to save source', err);
      setErrorMsg('Network error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Source Accounts</h1>
          <p className="text-gray-400 mt-1">Manage all your connected source platforms (YouTube, Instagram, TikTok).</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all transform hover:scale-105 active:scale-95"
        >
          + Add Source
        </button>
      </div>

      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-sm text-gray-400">
          <thead className="bg-gray-900/80 text-gray-300 uppercase font-semibold border-b border-gray-800">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Platform</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last Checked</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading sources...</td>
              </tr>
            ) : sources.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-lg mb-2">No sources found.</p>
                  <p className="text-sm">Click "Add Source" to connect your first account.</p>
                </td>
              </tr>
            ) : (
              sources.map(source => (
                <tr key={source.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-6 py-5 font-medium text-white">{source.name}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      source.platform === 'YOUTUBE' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                      source.platform === 'INSTAGRAM' ? 'bg-pink-500/10 text-pink-500 border border-pink-500/20' : 
                      source.platform === 'XIAOHONGSHU' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                      source.platform === 'KUAISHOU' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' : 
                      source.platform === 'LOCAL_FOLDER' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                      'bg-black text-white border border-gray-700'
                    }`}>
                      {source.platform}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${source.status === 'ACTIVE' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className={source.status === 'ACTIVE' ? 'text-green-400' : 'text-yellow-400'}>{source.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">{source.lastChecked ? new Date(source.lastChecked).toLocaleString() : 'Never'}</td>
                  <td className="px-6 py-5 text-right font-medium">
                    <button 
                      onClick={() => handleOpenEditModal(source)}
                      className="text-blue-400 hover:text-blue-300 transition-colors focus:outline-none"
                    >
                      Edit
                    </button>
                    <span className="mx-2 text-gray-700">|</span>
                    <button 
                      disabled={deletingId === source.id}
                      onClick={() => setDeleteConfirmSource({ id: source.id, name: source.name })} 
                      className="text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors focus:outline-none"
                    >
                      {deletingId === source.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingSource ? 'Edit Source Account' : 'Add New Source'}
            </h2>
            {errorMsg && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Source Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  placeholder="e.g. My Tech Channel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Platform</label>
                <select 
                  value={platform} 
                  onChange={(e) => { 
                    setPlatform(e.target.value); 
                    if (e.target.value === 'LOCAL_FOLDER') setUrl('local://folder'); 
                    else setUrl(''); 
                  }} 
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="YOUTUBE">YouTube</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="XIAOHONGSHU">Xiaohongshu (RedNote)</option>
                  <option value="KUAISHOU">Kuaishou</option>
                  <option value="LOCAL_FOLDER">Local PC Folder</option>
                </select>
              </div>
              {platform !== 'LOCAL_FOLDER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Profile URL / Handle</label>
                  <input 
                    type="text" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    required 
                    className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    placeholder="https://youtube.com/@channel"
                  />
                </div>
              )}

              {platform === 'YOUTUBE' && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    How to add a YouTube Source perfectly
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Standard <code className="bg-gray-800 px-1 rounded text-gray-200">@handles</code> can sometimes be blocked by YouTube. For 100% reliable auto-posting, please use your <strong>YouTube Channel ID</strong> (starts with UC):
                  </p>
                  <ol className="list-decimal ml-5 mt-2 text-xs text-gray-400 space-y-1">
                    <li>Go to <a href="https://commentpicker.com/youtube-channel-id.php" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">CommentPicker YouTube ID tool</a>.</li>
                    <li>Paste your YouTube handle or link to get the <strong className="text-gray-200">UC...</strong> ID.</li>
                    <li>Enter ONLY the ID here (e.g. <code className="bg-gray-800 px-1 rounded text-gray-200">UCeHRZFTBJeG8hZco6i9RyVA</code>) OR the full URL. Both will work!</li>
                  </ol>
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30"
                >
                  {isSubmitting ? 'Saving...' : editingSource ? 'Update Source' : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal
        isOpen={!!deleteConfirmSource}
        title="Delete Source Account"
        message={`Are you sure you want to delete "${deleteConfirmSource?.name}"? Associated mappings and history will also be removed.`}
        onConfirm={() => {
          if (deleteConfirmSource) {
            deleteSource(deleteConfirmSource.id, deleteConfirmSource.name);
            setDeleteConfirmSource(null);
          }
        }}
        onClose={() => setDeleteConfirmSource(null)}
      />
    </div>
  );
}
