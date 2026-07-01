import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export const inr = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

export const inr2 = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card p-5 animate-fadein ${className}`}>{children}</div>;
}

export function KpiCard({ label, value, sub, tone = 'brand', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'brand' | 'green' | 'amber' | 'rose' | 'slate'; icon?: ReactNode }) {
  const tones: Record<string, string> = {
    brand: 'from-brand-500/10 to-brand-500/0 text-brand-600 dark:text-brand-300',
    green: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 dark:text-emerald-300',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600 dark:text-amber-300',
    rose: 'from-rose-500/10 to-rose-500/0 text-rose-600 dark:text-rose-300',
    slate: 'from-slate-500/10 to-slate-500/0 text-slate-600 dark:text-slate-300',
  };
  return (
    <div className="card p-4 relative overflow-hidden animate-fadein">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl opacity-70`} />
      <div className="flex items-start justify-between relative">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
          <div className="text-2xl font-semibold mt-1 tracking-tight">{value}</div>
          {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
        </div>
        {icon && <div className={`rounded-xl p-2 bg-gradient-to-br ${tones[tone]}`}>{icon}</div>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'green' | 'amber' | 'rose' | 'brand' | 'slate' }) {
  const tones: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function Spinner() {
  return <div className="h-6 w-6 rounded-full border-2 border-slate-300 border-t-brand-600 animate-spin mx-auto my-8" />;
}

export function Empty({ msg }: { msg: string }) {
  return <div className="text-center text-sm text-slate-400 py-12">{msg}</div>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} p-0 animate-fadein`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
}

export function useToast() {
  return (msg: string, tone: 'ok' | 'err' = 'ok') => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className = `fixed bottom-5 right-5 z-[60] px-4 py-2.5 rounded-xl text-sm font-medium shadow-float animate-fadein ${tone === 'ok' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-rose-600 text-white'}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  };
}