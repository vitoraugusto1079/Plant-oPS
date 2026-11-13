import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const MainLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleLabels: Record<string, string> = {
    recepcao: 'Recepção',
    enfermagem: 'Enfermagem',
    medico: 'Médico',
    gestao: 'Gestão Hospitalar',
    painel: 'Painel da TV',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f4f7f6' }}>
      <header
        style={{
          backgroundColor: '#0a5f55',
          color: '#ffffff',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link to="/" style={{ textDecoration: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🏥</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
              PlantãoPS
            </span>
          </Link>

          <nav style={{ display: 'flex', gap: '14px', fontSize: '0.95rem' }}>
            {profile?.role === 'recepcao' && (
              <>
                <Link to="/recepcao" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Recepção / Pacientes
                </Link>
              </>
            )}

            {profile?.role === 'enfermagem' && (
              <>
                <Link to="/triagem" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Triagem
                </Link>
                <Link to="/fila" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Fila de Espera
                </Link>
                <Link to="/leitos" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Mapa de Leitos
                </Link>
              </>
            )}

            {profile?.role === 'medico' && (
              <>
                <Link to="/medico" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Consultório / Atendimento
                </Link>
                <Link to="/fila" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Fila de Pacientes
                </Link>
                <Link to="/leitos" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Leitos
                </Link>
              </>
            )}

            {profile?.role === 'gestao' && (
              <>
                <Link to="/gestao" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Indicadores de Gestão
                </Link>
                <Link to="/fila" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Fila Geral
                </Link>
                <Link to="/leitos" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>
                  Status dos Leitos
                </Link>
              </>
            )}

            <Link
              to="/painel"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fde047', textDecoration: 'none', fontWeight: 600 }}
              title="Abrir painel de TV em nova aba"
            >
              📺 Painel TV
            </Link>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 700 }}>{profile?.name}</div>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: '#334155',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#cbd5e1',
              }}
            >
              {profile?.role ? roleLabels[profile.role] : 'Carregando...'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
};
