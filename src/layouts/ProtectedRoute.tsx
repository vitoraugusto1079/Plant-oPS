import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../domain/types';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { profile, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Carregando permissões...</p>
      </div>
    );
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    const roleRoutes: Record<UserRole, string> = {
      recepcao: '/recepcao',
      enfermagem: '/triagem',
      medico: '/medico',
      gestao: '/gestao',
      painel: '/painel',
    };

    return <Navigate to={roleRoutes[profile.role] || '/login'} replace />;
  }

  return <>{children}</>;
};
