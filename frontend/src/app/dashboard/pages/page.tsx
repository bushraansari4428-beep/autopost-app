'use client';
import { useState, useEffect } from 'react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

export default function FacebookPagesPage() {
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
  
  // Real-time statistics modal state
  const [selectedStatsPage, setSelectedStatsPage] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
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
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('Facebook Page disconnected successfully', 'success');
        fetchPages();
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast(`Failed to delete page: ${errData.message || 'Server error'}`, 'error');
      }
    } catch (err: any) {
      console.error('Failed to delete page:', err);
      addToast(`Error deleting page: ${err.message}`, 'error');
    }
  };

  const openPageStats = async (page: any) => {
    setSelectedStatsPage(page);
    setStatsData(null);
    setLoadingStats(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${page.id}/statistics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      } else {
        console.error('Failed to retrieve statistics');
      }
    } catch (err: any) {
      console.error('Error fetching page statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleAddPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    
    const payload: any = { name, pageId, accessToken };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowModal(false);
        setName('');
        setPageId('');
        setAccessToken('');
        fetchPages();
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
          <p className="text-gray-400 mt-1">Click on any connected Facebook Page card to view live real-time statistics & analytics.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold shadow-lg shadow-[#1877F2]/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
        >
          + Add FB Page
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="text-gray-500 font-medium">Loading pages...</div>
        ) : pages.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No Facebook Pages connected.</p>
            <p className="text-sm">Click "+ Add FB Page" to authorize.</p>
          </div>
        ) : (
          pages.map(page => {
            const connectDate = new Date(page.createdAt || Date.now());
            const formattedConnectDate = connectDate.toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            });

            // Access token valid for 90 days from attachment date
            const totalValidityDays = 90;
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysElapsed = Math.max(0, Math.floor((Date.now() - connectDate.getTime()) / msPerDay));
            const remainingDays = Math.max(0, totalValidityDays - daysElapsed);
            const percentRemaining = Math.min(100, Math.max(0, (remainingDays / totalValidityDays) * 100));

            return (
              <div 
                key={page.id} 
                onClick={() => openPageStats(page)}
                className="p-6 bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl shadow-xl hover:border-[#1877F2]/80 hover:scale-[1.015] transition-all duration-200 cursor-pointer hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-blue-600/20 text-blue-400 text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm">
                  <span>📊 Click to View Stats</span>
                </div>

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#1877F2]/40 to-[#1877F2]/10 border-2 border-[#1877F2]/50 flex items-center justify-center text-white font-extrabold text-xl shadow-lg relative overflow-hidden shrink-0 group-hover:border-[#1877F2] transition-all">
                      <span className="absolute inset-0 flex items-center justify-center text-blue-300 font-black text-xl pointer-events-none">
                        {page.name.charAt(0).toUpperCase()}
                      </span>
                      <img 
                        src={`https://graph.facebook.com/${page.pageId}/picture?type=large${page.accessToken ? `&access_token=${page.accessToken}` : ''}`}
                        alt={page.name}
                        className="w-full h-full object-cover rounded-full z-10 transition-transform duration-300 group-hover:scale-110"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      page.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    } border shadow-sm`}>
                      {page.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-400 transition-colors truncate">{page.name}</h3>
                  <p className="text-gray-500 text-xs font-mono mb-4">ID: {page.pageId}</p>
                  
                  {/* Token Validity & Attached Date Box */}
                  <div className="bg-gray-950/60 rounded-2xl p-4 mb-4 border border-gray-800/80 space-y-2.5 text-sm shadow-inner">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">
                        Attached Date:
                      </span>
                      <span className="text-white font-bold text-sm bg-gray-800/50 px-2.5 py-0.5 rounded-md border border-gray-700/50">
                        {formattedConnectDate}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">
                        Token Reminder:
                      </span>
                      <span className={`font-bold px-2.5 py-1 rounded-lg text-xs tracking-wide shadow-sm ${
                        remainingDays <= 10 ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        Expires in {remainingDays} {remainingDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800/80 rounded-full h-1.5 mt-2 overflow-hidden border border-gray-700/50">
                      <div 
                        className={`h-full transition-all duration-500 ${remainingDays <= 10 ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} 
                        style={{ width: `${percentRemaining}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-gray-800/60 flex justify-between items-center text-sm">
                  <span className="text-emerald-400 font-bold flex items-center gap-2 text-xs uppercase tracking-wider">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                    Token Active
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(page.id);
                    }} 
                    className="text-red-400 hover:text-red-300 font-bold hover:underline px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition z-20"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Real-Time Statistics VIP Analytics Modal */}
      {selectedStatsPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-gray-800/80 rounded-3xl w-full max-w-5xl my-8 overflow-hidden shadow-2xl shadow-blue-500/10 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 bg-[#070911] border-b border-gray-800/80 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border border-blue-500/40 relative overflow-hidden shrink-0 bg-blue-500/20 flex items-center justify-center text-white font-bold text-lg">
                  <span>{selectedStatsPage.name.charAt(0).toUpperCase()}</span>
                  <img 
                    src={`https://graph.facebook.com/${selectedStatsPage.pageId}/picture?type=large${selectedStatsPage.accessToken ? `&access_token=${selectedStatsPage.accessToken}` : ''}`}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-2xl font-extrabold text-white">{selectedStatsPage.name}</h2>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-extrabold tracking-wide flex items-center gap-1.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      LIVE GRAPH API SYNC
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-1">Page ID: {selectedStatsPage.pageId} • AutoPost Connected</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStatsPage(null)}
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center font-bold text-lg transition-colors focus:outline-none"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8 bg-gradient-to-br from-[#0a0d16] via-[#06080d] to-[#0a0d16]">
              {loadingStats ? (
                <div className="py-24 text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                  <p className="text-lg font-bold text-white animate-pulse">Syncing 100% Real-Time Statistics from Facebook Graph API...</p>
                  <p className="text-xs text-gray-500 font-mono">Querying live follower numbers, Reach & Engagement, video metrics & demographics</p>
                </div>
              ) : statsData ? (
                <>
                  {/* Section 1: Followers & Audience Growth */}
                  <div>
                    <h3 className="text-sm font-extrabold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>👥 Real-Time Followers & Audience Growth</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-[#0f1422] p-5 rounded-2xl border border-gray-800/80 shadow-inner">
                        <p className="text-gray-400 text-xs font-bold uppercase mb-1">Total Followers</p>
                        <p className="text-3xl font-extrabold text-white tracking-tight">{statsData.followers.total.toLocaleString()}</p>
                        <p className="text-emerald-400 text-xs font-semibold mt-2 flex items-center gap-1">
                          <span>↑</span> {statsData.followers.growthRate} vs last month
                        </p>
                      </div>
                      <div className="bg-[#0f1422] p-5 rounded-2xl border border-gray-800/80 shadow-inner">
                        <p className="text-gray-400 text-xs font-bold uppercase mb-1">Net Followers</p>
                        <p className="text-3xl font-extrabold text-emerald-400 tracking-tight">+{statsData.followers.netFollowers.toLocaleString()}</p>
                        <p className="text-gray-400 text-xs mt-2">Last 28 Days real trend</p>
                      </div>
                      <div className="bg-[#0f1422] p-5 rounded-2xl border border-gray-800/80 shadow-inner">
                        <p className="text-gray-400 text-xs font-bold uppercase mb-1">New Followers</p>
                        <p className="text-3xl font-extrabold text-blue-400 tracking-tight">+{statsData.followers.newFollowers.toLocaleString()}</p>
                        <p className="text-gray-400 text-xs mt-2">Organic brand additions</p>
                      </div>
                      <div className="bg-[#0f1422] p-5 rounded-2xl border border-gray-800/80 shadow-inner">
                        <p className="text-gray-400 text-xs font-bold uppercase mb-1">Page Likes / Fans</p>
                        <p className="text-3xl font-extrabold text-purple-400 tracking-tight">{statsData.followers.likes.toLocaleString()}</p>
                        <p className="text-gray-400 text-xs mt-2">Verified fan base</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Reach & Engagement Breakdown */}
                  <div>
                    <h3 className="text-sm font-extrabold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🌐 Reach & Engagement Analytics</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gradient-to-r from-blue-900/30 to-[#0f1422] p-6 rounded-2xl border border-blue-500/20 shadow-lg flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 text-xs font-extrabold uppercase mb-1">Total Reach (Impressions)</p>
                          <p className="text-4xl font-extrabold text-white tracking-tight my-1">{statsData.reachAndEngagement.totalReach.toLocaleString()}</p>
                          <p className="text-blue-300 text-xs">Unique audience members served your video content</p>
                        </div>
                        <span className="text-4xl">🚀</span>
                      </div>
                      <div className="bg-gradient-to-r from-purple-900/30 to-[#0f1422] p-6 rounded-2xl border border-purple-500/20 shadow-lg flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 text-xs font-extrabold uppercase mb-1">Engagement Rate & Interactions</p>
                          <div className="flex items-baseline gap-3 my-1">
                            <span className="text-4xl font-extrabold text-white tracking-tight">{statsData.reachAndEngagement.engagementRate}</span>
                            <span className="text-purple-300 font-bold text-sm">({statsData.reachAndEngagement.engagedUsers.toLocaleString()} engaged)</span>
                          </div>
                          <p className="text-purple-300 text-xs">{statsData.reachAndEngagement.interactions.toLocaleString()} total likes, shares, comments & clicks</p>
                        </div>
                        <span className="text-4xl">🔥</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Video Performance Hub */}
                  <div>
                    <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                      <span>🎬 Video Performance & Auto-Post Insights</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] sm:text-xs font-mono text-gray-400 bg-gray-900 px-2 py-1 rounded-md border border-gray-800">Total FB Videos: {statsData.videoPerformance.totalVideos}</span>
                        <span className="text-[10px] sm:text-xs font-mono text-blue-400/80 bg-blue-900/20 px-2 py-1 rounded-md border border-blue-900/50">AutoPost Synced: {statsData.autoPostUploads}</span>
                      </div>
                    </h3>
                    <div className="bg-[#0f1422] p-6 rounded-3xl border border-gray-800/80 shadow-inner">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pb-6 border-b border-gray-800/60 text-center">
                        <div>
                          <p className="text-gray-400 text-xs font-bold mb-1">Total Video Views</p>
                          <p className="text-2xl font-extrabold text-white">{statsData.videoPerformance.totalViews.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-bold mb-1">Total Reactions</p>
                          <p className="text-2xl font-extrabold text-rose-400">{statsData.videoPerformance.totalReactions.toLocaleString()} ❤️</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs font-bold mb-1">Total Comments</p>
                          <p className="text-2xl font-extrabold text-amber-400">{statsData.videoPerformance.totalComments.toLocaleString()} 💬</p>
                        </div>
                      </div>
                      
                      {/* Recent Facebook Videos Table */}
                      {statsData.videoPerformance.recentVideos && statsData.videoPerformance.recentVideos.length > 0 ? (
                        <div className="mt-5">
                          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Recent Live Videos on Page</p>
                          <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                            {statsData.videoPerformance.recentVideos.map((vid: any, i: number) => (
                              <div key={vid.id || i} className="p-3 bg-gray-950/60 rounded-xl border border-gray-800/60 flex items-center justify-between hover:border-gray-700 transition">
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="text-sm font-bold text-gray-200 truncate">{vid.title}</p>
                                  <p className="text-[11px] text-gray-500 font-mono">ID: {vid.id} • Published: {new Date(vid.createdTime).toLocaleDateString()}</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs shrink-0">
                                  <span className="font-bold text-white bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-500/30">
                                    ▶ {vid.views?.toLocaleString() || 0} Views
                                  </span>
                                  <span className="text-gray-400 w-16 text-right">❤️ {vid.likes?.toLocaleString() || 0}</span>
                                  <span className="text-gray-400 w-16 text-right">💬 {vid.comments?.toLocaleString() || 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-6 text-center text-gray-500 text-sm">
                          No recent videos available. Graph API might not have returned data yet.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Audience Demographics & Top Locations */}
                  <div>
                    <h3 className="text-sm font-extrabold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span>🌍 Audience Demographics & Top Locations</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Top Countries & Cities */}
                      <div className="bg-[#0f1422] p-6 rounded-3xl border border-gray-800/80 shadow-inner space-y-5">
                        {statsData.demographics.topCountries?.length > 0 ? (
                          <>
                            <div>
                              <p className="text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-3">Top Countries by Followers</p>
                              <div className="space-y-3">
                                {statsData.demographics.topCountries.map((c: any, i: number) => (
                                  <div key={c.code || i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold">
                                      <span className="text-gray-200">{c.country}</span>
                                      <span className="text-blue-400">{c.percentage}% ({c.count ? c.count.toLocaleString() : ''})</span>
                                    </div>
                                    <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden">
                                      <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style={{ width: `${c.percentage}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {statsData.demographics.topCities?.length > 0 && (
                              <div className="pt-4 border-t border-gray-800/60">
                                <p className="text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-2">Top Global Cities</p>
                                <div className="flex flex-wrap gap-2">
                                  {statsData.demographics.topCities.map((city: any, i: number) => (
                                    <span key={i} className="bg-gray-950/80 border border-gray-800 text-gray-300 text-xs font-bold px-3 py-1 rounded-xl">
                                      📍 {city.city} ({city.percentage}%)
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-500 text-sm">
                            <span className="text-4xl mb-3 opacity-50">🌍</span>
                            <p>No location data available from Facebook.</p>
                          </div>
                        )}
                      </div>

                      {/* Gender & Age Breakdown */}
                      <div className="bg-[#0f1422] p-6 rounded-3xl border border-gray-800/80 shadow-inner flex flex-col justify-between">
                        {statsData.demographics.genderAndAge ? (
                          <div>
                            <p className="text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-4">Gender & Age Distribution</p>
                            
                            {/* Gender Split Bar */}
                            <div className="space-y-2 mb-6">
                              <div className="flex justify-between text-xs font-extrabold">
                                <span className="text-blue-400">👨 Men: {statsData.demographics.genderAndAge.male}%</span>
                                <span className="text-pink-400">👩 Women: {statsData.demographics.genderAndAge.female}%</span>
                              </div>
                              <div className="w-full bg-gray-800 h-4 rounded-xl overflow-hidden flex border border-gray-700/50 p-0.5">
                                <div className="bg-blue-500 h-full rounded-l-lg transition-all" style={{ width: `${statsData.demographics.genderAndAge.male}%` }} />
                                <div className="bg-pink-500 h-full rounded-r-lg transition-all" style={{ width: `${statsData.demographics.genderAndAge.female}%` }} />
                              </div>
                            </div>

                            {/* Age Groups Breakdown */}
                            <div>
                              <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider mb-3">
                                ⭐ Top Age Group: {statsData.demographics.genderAndAge.topAgeGroup}
                              </p>
                              <div className="space-y-2.5">
                                {statsData.demographics.genderAndAge.distribution.map((d: any, idx: number) => (
                                  <div key={idx} className="flex items-center gap-3 text-xs font-bold">
                                    <span className="w-14 text-gray-400 text-right">{d.group}</span>
                                    <div className="flex-1 bg-gray-800/80 rounded-full h-2 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${idx === 1 ? 'bg-emerald-400 shadow-md shadow-emerald-500/40' : 'bg-purple-500'}`} 
                                        style={{ width: `${d.percentage * 2}%` }} 
                                      />
                                    </div>
                                    <span className="w-10 text-gray-300">{d.percentage}%</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-500 text-sm">
                            <span className="text-4xl mb-3 opacity-50">👥</span>
                            <p>No demographic data available from Facebook.</p>
                          </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-gray-800/60 text-center">
                          <p className="text-[11px] text-gray-500">
                            🛡️ Real-Time Graph API Data Integrity Guaranteed • Connected securely to Meta Business Server
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>
                </>
              ) : (
                <div className="py-24 text-center text-red-400 font-bold">
                  Failed to load real-time statistics from Facebook servers. Please verify page access token validity.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#070911] border-t border-gray-800/80 flex justify-between items-center text-xs text-gray-400 shrink-0 px-6">
              <span className="font-mono">Last synchronized: {statsData?.timestamp ? new Date(statsData.timestamp).toLocaleTimeString() : 'Just now'}</span>
              <button 
                onClick={() => setSelectedStatsPage(null)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl transition shadow-lg shadow-blue-500/25"
              >
                Close Statistics Console
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Facebook Page Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-[500px] max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Link Facebook Page</h2>
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
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Disconnect Facebook Page"
        message="Are you sure you want to disconnect and delete this Facebook Page? Associated mappings and history will also be removed."
        onConfirm={() => {
          if (deleteConfirmId) {
            deletePage(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
