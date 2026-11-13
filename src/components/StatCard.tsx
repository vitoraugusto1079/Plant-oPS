// ==============================================================================
// PlantãoPS - Componente: StatCard (Item 3.2 & 2.8)
// Card de indicadores chave para o Painel da Gestão
// ==============================================================================

import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  alert?: boolean;
  icon?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  alert = false,
  icon,
  className = '',
}) => {
  return (
    <div
      role="region"
      aria-label={`Indicador ${title}: ${value}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: alert ? '#fef2f2' : '#ffffff',
        border: alert ? '2px solid #ef4444' : '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
      className={className}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: alert ? '#991b1b' : '#64748b' }}>
          {title}
        </span>
        {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      </div>

      <div
        style={{
          fontSize: '1.875rem',
          fontWeight: 800,
          color: alert ? '#b91c1c' : '#0a5f55',
          marginTop: '8px',
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.8rem', color: alert ? '#b91c1c' : '#64748b', marginTop: '6px' }}>
          {subtitle}
        </span>
      )}
    </div>
  );
};
