import { create } from 'zustand';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  userRole: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  initialize: () => void;
}

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function fetchUserRole(user: User, accessToken?: string): Promise<string> {
  const fallbackRole =
    (user.app_metadata?.role as string) ||
    (user.user_metadata?.role as string) ||
    'admin';

  // Se o papel já estiver definido no metadata do token JWT, usa imediatamente sem bloquear
  const metaRole = (user.app_metadata?.role as string) || (user.user_metadata?.role as string);
  if (metaRole && ['admin', 'operator', 'partner', 'advertiser'].includes(metaRole)) {
    return metaRole;
  }

  // Busca direta via REST com AbortController (evita chamar supabase.auth.getSession() dentro de locks do GoTrue)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const token = accessToken || supabaseAnonKey;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?select=role,org_id&id=eq.${encodeURIComponent(user.id)}`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.role) {
        return rows[0].role;
      }

      // Se não existir linha em public.users, cria em background sem bloquear o login
      const orgId = (user.user_metadata?.org_id as string) || DEFAULT_ORG_ID;
      const name =
        (user.user_metadata?.name as string) ||
        (user.email ? user.email.split('@')[0] : 'Usuário');

      fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates',
        },
        body: JSON.stringify({
          id: user.id,
          org_id: orgId,
          email: user.email || '',
          name,
          role: fallbackRole,
        }),
      }).catch(() => {});
    }

    return fallbackRole;
  } catch {
    return fallbackRole;
  }
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  userRole: null,
  loading: true,
  signIn: async (email, password) => {
    try {
      // Limpa sessões antigas ou travadas no localStorage antes de autenticar
      try {
        localStorage.removeItem('@is_mock_session');
        localStorage.removeItem('@mock_email');
        localStorage.removeItem('sb-prlhdjpzflgjtlmknhps-auth-token');
      } catch {}

      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      // Fallback amigável caso o usuário digite a senha temporária de teste '123456' ou sem maiúscula
      if (error && (cleanPassword === '123456' || cleanPassword.toLowerCase() === 'elevate@2026')) {
        const retry = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: 'Elevate@2026',
        });
        if (!retry.error && retry.data?.user) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        console.error('[Auth] SignIn error:', error.message);
        set({ loading: false });
        return { error: error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message };
      }

      if (!data?.user) {
        set({ loading: false });
        return { error: 'Credenciais inválidas.' };
      }

      const role = await fetchUserRole(data.user, data.session?.access_token);
      set({ user: data.user, userRole: role, loading: false });
      return { error: null };
    } catch (err: any) {
      console.error('[Auth] Exception:', err);
      set({ loading: false });
      return { error: err?.message || 'Erro ao conectar ao servidor.' };
    }
  },
  signOut: async () => {
    try {
      localStorage.removeItem('@is_mock_session');
      localStorage.removeItem('@mock_email');
      localStorage.removeItem('sb-tdbruykbguiojwzrjzik-auth-token');
    } catch {}
    try {
      await supabase.auth.signOut();
    } catch {}
    set({ user: null, userRole: null, loading: false });
  },
  initialize: () => {
    // Limpa chave legada se existir
    try {
      localStorage.removeItem('sb-prlhdjpzflgjtlmknhps-auth-token');
    } catch {}

    // Tenta restaurar sessão ativa com timeout de 3s
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 3000)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(async ({ data: { session } }: any) => {
        if (session?.user) {
          const role = await fetchUserRole(session.user, session.access_token);
          set({ user: session.user, userRole: role, loading: false });
        } else {
          set({ user: null, userRole: null, loading: false });
        }
      })
      .catch(() => {
        set({ user: null, userRole: null, loading: false });
      });

    // Sincroniza mudanças de sessão em tempo real sem bloquear o lock interno do GoTrueClient
    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          set({ user: null, userRole: null, loading: false });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const fastRole =
            (session.user.app_metadata?.role as string) ||
            (session.user.user_metadata?.role as string) ||
            null;
          if (fastRole) {
            set({ user: session.user, userRole: fastRole, loading: false });
          } else {
            setTimeout(async () => {
              const role = await fetchUserRole(session.user, session.access_token);
              set({ user: session.user, userRole: role, loading: false });
            }, 0);
          }
        }
      });
      authSubscription = data?.subscription || null;
    }
  },
}));
