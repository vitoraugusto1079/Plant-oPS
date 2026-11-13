import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientService } from '../services/patientService';
import { encounterService } from '../services/encounterService';
import { calculateAge } from '../domain/queue';
import { RiskBadge } from '../components/RiskBadge';

export const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: patient, isLoading: isLoadingPatient } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => (id ? patientService.getPatientById(id) : null),
    enabled: !!id,
  });

  const { data: encounters = [], isLoading: isLoadingEncounters } = useQuery({
    queryKey: ['patient-encounters', id],
    queryFn: () => (id ? encounterService.getPatientHistory(id) : []),
    enabled: !!id,
  });

  if (isLoadingPatient) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando dados do paciente...</div>;
  }

  if (!patient) {
    return <div style={{ padding: '24px', color: '#b91c1c' }}>Paciente não encontrado.</div>;
  }

  const age = calculateAge(patient.birth_date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Ficha do Paciente</span>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a5f55', margin: '2px 0 0 0' }}>
          {patient.name}
        </h1>
      </div>

      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0a5f55' }}>
          Dados Cadastrais
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.9rem' }}>
          <div><strong>Nascimento:</strong> {patient.birth_date} ({age} anos)</div>
          <div><strong>Sexo:</strong> {patient.gender}</div>
          <div><strong>Telefone:</strong> {patient.phone || 'Não informado'}</div>
          <div><strong>Cadastrado em:</strong> {new Date(patient.created_at).toLocaleDateString()}</div>
        </div>

        {patient.allergies && patient.allergies.length > 0 && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
            <strong style={{ color: '#991b1b' }}>⚠️ Alergias Conhecidas (Bloqueio Automático):</strong>
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', color: '#dc2626', fontWeight: 600 }}>
              {patient.allergies.map((a) => (
                <li key={a.id}>{a.allergen_name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: '#0a5f55' }}>
          Histórico de Passagens no Pronto-Socorro ({encounters.length})
        </h2>

        {isLoadingEncounters ? (
          <p style={{ color: '#64748b' }}>Carregando histórico...</p>
        ) : encounters.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>Nenhum atendimento registrado para este paciente.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {encounters.map((enc) => (
              <div
                key={enc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f4f7f6',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '1.1rem', color: '#0a5f55' }}>{enc.ticket_number}</strong>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {new Date(enc.created_at).toLocaleString()}
                    </span>
                  </div>
                  {enc.evolution && (
                    <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
                      <strong>Evolução:</strong> {enc.evolution}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <RiskBadge color={enc.priority_color} size="sm" />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{enc.status}</span>
                  <Link
                    to={`/atendimentos/${enc.id}`}
                    style={{
                      padding: '4px 10px',
                      backgroundColor: '#00995d',
                      color: '#ffffff',
                      borderRadius: '4px',
                      textDecoration: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Ver Detalhes
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
