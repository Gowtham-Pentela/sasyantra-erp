import { useEffect, useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Project } from '../types';

interface Invoice { id: number; number: string; projectId: number | null; issueDate: string; dueDate?: string | null; subtotal: number; gstPercent: number; gstAmount: number; total: number; totalPaid: number; balance: number; status: string; project?: { name: string } | null; }

const tone = (s: string): 'green' | 'amber' | 'rose' | 'slate' => s === 'PAID' ? 'green' : s === 'PARTIAL' ? 'amber' : s === 'OVERDUE' ? 'rose' : 'slate';

export default function Invoices() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'ACCOUNTS';
  const [rows, setRows] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [pay, setPay] = useState<Invoice | null>(null);
  const toast = useToast();
  const [form, setForm] = useState({ projectId: '', subtotal: '', gstPercent: '18', issueDate: new Date().toISOString().slice(0, 10), dueDate: '', notes: '' });
  const [payForm, setPayForm] = useState({ amount: '', receivedDate: new Date().toISOString().slice(0, 10), utr: '', mode: 'BANK', remarks: '' });

  const load = () => { setLoading(true); http.get<Invoice[]>('/invoices').then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { http.get<Project[]>('/projects').then(setProjects as any); load(); }, []);
  useEffect(() => { if (projects.length && !form.projectId) setForm((f) => ({ ...f, projectId: String(projects[0].id) })); }, [projects]);

  const create_ = async () => {
    if (!form.subtotal) return toast('Enter subtotal', 'err');
    setBusy(true);
    try { await http.post('/invoices', { projectId: Number(form.projectId), subtotal: Number(form.subtotal), gstPercent: Number(form.gstPercent), issueDate: form.issueDate, dueDate: form.dueDate || undefined, notes: form.notes }); toast('Invoice created'); setCreate(false); setForm({ ...form, subtotal: '', dueDate: '', notes: '' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const recordPay = async () => {
    if (!pay || !payForm.amount) return toast('Enter amount', 'err');
    setBusy(true);
    try { await http.post(`/invoices/${pay.id}/payments`, { amount: Number(payForm.amount), receivedDate: payForm.receivedDate, utr: payForm.utr, mode: payForm.mode, remarks: payForm.remarks }); toast('Payment recorded'); setPay(null); setPayForm({ ...payForm, amount: '', utr: '', remarks: '' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Invoices</h1><p className="text-sm text-slate-400">GST invoices linked to projects · auto-numbered INV-####</p></div>
        {canEdit && <button onClick={() => setCreate(true)} className="btn-primary"><Plus size={14} /> New invoice</button>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No invoices yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr>{['Number', 'Project', 'Issued', 'Due', 'Subtotal', 'GST', 'Total', 'Paid', 'Balance', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td font-mono text-xs">{r.number}</td>
                    <td className="td font-medium">{r.project?.name ?? '—'}</td>
                    <td className="td text-slate-400">{new Date(r.issueDate).toLocaleDateString('en-IN')}</td>
                    <td className="td text-slate-400">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="td">{inr(r.subtotal)}</td>
                    <td className="td text-slate-400">{r.gstPercent}% · {inr(r.gstAmount)}</td>
                    <td className="td font-semibold">{inr(r.total)}</td>
                    <td className="td text-emerald-600">{inr(r.totalPaid)}</td>
                    <td className="td text-rose-600">{inr(r.balance)}</td>
                    <td className="td"><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                    <td className="td">{canEdit && r.balance > 0 && <button onClick={() => setPay(r)} className="btn-ghost !py-1 !px-2 text-xs">Record payment</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="New invoice">
        <div className="space-y-3">
          <Field label="Project"><select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subtotal (₹)"><input type="number" className="input" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></Field>
            <Field label="GST %"><input type="number" className="input" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue date"><input type="date" className="input" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></Field>
            <Field label="Due date"><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setCreate(false)} className="btn-ghost">Cancel</button><button onClick={create_} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Create'}</button></div>
        </div>
      </Modal>

      <Modal open={!!pay} onClose={() => setPay(null)} title={`Record payment · ${pay?.number ?? ''}`}>
        <div className="space-y-3">
          <div className="text-sm text-slate-400">Balance: <span className="font-semibold text-rose-600">{inr(pay?.balance ?? 0)}</span></div>
          <Field label="Amount (₹)"><input type="number" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
          <Field label="Received date"><input type="date" className="input" value={payForm.receivedDate} onChange={(e) => setPayForm({ ...payForm, receivedDate: e.target.value })} /></Field>
          <Field label="UTR / Ref"><input className="input" value={payForm.utr} onChange={(e) => setPayForm({ ...payForm, utr: e.target.value })} /></Field>
          <Field label="Mode"><select className="input" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}><option>BANK</option><option>CASH</option><option>UPI</option><option>CHEQUE</option></select></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setPay(null)} className="btn-ghost">Cancel</button><button onClick={recordPay} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Record'}</button></div>
        </div>
      </Modal>
    </div>
  );
}