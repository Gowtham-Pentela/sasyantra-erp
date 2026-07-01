import { useEffect, useState } from 'react';
import { Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast, inr } from '../components/ui';
import { useAuth } from '../store';

interface Budget { opening: number; topups: number; invoiceIn: number; expenseOut: number; salaryOut: number; available: number; movements: any[]; }

export default function Budget() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN';
  const [b, setB] = useState<Budget | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: 'TOPUP', amount: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const toast = useToast();

  const load = () => http.get<Budget>('/budget').then(setB);
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.amount) return toast('Enter an amount', 'err');
    setBusy(true);
    try { await http.post('/budget', { type: form.type, amount: Number(form.amount), date: form.date, note: form.note }); toast('Budget entry added'); setOpen(false); setForm({ ...form, amount: '', note: '' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  if (!b) return <Spinner />;
  const rows: [string, number, 'green' | 'rose' | 'slate' | 'brand'][] = [
    ['Opening balance', b.opening, 'slate'], ['Top-ups', b.topups, 'brand'],
    ['Invoice payments in', b.invoiceIn, 'green'], ['Expenses paid', -b.expenseOut, 'rose'], ['Salary paid', -b.salaryOut, 'rose'],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Budget</h1><p className="text-sm text-slate-400">Company cash fund · auto-updates from invoices, expenses & salary payments</p></div>
        {canEdit && <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={14} /> Add opening / top-up</button>}
      </div>

      <Card className="p-6 bg-gradient-to-br from-brand-500/10 to-emerald-500/5">
        <div className="flex items-center gap-3 text-slate-400"><Wallet size={18} /><span className="text-sm font-medium">Available Budget</span></div>
        <div className="text-4xl font-semibold tracking-tight mt-2">{inr(b.available)}</div>
        <div className="text-xs text-slate-400 mt-2">opening + top-ups + invoice payments − expenses − salary paid</div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {rows.map(([label, val, tone]) => (
          <Card key={label} className="p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-lg font-semibold mt-1 ${val < 0 ? 'text-rose-600' : tone === 'green' ? 'text-emerald-600' : tone === 'brand' ? 'text-brand-600' : ''}`}>{inr(Math.abs(val))}</div>
          </Card>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 font-semibold">Recent movements</div>
        {!b.movements.length ? <Empty msg="No movements yet" /> : (
          <div className="overflow-auto max-h-[55vh]">
            <table className="w-full text-sm">
              <thead><tr>{['Date', 'Direction', 'Label', 'Ref', 'Amount'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody>
                {b.movements.map((m, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="td text-slate-400">{new Date(m.date).toLocaleDateString('en-IN')}</td>
                    <td className="td">{m.direction === 'in' ? <Badge tone="green"><TrendingUp size={12} className="inline mr-1" />In</Badge> : <Badge tone="rose"><TrendingDown size={12} className="inline mr-1" />Out</Badge>}</td>
                    <td className="td font-medium">{m.label}</td>
                    <td className="td font-mono text-xs text-slate-400">{m.ref ?? '—'}</td>
                    <td className={`td font-semibold ${m.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>{m.direction === 'in' ? '+' : '−'}{inr(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add budget entry">
        <div className="space-y-3">
          <Field label="Type"><select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="TOPUP">TOPUP</option><option value="OPENING">OPENING</option></select></Field>
          <Field label="Amount (₹)"><input type="number" className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Note"><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button><button onClick={add} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Add entry'}</button></div>
        </div>
      </Modal>
    </div>
  );
}