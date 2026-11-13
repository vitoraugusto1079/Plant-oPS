import { supabase } from './supabaseClient';
import { Encounter, PatientDestination, TriageColor, VitalSigns } from '../domain/types';

export const encounterService = {
  async createEncounter(patientId: string): Promise<Encounter> {
    const { data, error } = await supabase.rpc('create_encounter', {
      p_patient_id: patientId,
    });

    if (error) throw error;
    return data as Encounter;
  },

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

  async getWaitingTriage(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*, allergies:patient_allergies(*))')
      .eq('status', 'Aguardando triagem')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

  async getWaitingDoctorQueue(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*, allergies:patient_allergies(*)), triages(*)')
      .in('status', ['Aguardando médico', 'Aguardando médico (reclassificação)'])
      .order('triaged_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

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

  async callNextPatient(room: string): Promise<{ success: boolean; encounter?: Encounter; message?: string }> {
    const { data, error } = await supabase.rpc('call_next_patient', {
      p_doctor_room: room,
    });

    if (error) throw error;
    return data;
  },

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

  async cancelEncounter(encounterId: string, reason?: string): Promise<Encounter> {
    const { data, error } = await supabase.rpc('cancel_encounter', {
      p_encounter_id: encounterId,
      p_reason: reason || 'Desistência do paciente',
    });

    if (error) throw error;
    return data as Encounter;
  },

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
