'use client';

export default function SettingsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Settings</h1>
        <p className="text-gray-400 mt-1">Configure global application preferences.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Monitoring Configuration</h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Check Interval (Minutes)</label>
              <input type="number" defaultValue="15" className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Max Upload Retries</label>
              <input type="number" defaultValue="3" className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6">Default Templates</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Facebook Post Caption</label>
            <textarea rows={4} defaultValue="{{title}}\n\nWatch more here: {{sourceUrl}}" className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-mono text-sm"></textarea>
            <p className="text-xs text-gray-500 mt-2">Available variables: {'{{title}}, {{description}}, {{sourceUrl}}'}</p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/30 transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
