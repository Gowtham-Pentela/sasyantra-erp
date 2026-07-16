import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { ArrowLeft, MapPin, User, AlertCircle, TrendingUp, Trash2, Pencil } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast, inr } from '../components/ui';
import { useAuth } from '../store';
import { ProjectFields } from './Projects';
import type { Project, ProjectProgress } from '../types';

export default function ProjectWorkspace() {
  const { id } = useParams();
  const nav = useNavigate();
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS';
  const [p, setP] = useState<(Project & { allocations: any[] }) | null>(null);
  const [prog, setProg] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [pf, setPf] = useState({ month: new Date().toISOString().slice(0, 7), percent: '', note: '' });
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState<any>(null);

  const loadProg = async () => { if (id) setProg(await http.get(`/projects/${id}/progress`)); };
  useEffect(() => { if (id) http.get(`/projects/${id}`).then((r) => { setP(r); setLoading(false); }); loadProg(); }, [id]);

  const submitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const month = Number(pf.month.replace('-', '')); // YYYY-MM → YYYYMM
    const percent = Number(pf.percent);
    if (!pf.month || Number.isNaN(percent) || percent < 0 || percent > 100) { toast('Enter a month and a 0–100 %', 'err'); return; }
    try { await http.post(`/projects/${id}/progress`, { month, percent, note: pf.note || null }); toast('Progress logged'); setPf((f) => ({ ...f, percent: '', note: '' })); loadProg(); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const setStatus = async (status: string) => {
    try { await http.put(`/projects/${id}`, { status }); setP((cur: any) => cur && { ...cur, status }); toast(`Status set to ${status === 'ON_HOLD' ? 'SHELVED' : status}`); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const openEdit = () => {
    setEf({ ...p, startDate: String(p!.startDate).slice(0, 10), endDate: p!.endDate ? String(p!.endDate).slice(0, 10) : '' });
    setEditing(true);
  };
  const setE = (k: string, v: any) => setEf((f: any) => ({ ...f, [k]: v }));
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...ef, contractValue: Number(ef.contractValue), gstPercent: Number(ef.gstPercent), paymentTerms: ef.paymentTerms === '' || ef.paymentTerms == null ? null : Number(ef.paymentTerms), startDate: new Date(ef.startDate), endDate: ef.endDate ? new Date(ef.endDate) : null };
    try { await http.put(`/projects/${id}`, body); toast('Project updated'); setEditing(false); setEf(null); setP((cur: any) => cur && { ...cur, ...body }); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const delProgress = async (pid: number) => {
    try { await http.del(`/projects/${id}/progress/${pid}`); toast('Entry removed'); loadProg(); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  if (loading) return <Spinner />;
  if (!p) return <Empty msg="Project not found" />;
  const deployed = p.allocations.filter((a) => !a.endDate);
  const expected = Number(p.contractValue) * (1 + Number(p.gstPercent) / 100);

  const latest = prog.length ? Number(prog[prog.length - 1].percent) : 0;
  const months = prog.map((x) => fmtMonth(x.month));
  const series = prog.map((x) => Number(x.percent));

  return (
    <div className="space-y-5">
      <button onClick={() => nav('/projects')} className="btn-ghost"><ArrowLeft size={16} /> Back to projects</button>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-slate-400">{p.code}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <div className="text-sm text-slate-500">{p.clientName}{p.clientGst && ` · GST ${p.clientGst}`}</div>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button onClick={openEdit} className="btn-ghost"><Pencil size={15} /> Edit details</button>
            <label className="text-xs text-slate-400">Status</label>
            <select className="input !py-1.5 !w-auto" value={p.status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">ACTIVE (Ongoing)</option>
              <option value="ON_HOLD">ON_HOLD (Shelved)</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            {p.status === 'CANCELLED' && <span className="text-xs text-rose-600">can now be deleted from the Projects list</span>}
          </div>
        ) : (
          <Badge tone={p.status === 'ACTIVE' ? 'green' : p.status === 'ON_HOLD' ? 'amber' : p.status === 'CANCELLED' ? 'rose' : 'slate'}>{p.status === 'ON_HOLD' ? 'SHELVED' : p.status}</Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card>
          <h3 className="font-semibold mb-3">Project Details</h3>
          <dl className="text-sm space-y-2">
            <Row label="Site location" value={p.siteLocation || '—'} icon={<MapPin size={14} />} />
            <Row label="Manager" value={p.projectManager || '—'} icon={<User size={14} />} />
            <Row label="Start" value={fmt(p.startDate)} />
            <Row label="End" value={p.endDate ? fmt(p.endDate) : 'Open'} />
            <Row label="Billing cycle" value={p.billingCycle || '—'} />
            <Row label="Payment terms" value={p.paymentTerms != null ? `${p.paymentTerms} days` : '—'} />
            {p.mapsUrl && <a href={p.mapsUrl} target="_blank" className="text-brand-600 text-sm inline-flex items-center gap-1 hover:underline"><MapPin size={14} /> View on map</a>}
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Financial Summary</h3>
          <dl className="text-sm space-y-2">
            <Row label="Contract value" value={<b>{inr(p.contractValue)}</b>} />
            <Row label="GST" value={`${inr(Number(p.contractValue) * Number(p.gstPercent) / 100)} (${p.gstPercent}%)`} />
            <Row label="Expected revenue" value={<b className="text-brand-600">{inr(expected)}</b>} />
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <Row label="Invoices raised" value={<span className="text-amber-600 text-xs">needs Invoices module</span>} />
              <Row label="Amount received" value={<span className="text-amber-600 text-xs">needs Payments module</span>} />
              <Row label="Outstanding" value={<span className="text-amber-600 text-xs">needs Invoices module</span>} />
              <Row label="Profit %" value={<span className="text-amber-600 text-xs">needs Expenses module</span>} />
            </div>
          </dl>
        </Card>

        <Card>
          <h3 className="font-semibold mb-1">Deployed Employees</h3>
          <p className="text-xs text-slate-400 mb-3">{deployed.length} active · {p.allocations.length} total (incl. past)</p>
          {!deployed.length ? <Empty msg="No one allocated yet" /> : (
            <div className="space-y-2">
              {deployed.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 grid place-items-center text-xs font-semibold">{a.employee?.name?.[0]}</div>
                    <div><div className="text-sm font-medium">{a.employee?.name}</div><div className="text-xs text-slate-400">{a.employee?.empCode} · {a.role || a.employee?.designation || 'staff'}</div></div>
                  </div>
                  <div className="text-right"><div className="text-sm font-semibold">{inr(a.dailyWage)}</div><div className="text-[10px] text-slate-400">per day</div></div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Monthly completion % — PM logs a 0–100 figure per month; chart shows the trend. */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" /> Monthly Completion</h3>
          {prog.length > 0 && <div className="text-right"><div className="text-xs text-slate-400">Latest ({fmtMonth(prog[prog.length - 1].month)})</div><div className="text-xl font-bold text-brand-600">{latest}%</div></div>}
        </div>

        {prog.length > 0 ? (
          <div className="mb-4">
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${latest}%` }} /></div>
          </div>
        ) : null}

        {!prog.length ? <Empty msg="No progress logged yet" /> : (
          <ReactECharts style={{ height: 240 }} option={{
            grid: { left: 44, right: 16, top: 16, bottom: 28 },
            tooltip: { trigger: 'axis', valueFormatter: (v: any) => `${v}%` },
            xAxis: { type: 'category', data: months },
            yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
            series: [{ type: 'line', data: series, smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { width: 3, color: '#3366ff' }, itemStyle: { color: '#3366ff' }, areaStyle: { opacity: 0.1 } }],
          }} />
        )}

        {canEdit && (
          <form onSubmit={submitProgress} className="mt-4 grid sm:grid-cols-[140px_120px_1fr_auto] gap-2 items-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <div><label className="label">Month</label><input type="month" className="input" value={pf.month} onChange={(e) => setPf((f) => ({ ...f, month: e.target.value }))} /></div>
            <div><label className="label">% Complete</label><input type="number" min={0} max={100} placeholder="0–100" className="input" value={pf.percent} onChange={(e) => setPf((f) => ({ ...f, percent: e.target.value }))} /></div>
            <div><label className="label">Note (optional)</label><input className="input" value={pf.note} onChange={(e) => setPf((f) => ({ ...f, note: e.target.value }))} /></div>
            <button className="btn-primary">Log / Update</button>
          </form>
        )}

        {prog.length > 0 && (
          <div className="mt-4 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr><th className="th">Month</th><th className="th">% Complete</th><th className="th">Note</th>{canEdit && <th className="th"></th>}</tr></thead>
            <tbody>{[...prog].reverse().map((x) => (
              <tr key={x.id}><td className="td">{fmtMonth(x.month)}</td><td className="td font-semibold">{Number(x.percent)}%</td><td className="td text-slate-500">{x.note || '—'}</td>{canEdit && <td className="td text-right"><button onClick={() => delProgress(x.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"><Trash2 size={14} /></button></td>}</tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-3"><AlertCircle size={16} className="text-amber-500" /><h3 className="font-semibold">Allocation history</h3></div>
        {!p.allocations.length ? <Empty msg="No allocations" /> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr><th className="th">Employee</th><th className="th">Role</th><th className="th">Wage/day</th><th className="th">From</th><th className="th">To</th><th className="th">Status</th></tr></thead>
            <tbody>{p.allocations.map((a) => (
              <tr key={a.id}><td className="td">{a.employee?.name} <span className="text-xs text-slate-400">{a.employee?.empCode}</span></td><td className="td">{a.role || '—'}</td><td className="td">{inr(a.dailyWage)}</td><td className="td">{fmt(a.effectiveDate)}</td><td className="td">{a.endDate ? fmt(a.endDate) : 'active'}</td><td className="td"><Badge tone={a.endDate ? 'slate' : 'green'}>{a.endDate ? 'ended' : 'active'}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Modal open={editing} onClose={() => { setEditing(false); setEf(null); }} title="Edit Project" wide>
        {ef && (
          <form onSubmit={saveEdit} className="grid sm:grid-cols-2 gap-3">
            {ProjectFields(ef, setE)}
            <div className="sm:col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setEditing(false); setEf(null); }} className="btn-ghost">Cancel</button><button className="btn-primary">Save changes</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtMonth = (m: number) => { const s = String(m); const y = s.slice(0, 4), mo = Number(s.slice(4, 6)); return new Date(Number(y), mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); };
function Row({ label, value, icon }: { label: string; value: any; icon?: any }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-400 flex items-center gap-1.5">{icon}{label}</dt><dd className="font-medium text-right">{value}</dd></div>;
}