'use client';

import { useState, useEffect } from 'react';
import ToastContainer, { ToastMessage } from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';

interface User {
  id: string;
  email: string;
  name?: string | null;
  note?: string | null;
  expiresAt?: string | null;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const addToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, password, role: 'USER' })
      });
      if (res.ok) {
        addToast('User created successfully', 'success');
        setShowModal(false);
        setEmail('');
        setPassword('');
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.message || 'Failed to create user');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        addToast('User deleted successfully', 'success');
        fetchUsers();
      } else {
        addToast('Failed to delete user', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error deleting user', 'error');
    }
  };

  const handleUpdateUser = async (id: string, updates: { note?: string, expiresAt?: string | null }) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        addToast('User updated successfully', 'success');
        fetchUsers();
      } else {
        addToast('Failed to update user', 'error');
      }
    } catch (err) {
      console.error(err);
      addToast('Error updating user', 'error');
    }
  };

  const handleAutoDeleteChange = (id: string, option: string) => {
    let expiresAt: string | null = null;
    const now = new Date();
    switch (option) {
      case '1day':
        expiresAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '2days':
        expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '3days':
        expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '1week':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '2weeks':
        expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '1month':
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'never':
      default:
        expiresAt = null;
        break;
    }
    handleUpdateUser(id, { expiresAt });
  };

  const calculateRemainingDays = (expiresAt: string | null | undefined) => {
    if (!expiresAt) return 'Never';
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return `${days} day${days > 1 ? 's' : ''}`;
  };

  if (loading) return <div className="p-8">Loading users...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">User Management</h1>
          <p className="text-gray-400 mt-1">Generate and manage standard customer access accounts.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
        >
          <span className="text-xl">+</span> Create New User
        </button>
      </div>

      <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-800/80 border-b border-gray-800">
            <tr>
              <th className="p-4 font-semibold text-gray-400 w-1/3">User & Note</th>
              <th className="p-4 font-semibold text-gray-400">Role</th>
              <th className="p-4 font-semibold text-gray-400">Created At</th>
              <th className="p-4 font-semibold text-gray-400">Auto Delete</th>
              <th className="p-4 font-semibold text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-gray-800/60 hover:bg-gray-800/40 transition">
                <td className="p-4">
                  <div className="font-medium text-white mb-1.5">{user.email}</div>
                  {editingNoteId === user.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editNoteValue}
                        onChange={(e) => setEditNoteValue(e.target.value)}
                        className="px-2 py-1 bg-gray-950 border border-blue-500 rounded text-gray-300 text-xs focus:outline-none w-full"
                        autoFocus
                        placeholder="Note..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateUser(user.id, { note: editNoteValue });
                            setEditingNoteId(null);
                          } else if (e.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                      />
                      <button onClick={() => {
                        handleUpdateUser(user.id, { note: editNoteValue });
                        setEditingNoteId(null);
                      }} className="text-blue-400 text-xs font-bold px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded transition">Save</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
                      setEditingNoteId(user.id);
                      setEditNoteValue(user.note || '');
                    }}>
                      <span className="text-gray-400 text-sm">{user.note || <span className="text-gray-600 italic text-xs">Add a note to remember this user...</span>}</span>
                      <span className="text-gray-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition text-xs">✏️ Edit</span>
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    user.role === 'ADMIN' ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-gray-400 text-sm">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <select
                      className="bg-gray-950 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                      onChange={(e) => handleAutoDeleteChange(user.id, e.target.value)}
                      value={user.expiresAt ? 'custom' : 'never'} // Since we can't easily reverse engineer the exact dropdown option if it's already set to a date without being complex, we can just show 'Active' vs 'Never' or a generic approach.
                      // A better approach is to reset the value to 'never' if no expiresAt, or let the user choose and we just display the remaining days below it.
                    >
                      <option value="never">Never</option>
                      <option value="1day">1 Day</option>
                      <option value="2days">2 Days</option>
                      <option value="3days">3 Days</option>
                      <option value="1week">1 Week</option>
                      <option value="2weeks">2 Weeks</option>
                      <option value="1month">1 Month</option>
                    </select>
                    {user.expiresAt && (
                      <span className={`text-xs font-semibold ${new Date(user.expiresAt).getTime() < Date.now() ? 'text-red-400' : 'text-orange-400'}`}>
                        {calculateRemainingDays(user.expiresAt)} left
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setDeleteConfirmId(user.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold px-3 py-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-8 text-center text-gray-400">No users found.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-2xl font-bold mb-2 text-white">Create New User</h2>
            <p className="text-xs text-gray-400 mb-6">Generated credentials will grant standard customer dashboard access.</p>
            {error && <div className="mb-4 text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl">{error}</div>}
            
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:border-blue-500 focus:outline-none placeholder-gray-500 font-medium"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:border-blue-500 focus:outline-none placeholder-gray-500 font-medium"
                    placeholder="Set a password"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-700 rounded-xl transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        title="Delete User Account"
        message="Are you sure you want to delete this user account?"
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDeleteUser(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onClose={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

