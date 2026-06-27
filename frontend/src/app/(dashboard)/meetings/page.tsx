'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi, customersApi, usersApi } from '@/lib/api';
import { CalendarCheck, Plus, X, Phone, AlertTriangle, MapPin, Timer, ChevronDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

const STATUSES = ['NEW_LEAD','FOLLOW_UP_PENDING','TRIAL_PLANNED','TRIAL_COMPLETED','QUOTATION_SUBMITTED','WAITING_APPROVAL','NEGOTIATION','PURCHASE_ORDER','TECHNICAL_DISCUSSION_COMPLETED','PENDING_CUSTOMER_RESPONSE','LOST','CLOSED'];
const TYPES    = ['VISIT','CALL','ONLINE','TRIAL_SUPPORT','QUOTATION_DISCUSSION','TECHNICAL_DISCUSSION'];
const PRIORITY = ['LOW','MEDIUM','HIGH','URGENT'];

const STATUS_COLORS: Record<string,string> = {
  NEW_LEAD:'bg-blue-100 text-blue-700',FOLLOW_UP_PENDING:'bg-amber-100 text-amber-700',
  TRIAL_PLANNED:'bg-purple-100 text-purple-700',TRIAL_COMPLETED:'bg-teal-100 text-teal-700',
  QUOTATION_SUBMITTED:'bg-indigo-100 text-indigo-700',PURCHASE_ORDER:'bg-green-100 text-green-700',
  NEGOTIATION:'bg-orange-100 text-orange-700',LOST:'bg-red-100 text-red-600',
  CLOSED:'bg-slate-100 text-slate-600',
};

const BLANK_FORM = {
  customerId:'',meetingDate:new Date().toISOString().slice(0,16),meetingType:'VISIT',
  status:'NEW_LEAD',notes:'',summary:'',actionItems:'',customerRequirements:'',
  competitorInfo:'',opportunities:'',nextFollowUp:'',followUpTime:'',
  followUpPriority:'MEDIUM',assignedToId:'',
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({...BLANK_FORM});
  const [custSearch, setCustSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(f => ({...f,[k]:e.target.value}));

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', filterStatus, overdueOnly],
    queryFn: () => meetingsApi.list({ status: filterStatus||undefined, overdueOnly: overdueOnly||undefined, limit: 100 }).then(r => r.data.data),
    staleTime: 30000,
  });

  const { data: custData } = useQuery({
    queryKey: ['cust-search', custSearch],
    queryFn: () => customersApi.list({ search: custSearch, limit: 8 }).then(r => r.data.data?.items),
    enabled: custSearch.length > 1,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => usersApi.list({ limit: 50 }).then(r => r.data.data?.items),
    staleTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => meetingsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings'] }); setShowForm(false); setForm({...BLANK_FORM}); },
    onError: (e: any) => alert(e?.response?.data?.message || 'Failed to log meeting.'),
  });

  const meetings = (data as any)?.items || [];
  const users: any[] = usersData || [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Meetings & Follow-ups
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{(data as any)?.total || 0} records</p>
        </div>
        <div className="flex gap-2">
          <Link href="/customers/map" className="btn-secondary text-sm py-2">
            <MapPin className="w-4 h-4" /> Customer map
          </Link>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Log meeting
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input type="checkbox" className="rounded" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} />
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Overdue only
        </label>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({length:4}).map((_,i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"/><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-32"/></div>
          ))
        ) : meetings.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-3 opacity-30"/>
            <p>No meetings found. Log your first visit.</p>
          </div>
        ) : meetings.map((m: any) => (
          <div key={m.id} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Link href={`/customers/${m.customerId}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary truncate">
                    {m.customer?.companyName}
                  </Link>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[m.status] || 'bg-slate-100 text-slate-600'}`}>
                    {m.status?.replace(/_/g,' ')}
                  </span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded">
                    {m.meetingType?.replace(/_/g,' ')}
                  </span>
                  {m.isGeoVerified && <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded flex items-center gap-1"><MapPin className="w-3 h-3"/>GPS ✓</span>}
                  {m.visitDurationMinutes && <span className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/20 px-2 py-0.5 rounded flex items-center gap-1"><Timer className="w-3 h-3"/>{m.visitDurationMinutes}min</span>}
                </div>
                <p className="text-sm text-slate-500">
                  {m.customer?.contactPerson}
                  {m.customer?.contactNumber && (
                    <a href={`tel:${m.customer.contactNumber}`} className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="w-3 h-3"/>{m.customer.contactNumber}
                    </a>
                  )}
                </p>
                {m.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.notes}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-slate-500">{m.meetingDate ? format(new Date(m.meetingDate),'dd MMM yyyy') : ''}</p>
                <p className="text-xs text-slate-400 mt-0.5">By {m.user?.name}</p>
                {m.assignedTo && <p className="text-xs text-primary mt-0.5">→ {m.assignedTo.name}</p>}
              </div>
            </div>
            {m.nextFollowUp && (
              <div className={`mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 text-xs ${new Date(m.nextFollowUp) < new Date() ? 'text-red-500 font-medium' : 'text-slate-500'}`}>
                <AlertTriangle className="w-3 h-3"/>
                Follow-up: {format(new Date(m.nextFollowUp),'dd MMM yyyy')}
                {m.followUpPriority && m.followUpPriority !== 'MEDIUM' && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded font-semibold ${m.followUpPriority==='URGENT'?'bg-red-100 text-red-600':m.followUpPriority==='HIGH'?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-600'}`}>
                    {m.followUpPriority}
                  </span>
                )}
                <Link href={`/meetings/checkin?meetingId=${m.id}`} className="ml-auto text-primary underline text-xs">
                  Check-in
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Log meeting modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-primary"/> Log meeting / visit
              </h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Customer */}
              <div>
                <label className="form-label">Customer *</label>
                <div className="relative">
                  <input className="input w-full" placeholder="Search company…" value={custSearch}
                    onChange={e => { setCustSearch(e.target.value); setForm(f=>({...f,customerId:''})); }}/>
                  {(custData as any[])?.length > 0 && custSearch.length > 1 && !form.customerId && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {(custData as any[]).map((c: any) => (
                        <button key={c.id} onClick={() => { setForm(f=>({...f,customerId:c.id})); setCustSearch(c.companyName); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
                          <p className="font-medium">{c.companyName}</p>
                          <p className="text-xs text-slate-500">{c.contactPerson}{c.lat?` · 📍 GPS set`:''}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Date & time *</label>
                  <input type="datetime-local" className="input w-full" value={form.meetingDate} onChange={set('meetingDate')}/>
                </div>
                <div>
                  <label className="form-label">Type *</label>
                  <select className="input w-full" value={form.meetingType} onChange={set('meetingType')}>
                    {TYPES.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Status</label>
                <select className="input w-full" value={form.status} onChange={set('status')}>
                  {STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Discussion notes</label>
                <textarea className="input w-full resize-none" rows={3} value={form.notes} onChange={set('notes')} placeholder="What was discussed…"/>
              </div>

              <div>
                <label className="form-label">Customer requirements</label>
                <textarea className="input w-full resize-none" rows={2} value={form.customerRequirements} onChange={set('customerRequirements')} placeholder="What the customer needs…"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Action items</label>
                  <textarea className="input w-full resize-none" rows={2} value={form.actionItems} onChange={set('actionItems')}/>
                </div>
                <div>
                  <label className="form-label">Opportunities</label>
                  <textarea className="input w-full resize-none" rows={2} value={form.opportunities} onChange={set('opportunities')}/>
                </div>
              </div>

              {/* Follow-up */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up schedule</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="form-label">Next follow-up</label>
                    <input type="date" className="input w-full" value={form.nextFollowUp} onChange={set('nextFollowUp')}/>
                  </div>
                  <div>
                    <label className="form-label">Time</label>
                    <input type="time" className="input w-full" value={form.followUpTime} onChange={set('followUpTime')}/>
                  </div>
                  <div>
                    <label className="form-label">Priority</label>
                    <select className="input w-full" value={form.followUpPriority} onChange={set('followUpPriority')}>
                      {PRIORITY.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Assign to</label>
                    <select className="input w-full" value={form.assignedToId} onChange={set('assignedToId')}>
                      <option value="">Self</option>
                      {users.map((u: any)=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Advanced (competitor info) */}
              <button type="button" onClick={() => setShowAdvanced(s=>!s)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced?'rotate-180':''}`}/>
                {showAdvanced ? 'Hide' : 'Show'} competitor & advanced fields
              </button>
              {showAdvanced && (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Competitor information</label>
                    <textarea className="input w-full resize-none" rows={2} value={form.competitorInfo} onChange={set('competitorInfo')} placeholder="Competitor products/pricing mentioned…"/>
                  </div>
                  <div>
                    <label className="form-label">Summary</label>
                    <textarea className="input w-full resize-none" rows={2} value={form.summary} onChange={set('summary')}/>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending || !form.customerId} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? 'Saving…' : 'Log meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
