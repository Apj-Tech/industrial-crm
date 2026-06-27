'use client';
import { useState } from 'react';
import { BarChart3, Download, FileText, Users, Building2, CalendarCheck, Package, Clock, CalendarOff } from 'lucide-react';

const REPORT_TYPES = [
  { id: 'customers', label: 'Customer report', icon: Building2, desc: 'All customers with contact details and category', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  { id: 'meetings', label: 'Follow-up report', icon: CalendarCheck, desc: 'Meeting history and follow-up status pipeline', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
  { id: 'quotations', label: 'Quotation report', icon: FileText, desc: 'All quotations with items and approval status', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  { id: 'products', label: 'Product report', icon: Package, desc: 'Product master list with prices and HSN codes', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20' },
  { id: 'attendance', label: 'Attendance report', icon: Clock, desc: 'Employee attendance and working hours summary', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  { id: 'leaves', label: 'Leave report', icon: CalendarOff, desc: 'Leave requests history and approval status', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  { id: 'users', label: 'Team report', icon: Users, desc: 'All team members with roles and status', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20' },
  { id: 'activity', label: 'Activity log report', icon: BarChart3, desc: 'Full audit trail of all user actions', color: 'text-slate-600 bg-slate-50 dark:bg-slate-800' },
];

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [format, setFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');

  const handleDownload = async (reportId: string) => {
    setDownloading(reportId);
    const token = localStorage.getItem('crm_token');
    const params = new URLSearchParams({ format, ...(dateFrom && { from: dateFrom }), ...(dateTo && { to: dateTo }) });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/${reportId}/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report not available yet');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `${reportId}-report-${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`;
      a.click();
    } catch (_) {
      alert(`Failed to generate the ${reportId} report. Please check your connection and try again.`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Reports & exports
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Download reports in CSV, Excel, or PDF format</p>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="form-label">From date</label>
          <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">To date</label>
          <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Format</label>
          <select className="input" value={format} onChange={e => setFormat(e.target.value as any)}>
            <option value="csv">CSV</option>
            <option value="excel">Excel (.xlsx)</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
        <p className="text-xs text-slate-400 self-end pb-2">Leave dates blank for all-time data</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {REPORT_TYPES.map(r => {
          const Icon = r.icon;
          const isDownloading = downloading === r.id;
          return (
            <div key={r.id} className="card p-4 flex flex-col justify-between gap-4 hover:shadow-card-hover transition-shadow">
              <div>
                <div className={`w-10 h-10 rounded-lg ${r.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">{r.label}</p>
                <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
              </div>
              <button
                onClick={() => handleDownload(r.id)}
                disabled={isDownloading}
                className="btn-secondary text-xs py-1.5 w-full"
              >
                {isDownloading ? (
                  <span className="flex items-center gap-1.5 justify-center"><span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> Preparing…</span>
                ) : (
                  <span className="flex items-center gap-1.5 justify-center"><Download className="w-3.5 h-3.5" /> Download {format.toUpperCase()}</span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
