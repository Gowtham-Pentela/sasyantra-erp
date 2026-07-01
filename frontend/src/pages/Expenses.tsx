import { useEffect, useState } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Project } from '../types';

interface Expense { id: number; date: string; category: string; vendor?: string | null; amount: number; gst: number; paidAmount: number; status: string; dueDate?: string | null; paidDate?: string | null; remarks?: string | null; project?: { name: string } | null; }
const tone = (s: string): 'green' | 'amber' | 'rose' => s === 'PAID' ? 'green' : s === 'PARTIAL' ? 'amber' : 'rose';

export default function Expenses() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'ACCOUNTS';
  const [rows, setRows] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const toast = useToast();
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), category: '', vendor: '', amount: '', gst: '0', projectId: '', dueDate: '', remarks: '' });

  const load = () => { setLoading(true); http.get<Expense[]>('/expenses').then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { http.get<Project[]>('/projects').then(setProjects as any); load(); }, []);

  const create_ = async () => {
    if (!form.category || !form.amount) return toast('Enter category and amount', 'err');
    setBusy(true);
    try { await http.post('/expenses', { date: form.date, category: form.category, vendor: form.vendor || undefined, amount: Number(form.amount), gst: Number(form.gst), projectId: form.projectId ? Number(form.projectId) : undefined, dueDate: form.dueDate || undefined, remarks: form.remarks || undefined }); toast('Expense added'); setCreate(false); setForm({ ...form, category: '', vendor: '', amount: '', dueDate: '', remarks: '' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const pay = async (e: Expense) => {
    setBusy(true);
    try { await http.post(`/expenses/${e.id}/pay`); toast('Marked paid'); load(); }
    catch (er: any) { toast(er.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Expenses</h1><p className="text-sm text-slate-400">Categorized spend · paying reduces the company budget</p></div>
        {canEdit && <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={14} /> New expense</button>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No expenses yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[960px]">
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
                    <td className="td">{canEdit && r.status !== 'PAID' && <button onClick={() => pay(r)} disabled={busy} className="btn-ghost !py-1 !px-2 text-xs"><CheckCircle2 size={12} className="inline mr-1" />Mark paid</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New expense">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Due date (optional)"><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Staff Wages / Rent / Travel / Material" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor"><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
            <Field label="Project (optional)"><select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)"><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="GST (₹)"><input type="number" className="input" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></Field>
          </div>
          <Field label="Remarks"><input className="input" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setCreate(false)} className="btn-ghost">Cancel</button><button onClick={create_} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Add expense'}</button></div>
        </div>
      </Modal>
    </div>
  );
}