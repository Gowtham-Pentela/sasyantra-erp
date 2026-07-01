import { Rocket } from 'lucide-react';

export default function Stub({ label }: { label: string }) {
  return (
    <div className="grid place-items-center h-full">
      <div className="card p-10 text-center max-w-md">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 dark:bg-brand-950 grid place-items-center text-brand-600 dark:text-brand-300 mb-4"><Rocket size={26} /></div>
        <h2 className="text-xl font-semibold">{label}</h2>
        <p className="text-sm text-slate-400 mt-2">
          This module is scaffolded for the next iteration. The data model, API and audit
          machinery are already in place — only the screens remain to be built.
        </p>
        <div className="mt-4 inline-flex chip bg-slate-100 dark:bg-slate-800 text-slate-500">Part of the upgrade path</div>
      </div>
    </div>
  );
}