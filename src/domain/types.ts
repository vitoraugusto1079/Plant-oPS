// ==============================================================================
// PlantãoPS - Definições de Tipos do Domínio
// ==============================================================================

export type UserRole = 'recepcao' | 'enfermagem' | 'medico' | 'gestao' | 'painel';

export type TriageColor = 'Vermelho' | 'Laranja' | 'Amarelo' | 'Verde' | 'Azul';

export type EncounterStatus =
  | 'Aguardando triagem'
  | 'Aguardando médico'
  | 'Aguardando médico (reclassificação)'
  | 'Em atendimento'
  | 'Aguardando leito'
  | 'Em observação'
  | 'Alta'
  | 'Transferido'
  | 'Cancelado';

export type BedStatus = 'livre' | 'ocupado' | 'em_limpeza' | 'bloqueado';

export type BedWard = 'Sala Vermelha' | 'Observação';

export type PatientDestination = 'alta' | 'observação' | 'internação' | 'transferência';

export type ConsciousnessLevel = 'alerta' | 'confuso' | 'inconsciente';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Patient {
  id: string;
  name: string;
  birth_date: string;
  gender: string;
  phone?: string | null;
  created_at: string;
  allergies?: PatientAllergy[];
}

export interface PatientAllergy {
  id: string;
  patient_id: string;
  allergen_name: string;
  created_at: string;
}

export interface VitalSigns {
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  temperature: number;
  oxygenSaturation: number;
  painScale: number; // 0 - 10
  consciousnessLevel: ConsciousnessLevel;
  chiefComplaint: string;
}

export interface TriageRecord {
  id: string;
  encounter_id: string;
  nurse_id?: string | null;
  systolic_bp: number;
  diastolic_bp: number;
  heart_rate: number;
  temperature: number;
  oxygen_saturation: number;
  pain_scale: number;
  consciousness_level: ConsciousnessLevel;
  chief_complaint: string;
  suggested_color: TriageColor;
  final_color: TriageColor;
  justification?: string | null;
  created_at: string;
}

export interface Encounter {
  id: string;
  patient_id: string;
  ticket_number: string;
  status: EncounterStatus;
  priority_color?: TriageColor | null;
  created_at: string;
  triaged_at?: string | null;
  called_at?: string | null;
  doctor_id?: string | null;
  doctor_room?: string | null;
  evolution?: string | null;
  destination?: PatientDestination | null;
  completed_at?: string | null;
  patient?: Patient;
  triages?: TriageRecord[];
}

export interface EncounterEvent {
  id: string;
  encounter_id: string;
  from_status?: EncounterStatus | null;
  to_status: EncounterStatus;
  created_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  name: string;
  max_dose: number;
  unit: string;
  default_route: string;
  created_at: string;
}

export interface Prescription {
  id: string;
  encounter_id: string;
  medication_id: string;
  doctor_id?: string | null;
  dose: number;
  unit: string;
  route: string;
  frequency: string;
  instructions?: string | null;
  created_at: string;
  medication?: Medication;
}

export interface Bed {
  id: string;
  name: string;
  ward: BedWard;
  status: BedStatus;
  created_at: string;
  current_assignment?: BedAssignment | null;
}

export interface BedAssignment {
  id: string;
  bed_id: string;
  encounter_id: string;
  admitted_at: string;
  discharged_at?: string | null;
  created_by?: string | null;
  encounter?: Encounter;
}

export interface Call {
  id: string;
  encounter_id: string;
  ticket_number: string;
  room: string;
  created_at: string;
}
