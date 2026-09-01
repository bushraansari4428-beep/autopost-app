'use client';
import { useState, useEffect } from 'react';
import { Clock, RotateCw } from 'lucide-react';
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
        addToast(data.message, 'success');
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

  const updateCustomHashtags = async (id: string, hashtags: string) => {
    setMappings(prev => prev.map(m => m.id === id ? { ...m, customHashtags: hashtags } : m));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/mappings/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ customHashtags: hashtags.trim() || null })
      });
      if (res.ok) {
        addToast('Custom hashtags saved for this page!', 'success');
      } else {
        addToast('Failed to save custom hashtags', 'error');
      }
    } catch (err) {
      console.error('Failed to update custom hashtags', err);
      addToast('Failed to save custom hashtags', 'error');
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
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.message || data?.error || 'Failed to create mapping. Please try again.');
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
            <div key={mapping.id} className="p-5 bg-gray-800/40 border border-gray-700/50 rounded-2xl hover:bg-gray-800/60 hover:border-gray-600/70 transition-all mb-4 last:mb-0 shadow-lg shadow-black/20 flex flex-col gap-4">
              
              {/* Tier 1: Header (Source -> Destination & Actions) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Route Pipeline */}
                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                  <div className="min-w-[130px]">
                    <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Source</span>
                    <span className="font-bold text-white truncate block text-sm leading-tight" title={mapping.source?.name}>{mapping.source?.name || 'Unknown'}</span>
                    <span className="inline-block text-[10px] font-medium text-slate-400 bg-slate-800/90 px-2 py-0.5 rounded-md border border-slate-700/60 mt-1 uppercase tracking-wide">{mapping.source?.platform}</span>
                  </div>
                  
                  <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </div>
                  
                  <div className="min-w-[130px]">
                    <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Destination</span>
                    <span className="font-bold text-[#1877F2] truncate block text-sm leading-tight" title={mapping.facebookPage?.name}>{mapping.facebookPage?.name || 'Unknown'}</span>
                    <span className="inline-block text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 mt-1">Facebook Page</span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl shadow-sm shadow-emerald-500/5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-xs font-bold text-emerald-400 tracking-wider">ACTIVE</span>
                  </div>
                  
                  <button 
                    onClick={() => testMapping(mapping.id)} 
                    disabled={testingId === mapping.id}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-blue-500/5 disabled:opacity-50 cursor-pointer"
                  >
                    {testingId === mapping.id ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Testing...</span>
                      </>
                    ) : (
                      <span>Test</span>
                    )}
                  </button>
                  
                  <button 
                    onClick={() => setDeleteConfirmId(mapping.id)} 
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-rose-500/5 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Tier 2: Schedule & Videos/Slot Toolbar */}
              <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
                {/* Schedule Timers (Inline sequence) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Schedule (PKT):</span>
                  </span>
                  
                  {(mapping.scheduledTime && mapping.scheduledTime !== '00:00' ? mapping.scheduledTime.split(',') : [] as string[]).map((t: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 rounded-lg px-2.5 py-1 shadow-sm">
                      <input 
                        type="time"
                        value={t.trim()}
                        onChange={(e) => {
                          if (e.target.value) {
                            const times = mapping.scheduledTime.split(',');
                            times[idx] = e.target.value;
                            updateScheduleTime(mapping.id, times.join(','));
                          }
                        }}
                        className="bg-transparent text-xs font-semibold text-slate-100 focus:outline-none cursor-pointer"
                      />
                      <button 
                        onClick={() => {
                          const times = mapping.scheduledTime.split(',').filter((_: any, i: number) => i !== idx);
                          updateScheduleTime(mapping.id, times.length > 0 ? times.join(',') : '00:00');
                        }}
                        className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors cursor-pointer"
                        title="Remove this slot"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      const times = mapping.scheduledTime && mapping.scheduledTime !== '00:00' ? mapping.scheduledTime.split(',') : [];
                      times.push('12:00');
                      updateScheduleTime(mapping.id, times.join(','));
                    }}
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition cursor-pointer shadow-sm" 
                    title="Add another time"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    <span>Add</span>
                  </button>
                </div>

                {/* Videos / Slot Quota (Cleanly integrated on the right) */}
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-700/60 pt-2.5 md:pt-0 md:pl-4">
                  <span className="text-xs font-semibold text-purple-300 whitespace-nowrap">Videos / Slot:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={mapping.videosPerDay || 1}
                    onChange={(e) => updateVideosPerDay(mapping.id, parseInt(e.target.value) || 1)}
                    className="bg-slate-950 border border-purple-500/40 focus:border-purple-400 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none w-14 text-center font-bold shadow-sm"
                  />
                </div>
              </div>

              {/* Bottom Strip: Custom Hashtags per Page */}
              <div className="border-t border-gray-700/50 mt-4 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 shrink-0">
                  <span className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-xs">
                    #
                  </span>
                  <span>Custom Hashtags:</span>
                  <span className="text-[11px] text-gray-500 font-normal hidden md:inline">(Appended with video caption on Facebook)</span>
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <input 
                    type="text"
                    defaultValue={mapping.customHashtags || ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateCustomHashtags(mapping.id, (e.target as HTMLInputElement).value);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== (mapping.customHashtags || '')) {
                        updateCustomHashtags(mapping.id, e.target.value);
                      }
                    }}
                    placeholder="e.g. #animals #nature #viral #wildlife #fyp"
                    className="bg-gray-950/80 border border-gray-700/70 focus:border-purple-500 text-xs text-purple-200 placeholder-gray-600 rounded-xl px-3 py-2 w-full focus:outline-none transition-colors font-medium tracking-wide"
                  />
                  <button 
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      if (input) updateCustomHashtags(mapping.id, input.value);
                    }}
                    className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer shadow-sm shadow-purple-500/10"
                  >
                    Save
                  </button>
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
                  {sources.filter(s => s.platform !== 'MEGA_CLOUD').map(s => (
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
