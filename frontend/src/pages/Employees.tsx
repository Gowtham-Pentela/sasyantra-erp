import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, Pencil, Archive, History, RotateCcw, Search, Filter } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Employee, AuditLog } from '../types';

const STATUSES = ['ACTIVE', 'LEFT', 'TEMPORARY', 'SUSPENDED', 'BLACKLISTED'] as const;
const EMPTY = { name: '', fatherName: '', mobile: '', designation: '', skillCategory: '', salaryType: 'DAILY', dailyWage: 0, monthlySalary: 0, pf: false, esi: false, status: 'ACTIVE', joiningDate: new Date().toISOString().slice(0, 10), uan: '', bankAccount: '', ifsc: '', upi: '', address: '' };

export default function Employees() {
  const [params, setParams] = useSearchParams();
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<any>(EMPTY);
  const [history, setHistory] = useState<{ emp: Employee; logs: AuditLog[] } | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (status) p.set('status', status);
    p.set('archived', String(archived));
    const res: any = await http.get(`/employees?${p}`);
    setRows(res.data); setTotal(res.total); setLoading(false);
  }, [q, status, archived]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (params.get('q')) setQ(params.get('q')!); }, [params]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setForm({ ...EMPTY, ...e, joiningDate: e.joiningDate?.slice(0, 10), dob: e.dob?.slice(0, 10) }); setOpen(true); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, dailyWage: Number(form.dailyWage), monthlySalary: Number(form.monthlySalary), joiningDate: form.joiningDate ? new Date(form.joiningDate) : undefined, dob: form.dob ? new Date(form.dob) : undefined };
    try {
      if (editing) { await http.put(`/employees/${editing.id}`, body); toast('Employee updated'); }
      else { await http.post('/employees', body); toast('Employee created'); }
      setOpen(false); load();
    } catch (err: any) { toast(err.message || 'Save failed', 'err'); }
  };

  const archive = async (e: Employee) => {
    if (!confirm(`Archive ${e.name}? They can be restored later.`)) return;
    await http.post(`/employees/${e.id}/archive`); toast('Archived'); load();
  };
  const restore = async (e: Employee) => { await http.post(`/employees/${e.id}/restore`); toast('Restored'); load(); };

  const showHistory = async (e: Employee) => {
    const logs: any = await http.get(`/employees/${e.id}/history`);
    setHistory({ emp: e, logs });
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Employees</h1><p className="text-sm text-slate-400">{total} total · {archived ? 'archived' : 'active'} records</p></div>
        {canEdit && <button onClick={openAdd} className="btn-primary"><UserPlus size={16} /> Add Employee</button>}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]"><Search size={16} className="absolute left-3 top-2.5 text-slate-400" /><input className="input pl-9" placeholder="Search name, code, mobile…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} /></div>
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          <button onClick={() => setArchived((a) => !a)} className={`btn ${archived ? 'btn-primary' : 'btn-ghost'}`}><Filter size={14} /> {archived ? 'Showing archived' : 'Show archived'}</button>
        </div>

        {loading ? <Spinner /> : !rows.length ? <Empty msg="No employees match" /> : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[820px]">
              <thead><tr className="th">{['Code', 'Name', 'Designation', 'Skill', 'Wage/day', 'Salary/mo', 'PF/ESI', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td font-mono text-xs">{e.empCode}</td>
                    <td className="td"><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 grid place-items-center text-xs font-semibold">{e.name[0]}</div>{e.name}</div></td>
                    <td className="td">{e.designation || '—'}</td>
                    <td className="td">{e.skillCategory || '—'}</td>
                    <td className="td">{inr(e.dailyWage)}</td>
                    <td className="td">{inr(e.monthlySalary)}</td>
                    <td className="td"><div className="flex gap-1">{e.pf && <Badge tone="brand">PF</Badge>}{e.esi && <Badge tone="amber">ESI</Badge>}{!e.pf && !e.esi && <span className="text-slate-300 text-xs">—</span>}</div></td>
                    <td className="td"><Badge tone={e.status === 'ACTIVE' ? 'green' : e.status === 'LEFT' ? 'slate' : 'amber'}>{e.status}</Badge></td>
                    <td className="td">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => showHistory(e)} title="History" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><History size={15} /></button>
                        {canEdit && <button onClick={() => openEdit(e)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil size={15} /></button>}
                        {canEdit && (archived ? <button onClick={() => restore(e)} title="Restore" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><RotateCcw size={15} /></button> : <button onClick={() => archive(e)} title="Archive" className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 text-rose-600"><Archive size={15} /></button>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Edit ${editing.empCode}` : 'Add Employee'} wide>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
          <Field label="Name *"><input required className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Father Name"><input className="input" value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} /></Field>
          <Field label="Mobile"><input className="input" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} /></Field>
          <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => set('designation', e.target.value)} /></Field>
          <Field label="Skill Category"><input className="input" value={form.skillCategory} onChange={(e) => set('skillCategory', e.target.value)} /></Field>
          <Field label="Joining Date"><input type="date" className="input" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
          <Field label="Salary Type"><select className="input" value={form.salaryType} onChange={(e) => set('salaryType', e.target.value)}><option value="DAILY">Daily</option><option value="MONTHLY">Monthly</option></select></Field>
          <Field label="Status"><select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Daily Wage (₹)"><input type="number" className="input" value={form.dailyWage} onChange={(e) => set('dailyWage', e.target.value)} /></Field>
          <Field label="Monthly Salary (₹)"><input type="number" className="input" value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)} /></Field>
          <div className="sm:col-span-2 flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pf} onChange={(e) => set('pf', e.target.checked)} /> PF</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.esi} onChange={(e) => set('esi', e.target.checked)} /> ESI</label>
          </div>
          <Field label="UAN"><input className="input" value={form.uan} onChange={(e) => set('uan', e.target.value)} /></Field>
          <Field label="Bank A/c"><input className="input" value={form.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} /></Field>
          <Field label="IFSC"><input className="input" value={form.ifsc} onChange={(e) => set('ifsc', e.target.value)} /></Field>
          <Field label="UPI"><input className="input" value={form.upi} onChange={(e) => set('upi', e.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Address"><input className="input" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button className="btn-primary">{editing ? 'Save changes' : 'Create employee'}</button></div>
        </form>
      </Modal>

      <Modal open={!!history} onClose={() => setHistory(null)} title={`${history?.emp.name} — timeline`} wide>
        {history && (history.logs.length ? (
          <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-3 pl-4 max-h-[60vh] overflow-y-auto">
            {history.logs.map((l) => (
              <li key={l.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-brand-500 ring-2 ring-white dark:ring-slate-900" />
                <div className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString()} · {l.userName || 'system'}</div>
                <div className="text-sm font-medium">{l.action} {l.entity}</div>
                {l.oldValue && l.action === 'UPDATE' && <div className="text-xs text-slate-500 mt-0.5">{diff(l.oldValue, l.newValue)}</div>}
                {l.action === 'CREATE' && <div className="text-xs text-slate-500 mt-0.5">Record created ({history.emp.empCode})</div>}
              </li>
            ))}
          </ol>
        ) : <Empty msg="No activity recorded yet" />)}
      </Modal>
    </div>
  );
}

function diff(old: any, neu: any): string {
  const keys = [...new Set([...Object.keys(old || {}), ...Object.keys(neu || {})])].filter((k) => k !== 'updatedAt' && k !== 'createdAt');
  const changes = keys.filter((k) => JSON.stringify(old?.[k]) !== JSON.stringify(neu?.[k])).map((k) => `${k}: ${short(old?.[k])} → ${short(neu?.[k])}`);
  return changes.slice(0, 6).join(', ') || 'no visible field change';
}
const short = (v: any) => v == null ? '∅' : typeof v === 'object' ? '…' : String(v).slice(0, 18);