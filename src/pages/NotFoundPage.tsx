// ==============================================================================
// PlantãoPS - Página 404 Não Encontrado (Item 3.3)
// ==============================================================================

import React from 'react';
import { Link } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <span style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</span>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0a5f55', margin: '0 0 8px 0' }}>
        404 - Página Não Encontrada
      </h1>
      <p style={{ color: '#64748b', maxWidth: '480px', margin: '0 0 24px 0', fontSize: '1rem' }}>
        O endereço solicitado não existe ou você não possui permissão para acessá-lo.
      </p>
      <Link
        to="/"
        style={{
          padding: '10px 20px',
          backgroundColor: '#00995d',
          color: '#ffffff',
          fontWeight: 700,
          borderRadius: '6px',
          textDecoration: 'none',
        }}
      >
        Voltar ao Início
      </Link>
    </div>
  );
};
