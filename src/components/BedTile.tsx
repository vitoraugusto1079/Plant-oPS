import React, { useState } from 'react';
import { Bed, BedStatus } from '../domain/types';

export interface BedTileProps {
  bed: Bed;
  onDropPatient?: (bedId: string, encounterId: string) => void;
  onCleanBed?: (bedId: string) => void;
  canClean?: boolean;
  className?: string;
}

const BED_STATUS_CONFIG: Record<
  BedStatus,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  livre: {
    label: 'Livre',
    bg: '#e6f5ef',
    border: '#10b981',
    text: '#065f46',
    icon: '🟢',
  },
  ocupado: {
    label: 'Ocupado',
    bg: '#eff6ff',
    border: '#00995d',
    text: '#1e40af',
    icon: '🔴',
  },
  em_limpeza: {
    label: 'Em Limpeza',
    bg: '#fffbeb',
    border: '#f59e0b',
    text: '#92400e',
    icon: '🧹',
  },
  bloqueado: {
    label: 'Bloqueado',
    bg: '#f3f4f6',
    border: '#9ca3af',
    text: '#4b5563',
    icon: '⛔',
  },
};

export const BedTile: React.FC<BedTileProps> = ({
  bed,
  onDropPatient,
  onCleanBed,
  canClean = false,
  className = '',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const config = BED_STATUS_CONFIG[bed.status] || BED_STATUS_CONFIG.livre;
  const assignment = bed.current_assignment;
  const patient = assignment?.encounter?.patient;

  const handleDragOver = (e: React.DragEvent) => {
    if (bed.status === 'livre') {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const encounterId = e.dataTransfer.getData('text/plain');
    if (encounterId && onDropPatient && bed.status === 'livre') {
      onDropPatient(bed.id, encounterId);
    }
  };

  return (
    <div
      role="region"
      aria-label={`Leito ${bed.name}, Ala ${bed.ward}, Status ${config.label}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '14px',
        borderRadius: '8px',
        backgroundColor: isDragOver ? '#dbeafe' : config.bg,
        border: isDragOver ? '2px dashed #2563eb' : `2px solid ${config.border}`,
        minHeight: '130px',
        transition: 'all 0.2s ease',
      }}
      className={className}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '1rem', color: '#0a5f55' }}>{bed.name}</strong>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: '#ffffff',
              color: config.text,
              border: `1px solid ${config.border}`,
            }}
          >
            {config.icon} {config.label}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
          Ala: {bed.ward}
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        {bed.status === 'ocupado' && assignment ? (
          <div style={{ fontSize: '0.85rem', color: config.text }}>
            <div>
              <strong>Senha:</strong> {assignment.encounter?.ticket_number}
            </div>
            <div>
              <strong>Paciente:</strong> {patient?.name || 'Carregando...'}
            </div>
          </div>
        ) : bed.status === 'livre' ? (
          <div style={{ fontSize: '0.8rem', color: '#00995d', fontStyle: 'italic' }}>
            Arraste um paciente aqui para alocar
          </div>
        ) : bed.status === 'em_limpeza' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: '#92400e' }}>Aguardando higienização</span>
            {canClean && onCleanBed && (
              <button
                type="button"
                onClick={() => onCleanBed(bed.id)}
                style={{
                  padding: '4px 10px',
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Liberar Leito
              </button>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Indisponível</div>
        )}
      </div>
    </div>
  );
};
