'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi } from '@/lib/api';
import { Bell, CheckCheck, AlertTriangle, Clock, CalendarOff, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/navigation';

const ALERT_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  UPCOMING_24H:      { label: 'Due in 24 hrs',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',   icon: Clock },
  UPCOMING_SAME_DAY: { label: 'Due today',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  OVERDUE:           { label: 'Overdue',         color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',      icon: AlertTriangle },
  ESCALATION:        { label: 'Escalation',      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: AlertTriangle },
  WEEKLY:            { label: 'Weekly reminder', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon: CalendarOff },
};

export default function AlertsPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => meetingsApi.alerts().then(r => r.data.data),
    refetchInterval: 30000,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => meetingsApi.markAlertRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const markAllRead = async () => {
    const alerts = (data as any)?.alerts || [];
    await Promise.all(alerts.map((a: any) => meetingsApi.markAlertRead(a.id)));
    qc.invalidateQueries({ queryKey: ['alerts'] });
  };

  const alerts: any[] = (data as any)?.alerts || [];
  const count = (data as any)?.count || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Alerts & Reminders
            {count > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{count}</span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Follow-up reminders and overdue alerts</p>
        </div>
        {count > 0 && (
          <button onClick={markAllRead} className="btn-secondary text-xs py-1.5 flex items-center gap-1.5">
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-32" />
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div className="card p-16 text-center">
            <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-medium text-slate-700 dark:text-slate-300">All caught up!</p>
            <p className="text-sm text-slate-500 mt-1">No pending alerts or reminders</p>
          </div>
        ) : alerts.map((alert: any) => {
          const cfg = ALERT_CONFIG[alert.alertType] || ALERT_CONFIG.WEEKLY;
          const Icon = cfg.icon;
          return (
            <div
              key={alert.id}
              className="card p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => {
                readMutation.mutate(alert.id);
                router.push(`/meetings?id=${alert.meetingId}`);
              }}
            >
              <div className={`p-2 rounded-lg shrink-0 ${cfg.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-slate-400">
                    {alert.createdAt ? formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true }) : ''}
                  </span>
                </div>
                <p className="font-medium text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {alert.meeting?.customer?.companyName || 'Unknown customer'}
                </p>
                {alert.meeting?.nextFollowUp && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Follow-up: {format(new Date(alert.meeting.nextFollowUp), 'dd MMM yyyy')}
                    {alert.meeting.followUpPriority && (
                      <span className={`ml-2 font-semibold ${alert.meeting.followUpPriority === 'URGENT' ? 'text-red-500' : alert.meeting.followUpPriority === 'HIGH' ? 'text-amber-600' : ''}`}>
                        {alert.meeting.followUpPriority}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
