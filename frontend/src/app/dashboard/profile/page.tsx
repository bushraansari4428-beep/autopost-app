'use client';
import { useState, useEffect } from 'react';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [megaEmail, setMegaEmail] = useState('');
  const [megaPassword, setMegaPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        if (data.megaEmail) setMegaEmail(data.megaEmail);
      }
    } catch (e) {
      console.error('Failed to fetch profile', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const body: any = {};
      if (megaEmail) body.megaEmail = megaEmail;
      if (megaPassword) body.megaPassword = megaPassword; // Only send if updating

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setMegaPassword(''); // Clear password field for security
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-white p-6">Loading profile...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">My Profile</h1>
        <p className="text-gray-400 mt-2">Manage your account settings and cloud connections.</p>
      </div>

      <div className="bg-[#0A0A0A] border border-gray-800 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6">Mega Cloud Integration</h2>
        <p className="text-gray-400 text-sm mb-6">
          Connect your Mega Cloud account to automatically pull and upload videos.
        </p>

        {message.text && (
          <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mega Email Address</label>
            <input
              type="email"
              value={megaEmail}
              onChange={(e) => setMegaEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="e.g., yourname@mega.nz"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mega Password</label>
            <input
              type="password"
              value={megaPassword}
              onChange={(e) => setMegaPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg ${
              saving 
                ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/20'
            }`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
