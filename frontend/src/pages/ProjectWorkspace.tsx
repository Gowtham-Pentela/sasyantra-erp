import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, User, AlertCircle } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, inr } from '../components/ui';
import type { Project } from '../types';

export default function ProjectWorkspace() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<(Project & { allocations: any[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) http.get(`/projects/${id}`).then((r) => { setP(r); setLoading(false); }); }, [id]);

  if (loading) return <Spinner />;
  if (!p) return <Empty msg="Project not found" />;
  const deployed = p.allocations.filter((a) => !a.endDate);
  const expected = Number(p.contractValue) * (1 + Number(p.gstPercent) / 100);

  return (
    <div className="space-y-5">
      <button onClick={() => nav('/projects')} className="btn-ghost"><ArrowLeft size={16} /> Back to projects</button>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-slate-400">{p.code}</div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <div className="text-sm text-slate-500">{p.clientName}{p.clientGst && ` · GST ${p.clientGst}`}</div>
        </div>
        <Badge tone={p.status === 'ACTIVE' ? 'green' : 'slate'}>{p.status}</Badge>
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
            <Row label="Payment terms" value={p.paymentTerms || '—'} />
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
    </div>
  );
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
function Row({ label, value, icon }: { label: string; value: any; icon?: any }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-slate-400 flex items-center gap-1.5">{icon}{label}</dt><dd className="font-medium text-right">{value}</dd></div>;
}