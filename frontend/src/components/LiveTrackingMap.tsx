'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';

interface LiveEmployee {
  attendanceId: string;
  user: { id: string; name: string; department?: string; phone?: string };
  checkIn: string;
  lastLocation: { lat: number; lng: number; capturedAt: string } | null;
}

interface TrailPoint { lat: number; lng: number; capturedAt: string }

function makeDivIcon(initial: string, stale: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;border-radius:50%;
      background:${stale ? '#f59e0b' : '#1E3A5F'};
      border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:700;font-size:13px;font-family:sans-serif;
    ">${initial}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(points, { padding: [50, 50] });
    }
  }, [JSON.stringify(points)]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LiveTrackingMap({
  employees,
  trail,
  onSelectEmployee,
}: {
  employees: LiveEmployee[];
  trail?: TrailPoint[];
  onSelectEmployee?: (attendanceId: string) => void;
}) {
  const withLocation = employees.filter((e) => e.lastLocation);
  const points: [number, number][] = withLocation.map((e) => [e.lastLocation!.lat, e.lastLocation!.lng]);
  const trailPoints: [number, number][] = (trail || []).map((p) => [p.lat, p.lng]);
  const center: [number, number] = points[0] || [20.5937, 78.9629]; // India centroid fallback

  return (
    <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%', borderRadius: '12px' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={trailPoints.length ? trailPoints : points} />

      {withLocation.map((e) => {
        const minutesAgo = (Date.now() - new Date(e.lastLocation!.capturedAt).getTime()) / 60000;
        const stale = minutesAgo > 10;
        return (
          <Marker
            key={e.attendanceId}
            position={[e.lastLocation!.lat, e.lastLocation!.lng]}
            icon={makeDivIcon(e.user.name.charAt(0).toUpperCase(), stale)}
            eventHandlers={{ click: () => onSelectEmployee?.(e.attendanceId) }}
          >
            <Popup>
              <div style={{ fontSize: 13, minWidth: 160 }}>
                <strong>{e.user.name}</strong>
                {e.user.department && <div style={{ color: '#64748b', fontSize: 12 }}>{e.user.department}</div>}
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  Punched in {formatDistanceToNow(new Date(e.checkIn), { addSuffix: true })}
                </div>
                <div style={{ fontSize: 12, color: stale ? '#b45309' : '#16a34a' }}>
                  Last seen {formatDistanceToNow(new Date(e.lastLocation!.capturedAt), { addSuffix: true })}
                  {stale && ' (stale)'}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {trailPoints.length > 1 && (
        <Polyline positions={trailPoints} pathOptions={{ color: '#1E3A5F', weight: 3, opacity: 0.7 }} />
      )}
    </MapContainer>
  );
}
