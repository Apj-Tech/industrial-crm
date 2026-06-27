'use client';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsApi } from '@/lib/api';
import {
  MapPin, Timer, Play, Pause, Square, CheckCircle,
  AlertTriangle, Navigation, Clock, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  return `${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const meetingId = searchParams.get('meetingId') || '';

  const [gpsState, setGpsState] = useState<'idle'|'locating'|'ready'|'error'>('idle');
  const [gpsPos, setGpsPos] = useState<{lat:number;lng:number;accuracy?:number}|null>(null);
  const [gpsErr, setGpsErr] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number|null>(null);
  const [pausedAt, setPausedAt] = useState<number|null>(null);
  const [totalPaused, setTotalPaused] = useState(0);
  const [checkInDone, setCheckInDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null);

  const { data: meetingData } = useQuery({
    queryKey: ['meeting-checkin', meetingId],
    queryFn: () => meetingsApi.get(meetingId).then(r => r.data.data?.meeting),
    enabled: !!meetingId,
  });

  const meeting: any = meetingData;
  const customer = meeting?.customer;

  // If already checked in, restore timer
  useEffect(() => {
    if (meeting?.checkedInAt && !checkInDone) {
      setCheckInDone(true);
      if (meeting.timerStartedAt) {
        const start = new Date(meeting.timerStartedAt).getTime();
        setStartedAt(start);
        setTimerRunning(true);
      }
    }
  }, [meeting]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && !timerPaused && startedAt !== null) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        setElapsed(Math.floor((now - startedAt - totalPaused) / 1000));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, timerPaused, startedAt, totalPaused]);

  const getGPS = () => {
    setGpsState('locating'); setGpsErr('');
    if (!navigator.geolocation) { setGpsErr('GPS not supported on this device.'); setGpsState('error'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => { setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsState('ready'); },
      err => { setGpsErr(err.code === 1 ? 'Location permission denied. Please allow location access.' : 'Could not get your location. Try again.'); setGpsState('error'); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const checkInMutation = useMutation({
    mutationFn: () => meetingsApi.checkIn(meetingId, gpsPos!.lat, gpsPos!.lng),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['meeting-checkin', meetingId] });
      setCheckInDone(true);
      const now = Date.now();
      setStartedAt(now); setTimerRunning(true); setTimerPaused(false); setElapsed(0);
      meetingsApi.timer(meetingId, 'start').catch(() => {});
    },
    onError: (err: any) => alert(err?.response?.data?.message || 'Check-in failed.'),
  });

  const timerMutation = useMutation({
    mutationFn: (action: string) => meetingsApi.timer(meetingId, action),
  });

  const handlePause = () => {
    if (timerPaused) {
      // Resume
      const pauseLen = Date.now() - (pausedAt || Date.now());
      setTotalPaused(p => p + pauseLen);
      setPausedAt(null);
      setTimerPaused(false);
      timerMutation.mutate('resume');
    } else {
      setPausedAt(Date.now());
      setTimerPaused(true);
      timerMutation.mutate('pause');
    }
  };

  const handleStop = () => {
    setTimerRunning(false); setTimerPaused(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timerMutation.mutate('stop');
    router.push('/meetings');
  };

  const distLabel = (m: number) => m < 1000 ? `${m}m` : `${(m/1000).toFixed(1)}km`;

  if (!meetingId) return (
    <div className="card p-8 text-center text-slate-400">
      <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-40" />
      <p>No meeting ID provided. Go back to meetings and use the Check-in link.</p>
      <Link href="/meetings" className="btn-primary mt-4 inline-flex">Back to meetings</Link>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/meetings" className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Customer Check-in</h1>
          {customer && <p className="text-sm text-slate-500">{customer.companyName} · {customer.contactPerson}</p>}
        </div>
      </div>

      {/* GPS card */}
      {!checkInDone && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" /> Step 1 — Get your location
          </h2>
          {gpsState === 'idle' && (
            <button className="btn-primary w-full" onClick={getGPS}>
              <MapPin className="w-4 h-4" /> Get my current GPS location
            </button>
          )}
          {gpsState === 'locating' && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Getting your location…
            </div>
          )}
          {gpsState === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />{gpsErr}</p>
              <button className="btn-secondary w-full" onClick={getGPS}>Try again</button>
            </div>
          )}
          {gpsState === 'ready' && gpsPos && (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Location captured
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  {gpsPos.lat.toFixed(6)}, {gpsPos.lng.toFixed(6)}
                  {gpsPos.accuracy && <span className="ml-2">± {Math.round(gpsPos.accuracy)}m accuracy</span>}
                </p>
              </div>
              {customer?.lat && customer?.lng && (
                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="font-medium text-slate-700 dark:text-slate-300">Customer location set</p>
                  <p className="mt-0.5">Geo-fence radius: {customer.geoFenceRadius || 200}m</p>
                  <p className="text-slate-400 mt-1">Check-in will be validated on submit</p>
                </div>
              )}
              {!customer?.lat && (
                <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <p className="font-medium">No GPS set for this customer</p>
                  <p className="mt-0.5">Check-in will be recorded but not geo-verified. Ask admin to set the customer's GPS coordinates.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Check-in button */}
      {!checkInDone && gpsState === 'ready' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Step 2 — Check in at customer location
          </h2>
          <button
            className="btn-primary w-full text-base py-3"
            disabled={checkInMutation.isPending}
            onClick={() => checkInMutation.mutate()}
          >
            {checkInMutation.isPending ? (
              <span className="flex items-center gap-2 justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Validating location…</span>
            ) : (
              <span className="flex items-center gap-2 justify-center"><CheckCircle className="w-5 h-5" />Confirm check-in</span>
            )}
          </button>
        </div>
      )}

      {/* Checked-in: timer */}
      {checkInDone && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Checked in</h2>
            {meeting?.isGeoVerified && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                📍 Geo-verified
              </span>
            )}
            {meeting?.checkInDistance !== null && meeting?.checkInDistance !== undefined && (
              <span className="text-xs text-slate-500">{distLabel(meeting.checkInDistance)} from customer</span>
            )}
          </div>

          {/* Timer display */}
          <div className="text-center py-6">
            <div className={`text-5xl font-mono font-bold tracking-tight ${timerPaused ? 'text-amber-500' : 'text-primary'}`}>
              {fmtDuration(elapsed)}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {timerPaused ? 'Timer paused' : timerRunning ? 'Meeting in progress…' : 'Timer stopped'}
            </p>
          </div>

          {/* Timer controls */}
          <div className="flex gap-3">
            {timerRunning && (
              <button onClick={handlePause} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm ${timerPaused ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                {timerPaused ? <><Play className="w-4 h-4" />Resume</> : <><Pause className="w-4 h-4" />Pause</>}
              </button>
            )}
            <button onClick={() => { if (confirm('Stop the timer and finish this visit?')) handleStop(); }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700">
              <Square className="w-4 h-4" />End visit
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            Duration is saved automatically when you end the visit.
          </p>
        </div>
      )}

      {/* Customer info card */}
      {customer && (
        <div className="card p-4 text-sm">
          <p className="font-semibold text-slate-900 dark:text-white">{customer.companyName}</p>
          <p className="text-slate-500">{customer.contactPerson}{customer.designation ? ` · ${customer.designation}` : ''}</p>
          {customer.contactNumber && (
            <a href={`tel:${customer.contactNumber}`} className="text-primary hover:underline flex items-center gap-1 mt-1">
              <Navigation className="w-3 h-3" />{customer.contactNumber}
            </a>
          )}
          {customer.address && <p className="text-slate-400 text-xs mt-1">{customer.address}</p>}
          {meeting?.status && (
            <p className="text-xs mt-2 text-slate-500">Status: <span className="font-medium">{meeting.status.replace(/_/g,' ')}</span></p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400">Loading…</div>}>
      <CheckInContent />
    </Suspense>
  );
}
