import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Briefcase, Users, CalendarCheck, Wallet, Building2, FileText,
  ClipboardList, Receipt, IndianRupee, TrendingDown, BarChart3, PieChart, History,
  Folder, Settings as SettingsIcon, Search, Moon, Sun, LogOut, Boxes, Menu, PiggyBank,
} from 'lucide-react';
import { useAuth, useTheme } from '../store';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, live: true, end: true },
  { to: '/projects', label: 'Projects', icon: Briefcase, live: true },
  { to: '/employees', label: 'Employees', icon: Users, live: true },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, live: true },
  { to: '/payroll', label: 'Payroll', icon: Wallet, live: true },
  { to: '/budget', label: 'Budget', icon: PiggyBank, live: true },
  { to: '/allocations', label: 'Allocation', icon: ClipboardList, live: true },
  { to: '/clients', label: 'Clients', icon: Building2, live: false },
  { to: '/quotations', label: 'Quotations', icon: FileText, live: false },
  { to: '/work-orders', label: 'Work Orders', icon: ClipboardList, live: false },
  { to: '/invoices', label: 'Invoices', icon: Receipt, live: true },
  { to: '/payments', label: 'Payments', icon: IndianRupee, live: true },
  { to: '/expenses', label: 'Expenses', icon: TrendingDown, live: true },
  { to: '/reports', label: 'Reports', icon: BarChart3, live: false },
  { to: '/analytics', label: 'Analytics', icon: PieChart, live: false },
  { to: '/activity', label: 'Activity Logs', icon: History, live: true },
  { to: '/documents', label: 'Documents', icon: Folder, live: false },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, live: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const doSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    // universal search: route to employees list with query (extend later)
    nav(`/employees?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="flex h-full">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-4">
        <div className="flex items-center gap-2 px-2 mb-5">
          <div className="h-9 w-9 rounded-xl bg-brand-600 grid place-items-center text-white"><Boxes size={20} /></div>
          <div>
            <div className="font-semibold leading-tight">Sasyantra</div>
            <div className="text-[10px] text-slate-400 leading-tight">Manpower Ops ERP</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto space-y-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
              <n.icon size={18} />
              <span className="flex-1">{n.label}</span>
              {!n.live && <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600" title="next iteration" />}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="glass sticky top-0 z-30 flex items-center gap-3 px-4 py-3">
          <button className="md:hidden btn-ghost !p-2" onClick={() => setMenuOpen(true)}><Menu size={18} /></button>
          <form onSubmit={doSearch} className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employees…  (press /)" className="input pl-9" />
          </form>
          <div className="flex-1" />
          <button onClick={toggle} className="btn-ghost !p-2" title="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="h-8 w-8 rounded-full bg-brand-600 grid place-items-center text-white text-sm font-semibold">{user?.name?.[0] ?? 'A'}</div>
            <div className="hidden sm:block leading-tight">
              <div className="text-sm font-medium">{user?.name}</div>
              <div className="text-[10px] text-slate-400">{user?.role}</div>
            </div>
            <button onClick={() => { logout(); nav('/login'); }} className="btn-ghost !p-2" title="Sign out"><LogOut size={16} /></button>
          </div>
        </header>

        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-slate-950/40" onClick={() => setMenuOpen(false)}>
            <div className="w-64 h-full bg-white dark:bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}>
                  <n.icon size={18} /><span>{n.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}