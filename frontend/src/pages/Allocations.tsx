import { useEffect, useState } from 'react';
import { ClipboardList, ArrowRightLeft, Square } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Field, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import type { Employee, Project, Allocation } from '../types';

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Allocations() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [emps, setEmps] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employeeId: '', projectId: '', role: '', dailyWage: 0, effectiveDate: new Date().toISOString().slice(0, 10), remarks: '' });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    const [e, p, a] = await Promise.all([http.get('/employees'), http.get('/projects'), http.get('/allocations?active=true')]);
    setEmps((e as any).data); setProjects(p as any); setRows(a as any); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const onPickEmp = (id: string) => {
    const e = emps.find((x) => x.id === Number(id));
    set('employeeId', id); set('dailyWage', e ? Number(e.dailyWage) : 0);
  };
  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.projectId) return toast('Pick employee and project', 'err');
    try { await http.post('/allocations', { ...form, employeeId: Number(form.employeeId), projectId: Number(form.projectId), dailyWage: Number(form.dailyWage), effectiveDate: new Date(form.effectiveDate) }); toast('Employee assigned (previous allocation auto-ended)'); setForm((s:any) => ({ ...s, employeeId: '', projectId: '', role: '', remarks: '' })); load(); } catch (err: any) { toast(err.message, 'err'); }
  };
  const end = async (id: number) => { if (!confirm('End this allocation?')) return; await http.post(`/allocations/${id}/end`); toast('Allocation ended'); load(); };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Employee Allocation</h1><p className="text-sm text-slate-400">Assign staff to projects · transfers auto-close the prior allocation (full history kept).</p></div>

      {canEdit && (
        <Card>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><ArrowRightLeft size={16} className="text-brand-600" /> Assign / Transfer</h3>
          <form onSubmit={assign} className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Field label="Employee"><select className="input" value={form.employeeId} onChange={(e) => onPickEmp(e.target.value)}><option value="">Select…</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.empCode} · {e.name}</option>)}</select></Field>
            <Field label="Project"><select className="input" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field>
            <Field label="Role"><input className="input" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Supervisor" /></Field>
            <Field label="Wage/day (₹)"><input type="number" className="input" value={form.dailyWage} onChange={(e) => set('dailyWage', e.target.value)} /></Field>
            <Field label="Effective"><input type="date" className="input" value={form.effectiveDate} onChange={(e) => set('effectiveDate', e.target.value)} /></Field>
            <div className="flex items-end"><button className="btn-primary w-full justify-center">Assign</button></div>
            <div className="sm:col-span-3 lg:col-span-6"><Field label="Remarks"><input className="input" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} /></Field></div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-semibold flex items-center gap-2 mb-3"><ClipboardList size={16} /> Active Allocations</h3>
        {loading ? <Spinner /> : !rows.length ? <Empty msg="No active allocations" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
            <thead><tr><th className="th">Employee</th><th className="th">Project</th><th className="th">Role</th><th className="th">Wage/day</th><th className="th">Since</th><th className="th"></th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td">{a.employee?.name} <span className="text-xs text-slate-400">{a.employee?.empCode}</span></td>
                <td className="td">{a.project?.name ?? '—'}</td>
                <td className="td">{a.role || '—'}</td>
                <td className="td">{inr(a.dailyWage)}</td>
                <td className="td">{fmt(a.effectiveDate)}</td>
                <td className="td text-right">{canEdit && <button onClick={() => end(a.id)} className="btn-ghost !py-1 !px-2 text-xs"><Square size={12} /> End</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}