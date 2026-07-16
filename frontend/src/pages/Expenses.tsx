import { useEffect, useState, useRef } from 'react';
import { Plus, CheckCircle2, Pencil, Upload, Undo2 } from 'lucide-react';
import { http, ApiError } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Project } from '../types';

interface Expense { id: number; date: string; category: string; vendor?: string | null; amount: number; gst: number; paidAmount: number; status: string; dueDate?: string | null; paidDate?: string | null; remarks?: string | null; projectId?: number | null; project?: { name: string } | null; }
const tone = (s: string): 'green' | 'amber' | 'rose' => s === 'PAID' ? 'green' : s === 'PARTIAL' ? 'amber' : 'rose';
const BLANK = { date: new Date().toISOString().slice(0, 10), category: '', vendor: '', amount: '', gst: '0', projectId: '', dueDate: '', remarks: '' };

export default function Expenses() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'ACCOUNTS';
  const [rows, setRows] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [imp, setImp] = useState(false);
  const [form, setForm] = useState<any>(BLANK);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = () => { setLoading(true); http.get<Expense[]>('/expenses').then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { http.get<Project[]>('/projects').then(setProjects as any); load(); }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const startCreate = () => { setForm(BLANK); setEditId(null); setOpen(true); };
  const startEdit = (e: Expense) => {
    setForm({ date: String(e.date).slice(0, 10), category: e.category, vendor: e.vendor ?? '', amount: String(e.amount), gst: String(e.gst), projectId: e.projectId ? String(e.projectId) : '', dueDate: e.dueDate ? String(e.dueDate).slice(0, 10) : '', remarks: e.remarks ?? '' });
    setEditId(e.id); setOpen(true);
  };
  const save = async () => {
    if (!form.category || !form.amount) return toast('Enter category and amount', 'err');
    setBusy(true);
    const body = { date: form.date, category: form.category, vendor: form.vendor || undefined, amount: Number(form.amount), gst: Number(form.gst), projectId: form.projectId ? Number(form.projectId) : undefined, dueDate: form.dueDate || undefined, remarks: form.remarks || undefined };
    try {
      if (editId) { await http.put(`/expenses/${editId}`, body); toast('Expense updated'); }
      else { await http.post('/expenses', body); toast('Expense added'); }
      setOpen(false); setEditId(null); setForm(BLANK); load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const pay = async (e: Expense) => { setBusy(true); try { await http.post(`/expenses/${e.id}/pay`); toast('Marked paid'); load(); } catch (er: any) { toast(er.message, 'err'); } finally { setBusy(false); } };
  const unpay = async (e: Expense) => { setBusy(true); try { await http.post(`/expenses/${e.id}/unpay`); toast('Marked unpaid'); load(); } catch (er: any) { toast(er.message, 'err'); } finally { setBusy(false); } };

  const onFile = async (f: File) => {
    setImp(false); setBusy(true);
    try {
      const r: any = await http.upload('/expenses/import', f);
      toast(`Imported ${r.created}, skipped ${r.skipped}`, r.skipped ? 'err' : 'ok');
      if (r.errors?.length) console.log('import errors:', r.errors);
      load();
    } catch (er: any) { toast(er instanceof ApiError ? er.message : 'Import failed', 'err'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Expenses</h1><p className="text-sm text-slate-400">Categorized spend · paying reduces the company budget</p></div>
        {canEdit && <div className="flex gap-2">
          <button onClick={() => setImp(true)} className="btn-ghost"><Upload size={14} /> Import Excel</button>
          <button onClick={startCreate} className="btn-primary"><Plus size={14} /> New expense</button>
        </div>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No expenses yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[1040px]">
              <thead><tr>{['Date', 'Category', 'Vendor', 'Project', 'Amount', 'GST', 'Paid', 'Due', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td text-slate-400">{new Date(r.date).toLocaleDateString('en-IN')}</td>
                    <td className="td font-medium">{r.category}</td>
                    <td className="td">{r.vendor ?? '—'}</td>
                    <td className="td text-slate-400">{r.project?.name ?? '—'}</td>
                    <td className="td font-semibold">{inr(r.amount)}</td>
                    <td className="td text-slate-400">{inr(r.gst)}</td>
                    <td className="td text-emerald-600">{inr(r.paidAmount)}</td>
                    <td className="td text-slate-400">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="td"><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                    <td className="td">
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          {r.status === 'PAID'
                            ? <button onClick={() => unpay(r)} disabled={busy} title="Mark unpaid" className="btn-ghost !py-1 !px-2 text-xs"><Undo2 size={12} className="inline mr-1" />Unpay</button>
                            : <button onClick={() => pay(r)} disabled={busy} className="btn-ghost !py-1 !px-2 text-xs"><CheckCircle2 size={12} className="inline mr-1" />Mark paid</button>}
                          <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"><Pencil size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setEditId(null); }} title={editId ? 'Edit expense' : 'New expense'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Due date (optional)"><input type="date" className="input" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></Field>
          </div>
          <Field label="Category"><input className="input" value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Staff Wages / Rent / Travel / Material" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor"><input className="input" value={form.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
            <Field label="Project (optional)"><select className="input" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input type="number" className="input" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
            <Field label="GST (₹)"><input type="number" className="input" value={form.gst} onChange={(e) => set('gst', e.target.value)} /></Field>
          </div>
          <Field label="Remarks"><input className="input" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => { setOpen(false); setEditId(null); }} className="btn-ghost">Cancel</button><button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : editId ? 'Save changes' : 'Add expense'}</button></div>
        </div>
      </Modal>

      <Modal open={imp} onClose={() => setImp(false)} title="Import expenses from Excel">
        <div className="space-y-3 text-sm">
          <p className="text-slate-500">Upload an <b>.xlsx / .xls / .csv</b> file. Columns (case-insensitive):</p>
          <pre className="text-xs bg-slate-50 dark:bg-slate-800 rounded-lg p-3 overflow-x-auto">date, category, vendor, amount, gst, project, dueDate, remarks</pre>
          <ul className="text-xs text-slate-500 list-disc pl-5 space-y-1">
            <li><b>category</b> + <b>amount</b> required; others optional.</li>
            <li><b>date</b> accepts Excel dates, <code>YYYY-MM-DD</code>, or <code>DD-MM-YYYY</code>.</li>
            <li><b>project</b> is the project name (resolved automatically); or use <b>projectId</b>.</li>
            <li>Imported rows are created as <b>UNPAID</b>. Existing rows are not touched.</li>
          </ul>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="input" />
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setImp(false)} className="btn-ghost">Cancel</button></div>
        </div>
      </Modal>
    </div>
  );
}