'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '@/lib/api';
import { History, Search, User, Building2, FileText, Calendar, Package, LogIn, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LOGIN: <LogIn className="w-3.5 h-3.5" />,
  CUSTOMER_CREATED: <Building2 className="w-3.5 h-3.5" />,
  CUSTOMER_UPDATED: <Building2 className="w-3.5 h-3.5" />,
  MEETING_CREATED: <Calendar className="w-3.5 h-3.5" />,
  MEETING_UPDATED: <Calendar className="w-3.5 h-3.5" />,
  QUOTATION_CREATED: <FileText className="w-3.5 h-3.5" />,
  PRODUCT_CREATED: <Package className="w-3.5 h-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  CUSTOMER_CREATED: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  CUSTOMER_UPDATED: 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-300',
  MEETING_CREATED: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  MEETING_UPDATED: 'bg-purple-50 text-purple-500 dark:bg-purple-900/20 dark:text-purple-300',
  QUOTATION_CREATED: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  PRODUCT_CREATED: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Logged in',
  LOGOUT: 'Logged out',
  CUSTOMER_CREATED: 'Created customer',
  CUSTOMER_UPDATED: 'Updated customer',
  MEETING_CREATED: 'Logged meeting',
  MEETING_UPDATED: 'Updated meeting',
  QUOTATION_CREATED: 'Created quotation',
  QUOTATION_UPDATED: 'Updated quotation',
  PRODUCT_CREATED: 'Added product',
  PRODUCT_UPDATED: 'Updated product',
  LEAVE_REQUESTED: 'Requested leave',
  LEAVE_APPROVED: 'Approved leave',
  ATTENDANCE_CHECKIN: 'Checked in',
  ATTENDANCE_CHECKOUT: 'Checked out',
};

export default function ActivityPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 30;

  const { data, isLoading } = useQuery({
    queryKey: ['activity', search, actionFilter, page],
    queryFn: () => activityApi.list({ search, action: actionFilter || undefined, page, limit }).then(r => r.data.data),
  });

  const logs = (data as any)?.items || [];
  const total = (data as any)?.total || 0;
  const totalPages = (data as any)?.totalPages || 1;

  const uniqueActions = Array.from(new Set(Object.keys(ACTION_LABELS)));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5 text-primary" /> Activity log
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">{total} total events tracked</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-9 w-full text-sm" placeholder="Search user or action…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select className="input pl-9 text-sm" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
            <option value="">All actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p>No activity logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {logs.map((log: any, i: number) => {
              const colorCls = ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
              const icon = ACTION_ICONS[log.action] || <History className="w-3.5 h-3.5" />;
              const label = ACTION_LABELS[log.action] || log.action;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  {/* Icon */}
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${colorCls}`}>
                    {icon}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{log.user?.name || 'System'}</span>
                        <span className="text-sm text-slate-500 mx-1.5">·</span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                        {log.entityType && (
                          <span className="ml-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded">{log.entityType}</span>
                        )}
                      </div>
                      <time className="text-xs text-slate-400 shrink-0 mt-0.5" title={log.createdAt ? format(new Date(log.createdAt), 'dd MMM yyyy HH:mm') : ''}>
                        {log.createdAt ? formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }) : ''}
                      </time>
                    </div>
                    {log.details && (() => {
                      try {
                        const d = JSON.parse(log.details);
                        return (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            {Object.entries(d).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </p>
                        );
                      } catch { return <p className="text-xs text-slate-400 mt-0.5 truncate">{log.details}</p>; }
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-1.5 px-3" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary text-xs py-1.5 px-3" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
