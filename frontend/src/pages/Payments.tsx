import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, inr } from '../components/ui';

interface Ledger { invoicePayments: any[]; salaryPayments: any[]; totals: { in: number; out: number }; }

export default function Payments() {
  const [d, setD] = useState<Ledger | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    http.get<Ledger>(`/payments${q.size ? `?${q}` : ''}`).then(setD);
  }, [from, to]);

  if (!d) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Payments Ledger</h1><p className="text-sm text-slate-400">Money in (invoice payments) and out (salary payments)</p></div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-slate-400">to</span>
          <input type="date" className="input w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingUp size={14} className="text-emerald-600" /> Money in</div><div className="text-2xl font-semibold text-emerald-600 mt-1">{inr(d.totals.in)}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingDown size={14} className="text-rose-600" /> Money out (salary)</div><div className="text-2xl font-semibold text-rose-600 mt-1">{inr(d.totals.out)}</div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold">Invoice payments (in)</div>
          {!d.invoicePayments.length ? <Empty msg="None" /> : (
            <table className="w-full text-sm">
              <thead><tr>{['Date', 'Invoice', 'Project', 'Ref', 'Amount'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{d.invoicePayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td text-slate-400">{new Date(p.receivedDate).toLocaleDateString('en-IN')}</td>
                  <td className="td font-mono text-xs">{p.invoice?.number ?? '—'}</td>
                  <td className="td">{p.invoice?.project?.name ?? '—'}</td>
                  <td className="td font-mono text-xs text-slate-400">{p.utr ?? '—'}</td>
                  <td className="td font-semibold text-emerald-600">{inr(p.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold">Salary payments (out)</div>
          {!d.salaryPayments.length ? <Empty msg="None" /> : (
            <table className="w-full text-sm">
              <thead><tr>{['Date', 'Employee', 'Ref', 'Mode', 'Amount'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>{d.salaryPayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="td text-slate-400">{new Date(p.paidDate).toLocaleDateString('en-IN')}</td>
                  <td className="td font-medium">{p.employee?.name ?? '—'}</td>
                  <td className="td font-mono text-xs text-slate-400">{p.utr ?? '—'}</td>
                  <td className="td"><Badge>{p.mode}</Badge></td>
                  <td className="td font-semibold text-rose-600">{inr(p.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}