'use client';
import { useState, useEffect } from 'react';

export default function FacebookPagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [pageId, setPageId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      }
    } catch (err) {
      console.error('Failed to fetch pages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const deletePage = async (id: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/pages/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchPages();
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, pageId, accessToken })
      });
      if (res.ok) {
        setShowModal(false);
        setName('');
        setPageId('');
        setAccessToken('');
        fetchPages();
      }
      } else {
        const errText = await res.text();
        setErrorMsg('Error: ' + errText);
      }
    } catch (err: any) {
      console.error('Failed to add facebook page', err);
      setErrorMsg('Network error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Facebook Pages</h1>
          <p className="text-gray-400 mt-1">Connect the destination Facebook Pages where videos will be uploaded.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold shadow-lg shadow-[#1877F2]/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          Connect Facebook
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="text-gray-500">Loading pages...</div>
        ) : pages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No Facebook Pages connected.</p>
            <p className="text-sm">Click "Connect Facebook" to authorize.</p>
          </div>
        ) : (
          pages.map(page => (
            <div key={page.id} className="p-6 bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-xl hover:border-gray-700 transition-all hover:shadow-2xl group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] font-bold text-xl">
                  {page.name.charAt(0).toUpperCase()}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  page.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                } border`}>
                  {page.status}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">{page.name}</h3>
              <p className="text-gray-500 text-sm font-mono mb-4">ID: {page.pageId}</p>
              
              <div className="pt-4 border-t border-gray-800/50 flex justify-between items-center text-sm">
                <span className="text-gray-400">Token valid: <span className="text-gray-300">Active</span></span>
                <button onClick={() => deletePage(page.id)} className="text-red-400 hover:text-red-300 font-medium">Disconnect</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Connect Facebook Page</h2>
            {errorMsg && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAddPage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Page Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1877F2]" 
                  placeholder="e.g. My Awesome Page"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Facebook Page ID</label>
                <input 
                  type="text" 
                  value={pageId} 
                  onChange={(e) => setPageId(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1877F2]" 
                  placeholder="e.g. 1029384756"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Page Access Token</label>
                <input 
                  type="text" 
                  value={accessToken} 
                  onChange={(e) => setAccessToken(e.target.value)} 
                  required 
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1877F2]" 
                  placeholder="EAAI... (Long lived page token)"
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
                  className="flex-1 py-3 px-4 rounded-xl font-semibold text-white bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
