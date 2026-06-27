'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { Radio, Users, Clock, MapPin, X, Phone } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const LiveTrackingMap = dynamic(() => import('@/components/LiveTrackingMap'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading map…</div>,
});

export default function LiveTrackingPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['live-tracking'],
    queryFn: () => attendanceApi.live().then((r) => r.data.data),
    refetchInterval: 15000, // poll every 15s — see README for the WebSocket-vs-polling note
  });

  const { data: trailData } = useQuery({
    queryKey: ['live-trail', selectedId],
    queryFn: () => attendanceApi.locations(selectedId!).then((r) => r.data.data),
    enabled: !!selectedId,
    refetchInterval: 15000,
  });

  const employees = data?.live || [];
  const selected = employees.find((e: any) => e.attendanceId === selectedId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Live tracking
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{employees.length} employee{employees.length !== 1 ? 's' : ''} currently checked in · refreshes every 15s</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Map */}
        <div className="lg:col-span-2 card p-0 overflow-hidden" style={{ height: '560px' }}>
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading…</div>
          ) : employees.filter((e: any) => e.lastLocation).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MapPin className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No employees are currently checked in with GPS data.</p>
            </div>
          ) : (
            <LiveTrackingMap
              employees={employees}
              trail={selectedId ? trailData?.pings : undefined}
              onSelectEmployee={setSelectedId}
            />
          )}
        </div>

        {/* Employee list / detail */}
        <div className="space-y-3">
          {selected ? (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Movement trail</span>
                <button onClick={() => setSelectedId(null)} className="btn-ghost p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{selected.user.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-900 dark:text-white">{selected.user.name}</p>
                  <p className="text-xs text-slate-500">{selected.user.department}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <p className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> In since {format(new Date(selected.checkIn), 'hh:mm a')}</p>
                {selected.user.phone && <p className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {selected.user.phone}</p>}
                <p>{trailData?.pings?.length || 0} GPS points logged today</p>
              </div>
            </div>
          ) : (
            <div className="card p-4 text-xs text-slate-400 text-center">Click a marker or an employee below to see their movement trail.</div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Checked in now</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-80 overflow-y-auto">
              {employees.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-slate-400">No one is currently checked in.</p>
              ) : employees.map((e: any) => {
                const stale = e.lastLocation && (Date.now() - new Date(e.lastLocation.capturedAt).getTime()) / 60000 > 10;
                return (
                  <button
                    key={e.attendanceId}
                    onClick={() => setSelectedId(e.attendanceId)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2.5 ${selectedId === e.attendanceId ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${e.lastLocation ? (stale ? 'bg-amber-400' : 'bg-green-500') : 'bg-slate-300'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{e.user.name}</p>
                      <p className="text-xs text-slate-400">
                        {e.lastLocation ? `Last seen ${formatDistanceToNow(new Date(e.lastLocation.capturedAt), { addSuffix: true })}` : 'No GPS data yet'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
