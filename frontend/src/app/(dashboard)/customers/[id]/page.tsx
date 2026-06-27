'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi, meetingsApi } from '@/lib/api';
import Modal from '@/components/Modal';
import { ArrowLeft, Phone, Mail, MapPin, Plus, ExternalLink, Building2, Loader2, Calendar } from 'lucide-react';
import Link from 'next/link';

const MEETING_TYPES = ['Visit', 'Call', 'Online Meeting', 'Trial Support', 'Quotation Discussion', 'Technical Discussion'];
const STATUSES = ['NEW_LEAD', 'FOLLOW_UP_PENDING', 'TRIAL_PLANNED', 'TRIAL_COMPLETED', 'QUOTATION_SUBMITTED', 'WAITING_FOR_APPROVAL', 'NEGOTIATION', 'PURCHASE_ORDER_RECEIVED', 'LOST_OPPORTUNITY', 'CLOSED'];

const statusColors: Record<string, string> = {
  NEW_LEAD: 'badge-blue', FOLLOW_UP_PENDING: 'badge-yellow', TRIAL_PLANNED: 'badge-purple',
  TRIAL_COMPLETED: 'badge-green', QUOTATION_SUBMITTED: 'badge-amber', WAITING_FOR_APPROVAL: 'badge-yellow',
  NEGOTIATION: 'badge-amber', PURCHASE_ORDER_RECEIVED: 'badge-green', LOST_OPPORTUNITY: 'badge-red', CLOSED: 'badge-gray',
};

interface MeetingForm {
  meetingDate: string; meetingType: string; status: string;
  notes: string; actionItems: string; nextFollowUp: string;
  trialDate: string; trialStatus: string; trialFeedback: string;
}

const EMPTY_MTG: MeetingForm = {
  meetingDate: new Date().toISOString().split('T')[0], meetingType: 'Call',
  status: 'FOLLOW_UP_PENDING', notes: '', actionItems: '', nextFollowUp: '',
  trialDate: '', trialStatus: '', trialFeedback: '',
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [addMtg, setAddMtg] = useState(false);
  const [form, setForm] = useState<MeetingForm>(EMPTY_MTG);
  const [err, setErr] = useState('');
  const set = (k: keyof MeetingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data: cData, isLoading: cLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
  });

  const { data: mData } = useQuery({
    queryKey: ['meetings', id],
    queryFn: () => meetingsApi.list({ customerId: id }),
  });

  const addMutation = useMutation({
    mutationFn: (d: MeetingForm) => meetingsApi.create({ ...d, customerId: id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meetings', id] }); setAddMtg(false); setForm(EMPTY_MTG); },
    onError: (e: { response?: { data?: { message?: string } } }) => setErr(e?.response?.data?.message || 'Failed'),
  });

  const customer = cData?.data?.data?.customer;
  const meetings = mData?.data?.data?.meetings || [];

  if (cLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!customer) return <div className="text-center py-16 text-muted">Customer not found</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn-ghost btn-sm p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="page-title">{customer.companyName}</h1>
          <p className="page-subtitle">{customer.industryType || 'Customer'} {customer.category ? `· ${customer.category}` : ''}</p>
        </div>
      </div>

      {/* Customer info card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{customer.contactPerson}</h2>
              <p className="text-sm text-muted">{customer.designation || 'Contact'}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                <a href={`tel:${customer.contactNumber}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Phone className="w-4 h-4" /> {customer.contactNumber}
                </a>
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Mail className="w-4 h-4" /> {customer.email}
                  </a>
                )}
                {customer.location && (
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <MapPin className="w-4 h-4" /> {customer.location}
                    {customer.mapsLink && <a href={customer.mapsLink} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3 text-primary" /></a>}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/customers" className="text-xs text-muted hover:text-primary">Back to list</Link>
        </div>
        {customer.remarks && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-muted font-medium mb-1">Remarks</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{customer.remarks}</p>
          </div>
        )}
      </div>

      {/* Meetings timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Meeting history ({meetings.length})</h2>
          <button onClick={() => { setAddMtg(true); setErr(''); }} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Log meeting
          </button>
        </div>

        {!meetings.length ? (
          <div className="card p-10 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-muted">No meetings yet</p>
            <button onClick={() => setAddMtg(true)} className="btn-primary btn-sm mt-3">Log first meeting</button>
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m: {
              id: string; meetingDate: string; meetingType: string; status: string;
              notes?: string; actionItems?: string; nextFollowUp?: string;
              user?: { name: string };
            }) => (
              <div key={m.id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {new Date(m.meetingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="badge badge-blue">{m.meetingType}</span>
                      <span className={`badge ${statusColors[m.status] || 'badge-gray'}`}>
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {m.user && <p className="text-xs text-muted mt-0.5">by {m.user.name}</p>}
                  </div>
                  {m.nextFollowUp && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Follow-up: {new Date(m.nextFollowUp).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>
                {m.notes && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{m.notes}</p>}
                {m.actionItems && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-medium text-muted mb-0.5">Action items</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{m.actionItems}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log meeting modal */}
      <Modal
        open={addMtg}
        onClose={() => setAddMtg(false)}
        title="Log meeting"
        size="lg"
        footer={
          <>
            <button onClick={() => setAddMtg(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => addMutation.mutate(form)} className="btn-primary" disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save meeting
            </button>
          </>
        }
      >
        {err && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Meeting date *</label>
            <input type="date" value={form.meetingDate} onChange={set('meetingDate')} className="input" />
          </div>
          <div>
            <label className="label">Meeting type</label>
            <select value={form.meetingType} onChange={set('meetingType')} className="input">
              {MEETING_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={set('status')} className="input">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Next follow-up date</label>
            <input type="date" value={form.nextFollowUp} onChange={set('nextFollowUp')} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Discussion notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={4} className="input" placeholder="Key points from the meeting…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Action items</label>
            <textarea value={form.actionItems} onChange={set('actionItems')} rows={2} className="input" placeholder="What needs to happen next…" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
