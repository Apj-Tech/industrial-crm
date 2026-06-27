'use client';
import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Boxes, AlertTriangle, TrendingDown, CheckCircle2, Upload, Download, X, FileSpreadsheet, Search } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

interface StockItem {
  id: string; itemCode: string; itemName: string; itemType: string;
  itemGroup?: string; categoryCode?: string;
  availableStock: number; reservedStock: number; minimumStock: number;
  netPrice: number; xceedLp: number; edd?: string; rad?: string; location?: string;
  categoryRef?: { id: string; name: string; color: string };
  product?: { id: string; itemCode: string; productName: string };
}

function stockStatus(item: StockItem) {
  if (item.availableStock === 0) return { label: 'Out of stock', cls: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' };
  if (item.availableStock <= item.minimumStock) return { label: 'Low stock', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return { label: 'In stock', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
}

export default function StockPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const fileRef = useRef<HTMLInputElement>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['stock', search, inStockOnly],
    queryFn: () => api.get('/products/stock', { params: { search: search || undefined, inStockOnly: inStockOnly || undefined } }),
    staleTime: 30000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['stock-stats'],
    queryFn: () => api.get('/products/stock/stats').then((r) => r.data.data),
  });

  const items: StockItem[] = data?.data?.data?.items || [];
  const stats = statsData || {};

  const downloadTemplate = async () => {
    const token = localStorage.getItem('crm_token');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/stock/template`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stock-upload-template.xlsx'; a.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('crm_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/stock/import`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');
      setUploadResult(json.data);
      qc.invalidateQueries({ queryKey: ['stock'] });
      qc.invalidateQueries({ queryKey: ['stock-stats'] });
    } catch (err: any) {
      setUploadResult({ error: err.message || 'Upload failed' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" /> Stock management
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{items.length} items shown</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button className="btn-secondary text-xs py-1.5" onClick={downloadTemplate}><Download className="w-3.5 h-3.5" /> Download template</button>
            <button className="btn-primary text-xs py-1.5" onClick={() => setShowUpload(true)}><Upload className="w-3.5 h-3.5" /> Upload Excel</button>
          </div>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 w-fit"><Boxes className="w-4 h-4 text-primary" /></div>
          <div className="text-xl font-bold mt-2 text-slate-900 dark:text-white">{stats.total ?? items.length}</div>
          <div className="text-xs text-slate-500">Total items</div>
        </div>
        <div className="card p-4">
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30 w-fit"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
          <div className="text-xl font-bold mt-2 text-slate-900 dark:text-white">{stats.inStock ?? '—'}</div>
          <div className="text-xs text-slate-500">In stock</div>
        </div>
        <div className="card p-4">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 w-fit"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
          <div className="text-xl font-bold mt-2 text-slate-900 dark:text-white">{stats.outOfStock ?? '—'}</div>
          <div className="text-xs text-slate-500">Out of stock</div>
        </div>
        <div className="card p-4">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 w-fit"><TrendingDown className="w-4 h-4 text-amber-600" /></div>
          <div className="text-xl font-bold mt-2 text-slate-900 dark:text-white">₹{(stats.stockValue ?? 0).toLocaleString('en-IN')}</div>
          <div className="text-xs text-slate-500">Stock value (net)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-9 w-full text-sm" placeholder="Search item code, name, or item group…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="rounded" />
          In stock only
        </label>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['Item code', 'Item name', 'Category', 'Item group', 'Available', 'Net price', 'Xceed-LP', 'EDD', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : !items.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">No stock data yet.</p>
                    {isAdmin && <p className="text-xs text-slate-400 mt-1">Click "Upload Excel" to import your inventory.</p>}
                  </td>
                </tr>
              ) : items.map((item) => {
                const { label, cls } = stockStatus(item);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{item.itemCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.itemName}</td>
                    <td className="px-4 py-3">
                      {item.categoryRef ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.categoryRef.color }} />
                          {item.categoryRef.name}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.itemGroup || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{item.availableStock}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">₹{item.netPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">₹{item.xceedLp.toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{item.edd || '—'}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>{label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-primary" /> Upload stock Excel</h2>
              <button onClick={() => { setShowUpload(false); setUploadResult(null); }} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                Columns (in order): <strong>Item Type, Product Master, Product Family, Product Subfamily, Item Group, Category, ItemCode, ItemName, InStock, NetPrice, Xceed-LP, EDD, RAD</strong>.
                Existing items are matched by Item Code and updated; Item Group is auto-mapped to a Category.
              </p>
              <button className="btn-secondary text-xs w-full" onClick={downloadTemplate}><Download className="w-3.5 h-3.5" /> Download template first</button>
              <label className="block">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
                  <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm text-slate-500">{uploading ? 'Uploading…' : 'Click to choose a file'}</p>
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} disabled={uploading} />
              </label>
              {uploadResult && (
                <div className={`rounded-lg p-3 text-xs ${uploadResult.error ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'}`}>
                  {uploadResult.error ? <p>{uploadResult.error}</p> : (
                    <>
                      <p className="font-semibold mb-1">Import complete</p>
                      <p>{uploadResult.inserted} inserted · {uploadResult.updated} updated{uploadResult.skipped ? ` · ${uploadResult.skipped} skipped` : ''}</p>
                      {uploadResult.errors?.length > 0 && <p className="text-amber-600 dark:text-amber-400 mt-1">{uploadResult.errors.length} row(s) had errors.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary" onClick={() => { setShowUpload(false); setUploadResult(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
