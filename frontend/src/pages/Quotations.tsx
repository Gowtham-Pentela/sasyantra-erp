import { useEffect, useState } from 'react';
import { Plus, Trash2, CheckCircle2, FileText } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';

interface Quote { id: number; number: string; clientId: number; projectId?: number | null; issueDate: string; validTill?: string | null; lineItems: { desc: string; qty: number; rate: number; amount: number }[]; subtotal: number; gstPercent: number; gstAmount: number; total: number; status: string; notes?: string | null; convertedInvoiceId?: number | null; client: { name: string }; project?: { name: string } | null; }
const tone = (s: string): 'green' | 'amber' | 'rose' | 'slate' => s === 'ACCEPTED' ? 'green' : s === 'SENT' ? 'brand' as any : s === 'REJECTED' || s === 'EXPIRED' ? 'rose' : 'slate';

export default function Quotations() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS' || role === 'ACCOUNTS';
  const [rows, setRows] = useState<Quote[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const emptyLine = { desc: '', qty: 1, rate: 0 };
  const [form, setForm] = useState<any>({ clientId: '', projectId: '', validTill: '', gstPercent: 18, notes: '', lineItems: [{ ...emptyLine }] });

  const load = () => { setLoading(true); http.get<Quote[]>('/quotations').then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { http.get<any[]>('/clients').then(setClients); http.get<any[]>('/projects').then(setProjects as any); load(); }, []);

  const compute = (lines: any[], gst: number) => {
    const lineItems = lines.map((l) => ({ ...l, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, amount: (Number(l.qty) || 0) * (Number(l.rate) || 0) }));
    const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
    return { lineItems, subtotal, gstAmount: +(subtotal * gst / 100).toFixed(2), total: +(subtotal + subtotal * gst / 100).toFixed(2) };
  };

  const create = async () => {
    if (!form.clientId) return toast('Pick a client', 'err');
    const c = compute(form.lineItems.filter((l: any) => l.desc), Number(form.gstPercent));
    if (!c.subtotal) return toast('Add at least one line with a description', 'err');
    setBusy(true);
    try { await http.post('/quotations', { clientId: Number(form.clientId), projectId: form.projectId ? Number(form.projectId) : undefined, validTill: form.validTill || undefined, gstPercent: Number(form.gstPercent), notes: form.notes, lineItems: c.lineItems }); toast('Quotation created'); setOpen(false); setForm({ clientId: '', projectId: '', validTill: '', gstPercent: 18, notes: '', lineItems: [{ ...emptyLine }] }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const accept = async (q: Quote) => { if (!confirm(`Accept ${q.number}? This creates invoice INV-#### from its lines.`)) return; try { await http.post(`/quotations/${q.id}/accept`); toast('Accepted → invoice created'); load(); } catch (e: any) { toast(e.message, 'err'); } };
  const setStatus = async (q: Quote, status: string) => { try { await http.put(`/quotations/${q.id}`, { status }); toast(`Marked ${status}`); load(); } catch (e: any) { toast(e.message, 'err'); } };

  const preview = compute(form.lineItems, Number(form.gstPercent));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Quotations</h1><p className="text-sm text-slate-400">Quote to client → accept → auto-creates an invoice</p></div>
        {canEdit && <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={14} /> New quotation</button>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No quotations yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead><tr>{['Number', 'Client', 'Project', 'Issued', 'Valid till', 'Subtotal', 'GST', 'Total', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td font-mono text-xs">{r.number}</td>
                  <td className="td font-medium">{r.client?.name}</td>
                  <td className="td text-slate-400">{r.project?.name ?? '—'}</td>
                  <td className="td text-slate-400">{new Date(r.issueDate).toLocaleDateString('en-IN')}</td>
                  <td className="td text-slate-400">{r.validTill ? new Date(r.validTill).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="td">{inr(r.subtotal)}</td>
                  <td className="td text-slate-400">{r.gstPercent}% · {inr(r.gstAmount)}</td>
                  <td className="td font-semibold">{inr(r.total)}</td>
                  <td className="td"><Badge tone={tone(r.status)}>{r.status}</Badge>{r.convertedInvoiceId && <div className="text-[10px] text-emerald-600 mt-0.5">→ invoice</div>}</td>
                  <td className="td text-right whitespace-nowrap">
                    {canEdit && r.status === 'DRAFT' && <button onClick={() => setStatus(r, 'SENT')} className="btn-ghost !py-1 !px-2 text-xs">Send</button>}
                    {canEdit && (r.status === 'DRAFT' || r.status === 'SENT') && <button onClick={() => accept(r)} className="btn-ghost !py-1 !px-2 text-xs text-emerald-600"><CheckCircle2 size={12} className="inline mr-1" />Accept</button>}
                    {canEdit && (r.status === 'DRAFT' || r.status === 'SENT') && <button onClick={() => setStatus(r, 'REJECTED')} className="btn-ghost !py-1 !px-2 text-xs text-rose-600">Reject</button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New quotation" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Client"><select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Project (optional)"><select className="input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            <Field label="Valid till"><input type="date" className="input" value={form.validTill} onChange={(e) => setForm({ ...form, validTill: e.target.value })} /></Field>
          </div>
          <div>
            <label className="label">Line items</label>
            <div className="space-y-2">
              {form.lineItems.map((l: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6" placeholder="Description" value={l.desc} onChange={(e) => { const li = [...form.lineItems]; li[i] = { ...l, desc: e.target.value }; setForm({ ...form, lineItems: li }); }} />
                  <input type="number" className="input col-span-2" placeholder="Qty" value={l.qty} onChange={(e) => { const li = [...form.lineItems]; li[i] = { ...l, qty: e.target.value }; setForm({ ...form, lineItems: li }); }} />
                  <input type="number" className="input col-span-3" placeholder="Rate" value={l.rate} onChange={(e) => { const li = [...form.lineItems]; li[i] = { ...l, rate: e.target.value }; setForm({ ...form, lineItems: li }); }} />
                  <button onClick={() => setForm({ ...form, lineItems: form.lineItems.filter((_: any, j: number) => j !== i) })} className="btn-ghost !px-2 col-span-1"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setForm({ ...form, lineItems: [...form.lineItems, { ...emptyLine }] })} className="btn-ghost text-xs"><Plus size={12} className="inline mr-1" />Add line</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="GST %"><input type="number" className="input" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} /></Field>
            <Field label="Subtotal"><div className="input bg-slate-50 dark:bg-slate-800/50">{inr(preview.subtotal)}</div></Field>
            <Field label="Total"><div className="input bg-slate-50 dark:bg-slate-800/50 font-semibold">{inr(preview.total)}</div></Field>
          </div>
          <Field label="Notes"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button onClick={create} disabled={busy} className="btn-primary"><FileText size={14} className="inline mr-1" />{busy ? 'Saving…' : 'Create draft'}</button></div>
        </div>
      </Modal>
    </div>
  );
}