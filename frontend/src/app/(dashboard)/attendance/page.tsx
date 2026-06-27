'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { Clock, MapPin, CheckCircle, Loader2, Radio } from 'lucide-react';

interface AttRecord {
  id: string; date: string; checkIn?: string; checkOut?: string;
  checkInLat?: number; checkInLng?: number; workingHours?: number; status: string;
  user?: { name: string };
}

const PING_INTERVAL_MS = 30000; // 30s — foreground-only while this tab/app is open

export default function AttendancePage() {
  const qc = useQueryClient();
  const [gpsErr, setGpsErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const [pingCount, setPingCount] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number; accuracy?: number } | null>(null);

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceApi.today(),
    retry: false,
  });
  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['attendance-list'],
    queryFn: () => attendanceApi.list({}),
    staleTime: 60000,
  });

  const today = todayData?.data?.data?.record;
  const records: AttRecord[] = listData?.data?.data?.items || [];
  const isOnTheClock = Boolean(today?.checkIn && !today?.checkOut);

  const checkInMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat?: number; lng?: number }) => attendanceApi.checkIn(lat, lng),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-today'] }); qc.invalidateQueries({ queryKey: ['attendance-list'] }); },
  });
  const checkOutMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat?: number; lng?: number }) => attendanceApi.checkOut(lat, lng),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance-today'] }); qc.invalidateQueries({ queryKey: ['attendance-list'] }); },
  });

  const getLocation = () => new Promise<{ lat: number; lng: number } | null>((res) => {
    if (!navigator.geolocation) { res(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => res(null),
      { timeout: 5000 }
    );
  });

  const handleCheck = async (type: 'in' | 'out') => {
    setLoading(true); setGpsErr('');
    const loc = await getLocation();
    if (type === 'in') await checkInMutation.mutateAsync({ lat: loc?.lat, lng: loc?.lng });
    else await checkOutMutation.mutateAsync({ lat: loc?.lat, lng: loc?.lng });
    setLoading(false);
  };

  // ── Live GPS tracking — starts automatically while checked in ─────
  // Foreground-only: this runs while the browser tab / app is open and the
  // device has granted location permission. True background tracking (after
  // the app is minimized) requires a native app with a background-location
  // plugin — a website cannot do this, especially on iOS.
  useEffect(() => {
    if (!isOnTheClock) {
      stopTracking();
      return;
    }
    if (!navigator.geolocation) {
      setGpsErr('Your browser does not support location tracking.');
      return;
    }

    // Keep the most recent position fresh via watchPosition...
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setTrackingActive(true);
        setGpsErr('');
      },
      (err) => {
        setTrackingActive(false);
        setGpsErr(err.code === 1 ? 'Location permission denied. Live tracking is paused — enable location access to resume.' : 'Could not get your location.');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    // ...and POST a ping every 30s using whatever the latest watched position is
    pingTimerRef.current = setInterval(() => {
      const pos = lastPositionRef.current;
      if (!pos) return;
      attendanceApi.ping(pos.lat, pos.lng, pos.accuracy)
        .then(() => setPingCount((c) => c + 1))
        .catch(() => { /* silent — next interval will retry */ });
    }, PING_INTERVAL_MS);

    return stopTracking;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnTheClock]);

  function stopTracking() {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
    setTrackingActive(false);
  }

  useEffect(() => stopTracking, []); // cleanup on unmount

  const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' });

  const statusColors: Record<string, string> = { PRESENT: 'badge-green', ABSENT: 'badge-red', HALF_DAY: 'badge-yellow', PENDING: 'badge-gray' };

  return (
    <div className="space-y-5">
      <h1 className="page-title">Attendance</h1>

      {/* Today card */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="section-title mb-0">Today — {fmtDate(new Date().toISOString())}</h2>
          {isOnTheClock && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 ${trackingActive ? 'animate-ping' : ''}`} />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <Radio className="w-3.5 h-3.5" /> Live tracking active{pingCount > 0 ? ` · ${pingCount} updates sent` : ''}
            </span>
          )}
        </div>
        {todayLoading ? (
          <div className="flex items-center gap-2 text-muted py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 mt-4">
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-muted">Check-in</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{fmtTime(today?.checkIn)}</p>
                {today?.checkInLat && (
                  <p className="text-xs text-muted flex items-center gap-0.5 mt-0.5">
                    <MapPin className="w-3 h-3" /> GPS captured
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted">Check-out</p>
                <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">{fmtTime(today?.checkOut)}</p>
              </div>
              {today?.workingHours && (
                <div>
                  <p className="text-xs text-muted">Working hours</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {Math.floor(today.workingHours)}h {Math.round((today.workingHours % 1) * 60)}m
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 sm:ml-auto">
              {!today?.checkIn && (
                <button onClick={() => handleCheck('in')} disabled={loading} className="btn-primary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Punch in
                </button>
              )}
              {today?.checkIn && !today?.checkOut && (
                <button onClick={() => handleCheck('out')} disabled={loading} className="btn-secondary">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Punch out
                </button>
              )}
              {today?.checkIn && today?.checkOut && (
                <span className="badge badge-green text-sm px-4 py-2">Day complete ✓</span>
              )}
            </div>
          </div>
        )}
        {gpsErr && <p className="text-xs text-amber-600 mt-2">{gpsErr}</p>}
        {isOnTheClock && (
          <p className="text-xs text-slate-400 mt-3">
            Your location updates while this page is open, so your manager can see your live position during work hours.
            Close the app or lose signal and tracking pauses — it isn't tracked in the background.
          </p>
        )}
      </div>

      {/* History */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Attendance history</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['Date', 'Check-in', 'Check-out', 'Hours', 'Status'].map((h) => (
                  <th key={h} className="table-head text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse w-20" /></td>
                  ))}
                </tr>
              )) : !records.length ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No records yet</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-4 py-3 font-medium">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3">{fmtTime(r.checkIn)}</td>
                  <td className="px-4 py-3">{fmtTime(r.checkOut)}</td>
                  <td className="px-4 py-3">{r.workingHours ? `${r.workingHours.toFixed(1)}h` : '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusColors[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
