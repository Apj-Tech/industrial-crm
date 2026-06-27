'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavesApi, attendanceApi } from '@/lib/api';
import { ShieldCheck, Check, XCircle, Clock, CalendarOff, Fingerprint } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'leaves' | 'attendance'>('leaves');

  const { data: leaveData, isLoading: leaveLoading } = useQuery({
    queryKey: ['admin-leaves-pending'],
    queryFn: () => leavesApi.list({ status: 'PENDING', limit: 50 }).then(r => r.data.data),
  });

  const { data: attendData, isLoading: attendLoading } = useQuery({
    queryKey: ['admin-attendance-pending'],
    queryFn: () => attendanceApi.list({ status: 'PENDING', limit: 50 }).then(r => r.data.data),
  });

  const leaveApproveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => leavesApi.approve(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-leaves-pending'] }),
  });

  const pendingLeaves = (leaveData as any)?.items || [];
  const pendingAttend = (attendData as any)?.items || [];
  const totalPending = pendingLeaves.length + pendingAttend.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" /> Approval queue
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{totalPending} pending {totalPending === 1 ? 'request' : 'requests'}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('leaves')}
          className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'leaves' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
          <CalendarOff className="w-3.5 h-3.5" /> Leaves {pendingLeaves.length > 0 && <span className="ml-1 text-xs bg-amber-400 text-white px-1.5 py-0.5 rounded-full">{pendingLeaves.length}</span>}
        </button>
        <button onClick={() => setTab('attendance')}
          className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-colors ${tab === 'attendance' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
          <Fingerprint className="w-3.5 h-3.5" /> Attendance {pendingAttend.length > 0 && <span className="ml-1 text-xs bg-amber-400 text-white px-1.5 py-0.5 rounded-full">{pendingAttend.length}</span>}
        </button>
      </div>

      {tab === 'leaves' && (
        <div className="space-y-3">
          {leaveLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> :
           pendingLeaves.length === 0 ? (
             <div className="card p-12 text-center text-slate-400">
               <Check className="w-10 h-10 mx-auto mb-3 opacity-30" />
               <p>No pending leave requests</p>
             </div>
           ) : pendingLeaves.map((l: any) => (
            <div key={l.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{l.user?.name?.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{l.user?.name}</p>
                  <p className="text-xs text-slate-500">{l.user?.department}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">{l.leaveType.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {format(new Date(l.fromDate), 'dd MMM')} → {format(new Date(l.toDate), 'dd MMM yyyy')} ({l.totalDays}d)
                    </span>
                  </div>
                  {l.reason && <p className="text-xs text-slate-500 mt-1 italic">"{l.reason}"</p>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => leaveApproveMutation.mutate({ id: l.id, status: 'APPROVED' })}
                  disabled={leaveApproveMutation.isPending}
                  className="btn text-xs py-1.5 px-3 bg-green-600 text-white hover:bg-green-700 focus:ring-green-500">
                  <Check className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => leaveApproveMutation.mutate({ id: l.id, status: 'REJECTED' })}
                  disabled={leaveApproveMutation.isPending}
                  className="btn text-xs py-1.5 px-3 bg-red-600 text-white hover:bg-red-700 focus:ring-red-500">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="space-y-3">
          {attendLoading ? <div className="text-center py-8 text-slate-400">Loading…</div> :
           pendingAttend.length === 0 ? (
             <div className="card p-12 text-center text-slate-400">
               <Check className="w-10 h-10 mx-auto mb-3 opacity-30" />
               <p>No pending attendance corrections</p>
             </div>
           ) : pendingAttend.map((a: any) => (
            <div key={a.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{a.user?.name}</p>
                <p className="text-xs text-slate-500">{format(new Date(a.date), 'dd MMM yyyy')}</p>
                <div className="flex gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                  <span>In: {a.checkIn ? format(new Date(a.checkIn), 'hh:mm a') : '—'}</span>
                  <span>Out: {a.checkOut ? format(new Date(a.checkOut), 'hh:mm a') : '—'}</span>
                  {a.workingHours && <span>{a.workingHours.toFixed(1)}h worked</span>}
                </div>
              </div>
              <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 px-2 py-1 rounded-full">Pending review</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
