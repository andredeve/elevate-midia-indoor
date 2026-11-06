import { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import {
  LayoutDashboard,
  MonitorPlay,
  ListVideo,
  Image as ImageIcon,
  LogOut,
  Menu,
  X,
  CreditCard,
  Store,
  Building2,
  ShieldCheck,
  Briefcase,
  Inbox,
  Sun,
  Moon,
  Wallet
} from 'lucide-react';

const ROUTE_TITLES: Record<string, { group: string; label: string }> = {
  '/dashboard': { group: 'Operação', label: 'Visão Geral' },
  '/terminals': { group: 'Operação', label: 'Terminais' },
  '/media': { group: 'Operação', label: 'Biblioteca de Mídias' },
  '/playlists': { group: 'Operação', label: 'Playlists' },
  '/media-approval': { group: 'Operação', label: 'Moderação de Mídias' },
  '/leads': { group: 'Comercial & Rede', label: 'Solicitações VIP' },
  '/partners': { group: 'Comercial & Rede', label: 'Parceiros' },
  '/advertisers': { group: 'Comercial & Rede', label: 'Anunciantes' },
  '/billing': { group: 'Comercial & Rede', label: 'Faturamento' },
  '/partner/dashboard': { group: 'Parceiro', label: 'Visão Geral' },
  '/partner/media': { group: 'Parceiro', label: 'Minhas Mídias' },
  '/partner/advertisers': { group: 'Parceiro', label: 'Anunciantes Indicados' },
  '/partner/commissions': { group: 'Parceiro', label: 'Comissões & Repasses' },
  '/advertiser/dashboard': { group: 'Anunciante', label: 'Desempenho & Mídias' },
  '/advertiser/invoices': { group: 'Anunciante', label: 'Faturas' }
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  partner: 'Parceiro',
  advertiser: 'Anunciante'
};

export default function Layout() {
  const { signOut, user, userRole } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Administrador';
  const initial = displayName.charAt(0).toUpperCase();
  const roleLabel = (userRole && ROLE_LABELS[userRole]) || 'Administrador';

  const currentRoute = ROUTE_TITLES[location.pathname] || {
    group: 'Painel',
    label: 'Workspace'
  };

  return (
    <div className="app-container">
      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Link
              to={userRole === 'partner' ? '/partner/dashboard' : userRole === 'advertiser' ? '/advertiser/dashboard' : '/dashboard'}
              title="Início"
              onClick={closeSidebar}
            >
              <img
                src={theme === 'dark' ? '/logo-dark.png' : '/logo-light.png'}
                alt="Elevate Mídia Indoor"
              />
            </Link>
          </div>
          <button
            className="sidebar-close"
            onClick={closeSidebar}
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {/* Admin & Operator Links */}
          {(userRole === 'admin' || userRole === 'operator') && (
            <>
              <span className="nav-section-label">Operação</span>

              <NavLink
                to="/dashboard"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                end
                onClick={closeSidebar}
              >
                <LayoutDashboard size={16} strokeWidth={1.75} />
                <span>Visão Geral</span>
              </NavLink>

              <NavLink
                to="/terminals"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <MonitorPlay size={16} strokeWidth={1.75} />
                <span>Terminais</span>
              </NavLink>

              <NavLink
                to="/media"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <ImageIcon size={16} strokeWidth={1.75} />
                <span>Biblioteca de Mídias</span>
              </NavLink>

              <NavLink
                to="/playlists"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <ListVideo size={16} strokeWidth={1.75} />
                <span>Playlists</span>
              </NavLink>

              <NavLink
                to="/media-approval"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <ShieldCheck size={16} strokeWidth={1.75} />
                <span>Moderação</span>
              </NavLink>

              <span className="nav-section-label">Comercial & Rede</span>

              <NavLink
                to="/leads"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <Inbox size={16} strokeWidth={1.75} />
                <span>Solicitações VIP</span>
              </NavLink>

              {userRole === 'admin' && (
                <>
                  <NavLink
                    to="/partners"
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                    onClick={closeSidebar}
                  >
                    <Building2 size={16} strokeWidth={1.75} />
                    <span>Parceiros</span>
                  </NavLink>

                  <NavLink
                    to="/advertisers"
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                    onClick={closeSidebar}
                  >
                    <Briefcase size={16} strokeWidth={1.75} />
                    <span>Anunciantes</span>
                  </NavLink>

                  <NavLink
                    to="/billing"
                    className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                    onClick={closeSidebar}
                  >
                    <CreditCard size={16} strokeWidth={1.75} />
                    <span>Faturamento</span>
                  </NavLink>
                </>
              )}
            </>
          )}

          {/* Partner Links */}
          {userRole === 'partner' && (
            <>
              <span className="nav-section-label">Portal do Parceiro</span>
              <NavLink
                to="/partner/dashboard"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                end
                onClick={closeSidebar}
              >
                <Store size={16} strokeWidth={1.75} />
                <span>Meu Painel</span>
              </NavLink>
              <NavLink
                to="/partner/media"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <ImageIcon size={16} strokeWidth={1.75} />
                <span>Minhas Mídias</span>
              </NavLink>
              <NavLink
                to="/partner/advertisers"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <Briefcase size={16} strokeWidth={1.75} />
                <span>Anunciantes Indicados</span>
              </NavLink>
              <NavLink
                to="/partner/commissions"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <Wallet size={16} strokeWidth={1.75} />
                <span>Comissões</span>
              </NavLink>
            </>
          )}

          {/* Advertiser Links */}
          {userRole === 'advertiser' && (
            <>
              <span className="nav-section-label">Portal do Anunciante</span>
              <NavLink
                to="/advertiser/dashboard"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                end
                onClick={closeSidebar}
              >
                <LayoutDashboard size={16} strokeWidth={1.75} />
                <span>Desempenho & Mídias</span>
              </NavLink>
              <a
                href="/advertiser/dashboard#midias"
                className="nav-item"
                onClick={closeSidebar}
              >
                <ImageIcon size={16} strokeWidth={1.75} />
                <span>Minhas Mídias</span>
              </a>
              <NavLink
                to="/advertiser/invoices"
                className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                onClick={closeSidebar}
              >
                <CreditCard size={16} strokeWidth={1.75} />
                <span>Minhas Faturas</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-account">
            <div className="sidebar-account-info">
              <div className="user-avatar">{initial}</div>
              <div className="sidebar-account-meta">
                <span className="sidebar-account-name" title={user?.email || displayName}>
                  {displayName}
                </span>
                <span className="sidebar-account-role">{roleLabel}</span>
              </div>
            </div>
            <button
              onClick={signOut}
              className="icon-btn"
              title="Encerrar sessão"
              aria-label="Sair"
            >
              <LogOut size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={toggleSidebar}
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>

            <nav className="breadcrumb" aria-label="Breadcrumb">
              <span>{currentRoute.group}</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-current">{currentRoute.label}</span>
            </nav>
          </div>

          <div className="topbar-right">
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

            <div className="system-status-pill" title="Sincronização em tempo real ativa">
              <span className="status-dot online" />
              <span>Rede ativa</span>
            </div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-shell fade-up" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
