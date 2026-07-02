import { useEffect, useState, useCallback } from 'react';
import { Play, Download, Wallet, CheckCircle2, BadgeIndianRupee, UserPlus, FileText } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast, inr2 } from '../components/ui';
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
  const [payRow, setPayRow] = useState<PayrollRow | null>(null);
  const [payForm, setPayForm] = useState({ paidDate: new Date().toISOString().slice(0, 10), utr: '', mode: 'BANK', remarks: '' });
  const [employees, setEmployees] = useState<any[]>([]);
  const [genOne, setGenOne] = useState(false);
  const [selEmp, setSelEmp] = useState('');
  const ymLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  useEffect(() => { http.get('/projects').then(setProjects as any); }, []);
  useEffect(() => { http.get('/employees?limit=200').then((r: any) => setEmployees(r.data)); }, []);
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
  const generateOne = async () => {
    if (!selEmp) return;
    setBusy(true);
    try { const yyyymm = month.replace('-', ''); const res: any = await http.post('/payroll/generate', { month: yyyymm, projectId: Number(projectId), employeeId: Number(selEmp) }); toast(`Payslip generated for ${res.rows[0]?.employee?.name ?? 'employee'}`); setGenOne(false); setSelEmp(''); load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const genPdf = async (r: PayrollRow) => {
    try { const res: any = await http.post(`/payroll/${r.id}/payslip`); window.open(res.url, '_blank'); toast('Payslip PDF ready'); }
    catch (e: any) { toast(e.message, 'err'); }
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

  const totals = rows.reduce((a, r) => ({ gross: a.gross + r.gross, net: a.net + r.net, emp: a.emp + r.employerCost, paid: a.paid + (r.paid ? r.net : 0) }), { gross: 0, net: 0, emp: 0, paid: 0 });

  const doPay = async () => {
    if (!payRow) return;
    setBusy(true);
    try { await http.post(`/payroll/${payRow.id}/pay`, payForm); toast(`Paid ${inr2(payRow.net)} to ${payRow.employee.name}`); setPayRow(null); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Payroll</h1><p className="text-sm text-slate-400">Auto-calculated from attendance · all money in ₹</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
          {canGen && <button onClick={generate} disabled={busy} className="btn-primary"><Play size={14} /> {busy ? 'Calculating…' : 'Generate'}</button>}
          {canGen && <button onClick={() => setGenOne(true)} disabled={busy} className="btn-ghost"><UserPlus size={14} /> Generate one</button>}
          <button onClick={exportCsv} className="btn-ghost"><Download size={14} /> CSV</button>
        </div>
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg="No payroll for this month/project — click Generate" /></Card> : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Card className="p-4"><div className="text-xs text-slate-400">Total Gross</div><div className="text-xl font-semibold text-brand-600">{inr2(totals.gross)}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-400">Total Net Payable</div><div className="text-xl font-semibold text-emerald-600">{inr2(totals.net)}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-400">Total Employer Cost</div><div className="text-xl font-semibold">{inr2(totals.emp)}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-400">Paid This Month</div><div className="text-xl font-semibold text-emerald-600">{inr2(totals.paid)}</div></Card>
          </div>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-auto max-h-[65vh]">
              <table className="w-full text-sm min-w-[1180px]">
                <thead><tr>{['Code', 'Name', 'Present', 'OT', 'Gross', 'Basic', 'OT ₹', 'Advance', 'PF', 'ESI', 'PT', 'Net', 'Emp. Cost', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
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
                      <td className="td">
                        <div className="flex items-center gap-1">
                          {r.paid ? <Badge tone="green"><CheckCircle2 size={12} className="inline mr-1" />Paid {r.salaryPayment?.utr ? `· ${r.salaryPayment.utr}` : ''}</Badge>
                            : canGen ? <button onClick={() => setPayRow(r)} className="btn-ghost !py-1 !px-2 text-xs"><BadgeIndianRupee size={12} className="inline mr-1" />Mark Paid</button>
                            : <Badge tone="amber">Unpaid</Badge>}
                          {canGen && <button onClick={() => genPdf(r)} className="btn-ghost !py-1 !px-2 text-xs" title="Generate & download payslip PDF"><FileText size={12} className="inline mr-1" />PDF</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <Modal open={!!payRow} onClose={() => setPayRow(null)} title={`Mark Paid · ${payRow?.employee.name ?? ''} · ${inr2(payRow?.net ?? 0)}`}>
        <div className="space-y-3">
          <Field label="Paid date"><input type="date" className="input" value={payForm.paidDate} onChange={(e) => setPayForm({ ...payForm, paidDate: e.target.value })} /></Field>
          <Field label="UTR / Ref"><input className="input" value={payForm.utr} onChange={(e) => setPayForm({ ...payForm, utr: e.target.value })} placeholder="bank UTR / cheque no" /></Field>
          <Field label="Mode"><select className="input" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}><option>BANK</option><option>CASH</option><option>UPI</option><option>CHEQUE</option></select></Field>
          <Field label="Remarks"><input className="input" value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setPayRow(null)} className="btn-ghost">Cancel</button><button onClick={doPay} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Record payment'}</button></div>
        </div>
      </Modal>

      <Modal open={genOne} onClose={() => setGenOne(false)} title={`Generate single payslip · ${ymLabel}`}>
        <div className="space-y-3">
          <Field label="Employee"><select className="input" value={selEmp} onChange={(e) => setSelEmp(e.target.value)}><option value="">Select employee…</option>{employees.map((e: any) => <option key={e.id} value={e.id}>{e.empCode} · {e.name}</option>)}</select></Field>
          <p className="text-xs text-slate-400">Computes from the employee&apos;s attendance for {ymLabel} and saves under the selected project. Existing payslip for this employee/month is overwritten.</p>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setGenOne(false)} className="btn-ghost">Cancel</button><button onClick={generateOne} disabled={busy || !selEmp} className="btn-primary">{busy ? 'Calculating…' : 'Generate'}</button></div>
        </div>
      </Modal>
    </div>
  );
}