import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Boxes, LogIn } from 'lucide-react';
import { http } from '../api/client';
import { useAuth } from '../store';

export default function Login() {
  const [email, setEmail] = useState('admin@sasyantra.in');
  const [password, setPassword] = useState('admin123');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const nav = useNavigate();
  const loc = useLocation() as any;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res: any = await http.post('/auth/login', { email, password });
      setAuth(res.accessToken, res.user);
      nav(loc.state?.from?.pathname || '/');
    } catch (e: any) {
      setErr(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-900 text-white relative overflow-hidden">
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="flex items-center gap-3 relative">
          <div className="h-11 w-11 rounded-2xl bg-white/15 grid place-items-center"><Boxes size={24} /></div>
          <div>
            <div className="text-xl font-semibold">Sasyantra Integrated Systems</div>
            <div className="text-sm text-white/70">Manpower Operations ERP</div>
          </div>
        </div>
        <div className="relative space-y-3 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">The operating system for manpower supply.</h1>
          <p className="text-white/80">Employees, projects, attendance, payroll and an immutable audit trail — in one fast, modern console.</p>
        </div>
        <div className="text-xs text-white/50 relative">Built for administrators · {new Date().getFullYear()}</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="card p-7 w-full max-w-sm">
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="text-sm text-slate-400 mt-1">Use your administrator account.</p>
          <div className="mt-5 space-y-3">
            <div><label className="label">Email</label><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
            <div><label className="label">Password</label><input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {err && <div className="text-sm text-rose-600">{err}</div>}
            <button disabled={busy} className="btn-primary w-full justify-center"><LogIn size={16} /> {busy ? 'Signing in…' : 'Sign in'}</button>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              Seeded logins — password <code className="font-mono">admin123</code>:
              <div className="mt-1 grid gap-1">
                <code>admin@sasyantra.in</code><code>ops@sasyantra.in</code><code>accounts@sasyantra.in</code>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}