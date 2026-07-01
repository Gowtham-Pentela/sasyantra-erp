import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';

interface WO { id: number; number: string; title: string; projectId: number; clientId?: number | null; quotationId?: number | null; scope?: string | null; startDate: string; endDate?: string | null; value: number; status: string; project: { name: string }; client?: { name: string } | null; quotation?: { number: string } | null; }
const tone = (s: string): 'green' | 'amber' | 'rose' | 'brand' | 'slate' => s === 'CLOSED' ? 'green' : s === 'IN_PROGRESS' ? 'amber' as any : s === 'CANCELLED' ? 'rose' : 'brand' as any;

export default function WorkOrders() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [rows, setRows] = useState<WO[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const blank = { title: '', projectId: '', clientId: '', scope: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', value: '' };
  const [form, setForm] = useState<any>(blank);

  const load = () => { setLoading(true); http.get<WO[]>('/work-orders').then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { http.get<any[]>('/projects').then(setProjects); http.get<any[]>('/clients').then(setClients); load(); }, []);

  const create = async () => {
    if (!form.title || !form.projectId) return toast('Title and project required', 'err');
    setBusy(true);
    try { await http.post('/work-orders', { ...form, projectId: Number(form.projectId), clientId: form.clientId ? Number(form.clientId) : undefined, value: Number(form.value) || 0 }); toast('Work order created'); setOpen(false); setForm(blank); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const setStatus = async (w: WO, status: string) => { try { await http.post(`/work-orders/${w.id}/status`, { status }); toast(`Marked ${status}`); load(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Work Orders</h1><p className="text-sm text-slate-400">Service orders against projects</p></div>
        {canEdit && <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={14} /> New work order</button>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No work orders yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead><tr>{['Number', 'Title', 'Project', 'Client', 'Period', 'Value', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td font-mono text-xs">{r.number}</td>
                  <td className="td font-medium">{r.title}</td>
                  <td className="td">{r.project?.name ?? '—'}</td>
                  <td className="td text-slate-400">{r.client?.name ?? '—'}</td>
                  <td className="td text-slate-400 text-xs">{new Date(r.startDate).toLocaleDateString('en-IN')} → {r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="td font-semibold">{inr(r.value)}</td>
                  <td className="td"><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                  <td className="td text-right whitespace-nowrap">
                    {canEdit && r.status !== 'IN_PROGRESS' && <button onClick={() => setStatus(r, 'IN_PROGRESS')} className="btn-ghost !py-1 !px-2 text-xs">Start</button>}
                    {canEdit && r.status !== 'CLOSED' && <button onClick={() => setStatus(r, 'CLOSED')} className="btn-ghost !py-1 !px-2 text-xs text-emerald-600">Close</button>}
                    {canEdit && r.status !== 'CANCELLED' && <button onClick={() => setStatus(r, 'CANCELLED')} className="btn-ghost !py-1 !px-2 text-xs text-rose-600">Cancel</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New work order">
        <div className="space-y-3">
          <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project"><select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Client (optional)"><select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          </div>
          <Field label="Scope"><textarea className="input min-h-[80px]" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start date"><input type="date" className="input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="End date"><input type="date" className="input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
            <Field label="Value (₹)"><input type="number" className="input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button onClick={create} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Create'}</button></div>
        </div>
      </Modal>
    </div>
  );
}