'use client';

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Save, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  Clock, 
  Phone, 
  Key, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import ToastContainer, { ToastMessage } from '@/components/Toast';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'night' | 'day'>('night');
  const [justSwitched, setJustSwitched] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // WhatsApp Configuration State
  const [whatsappForm, setWhatsappForm] = useState({
    phoneNumber: '',
    apiKey: '',
    reportTime: '09:00',
    enabled: true,
  });
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(true);
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  useEffect(() => {
    const stored = localStorage.getItem('app_theme') || 'night';
    setTheme(stored as 'night' | 'day');
    if (stored === 'day') {
      document.body.classList.add('day-mode');
    } else {
      document.body.classList.remove('day-mode');
    }

    // Fetch existing WhatsApp config
    fetchWhatsappConfig();
  }, []);

  const fetchWhatsappConfig = async () => {
    try {
      setLoadingWhatsapp(true);
      const res = await fetch('/api/whatsapp/config', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setWhatsappForm({
            phoneNumber: data.phoneNumber || '',
            apiKey: data.apiKey || '',
            reportTime: data.reportTime || '09:00',
            enabled: data.enabled !== undefined ? data.enabled : true,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load WhatsApp config:', err);
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const handleSaveWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappForm.phoneNumber || !whatsappForm.apiKey) {
      addToast('Phone number and CallMeBot API key are required.', 'error');
      return;
    }

    setSavingWhatsapp(true);
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(whatsappForm),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('WhatsApp daily report settings saved successfully!', 'success');
      } else {
        addToast(`Failed to save: ${data.message || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      addToast(`Error saving settings: ${err.message}`, 'error');
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const handleSendTestReport = async () => {
    if (!whatsappForm.phoneNumber || !whatsappForm.apiKey) {
      addToast('Please enter your Phone number and API key first.', 'error');
      return;
    }

    setTestingWhatsapp(true);
    addToast('Sending test report to your WhatsApp...', 'info');

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          phoneNumber: whatsappForm.phoneNumber,
          apiKey: whatsappForm.apiKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast('Test report sent! Check your WhatsApp.', 'success');
      } else {
        addToast(`Delivery failed: ${data.message || 'Check credentials'}`, 'error');
      }
    } catch (err: any) {
      addToast(`Test error: ${err.message}`, 'error');
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const handleThemeToggle = (mode: 'night' | 'day') => {
    setTheme(mode);
    setJustSwitched(true);
    localStorage.setItem('app_theme', mode);
    if (mode === 'day') {
      document.body.classList.add('day-mode');
    } else {
      document.body.classList.remove('day-mode');
    }
    setTimeout(() => setJustSwitched(false), 2000);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Configuration & Settings</h1>
        <p className="text-gray-400 mt-1">Manage notifications, WhatsApp daily reporting, and engine preferences.</p>
      </div>

      <div className="space-y-6">
        {/* WHATSAPP DAILY REPORTING SECTION */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/95 to-emerald-950/20 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>WhatsApp Daily Morning Report</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    100% Free (CallMeBot)
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Get automated daily reports on Facebook Page followers, uploads, and YouTube Shorts delivered to your WhatsApp.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-300">Daily Report:</span>
              <button
                type="button"
                onClick={() => setWhatsappForm({ ...whatsappForm, enabled: !whatsappForm.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  whatsappForm.enabled ? 'bg-emerald-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    whatsappForm.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveWhatsapp} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp Phone Number *</span>
                </label>
                <input
                  type="text"
                  required
                  value={whatsappForm.phoneNumber}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, phoneNumber: e.target.value })}
                  placeholder="+923001234567"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-gray-500">Include country code (e.g. +92 or 92)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CallMeBot API Key *</span>
                </label>
                <input
                  type="text"
                  required
                  value={whatsappForm.apiKey}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, apiKey: e.target.value })}
                  placeholder="e.g. 1234567"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-gray-500">Received via WhatsApp from CallMeBot</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Delivery Time (PKT) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={whatsappForm.reportTime}
                  onChange={(e) => setWhatsappForm({ ...whatsappForm, reportTime: e.target.value })}
                  placeholder="09:00"
                  className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <span className="text-[11px] text-gray-500">24-hour format (Default: 09:00 AM)</span>
              </div>
            </div>

            {/* Quick 3-Step Setup Instructions Card */}
            <div className="bg-gray-950/70 border border-gray-800 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowSetupGuide(!showSetupGuide)}
                className="w-full px-4 py-3 flex items-center justify-between text-xs text-gray-300 hover:text-white transition-colors"
              >
                <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                  <HelpCircle className="w-4 h-4" />
                  <span>How to get your free CallMeBot API Key (30 Seconds Setup)</span>
                </span>
                {showSetupGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showSetupGuide && (
                <div className="p-4 pt-1 text-xs text-gray-400 space-y-2 border-t border-gray-800/80 bg-gray-950/90">
                  <p>
                    <strong className="text-white">Step 1:</strong> Apne mobile WhatsApp mein CallMeBot number ko save karein:{' '}
                    <code className="text-emerald-400 font-mono select-all">+34 644 44 48 57</code> ya{' '}
                    <code className="text-emerald-400 font-mono select-all">+34 644 65 67 10</code>.
                  </p>
                  <p>
                    <strong className="text-white">Step 2:</strong> Us number par ye message bhejein:{' '}
                    <code className="bg-gray-800 px-2 py-0.5 rounded text-emerald-300 font-mono select-all">
                      I allow callmebot to send me messages
                    </code>
                  </p>
                  <p>
                    <strong className="text-white">Step 3:</strong> CallMeBot aapko foran reply mein aapki <strong>API Key</strong> bhej dega (e.g. <code className="text-white">apikey: 1234567</code>). Wo key yahan paste karein aur Save kar lein!
                  </p>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleSendTestReport}
                disabled={testingWhatsapp}
                className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs border border-gray-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {testingWhatsapp ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>Sending Test...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Send Test Report Now</span>
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={savingWhatsapp}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingWhatsapp ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Day / Night Theme Switcher Section */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-purple-950/30 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></div>
              <h2 className="text-xl font-bold text-white">Application Display Theme</h2>
            </div>
            {justSwitched && (
              <span className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold animate-bounce w-fit">
                ✨ Theme Updated!
              </span>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center sm:justify-start">
            <div className="flex items-center gap-2 bg-gray-950/80 p-2.5 rounded-2xl border border-gray-800/80 shadow-inner w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => handleThemeToggle('night')}
                className={`flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 cursor-pointer w-1/2 sm:w-auto ${
                  theme === 'night'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.03]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="text-lg">🌙</span> Night Mode
              </button>
              <button
                type="button"
                onClick={() => handleThemeToggle('day')}
                className={`flex items-center justify-center gap-2.5 px-8 py-3 rounded-xl font-bold text-sm transition-all duration-300 cursor-pointer w-1/2 sm:w-auto ${
                  theme === 'day'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/30 scale-[1.03]'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="text-lg">☀️</span> Day Mode
              </button>
            </div>
          </div>
        </div>

        {/* Automated Synchronization Engine Overview Card */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-blue-950/30 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <h2 className="text-xl font-bold text-white">Automated Synchronization Engine</h2>
            <span className="ml-auto px-3.5 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold uppercase tracking-wider">
              System Active
            </span>
          </div>

          <div className="p-6 bg-gray-950/60 border border-gray-800/80 rounded-2xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background Polling Interval</p>
            <p className="text-2xl font-extrabold text-white mt-1.5 flex items-baseline gap-2">
              Every 5 Minutes
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Automatically scans all active YouTube, Instagram, TikTok, Xiaohongshu, and Kuaishou sources for fresh content.
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
