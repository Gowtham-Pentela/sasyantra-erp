import { useEffect, useState, useCallback } from 'react';
import { Play, Download, Wallet } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, useToast, inr2 } from '../components/ui';
import { useAuth } from '../store';
import type { Project, PayrollRow } from '../types';

export default function Payroll() {
  const role = useAuth((s) => s.user?.role);
  const canGen = role === 'ADMIN' || role === 'ACCOUNTS';
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => { http.get('/projects').then(setProjects as any); }, []);
  useEffect(() => { if (projects.length && !projectId) setProjectId(String(projects[0].id)); }, [projects, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const yyyymm = month.replace('-', '');
    setRows(await http.get(`/payroll?month=${yyyymm}&projectId=${projectId}`));
    setLoading(false);
  }, [projectId, month]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true);
    try { const yyyymm = month.replace('-', ''); const res: any = await http.post('/payroll/generate', { month: yyyymm, projectId: Number(projectId) }); toast(`${res.count} payroll rows generated`); load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const exportCsv = async () => {
    const yyyymm = month.replace('-', '');
    const token = useAuth.getState().token;
    const res = await fetch(`/api/payroll/export?month=${yyyymm}&projectId=${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `payroll-${yyyymm}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totals = rows.reduce((a, r) => ({ gross: a.gross + r.gross, net: a.net + r.net, emp: a.emp + r.employerCost }), { gross: 0, net: 0, emp: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Payroll</h1><p className="text-sm text-slate-400">Auto-calculated from attendance · all money in ₹</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
          {canGen && <button onClick={generate} disabled={busy} className="btn-primary"><Play size={14} /> {busy ? 'Calculating…' : 'Generate'}</button>}
          <button onClick={exportCsv} className="btn-ghost"><Download size={14} /> CSV</button>
        </div>
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No payroll for this month/project — click Generate" /></Card> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-xs text-slate-400">Total Gross</div><div className="text-xl font-semibold text-brand-600">{inr2(totals.gross)}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-400">Total Net Payable</div><div className="text-xl font-semibold text-emerald-600">{inr2(totals.net)}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-400">Total Employer Cost</div><div className="text-xl font-semibold">{inr2(totals.emp)}</div></Card>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-sm min-w-[1100px]">
                <thead><tr>{['Code', 'Name', 'Present', 'OT', 'Gross', 'Basic', 'OT ₹', 'Advance', 'PF', 'ESI', 'PT', 'Net', 'Emp. Cost'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="td font-mono text-xs">{r.employee.empCode}</td>
                      <td className="td font-medium">{r.employee.name}</td>
                      <td className="td">{r.presentDays}/{r.workingDays}</td>
                      <td className="td">{r.otHours}</td>
                      <td className="td">{inr2(r.gross)}</td>
                      <td className="td">{inr2(r.basic)}</td>
                      <td className="td">{inr2(r.otAmount)}</td>
                      <td className="td text-rose-600">{inr2(r.advanceRecovery)}</td>
                      <td className="td">{inr2(r.pf)}</td>
                      <td className="td">{inr2(r.esi)}</td>
                      <td className="td">{inr2(r.professionalTax)}</td>
                      <td className="td font-semibold text-emerald-600">{inr2(r.net)}</td>
                      <td className="td">{inr2(r.employerCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      <div className="text-xs text-slate-400 flex items-center gap-1.5"><Wallet size={13} /> Net = gross + OT + allowances − advance − fine − PF − ESI − PT − attendance deduction. PT is a flat ₹200 slab; PF/ESI per employee flags.</div>
    </div>
  );
}