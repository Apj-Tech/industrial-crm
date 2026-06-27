'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import { MapPin, Building2, Search, Navigation } from 'lucide-react';

const Map = dynamic(() => import('@/components/CustomerMap'), { ssr: false, loading: () => (
  <div className="h-full flex items-center justify-center text-slate-400 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl">Loading map…</div>
) });

export default function CustomerMapPage() {
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers-with-location'],
    queryFn: () => customersApi.withLocation().then(r => r.data.data?.customers),
    staleTime: 60000,
  });

  const customers: any[] = data || [];
  const filtered = customers.filter(c =>
    !search || c.companyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <MapPin className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Customer Map</h1>
        <span className="text-sm text-slate-500">— {customers.length} locations pinned</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input className="input pl-9 w-full text-sm" placeholder="Search customers…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card overflow-hidden max-h-[520px] overflow-y-auto">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase">Pinned customers ({filtered.length})</p>
            </div>
            {isLoading ? (
              <div className="p-4 text-center text-slate-400 text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No customers with GPS yet.</p>
                <p className="text-xs mt-1">Add lat/lng when editing a customer to pin it on the map.</p>
              </div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => setSelected(c)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 dark:border-slate-700 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${selected?.id === c.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.companyName}</p>
                <p className="text-xs text-slate-500 truncate">{c.contactPerson}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5" />{c._count?.meetings ?? 0} visits
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    c.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    c.status === 'PROSPECT' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>{c.status}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-3 card p-0 overflow-hidden" style={{ height: '580px' }}>
          <Map customers={filtered} selected={selected} onSelect={setSelected} />
        </div>
      </div>

      {/* Selected customer details */}
      {selected && (
        <div className="card p-4 mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white">{selected.companyName}</p>
              <p className="text-sm text-slate-500">{selected.contactPerson} · {selected.location}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                GPS: {selected.lat?.toFixed(6)}, {selected.lng?.toFixed(6)} · Geo-fence: {selected.geoFenceRadius}m
              </p>
            </div>
          </div>
          <a href={`/customers/${selected.id}`}
            className="btn-primary text-sm py-2 px-4 shrink-0">
            View customer
          </a>
        </div>
      )}
    </div>
  );
}
