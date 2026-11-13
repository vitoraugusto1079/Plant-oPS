// ==============================================================================
// PlantãoPS - Página da Fila de Atendimento em Tempo Real (Item 2.4)
// Ordenação por prioridade clínica, tempo e desempate etário; filtros por cor
// ==============================================================================

import React from 'react';
import { useQueue } from '../hooks/useQueue';
import { QueueItem } from '../components/QueueItem';
import { TriageColor } from '../domain/types';
import { RISK_CONFIG } from '../domain/triage';

export const QueuePage: React.FC = () => {
  const {
    queue,
    totalPatients,
    colorCounts,
    selectedColorFilter,
    setColorFilter,
    isLoading,
    isError,
    error,
  } = useQueue();

  const colorOptions: (TriageColor | 'TODAS')[] = [
    'TODAS',
    'Vermelho',
    'Laranja',
    'Amarelo',
    'Verde',
    'Azul',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0' }}>
            Fila de Atendimento Médico (Tempo Real)
          </h1>
          <p style={{ color: '#64748b', margin: 0 }}>
            Pacientes triados ordenados rigorosamente por gravidade clínica (Vermelho primeiro), tempo de espera e prioridade legal.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
            Total na fila: {totalPatients}
          </span>
        </div>
      </div>

      {/* Barra de Filtros por Cor e Indicadores de Quantidade */}
      <div
        role="group"
        aria-label="Filtro por classificação de risco"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '12px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        {colorOptions.map((opt) => {
          const isSelected = selectedColorFilter === opt;
          const count = opt === 'TODAS' ? totalPatients : colorCounts[opt];
          const config = opt !== 'TODAS' ? RISK_CONFIG[opt] : null;

          return (
            <button
              key={opt}
              type="button"
              onClick={() => setColorFilter(opt)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: isSelected ? '2px solid #0f172a' : '1px solid #cbd5e1',
                backgroundColor: isSelected ? '#0f172a' : '#f8fafc',
                color: isSelected ? '#ffffff' : '#334155',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {config && (
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: config.hex,
                    display: 'inline-block',
                  }}
                />
              )}
              <span>{opt}</span>
              <span
                style={{
                  backgroundColor: isSelected ? '#334155' : '#e2e8f0',
                  color: isSelected ? '#f8fafc' : '#1e293b',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  fontSize: '0.75rem',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista da Fila Ordenada */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          Carregando fila em tempo real...
        </div>
      ) : isError ? (
        <div style={{ padding: '16px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px' }}>
          Erro ao sincronizar fila: {(error as any)?.message}
        </div>
      ) : queue.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
          }}
        >
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>🎉</span>
          <h3 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>Nenhum paciente aguardando</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Não há pacientes com o filtro selecionado no momento.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {queue.map((encounter, index) => (
            <QueueItem
              key={encounter.id}
              encounter={encounter}
              isNext={index === 0 && selectedColorFilter === 'TODAS'}
            />
          ))}
        </div>
      )}
    </div>
  );
};
