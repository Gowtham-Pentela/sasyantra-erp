import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText, Paperclip } from 'lucide-react';
import { http } from '../api/client';
import { Card, Badge, Spinner, Empty, useToast } from '../components/ui';
import { useAuth } from '../store';

interface Doc { id: number; entity: string; entityId: number; fileName: string; originalName: string; mimeType: string; size: number; url: string; createdAt: string; uploadedBy?: { name: string } | null; }

export default function Documents() {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'ADMIN' || role === 'OPS' || role === 'ACCOUNTS';
  const [rows, setRows] = useState<Doc[]>([]);
  const [entity, setEntity] = useState('Employee');
  const [entityId, setEntityId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (entity) params.set('entity', entity);
    if (entityId) params.set('entityId', entityId);
    http.get<Doc[]>(`/documents${params.size ? `?${params}` : ''}`).then(setRows).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [entity, entityId]);

  const onFile = async (file: File) => {
    if (!entityId) return toast('Enter an entity ID to attach the file to', 'err');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = useAuth.getState().token;
      const res = await fetch(`/api/documents?entity=${entity}&entityId=${entityId}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      if (!res.ok) throw new Error((await res.json()).message || 'Upload failed');
      toast('Uploaded');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const remove = async (d: Doc) => { if (!confirm(`Delete ${d.originalName}?`)) return; try { await http.del(`/documents/${d.id}`); toast('Deleted'); load(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Documents</h1><p className="text-sm text-slate-400">Attach files to any record (Employee / Project / Client / Invoice)</p></div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={entity} onChange={(e) => setEntity(e.target.value)}><option>Employee</option><option>Project</option><option>Client</option><option>Invoice</option></select>
          <input className="input w-28" type="number" placeholder="ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          {canEdit && (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary"><Upload size={14} /> {busy ? 'Uploading…' : 'Upload'}</button>
            </>
          )}
        </div>
      </div>

      {loading ? <Spinner /> : !rows.length ? <Card><Empty msg={`No documents${entityId ? ` for ${entity} #${entityId}` : ''}`} /></Card> : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr>{['', 'Name', 'Type', 'Size', 'Attached to', 'Uploaded by', 'Date', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="td"><Paperclip size={14} className="text-slate-400" /></td>
                <td className="td font-medium"><a href={d.url} target="_blank" className="hover:text-brand-600 flex items-center gap-1.5"><FileText size={13} className="text-slate-400" />{d.originalName}</a></td>
                <td className="td text-slate-400 text-xs">{d.mimeType}</td>
                <td className="td text-slate-400">{(d.size / 1024).toFixed(1)} KB</td>
                <td className="td"><Badge>{d.entity} #{d.entityId}</Badge></td>
                <td className="td text-slate-400">{d.uploadedBy?.name ?? '—'}</td>
                <td className="td text-slate-400">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                <td className="td text-right">{role === 'ADMIN' && <button onClick={() => remove(d)} className="btn-ghost !py-1 !px-2 text-rose-600"><Trash2 size={13} /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      <div className="text-xs text-slate-400">Files are stored locally on the server (<code>/uploads</code>) and served at <code>/uploads/…</code>. ponytail: S3 is the upgrade path.</div>
    </div>
  );
}