import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { encounterService } from '../services/encounterService';
import { medicationService } from '../services/medicationService';
import { RiskBadge } from '../components/RiskBadge';
import { calculateAge } from '../domain/queue';

export const EncounterDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: encounter, isLoading, isError, error } = useQuery({
    queryKey: ['encounter-detail', id],
    queryFn: () => (id ? encounterService.getEncounterById(id) : null),
    enabled: !!id,
  });

  const { data: prescriptions = [] } = useQuery({
    queryKey: ['encounter-prescriptions', id],
    queryFn: () => (id ? medicationService.getPrescriptionsByEncounter(id) : []),
    enabled: !!id,
  });

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando detalhes do atendimento...</div>;
  }

  if (isError || !encounter) {
    return (
      <div style={{ padding: '24px', backgroundColor: '#fee2e2', borderRadius: '8px', color: '#b91c1c' }}>
        Erro ao carregar atendimento: {(error as any)?.message || 'Atendimento não encontrado'}
      </div>
    );
  }

  const patient = encounter.patient;
  const age = patient?.birth_date ? calculateAge(patient.birth_date) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Atendimento:</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a5f55', margin: '2px 0 0 0' }}>
            Senha {encounter.ticket_number} - {patient?.name}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RiskBadge color={encounter.priority_color} size="lg" />
          <span
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: '#e2e8f0',
              color: '#0a5f55',
              fontWeight: 700,
            }}
          >
            {encounter.status}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0a5f55' }}>
            Identificação do Paciente
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem' }}>
            <div><strong>Nome:</strong> {patient?.name}</div>
            <div><strong>Idade:</strong> {age !== null ? `${age} anos` : 'Não informada'} (Nasc.: {patient?.birth_date})</div>
            <div><strong>Sexo:</strong> {patient?.gender}</div>
            <div><strong>Telefone:</strong> {patient?.phone || 'Não informado'}</div>
            {patient?.allergies && patient.allergies.length > 0 && (
              <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px', color: '#dc2626', fontWeight: 600 }}>
                ⚠️ Alergias Conhecidas: {patient.allergies.map((a) => a.allergen_name).join(', ')}
              </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0a5f55' }}>
            Linha do Tempo das Etapas
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
            <div>
              <strong>1. Entrada / Abertura:</strong> {new Date(encounter.created_at).toLocaleString()}
            </div>
            <div>
              <strong>2. Triagem Realizada:</strong>{' '}
              {encounter.triaged_at ? new Date(encounter.triaged_at).toLocaleString() : 'Pendente'}
            </div>
            <div>
              <strong>3. Chamada Médica:</strong>{' '}
              {encounter.called_at ? `${new Date(encounter.called_at).toLocaleString()} (${encounter.doctor_room || 'Consultório'})` : 'Pendente'}
            </div>
            <div>
              <strong>4. Conclusão / Desfecho:</strong>{' '}
              {encounter.completed_at ? `${new Date(encounter.completed_at).toLocaleString()} - Destino: ${encounter.destination}` : 'Em andamento'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0a5f55' }}>
          Histórico de Triagens e Sinais Vitais ({encounter.triages?.length || 0})
        </h2>
        {encounter.triages && encounter.triages.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {encounter.triages.map((t, idx) => (
              <div key={t.id} style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f4f7f6', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {idx === 0 ? 'Triagem Inicial' : `Reclassificação #${idx}`} ({new Date(t.created_at).toLocaleTimeString()})
                  </span>
                  <RiskBadge color={t.final_color} size="sm" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '0.85rem' }}>
                  <div><strong>PA:</strong> {t.systolic_bp}/{t.diastolic_bp} mmHg</div>
                  <div><strong>FC:</strong> {t.heart_rate} bpm</div>
                  <div><strong>Temp.:</strong> {t.temperature} °C</div>
                  <div><strong>Sat. O₂:</strong> {t.oxygen_saturation}%</div>
                  <div><strong>Dor (0-10):</strong> {t.pain_scale}</div>
                  <div><strong>Nível:</strong> {t.consciousness_level}</div>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.85rem' }}>
                  <strong>Queixa:</strong> {t.chief_complaint}
                </div>
                {t.justification && (
                  <div style={{ marginTop: '6px', fontSize: '0.85rem', color: '#9a3412', backgroundColor: '#fff7ed', padding: '6px', borderRadius: '4px' }}>
                    <strong>Justificativa da Alteração:</strong> {t.justification}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#94a3b8' }}>Nenhuma triagem realizada ainda.</p>
        )}
      </div>

      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0a5f55' }}>
          Prescrições do Atendimento ({prescriptions.length})
        </h2>
        {prescriptions.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Nenhum medicamento prescrito.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {prescriptions.map((p) => (
              <li key={p.id} style={{ marginBottom: '6px' }}>
                <strong>{p.medication?.name}:</strong> {p.dose} {p.unit} - Via {p.route} ({p.frequency})
                {p.instructions && <span style={{ color: '#64748b' }}> — {p.instructions}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
