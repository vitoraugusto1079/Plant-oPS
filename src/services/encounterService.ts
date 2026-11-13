// ==============================================================================
// PlantãoPS - Serviço de Atendimentos e Fila (Item 2.2, 2.3, 2.4, 2.5)
// Comunicação encapsulada com Supabase e RPCs atômicas
// ==============================================================================

import { supabase } from './supabaseClient';
import { Encounter, PatientDestination, TriageColor, VitalSigns } from '../domain/types';

export const encounterService = {
  /**
   * Abre um novo atendimento gerando senha sequencial atômica via RPC
   */
  async createEncounter(patientId: string): Promise<Encounter> {
    const { data, error } = await supabase.rpc('create_encounter', {
      p_patient_id: patientId,
    });

    if (error) throw error;
    return data as Encounter;
  },

  /**
   * Lista todos os atendimentos iniciados na data atual
   */
  async getTodayEncounters(): Promise<Encounter[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*)')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

  /**
   * Lista pacientes aguardando triagem por ordem de chegada (Item 2.3)
   */
  async getWaitingTriage(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*, allergies:patient_allergies(*))')
      .eq('status', 'Aguardando triagem')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

  /**
   * Lista pacientes aguardando consulta médica (Fila de atendimento)
   */
  async getWaitingDoctorQueue(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*, allergies:patient_allergies(*)), triages(*)')
      .in('status', ['Aguardando médico', 'Aguardando médico (reclassificação)'])
      .order('triaged_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

  /**
   * Obtém detalhes completos de um atendimento por ID
   */
  async getEncounterById(id: string): Promise<Encounter | null> {
    const { data, error } = await supabase
      .from('encounters')
      .select(`
        *,
        patient:patients(*, allergies:patient_allergies(*)),
        triages(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Encounter;
  },

  /**
   * Registra triagem inicial ou reclassificação via RPC atômica
   */
  async saveTriage(params: {
    encounterId: string;
    vitals: VitalSigns;
    suggestedColor: TriageColor;
    finalColor: TriageColor;
    justification?: string;
  }): Promise<Encounter> {
    const { data, error } = await supabase.rpc('save_triage', {
      p_encounter_id: params.encounterId,
      p_systolic_bp: params.vitals.systolicBp,
      p_diastolic_bp: params.vitals.diastolicBp,
      p_heart_rate: params.vitals.heartRate,
      p_temperature: params.vitals.temperature,
      p_oxygen_saturation: params.vitals.oxygenSaturation,
      p_pain_scale: params.vitals.painScale,
      p_consciousness_level: params.vitals.consciousnessLevel,
      p_chief_complaint: params.vitals.chiefComplaint,
      p_suggested_color: params.suggestedColor,
      p_final_color: params.finalColor,
      p_justification: params.justification || null,
    });

    if (error) throw error;
    return data as Encounter;
  },

  /**
   * Chama o próximo paciente da fila atomicamente via FOR UPDATE SKIP LOCKED (Item 2.5)
   */
  async callNextPatient(room: string): Promise<{ success: boolean; encounter?: Encounter; message?: string }> {
    const { data, error } = await supabase.rpc('call_next_patient', {
      p_doctor_room: room,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Conclui a conduta médica definindo o destino do paciente (Item 2.5)
   */
  async concludeMedicalEncounter(params: {
    encounterId: string;
    destination: PatientDestination;
    evolution: string;
  }): Promise<Encounter> {
    const { data, error } = await supabase.rpc('conclude_medical_encounter', {
      p_encounter_id: params.encounterId,
      p_destination: params.destination,
      p_evolution: params.evolution,
    });

    if (error) throw error;
    return data as Encounter;
  },

  /**
   * Cancela atendimento por desistência
   */
  async cancelEncounter(encounterId: string, reason?: string): Promise<Encounter> {
    const { data, error } = await supabase.rpc('cancel_encounter', {
      p_encounter_id: encounterId,
      p_reason: reason || 'Desistência do paciente',
    });

    if (error) throw error;
    return data as Encounter;
  },

  /**
   * Busca histórico de atendimentos anteriores do paciente
   */
  async getPatientHistory(patientId: string, currentEncounterId?: string): Promise<Encounter[]> {
    let query = supabase
      .from('encounters')
      .select('*, triages(*)')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (currentEncounterId) {
      query = query.neq('id', currentEncounterId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Encounter[];
  },
};
