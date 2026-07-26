'use client';

export default function SettingsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">System Configuration & Settings</h1>
        <p className="text-gray-400 mt-1">Overview of your automated cross-posting pipeline and server preferences.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-blue-950/30 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
            <h2 className="text-xl font-bold text-white">Automated Synchronization Engine</h2>
            <span className="ml-auto px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold uppercase tracking-wider">
              System Active
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-5 bg-gray-950/60 border border-gray-800/80 rounded-2xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Background Polling Interval</p>
              <p className="text-2xl font-extrabold text-white mt-1.5 flex items-baseline gap-1.5">
                Every 5 Minutes
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Automatically scans all active YouTube, Instagram, TikTok, Xiaohongshu, and Kuaishou sources for fresh content.
              </p>
            </div>

            <div className="p-5 bg-gray-950/60 border border-gray-800/80 rounded-2xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Retry & Fallback Pipeline</p>
              <p className="text-2xl font-extrabold text-blue-400 mt-1.5">
                4-Tier Auto Resolver
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Enterprise failsafe switching guarantees continuous video extraction and zero-loss Facebook publishing.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-900/10 border border-blue-500/20 rounded-2xl flex items-start gap-3.5 text-sm text-blue-200">
            <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-semibold text-white">Managed Infrastructure Note:</span> Polling intervals, video transport routing, and captions are managed directly by the automated high-speed backend service to maintain consistent rate-limit compliance and 100% uptime.
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <h3 className="font-bold text-white">Need custom schedule or enterprise routing changes?</h3>
            <p className="text-sm text-gray-400 mt-0.5">Advanced developer configurations are handled directly via server environment protocols.</p>
          </div>
          <span className="px-4 py-2 bg-gray-800/80 border border-gray-700 text-gray-300 rounded-xl text-xs font-mono">
            v2.4 Production Engine
          </span>
        </div>
      </div>
    </div>
  );
}
