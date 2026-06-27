'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api';
import Modal from '@/components/Modal';
import { Plus, Search, Phone, MapPin, Building2, ExternalLink, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import Link from 'next/link';

const INDUSTRIES = ['Automotive', 'Aerospace', 'General Engineering', 'Oil & Gas', 'Medical', 'Heavy Machinery', 'Electronics', 'Defense', 'Other'];
const CATEGORIES = ['A - Key Account', 'B - Regular', 'C - Prospect', 'D - Inactive'];

interface Customer {
  id: string; companyName: string; contactPerson: string; contactNumber: string;
  designation?: string; email?: string; location?: string; address?: string;
  lat?: number; lng?: number; geoFenceRadius?: number;
  mapsLink?: string; category?: string; industryType?: string;
  status?: string; remarks?: string; machineDetails?: string;
  _count?: { meetings: number };
}

interface CustomerFormData extends Record<string, unknown> {
  companyName: string; contactPerson: string; contactNumber: string;
  designation: string; email: string; location: string; address: string;
  lat: string; lng: string; geoFenceRadius: string;
  mapsLink: string; category: string; industryType: string;
  status: string; remarks: string; machineDetails: string;
}

const EMPTY: CustomerFormData = {
  companyName: '', contactPerson: '', contactNumber: '', designation: '',
  email: '', location: '', address: '', lat: '', lng: '', geoFenceRadius: '200',
  mapsLink: '', category: '', industryType: '', status: 'ACTIVE',
  remarks: '', machineDetails: '',
};

const CUSTOMER_STATUSES = ['ACTIVE', 'PROSPECT', 'INACTIVE', 'LOST'];

export default function CustomersPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormData>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, industry],
    queryFn: () => customersApi.list({ search: search || undefined, industry: industry || undefined }),
    staleTime: 30000,
  });

  const customers: Customer[] = data?.data?.data?.items || [];

  const saveMutation = useMutation({
    mutationFn: (d: CustomerFormData) =>
      editing ? customersApi.update(editing, d) : customersApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); closeModal(); },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      setErr(e?.response?.data?.message || 'Save failed'),
  });

  const openCreate = () => { setForm(EMPTY); setEditing(null); setErr(''); setOpen(true); };
  const openEdit = (c: Customer) => {
    setForm({
      companyName: c.companyName, contactPerson: c.contactPerson, contactNumber: c.contactNumber,
      designation: c.designation || '', email: c.email || '', location: c.location || '',
      address: c.address || '', lat: c.lat?.toString() || '', lng: c.lng?.toString() || '',
      geoFenceRadius: c.geoFenceRadius?.toString() || '200',
      mapsLink: c.mapsLink || '', category: c.category || '', industryType: c.industryType || '',
      status: c.status || 'ACTIVE', remarks: c.remarks || '', machineDetails: c.machineDetails || '',
    });
    setEditing(c.id); setErr(''); setOpen(true);
  };
  const closeModal = () => { setOpen(false); setEditing(null); };
  const set = (k: keyof CustomerFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = () => {
    if (!form.companyName || !form.contactPerson || !form.contactNumber) {
      setErr('Company name, contact person, and phone are required.'); return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{customers.length} records</p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm sm:btn">
          <Plus className="w-4 h-4" /> Add customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, phone…" className="input pl-9" />
        </div>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="input sm:w-48">
          <option value="">All industries</option>
          {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['Company', 'Contact', 'Phone', 'Location', 'Category', 'Industry', ''].map((h) => (
                  <th key={h} className="table-head text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : !customers.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-muted">No customers found</p>
                    <button onClick={openCreate} className="btn-primary btn-sm mt-3">Add first customer</button>
                  </td>
                </tr>
              ) : customers.map((c) => (
                <tr key={c.id} className="table-row">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <div>{c.contactPerson}</div>
                    {c.designation && <div className="text-xs text-slate-400">{c.designation}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${c.contactNumber}`} className="flex items-center gap-1 text-primary hover:underline">
                      <Phone className="w-3 h-3" />{c.contactNumber}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.location ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-[120px]">{c.location}</span>
                        {c.mapsLink && <a href={c.mapsLink} target="_blank" rel="noreferrer" className="text-primary hover:text-primary-600"><ExternalLink className="w-3 h-3" /></a>}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {c.category ? <span className="badge badge-blue">{c.category}</span> : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{c.industryType || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link href={`/customers/${c.id}`} className="btn-ghost btn-sm">View</Link>
                      {user?.role === 'ADMIN' && (
                        <button onClick={() => openEdit(c)} className="btn-ghost btn-sm">Edit</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={open}
        onClose={closeModal}
        title={editing ? 'Edit customer' : 'Add new customer'}
        size="lg"
        footer={
          <>
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit} className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add customer'}
            </button>
          </>
        }
      >
        {err && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { k: 'companyName',   label: 'Company name *', type: 'text' },
            { k: 'contactPerson', label: 'Contact person *', type: 'text' },
            { k: 'contactNumber', label: 'Phone *', type: 'tel' },
            { k: 'designation',   label: 'Designation', type: 'text' },
            { k: 'email',         label: 'Email', type: 'email' },
            { k: 'location',      label: 'City / Region', type: 'text' },
          ].map(({ k, label, type }) => (
            <div key={k}>
              <label className="label">{label}</label>
              <input type={type} value={form[k as keyof CustomerFormData] as string} onChange={set(k as keyof CustomerFormData)} className="input" />
            </div>
          ))}

          {/* Full address */}
          <div className="sm:col-span-2">
            <label className="label">Full address</label>
            <textarea value={form.address} onChange={set('address')} rows={2} className="input" placeholder="Street, area, city, pincode…" />
          </div>

          {/* GPS — shown with geo-fence radius */}
          <div>
            <label className="label flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" /> GPS latitude
            </label>
            <input type="number" step="0.000001" value={form.lat} onChange={set('lat')} className="input" placeholder="e.g. 18.5204" />
          </div>
          <div>
            <label className="label">GPS longitude</label>
            <input type="number" step="0.000001" value={form.lng} onChange={set('lng')} className="input" placeholder="e.g. 73.8567" />
          </div>
          <div>
            <label className="label">Geo-fence radius (metres)</label>
            <input type="number" min="50" max="5000" value={form.geoFenceRadius} onChange={set('geoFenceRadius')} className="input" />
            <p className="text-xs text-slate-400 mt-1">Check-in is only allowed within this radius of the customer GPS pin.</p>
          </div>
          <div>
            <label className="label">Google Maps link</label>
            <input type="url" value={form.mapsLink} onChange={set('mapsLink')} className="input" placeholder="https://maps.google.com/…" />
          </div>

          {/* Status, Category, Industry */}
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={set('status')} className="input">
              {CUSTOMER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Customer category</label>
            <select value={form.category} onChange={set('category')} className="input">
              <option value="">Select…</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Industry type</label>
            <select value={form.industryType} onChange={set('industryType')} className="input">
              <option value="">Select…</option>
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>

          {/* Machine details & Remarks */}
          <div className="sm:col-span-2">
            <label className="label">Machine details</label>
            <textarea value={form.machineDetails} onChange={set('machineDetails')} rows={2} className="input" placeholder="Machine models, makes, years, specs…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Remarks</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2} className="input" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
