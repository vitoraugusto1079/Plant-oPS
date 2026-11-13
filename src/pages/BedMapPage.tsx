import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bedService } from '../services/bedService';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { BedTile } from '../components/BedTile';
import { RiskBadge } from '../components/RiskBadge';
import { useAuth } from '../hooks/useAuth';
import { Encounter } from '../domain/types';

export const BedMapPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [draggedEncounterId, setDraggedEncounterId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: beds = [], isLoading: isLoadingBeds } = useQuery({
    queryKey: ['beds-map'],
    queryFn: () => bedService.listBeds(),
    refetchInterval: 10000,
  });

  const { data: awaitingPatients = [], isLoading: isLoadingAwaiting } = useQuery({
    queryKey: ['patients-awaiting-bed'],
    queryFn: () => bedService.getPatientsAwaitingBed(),
  });

  useRealtimeTable('beds', 'beds-map');
  useRealtimeTable('bed_assignments', 'beds-map');
  useRealtimeTable('encounters', 'patients-awaiting-bed');

  const assignBedMutation = useMutation({
    mutationFn: async ({ bedId, encounterId }: { bedId: string; encounterId: string }) => {
      await bedService.assignBed(encounterId, bedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds-map'] });
      queryClient.invalidateQueries({ queryKey: ['patients-awaiting-bed'] });
      setFeedback({ type: 'success', text: 'Paciente alocado no leito com sucesso!' });
      setDraggedEncounterId(null);
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', text: `Bloqueio concorrente: ${err.message}` });
      setDraggedEncounterId(null);
    },
  });

  const cleanBedMutation = useMutation({
    mutationFn: async (bedId: string) => {
      await bedService.cleanBed(bedId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beds-map'] });
      setFeedback({ type: 'success', text: 'Leito higienizado e liberado para novo uso!' });
    },
    onError: (err: any) => {
      setFeedback({ type: 'error', text: `Falha ao liberar leito: ${err.message}` });
    },
  });

  const handleDragStart = (e: React.DragEvent, encounterId: string) => {
    e.dataTransfer.setData('text/plain', encounterId);
    setDraggedEncounterId(encounterId);
  };

  const handleDropOnBed = (bedId: string, encounterId: string) => {
    setFeedback(null);
    assignBedMutation.mutate({ bedId, encounterId });
  };

  const redWardBeds = beds.filter((b) => b.ward === 'Sala Vermelha');
  const obsWardBeds = beds.filter((b) => b.ward === 'Observação');

  const canClean = profile?.role === 'enfermagem' || profile?.role === 'medico';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a5f55', margin: '0 0 6px 0' }}>
          Mapa de Leitos e Internação Hospitalar
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Gerenciamento em tempo real das alas Sala Vermelha e Observação. Arraste pacientes aguardando leito para vagas livres.
        </p>
      </div>

      {feedback && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontWeight: 700,
          }}
        >
          {feedback.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) 1fr', gap: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0a5f55', margin: '0 0 8px 0' }}>
            Aguardando Leito ({awaitingPatients.length})
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 12px 0' }}>
            Pacientes com conduta de Observação ou Internação que precisam de vaga.
          </p>

          {isLoadingAwaiting ? (
            <p style={{ color: '#64748b' }}>Carregando pacientes...</p>
          ) : awaitingPatients.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
              Nenhum paciente aguardando leito.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {awaitingPatients.map((enc) => (
                <div
                  key={enc.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, enc.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#f4f7f6',
                    border: '1px solid #cbd5e1',
                    cursor: 'grab',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0a5f55' }}>{enc.ticket_number}</strong>
                    <RiskBadge color={enc.priority_color} size="sm" showPriority={false} />
                  </div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem', marginTop: '4px' }}>
                    {enc.patient?.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Destino: {enc.destination}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#00995d', marginTop: '4px', fontWeight: 600 }}>
                    ↔️ Arraste para um leito livre
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.25rem' }}>🚨</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b91c1c', margin: 0 }}>
                Ala: Sala Vermelha (Emergência Crítica)
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {redWardBeds.map((bed) => (
                <BedTile
                  key={bed.id}
                  bed={bed}
                  canClean={canClean}
                  onDropPatient={handleDropOnBed}
                  onCleanBed={(id) => cleanBedMutation.mutate(id)}
                />
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.25rem' }}>🛏️</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e3a8a', margin: 0 }}>
                Ala: Observação Clínica
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {obsWardBeds.map((bed) => (
                <BedTile
                  key={bed.id}
                  bed={bed}
                  canClean={canClean}
                  onDropPatient={handleDropOnBed}
                  onCleanBed={(id) => cleanBedMutation.mutate(id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
