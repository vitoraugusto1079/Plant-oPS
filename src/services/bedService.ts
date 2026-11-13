import { supabase } from './supabaseClient';
import { Bed, Encounter } from '../domain/types';

export const bedService = {
  async listBeds(): Promise<Bed[]> {
    const { data: beds, error: bedError } = await supabase
      .from('beds')
      .select('*')
      .order('name', { ascending: true });

    if (bedError) throw bedError;

    const { data: assignments, error: assignError } = await supabase
      .from('bed_assignments')
      .select('*, encounter:encounters(*, patient:patients(*))')
      .is('discharged_at', null);

    if (assignError) throw assignError;

    const assignmentMap = new Map();
    assignments?.forEach((a) => {
      assignmentMap.set(a.bed_id, a);
    });

    return (beds || []).map((bed) => ({
      ...bed,
      current_assignment: assignmentMap.get(bed.id) || null,
    })) as Bed[];
  },

  async getPatientsAwaitingBed(): Promise<Encounter[]> {
    const { data, error } = await supabase
      .from('encounters')
      .select('*, patient:patients(*)')
      .eq('status', 'Aguardando leito')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as Encounter[];
  },

  async assignBed(encounterId: string, bedId: string): Promise<void> {
    const { error } = await supabase.rpc('assign_bed', {
      p_encounter_id: encounterId,
      p_bed_id: bedId,
    });

    if (error) throw error;
  },

  async cleanBed(bedId: string): Promise<void> {
    const { error } = await supabase.rpc('clean_bed', {
      p_bed_id: bedId,
    });

    if (error) throw error;
  },
};
