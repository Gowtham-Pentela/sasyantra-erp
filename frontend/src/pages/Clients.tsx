import { useEffect, useState } from 'react';
import { Plus, Building2 } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast } from '../components/ui';
import { useAuth } from '../store';

interface Client { id: number; name: string; gst?: string | null; pan?: string | null; address?: string | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; billingCycle?: string | null; paymentTerms?: string | null; _count?: { projects: number; quotations: number; workOrders: number }; }

export default function Clients() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [rows, setRows] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Client | null>(null);
  const toast = useToast();
  const blank = { name: '', gst: '', pan: '', address: '', contactName: '', contactPhone: '', contactEmail: '', billingCycle: '', paymentTerms: '' };
  const [form, setForm] = useState<any>(blank);

  const load = () => { setLoading(true); http.get<Client[]>(`/clients${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(setRows).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast('Name required', 'err');
    setBusy(true);
    try { if (edit) { await http.put(`/clients/${edit.id}`, form); toast('Client updated'); } else { await http.post('/clients', form); toast('Client created'); } setOpen(false); setEdit(null); setForm(blank); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const startEdit = (c: Client) => { setEdit(c); setForm({ ...blank, ...c, _count: undefined, id: undefined }); setOpen(true); };
  const remove = async (c: Client) => { if (!confirm(`Delete ${c.name}?`)) return; try { await http.del(`/clients/${c.id}`); toast('Deleted'); load(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Clients</h1><p className="text-sm text-slate-400">Client master — billing, GST, contacts</p></div>
        <div className="flex gap-2">
          <input className="input w-auto" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search name / GST…" />
          {canEdit && <button onClick={() => { setEdit(null); setForm(blank); setOpen(true); }} className="btn-primary"><Plus size={14} /> New client</button>}
        </div>
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No clients yet" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr>{['Name', 'GST', 'Contact', 'Billing', 'Projects', 'Quotations', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td font-medium"><Building2 size={13} className="inline mr-1.5 text-slate-400" />{c.name}</td>
                <td className="td font-mono text-xs text-slate-400">{c.gst ?? '—'}</td>
                <td className="td">{c.contactName ?? '—'}{c.contactPhone ? <span className="block text-xs text-slate-400">{c.contactPhone}</span> : null}</td>
                <td className="td text-slate-400">{c.billingCycle ?? '—'}</td>
                <td className="td"><Badge tone="brand">{c._count?.projects ?? 0}</Badge></td>
                <td className="td"><Badge>{c._count?.quotations ?? 0}</Badge></td>
                <td className="td text-right">{canEdit && <><button onClick={() => startEdit(c)} className="btn-ghost !py-1 !px-2 text-xs">Edit</button><button onClick={() => remove(c)} className="btn-ghost !py-1 !px-2 text-xs text-rose-600">Delete</button></>}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? 'Edit client' : 'New client'}>
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="GST"><input className="input" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></Field>
            <Field label="PAN"><input className="input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></Field>
          </div>
          <Field label="Address"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact name"><input className="input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field>
            <Field label="Contact phone"><input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
          </div>
          <Field label="Contact email"><input className="input" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing cycle"><input className="input" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} /></Field>
            <Field label="Payment terms"><input className="input" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save'}</button></div>
        </div>
      </Modal>
    </div>
  );
}