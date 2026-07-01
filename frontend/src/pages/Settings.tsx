import { useEffect, useState } from 'react';
import { Plus, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Modal, Field, Spinner, Empty, useToast } from '../components/ui';
import { useAuth } from '../store';

interface User { id: number; email: string; name: string; role: string; createdAt: string; }

export default function Settings() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState(false);
  const [reset, setReset] = useState<User | null>(null);
  const toast = useToast();
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'ADMIN' });
  const [pwd, setPwd] = useState('');

  const load = () => { setLoading(true); http.get<User[]>('/users').then(setUsers).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.email || !form.name || !form.password) return toast('Fill all fields', 'err');
    setBusy(true);
    try { await http.post('/users', form); toast('User created'); setAdd(false); setForm({ email: '', name: '', password: '', role: 'ADMIN' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const doReset = async () => {
    if (!reset || !pwd) return toast('Enter new password', 'err');
    setBusy(true);
    try { await http.put(`/users/${reset.id}`, { password: pwd }); toast('Password reset'); setReset(null); setPwd(''); }
    catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async (u: User) => {
    if (!confirm(`Delete ${u.email}?`)) return;
    try { await http.del(`/users/${u.id}`); toast('User deleted'); load(); }
    catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Settings · Users</h1><p className="text-sm text-slate-400">Grant other emails admin access · ADMIN-only</p></div>
        <button onClick={() => setAdd(true)} className="btn-primary"><Plus size={14} /> Add user</button>
      </div>

      {loading ? <Spinner /> : !users.length ? <Card><Empty msg="No users" /></Card> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr>{['Name', 'Email', 'Role', 'Created', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td font-medium">{u.name}{u.id === me?.id && <span className="text-xs text-slate-400 ml-2">(you)</span>}</td>
                <td className="td text-slate-400">{u.email}</td>
                <td className="td"><Badge tone={u.role === 'ADMIN' ? 'brand' : 'slate'}><ShieldCheck size={12} className="inline mr-1" />{u.role}</Badge></td>
                <td className="td text-slate-400">{new Date(u.createdAt).toLocaleDateString('en-IN')}</td>
                <td className="td text-right">
                  <button onClick={() => setReset(u)} className="btn-ghost !py-1 !px-2 text-xs"><KeyRound size={12} className="inline mr-1" />Reset</button>
                  <button onClick={() => remove(u)} disabled={u.id === me?.id} className="btn-ghost !py-1 !px-2 text-xs text-rose-600 disabled:opacity-40"><Trash2 size={12} className="inline" /></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Modal open={add} onClose={() => setAdd(false)} title="Add user">
        <div className="space-y-3">
          <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password"><input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Role"><select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>ADMIN</option><option>OPS</option><option>ACCOUNTS</option></select></Field>
          </div>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setAdd(false)} className="btn-ghost">Cancel</button><button onClick={create} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Create user'}</button></div>
        </div>
      </Modal>

      <Modal open={!!reset} onClose={() => setReset(null)} title={`Reset password · ${reset?.email ?? ''}`}>
        <div className="space-y-3">
          <Field label="New password"><input type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setReset(null)} className="btn-ghost">Cancel</button><button onClick={doReset} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Reset'}</button></div>
        </div>
      </Modal>
    </div>
  );
}