import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser { id: number; email: string; name: string; role: 'ADMIN' | 'OPS' | 'ACCOUNTS'; }

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'sasyantra-auth' },
  ),
);

interface ThemeState { dark: boolean; toggle: () => void; set: (d: boolean) => void; }
export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      dark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
      toggle: () => set((s) => ({ dark: !s.dark })),
      set: (d) => set({ dark: d }),
    }),
    { name: 'sasyantra-theme' },
  ),
);

// apply the class whenever dark changes
useTheme.subscribe((s) => {
  const root = document.documentElement;
  if (s.dark) root.classList.add('dark'); else root.classList.remove('dark');
});
// apply once on load
if (useTheme.getState().dark) document.documentElement.classList.add('dark');