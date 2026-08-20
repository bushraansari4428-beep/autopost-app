'use client';
import { useState, useEffect } from 'react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function MappingsPage() {
  const [mappings, setMappings] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  // Form state
  const [sourceId, setSourceId] = useState('');
  const [facebookPageId, setFacebookPageId] = useState('');
  const [videosPerDay, setVideosPerDay] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchMappings = async () => {
    try {
      const res = await fetch('/api/mappings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      setMappings(data);
    } catch (error) {
      console.error('Failed to fetch mappings:', error);
    } finally {
      setLoading(false);
    }
  };

  const testMapping = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`/api/mappings/${id}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast('Test started! ' + data.message, 'success');
      } else {
        addToast('Test failed: ' + (data.message || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to test mapping:', error);
      addToast('Error triggering test.', 'error');
    } finally {
      setTestingId(null);
    }
  };
  
  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const [resSources, resPages] = await Promise.all([
        fetch('/api/sources', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/pages', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (resSources.ok) setSources(await resSources.json());
      if (resPages.ok) setPages(await resPages.json());
    } catch (err) {
      console.error('Failed to fetch options', err);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchOptions();
  }, []);

  const deleteMapping = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/mappings/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchMappings();
  };

  const updateScheduleTime = async (id: string, time: string) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, scheduledTime: time } : m));
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/mappings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scheduledTime: time || null })
      });
    } catch (err) {
      console.error('Failed to update scheduled time', err);
    }
  };

  const updateVideosPerDay = async (id: string, count: number) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, videosPerDay: count } : m));
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/mappings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ videosPerDay: count })
      });
    } catch (err) {
      console.error('Failed to update videos per day', err);
    }
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !facebookPageId) return;
    
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sourceId, facebookPageId, videosPerDay })
      });
      if (res.ok) {
        setShowModal(false);
        setSourceId('');
        setFacebookPageId('');
        fetchMappings();
      } else {
        const errText = await res.text();
        setErrorMsg('Error: ' + errText);
      }
    } catch (err: any) {
      console.error('Failed to add mapping', err);
      setErrorMsg('Network error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Source Mappings</h1>
          <p className="text-gray-400 mt-1">Configure which videos go to which Facebook Pages.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold shadow-lg shadow-purple-500/25 transition-all transform hover:scale-105 active:scale-95"
        >
          + Create Mapping
        </button>
      </div>

      <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl p-6">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading mappings...</div>
        ) : mappings.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p className="text-lg mb-2">No mappings configured.</p>
            <p className="text-sm">Click "Create Mapping" to link a Source to a Facebook Page.</p>
          </div>
        ) : (
          mappings.map(mapping => (
            <div key={mapping.id} className="flex items-center justify-between p-4 bg-gray-800/40 border border-gray-700/50 rounded-2xl hover:bg-gray-800/60 transition-colors mb-4 last:mb-0">
              <div className="flex items-center gap-6">
                <div className="text-center w-32">
                  <span className="block text-sm text-gray-400 mb-1">Source</span>
                  <span className="font-bold text-white truncate block">{mapping.source?.name || 'Unknown'}</span>
                  <span className="block text-xs text-gray-500 mt-1">{mapping.source?.platform}</span>
                </div>
                <div className="text-gray-600 animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </div>
                <div className="text-center w-32">
                  <span className="block text-sm text-gray-400 mb-1">Destination</span>
                  <span className="font-bold text-[#1877F2] truncate block">{mapping.facebookPage?.name || 'Unknown'}</span>
                  <span className="block text-xs text-gray-500 mt-1">Facebook Page</span>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-1">Schedule (PKT)</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={mapping.scheduledTime || ''}
                      onChange={(e) => updateScheduleTime(mapping.id, e.target.value)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500"
                      title="Set to 00:00 to turn off scheduling"
                    />
                  </div>
                </div>
                {mapping.source?.platform === 'MEGA_CLOUD' && (
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-purple-400 mb-1 font-semibold">Videos / Day</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={mapping.videosPerDay || 1}
                      onChange={(e) => updateVideosPerDay(mapping.id, parseInt(e.target.value))}
                      className="bg-gray-800 border border-purple-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-purple-500 w-16 text-center"
                    />
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-bold text-green-400">ACTIVE</span>
                </div>
                <button 
                  onClick={() => testMapping(mapping.id)} 
                  disabled={testingId === mapping.id}
                  className="text-blue-400 hover:text-blue-300 font-medium px-2 disabled:opacity-50"
                >
                  {testingId === mapping.id ? 'Testing...' : 'Test'}
                </button>
                <button onClick={() => setDeleteConfirmId(mapping.id)} className="text-red-400 hover:text-red-300">Remove</button>
              </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Create New Route</h2>
            {errorMsg && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAddMapping} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Select Source</label>
                <select 
                  value={sourceId} 
                  onChange={(e) => setSourceId(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="" disabled>Select a source...</option>
                  {sources.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.platform})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Select Destination Facebook Page</label>
                <select 
                  value={facebookPageId} 
                  onChange={(e) => setFacebookPageId(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="" disabled>Select a page...</option>
                  {pages.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {sources.find(s => s.id === sourceId)?.platform === 'MEGA_CLOUD' && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Videos per Day (Auto-scheduled 1 min apart)</label>
                  <input 
                    type="number" 
                    min="1"
                    max="100"
                    value={videosPerDay} 
                    onChange={(e) => setVideosPerDay(parseInt(e.target.value))} 
                    required 
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !sourceId || !facebookPageId}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Creating...' : 'Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Remove Mapping"
        message="Are you sure you want to remove this mapping connection?"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteMapping(deleteConfirmId);
            addToast('Mapping removed successfully', 'info');
            setDeleteConfirmId(null);
          }
        }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
