// ==============================================================================
// PlantãoPS - Página de Login e Autenticação (Item 2.1 & 3.3)
// ==============================================================================

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../domain/types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleRedirectMap: Record<UserRole, string> = {
    recepcao: '/recepcao',
    enfermagem: '/triagem',
    medico: '/medico',
    gestao: '/gestao',
    painel: '/painel',
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // O hook atualiza o profile; vamos verificar a role para redirecionar
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        // Redireciona baseado no email
        if (email.includes('recepcao')) navigate('/recepcao');
        else if (email.includes('enfermagem')) navigate('/triagem');
        else if (email.includes('medico')) navigate('/medico');
        else if (email.includes('gestao')) navigate('/gestao');
        else if (email.includes('painel')) navigate('/painel');
        else navigate('/fila');
      }
    } catch (err: any) {
      console.error('Falha no login:', err);
      setErrorMsg(err.message || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillQuickCredentials = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('senha123');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          maxWidth: '440px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '3rem' }}>🏥</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '8px 0 4px 0' }}>
            PlantãoPS
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
            Cada minuto conta! Acesso ao sistema hospitalar
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '12px',
              backgroundColor: '#fee2e2',
              border: '1px solid #f87171',
              color: '#b91c1c',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '0.875rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              E-mail do Funcionário
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@plantaops.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Senha de Acesso
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.95rem',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              marginTop: '8px',
            }}
          >
            {isSubmitting ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Atalhos de Demonstração / Usuários de Teste */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '8px' }}>
            Contas de Teste por Perfil:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              onClick={() => fillQuickCredentials('recepcao@plantaops.com')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Recepção
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('enfermagem@plantaops.com')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Enfermagem
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('medico@plantaops.com')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Médico
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('gestao@plantaops.com')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Gestão
            </button>
            <button
              type="button"
              onClick={() => fillQuickCredentials('painel@plantaops.com')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer' }}
            >
              Painel TV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
