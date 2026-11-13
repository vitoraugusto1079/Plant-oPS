-- ==============================================================================
-- PlantãoPS - Schema do Banco de Dados PostgreSQL (Supabase)
-- Sistema de Gestão de Pronto-Socorro com Classificação de Risco
-- ==============================================================================

-- Habilitar extensão pgcrypto para gen_random_uuid (padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Limpeza preventiva de tabelas e tipos (em ordem de dependência reversa)
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

-- ------------------------------------------------------------------------------
-- Tipos Enumerados (ENUMs)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 1. Perfis de Usuários (vinculados ao auth.users do Supabase)
-- ------------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Pacientes
-- ------------------------------------------------------------------------------
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL, -- 'M', 'F', 'Outro'
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Alergias dos Pacientes
-- ------------------------------------------------------------------------------
CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergen_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Atendimentos (Encounters)
-- ------------------------------------------------------------------------------
CREATE TABLE encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  ticket_number TEXT NOT NULL, -- Ex: 'A001', 'A023'
  status encounter_status NOT NULL DEFAULT 'Aguardando triagem',
  priority_color triage_color, -- Atualizado na triagem
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  triaged_at TIMESTAMPTZ,
  called_at TIMESTAMPTZ,
  doctor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  doctor_room TEXT,
  evolution TEXT,
  destination patient_destination,
  completed_at TIMESTAMPTZ
);

-- Regra de negócio: Um mesmo paciente não pode ter dois atendimentos ativos ao mesmo tempo
CREATE UNIQUE INDEX idx_unique_active_encounter 
  ON encounters(patient_id) 
  WHERE status NOT IN ('Alta', 'Transferido', 'Cancelado');

-- ------------------------------------------------------------------------------
-- 5. Triagens e Histórico de Classificações
-- ------------------------------------------------------------------------------
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
  consciousness_level TEXT NOT NULL, -- 'alerta', 'confuso', 'inconsciente'
  chief_complaint TEXT NOT NULL,
  suggested_color triage_color NOT NULL,
  final_color triage_color NOT NULL,
  justification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_justification_when_color_altered CHECK (
    final_color = suggested_color OR (justification IS NOT NULL AND length(trim(justification)) > 0)
  )
);

-- ------------------------------------------------------------------------------
-- 6. Histórico de Mudanças de Situação (Auditoria de Eventos)
-- ------------------------------------------------------------------------------
CREATE TABLE encounter_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  from_status encounter_status,
  to_status encounter_status NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. Catálogo de Medicamentos
-- ------------------------------------------------------------------------------
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  max_dose NUMERIC(8,2) NOT NULL,
  unit TEXT NOT NULL, -- 'mg', 'g', 'ml', 'gotas'
  default_route TEXT NOT NULL, -- 'Oral', 'Intravenosa (EV)', 'Intramuscular (IM)', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. Prescrições
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 9. Leitos
-- ------------------------------------------------------------------------------
CREATE TABLE beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ward bed_ward NOT NULL,
  status bed_status NOT NULL DEFAULT 'livre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. Ocupações de Leitos
-- ------------------------------------------------------------------------------
CREATE TABLE bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id UUID NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE RESTRICT,
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharged_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Regra de negócio: Restrições no banco impedem duas ocupações ativas do mesmo leito e
-- um atendimento não pode ocupar mais de um leito ativo simultaneamente
CREATE UNIQUE INDEX idx_unique_active_bed 
  ON bed_assignments(bed_id) 
  WHERE discharged_at IS NULL;

CREATE UNIQUE INDEX idx_unique_active_encounter_bed 
  ON bed_assignments(encounter_id) 
  WHERE discharged_at IS NULL;

-- ------------------------------------------------------------------------------
-- 11. Chamadas no Painel da Sala de Espera
-- ------------------------------------------------------------------------------
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  room TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices adicionais para otimização de consultas da fila e métricas
CREATE INDEX idx_encounters_status_priority ON encounters(status, priority_color);
CREATE INDEX idx_encounters_created_at ON encounters(created_at);
CREATE INDEX idx_triages_encounter_id ON triages(encounter_id);
CREATE INDEX idx_prescriptions_encounter_id ON prescriptions(encounter_id);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
