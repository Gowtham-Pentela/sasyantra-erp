import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Briefcase, ArrowRight, Trash2, Pencil } from 'lucide-react';
import { http, ApiError } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Project } from '../types';

const EMPTY = { name: '', clientName: '', clientGst: '', siteLocation: '', mapsUrl: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', billingCycle: 'Monthly', paymentTerms: 30, contractValue: 0, gstPercent: 18, status: 'ACTIVE', projectManager: '' };
// Reusable field set for create + edit. paymentTerms = credit period in days (Int).
export const ProjectFields = (form: any, set: (k: string, v: any) => void) => (<>
  <Field label="Project Name *"><input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
  <Field label="Client Name *"><input required className="input" value={form.clientName} onChange={(e) => set('clientName', e.target.value)} /></Field>
  <Field label="Client GST"><input className="input" value={form.clientGst ?? ''} onChange={(e) => set('clientGst', e.target.value)} placeholder="15-digit GSTIN" /></Field>
  <Field label="Site Location"><input className="input" value={form.siteLocation ?? ''} onChange={(e) => set('siteLocation', e.target.value)} /></Field>
  <Field label="Start Date"><input type="date" className="input" value={form.startDate ? String(form.startDate).slice(0, 10) : ''} onChange={(e) => set('startDate', e.target.value)} /></Field>
  <Field label="End Date"><input type="date" className="input" value={form.endDate ? String(form.endDate).slice(0, 10) : ''} onChange={(e) => set('endDate', e.target.value)} /></Field>
  <Field label="Contract Value (₹)"><input type="number" className="input" value={form.contractValue} onChange={(e) => set('contractValue', e.target.value)} /></Field>
  <Field label="GST %"><input type="number" className="input" value={form.gstPercent} onChange={(e) => set('gstPercent', e.target.value)} /></Field>
  <Field label="Billing Cycle"><select className="input" value={form.billingCycle ?? 'Monthly'} onChange={(e) => set('billingCycle', e.target.value)}><option>Monthly</option><option>Fortnightly</option><option>Weekly</option><option>One-time</option><option>Milestone</option></select></Field>
  <Field label="Payment Terms (days)"><input type="number" min={0} className="input" value={form.paymentTerms ?? ''} onChange={(e) => set('paymentTerms', e.target.value === '' ? null : Number(e.target.value))} placeholder="credit period in days" /></Field>
  <Field label="Project Manager"><input className="input" value={form.projectManager ?? ''} onChange={(e) => set('projectManager', e.target.value)} /></Field>
  <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}><option value="ACTIVE">ACTIVE (Ongoing)</option><option value="ON_HOLD">ON_HOLD (Shelved)</option><option value="COMPLETED">COMPLETED</option><option value="CANCELLED">CANCELLED</option></select></Field>
</>);

// ON_HOLD is the "Shelved" bucket — reused, no enum change. ponytail: no migration.
const FILTERS: { key: Project['status'] | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ACTIVE', label: 'Ongoing' },
  { key: 'ON_HOLD', label: 'Shelved' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const tone = (s: Project['status']): 'green' | 'amber' | 'rose' | 'slate' =>
  s === 'ACTIVE' ? 'green' : s === 'ON_HOLD' ? 'amber' : s === 'CANCELLED' ? 'rose' : 'slate';
const label = (s: Project['status']) => (s === 'ON_HOLD' ? 'SHELVED' : s);

export default function Projects() {
  const nav = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [rows, setRows] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Project['status'] | 'ALL'>('ALL');
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [delTarget, setDelTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const toast = useToast();

  const load = async () => { setLoading(true); setRows(await http.get('/projects')); setLoading(false); };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const startCreate = () => { setForm(EMPTY); setEditId(null); setOpen(true); };
  const startEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setForm({ ...p, startDate: String(p.startDate).slice(0, 10), endDate: p.endDate ? String(p.endDate).slice(0, 10) : '' });
    setEditId(p.id); setOpen(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, contractValue: Number(form.contractValue), gstPercent: Number(form.gstPercent), paymentTerms: form.paymentTerms === '' || form.paymentTerms == null ? null : Number(form.paymentTerms), startDate: new Date(form.startDate), endDate: form.endDate ? new Date(form.endDate) : null };
    try {
      if (editId) { await http.put(`/projects/${editId}`, body); toast('Project updated'); }
      else { await http.post('/projects', body); toast('Project created'); }
      setOpen(false); setEditId(null); load();
    } catch (err: any) { toast(err.message, 'err'); }
  };

  const confirmDelete = async () => {
    if (!delTarget) return;
    try { await http.del(`/projects/${delTarget.id}`); toast('Project deleted'); setDelTarget(null); load(); }
    catch (err: any) { toast(err instanceof ApiError ? err.message : 'Delete failed', 'err'); setDelTarget(null); }
  };

  const filtered = filter === 'ALL' ? rows : rows.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-semibold tracking-tight">Projects</h1><p className="text-sm text-slate-400">{filtered.length} of {rows.length} projects</p></div>
        {canEdit && <button onClick={startCreate} className="btn-primary"><Plus size={16} /> New Project</button>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.key ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{f.label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : !filtered.length ? <Empty msg="No projects in this view" /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} onClick={() => nav(`/projects/${p.id}`)} className="card p-5 cursor-pointer hover:shadow-float transition group relative">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-300 grid place-items-center"><Briefcase size={20} /></div>
                <div className="flex items-center gap-2">
                  <Badge tone={tone(p.status)}>{label(p.status)}</Badge>
                  {canEdit && (
                    <>
                      <button onClick={(e) => startEdit(p, e)} title="Edit project details" className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition"><Pencil size={15} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setDelTarget(p); }} disabled={p.status !== 'CANCELLED'} title={p.status === 'CANCELLED' ? 'Delete project' : 'Cancel this project first (in its workspace → Status)'} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
              <h3 className="font-semibold mt-3 group-hover:text-brand-600">{p.name}</h3>
              <div className="text-xs text-slate-400">{p.code} · {p.clientName}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-xs text-slate-400">Contract</div><div className="font-semibold">{inr(p.contractValue)}</div></div>
                <div><div className="text-xs text-slate-400">GST</div><div className="font-semibold">{p.gstPercent}%</div></div>
              </div>
              <div className="mt-3 text-xs text-brand-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">Open workspace <ArrowRight size={12} /></div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); setEditId(null); }} title={editId ? 'Edit Project' : 'New Project'} wide>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          {ProjectFields(form, set)}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setOpen(false); setEditId(null); }} className="btn-ghost">Cancel</button><button className="btn-primary">{editId ? 'Save changes' : 'Create project'}</button></div>
        </form>
      </Modal>

      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="Delete project?">
        <p className="text-sm text-slate-500">Permanently delete <b>{delTarget?.name}</b> ({delTarget?.code})? This cannot be undone.</p>
        <p className="text-xs text-slate-400 mt-2">Associated expenses, invoices, payroll, quotations, allocations and work orders are kept as orphaned history (their project link is cleared). Only the project itself is removed.</p>
        <div className="flex justify-end gap-2 pt-4"><button onClick={() => setDelTarget(null)} className="btn-ghost">Cancel</button><button onClick={confirmDelete} className="btn-primary bg-rose-600 hover:bg-rose-700">Delete</button></div>
      </Modal>
    </div>
  );
}