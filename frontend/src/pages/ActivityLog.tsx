import { useEffect, useState, useCallback } from 'react';
import { History, Download, List, Activity } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, useToast } from '../components/ui';
import type { AuditLog } from '../types';

const MODULES = ['Employee', 'Project', 'Allocation', 'Attendance', 'Payroll', 'User'];
const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE'];
const ACT_TONE: Record<string, any> = { CREATE: 'green', UPDATE: 'brand', DELETE: 'rose', ARCHIVE: 'amber', RESTORE: 'brand' };

export default function ActivityLogPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'timeline'>('table');
  const [f, setF] = useState({ module: '', action: '', page: 1 });
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: '100', page: String(f.page) });
    if (f.module) p.set('module', f.module);
    if (f.action) p.set('action', f.action);
    const res: any = await http.get(`/activity?${p}`);
    setRows(res.data); setTotal(res.total); setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v, page: k === 'page' ? v : 1 }));
  const csv = () => {
    const cols = ['createdAt', 'userName', 'module', 'action', 'entity', 'entityId', 'ip'];
    const lines = [cols.join(',')];
    for (const r of rows) lines.push(cols.map((c) => (r as any)[c] ?? '').join(','));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'activity-log.csv'; a.click(); URL.revokeObjectURL(url);
    toast('Exported');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><History size={22} /> Activity Logs</h1><p className="text-sm text-slate-400">{total} entries · immutable audit trail of every change</p></div>
        <div className="flex gap-2">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button onClick={() => setView('table')} className={`px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-1 ${view === 'table' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-500'}`}><List size={14} /> Table</button>
            <button onClick={() => setView('timeline')} className={`px-2.5 py-1.5 rounded-lg text-sm flex items-center gap-1 ${view === 'timeline' ? 'bg-white dark:bg-slate-900 shadow' : 'text-slate-500'}`}><Activity size={14} /> Timeline</button>
          </div>
          <button onClick={csv} className="btn-ghost"><Download size={14} /> CSV</button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <select className="input w-auto" value={f.module} onChange={(e) => set('module', e.target.value)}><option value="">All modules</option>{MODULES.map((m) => <option key={m}>{m}</option>)}</select>
          <select className="input w-auto" value={f.action} onChange={(e) => set('action', e.target.value)}><option value="">All actions</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</select>
          {(f.module || f.action) && <button onClick={() => setF({ module: '', action: '', page: 1 })} className="btn-ghost text-xs">Clear</button>}
        </div>

        {loading ? <Spinner /> : !rows.length ? <Empty msg="No activity matches" /> : view === 'table' ? (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[760px]">
            <thead><tr>{['When', 'User', 'Module', 'Action', 'Record', 'IP', 'Detail'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td text-xs text-slate-400 whitespace-nowrap">{new Date(r.createdAt).toLocaleString('en-IN')}</td>
                <td className="td font-medium">{r.userName || 'system'}</td>
                <td className="td">{r.module}</td>
                <td className="td"><Badge tone={ACT_TONE[r.action]}>{r.action}</Badge></td>
                <td className="td font-mono text-xs">{r.entityId || '—'}</td>
                <td className="td text-xs text-slate-400">{r.ip || '—'}</td>
                <td className="td text-xs text-slate-500 max-w-[260px] truncate">{detail(r)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : (
          <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-3 pl-4 max-h-[65vh] overflow-y-auto">
            {rows.map((r) => (
              <li key={r.id} className="relative">
                <span className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${r.action === 'DELETE' ? 'bg-rose-500' : r.action === 'CREATE' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                <div className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString('en-IN')} · {r.userName || 'system'}</div>
                <div className="text-sm"><Badge tone={ACT_TONE[r.action]}>{r.action}</Badge> <span className="font-medium">{r.module}</span> #{r.entityId}</div>
                <div className="text-xs text-slate-500 mt-0.5">{detail(r)}</div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function detail(r: AuditLog): string {
  if (r.action === 'UPDATE' && r.oldValue && r.newValue) {
    const keys = [...new Set([...Object.keys(r.oldValue), ...Object.keys(r.newValue)])].filter((k) => k !== 'updatedAt');
    const changes = keys.filter((k) => JSON.stringify((r.oldValue as any)[k]) !== JSON.stringify((r.newValue as any)[k])).map((k) => `${k}: ${s((r.oldValue as any)[k])}→${s((r.newValue as any)[k])}`);
    return changes.slice(0, 4).join(', ') || 'metadata changed';
  }
  if (r.action === 'CREATE') return 'record created';
  if (r.action === 'DELETE') return 'record deleted';
  return r.reason || `${r.entity} changed`;
}
const s = (v: any) => (v == null ? '∅' : typeof v === 'object' ? '…' : String(v).slice(0, 16));