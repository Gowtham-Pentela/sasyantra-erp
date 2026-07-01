import { useEffect, useState } from 'react';
import { Printer, TrendingUp, FileText, Users } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, inr, inr2 } from '../components/ui';

interface Margin { id: number; code: string; name: string; clientName: string; contractValue: number; revenue: number; salary: number; expense: number; margin: number; }
interface SalRow { id: number; amount: number; paidDate: string; utr?: string | null; mode: string; employee: { empCode: string; name: string; designation?: string | null }; }
interface Cashflow { invoices: any[]; expenses: any[]; in: number; out: number; }
type Tab = 'margin' | 'salary' | 'cashflow';

export default function Reports() {
  const [tab, setTab] = useState<Tab>('margin');
  const [margin, setMargin] = useState<Margin[]>([]);
  const [salary, setSalary] = useState<{ rows: SalRow[]; total: number } | null>(null);
  const [cash, setCash] = useState<Cashflow | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { setLoading(true); if (tab === 'margin') { http.get<Margin[]>('/reports/project-margin').then(setMargin).finally(() => setLoading(false)); } }, [tab]);
  useEffect(() => {
    if (tab !== 'salary') return;
    const p = new URLSearchParams();
    if (from) p.set('from', from); if (to) p.set('to', to);
    http.get<{ rows: SalRow[]; total: number }>(`/reports/salary-register${p.size ? `?${p}` : ''}`).then(setSalary);
  }, [tab, from, to]);
  useEffect(() => {
    if (tab !== 'cashflow') return;
    const p = new URLSearchParams();
    if (from) p.set('from', from); if (to) p.set('to', to);
    http.get<Cashflow>(`/reports/cashflow${p.size ? `?${p}` : ''}`).then(setCash);
  }, [tab, from, to]);

  const tabs: [Tab, string, any][] = [['margin', 'Project margin', TrendingUp], ['salary', 'Salary register', Users], ['cashflow', 'Cash flow', FileText]];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div><h1 className="text-2xl font-semibold tracking-tight">Reports</h1><p className="text-sm text-slate-400">Per-project margin, salary register, cash flow</p></div>
        <div className="flex items-center gap-2">
          {(tab === 'salary' || tab === 'cashflow') && <>
            <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-slate-400">to</span>
            <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
          </>}
          <button onClick={() => window.print()} className="btn-ghost"><Printer size={14} /> Print / PDF</button>
        </div>
      </div>

      <div className="flex gap-2 print:hidden">
        {tabs.map(([t, label, Icon]) => <button key={t} onClick={() => setTab(t)} className={`btn-ghost ${tab === t ? '!bg-brand-50 dark:!bg-brand-900/30 !text-brand-600' : ''}`}><Icon size={14} className="inline mr-1" />{label}</button>)}
      </div>

      {loading ? <Spinner /> : tab === 'margin' ? (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr>{['Project', 'Client', 'Contract', 'Revenue', 'Salary', 'Expenses', 'Margin'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{margin.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td font-medium">{p.name}</td>
                <td className="td text-slate-400">{p.clientName}</td>
                <td className="td">{inr(p.contractValue)}</td>
                <td className="td text-emerald-600">{inr(p.revenue)}</td>
                <td className="td text-rose-600">{inr(p.salary)}</td>
                <td className="td text-rose-600">{inr(p.expense)}</td>
                <td className={`td font-semibold ${p.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{inr(p.margin)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      ) : tab === 'salary' ? (
        <Card className="p-0 overflow-hidden">
          {!salary?.rows.length ? <Empty msg="No salary payments in range" /> : <>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span className="font-semibold">Salary register</span><span className="text-sm text-slate-400">Total: <b className="text-emerald-600">{inr2(salary.total)}</b></span></div>
            <table className="w-full text-sm">
              <thead><tr>{['Date', 'Code', 'Name', 'Designation', 'Mode', 'UTR', 'Amount'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{salary.rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td text-slate-400">{new Date(r.paidDate).toLocaleDateString('en-IN')}</td>
                  <td className="td font-mono text-xs">{r.employee.empCode}</td>
                  <td className="td font-medium">{r.employee.name}</td>
                  <td className="td text-slate-400">{r.employee.designation ?? '—'}</td>
                  <td className="td"><Badge>{r.mode}</Badge></td>
                  <td className="td font-mono text-xs text-slate-400">{r.utr ?? '—'}</td>
                  <td className="td font-semibold text-emerald-600">{inr2(r.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </>}
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between"><span className="font-semibold">Cash flow</span><span className="text-sm text-slate-400">In: <b className="text-emerald-600">{inr(cash?.in)}</b> · Out: <b className="text-rose-600">{inr(cash?.out)}</b> · Net: <b>{inr((cash?.in ?? 0) - (cash?.out ?? 0))}</b></span></div>
          <div className="grid lg:grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div>
              <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase">Money in (invoice payments)</div>
              {!cash?.invoices.length ? <Empty msg="None" /> : <table className="w-full text-sm"><tbody>{cash.invoices.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="td text-slate-400">{new Date(p.receivedDate).toLocaleDateString('en-IN')}</td><td className="td font-mono text-xs">{p.invoice?.number}</td><td className="td text-slate-400">{p.invoice?.project?.name}</td><td className="td text-right text-emerald-600 font-semibold">{inr(p.amount)}</td></tr>
              ))}</tbody></table>}
            </div>
            <div>
              <div className="px-4 py-2 text-xs font-medium text-slate-400 uppercase">Money out (paid expenses)</div>
              {!cash?.expenses.length ? <Empty msg="None" /> : <table className="w-full text-sm"><tbody>{cash.expenses.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="td text-slate-400">{new Date(p.paidDate).toLocaleDateString('en-IN')}</td><td className="td font-medium">{p.category}</td><td className="td text-slate-400">{p.project?.name ?? '—'}</td><td className="td text-right text-rose-600 font-semibold">{inr(p.paidAmount)}</td></tr>
              ))}</tbody></table>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}