import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import OptinPage from './pages/OptinPage';
import './pages/LandingPage.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminals from './pages/Terminals';
import MediaLibrary from './pages/MediaLibrary';
import Playlists from './pages/Playlists';
import RoleRoute from './components/RoleRoute';

// Parceiro Pages
import PartnerDashboard from './pages/PartnerDashboard';
import PartnerMedia from './pages/PartnerMedia';
import PartnerAdvertisers from './pages/PartnerAdvertisers';
import PartnerCommissions from './pages/PartnerCommissions';

// Advertiser Pages
import AdvertiserDashboard from './pages/AdvertiserDashboard';
import AdvertiserInvoices from './pages/AdvertiserInvoices';

// Admin extra pages
import PartnerManagement from './pages/PartnerManagement';
import AdvertiserManagement from './pages/AdvertiserManagement';
import MediaApproval from './pages/MediaApproval';
import Billing from './pages/Billing';
import LeadsManagement from './pages/LeadsManagement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Rotas Públicas */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/teste-gratis" element={<OptinPage />} />
        <Route path="/3-meses-gratis" element={<OptinPage />} />
        <Route path="/migracao" element={<OptinPage />} />
        <Route path="/login" element={<Login />} />
        
        {/* Rotas Protegidas (Painel Web) */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          {/* Admin e Operator Routes */}
          <Route path="/dashboard" element={<RoleRoute allowedRoles={['admin', 'operator']}><Dashboard /></RoleRoute>} />
          <Route path="/terminals" element={<RoleRoute allowedRoles={['admin', 'operator']}><Terminals /></RoleRoute>} />
          <Route path="/media" element={<RoleRoute allowedRoles={['admin', 'operator']}><MediaLibrary /></RoleRoute>} />
          <Route path="/playlists" element={<RoleRoute allowedRoles={['admin', 'operator']}><Playlists /></RoleRoute>} />
          
          <Route path="/partners" element={<RoleRoute allowedRoles={['admin']}><PartnerManagement /></RoleRoute>} />
          <Route path="/advertisers" element={<RoleRoute allowedRoles={['admin']}><AdvertiserManagement /></RoleRoute>} />
          <Route path="/media-approval" element={<RoleRoute allowedRoles={['admin', 'operator']}><MediaApproval /></RoleRoute>} />
          <Route path="/billing" element={<RoleRoute allowedRoles={['admin']}><Billing /></RoleRoute>} />
          <Route path="/leads" element={<RoleRoute allowedRoles={['admin', 'operator']}><LeadsManagement /></RoleRoute>} />

          {/* Partner Routes */}
          <Route path="/partner/dashboard" element={<RoleRoute allowedRoles={['partner']}><PartnerDashboard /></RoleRoute>} />
          <Route path="/partner/media" element={<RoleRoute allowedRoles={['partner']}><PartnerMedia /></RoleRoute>} />
          <Route path="/partner/advertisers" element={<RoleRoute allowedRoles={['partner']}><PartnerAdvertisers /></RoleRoute>} />
          <Route path="/partner/commissions" element={<RoleRoute allowedRoles={['partner']}><PartnerCommissions /></RoleRoute>} />

          {/* Advertiser Routes */}
          <Route path="/advertiser/dashboard" element={<RoleRoute allowedRoles={['advertiser', 'admin']}><AdvertiserDashboard /></RoleRoute>} />
          <Route path="/advertiser/invoices" element={<RoleRoute allowedRoles={['advertiser', 'admin']}><AdvertiserInvoices /></RoleRoute>} />
        </Route>

        {/* Rota de fallback - redireciona caminhos desconhecidos para a Landing Page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
