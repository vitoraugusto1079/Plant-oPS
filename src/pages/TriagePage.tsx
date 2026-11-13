import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encounterService } from '../services/encounterService';
import { useRealtimeTable } from '../hooks/useRealtimeTable';
import { Encounter, TriageColor, VitalSigns } from '../domain/types';
import { VitalSignsForm } from '../components/VitalSignsForm';
import { RiskBadge } from '../components/RiskBadge';
import { calculateAge } from '../domain/queue';

export const TriagePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [isReclassifying, setIsReclassifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: waitingTriage = [], isLoading: isLoadingWaiting } = useQuery({
    queryKey: ['waiting-triage'],
    queryFn: () => encounterService.getWaitingTriage(),
  });

  const { data: waitingDoctor = [] } = useQuery({
    queryKey: ['doctor-queue'],
    queryFn: () => encounterService.getWaitingDoctorQueue(),
  });

  useRealtimeTable('encounters', 'waiting-triage');
  useRealtimeTable('triages', 'waiting-triage');
  useRealtimeTable('encounters', 'doctor-queue');

  const saveTriageMutation = useMutation({
    mutationFn: async (params: {
      vitals: VitalSigns;
      suggestedColor: TriageColor;
      finalColor: TriageColor;
      justification?: string;
    }) => {
      if (!selectedEncounter) throw new Error('Nenhum atendimento selecionado.');
      return await encounterService.saveTriage({
        encounterId: selectedEncounter.id,
        vitals: params.vitals,
        suggestedColor: params.suggestedColor,
        finalColor: params.finalColor,
        justification: params.justification,
      });
    },
    onSuccess: (updatedEncounter) => {
      queryClient.invalidateQueries({ queryKey: ['waiting-triage'] });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      setStatusMessage({
        type: 'success',
        text: `Triagem concluída com sucesso para a senha ${selectedEncounter?.ticket_number}! Classificação: ${updatedEncounter.priority_color}.`,
      });
      setSelectedEncounter(null);
      setIsReclassifying(false);
    },
    onError: (err: any) => {
      setStatusMessage({
        type: 'error',
        text: `Falha ao salvar triagem: ${err.message}`,
      });
    },
  });

  const handleStartTriage = (encounter: Encounter, isReclass: boolean = false) => {
    setStatusMessage(null);
    setSelectedEncounter(encounter);
    setIsReclassifying(isReclass);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a5f55', margin: '0 0 8px 0' }}>
          Triagem e Classificação de Risco (Manchester Simplificado)
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Avaliação clínica dos sinais vitais, cálculo automático de prioridade e reclassificação.
        </p>
      </div>

      {statusMessage && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: statusMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: statusMessage.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${statusMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontWeight: 600,
          }}
        >
          {statusMessage.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 14px 0', color: '#0a5f55' }}>
              Pacientes Aguardando Triagem ({waitingTriage.length})
            </h2>

            {isLoadingWaiting ? (
              <p style={{ color: '#64748b' }}>Carregando fila de triagem...</p>
            ) : waitingTriage.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                Nenhum paciente aguardando triagem no momento.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                {waitingTriage.map((enc) => {
                  const isSelected = selectedEncounter?.id === enc.id && !isReclassifying;
                  const age = enc.patient?.birth_date ? calculateAge(enc.patient.birth_date) : null;
                  return (
                    <div
                      key={enc.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '6px',
                        border: isSelected ? '2px solid #059669' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#e6f5ef' : '#f4f7f6',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0a5f55' }}>
                            {enc.ticket_number}
                          </span>
                          <strong style={{ color: '#0a5f55' }}>{enc.patient?.name}</strong>
                          {age !== null && <span style={{ color: '#64748b', fontSize: '0.85rem' }}>({age} anos)</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          Chegada: {new Date(enc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleStartTriage(enc, false)}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: '#00995d',
                          color: '#ffffff',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Iniciar Triagem
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 10px 0', color: '#0a5f55' }}>
              Reclassificar Paciente na Fila ({waitingDoctor.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 12px 0' }}>
              Se o estado clínico de um paciente que já está aguardando médico piorou ou mudou, reclassifique-o aqui.
            </p>

            {waitingDoctor.length === 0 ? (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                Nenhum paciente na fila médica para reclassificar.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {waitingDoctor.map((enc) => (
                  <div
                    key={enc.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ marginRight: '6px' }}>{enc.ticket_number}</strong>
                      <span>{enc.patient?.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RiskBadge color={enc.priority_color} size="sm" showPriority={false} />
                      <button
                        type="button"
                        onClick={() => handleStartTriage(enc, true)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.75rem',
                          backgroundColor: '#f59e0b',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reclassificar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          {selectedEncounter ? (
            <div>
              <div style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>Atendimento em Avaliação:</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#14532d' }}>
                    {selectedEncounter.ticket_number} - {selectedEncounter.patient?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedEncounter(null)}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                </div>
                {selectedEncounter.patient?.allergies && selectedEncounter.patient.allergies.length > 0 && (
                  <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#b91c1c' }}>
                    <strong>⚠️ Alergias do paciente:</strong>{' '}
                    {selectedEncounter.patient.allergies.map((a) => a.allergen_name).join(', ')}
                  </div>
                )}
              </div>

              <VitalSignsForm
                isReclassification={isReclassifying}
                isSubmitting={saveTriageMutation.isPending}
                onSubmitTriage={(vitals, suggestedColor, finalColor, justification) => {
                  saveTriageMutation.mutate({
                    vitals,
                    suggestedColor,
                    finalColor,
                    justification,
                  });
                }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
              <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>🩺</span>
              <h3 style={{ margin: '0 0 8px 0', color: '#0a5f55' }}>Selecione um paciente</h3>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>
                Escolha um paciente na lista ao lado para iniciar a medição dos sinais vitais e classificação de risco.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
