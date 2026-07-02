import { useEffect, useState, useCallback } from 'react';
import { Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, Modal, Field, useToast } from '../components/ui';
import { useAuth } from '../store';
import type { AttendanceCode } from '../types';

const CODES: AttendanceCode[] = ['P', 'A', 'OT', 'HD', 'WO', 'LV', 'HL', 'NS', 'DS', 'TR'];
const CODE_TONE: Record<string, string> = {
  P: 'bg-emerald-500 text-white', A: 'bg-rose-500 text-white', OT: 'bg-brand-600 text-white',
  HD: 'bg-amber-500 text-white', WO: 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  LV: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200', HL: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  NS: 'bg-indigo-500 text-white', DS: 'bg-brand-400 text-white', TR: 'bg-cyan-500 text-white',
};
const codeLabel = (c: AttendanceCode) => c;
// local YYYY-MM-DD from a Date/ISO string (matches backend joining-date gate)
const ymd = (s: string) => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function Attendance() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS' || role === 'ACCOUNTS';
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<{ employees: any[]; attendance: Record<number, Record<string, any>>; days: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [cell, setCell] = useState<{ emp: any; date: string; row?: any } | null>(null);
  const [form, setForm] = useState<any>({ code: 'P', otHours: 0, advance: 0, bonus: 0, travel: 0, food: 0, fine: 0, otherAllowance: 0, remarks: '' });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const yyyymm = month.replace('-', '');
    const res: any = await http.get(`/attendance?month=${yyyymm}`);
    setData(res); setLoading(false);
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const ymLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const openCell = (emp: any, date: string) => {
    const row = data?.attendance?.[emp.id]?.[date];
    setCell({ emp, date, row });
    setForm({ code: row?.code || 'P', otHours: row?.otHours || 0, advance: row?.advance || 0, bonus: row?.bonus || 0, travel: row?.travel || 0, food: row?.food || 0, fine: row?.fine || 0, otherAllowance: row?.otherAllowance || 0, remarks: row?.remarks || '' });
  };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cell) return;
    try { await http.put('/attendance', { employeeId: cell.emp.id, date: cell.date, ...form, otHours: Number(form.otHours), advance: Number(form.advance), bonus: Number(form.bonus), travel: Number(form.travel), food: Number(form.food), fine: Number(form.fine), otherAllowance: Number(form.otherAllowance) }); toast('Attendance saved'); setCell(null); load(); } catch (err: any) { toast(err.message, 'err'); }
  };
  const bulk = async () => {
    if (!confirm(`Mark all weekdays Present for ${ymLabel}? (skips days already marked)`)) return;
    const yyyymm = month.replace('-', '');
    const res: any = await http.post(`/attendance/bulk?month=${yyyymm}&code=P`);
    toast(`${res.created} attendance rows created`); load();
  };

  const shiftMonth = (d: number) => { const [y, m] = month.split('-').map(Number); const dt = new Date(y, m - 1 + d, 1); setMonth(dt.toISOString().slice(0, 7)); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Attendance</h1><p className="text-sm text-slate-400">Monthly calendar · all employees · click any cell to mark</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="btn-ghost !p-2"><ChevronLeft size={16} /></button>
            <input type="month" className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button onClick={() => shiftMonth(1)} className="btn-ghost !p-2"><ChevronRight size={16} /></button>
          </div>
          {canEdit && <button onClick={bulk} className="btn-primary"><Zap size={14} /> Bulk P (weekdays)</button>}
        </div>
      </div>

      <Card className="p-4">
        {loading || !data ? <Spinner /> : !data.employees.length ? <Empty msg="No active employees" /> : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
              {CODES.map((c) => <span key={c} className="flex items-center gap-1"><span className={`h-4 w-4 rounded ${CODE_TONE[c]} grid place-items-center text-[9px] font-bold`}>{c[0]}</span>{codeLabel(c)}</span>)}
            </div>
            <div className="overflow-auto max-h-[70vh]">
              <table className="border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                  <tr>
                    <th className="th sticky left-0 z-20 bg-white dark:bg-slate-900 min-w-[180px]">Employee</th>
                    {data.days.map((dstr) => {
                      const d = new Date(dstr + 'T00:00:00');
                      const sun = d.getDay() === 0;
                      return <th key={dstr} className={`th text-center w-10 ${sun ? 'text-rose-400' : ''}`}>{d.getDate()}<div className="text-[9px] font-normal text-slate-400">{d.toLocaleDateString('en-IN', { weekday: 'narrow' })}</div></th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((e) => {
                    const joinStr = ymd(e.joiningDate);
                    return (
                    <tr key={e.id} className="group">
                      <td className="td sticky left-0 bg-white dark:bg-slate-900 z-10 min-w-[180px]">
                        <div className="flex items-center gap-2"><div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300 grid place-items-center text-xs font-semibold">{e.name[0]}</div><div><div className="text-sm font-medium">{e.name}</div><div className="text-xs text-slate-400">{e.empCode}</div></div></div>
                      </td>
                      {data.days.map((dstr) => {
                        const row = data.attendance[e.id]?.[dstr];
                        const beforeJoin = dstr < joinStr;
                        return (
                          <td key={dstr} className="p-0.5 text-center">
                            <button onClick={() => canEdit && !beforeJoin && openCell(e, dstr)} disabled={!canEdit || beforeJoin} title={beforeJoin ? 'Before joining date' : row?.otHours ? `${row.otHours} OT hrs` : ''} className={`h-9 w-9 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center leading-none ${row ? CODE_TONE[row.code] : 'bg-slate-50 dark:bg-slate-800/40 text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'} ${beforeJoin ? 'opacity-30 cursor-not-allowed' : canEdit ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}>
                              <span>{row ? row.code[0] : '·'}</span>
                              {row?.otHours ? <span className="text-[7px] font-bold opacity-90">{row.otHours}h</span> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal open={!!cell} onClose={() => setCell(null)} title={cell ? `${cell.emp.name} · ${new Date(cell.date + 'T00:00:00').toLocaleDateString('en-IN')}` : ''}>
        {cell && (
          <form onSubmit={save} className="space-y-3">
            <Field label="Attendance code"><div className="flex flex-wrap gap-1.5">{CODES.map((c) => <button type="button" key={c} onClick={() => { set('code', c); if (c !== 'OT') set('otHours', 0); }} className={`h-9 w-9 rounded-lg text-xs font-bold ${form.code === c ? CODE_TONE[c] + ' ring-2 ring-offset-1 ring-brand-500 dark:ring-offset-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{c}</button>)}</div></Field>
            <div className="grid grid-cols-2 gap-3">
              {form.code === 'OT' && <Field label="OT hours"><input type="number" step="0.5" className="input" value={form.otHours} onChange={(e) => set('otHours', e.target.value)} /></Field>}
              <Field label="Advance (₹)"><input type="number" className="input" value={form.advance} onChange={(e) => set('advance', e.target.value)} /></Field>
              <Field label="Bonus (₹)"><input type="number" className="input" value={form.bonus} onChange={(e) => set('bonus', e.target.value)} /></Field>
              <Field label="Travel (₹)"><input type="number" className="input" value={form.travel} onChange={(e) => set('travel', e.target.value)} /></Field>
              <Field label="Food (₹)"><input type="number" className="input" value={form.food} onChange={(e) => set('food', e.target.value)} /></Field>
              <Field label="Fine (₹)"><input type="number" className="input" value={form.fine} onChange={(e) => set('fine', e.target.value)} /></Field>
              <Field label="Other allowance (₹)"><input type="number" className="input" value={form.otherAllowance} onChange={(e) => set('otherAllowance', e.target.value)} /></Field>
            </div>
            <Field label="Remarks"><input className="input" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} /></Field>
            <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={() => setCell(null)} className="btn-ghost">Cancel</button><button className="btn-primary">Save</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}