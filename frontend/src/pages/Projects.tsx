import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, ArrowRight } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Project } from '../types';

const EMPTY = { name: '', clientName: '', clientGst: '', siteLocation: '', mapsUrl: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', billingCycle: 'Monthly', paymentTerms: '30 days from invoice', contractValue: 0, gstPercent: 18, status: 'ACTIVE', projectManager: '' };

export default function Projects() {
  const nav = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const toast = useToast();

  const load = async () => { setLoading(true); setRows(await http.get('/projects')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, contractValue: Number(form.contractValue), gstPercent: Number(form.gstPercent), startDate: new Date(form.startDate), endDate: form.endDate ? new Date(form.endDate) : null };
    try { await http.post('/projects', body); toast('Project created'); setOpen(false); load(); } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Projects</h1><p className="text-sm text-slate-400">{rows.length} projects</p></div>
        {canEdit && <button onClick={() => { setForm(EMPTY); setOpen(true); }} className="btn-primary"><Plus size={16} /> New Project</button>}
      </div>

      {loading ? <Spinner /> : !rows.length ? <Empty msg="No projects yet" /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((p) => (
            <button key={p.id} onClick={() => nav(`/projects/${p.id}`)} className="card p-5 text-left hover:shadow-float transition group">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 grid place-items-center"><Briefcase size={20} /></div>
                <Badge tone={p.status === 'ACTIVE' ? 'green' : 'slate'}>{p.status}</Badge>
              </div>
              <h3 className="font-semibold mt-3 group-hover:text-brand-600">{p.name}</h3>
              <div className="text-xs text-slate-400">{p.code} · {p.clientName}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-xs text-slate-400">Contract</div><div className="font-semibold">{inr(p.contractValue)}</div></div>
                <div><div className="text-xs text-slate-400">GST</div><div className="font-semibold">{p.gstPercent}%</div></div>
              </div>
              <div className="mt-3 text-xs text-brand-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">Open workspace <ArrowRight size={12} /></div>
            </button>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New Project" wide>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <Field label="Project Name *"><input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Client Name *"><input required className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></Field>
          <Field label="Client GST"><input className="input" value={form.clientGst} onChange={(e) => set('clientGst', e.target.value)} /></Field>
          <Field label="Site Location"><input className="input" value={form.siteLocation} onChange={(e) => set('siteLocation', e.target.value)} /></Field>
          <Field label="Start Date"><input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
          <Field label="End Date"><input type="date" className="input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
          <Field label="Contract Value (₹)"><input type="number" className="input" value={form.contractValue} onChange={(e) => set('contractValue', e.target.value)} /></Field>
          <Field label="GST %"><input type="number" className="input" value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} /></Field>
          <Field label="Project Manager"><input className="input" value={form.projectManager} onChange={(e) => set('projectManager', e.target.value)} /></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}><option>ACTIVE</option><option>ON_HOLD</option><option>COMPLETED</option><option>CANCELLED</option></select></Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button className="btn-primary">Create project</button></div>
        </form>
      </Modal>
    </div>
  );
}