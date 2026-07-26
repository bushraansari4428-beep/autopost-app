'use client';

import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'night' | 'day'>('night');
  const [justSwitched, setJustSwitched] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('app_theme') || 'night';
    setTheme(stored as 'night' | 'day');
    if (stored === 'day') {
      document.body.classList.add('day-mode');
    } else {
      document.body.classList.remove('day-mode');
    }
  }, []);

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Configuration & Settings</h1>
        <p className="text-gray-400 mt-1">Manage your interface preferences and monitor the automated cross-posting engine.</p>
      </div>

      <div className="space-y-6">
        {/* Day / Night Theme Switcher Section */}
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-purple-950/30 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
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
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-blue-950/30 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
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
    </div>
  );
}
