import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { ArrowRight, AlertCircle, Sun, Moon } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, userRole } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  // Redireciona para a página correta baseada no papel
  const getHomeRoute = (role: string | null) => {
    switch (role) {
      case 'partner':
        return '/partner/dashboard';
      case 'advertiser':
        return '/advertiser/dashboard';
      default:
        return '/dashboard';
    }
  };

  // Se já estiver logado, redireciona para o painel
  useEffect(() => {
    if (user && userRole) {
      navigate(getHomeRoute(userRole), { replace: true });
    }
  }, [user, userRole, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        setError(signInError || 'Credenciais inválidas. Tente novamente.');
        setLoading(false);
      }
      // Se deu certo, o useEffect ali em cima vai perceber a mudança do 'user' e redirecionar
    } catch {
      setError('Erro inesperado. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10 }}>
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} strokeWidth={1.75} />
              <span>Claro</span>
            </>
          ) : (
            <>
              <Moon size={14} strokeWidth={1.75} />
              <span>Escuro</span>
            </>
          )}
        </button>
      </div>

      <div className="auth-card fade-up">
        <div className="auth-logo-wrap">
          <img
            src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
            alt="Elevate Mídia Indoor"
          />
        </div>
        <h1 className="auth-title">Acessar Painel</h1>
        <p className="auth-subtitle">Insira suas credenciais corporativas para continuar</p>

        {error && (
          <div className="alert-error" style={{ marginBottom: 16 }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 6 }}
            disabled={loading}
          >
            {loading ? (
              <div className="loader" />
            ) : (
              <>
                <span>Entrar</span>
                <ArrowRight size={15} strokeWidth={2} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
