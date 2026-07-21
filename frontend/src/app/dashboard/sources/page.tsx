'use client';
import { useState, useEffect } from 'react';

export default function SourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('YOUTUBE');
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setSources(data);
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

  const deleteSource = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/sources/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchSources();
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sources', {
        method: 'POST',
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
        fetchSources();
      } else {
        const errText = await res.text();
        console.error('Failed response:', errText);
        setErrorMsg('Error: ' + errText);
      }
    } catch (err: any) {
      console.error('Failed to add source', err);
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
          onClick={() => setShowModal(true)}
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
                  <td className="px-6 py-5 text-right">
                    <button className="text-gray-400 hover:text-white transition-colors">Edit</button>
                    <span className="mx-2 text-gray-700">|</span>
                    <button onClick={() => deleteSource(source.id)} className="text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Add New Source</h2>
            {errorMsg && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAddSource} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Source Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" 
                  placeholder="e.g. My Tech Channel"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Platform</label>
                <select 
                  value={platform} 
                  onChange={(e) => setPlatform(e.target.value)} 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="YOUTUBE">YouTube</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Profile URL / Handle</label>
                <input 
                  type="text" 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" 
                  placeholder="https://youtube.com/@channel"
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Add Source'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
