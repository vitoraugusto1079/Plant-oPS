import React, { useState, useEffect } from 'react';
import { TriageColor } from '../domain/types';
import { getWaitMinutes, isOverdue } from '../domain/queue';
import { RISK_CONFIG } from '../domain/triage';

export interface WaitTimerProps {
  triagedAt: string | Date;
  color?: TriageColor | null;
  className?: string;
}

export const WaitTimer: React.FC<WaitTimerProps> = ({
  triagedAt,
  color,
  className = '',
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const waitedMinutes = getWaitMinutes(triagedAt, now);
  const overdue = isOverdue(triagedAt, color, now);
  const maxWait = color ? RISK_CONFIG[color]?.maxWaitMinutes ?? 0 : null;

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}min`;
    }
    return `${mins} min`;
  };

  return (
    <div
      role="timer"
      aria-label={`Tempo de espera: ${formatTime(waitedMinutes)}. ${overdue ? 'Atenção: Prazo de espera ultrapassado!' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '4px',
        fontWeight: 600,
        fontSize: '0.85rem',
        backgroundColor: overdue ? '#fee2e2' : '#f3f4f6',
        color: overdue ? '#b91c1c' : '#374151',
        border: overdue ? '2px solid #ef4444' : '1px solid #d1d5db',
        animation: overdue ? 'pulse 2s infinite' : 'none',
      }}
      className={className}
    >
      <span aria-hidden="true">{overdue ? '⚠️' : '⏱️'}</span>
      <span>
        Espera: <strong>{formatTime(waitedMinutes)}</strong>
      </span>
      {maxWait !== null && (
        <span style={{ fontSize: '0.8em', opacity: 0.85 }}>
          / {maxWait === 0 ? 'Imediato' : `${maxWait}min máx.`}
        </span>
      )}
      {overdue && (
        <span
          style={{
            backgroundColor: '#dc2626',
            color: '#ffffff',
            padding: '1px 5px',
            borderRadius: '3px',
            fontSize: '0.75rem',
            marginLeft: '4px',
            fontWeight: 700,
          }}
        >
          ATRASADO!
        </span>
      )}
    </div>
  );
};
