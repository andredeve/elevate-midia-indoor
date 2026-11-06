import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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

async function fetchUserRole(user: User): Promise<string> {
  const fallbackRole =
    (user.app_metadata?.role as string) ||
    (user.user_metadata?.role as string) ||
    'admin';

  // Se o papel já estiver definido no metadata do token JWT, usa imediatamente sem bloquear no banco
  const metaRole = (user.app_metadata?.role as string) || (user.user_metadata?.role as string);
  if (metaRole && ['admin', 'operator', 'partner', 'advertiser'].includes(metaRole)) {
    return metaRole;
  }

  try {
    const queryPromise = supabase
      .from('users')
      .select('role, org_id')
      .eq('id', user.id)
      .single();

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2500)
    );

    const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

    if (data?.role) {
      return data.role;
    }

    // Se o usuário existe no Auth mas ainda não possui linha em public.users, cria em background
    if (error && error.message !== 'timeout') {
      const orgId = (user.user_metadata?.org_id as string) || DEFAULT_ORG_ID;
      const name =
        (user.user_metadata?.name as string) ||
        (user.email ? user.email.split('@')[0] : 'Usuário');

      supabase.from('users').insert({
        id: user.id,
        org_id: orgId,
        email: user.email || '',
        name,
        role: fallbackRole,
      }).then(() => {});
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
      // Limpa sessão mock antes de tentar login real
      try {
        localStorage.removeItem('@is_mock_session');
        localStorage.removeItem('@mock_email');
      } catch {}

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('[Auth] SignIn error:', error.message);
        return { error: error.message };
      }

      if (!data?.user) {
        return { error: 'Credenciais inválidas.' };
      }

      console.log('[Auth] Login OK, fetching role...');
      const role = await fetchUserRole(data.user);
      console.log('[Auth] Role:', role);

      set({ user: data.user, userRole: role, loading: false });
      return { error: null };
    } catch (err: any) {
      console.error('[Auth] Exception:', err);
      return { error: err.message || 'Erro ao conectar ao servidor.' };
    }
  },
  signOut: async () => {
    try {
      localStorage.removeItem('@is_mock_session');
      localStorage.removeItem('@mock_email');
    } catch {}
    await supabase.auth.signOut();
    set({ user: null, userRole: null, loading: false });
  },
  initialize: () => {
    // Tenta restaurar sessão ativa com timeout de 3s
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => 
      setTimeout(() => resolve({ data: { session: null } }), 3000)
    );

    Promise.race([sessionPromise, timeoutPromise])
      .then(async ({ data: { session } }: any) => {
        if (session?.user) {
          const role = await fetchUserRole(session.user);
          set({ user: session.user, userRole: role, loading: false });
        } else {
          set({ user: null, userRole: null, loading: false });
        }
      })
      .catch(() => {
        set({ user: null, userRole: null, loading: false });
      });

    // Sincroniza mudanças de sessão do Supabase Auth em tempo real (sem async direto para não travar o lock interno do Supabase v2)
    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          set({ user: null, userRole: null, loading: false });
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setTimeout(async () => {
            const role = await fetchUserRole(session.user);
            set({ user: session.user, userRole: role, loading: false });
          }, 0);
        }
      });
      authSubscription = data?.subscription || null;
    }
  },
}));
