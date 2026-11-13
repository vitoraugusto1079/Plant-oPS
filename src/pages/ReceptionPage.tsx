// ==============================================================================
// PlantãoPS - Página da Recepção (Item 2.2 & 3.8)
// Busca, cadastro de pacientes, abertura de atendimento com senha sequencial
// ==============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { patientService } from '../services/patientService';
import { encounterService } from '../services/encounterService';
import { Patient, Encounter } from '../domain/types';
import { RiskBadge } from '../components/RiskBadge';

const patientSchema = z.object({
  name: z.string().min(3, 'O nome deve ter no mínimo 3 caracteres'),
  birth_date: z.string().min(10, 'Informe uma data de nascimento válida (AAAA-MM-DD)'),
  gender: z.enum(['M', 'F', 'Outro'] as const),
  phone: z.string().optional(),
  allergies: z.string().optional(), // separados por vírgula
});

type PatientFormData = z.infer<typeof patientSchema>;

export const ReceptionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // 1. Busca de pacientes
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['patients-search', searchTerm],
    queryFn: () => patientService.searchPatients(searchTerm),
  });

  // 2. Atendimentos abertos no dia
  const { data: todayEncounters = [], isLoading: isLoadingEncounters } = useQuery({
    queryKey: ['today-encounters'],
    queryFn: () => encounterService.getTodayEncounters(),
    refetchInterval: 15000,
  });

  // Formulário de novo paciente
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting: isCreatingPatient },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      gender: 'M',
    },
  });

  // Mutação: cadastrar paciente
  const createPatientMutation = useMutation({
    mutationFn: async (data: PatientFormData) => {
      const allergyList = data.allergies
        ? data.allergies.split(',').map((a) => a.trim()).filter((a) => a.length > 0)
        : [];
      return await patientService.createPatient({
        name: data.name,
        birth_date: data.birth_date,
        gender: data.gender,
        phone: data.phone,
        allergies: allergyList,
      });
    },
    onSuccess: (newPatient) => {
      queryClient.invalidateQueries({ queryKey: ['patients-search'] });
      setSelectedPatient(newPatient);
      setShowNewPatientForm(false);
      reset();
      setActionMessage({
        type: 'success',
        text: `Paciente "${newPatient.name}" cadastrado com sucesso!`,
      });
    },
    onError: (err: any) => {
      setActionMessage({
        type: 'error',
        text: `Erro ao cadastrar paciente: ${err.message}`,
      });
    },
  });

  // Mutação: abrir atendimento (gerar senha sequencial)
  const openEncounterMutation = useMutation({
    mutationFn: async (patientId: string) => {
      return await encounterService.createEncounter(patientId);
    },
    onSuccess: (encounter) => {
      queryClient.invalidateQueries({ queryKey: ['today-encounters'] });
      setSelectedPatient(null);
      setActionMessage({
        type: 'success',
        text: `Atendimento aberto com sucesso! Senha gerada: ${encounter.ticket_number}`,
      });
    },
    onError: (err: any) => {
      setActionMessage({
        type: 'error',
        text: `Erro ao abrir atendimento: ${err.message}`,
      });
    },
  });

  const onSubmitPatient = (data: PatientFormData) => {
    setActionMessage(null);
    createPatientMutation.mutate(data);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0a5f55', margin: '0 0 8px 0' }}>
          Recepção - Entrada de Pacientes
        </h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Busque pacientes cadastrados, registre novas fichas e abra atendimentos sequenciais.
        </p>
      </div>

      {actionMessage && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: actionMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: actionMessage.type === 'success' ? '#15803d' : '#b91c1c',
            border: `1px solid ${actionMessage.type === 'success' ? '#86efac' : '#fca5a5'}`,
            fontWeight: 600,
          }}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Grid Principal: Busca/Cadastro à esquerda e Lista do Dia à direita */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Painel Esquerdo: Busca e Abertura */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#0a5f55' }}>
              Localizar Paciente
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowNewPatientForm(!showNewPatientForm);
                setSelectedPatient(null);
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: showNewPatientForm ? '#64748b' : '#00995d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {showNewPatientForm ? 'Voltar para Busca' : '+ Novo Paciente'}
            </button>
          </div>

          {!showNewPatientForm ? (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="patientSearch" style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '0.9rem' }}>
                  Buscar por Nome ou Data de Nascimento (AAAA-MM-DD)
                </label>
                <input
                  id="patientSearch"
                  type="text"
                  placeholder="Digite o nome ou data de nascimento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                  }}
                />
              </div>

              {isSearching && <p style={{ color: '#64748b' }}>Buscando pacientes...</p>}

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.length === 0 && !isSearching && (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    Nenhum paciente encontrado. Clique em "+ Novo Paciente" para cadastrar.
                  </p>
                )}

                {searchResults.map((patient) => {
                  const isSelected = selectedPatient?.id === patient.id;
                  return (
                    <div
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                        backgroundColor: isSelected ? '#e6f5ef' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ color: '#0a5f55' }}>{patient.name}</strong>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          Nasc.: {patient.birth_date}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                        Sexo: {patient.gender} | Tel: {patient.phone || 'Não informado'}
                      </div>
                      {patient.allergies && patient.allergies.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#dc2626' }}>
                          ⚠️ Alergias: {patient.allergies.map((a) => a.allergen_name).join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Ação de abertura de atendimento */}
              {selectedPatient && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f4f7f6', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#0a5f55' }}>
                    Abrir Atendimento para: <u>{selectedPatient.name}</u>
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 12px 0' }}>
                    Ao clicar no botão abaixo, o sistema gerará a próxima senha sequencial do dia (ex: A023) e encaminhará o paciente para a triagem.
                  </p>
                  <button
                    type="button"
                    disabled={openEncounterMutation.isPending}
                    onClick={() => openEncounterMutation.mutate(selectedPatient.id)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#00995d',
                      color: '#ffffff',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: openEncounterMutation.isPending ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {openEncounterMutation.isPending ? 'Gerando Senha...' : '🎟️ Abrir Atendimento e Gerar Senha'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Formulário de Cadastro de Novo Paciente */
            <form onSubmit={handleSubmit(onSubmitPatient)} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label htmlFor="name" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Nome Completo *
                </label>
                <input
                  id="name"
                  type="text"
                  {...register('name')}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
                {errors.name && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.name.message}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="birth_date" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Data de Nascimento *
                  </label>
                  <input
                    id="birth_date"
                    type="date"
                    {...register('birth_date')}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  />
                  {errors.birth_date && <span style={{ color: '#dc2626', fontSize: '0.8rem' }}>{errors.birth_date.message}</span>}
                </div>

                <div>
                  <label htmlFor="gender" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Sexo *
                  </label>
                  <select
                    id="gender"
                    {...register('gender')}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="phone" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Telefone de Contato
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="(11) 98765-4321"
                  {...register('phone')}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label htmlFor="allergies" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Alergias Conhecidas (separar por vírgula)
                </label>
                <input
                  id="allergies"
                  type="text"
                  placeholder="Ex: Dipirona, Penicilina, Iodo"
                  {...register('allergies')}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Crucial para bloqueio automático de prescrições perigosas
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={isCreatingPatient}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#00995d',
                    color: '#ffffff',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: isCreatingPatient ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isCreatingPatient ? 'Salvando...' : 'Salvar Paciente'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Painel Direito: Atendimentos Abertos no Dia (Item 2.2) */}
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 16px 0', color: '#0a5f55' }}>
            Atendimentos Abertos Hoje ({todayEncounters.length})
          </h2>

          {isLoadingEncounters ? (
            <p style={{ color: '#64748b' }}>Carregando atendimentos do dia...</p>
          ) : todayEncounters.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>
              Nenhum atendimento aberto hoje ainda.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '500px', overflowY: 'auto' }}>
              {todayEncounters.map((enc) => (
                <div
                  key={enc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f4f7f6',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.1rem', color: '#0a5f55' }}>{enc.ticket_number}</strong>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {enc.patient?.name || 'Paciente sem nome'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                      Entrada: {new Date(enc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#e2e8f0',
                        color: '#334155',
                      }}
                    >
                      {enc.status}
                    </span>
                    {enc.priority_color && <RiskBadge color={enc.priority_color} size="sm" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
