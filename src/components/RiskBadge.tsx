import React from 'react';
import { TriageColor } from '../domain/types';
import { RISK_CONFIG } from '../domain/triage';

export interface RiskBadgeProps {
  color?: TriageColor | null;
  showPriority?: boolean;
  showMaxWait?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  color,
  showPriority = true,
  showMaxWait = false,
  size = 'md',
  className = '',
}) => {
  if (!color) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: '#e5e7eb',
          color: '#374151',
          fontSize: '0.85rem',
          fontWeight: 600,
        }}
        className={className}
      >
        Não classificado
      </span>
    );
  }

  const config = RISK_CONFIG[color] || {
    priority: color,
    maxWaitMinutes: 0,
    hex: '#6b7280',
  };

  const padding = size === 'sm' ? '2px 6px' : size === 'lg' ? '6px 14px' : '4px 10px';
  const fontSize = size === 'sm' ? '0.75rem' : size === 'lg' ? '1.1rem' : '0.875rem';

  return (
    <span
      role="status"
      aria-label={`Classificação de risco ${color}: ${config.priority}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        borderRadius: '6px',
        backgroundColor: `${config.hex}22`,
        color: config.hex,
        border: `1.5px solid ${config.hex}`,
        fontSize,
        fontWeight: 700,
        lineHeight: 1.2,
      }}
      className={className}
    >
      <span
        aria-hidden="true"
        style={{
          width: size === 'sm' ? '8px' : '10px',
          height: size === 'sm' ? '8px' : '10px',
          borderRadius: '50%',
          backgroundColor: config.hex,
          display: 'inline-block',
        }}
      />
      <span>{color}</span>
      {showPriority && (
        <span style={{ fontWeight: 500, opacity: 0.9 }}>
          - {config.priority}
        </span>
      )}
      {showMaxWait && (
        <span style={{ fontSize: '0.75em', opacity: 0.8 }}>
          ({config.maxWaitMinutes === 0 ? 'Imediato' : `Máx. ${config.maxWaitMinutes}min`})
        </span>
      )}
    </span>
  );
};
