'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api';
import { Users, Plus, X, Shield, UserCheck, UserX, Pencil, Lock, Unlock, Key, RefreshCw } from 'lucide-react';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_ENGINEER', 'SALES'];
const BLANK = { name: '', email: '', password: '', role: 'SALES', phone: '', department: '' };
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  ADMIN:          'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  MANAGER:        'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  SALES_ENGINEER: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  SALES:          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showReset, setShowReset] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [newPwd, setNewPwd] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchVal, setSearchVal] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter, searchVal],
    queryFn: () => usersApi.list({ limit: 200, role: roleFilter || undefined, search: searchVal || undefined }).then(r => r.data.data),
  });

  const inv = (keys: string[]) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
  const mut = (fn: any, msg: string) => ({
    mutationFn: fn,
    onSuccess: () => inv(['admin-users']),
    onError: (e: any) => alert(e?.response?.data?.message || msg),
  });

  const createMutation = useMutation({
    mutationFn: (d: Record<string, unknown>) => usersApi.create(d),
    onSuccess: () => { inv(['admin-users']); closeForm(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to create user.'),
  });
  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; d: Record<string, unknown> }) => usersApi.update(payload.id, payload.d),
    onSuccess: () => { inv(['admin-users']); closeForm(); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to update user.'),
  });
  const deactivateMutation = useMutation(mut((id: string) => usersApi.deactivate(id), 'Failed to deactivate.'));
  const reactivateMutation = useMutation(mut((id: string) => usersApi.reactivate(id), 'Failed to reactivate.'));
  const lockMutation = useMutation(mut((id: string) => usersApi.toggleLock(id), 'Failed to lock/unlock.'));
  const resetPwdMutation = useMutation({
    mutationFn: ({ id, pwd }: { id: string; pwd: string }) => usersApi.resetPassword(id, pwd),
    onSuccess: () => { setShowReset(null); setNewPwd(''); alert('Password reset successfully.'); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to reset password.'),
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm({ ...BLANK }); };
  const openEdit = (u: any) => {
    setEditing(u.id);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', department: u.department || '' });
    setShowForm(true);
  };
  const handleSubmit = () => {
    if (!form.name || !form.email) return alert('Name and email are required.');
    if (!editing && !form.password) return alert('Password is required for new users.');
    if (editing) updateMutation.mutate({ id: editing, d: { name: form.name, phone: form.phone, department: form.department, role: form.role } });
    else createMutation.mutate({ name: form.name, email: form.email, password: form.password, role: form.role, phone: form.phone, department: form.department });
  };

  const users = (data as any)?.items || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> User Management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} registered accounts</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm({ ...BLANK }); setEditing(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add user
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input className="input flex-1 min-w-[180px] text-sm" placeholder="Search name, email, department…"
          value={searchVal} onChange={e => setSearchVal(e.target.value)} />
        <select className="input text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {['Name', 'Email', 'Role', 'Dept', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{u.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                          {u.name}
                          {u.isLocked && <span title="Account locked"><Lock className="w-3 h-3 text-red-500" /></span>}
                        </p>
                        {u.phone && <p className="text-xs text-slate-400">{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] || ''}`}>
                      {u.role?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      u.isLocked ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                      u.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>{u.isLocked ? 'Locked' : u.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-IN') : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => openEdit(u)} className="btn-ghost p-1.5 text-slate-500 hover:text-primary" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setShowReset(u.id); setNewPwd(''); }} className="btn-ghost p-1.5 text-slate-500 hover:text-amber-600" title="Reset password">
                        <Key className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => lockMutation.mutate(u.id)} className={`btn-ghost p-1.5 ${u.isLocked ? 'text-green-600 hover:text-green-700' : 'text-red-400 hover:text-red-600'}`}
                        aria-label={u.isLocked ? 'Unlock account' : 'Lock account'}>
                        {u.isLocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      {u.isActive ? (
                        <button onClick={() => { if (confirm(`Deactivate ${u.name}?`)) deactivateMutation.mutate(u.id); }}
                          className="btn-ghost p-1.5 text-red-400 hover:text-red-600" title="Deactivate">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => reactivateMutation.mutate(u.id)}
                          className="btn-ghost p-1.5 text-green-500 hover:text-green-700" title="Reactivate">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit user modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{editing ? 'Edit user' : 'Add new user'}</h2>
              <button onClick={closeForm} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Full name *</label>
                  <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Role *</label>
                  <select className="input w-full" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input type="email" className="input w-full" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editing} />
                {editing && <p className="text-xs text-slate-400 mt-1">Email can't be changed — deactivate and create a new account if needed.</p>}
              </div>
              {!editing && (
                <div>
                  <label className="form-label">Password *</label>
                  <input type="password" className="input w-full" placeholder="Min 6 characters"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Phone</label>
                  <input className="input w-full" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Department</label>
                  <input className="input w-full" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving…' : (editing ? 'Save changes' : 'Create user')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" /> Reset password
              </h2>
              <button onClick={() => setShowReset(null)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">The user will need to log in with this new password.</p>
              <div>
                <label className="form-label">New password *</label>
                <input type="password" className="input w-full" placeholder="Min 6 characters"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary" onClick={() => setShowReset(null)}>Cancel</button>
              <button className="btn-primary bg-amber-500 hover:bg-amber-600 focus:ring-amber-400"
                disabled={resetPwdMutation.isPending || newPwd.length < 6}
                onClick={() => resetPwdMutation.mutate({ id: showReset, pwd: newPwd })}>
                {resetPwdMutation.isPending ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
