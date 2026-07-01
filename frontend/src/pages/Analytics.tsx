import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Users, Briefcase, Activity, Wallet } from 'lucide-react';
import { http } from '../api/client';
import { Card, Spinner, KpiCard, Badge, inr } from '../components/ui';

export default function Analytics() {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    Promise.all([
      http.get('/analytics/trends'),
      http.get('/analytics/project-mix'),
      http.get('/analytics/headcount'),
      http.get('/analytics/utilization'),
      http.get('/analytics/budget'),
    ]).then(([trends, mix, head, util, budget]) => setD({ trends, mix, head, util, budget }));
  }, []);
  if (!d) return <Spinner />;

  const brand = '#3366ff', green = '#10b981', rose = '#f43f5e', amber = '#f59e0b';
  const present = d.util.filter((u: any) => ['P', 'OT', 'NS', 'DS', 'TR', 'HD'].includes(u.code)).reduce((s: number, u: any) => s + u.count, 0);
  const absent = d.util.filter((u: any) => ['A', 'LV', 'WO', 'HL'].includes(u.code)).reduce((s: number, u: any) => s + u.count, 0);

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Analytics</h1><p className="text-sm text-slate-400">Trends, utilization, project & headcount mix</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Active employees" value={d.head.active} sub={`${d.head.total} total · ${d.head.left} left`} tone="brand" icon={<Users size={18} />} />
        <KpiCard label="Projects (active)" value={d.mix.value.length} sub={`${d.mix.status.reduce((s: number, x: any) => s + x.count, 0)} total`} tone="green" icon={<Briefcase size={18} />} />
        <KpiCard label="Attendance (30d)" value={`${present > 0 ? Math.round(present / (present + absent) * 100) : 0}%`} sub={`${present} present · ${absent} absent`} tone="amber" icon={<Activity size={18} />} />
        <KpiCard label="Available budget" value={inr(d.budget.available)} sub={`in ${inr(d.budget.invoiceIn)} · out ${inr(Number(d.budget.expenseOut) + Number(d.budget.salaryOut))}`} tone="rose" icon={<Wallet size={18} />} />
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Revenue vs expenses vs salary (12 months)</h3>
        <ReactECharts style={{ height: 280 }} option={{
          legend: { top: 0 }, tooltip: { trigger: 'axis' },
          grid: { left: 56, right: 16, top: 32, bottom: 28 },
          xAxis: { type: 'category', data: d.trends.labels },
          yAxis: { type: 'value' },
          series: [
            { name: 'Revenue', type: 'bar', data: d.trends.revenue, itemStyle: { color: green, borderRadius: [4, 4, 0, 0] } },
            { name: 'Expenses', type: 'bar', data: d.trends.expenses, itemStyle: { color: rose, borderRadius: [4, 4, 0, 0] } },
            { name: 'Salary', type: 'line', data: d.trends.salary, smooth: true, itemStyle: { color: amber }, lineStyle: { width: 2 } },
          ],
        }} />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-2">Contract value by project</h3>
          <ReactECharts style={{ height: 260 }} option={{
            tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
            legend: { bottom: 0, type: 'scroll' },
            series: [{ type: 'pie', radius: ['40%', '70%'], data: d.mix.value.map((p: any) => ({ name: p.name, value: p.value })), itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 } }],
          }} />
        </Card>
        <Card>
          <h3 className="font-semibold mb-2">Project status</h3>
          <ReactECharts style={{ height: 260 }} option={{
            tooltip: { trigger: 'axis' }, grid: { left: 56, right: 16, top: 16, bottom: 28 },
            xAxis: { type: 'category', data: d.mix.status.map((s: any) => s.status) },
            yAxis: { type: 'value' },
            series: [{ type: 'bar', data: d.mix.status.map((s: any) => s.count), itemStyle: { color: brand, borderRadius: [4, 4, 0, 0] }, barWidth: '40%' }],
          }} />
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-2">Headcount by skill category</h3>
        <div className="flex flex-wrap gap-2">
          {d.head.bySkill.map((s: any) => (
            <div key={s.category} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <Users size={14} className="text-slate-400" /><span className="font-medium text-sm">{s.category}</span><Badge tone="brand">{s.count}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}