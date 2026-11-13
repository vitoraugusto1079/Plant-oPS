// ==============================================================================
// PlantãoPS - Configuração de Rotas e Providers (React Router & TanStack Query)
// ==============================================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { KioskLayout } from './layouts/KioskLayout';
import { LoginPage } from './pages/LoginPage';
import { ReceptionPage } from './pages/ReceptionPage';
import { TriagePage } from './pages/TriagePage';
import { QueuePage } from './pages/QueuePage';
import { DoctorPage } from './pages/DoctorPage';
import { BedMapPage } from './pages/BedMapPage';
import { ManagementPage } from './pages/ManagementPage';
import { KioskPanelPage } from './pages/KioskPanelPage';
import { EncounterDetailPage } from './pages/EncounterDetailPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { useAuth } from './hooks/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const HomeRedirect: React.FC = () => {
  const { profile, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando PlantãoPS...</div>;
  }

  if (!isAuthenticated || !profile) {
    return <Navigate to="/login" replace />;
  }

  const roleMap: Record<string, string> = {
    recepcao: '/recepcao',
    enfermagem: '/triagem',
    medico: '/medico',
    gestao: '/gestao',
    painel: '/painel',
  };

  return <Navigate to={roleMap[profile.role] || '/login'} replace />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Rota Pública de Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rota Raiz com Redirecionamento por Perfil */}
          <Route path="/" element={<HomeRedirect />} />

          {/* Rota Quiosque para TV da Sala de Espera (Sem Menus) */}
          <Route element={<KioskLayout />}>
            <Route path="/painel" element={<KioskPanelPage />} />
          </Route>

          {/* Rotas Protegidas no Layout Principal */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Recepção */}
            <Route
              path="/recepcao"
              element={
                <ProtectedRoute allowedRoles={['recepcao']}>
                  <ReceptionPage />
                </ProtectedRoute>
              }
            />

            {/* Enfermagem */}
            <Route
              path="/triagem"
              element={
                <ProtectedRoute allowedRoles={['enfermagem']}>
                  <TriagePage />
                </ProtectedRoute>
              }
            />

            {/* Fila Geral */}
            <Route
              path="/fila"
              element={
                <ProtectedRoute allowedRoles={['enfermagem', 'medico', 'gestao']}>
                  <QueuePage />
                </ProtectedRoute>
              }
            />

            {/* Médico */}
            <Route
              path="/medico"
              element={
                <ProtectedRoute allowedRoles={['medico']}>
                  <DoctorPage />
                </ProtectedRoute>
              }
            />

            {/* Mapa de Leitos */}
            <Route
              path="/leitos"
              element={
                <ProtectedRoute allowedRoles={['enfermagem', 'medico', 'gestao']}>
                  <BedMapPage />
                </ProtectedRoute>
              }
            />

            {/* Gestão */}
            <Route
              path="/gestao"
              element={
                <ProtectedRoute allowedRoles={['gestao']}>
                  <ManagementPage />
                </ProtectedRoute>
              }
            />

            {/* Rotas com Parâmetros */}
            <Route
              path="/atendimentos/:id"
              element={
                <ProtectedRoute allowedRoles={['recepcao', 'enfermagem', 'medico', 'gestao']}>
                  <EncounterDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pacientes/:id"
              element={
                <ProtectedRoute allowedRoles={['recepcao', 'enfermagem', 'medico', 'gestao']}>
                  <PatientDetailPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 Página Não Encontrada */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
