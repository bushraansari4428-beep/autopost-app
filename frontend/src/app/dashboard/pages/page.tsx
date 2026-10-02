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

  // 1-Click Facebook OAuth state
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);

  const initiateFacebookOAuth = () => {
    const appId = '911473734693149';
    const redirectUri = encodeURIComponent(window.location.origin + '/dashboard/pages');
    const scope = encodeURIComponent('pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_metadata');
    const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
    window.location.href = oauthUrl;
  };

  const handleOAuthCode = async (code: string) => {
    setIsConnectingOAuth(true);
    try {
      const token = localStorage.getItem('token');
      const redirectUri = window.location.origin + '/dashboard/pages';
      const res = await fetch('/api/pages/facebook/oauth-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, redirectUri })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addToast(`🎉 Facebook Connected! ${data.pagesImported} new pages added, ${data.pagesUpdated} updated for ${data.accountName}!`, 'success');
        fetchPages();
      } else {
        addToast(`Facebook Connection Failed: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      console.error('Failed to handle OAuth callback:', err);
      addToast(`OAuth Error: ${err.message}`, 'error');
    } finally {
      setIsConnectingOAuth(false);
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  // Bulk Import state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [bulkError, setBulkError] = useState('');

  const detectedTokens = bulkInput.match(/EAA[A-Za-z0-9_-]+/g) || [];
  const uniqueTokenCount = new Set(detectedTokens).size;

  const handleBulkImport = async () => {
    if (!bulkInput.trim()) return;
    setIsBulkSubmitting(true);
    setBulkError('');
    setBulkResults(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages/bulk-import-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tokens: bulkInput })
      });

      const data = await res.json();
      if (res.ok) {
        setBulkResults(data);
        addToast(`Bulk sync complete: ${data.totalPagesImported} new pages added, ${data.totalPagesUpdated} updated!`, 'success');
        fetchPages();
      } else {
        setBulkError(data.message || 'Failed to import bulk tokens.');
        addToast(`Bulk import failed: ${data.message || 'Server error'}`, 'error');
      }
    } catch (err: any) {
      console.error('Failed to execute bulk token import:', err);
      setBulkError(err.message || 'Network error');
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // AI Bulk Page Creator state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>([]);
  const [loadingSavedAccounts, setLoadingSavedAccounts] = useState(false);
  const [createMode, setCreateMode] = useState<'saved' | 'paste'>('saved');
  const [createTokensInput, setCreateTokensInput] = useState('');
  const [niche, setNiche] = useState('Stickhead Skits');
  const [pagesPerAccount, setPagesPerAccount] = useState(1);
  const [category, setCategory] = useState('VIDEO_CREATOR');
  const [customNamesInput, setCustomNamesInput] = useState('');
  const [isCreatingPages, setIsCreatingPages] = useState(false);
  const [createResults, setCreateResults] = useState<any>(null);
  const [createError, setCreateError] = useState('');

  const createDetectedTokens = createTokensInput.match(/EAA[A-Za-z0-9_-]+/g) || [];
  const createUniqueTokenCount = new Set(createDetectedTokens).size;

  const fetchSavedAccounts = async () => {
    setLoadingSavedAccounts(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages/saved-accounts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSavedAccounts(data);
        if (data.length === 0) {
          setCreateMode('paste');
        } else {
          setCreateMode('saved');
        }
      }
    } catch (err) {
      console.error('Failed to fetch saved accounts:', err);
    } finally {
      setLoadingSavedAccounts(false);
    }
  };

  const handleBulkCreate = async () => {
    setIsCreatingPages(true);
    setCreateError('');
    setCreateResults(null);

    try {
      const token = localStorage.getItem('token');
      const payload: any = {
        niche,
        pagesPerAccount,
        category,
        useSavedAccounts: createMode === 'saved',
      };

      if (createMode === 'paste') {
        payload.tokens = createTokensInput;
      }

      if (customNamesInput.trim()) {
        payload.customNames = customNamesInput;
      }

      const res = await fetch('/api/pages/bulk-create-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        setCreateResults(data);
        addToast(`🎉 Success! ${data.totalPagesCreated} new pages created across ${data.successfulAccounts} accounts!`, 'success');
        fetchPages();
        fetchSavedAccounts();
      } else {
        setCreateError(data.message || 'Failed to create pages.');
        addToast(`Creation failed: ${data.message || 'Server error'}`, 'error');
      }
    } catch (err: any) {
      console.error('Failed to bulk create pages:', err);
      setCreateError(err.message || 'Network error');
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsCreatingPages(false);
    }
  };

  // 1-Click Creator Identity Syncer state
  const [syncingPage, setSyncingPage] = useState<any>(null);
  const [creatorInput, setCreatorInput] = useState('');
  const [isFetchingCreator, setIsFetchingCreator] = useState(false);
  const [creatorData, setCreatorData] = useState<any>(null);
  const [syncNewName, setSyncNewName] = useState('');
  const [syncNewBio, setSyncNewBio] = useState('');
  const [syncAvatarUrl, setSyncAvatarUrl] = useState('');
  const [syncOnFacebook, setSyncOnFacebook] = useState(true);
  const [isApplyingSync, setIsApplyingSync] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState('');

  const openSyncModal = (page: any) => {
    setSyncingPage(page);
    setCreatorInput('');
    setCreatorData(null);
    setSyncNewName(page.name);
    setSyncNewBio('');
    setSyncAvatarUrl('');
    setSyncOnFacebook(true);
    setSyncResult(null);
    setSyncError('');
  };

  const handleFetchCreator = async () => {
    if (!creatorInput.trim()) return;
    setIsFetchingCreator(true);
    setSyncError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages/fetch-creator-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ creatorUrl: creatorInput })
      });
      const data = await res.json();
      if (res.ok && data.creator) {
        setCreatorData(data.creator);
        setSyncNewName(data.creator.name);
        setSyncNewBio(data.creator.bio);
        setSyncAvatarUrl(data.creator.avatarUrl);
      } else {
        setSyncError(data.message || 'Failed to fetch creator details.');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Network error fetching creator.');
    } finally {
      setIsFetchingCreator(false);
    }
  };

  const handleApplyCreatorSync = async () => {
    if (!syncingPage || !syncNewName.trim()) return;
    setIsApplyingSync(true);
    setSyncError('');
    setSyncResult(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${syncingPage.id}/sync-creator-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: syncNewName,
          bio: syncNewBio,
          avatarUrl: syncAvatarUrl,
          updateOnFacebook: syncOnFacebook
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
        addToast(`Page rebranded to "${syncNewName}" successfully!`, 'success');
        fetchPages();
      } else {
        setSyncError(data.message || 'Failed to rebrand page.');
      }
    } catch (err: any) {
      setSyncError(err.message || 'Network error applying rebrand.');
    } finally {
      setIsApplyingSync(false);
    }
  };

  // Custom Page Name & Bio Renamer state
  const [renamingPage, setRenamingPage] = useState<any>(null);
  const [customPageName, setCustomPageName] = useState('');
  const [customPageBio, setCustomPageBio] = useState('');
  const [isRenamingPage, setIsRenamingPage] = useState(false);
  const [renameResult, setRenameResult] = useState<any>(null);
  const [renameError, setRenameError] = useState('');

  const openRenameModal = (page: any) => {
    setRenamingPage(page);
    setCustomPageName(page.name || '');
    setCustomPageBio(page.bio || '');
    setRenameResult(null);
    setRenameError('');
  };

  const handleApplyRename = async () => {
    if (!renamingPage || !customPageName.trim()) {
      addToast('Page name cannot be empty.', 'error');
      return;
    }
    setIsRenamingPage(true);
    setRenameError('');
    setRenameResult(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${renamingPage.id}/update-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: customPageName.trim(),
          bio: customPageBio.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setRenameResult(data);
        addToast(`Page name updated to "${customPageName.trim()}" successfully!`, 'success');
        fetchPages();
      } else {
        setRenameError(data.message || 'Failed to update page name.');
        addToast(`Update error: ${data.message || 'Failed'}`, 'error');
      }
    } catch (err: any) {
      setRenameError(err.message || 'Network error');
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsRenamingPage(false);
    }
  };

  // Content Monetization (CM) Scanner state
  const [isScanningCM, setIsScanningCM] = useState(false);
  const [cmModalPage, setCmModalPage] = useState<any>(null);

  const handleScanMonetization = async () => {
    setIsScanningCM(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/pages/check-monetization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.newInvitesDetected > 0) {
          addToast(`🎉 Mubarak Ho! ${data.newInvitesDetected} Content Monetization invite(s) detected! WhatsApp alert sent.`, 'success');
        } else {
          addToast(`Checked ${data.totalChecked} pages. No new CM invites right now.`, 'info');
        }
        fetchPages();
      } else {
        addToast(data.message || 'Failed to scan CM status', 'error');
      }
    } catch (err: any) {
      addToast(`Error scanning: ${err.message}`, 'error');
    } finally {
      setIsScanningCM(false);
    }
  };

  const handleToggleCM = async (page: any, targetStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/pages/${page.id}/set-monetization`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          hasContentMonetization: targetStatus,
          status: targetStatus ? 'INVITED' : 'NONE',
          sendWhatsApp: targetStatus
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (targetStatus) {
          addToast(`🎉 ${page.name} marked as CM Unlocked! WhatsApp alert dispatched.`, 'success');
        } else {
          addToast(`${page.name} CM status reset.`, 'info');
        }
        fetchPages();
      }
    } catch (err: any) {
      addToast(`Error: ${err.message}`, 'error');
    }
  };

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

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const fbError = urlParams.get('error') || urlParams.get('error_description');

      if (fbError) {
        addToast(`Facebook Login Notice: ${fbError}`, 'error');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (code) {
        handleOAuthCode(code);
      }
    }
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
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={initiateFacebookOAuth}
            disabled={isConnectingOAuth}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-lg shadow-blue-500/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Connect any Facebook Account in 1-Click without copying tokens or developer accounts"
          >
            {isConnectingOAuth ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Linking Facebook...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>Connect Facebook (1-Click)</span>
              </>
            )}
          </button>
          <button 
            onClick={() => {
              setShowCreateModal(true);
              setCreateResults(null);
              setCreateError('');
              fetchSavedAccounts();
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700 text-white font-bold shadow-lg shadow-teal-500/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>🏭</span> AI Bulk Page Creator
          </button>
          <button 
            onClick={handleScanMonetization}
            disabled={isScanningCM}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-300 hover:to-amber-500 text-black font-extrabold shadow-lg shadow-yellow-500/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Scan Facebook Graph API across all connected pages for Content Monetization (CM) tool invites and send WhatsApp notifications"
          >
            <span>{isScanningCM ? '⏳' : '💰'}</span>
            <span>{isScanningCM ? 'Scanning CM...' : 'Scan CM Invites'}</span>
          </button>
          <button 
            onClick={() => {
              setShowBulkModal(true);
              setBulkResults(null);
              setBulkError('');
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 text-white font-bold shadow-lg shadow-orange-500/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <span>⚡</span> Bulk Import (1000+ Pages)
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="px-6 py-2.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold shadow-lg shadow-[#1877F2]/25 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            + Add Single Page
          </button>
        </div>
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        page.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      } border shadow-sm`}>
                        {page.status}
                      </span>
                      {page.hasContentMonetization && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-400 to-yellow-500 text-black border border-amber-300 shadow-md animate-pulse flex items-center gap-1">
                          <span>💰</span> CM Unlocked
                        </span>
                      )}
                    </div>
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
                
                <div className="pt-3 border-t border-gray-800/60 flex flex-wrap justify-between items-center gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                      Active
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openRenameModal(page);
                      }}
                      className="text-amber-400 hover:text-amber-300 font-bold px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 transition text-xs flex items-center gap-1 z-20 cursor-pointer"
                      title="Rename this page and update its bio on Facebook & AutoPost"
                    >
                      <span>✏️</span> Rename & Bio
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSyncModal(page);
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-bold px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/30 transition text-xs flex items-center gap-1 z-20 cursor-pointer"
                      title="Sync and rebrand this page with a TikTok/Social Creator name & avatar"
                    >
                      <span>🔄</span> Sync Creator
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCM(page, !page.hasContentMonetization);
                      }}
                      className={`font-bold px-2 py-1 rounded-lg border transition text-xs flex items-center gap-1 z-20 cursor-pointer ${
                        page.hasContentMonetization
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 border-slate-700'
                      }`}
                      title={page.hasContentMonetization ? "Click to toggle/reset CM" : "Click to test Content Monetization & send WhatsApp Alert!"}
                    >
                      <span>{page.hasContentMonetization ? '⭐' : '💰'}</span>
                      <span>{page.hasContentMonetization ? 'CM Active' : 'Test CM'}</span>
                    </button>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(page.id);
                    }} 
                    className="text-red-400 hover:text-red-300 font-bold hover:underline px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition text-xs z-20 cursor-pointer"
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

      {/* 1-Click AI Bulk Page Creator Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-700/80 rounded-3xl p-6 sm:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-teal-500/20">
                  🏭
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    AI Bulk Page Creator
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Auto-Factory
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    Automatically create new Facebook Pages across your connected IDs with AI names, bios & auto cloud posting.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isCreatingPages) setShowCreateModal(false);
                }}
                disabled={isCreatingPages}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition text-lg"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Page Creation Failed</p>
                  <p className="text-xs opacity-90">{createError}</p>
                </div>
              </div>
            )}

            {!createResults ? (
              /* FORM / CONFIG VIEW */
              <div className="mt-6 space-y-6">
                
                {/* Account Source Mode Tabs */}
                <div>
                  <label className="text-sm font-semibold text-gray-200 block mb-2">
                    Select Facebook Accounts Source:
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1 bg-gray-950/80 rounded-2xl border border-gray-800">
                    <button
                      type="button"
                      onClick={() => setCreateMode('saved')}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                        createMode === 'saved'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      <span>⚡</span>
                      <span>Connected IDs ({savedAccounts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode('paste')}
                      className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
                        createMode === 'paste'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                      }`}
                    >
                      <span>📝</span>
                      <span>Paste New Tokens</span>
                    </button>
                  </div>
                </div>

                {/* Mode 1: Saved Accounts View */}
                {createMode === 'saved' && (
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl">
                    {loadingSavedAccounts ? (
                      <div className="text-center py-4 text-gray-500 text-xs">Loading connected accounts...</div>
                    ) : savedAccounts.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-xs space-y-2">
                        <p>No saved Facebook accounts found yet in the system.</p>
                        <button
                          type="button"
                          onClick={() => setCreateMode('paste')}
                          className="text-emerald-400 font-bold hover:underline"
                        >
                          Click here to paste your account tokens now →
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-gray-300">
                            Ready to create pages for {savedAccounts.length} connected accounts:
                          </span>
                          <span className="text-[11px] text-emerald-400 font-mono">
                            {savedAccounts.length * pagesPerAccount} Total Pages will be created
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                          {savedAccounts.map((acc: any, i: number) => (
                            <span key={i} className="text-[11px] bg-gray-800/90 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700/60 font-mono">
                              👤 {acc.name} ({acc.tokenPreview})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Paste New Tokens */}
                {createMode === 'paste' && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-gray-300">
                        Paste User Tokens or Account Strings:
                      </label>
                      <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {createUniqueTokenCount} Accounts Detected
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={createTokensInput}
                      onChange={(e) => setCreateTokensInput(e.target.value)}
                      placeholder={`EAABwzL1... (one token per line)\nOR\nUID|PASS|2FA|COOKIE|EAABwzL1...`}
                      className="w-full bg-gray-950/80 border border-gray-700/80 rounded-2xl p-3.5 text-white text-xs font-mono focus:outline-none focus:border-teal-500 transition custom-scrollbar"
                    />
                  </div>
                )}

                {/* Niche & Preset Quick Buttons */}
                <div>
                  <label className="text-sm font-semibold text-gray-200 block mb-2">
                    Niche / Content Topic:
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      { label: '🎭 Stickhead Skits', val: 'Stickhead Skits' },
                      { label: '🔍 Mystery & Unexplained', val: 'Unexplained Mysteries' },
                      { label: '😂 Comedy & Memes', val: 'Comedy & Memes' },
                      { label: '🧠 Mindblowing Facts', val: 'Mindblowing Facts' },
                      { label: '🐾 Funny Animals', val: 'Funny Animals' }
                    ].map((n, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNiche(n.val)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition ${
                          niche === n.val
                            ? 'bg-teal-500/20 border-teal-500 text-teal-300 font-bold'
                            : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                        }`}
                      >
                        {n.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="e.g. Stickhead Skits, Dark Mysteries, Daily Quotes..."
                    required
                    className="w-full bg-gray-950/80 border border-gray-700/80 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    AI automatically generates unique page names, engaging bios, and category tags based on this topic.
                  </p>
                </div>

                {/* Settings: Pages Per Account & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-200 block mb-1.5">
                      Pages per Account:
                    </label>
                    <select
                      value={pagesPerAccount}
                      onChange={(e) => setPagesPerAccount(Number(e.target.value))}
                      className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option value={1}>1 Page per ID (Recommended - 100% Safe)</option>
                      <option value={2}>2 Pages per ID (Safe)</option>
                      <option value={3}>3 Pages per ID (Maximum Limit)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-200 block mb-1.5">
                      Page Category:
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-teal-500"
                    >
                      <option value="VIDEO_CREATOR">Video Creator (Best for Reels)</option>
                      <option value="COMEDY_CLUB">Comedy / Entertainment</option>
                      <option value="ENTERTAINMENT_WEBSITE">Entertainment Website</option>
                      <option value="MEDIA_NEWS_COMPANY">Media / News</option>
                    </select>
                  </div>
                </div>

                {/* Optional Custom Names */}
                <div>
                  <details className="group">
                    <summary className="text-xs text-teal-400 font-semibold cursor-pointer hover:underline list-none flex items-center gap-1.5">
                      <span>▸ Want to supply specific Page Names? (Optional)</span>
                    </summary>
                    <div className="mt-2.5 pt-2 border-t border-gray-800">
                      <textarea
                        rows={3}
                        value={customNamesInput}
                        onChange={(e) => setCustomNamesInput(e.target.value)}
                        placeholder={`Leave blank for AI names, or enter custom names here (one per line):\nStickhead Official\nStickhead Skits VIP\nStickhead Funny Moments`}
                        className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl p-3 text-white text-xs font-mono focus:outline-none focus:border-teal-500 custom-scrollbar"
                      />
                    </div>
                  </details>
                </div>

                {/* Anti-Ban Shield Alert */}
                <div className="p-3.5 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div className="text-xs text-gray-300">
                    <strong className="text-teal-300">Anti-Ban Engine Active:</strong> System enforces 3.5s human-like delays, unique AI bios, and rate-limit safeguards to keep all your Facebook IDs 100% safe.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreatingPages}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkCreate}
                    disabled={isCreatingPages || (createMode === 'saved' && savedAccounts.length === 0) || (createMode === 'paste' && createUniqueTokenCount === 0)}
                    className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-teal-500/25 transition flex items-center justify-center gap-2"
                  >
                    {isCreatingPages ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Creating Pages with Anti-Ban Delay... Please Wait</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>
                          Start 1-Click Page Creation ({createMode === 'saved' ? savedAccounts.length * pagesPerAccount : createUniqueTokenCount * pagesPerAccount} Pages)
                        </span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            ) : (
              /* RESULTS VIEW */
              <div className="mt-6 space-y-6">
                
                {/* Success Banner */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Bulk Page Creation Completed!</h3>
                      <p className="text-xs text-emerald-400">
                        Created {createResults.totalPagesCreated} new pages across {createResults.successfulAccounts} Facebook accounts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-white">{createResults.successfulAccounts} / {createResults.totalAccounts}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Active Accounts</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-emerald-400">{createResults.totalPagesCreated}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Pages Created</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-teal-400">{createResults.totalPagesCreated}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Cloud Sources</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-rose-400">{createResults.failedAccountsCount}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Failed / Limited</div>
                  </div>
                </div>

                {/* Failed Accounts Alert if any */}
                {createResults.failedAccountsCount > 0 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <span>⚠️</span>
                      <span>{createResults.failedAccountsCount} Accounts could not create pages:</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-1 text-xs text-gray-400">
                      {createResults.failedAccounts?.map((f: any, idx: number) => (
                        <div key={idx} className="flex justify-between font-mono bg-black/40 px-2.5 py-1.5 rounded">
                          <span className="text-rose-300">{f.accountName} ({f.tokenPreview}):</span>
                          <span className="text-gray-400 truncate max-w-[280px]">{f.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Newly Created Pages List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Newly Created & Connected Pages ({createResults.createdPages?.length || 0})
                  </h4>
                  <div className="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {createResults.createdPages?.map((p: any, index: number) => (
                      <div key={index} className="p-3.5 bg-gray-950/60 border border-gray-800 rounded-xl flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-400 text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="font-bold text-white text-sm">{p.pageName}</span>
                            <span className="text-gray-500 font-mono text-xs">(ID: {p.pageId})</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1 italic pl-7">"{p.bio}"</p>
                          <div className="flex items-center gap-3 mt-1.5 pl-7 text-[11px] text-gray-500">
                            <span>👤 Account: {p.accountName}</span>
                            <span>☁️ Cloud: cloud://{p.pageId}</span>
                            <span className="text-emerald-400">⏰ Daily 04:30, 19:00</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          Active & Mapped
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateResults(null);
                      fetchSavedAccounts();
                    }}
                    className="py-2.5 px-4 rounded-xl text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition text-sm font-semibold"
                  >
                    Create More Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateResults(null);
                      fetchPages();
                    }}
                    className="py-2.5 px-6 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/25 transition text-sm"
                  >
                    Done & View All Pages
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-700/80 rounded-3xl p-6 sm:p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-orange-500/20">
                  ⚡
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Bulk Facebook Page Importer
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      1000+ Pages
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    Paste raw User Access Tokens or seller account dumps. System automatically fetches and connects all managed pages.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isBulkSubmitting) setShowBulkModal(false);
                }}
                disabled={isBulkSubmitting}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition text-lg"
              >
                ✕
              </button>
            </div>

            {bulkError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Import Failed</p>
                  <p className="text-xs opacity-90">{bulkError}</p>
                </div>
              </div>
            )}

            {!bulkResults ? (
              /* INPUT FORM VIEW */
              <div className="mt-6 space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                      <span>Facebook User Access Tokens / Account Strings</span>
                      <span className="text-xs font-normal text-gray-400">(Supports pure tokens or UID|PASS|2FA|COOKIE|EAA...)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {detectedTokens.length} Tokens Detected
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {uniqueTokenCount} Unique
                      </span>
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    disabled={isBulkSubmitting}
                    placeholder={`Paste 1 to 100+ tokens or lines here...\n\nExample:\nEAABwzL1... (one token per line)\nOR\n1000928172|Pass123|2FA|datr=xyz|EAABwzL1...\n1000928173|Pass123|2FA|datr=abc|EAABwzL2...`}
                    className="w-full bg-gray-950/80 border border-gray-700/80 rounded-2xl p-4 text-white text-xs sm:text-sm font-mono focus:outline-none focus:border-orange-500 transition custom-scrollbar placeholder-gray-600 disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    💡 <strong>Pro Tip:</strong> Even if your tokens are mixed with IDs, passwords, or cookies, our parser automatically filters and extracts every valid <code className="text-orange-400 font-mono">EAAB...</code> token.
                  </p>
                </div>

                {/* Features Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl">
                    <div className="text-blue-400 font-bold text-xs flex items-center gap-1.5">
                      <span>🔄</span> Auto Page Discovery
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Calls Graph API for each account to retrieve all connected pages & page-level tokens.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl">
                    <div className="text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                      <span>☁️</span> Auto Cloud Setup
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Creates MEGA_CLOUD sources and posting mappings (04:30 & 19:00 daily) automatically.
                    </p>
                  </div>
                  <div className="p-3 bg-gray-950/40 border border-gray-800 rounded-xl">
                    <div className="text-purple-400 font-bold text-xs flex items-center gap-1.5">
                      <span>🛡️</span> Zero Duplication
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Existing pages are refreshed with new tokens without creating duplicate entries.
                    </p>
                  </div>
                </div>

                {/* Submit / Cancel Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    disabled={isBulkSubmitting}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={isBulkSubmitting || uniqueTokenCount === 0}
                    className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-600 hover:via-orange-600 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-orange-500/25 transition flex items-center justify-center gap-2"
                  >
                    {isBulkSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Extracting & Linking Pages (~{uniqueTokenCount} Accounts)...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>Start 1-Click Import ({uniqueTokenCount} Accounts)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* RESULTS VIEW */
              <div className="mt-6 space-y-6">
                {/* Success Banner */}
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🎉</span>
                    <div>
                      <h3 className="font-extrabold text-white text-base">Bulk Import Successfully Completed!</h3>
                      <p className="text-xs text-emerald-400">
                        Total {bulkResults.totalPagesImported + bulkResults.totalPagesUpdated} pages synchronized across {bulkResults.validTokensCount} Facebook accounts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-white">{bulkResults.validTokensCount}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Valid Accounts</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-amber-400">{bulkResults.totalPagesImported + bulkResults.totalPagesUpdated}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Total Pages Found</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-emerald-400">{bulkResults.totalPagesImported}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">New Pages Added</div>
                  </div>
                  <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-2xl text-center">
                    <div className="text-2xl font-black text-blue-400">{bulkResults.totalPagesUpdated}</div>
                    <div className="text-xs text-gray-400 mt-1 uppercase font-semibold">Tokens Updated</div>
                  </div>
                </div>

                {/* Failed Tokens Alert if any */}
                {bulkResults.failedTokensCount > 0 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                      <span>⚠️</span>
                      <span>{bulkResults.failedTokensCount} Accounts Failed (Tokens Expired or Invalid):</span>
                    </div>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-1 text-xs text-gray-400">
                      {bulkResults.failedAccounts?.map((f: any, idx: number) => (
                        <div key={idx} className="flex justify-between font-mono bg-black/40 px-2 py-1 rounded">
                          <span className="text-rose-300">{f.tokenPreview}</span>
                          <span className="text-gray-500">{f.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Breakdown by Account */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center justify-between">
                    <span>Synchronized Accounts & Pages ({bulkResults.accounts?.length || 0})</span>
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {bulkResults.accounts?.map((acc: any, index: number) => (
                      <div key={index} className="p-3.5 bg-gray-950/60 border border-gray-800 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-600/30 text-blue-400 text-xs font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="font-bold text-white text-sm">{acc.accountName}</span>
                            <span className="text-gray-500 font-mono text-xs">({acc.accountId})</span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {acc.pagesCount} Pages Synced
                          </span>
                        </div>
                        {acc.pages && acc.pages.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-800/60">
                            {acc.pages.map((p: any) => (
                              <span key={p.id} className="text-[11px] bg-gray-800/80 text-gray-300 px-2 py-0.5 rounded-md border border-gray-700/50">
                                📄 {p.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Button */}
                <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkResults(null);
                      setBulkInput('');
                    }}
                    className="py-2.5 px-4 rounded-xl text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition text-sm font-semibold"
                  >
                    Import More Tokens
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkModal(false);
                      setBulkResults(null);
                      setBulkInput('');
                      fetchPages();
                    }}
                    className="py-2.5 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition text-sm"
                  >
                    Done & View All Pages
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 1-Click Creator Identity Syncer Modal */}
      {syncingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-gray-900 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-5 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-cyan-500/20">
                  🔄
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Creator Identity Syncer
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      1-Click Rebrand
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    Sync and rebrand this Facebook Page to match your chosen TikTok / Social Media Creator.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isApplyingSync) setSyncingPage(null);
                }}
                disabled={isApplyingSync}
                className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition text-lg"
              >
                ✕
              </button>
            </div>

            {/* Target Page Info Box */}
            <div className="mt-4 p-3.5 bg-gray-950/80 border border-gray-800 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">Currently Connected Page</span>
                <span className="text-white font-bold text-sm">{syncingPage.name}</span>
                <span className="text-gray-500 text-xs font-mono ml-2">(ID: {syncingPage.pageId})</span>
              </div>
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Ready to Rebrand
              </span>
            </div>

            {syncError && (
              <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl text-sm flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-bold">Sync Failed</p>
                  <p className="text-xs opacity-90">{syncError}</p>
                </div>
              </div>
            )}

            {!syncResult ? (
              <div className="mt-6 space-y-5">
                
                {/* Step 1: Input Creator URL or @username */}
                <div>
                  <label className="text-sm font-semibold text-gray-200 block mb-1.5">
                    Enter TikTok Creator Link or Username:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={creatorInput}
                      onChange={(e) => setCreatorInput(e.target.value)}
                      placeholder="e.g. https://www.tiktok.com/@mrbeast or @stickheadskits"
                      className="flex-1 bg-gray-950/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={handleFetchCreator}
                      disabled={isFetchingCreator || !creatorInput.trim()}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm transition flex items-center gap-1.5 shrink-0"
                    >
                      {isFetchingCreator ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <span>🔍</span>
                          <span>Fetch Creator</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    System extracts official creator name, bio, and avatar in real time.
                  </p>
                </div>

                {/* Step 2: Editable Preview Fields */}
                <div className="space-y-4 pt-3 border-t border-gray-800">
                  <div className="flex items-center gap-4 p-3 bg-gray-950/60 border border-gray-800 rounded-2xl">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-800 border-2 border-cyan-500/50 flex items-center justify-center shrink-0">
                      {syncAvatarUrl ? (
                        <img src={syncAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">👤</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-gray-400 block mb-1">Avatar / Logo URL (Optional)</label>
                      <input
                        type="text"
                        value={syncAvatarUrl}
                        onChange={(e) => setSyncAvatarUrl(e.target.value)}
                        placeholder="https://... (or leave blank)"
                        className="w-full bg-gray-900 border border-gray-700/80 rounded-lg px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      New Page Name (Will be applied to Facebook Page):
                    </label>
                    <input
                      type="text"
                      value={syncNewName}
                      onChange={(e) => setSyncNewName(e.target.value)}
                      required
                      placeholder="e.g. Stickhead Skits Official"
                      className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      New Page Bio / Description:
                    </label>
                    <textarea
                      rows={3}
                      value={syncNewBio}
                      onChange={(e) => setSyncNewBio(e.target.value)}
                      placeholder="Enter new bio or description for this page..."
                      className="w-full bg-gray-950/80 border border-gray-700/80 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-cyan-500 custom-scrollbar"
                    />
                  </div>

                  {/* Toggle Meta API update */}
                  <label className="flex items-center gap-3 p-3 bg-gray-950/40 border border-gray-800 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncOnFacebook}
                      onChange={(e) => setSyncOnFacebook(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 border-gray-700 bg-gray-900"
                    />
                    <div className="text-xs">
                      <span className="text-white font-semibold block">Update Live on Facebook via Meta Graph API</span>
                      <span className="text-gray-400 text-[11px]">Directly changes Page Name and Bio on Facebook servers without manual login.</span>
                    </div>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-4 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setSyncingPage(null)}
                    disabled={isApplyingSync}
                    className="flex-1 py-3 px-4 rounded-xl font-semibold text-gray-400 bg-gray-800 hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyCreatorSync}
                    disabled={isApplyingSync || !syncNewName.trim()}
                    className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2"
                  >
                    {isApplyingSync ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Applying 1-Click Rebrand...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Apply 1-Click Rebrand</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            ) : (
              /* SYNC RESULT VIEW */
              <div className="mt-6 space-y-5">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Page Rebranded Successfully!</h3>
                    <p className="text-xs text-emerald-400">
                      Facebook Page is now synchronized with Creator <strong>"{syncResult.page?.name}"</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-950/80 border border-gray-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">New Page Name:</span>
                    <span className="text-white font-bold">{syncResult.page?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meta API Status:</span>
                    <span className="text-emerald-400 font-semibold">
                      {syncResult.metaNameUpdated ? 'Updated on Facebook' : 'Saved in AutoPost'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cloud Folder Source:</span>
                    <span className="text-blue-400 font-mono">cloud://{syncResult.page?.pageId}</span>
                  </div>
                  {syncResult.metaWarning && (
                    <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg text-[11px] mt-2">
                      ℹ️ {syncResult.metaWarning}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSyncingPage(null);
                      setSyncResult(null);
                      fetchPages();
                    }}
                    className="py-2.5 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition text-sm"
                  >
                    Done & Return to Pages
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Custom Page Name & Bio Renamer Modal */}
      {renamingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-[#0b0f19] border border-amber-500/40 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl shadow-amber-500/10 p-6 md:p-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-2xl shadow-lg">
                  ✏️
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">Edit Page Name & Bio</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Directly updates the Page Name & About/Bio on Facebook servers and local database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRenamingPage(null);
                  setRenameResult(null);
                  setRenameError('');
                }}
                className="text-gray-400 hover:text-white p-2 rounded-xl bg-gray-900 border border-gray-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!renameResult ? (
              <div className="space-y-5">
                {renameError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
                    ⚠️ {renameError}
                  </div>
                )}

                <div className="p-3.5 bg-gray-950/80 border border-gray-800 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Current Page Name</span>
                    <span className="text-white font-bold text-sm">{renamingPage.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[11px]">Page ID</span>
                    <span className="text-blue-400 font-mono text-xs">{renamingPage.pageId}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1.5 flex items-center justify-between">
                    <span>New Page Name <span className="text-red-400">*</span></span>
                    <span className="text-[11px] text-gray-400 font-normal">Displayed on Facebook</span>
                  </label>
                  <input
                    type="text"
                    value={customPageName}
                    onChange={(e) => setCustomPageName(e.target.value)}
                    required
                    placeholder="Enter your custom page name..."
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-amber-400 font-bold transition shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-200 block mb-1.5 flex items-center justify-between">
                    <span>Page Bio / About Description</span>
                    <span className="text-[11px] text-gray-400 font-normal">Optional</span>
                  </label>
                  <textarea
                    rows={4}
                    value={customPageBio}
                    onChange={(e) => setCustomPageBio(e.target.value)}
                    placeholder="Enter an engaging page bio (e.g. Welcome to my page! Daily viral reels, comedy skits & entertainment. Follow for more!)..."
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3.5 text-white text-xs focus:outline-none focus:border-amber-400 transition shadow-inner custom-scrollbar"
                  />
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCustomPageBio(`Welcome to ${customPageName || 'our page'}! Your daily home for top viral reels, comedy skits, and entertainment clips. Follow and turn on notifications!`)}
                      className="px-2.5 py-1 bg-gray-800/80 hover:bg-gray-700 text-amber-300 rounded-lg text-[11px] border border-gray-700 transition cursor-pointer"
                    >
                      💡 Insert Comedy/Skit Bio
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPageBio(`The official Facebook page of ${customPageName || 'our brand'}. Discover mind-blowing facts, daily discoveries, and trending shorts!`)}
                      className="px-2.5 py-1 bg-gray-800/80 hover:bg-gray-700 text-amber-300 rounded-lg text-[11px] border border-gray-700 transition cursor-pointer"
                    >
                      💡 Insert Facts/Educational Bio
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Both Facebook Graph API and your AutoPost database will be updated automatically.</span>
                </div>

                <div className="pt-4 border-t border-gray-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRenamingPage(null)}
                    className="py-2.5 px-5 rounded-xl font-semibold text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 transition text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyRename}
                    disabled={isRenamingPage || !customPageName.trim()}
                    className="py-2.5 px-6 rounded-xl font-extrabold text-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 transition text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRenamingPage ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Updating on Facebook...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Save & Apply on Facebook</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* RENAME SUCCESS VIEW */
              <div className="space-y-5">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Page Updated Successfully!</h3>
                    <p className="text-xs text-emerald-400">
                      Page name is now set to <strong>"{renameResult.page?.name}"</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-950/80 border border-gray-800 rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">New Page Name:</span>
                    <span className="text-white font-bold">{renameResult.page?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Meta Graph API Status:</span>
                    <span className="text-emerald-400 font-semibold">
                      {renameResult.metaNameUpdated ? 'Updated on Meta Servers' : 'Updated in AutoPost'}
                    </span>
                  </div>
                  {renameResult.metaWarning && (
                    <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg text-[11px] mt-2">
                      ℹ️ {renameResult.metaWarning}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingPage(null);
                      setRenameResult(null);
                      fetchPages();
                    }}
                    className="py-2.5 px-6 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition text-sm cursor-pointer"
                  >
                    Done & Return to Pages
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {isConnectingOAuth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-blue-500/40 rounded-3xl p-8 max-w-md w-full text-center space-y-5 shadow-2xl shadow-blue-500/20">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-xl font-extrabold text-white">Linking with Facebook...</h3>
              <p className="text-xs text-gray-400 mt-1">Exchanging official credentials with Meta and linking all your authorized Facebook Pages to AutoPost App.</p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
              ⚡ This takes about 3 to 5 seconds. Please do not close this window.
            </div>
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
