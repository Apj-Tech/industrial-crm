'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationsApi, customersApi, productsApi } from '@/lib/api';
import { FileText, Plus, X, Search, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', QUOTATION_SUBMITTED: 'Submitted', WAITING_APPROVAL: 'Awaiting Approval',
  NEGOTIATION: 'Negotiation', PURCHASE_ORDER: 'PO Received', CLOSED: 'Closed', LOST: 'Lost',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  QUOTATION_SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  NEGOTIATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  PURCHASE_ORDER: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  CLOSED: 'bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-200',
  LOST: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};

interface QuoteItem {
  itemCode: string; productName: string; description: string; category: string;
  unit: string; quantity: number; unitPrice: number; discount: number; hsnCode: string;
  delivery: string; productId?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const BLANK_LETTERHEAD = {
  quotationDate: todayISO(), enquiryDate: '', enquiryRef: '', subject: 'Quotation for Cutting Tools',
  toName: '', toAddr1: '', toAddr2: '', toState: '', kindAttn: '', toDesignation: '',
  salesTax: '18% GST Extra', paymentTerms: '', validity: '15 Days', deliveryCharges: '',
  signCompany: 'Tulips Machining Solutions', signName: '', signDesignation: '',
};

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTerms, setShowTerms] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [letterhead, setLetterhead] = useState({ ...BLANK_LETTERHEAD });
  const [codeSearch, setCodeSearch] = useState('');
  const [itemIdx, setItemIdx] = useState<number | null>(null);

  const { data: qData, isLoading } = useQuery({
    queryKey: ['quotations', search, filterStatus],
    queryFn: () => quotationsApi.list({ search, status: filterStatus || undefined, limit: 50 }).then((r) => r.data.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['quotation-stats'],
    queryFn: () => quotationsApi.stats().then((r) => r.data.data),
  });

  const { data: custData } = useQuery({
    queryKey: ['customers-search', custSearch],
    queryFn: () => customersApi.list({ search: custSearch, limit: 10 }).then((r) => r.data.data?.items),
    enabled: custSearch.length > 1,
  });

  const { data: productSearch } = useQuery({
    queryKey: ['product-autocomplete', codeSearch],
    queryFn: () => productsApi.autocomplete(codeSearch).then((r) => r.data.data?.results),
    enabled: codeSearch.length > 1,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => quotationsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['quotation-stats'] });
      resetForm(); setShowForm(false);
    },
    onError: (err: any) => alert(err?.response?.data?.message || 'Failed to create quotation.'),
  });

  const resetForm = () => {
    setSelectedCustomer(null); setItems([]); setNotes(''); setValidUntil('');
    setCustSearch(''); setLetterhead({ ...BLANK_LETTERHEAD });
  };

  const selectCustomer = (c: any) => {
    setSelectedCustomer(c);
    setCustSearch('');
    setLetterhead((prev) => ({
      ...prev,
      toName: c.companyName || '',
      toAddr1: c.location || '',
      kindAttn: c.contactPerson || '',
      toDesignation: c.designation || '',
    }));
  };

  const addBlankItem = () => setItems((p) => [...p, { itemCode: '', productName: '', description: '', category: '', unit: 'PCS', quantity: 1, unitPrice: 0, discount: 0, hsnCode: '', delivery: '' }]);

  const fillFromProduct = (prod: any, idx: number) => {
    setItems((p) => p.map((it, i) => i === idx ? {
      ...it,
      itemCode: prod.itemCode, productName: prod.productName, description: prod.description || '',
      category: prod.categoryRef?.name || '', unit: prod.unit || 'PCS',
      unitPrice: prod.standardPrice, hsnCode: prod.hsnCode || '', productId: prod.id,
    } : it));
    setCodeSearch(''); setItemIdx(null);
  };

  const updateItem = (idx: number, field: keyof QuoteItem, val: string | number) =>
    setItems((p) => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));

  const netOf = (it: QuoteItem) => it.unitPrice * (1 - (it.discount || 0) / 100);
  const totalOf = (it: QuoteItem) => netOf(it) * it.quantity;
  const grandTotal = items.reduce((s, it) => s + totalOf(it), 0);

  const handleSubmit = () => {
    if (!selectedCustomer) return alert('Please select a customer.');
    if (!items.length) return alert('Add at least one item.');
    createMutation.mutate({
      customerId: selectedCustomer.id, items, notes, validUntil: validUntil || undefined,
      ...letterhead,
      enquiryDate: letterhead.enquiryDate || undefined,
    });
  };

  const downloadPdf = (id: string, num: string) => {
    const token = localStorage.getItem('crm_token');
    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/quotations/${id}/pdf`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${num.replace(/\//g, '-')}.pdf`; a.click(); });
  };

  const quotations = qData?.items || [];
  const stats = statsData || {};

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Quotations
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{qData?.total || 0} total quotations</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" /> New quotation
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-5">
        {[
          ['Total', stats.total, ''],
          ['Draft', stats.draft, 'DRAFT'],
          ['Submitted', stats.submitted, 'QUOTATION_SUBMITTED'],
          ['Negotiation', stats.negotiation, 'NEGOTIATION'],
          ['PO Received', stats.purchaseOrder, 'PURCHASE_ORDER'],
          ['Lost', stats.lost, 'LOST'],
        ].map(([label, val, statusVal]) => (
          <button
            key={label as string}
            onClick={() => setFilterStatus(filterStatus === statusVal ? '' : (statusVal as string))}
            className={`card p-3 text-left transition-colors ${filterStatus === statusVal ? 'ring-2 ring-primary' : ''}`}
          >
            <p className="text-lg font-bold text-slate-900 dark:text-white">{val ?? 0}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input className="input pl-9 w-full text-sm" placeholder="Search quotation number, company, subject…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                {['Quotation #', 'Customer', 'Subject', 'Items', 'Total', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
              ) : quotations.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No quotations yet. Create your first one.</td></tr>
              ) : quotations.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-primary text-xs">{q.quotationNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{q.customer?.companyName}</p>
                    <p className="text-xs text-slate-500">{q.customer?.contactPerson}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">{q.subject || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{q._count?.items} items</td>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">₹{q.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[q.status] || STATUS_COLORS.DRAFT}`}>
                      {STATUS_LABELS[q.status] || q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{format(new Date(q.createdAt), 'dd MMM yyyy')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => downloadPdf(q.id, q.quotationNumber)} className="btn-ghost p-1.5 text-primary" title="Download PDF">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create quotation modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 px-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> New quotation</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer select */}
              <div>
                <label className="form-label">Customer *</label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedCustomer.companyName}</p>
                      <p className="text-xs text-slate-500">{selectedCustomer.contactPerson} · {selectedCustomer.location}</p>
                    </div>
                    <button onClick={() => setSelectedCustomer(null)} className="btn-ghost p-1 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input className="input w-full" placeholder="Search company name…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} />
                    {custData && custSearch.length > 1 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {custData.map((c: any) => (
                          <button key={c.id} onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm">
                            <p className="font-medium">{c.companyName}</p>
                            <p className="text-xs text-slate-500">{c.contactPerson} · {c.location}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">Selecting a customer auto-fills the letterhead block below — everything stays editable.</p>
              </div>

              {/* Letterhead block */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Letterhead</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className="form-label">Quotation date</label><input type="date" className="input w-full" value={letterhead.quotationDate} onChange={(e) => setLetterhead((p) => ({ ...p, quotationDate: e.target.value }))} /></div>
                  <div><label className="form-label">Enquiry date</label><input type="date" className="input w-full" value={letterhead.enquiryDate} onChange={(e) => setLetterhead((p) => ({ ...p, enquiryDate: e.target.value }))} /></div>
                  <div><label className="form-label">Enquiry ref</label><input className="input w-full" value={letterhead.enquiryRef} onChange={(e) => setLetterhead((p) => ({ ...p, enquiryRef: e.target.value }))} /></div>
                  <div className="col-span-2 sm:col-span-3"><label className="form-label">Subject</label><input className="input w-full" value={letterhead.subject} onChange={(e) => setLetterhead((p) => ({ ...p, subject: e.target.value }))} /></div>
                  <div><label className="form-label">To (name)</label><input className="input w-full" value={letterhead.toName} onChange={(e) => setLetterhead((p) => ({ ...p, toName: e.target.value }))} /></div>
                  <div><label className="form-label">Address line 1</label><input className="input w-full" value={letterhead.toAddr1} onChange={(e) => setLetterhead((p) => ({ ...p, toAddr1: e.target.value }))} /></div>
                  <div><label className="form-label">Address line 2</label><input className="input w-full" value={letterhead.toAddr2} onChange={(e) => setLetterhead((p) => ({ ...p, toAddr2: e.target.value }))} /></div>
                  <div><label className="form-label">State</label><input className="input w-full" value={letterhead.toState} onChange={(e) => setLetterhead((p) => ({ ...p, toState: e.target.value }))} /></div>
                  <div><label className="form-label">Kind Attn</label><input className="input w-full" value={letterhead.kindAttn} onChange={(e) => setLetterhead((p) => ({ ...p, kindAttn: e.target.value }))} /></div>
                  <div><label className="form-label">Designation</label><input className="input w-full" value={letterhead.toDesignation} onChange={(e) => setLetterhead((p) => ({ ...p, toDesignation: e.target.value }))} /></div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="form-label mb-0">Items *</label>
                  <button className="btn-secondary text-xs py-1.5" onClick={addBlankItem}><Plus className="w-3.5 h-3.5" /> Add item</button>
                </div>

                {items.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg py-6 text-center text-slate-400 text-sm">
                    Click "Add item" to start building the quotation
                  </div>
                )}

                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <div className="relative flex-1 min-w-[140px]">
                          <input className="input w-full text-xs font-mono" placeholder="Item code…" value={item.itemCode}
                            onChange={(e) => { updateItem(idx, 'itemCode', e.target.value); setCodeSearch(e.target.value); setItemIdx(idx); }}
                          />
                          {productSearch && itemIdx === idx && codeSearch.length > 1 && (
                            <div className="absolute z-20 top-full left-0 w-80 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {productSearch.map((p: any) => (
                                <button key={p.id} onClick={() => fillFromProduct(p, idx)} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs">
                                  <p className="font-mono font-semibold flex items-center gap-1.5">
                                    {p.categoryRef && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.categoryRef.color }} />}
                                    {p.itemCode}
                                  </p>
                                  <p className="text-slate-500">{p.productName} · ₹{p.standardPrice}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input className="input w-20 text-xs" placeholder="Category" value={item.category} onChange={(e) => updateItem(idx, 'category', e.target.value)} />
                        <input className="input w-16 text-xs text-center" placeholder="MOQ" type="number" min="0.01" step="0.01"
                          value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                        <input className="input w-24 text-xs text-right" placeholder="Rate ₹" type="number" min="0" step="0.01"
                          value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                        <input className="input w-16 text-xs text-right" placeholder="Disc %" type="number" min="0" max="100" step="0.5"
                          value={item.discount} onChange={(e) => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} />
                        <span className="flex flex-col items-end justify-center text-xs w-24 shrink-0">
                          <span className="text-slate-400">Net ₹{netOf(item).toFixed(2)}</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">₹{totalOf(item).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </span>
                        <button onClick={() => removeItem(idx)} className="btn-ghost p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <input className="input w-full text-xs mb-1" placeholder="Product name…" value={item.productName} onChange={(e) => updateItem(idx, 'productName', e.target.value)} />
                      <div className="flex gap-2">
                        <input className="input flex-1 text-xs" placeholder="Description…" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
                        <input className="input w-20 text-xs" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                        <input className="input w-28 text-xs" placeholder="HSN code" value={item.hsnCode} onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)} />
                        <input className="input w-28 text-xs" placeholder="Delivery" value={item.delivery} onChange={(e) => updateItem(idx, 'delivery', e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>

                {items.length > 0 && (
                  <div className="flex justify-end mt-3">
                    <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-lg px-4 py-2 text-right">
                      <p className="text-xs text-slate-500">Grand total</p>
                      <p className="text-lg font-bold text-primary">₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Commercial terms + signature (collapsible) */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <button onClick={() => setShowTerms((s) => !s)} className="flex items-center justify-between w-full text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Commercial terms & signature
                  {showTerms ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showTerms && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    <div><label className="form-label">Sales tax</label><input className="input w-full" value={letterhead.salesTax} onChange={(e) => setLetterhead((p) => ({ ...p, salesTax: e.target.value }))} /></div>
                    <div><label className="form-label">Payment terms</label><input className="input w-full" value={letterhead.paymentTerms} onChange={(e) => setLetterhead((p) => ({ ...p, paymentTerms: e.target.value }))} /></div>
                    <div><label className="form-label">Validity</label><input className="input w-full" value={letterhead.validity} onChange={(e) => setLetterhead((p) => ({ ...p, validity: e.target.value }))} /></div>
                    <div><label className="form-label">Delivery charges</label><input className="input w-full" value={letterhead.deliveryCharges} onChange={(e) => setLetterhead((p) => ({ ...p, deliveryCharges: e.target.value }))} /></div>
                    <div><label className="form-label">Sign — company</label><input className="input w-full" value={letterhead.signCompany} onChange={(e) => setLetterhead((p) => ({ ...p, signCompany: e.target.value }))} /></div>
                    <div><label className="form-label">Sign — name</label><input className="input w-full" value={letterhead.signName} onChange={(e) => setLetterhead((p) => ({ ...p, signName: e.target.value }))} /></div>
                    <div><label className="form-label">Sign — designation</label><input className="input w-full" value={letterhead.signDesignation} onChange={(e) => setLetterhead((p) => ({ ...p, signDesignation: e.target.value }))} /></div>
                    <div><label className="form-label">Valid until (system)</label><input type="date" className="input w-full" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Internal notes</label>
                <textarea className="input w-full resize-none" rows={2} placeholder="Internal notes (not printed on the PDF)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
              <button className="btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
              <button className="btn-primary" disabled={createMutation.isPending} onClick={handleSubmit}>
                {createMutation.isPending ? 'Creating…' : 'Create quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
