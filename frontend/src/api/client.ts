// Minimal fetch wrapper — no axios. Token from zustand auth store.
import { useAuth } from '../store';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = useAuth.getState().token;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as any) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    if (res.status === 401) useAuth.getState().logout();
    throw new ApiError(res.status, data?.message || res.statusText || 'Request failed');
  }
  return data as T;
}
function safeJson(t: string) { try { return JSON.parse(t); } catch { return t; } }

export const http = {
  get: <T = any>(p: string) => api<T>(p),
  post: <T = any>(p: string, body?: any) => api<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(p: string, body?: any) => api<T>(p, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T = any>(p: string) => api<T>(p, { method: 'DELETE' }),
};