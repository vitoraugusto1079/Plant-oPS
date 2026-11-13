// ==============================================================================
// PlantãoPS - Página do Atendimento Médico (Item 2.5)
// Chamar próximo atômico, consulta clínica, validações de prescrição e destino
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { encounterService } from '../services/encounterService';
import { medicationService } from '../services/medicationService';
import { useAuth } from '../hooks/useAuth';
import { Encounter, Medication, PatientDestination, Prescription } from '../domain/types';
import { RiskBadge } from '../components/RiskBadge';
import { ConfirmModal } from '../components/ConfirmModal';
import { validateMedicationAllergy, validateMedicationDose } from '../domain/prescription';
import { calculateAge } from '../domain/queue';

export const DoctorPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Estado do consultório selecionado pelo médico
  const [selectedRoom, setSelectedRoom] = useState<string>('Consultório 1');
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);

  // Formulário clínico
  const [evolutionText, setEvolutionText] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<PatientDestination>('alta');

  // Prescrição de Medicamentos
  const [selectedMedicationId, setSelectedMedicationId] = useState<string>('');
  const [prescribedDose, setPrescribedDose] = useState<number>(0);
  const [prescribedRoute, setPrescribedRoute] = useState<string>('Oral');
  const [prescribedFrequency, setPrescribedFrequency] = useState<string>('8/8h');
  const [prescribedInstructions, setPrescribedInstructions] = useState<string>('');

  // Mensagens e Diálogo de Confirmação
  const [systemAlert, setSystemAlert] = useState<{ type: 'error' | 'success' | 'warning'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
  });

  // 1. Catálogo de Medicamentos
  const { data: medications = [] } = useQuery({
    queryKey: ['medications-catalog'],
    queryFn: () => medicationService.listMedications(),
  });

  // 2. Prescrições do atendimento atual
  const { data: currentPrescriptions = [], refetch: refetchPrescriptions } = useQuery({
    queryKey: ['prescriptions', currentEncounter?.id],
    queryFn: () => (currentEncounter ? medicationService.getPrescriptionsByEncounter(currentEncounter.id) : []),
    enabled: !!currentEncounter,
  });

  // 3. Histórico de Atendimentos Anteriores do Paciente
  const { data: patientHistory = [] } = useQuery({
    queryKey: ['patient-history', currentEncounter?.patient_id],
    queryFn: () => (currentEncounter ? encounterService.getPatientHistory(currentEncounter.patient_id, currentEncounter.id) : []),
    enabled: !!currentEncounter,
  });

  // Mutação: Chamar Próximo Atômico
  const callNextMutation = useMutation({
    mutationFn: async () => {
      return await encounterService.callNextPatient(selectedRoom);
    },
    onSuccess: async (res) => {
      if (!res.success || !res.encounter) {
        setSystemAlert({ type: 'warning', text: res.message || 'Nenhum paciente aguardando atendimento.' });
        return;
      }

      // Buscar detalhes completos com paciente e triagens
      const detailed = await encounterService.getEncounterById(res.encounter.id);
      setCurrentEncounter(detailed);
      setEvolutionText('');
      setSystemAlert({
        type: 'success',
        text: `Paciente chamado para ${selectedRoom}: Senha ${res.encounter.ticket_number}!`,
      });
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
    onError: (err: any) => {
      setSystemAlert({ type: 'error', text: `Erro ao chamar próximo: ${err.message}` });
    },
  });

  // Mutação: Prescrever Medicamento
  const prescribeMutation = useMutation({
    mutationFn: async (params: {
      encounterId: string;
      medicationId: string;
      dose: number;
      unit: string;
      route: string;
      frequency: string;
      instructions?: string;
    }) => {
      return await medicationService.prescribeMedication(params);
    },
    onSuccess: () => {
      refetchPrescriptions();
      setPrescribedDose(0);
      setPrescribedInstructions('');
      setSystemAlert({ type: 'success', text: 'Medicamento prescrito com sucesso!' });
    },
    onError: (err: any) => {
      setSystemAlert({ type: 'error', text: err.message });
    },
  });

  // Mutação: Concluir Atendimento (Definir Destino)
  const concludeEncounterMutation = useMutation({
    mutationFn: async () => {
      if (!currentEncounter) throw new Error('Nenhum atendimento ativo.');
      return await encounterService.concludeMedicalEncounter({
        encounterId: currentEncounter.id,
        destination: selectedDestination,
        evolution: evolutionText,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      queryClient.invalidateQueries({ queryKey: ['today-encounters'] });
      setSystemAlert({
        type: 'success',
        text: `Atendimento ${updated.ticket_number} concluído com destino: "${selectedDestination}".`,
      });
      setCurrentEncounter(null);
      setEvolutionText('');
    },
    onError: (err: any) => {
      setSystemAlert({ type: 'error', text: `Falha ao concluir atendimento: ${err.message}` });
    },
  });

  // Validação e Envio de Prescrição
  const handlePrescribe = () => {
    setSystemAlert(null);
    if (!currentEncounter) return;

    const med = medications.find((m) => m.id === selectedMedicationId);
    if (!med) {
      setSystemAlert({ type: 'error', text: 'Selecione um medicamento do catálogo.' });
      return;
    }

    // 1. Validação de Alergia no Domínio (Item 2.5 & 3.7)
    const patientAllergies = currentEncounter.patient?.allergies || [];
    const allergyCheck = validateMedicationAllergy(patientAllergies, med.name);
    if (allergyCheck.isAllergic) {
      setSystemAlert({
        type: 'error',
        text: `⛔ PRESCRIÇÃO BLOQUEADA: ${allergyCheck.reason}`,
      });
      return;
    }

    // 2. Validação de Dose Máxima no Domínio (Item 2.5 & 3.7)
    const doseCheck = validateMedicationDose(prescribedDose, med);
    if (!doseCheck.isValid) {
      setSystemAlert({
        type: 'error',
        text: `⛔ PRESCRIÇÃO BLOQUEADA: ${doseCheck.reason}`,
      });
      return;
    }

    prescribeMutation.mutate({
      encounterId: currentEncounter.id,
      medicationId: med.id,
      dose: prescribedDose,
      unit: med.unit,
      route: prescribedRoute,
      frequency: prescribedFrequency,
      instructions: prescribedInstructions,
    });
  };

  // Solicitar confirmação antes de concluir (Item 3.10)
  const handleRequestConclude = () => {
    if (!currentEncounter) return;

    const actionText =
      selectedDestination === 'alta'
        ? 'dar ALTA ao paciente'
        : selectedDestination === 'transferência'
        ? 'TRANSFERIR o paciente para outra unidade'
        : selectedDestination === 'observação'
        ? 'encaminhar o paciente para a ala de OBSERVAÇÃO'
        : 'solicitar INTERNAÇÃO hospitalar';

    setConfirmModal({
      isOpen: true,
      title: 'Confirmar Conduta Médica',
      message: `Tem certeza que deseja ${actionText}? Senha: ${currentEncounter.ticket_number} - Paciente: ${currentEncounter.patient?.name}.`,
      action: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        concludeEncounterMutation.mutate();
      },
    });
  };

  const selectedMed = medications.find((m) => m.id === selectedMedicationId);
  const patient = currentEncounter?.patient;
  const patientAge = patient?.birth_date ? calculateAge(patient.birth_date) : null;
  const latestTriage = currentEncounter?.triages?.[currentEncounter.triages.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra de Controle do Consultório */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor="doctorRoom" style={{ fontWeight: 700, color: '#1e293b' }}>
            Meu Consultório:
          </label>
          <select
            id="doctorRoom"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
          >
            <option value="Consultório 1">Consultório 1</option>
            <option value="Consultório 2">Consultório 2</option>
            <option value="Consultório 3">Consultório 3</option>
            <option value="Sala Vermelha / Emergência">Sala Vermelha / Emergência</option>
          </select>
        </div>

        <button
          type="button"
          disabled={callNextMutation.isPending || !!currentEncounter}
          onClick={() => callNextMutation.mutate()}
          style={{
            padding: '10px 24px',
            backgroundColor: currentEncounter ? '#94a3b8' : '#2563eb',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1rem',
            borderRadius: '6px',
            border: 'none',
            cursor: currentEncounter ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
          }}
        >
          {callNextMutation.isPending ? 'Chamando...' : '🔔 Chamar Próximo Paciente'}
        </button>
      </div>

      {systemAlert && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor:
              systemAlert.type === 'error' ? '#fee2e2' : systemAlert.type === 'warning' ? '#fef3c7' : '#dcfce7',
            color:
              systemAlert.type === 'error' ? '#b91c1c' : systemAlert.type === 'warning' ? '#92400e' : '#15803d',
            border: `1px solid ${
              systemAlert.type === 'error' ? '#f87171' : systemAlert.type === 'warning' ? '#fcd34d' : '#86efac'
            }`,
            fontWeight: 700,
          }}
        >
          {systemAlert.text}
        </div>
      )}

      {/* Área da Consulta */}
      {currentEncounter ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
          {/* Coluna Esquerda: Dados do Paciente e Triagem */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Cartão de Identificação */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                  {currentEncounter.ticket_number}
                </span>
                <RiskBadge color={currentEncounter.priority_color} size="md" />
              </div>

              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: '0 0 4px 0' }}>
                {patient?.name}
              </h2>

              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Idade: {patientAge !== null ? `${patientAge} anos` : 'Não informada'} | Sexo: {patient?.gender} | Nasc.: {patient?.birth_date}
              </div>

              {/* Alergias com Destaque de Segurança */}
              <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>
                <strong style={{ color: '#991b1b', fontSize: '0.9rem' }}>⚠️ Alergias Conhecidas:</strong>
                {patient?.allergies && patient.allergies.length > 0 ? (
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', color: '#dc2626', fontWeight: 600, fontSize: '0.9rem' }}>
                    {patient.allergies.map((a) => (
                      <li key={a.id}>{a.allergen_name}</li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: '#15803d', fontSize: '0.85rem', marginLeft: '6px', fontWeight: 600 }}>
                    Nenhuma alergia conhecida relatada
                  </span>
                )}
              </div>
            </div>

            {/* Sinais Vitais da Triagem Atual */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#1e293b' }}>
                Triagem Atual (Sinais Vitais)
              </h3>
              {latestTriage ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '0.9rem' }}>
                  <div><strong>PA:</strong> {latestTriage.systolic_bp}/{latestTriage.diastolic_bp} mmHg</div>
                  <div><strong>FC:</strong> {latestTriage.heart_rate} bpm</div>
                  <div><strong>Temp.:</strong> {latestTriage.temperature} °C</div>
                  <div><strong>Sat. O₂:</strong> {latestTriage.oxygen_saturation}%</div>
                  <div><strong>Dor (0-10):</strong> {latestTriage.pain_scale}</div>
                  <div><strong>Consciência:</strong> {latestTriage.consciousness_level}</div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>Queixa Principal:</strong> {latestTriage.chief_complaint}
                  </div>
                  {latestTriage.justification && (
                    <div style={{ gridColumn: 'span 2', backgroundColor: '#fff7ed', padding: '6px', borderRadius: '4px', fontSize: '0.85rem', color: '#9a3412' }}>
                      <strong>Justificativa da Cor:</strong> {latestTriage.justification}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: '#94a3b8' }}>Nenhuma triagem registrada.</p>
              )}
            </div>

            {/* Histórico de Atendimentos Anteriores */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 10px 0', color: '#1e293b' }}>
                Histórico de Passagens Anteriores ({patientHistory.length})
              </h3>
              {patientHistory.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                  Primeira passagem do paciente no Pronto-Socorro.
                </p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {patientHistory.map((prev) => (
                    <div key={prev.id} style={{ padding: '8px', borderRadius: '4px', backgroundColor: '#f8fafc', fontSize: '0.85rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{new Date(prev.created_at).toLocaleDateString()} - {prev.ticket_number}</strong>
                        <span style={{ fontWeight: 600 }}>{prev.status}</span>
                      </div>
                      {prev.evolution && <div style={{ color: '#475569', marginTop: '4px' }}>Evolução: {prev.evolution}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Evolução Clínica, Prescrição e Destino */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Evolução Médica (Texto Livre) */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label htmlFor="evolutionText" style={{ display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                Registro da Evolução Médica (Texto Livre) *
              </label>
              <textarea
                id="evolutionText"
                rows={4}
                value={evolutionText}
                onChange={(e) => setEvolutionText(e.target.value)}
                placeholder="Descreva a anamnese, exame físico e conduta médica..."
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
              />
            </div>

            {/* Prescrição Médica a partir do Catálogo com Validações */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#1e293b' }}>
                Prescrição Médica (com Validação de Alergia e Dose Máxima)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <label htmlFor="medSelect" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Medicamento:
                  </label>
                  <select
                    id="medSelect"
                    value={selectedMedicationId}
                    onChange={(e) => setSelectedMedicationId(e.target.value)}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Selecione...</option>
                    {medications.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (Máx: {m.max_dose} {m.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="prescDose" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Dose ({selectedMed?.unit || 'unidade'}):
                  </label>
                  <input
                    id="prescDose"
                    type="number"
                    step="0.01"
                    value={prescribedDose || ''}
                    onChange={(e) => setPrescribedDose(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label htmlFor="prescRoute" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Via:
                  </label>
                  <select
                    id="prescRoute"
                    value={prescribedRoute}
                    onChange={(e) => setPrescribedRoute(e.target.value)}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="Oral">Oral</option>
                    <option value="Intravenosa (EV)">Intravenosa (EV)</option>
                    <option value="Intramuscular (IM)">Intramuscular (IM)</option>
                    <option value="Subcutânea (SC)">Subcutânea (SC)</option>
                    <option value="Inalatória">Inalatória</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="prescFreq" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Frequência:
                  </label>
                  <input
                    id="prescFreq"
                    type="text"
                    value={prescribedFrequency}
                    onChange={(e) => setPrescribedFrequency(e.target.value)}
                    placeholder="Ex: 8/8h, Se dor"
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={prescribeMutation.isPending || !selectedMedicationId || prescribedDose <= 0}
                  onClick={handlePrescribe}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {prescribeMutation.isPending ? 'Verificando...' : 'Adicionar Prescrição'}
                </button>
              </div>

              {/* Lista de Prescrições do Atendimento */}
              <div style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                <strong style={{ fontSize: '0.85rem', color: '#334155' }}>
                  Medicamentos Prescritos neste Atendimento:
                </strong>
                {currentPrescriptions.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                    Nenhum medicamento prescrito ainda.
                  </p>
                ) : (
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#1e293b' }}>
                    {currentPrescriptions.map((p) => (
                      <li key={p.id}>
                        <strong>{p.medication?.name || 'Medicamento'}:</strong> {p.dose} {p.unit} - {p.route} ({p.frequency})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Definição do Destino do Paciente */}
            <div style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 12px 0', color: '#1e293b' }}>
                Definição do Destino do Paciente (Conduta Final)
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                {[
                  { value: 'alta', label: 'Alta Médica', icon: '🏠' },
                  { value: 'observação', label: 'Observação (Leito)', icon: '🛏️' },
                  { value: 'internação', label: 'Internação', icon: '🏥' },
                  { value: 'transferência', label: 'Transferência', icon: '🚑' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedDestination(item.value as PatientDestination)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: '6px',
                      border: selectedDestination === item.value ? '2px solid #059669' : '1px solid #cbd5e1',
                      backgroundColor: selectedDestination === item.value ? '#ecfdf5' : '#f8fafc',
                      color: selectedDestination === item.value ? '#065f46' : '#334155',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div>{item.icon}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>{item.label}</div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={concludeEncounterMutation.isPending || !evolutionText.trim()}
                onClick={handleRequestConclude}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: concludeEncounterMutation.isPending || !evolutionText.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {concludeEncounterMutation.isPending ? 'Finalizando...' : 'Concluir Atendimento com Destino'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            padding: '80px 20px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            color: '#64748b',
          }}
        >
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>🩺</span>
          <h2 style={{ color: '#1e293b', margin: '0 0 8px 0' }}>Consultório Disponível</h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem' }}>
            Nenhum paciente em atendimento nesta tela. Clique no botão "Chamar Próximo Paciente" para atender o primeiro da fila.
          </p>
        </div>
      )}

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.action}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
