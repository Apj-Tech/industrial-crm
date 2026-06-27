'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi, categoriesApi } from '@/lib/api';
import Modal from '@/components/Modal';
import { Plus, Search, Package, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

interface Product {
  id: string; itemCode: string; productName: string; description?: string;
  unit?: string; standardPrice: number; category?: string; categoryId?: string;
  categoryRef?: { id: string; name: string; color: string };
  productRef?: string; isCustom?: boolean; hsnCode?: string;
  drawingNumber?: string; revisionNumber?: string;
}
interface ProductForm {
  itemCode: string; productName: string; description: string; unit: string;
  standardPrice: string; categoryId: string; productRef: string; isCustom: boolean;
  hsnCode: string; drawingNumber: string; revisionNumber: string;
}
const EMPTY: ProductForm = {
  itemCode: '', productName: '', description: '', unit: 'Nos', standardPrice: '0',
  categoryId: '', productRef: '', isCustom: false, hsnCode: '', drawingNumber: '', revisionNumber: '',
};

export default function ProductsPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const set = (k: keyof ProductForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const { data, isLoading } = useQuery({
    queryKey: ['products', search],
    queryFn: () => productsApi.list({ search: search || undefined }),
    staleTime: 60000,
  });
  const products: Product[] = data?.data?.data?.items || [];

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data.data?.categories),
  });
  const categories: { id: string; name: string; color: string }[] = categoriesData || [];

  const saveMutation = useMutation({
    mutationFn: (d: ProductForm) => {
      const categoryName = categories.find((c) => c.id === d.categoryId)?.name || '';
      const payload = { ...d, category: categoryName, standardPrice: parseFloat(d.standardPrice) };
      return editing ? productsApi.update(editing, payload) : productsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); close_(); },
    onError: (e: { response?: { data?: { message?: string } } }) => setErr(e?.response?.data?.message || 'Save failed'),
  });

  const close_ = () => { setOpen(false); setEditing(null); setForm(EMPTY); };
  const openEdit = (p: Product) => {
    setForm({
      itemCode: p.itemCode, productName: p.productName, description: p.description || '',
      unit: p.unit || 'Nos', standardPrice: String(p.standardPrice), categoryId: p.categoryId || '',
      productRef: p.productRef || '', isCustom: p.isCustom || false, hsnCode: p.hsnCode || '',
      drawingNumber: p.drawingNumber || '', revisionNumber: p.revisionNumber || '',
    });
    setEditing(p.id); setErr(''); setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Product master</h1>
          <p className="page-subtitle">{products.length} products</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button onClick={() => { setForm(EMPTY); setEditing(null); setErr(''); setOpen(true); }} className="btn-primary btn-sm sm:btn">
            <Plus className="w-4 h-4" /> Add product
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by item code, name, description…" className="input pl-9" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['Item code', 'Product name', 'Description', 'Unit', 'Price (₹)', 'Category', 'HSN', 'Drawing', ''].map((h) => (
                  <th key={h} className="table-head text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100 dark:border-slate-700">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" /></td>
                  ))}
                </tr>
              )) : !products.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-muted">No products found</p>
                  </td>
                </tr>
              ) : products.map((p) => (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{p.itemCode}{p.isCustom && <span className="ml-1 badge badge-yellow text-[10px]">Custom</span>}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{p.productName}</td>
                  <td className="px-4 py-3 text-muted text-xs max-w-[180px] truncate">{p.description || '-'}</td>
                  <td className="px-4 py-3 text-muted">{p.unit || '-'}</td>
                  <td className="px-4 py-3 font-medium">₹{p.standardPrice.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {p.categoryRef ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.categoryRef.color }} />
                        {p.categoryRef.name}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{p.hsnCode || '-'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{p.drawingNumber || '-'}{p.revisionNumber ? ` r${p.revisionNumber}` : ''}</td>
                  <td className="px-4 py-3">
                    {user?.role === 'ADMIN' && (
                      <button onClick={() => openEdit(p)} className="btn-ghost btn-sm">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={close_} title={editing ? 'Edit product' : 'Add product'} size="lg"
        footer={
          <>
            <button onClick={close_} className="btn-secondary">Cancel</button>
            <button onClick={() => saveMutation.mutate(form)} className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add product'}
            </button>
          </>
        }
      >
        {err && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Item code *</label><input value={form.itemCode} onChange={set('itemCode')} className="input" /></div>
          <div><label className="label">Product name *</label><input value={form.productName} onChange={set('productName')} className="input" /></div>
          <div><label className="label">Unit</label><input value={form.unit} onChange={set('unit')} className="input" /></div>
          <div><label className="label">Standard price (₹)</label><input type="number" value={form.standardPrice} onChange={set('standardPrice')} className="input" /></div>
          <div>
            <label className="label">Category</label>
            <select value={form.categoryId} onChange={set('categoryId')} className="input">
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">HSN code</label><input value={form.hsnCode} onChange={set('hsnCode')} className="input" /></div>
          <div><label className="label">Product ref</label><input value={form.productRef} onChange={set('productRef')} className="input" /></div>
          <div><label className="label">Drawing number</label><input value={form.drawingNumber} onChange={set('drawingNumber')} className="input" /></div>
          <div><label className="label">Revision number</label><input value={form.revisionNumber} onChange={set('revisionNumber')} className="input" /></div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.isCustom} onChange={(e) => setForm((f) => ({ ...f, isCustom: e.target.checked }))} className="rounded" />
              Custom / non-catalog item
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3} className="input" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
