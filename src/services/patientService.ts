// ==============================================================================
// PlantãoPS - Serviço de Pacientes e Alergias (Item 2.2)
// ==============================================================================

import { supabase } from './supabaseClient';
import { Patient, PatientAllergy } from '../domain/types';

export interface CreatePatientInput {
  name: string;
  birth_date: string;
  gender: string;
  phone?: string;
  allergies?: string[];
}

export const patientService = {
  /**
   * Busca pacientes por nome ou data de nascimento
   */
  async searchPatients(query: string): Promise<Patient[]> {
    if (!query || query.trim().length === 0) {
      const { data, error } = await supabase
        .from('patients')
        .select('*, allergies:patient_allergies(*)')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Patient[];
    }

    const trimmed = query.trim();
    const { data, error } = await supabase
      .from('patients')
      .select('*, allergies:patient_allergies(*)')
      .or(`name.ilike.%${trimmed}%,birth_date.eq.${trimmed}`)
      .order('name', { ascending: true })
      .limit(30);

    if (error) {
      // Se a data de nascimento for inválida para o formato de date, busca apenas por nome
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('patients')
        .select('*, allergies:patient_allergies(*)')
        .ilike('name', `%${trimmed}%`)
        .order('name', { ascending: true })
        .limit(30);

      if (fallbackError) throw fallbackError;
      return (fallbackData || []) as Patient[];
    }

    return (data || []) as Patient[];
  },

  /**
   * Cadastra um novo paciente com suas alergias conhecidas
   */
  async createPatient(input: CreatePatientInput): Promise<Patient> {
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .insert({
        name: input.name.trim(),
        birth_date: input.birth_date,
        gender: input.gender,
        phone: input.phone?.trim() || null,
      })
      .select()
      .single();

    if (patientError) throw patientError;

    if (input.allergies && input.allergies.length > 0) {
      const allergyRows = input.allergies
        .filter((a) => a.trim().length > 0)
        .map((allergen) => ({
          patient_id: patient.id,
          allergen_name: allergen.trim(),
        }));

      if (allergyRows.length > 0) {
        const { error: allergyError } = await supabase
          .from('patient_allergies')
          .insert(allergyRows);
        if (allergyError) console.error('Erro ao cadastrar alergias:', allergyError);
      }
    }

    return patient as Patient;
  },

  /**
   * Busca paciente por ID
   */
  async getPatientById(id: string): Promise<Patient | null> {
    const { data, error } = await supabase
      .from('patients')
      .select('*, allergies:patient_allergies(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Patient;
  },

  /**
   * Busca alergias de um paciente
   */
  async getPatientAllergies(patientId: string): Promise<PatientAllergy[]> {
    const { data, error } = await supabase
      .from('patient_allergies')
      .select('*')
      .eq('patient_id', patientId);

    if (error) throw error;
    return (data || []) as PatientAllergy[];
  },
};
