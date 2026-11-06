import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'admin' | 'operator' | 'partner' | 'advertiser'>;
}

export default function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { user, userRole, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loader"></div>
      </div>
    );
  }

  if (!user || !userRole) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole as any)) {
    // If not allowed, redirect to a safe default page based on their role
    if (userRole === 'partner') return <Navigate to="/partner/dashboard" replace />;
    if (userRole === 'advertiser') return <Navigate to="/advertiser/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
