'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatDistanceToNow } from 'date-fns';

interface Customer {
  id: string; companyName: string; contactPerson: string; contactNumber?: string;
  lat: number; lng: number; status?: string; geoFenceRadius?: number;
  _count?: { meetings: number };
}

function makePinIcon(status: string) {
  const color = status === 'ACTIVE' ? '#16A34A' : status === 'PROSPECT' ? '#2563EB' : '#64748B';
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"><div style="transform:rotate(45deg);height:100%;display:flex;align-items:center;justify-content:center;font-size:12px">🏢</div></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -32],
  });
}

function FitBounds({ customers, selected }: { customers: Customer[]; selected: Customer | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected) { map.setView([selected.lat, selected.lng], 15); return; }
    if (customers.length === 1) { map.setView([customers[0].lat, customers[0].lng], 14); return; }
    if (customers.length > 1) {
      const bounds = L.latLngBounds(customers.map(c => [c.lat, c.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length, selected?.id]);
  return null;
}

export default function CustomerMap({
  customers, selected, onSelect,
}: { customers: Customer[]; selected: Customer | null; onSelect: (c: Customer) => void }) {
  const center: [number, number] = customers[0]
    ? [customers[0].lat, customers[0].lng]
    : [20.5937, 78.9629];

  return (
    <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds customers={customers} selected={selected} />

      {customers.map(c => (
        <div key={c.id}>
          {/* Geo-fence circle */}
          <Circle
            center={[c.lat, c.lng]}
            radius={c.geoFenceRadius || 200}
            pathOptions={{
              color: selected?.id === c.id ? '#1E3A5F' : '#2563EB',
              fillColor: selected?.id === c.id ? '#1E3A5F' : '#2563EB',
              fillOpacity: 0.08,
              weight: selected?.id === c.id ? 2 : 1,
            }}
          />
          <Marker
            position={[c.lat, c.lng]}
            icon={makePinIcon(c.status || 'ACTIVE')}
            eventHandlers={{ click: () => onSelect(c) }}
          >
            <Popup maxWidth={240}>
              <div style={{ fontSize: 13 }}>
                <strong>{c.companyName}</strong>
                <div style={{ color: '#64748B', fontSize: 12 }}>{c.contactPerson}</div>
                {c.contactNumber && (
                  <a href={`tel:${c.contactNumber}`} style={{ color: '#2563EB', fontSize: 12, display: 'block', marginTop: 4 }}>
                    📞 {c.contactNumber}
                  </a>
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                  {c._count?.meetings ?? 0} visit{c._count?.meetings !== 1 ? 's' : ''} logged
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  Geo-fence: {c.geoFenceRadius || 200}m radius
                </div>
              </div>
            </Popup>
          </Marker>
        </div>
      ))}
    </MapContainer>
  );
}
