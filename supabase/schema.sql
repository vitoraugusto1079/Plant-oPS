CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS bed_assignments CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS medications CASCADE;
DROP TABLE IF EXISTS encounter_events CASCADE;
DROP TABLE IF EXISTS triages CASCADE;
DROP TABLE IF EXISTS encounters CASCADE;
DROP TABLE IF EXISTS patient_allergies CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS triage_color CASCADE;
DROP TYPE IF EXISTS encounter_status CASCADE;
DROP TYPE IF EXISTS bed_status CASCADE;
DROP TYPE IF EXISTS bed_ward CASCADE;
DROP TYPE IF EXISTS patient_destination CASCADE;

CREATE TYPE user_role AS ENUM (
  'recepcao',
  'enfermagem',
  'medico',
  'gestao',
  'painel'
);

CREATE TYPE triage_color AS ENUM (
  'Vermelho',
  'Laranja',
  'Amarelo',
  'Verde',
  'Azul'
);

CREATE TYPE encounter_status AS ENUM (
  'Aguardando triagem',
  'Aguardando médico',
  'Aguardando médico (reclassificação)',
  'Em atendimento',
  'Aguardando leito',
  'Em observação',
  'Alta',
  'Transferido',
  'Cancelado'
);

CREATE TYPE bed_status AS ENUM (
  'livre',
  'ocupado',
  'em_limpeza',
  'bloqueado'
);

CREATE TYPE bed_ward AS ENUM (
  'Sala Vermelha',
  'Observação'
);

CREATE TYPE patient_destination AS ENUM (
  'alta',
  'observação',
  'internação',
  'transferência'
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ticket_number TEXT NOT NULL,
  status encounter_status NOT NULL DEFAULT 'Aguardando triagem',
  priority_color triage_color,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triaged_at TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  doctor_room TEXT,
  evolution TEXT,
  destination patient_destination,
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_unique_active_encounter
  ON encounters(patient_id)
  WHERE status NOT IN ('Alta', 'Transferido', 'Cancelado');

CREATE TABLE triages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  systolic_bp INT NOT NULL,
  diastolic_bp INT NOT NULL,
  heart_rate INT NOT NULL,
  temperature NUMERIC(4,1) NOT NULL,
  oxygen_saturation INT NOT NULL CHECK (oxygen_saturation >= 0 AND oxygen_saturation <= 100),
  pain_scale INT NOT NULL CHECK (pain_scale >= 0 AND pain_scale <= 10),
  consciousness_level TEXT NOT NULL,
  chief_complaint TEXT NOT NULL,
  suggested_color triage_color NOT NULL,
  final_color triage_color NOT NULL,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_justification_when_color_altered CHECK (
    final_color = suggested_color OR (justification IS NOT NULL AND length(trim(justification)) > 0)
  )
);

CREATE TABLE encounter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  from_status encounter_status,
  to_status encounter_status NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  max_dose NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL,
  default_route TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE RESTRICT,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  dose NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ward bed_ward NOT NULL,
  status bed_status NOT NULL DEFAULT 'livre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharged_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_unique_active_bed
  ON bed_assignments(bed_id)
  WHERE discharged_at IS NULL;

CREATE UNIQUE INDEX idx_unique_active_encounter_bed
  ON bed_assignments(encounter_id)
  WHERE discharged_at IS NULL;

CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  room TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_encounters_status_priority ON encounters(status, priority_color);
CREATE INDEX idx_encounters_created_at ON encounters(created_at);
CREATE INDEX idx_triages_encounter_id ON triages(encounter_id);
CREATE INDEX idx_prescriptions_encounter_id ON prescriptions(encounter_id);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
