// ==============================================================================
// PlantãoPS - Componente: QueueItem (Item 3.2 & 2.4)
// Item da fila de atendimento exibindo dados vitais, tempo de espera e alertas
// ==============================================================================

import React from 'react';
import { Encounter } from '../domain/types';
import { calculateAge, hasAgePriority, isOverdue } from '../domain/queue';
import { RiskBadge } from './RiskBadge';
import { WaitTimer } from './WaitTimer';

export interface QueueItemProps {
  encounter: Encounter;
  isNext?: boolean;
  onCall?: (encounter: Encounter) => void;
  onSelect?: (encounter: Encounter) => void;
  showActions?: boolean;
  className?: string;
}

export const QueueItem: React.FC<QueueItemProps> = ({
  encounter,
  isNext = false,
  onCall,
  onSelect,
  showActions = false,
  className = '',
}) => {
  const patient = encounter.patient;
  const age = patient?.birth_date ? calculateAge(patient.birth_date) : null;
  const agePriority = patient?.birth_date ? hasAgePriority(patient.birth_date) : false;
  const overdue = encounter.triaged_at
    ? isOverdue(encounter.triaged_at, encounter.priority_color)
    : false;

  const chiefComplaint =
    encounter.triages && encounter.triages.length > 0
      ? encounter.triages[encounter.triages.length - 1].chief_complaint
      : 'Não informada';

  return (
    <div
      role="article"
      tabIndex={0}
      aria-label={`Senha ${encounter.ticket_number}, Paciente ${patient?.name || 'Desconhecido'}, Classificação ${encounter.priority_color || 'Pendente'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: overdue ? '#fff1f2' : '#ffffff',
        border: overdue
          ? '2px solid #f43f5e'
          : isNext
          ? '2px solid #3b82f6'
          : '1px solid #e5e7eb',
        boxShadow: isNext ? '0 4px 6px -1px rgba(0, 153, 93, 0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
      }}
      className={className}
      onClick={() => onSelect && onSelect(encounter)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0a5f55',
              letterSpacing: '0.05em',
            }}
          >
            {encounter.ticket_number}
          </span>
          {isNext && (
            <span
              style={{
                backgroundColor: '#00995d',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              PRÓXIMO DA FILA
            </span>
          )}
          {agePriority && (
            <span
              style={{
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid #fcd34d',
              }}
            >
              ⭐ Prioridade Legal ({age !== null && age >= 60 ? 'Idoso' : 'Criança'})
            </span>
          )}
        </div>

        <RiskBadge color={encounter.priority_color} showPriority={true} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#0a5f55' }}>
            {patient?.name || 'Paciente sem nome'}
          </span>
          {age !== null && (
            <span style={{ marginLeft: '6px', color: '#64748b', fontSize: '0.9rem' }}>
              ({age} anos)
            </span>
          )}
        </div>

        {encounter.triaged_at && (
          <WaitTimer triagedAt={encounter.triaged_at} color={encounter.priority_color} />
        )}
      </div>

      <div style={{ fontSize: '0.9rem', color: '#475569', backgroundColor: '#f4f7f6', padding: '6px 10px', borderRadius: '4px' }}>
        <strong>Queixa:</strong> {chiefComplaint}
      </div>

      {showActions && onCall && (
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCall(encounter);
            }}
            style={{
              padding: '6px 14px',
              backgroundColor: '#00995d',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Chamar Paciente
          </button>
        </div>
      )}
    </div>
  );
};
