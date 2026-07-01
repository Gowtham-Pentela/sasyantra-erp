import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectWorkspace from './pages/ProjectWorkspace';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Payroll from './pages/Payroll';
import Allocations from './pages/Allocations';
import ActivityLog from './pages/ActivityLog';
import Budget from './pages/Budget';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import Stub from './pages/Stub';

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuth((s) => s.token);
  const loc = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

const STUBS: Record<string, string> = {
  '/clients': 'Clients', '/quotations': 'Quotations', '/work-orders': 'Work Orders',
  '/reports': 'Reports', '/analytics': 'Analytics', '/documents': 'Documents',
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Layout /></Protected>}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectWorkspace />} />
          <Route path="employees" element={<Employees />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="allocations" element={<Allocations />} />
          <Route path="budget" element={<Budget />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="payments" element={<Payments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="activity" element={<ActivityLog />} />
          {Object.entries(STUBS).map(([p, label]) => (
            <Route key={p} path={p.slice(1)} element={<Stub label={label} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}