import { supabase } from './supabaseClient';
import { Medication, Prescription } from '../domain/types';

export const medicationService = {
  async listMedications(): Promise<Medication[]> {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Medication[];
  },

  async prescribeMedication(params: {
    encounterId: string;
    medicationId: string;
    dose: number;
    unit: string;
    route: string;
    frequency: string;
    instructions?: string;
  }): Promise<Prescription> {
    const { data, error } = await supabase.rpc('prescribe_medication', {
      p_encounter_id: params.encounterId,
      p_medication_id: params.medicationId,
      p_dose: params.dose,
      p_unit: params.unit,
      p_route: params.route,
      p_frequency: params.frequency,
      p_instructions: params.instructions || null,
    });

    if (error) throw error;
    return data as Prescription;
  },

  async getPrescriptionsByEncounter(encounterId: string): Promise<Prescription[]> {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, medication:medications(*)')
      .eq('encounter_id', encounterId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Prescription[];
  },
};
