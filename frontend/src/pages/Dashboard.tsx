import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { Briefcase, Users, CalendarCheck, Wallet, IndianRupee, Clock, AlertCircle, ArrowRight, TrendingUp } from 'lucide-react';
import { http } from '../api/client';
import { KpiCard, Card, Badge, Spinner, Empty, inr } from '../components/ui';

interface Dash {
  kpis: { activeProjects: number; totalEmployees: number; presentToday: number; monthlySalaryLiability: number; totalAdvancesGiven: number; upcomingRenewals: number };
  pending: Record<string, string>;
  projects: { id: number; code: string; name: string; clientName: string; status: string; contractValue: number; gstPercent: number; deployed: number }[];
}

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const nav = useNavigate();

  useEffect(() => { http.get('/dashboard').then(setD); }, []);
  useEffect(() => { if (d?.projects?.length && sel == null) setSel(d.projects[0].id); }, [d, sel]);

  if (!d) return <Spinner />;
  const k = d.kpis;
  const proj = d.projects.find((p) => p.id === sel);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Business Overview</h1>
        <p className="text-sm text-slate-400">Live snapshot — every figure computed from the underlying modules.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Active Projects" value={k.activeProjects} icon={<Briefcase size={18} />} tone="brand" />
        <KpiCard label="Total Employees" value={k.totalEmployees} icon={<Users size={18} />} tone="brand" />
        <KpiCard label="Present Today" value={k.presentToday} sub={`${k.totalEmployees ? Math.round((k.presentToday / k.totalEmployees) * 100) : 0}% attendance`} icon={<CalendarCheck size={18} />} tone="green" />
        <KpiCard label="Salary Liability (mo)" value={inr(k.monthlySalaryLiability)} icon={<Wallet size={18} />} tone="amber" />
        <KpiCard label="Advances Given (mo)" value={inr(k.totalAdvancesGiven)} icon={<IndianRupee size={18} />} tone="rose" />
        <KpiCard label="Renewals ≤30d" value={k.upcomingRenewals} icon={<Clock size={18} />} tone="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="card p-5 xl:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Projects</h3>
            <button onClick={() => nav('/projects')} className="text-xs text-brand-600 hover:underline flex items-center gap-1">All <ArrowRight size={12} /></button>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {d.projects.map((p) => (
              <button key={p.id} onClick={() => setSel(p.id)} className={`w-full text-left p-3 rounded-2xl border transition ${sel === p.id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40' : 'border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{p.name}</span>
                  <Badge tone="green">{p.status}</Badge>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{p.code} · {p.clientName}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="text-slate-500">{p.deployed} deployed</span>
                  <span className="font-semibold">{inr(p.contractValue)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, p.deployed * 18)}%` }} />
                </div>
              </button>
            ))}
            {!d.projects.length && <Empty msg="No active projects yet" />}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-5">
          {proj && (
            <Card>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400">{proj.code}</div>
                  <h2 className="text-xl font-semibold">{proj.name}</h2>
                  <div className="text-sm text-slate-500">{proj.clientName}</div>
                </div>
                <button onClick={() => nav(`/projects/${proj.id}`)} className="btn-ghost">Open workspace <ArrowRight size={14} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <Mini label="Contract Value" value={inr(proj.contractValue)} />
                <Mini label="GST" value={`${proj.gstPercent}%`} />
                <Mini label="Deployed" value={proj.deployed} />
                <Mini label="Status" value={<Badge tone="green">{proj.status}</Badge>} />
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-brand-600" /> Salary liability vs advances</h3>
            </div>
            <ReactECharts style={{ height: 220 }} option={{
              grid: { left: 48, right: 16, top: 16, bottom: 24 },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: ['Salary liability', 'Advances given'] },
              yAxis: { type: 'value' },
              series: [{ type: 'bar', data: [k.monthlySalaryLiability, k.totalAdvancesGiven], itemStyle: { color: '#3366ff', borderRadius: [6, 6, 0, 0] }, barWidth: '40%' }],
            }} />
          </Card>

          <Card>
            <h3 className="font-semibold flex items-center gap-2 mb-3"><AlertCircle size={16} className="text-amber-500" /> Awaiting modules</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              {Object.entries(d.pending).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <span className="text-sm font-medium capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <Badge tone="amber">{v.replace('needs ', '')}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"><div className="text-xs text-slate-400">{label}</div><div className="font-semibold mt-0.5">{value}</div></div>;
}