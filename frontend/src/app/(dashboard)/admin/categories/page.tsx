'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api';
import { Tags, Plus, X, Pencil, Trash2, Package, Boxes } from 'lucide-react';

interface Category {
  id: string; name: string; color: string; sortOrder: number;
  _count?: { products: number; stock: number };
}

const PRESET_COLORS = ['#1a4fa0', '#166534', '#9333ea', '#b45309', '#0e7490', '#be185d', '#64748b', '#dc2626', '#0d9488', '#7c3aed'];

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data.data?.categories),
  });

  const createMutation = useMutation({
    mutationFn: (d: { name: string; color: string }) => categoriesApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); closeForm(); },
    onError: (err: any) => setError(err?.response?.data?.message || 'Failed to save category.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: { name: string; color: string } }) => categoriesApi.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); closeForm(); },
    onError: (err: any) => setError(err?.response?.data?.message || 'Failed to save category.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onError: (err: any) => alert(err?.response?.data?.message || 'Failed to delete category.'),
  });

  const openCreate = () => { setEditing(null); setName(''); setColor(PRESET_COLORS[0]); setError(''); setShowForm(true); };
  const openEdit = (c: Category) => { setEditing(c); setName(c.name); setColor(c.color); setError(''); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); setError(''); };

  const handleSubmit = () => {
    if (!name.trim()) { setError('Category name is required.'); return; }
    if (editing) updateMutation.mutate({ id: editing.id, d: { name, color } });
    else createMutation.mutate({ name, color });
  };

  const categories: Category[] = data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Tags className="w-5 h-5 text-primary" /> Categories
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Used to classify products, stock items, and Excel import mappings</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> Add category</button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div key={c.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: c.color }} />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{c.name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {c._count?.products ?? 0} products</span>
                    <span className="flex items-center gap-1"><Boxes className="w-3 h-3" /> {c._count?.stock ?? 0} stock</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(c)} className="btn-ghost p-1.5 text-slate-500 hover:text-primary"><Pencil className="w-3.5 h-3.5" /></button>
                <button
                  onClick={() => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id); }}
                  className="btn-ghost p-1.5 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{editing ? 'Edit category' : 'Add category'}</h2>
              <button onClick={closeForm} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{error}</p>}
              <div>
                <label className="form-label">Name *</label>
                <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insert, Endmill, Holder" />
              </div>
              <div>
                <label className="form-label">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <button className="btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending || updateMutation.isPending} onClick={handleSubmit}>
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving…' : (editing ? 'Save changes' : 'Add category')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
