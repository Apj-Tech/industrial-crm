'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavesApi } from '@/lib/api';
import { CalendarOff, Plus, X, Check, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/auth.store';

const LEAVE_TYPES = [
  { value: 'CASUAL', label: 'Casual leave' },
  { value: 'SICK', label: 'Sick leave' },
  { value: 'PERMISSION', label: 'Permission' },
  { value: 'HALF_DAY', label: 'Half day' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};

export default function LeavePage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ leaveType: 'CASUAL', fromDate: '', toDate: '', reason: '' });
  const [approveNote, setApproveNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leaves', filterStatus],
    queryFn: () => leavesApi.list({ status: filterStatus || undefined, limit: 50 }).then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => leavesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leaves'] }); setShowForm(false); setForm({ leaveType: 'CASUAL', fromDate: '', toDate: '', reason: '' }); },
    onError: (err: any) => alert(err?.response?.data?.message || 'Failed to submit leave.'),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) => leavesApi.approve(id, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  });

  const totalDays = (from: string, to: string) => {
    if (!from || !to) return 0;
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    return Math.max(1, Math.round(diff + 1));
  };

  const leaves = (data as any)?.items || [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-primary" /> Leave management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{(data as any)?.total || 0} requests</p>
        </div>
        {!isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Apply leave
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterStatus === s ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Leaves table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {[isAdmin && 'Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', isAdmin && 'Actions'].filter(Boolean).map(h => (
                  <th key={String(h)} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No leave requests found.</td></tr>
              ) : leaves.map((l: any) => (
                <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  {isAdmin && <td className="px-4 py-3"><p className="font-medium text-slate-900 dark:text-slate-100">{l.user?.name}</p><p className="text-xs text-slate-500">{l.user?.department}</p></td>}
                  <td className="px-4 py-3"><span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded font-medium">{LEAVE_TYPES.find(t => t.value === l.leaveType)?.label || l.leaveType}</span></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{format(new Date(l.fromDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">{format(new Date(l.toDate), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3 text-center font-semibold">{l.totalDays}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate">{l.reason || '—'}</td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span></td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      {l.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <button onClick={() => approveMutation.mutate({ id: l.id, status: 'APPROVED' })}
                            className="btn-ghost p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" title="Approve">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => approveMutation.mutate({ id: l.id, status: 'REJECTED' })}
                            className="btn-ghost p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Reject">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply leave modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Apply for leave</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Leave type *</label>
                <select className="input w-full" value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                  {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">From date *</label>
                  <input type="date" className="input w-full" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">To date *</label>
                  <input type="date" className="input w-full" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} />
                </div>
              </div>
              {form.fromDate && form.toDate && (
                <p className="text-sm text-primary font-medium">{totalDays(form.fromDate, form.toDate)} day(s) of leave</p>
              )}
              <div>
                <label className="form-label">Reason</label>
                <textarea className="input w-full resize-none" rows={3} placeholder="Reason for leave…" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending || !form.fromDate || !form.toDate}
                onClick={() => createMutation.mutate({ ...form, totalDays: totalDays(form.fromDate, form.toDate) })}>
                {createMutation.isPending ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
