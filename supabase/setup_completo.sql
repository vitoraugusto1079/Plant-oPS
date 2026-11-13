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

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION create_encounter(
  p_patient_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW());
  v_next_seq INT;
  v_ticket TEXT;
  v_encounter encounters%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM encounters
    WHERE patient_id = p_patient_id
      AND status NOT IN ('Alta', 'Transferido', 'Cancelado')
  ) THEN
    RAISE EXCEPTION 'Paciente já possui um atendimento ativo em andamento.';
  END IF;

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_next_seq
  FROM encounters
  WHERE created_at >= v_today_start;

  v_ticket := 'A' || LPAD(v_next_seq::TEXT, 3, '0');

  INSERT INTO encounters (
    patient_id,
    ticket_number,
    status
  ) VALUES (
    p_patient_id,
    v_ticket,
    'Aguardando triagem'
  ) RETURNING * INTO v_encounter;

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    v_encounter.id,
    NULL,
    'Aguardando triagem',
    auth.uid(),
    'Abertura do atendimento e geração da senha ' || v_ticket
  );

  RETURN to_jsonb(v_encounter);
END;
$$;

CREATE OR REPLACE FUNCTION save_triage(
  p_encounter_id UUID,
  p_systolic_bp INT,
  p_diastolic_bp INT,
  p_heart_rate INT,
  p_temperature NUMERIC,
  p_oxygen_saturation INT,
  p_pain_scale INT,
  p_consciousness_level TEXT,
  p_chief_complaint TEXT,
  p_suggested_color triage_color,
  p_final_color triage_color,
  p_justification TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter encounters%ROWTYPE;
  v_is_reclassification BOOLEAN := FALSE;
  v_new_status encounter_status;
  v_triage triages%ROWTYPE;
BEGIN
  SELECT * INTO v_encounter
  FROM encounters
  WHERE id = p_encounter_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado.';
  END IF;

  IF v_encounter.status = 'Aguardando triagem' THEN
    v_new_status := 'Aguardando médico';
  ELSIF v_encounter.status IN ('Aguardando médico', 'Aguardando médico (reclassificação)') THEN
    v_new_status := 'Aguardando médico (reclassificação)';
    v_is_reclassification := TRUE;
  ELSE
    RAISE EXCEPTION 'Transição de status inválida para triagem a partir de: %', v_encounter.status;
  END IF;

  IF p_final_color <> p_suggested_color AND (p_justification IS NULL OR trim(p_justification) = '') THEN
    RAISE EXCEPTION 'Justificativa é obrigatória quando a cor final for diferente da sugerida.';
  END IF;

  INSERT INTO triages (
    encounter_id,
    nurse_id,
    systolic_bp,
    diastolic_bp,
    heart_rate,
    temperature,
    oxygen_saturation,
    pain_scale,
    consciousness_level,
    chief_complaint,
    suggested_color,
    final_color,
    justification
  ) VALUES (
    p_encounter_id,
    auth.uid(),
    p_systolic_bp,
    p_diastolic_bp,
    p_heart_rate,
    p_temperature,
    p_oxygen_saturation,
    p_pain_scale,
    p_consciousness_level,
    p_chief_complaint,
    p_suggested_color,
    p_final_color,
    p_justification
  ) RETURNING * INTO v_triage;

  UPDATE encounters
  SET status = v_new_status,
      priority_color = p_final_color,
      triaged_at = COALESCE(triaged_at, NOW())
  WHERE id = p_encounter_id
  RETURNING * INTO v_encounter;

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    p_encounter_id,
    v_encounter.status,
    v_new_status,
    auth.uid(),
    CASE
      WHEN v_is_reclassification THEN 'Reclassificação de risco para ' || p_final_color::TEXT
      ELSE 'Triagem inicial com classificação ' || p_final_color::TEXT
    END
  );

  RETURN to_jsonb(v_encounter);
END;
$$;

CREATE OR REPLACE FUNCTION call_next_patient(
  p_doctor_room TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter_id UUID;
  v_encounter encounters%ROWTYPE;
  v_ticket TEXT;
BEGIN
  IF p_doctor_room IS NULL OR trim(p_doctor_room) = '' THEN
    RAISE EXCEPTION 'O consultório médico deve ser informado.';
  END IF;

  SELECT e.id INTO v_encounter_id
  FROM encounters e
  INNER JOIN patients p ON e.patient_id = p.id
  WHERE e.status IN ('Aguardando médico', 'Aguardando médico (reclassificação)')
  ORDER BY
    CASE e.priority_color
      WHEN 'Vermelho' THEN 1
      WHEN 'Laranja'  THEN 2
      WHEN 'Amarelo'  THEN 3
      WHEN 'Verde'    THEN 4
      WHEN 'Azul'     THEN 5
      ELSE 6
    END ASC,
    e.triaged_at ASC,
    CASE
      WHEN (EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) >= 60 OR EXTRACT(YEAR FROM age(CURRENT_DATE, p.birth_date)) < 12) THEN 0
      ELSE 1
    END ASC,
    e.created_at ASC
  LIMIT 1
  FOR UPDATE OF e SKIP LOCKED;

  IF v_encounter_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nenhum paciente aguardando atendimento.');
  END IF;

  UPDATE encounters
  SET status = 'Em atendimento',
      doctor_id = auth.uid(),
      doctor_room = p_doctor_room,
      called_at = NOW()
  WHERE id = v_encounter_id
  RETURNING * INTO v_encounter;

  INSERT INTO calls (
    encounter_id,
    ticket_number,
    room
  ) VALUES (
    v_encounter.id,
    v_encounter.ticket_number,
    p_doctor_room
  );

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    v_encounter.id,
    'Aguardando médico',
    'Em atendimento',
    auth.uid(),
    'Paciente chamado para o ' || p_doctor_room
  );

  RETURN jsonb_build_object(
    'success', true,
    'encounter', to_jsonb(v_encounter)
  );
END;
$$;

CREATE OR REPLACE FUNCTION prescribe_medication(
  p_encounter_id UUID,
  p_medication_id UUID,
  p_dose NUMERIC,
  p_unit TEXT,
  p_route TEXT,
  p_frequency TEXT,
  p_instructions TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter encounters%ROWTYPE;
  v_medication medications%ROWTYPE;
  v_allergy_match TEXT;
  v_prescription prescriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_encounter FROM encounters WHERE id = p_encounter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado.';
  END IF;

  IF v_encounter.status NOT IN ('Em atendimento', 'Em observação') THEN
    RAISE EXCEPTION 'Prescrição permitida apenas para atendimentos Em atendimento ou Em observação.';
  END IF;

  SELECT * INTO v_medication FROM medications WHERE id = p_medication_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medicamento não cadastrado no catálogo.';
  END IF;

  SELECT a.allergen_name INTO v_allergy_match
  FROM patient_allergies a
  WHERE a.patient_id = v_encounter.patient_id
    AND (
      LOWER(v_medication.name) LIKE '%' || LOWER(a.allergen_name) || '%'
      OR LOWER(a.allergen_name) LIKE '%' || LOWER(v_medication.name) || '%'
    )
  LIMIT 1;

  IF v_allergy_match IS NOT NULL THEN
    RAISE EXCEPTION 'BLOQUEIO DE SEGURANÇA: Paciente possui alergia conhecida a "%". Prescrição bloqueada!', v_allergy_match;
  END IF;

  IF p_dose > v_medication.max_dose THEN
    RAISE EXCEPTION 'BLOQUEIO DE SEGURANÇA: Dose informada (% %) excede a dose máxima permitida (% %)! Prescrição bloqueada.',
      p_dose, p_unit, v_medication.max_dose, v_medication.unit;
  END IF;

  INSERT INTO prescriptions (
    encounter_id,
    medication_id,
    doctor_id,
    dose,
    unit,
    route,
    frequency,
    instructions
  ) VALUES (
    p_encounter_id,
    p_medication_id,
    auth.uid(),
    p_dose,
    p_unit,
    p_route,
    p_frequency,
    p_instructions
  ) RETURNING * INTO v_prescription;

  RETURN to_jsonb(v_prescription);
END;
$$;

CREATE OR REPLACE FUNCTION conclude_medical_encounter(
  p_encounter_id UUID,
  p_destination patient_destination,
  p_evolution TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter encounters%ROWTYPE;
  v_new_status encounter_status;
  v_active_bed_assignment_id UUID;
  v_active_bed_id UUID;
BEGIN
  SELECT * INTO v_encounter FROM encounters WHERE id = p_encounter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado.';
  END IF;

  IF v_encounter.status NOT IN ('Em atendimento', 'Em observação') THEN
    RAISE EXCEPTION 'Atendimento não está em fase médica (atual: %)', v_encounter.status;
  END IF;

  IF p_destination = 'alta' THEN
    v_new_status := 'Alta';
  ELSIF p_destination = 'transferência' THEN
    v_new_status := 'Transferido';
  ELSIF p_destination IN ('observação', 'internação') THEN
    IF v_encounter.status = 'Em observação' THEN
      v_new_status := 'Em observação';
    ELSE
      v_new_status := 'Aguardando leito';
    END IF;
  ELSE
    RAISE EXCEPTION 'Destino inválido: %', p_destination;
  END IF;

  IF v_new_status IN ('Alta', 'Transferido') THEN
    SELECT id, bed_id INTO v_active_bed_assignment_id, v_active_bed_id
    FROM bed_assignments
    WHERE encounter_id = p_encounter_id AND discharged_at IS NULL;

    IF v_active_bed_assignment_id IS NOT NULL THEN
      UPDATE bed_assignments
      SET discharged_at = NOW()
      WHERE id = v_active_bed_assignment_id;

      UPDATE beds
      SET status = 'em_limpeza'
      WHERE id = v_active_bed_id;
    END IF;
  END IF;

  UPDATE encounters
  SET status = v_new_status,
      destination = p_destination,
      evolution = COALESCE(p_evolution, evolution),
      completed_at = CASE WHEN v_new_status IN ('Alta', 'Transferido') THEN NOW() ELSE completed_at END
  WHERE id = p_encounter_id
  RETURNING * INTO v_encounter;

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    v_encounter.id,
    v_encounter.status,
    v_new_status,
    auth.uid(),
    'Conduta médica definida: ' || p_destination::TEXT
  );

  RETURN to_jsonb(v_encounter);
END;
$$;

CREATE OR REPLACE FUNCTION assign_bed(
  p_encounter_id UUID,
  p_bed_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter encounters%ROWTYPE;
  v_bed beds%ROWTYPE;
  v_assignment bed_assignments%ROWTYPE;
BEGIN
  SELECT * INTO v_encounter FROM encounters WHERE id = p_encounter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado.';
  END IF;

  IF v_encounter.status <> 'Aguardando leito' THEN
    RAISE EXCEPTION 'Apenas pacientes com status "Aguardando leito" podem ser alocados em leitos (atual: %).', v_encounter.status;
  END IF;

  SELECT * INTO v_bed FROM beds WHERE id = p_bed_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito não encontrado.';
  END IF;

  IF v_bed.status <> 'livre' THEN
    RAISE EXCEPTION 'Operação concorrente bloqueada: Leito "%" não está livre (status atual: %)', v_bed.name, v_bed.status;
  END IF;

  UPDATE beds SET status = 'ocupado' WHERE id = p_bed_id;

  INSERT INTO bed_assignments (
    bed_id,
    encounter_id,
    admitted_at,
    created_by
  ) VALUES (
    p_bed_id,
    p_encounter_id,
    NOW(),
    auth.uid()
  ) RETURNING * INTO v_assignment;

  UPDATE encounters
  SET status = 'Em observação'
  WHERE id = p_encounter_id
  RETURNING * INTO v_encounter;

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    p_encounter_id,
    'Aguardando leito',
    'Em observação',
    auth.uid(),
    'Paciente alocado no leito ' || v_bed.name || ' (' || v_bed.ward::TEXT || ')'
  );

  RETURN jsonb_build_object(
    'encounter', to_jsonb(v_encounter),
    'bed_assignment', to_jsonb(v_assignment)
  );
END;
$$;

CREATE OR REPLACE FUNCTION clean_bed(
  p_bed_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bed beds%ROWTYPE;
BEGIN
  SELECT * INTO v_bed FROM beds WHERE id = p_bed_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leito não encontrado.';
  END IF;

  IF v_bed.status <> 'em_limpeza' THEN
    RAISE EXCEPTION 'Apenas leitos com status "em_limpeza" podem ser liberados após higienização (status atual: %).', v_bed.status;
  END IF;

  UPDATE beds
  SET status = 'livre'
  WHERE id = p_bed_id
  RETURNING * INTO v_bed;

  RETURN to_jsonb(v_bed);
END;
$$;

CREATE OR REPLACE FUNCTION cancel_encounter(
  p_encounter_id UUID,
  p_reason TEXT DEFAULT 'Desistência do paciente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_encounter encounters%ROWTYPE;
BEGIN
  SELECT * INTO v_encounter FROM encounters WHERE id = p_encounter_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atendimento não encontrado.';
  END IF;

  IF v_encounter.status NOT IN ('Aguardando triagem', 'Aguardando médico', 'Aguardando médico (reclassificação)') THEN
    RAISE EXCEPTION 'Cancelamento não permitido para atendimentos na situação atual: %', v_encounter.status;
  END IF;

  UPDATE encounters
  SET status = 'Cancelado',
      completed_at = NOW()
  WHERE id = p_encounter_id
  RETURNING * INTO v_encounter;

  INSERT INTO encounter_events (
    encounter_id,
    from_status,
    to_status,
    created_by,
    notes
  ) VALUES (
    v_encounter.id,
    v_encounter.status,
    'Cancelado',
    auth.uid(),
    p_reason
  );

  RETURN to_jsonb(v_encounter);
END;
$$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE triages ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bed_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os usuários autenticados podem ver perfis"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas administradores podem atualizar perfis"
  ON profiles FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Profissionais podem ler pacientes (painel bloqueado)"
  ON patients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Recepção e enfermagem podem cadastrar pacientes"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem')
    )
  );

CREATE POLICY "Recepção e enfermagem podem atualizar dados do paciente"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem')
    )
  );

CREATE POLICY "Profissionais podem visualizar alergias"
  ON patient_allergies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Recepção, enfermagem e médicos podem cadastrar alergias"
  ON patient_allergies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem', 'medico')
    )
  );

CREATE POLICY "Profissionais podem consultar atendimentos"
  ON encounters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('recepcao', 'enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Recepção pode criar atendimentos"
  ON encounters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'recepcao'
    )
  );

CREATE POLICY "Apenas enfermagem, médicos e gestão podem ler triagens"
  ON triages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Apenas enfermagem pode inserir triagens"
  ON triages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'enfermagem'
    )
  );

CREATE POLICY "Equipe técnica e gestão podem ver histórico de eventos"
  ON encounter_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Usuários autenticados podem inserir eventos de atendimento"
  ON encounter_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados podem ler catálogo de medicamentos"
  ON medications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Apenas médicos, enfermagem e gestão podem ler prescrições"
  ON prescriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('medico', 'enfermagem', 'gestao')
    )
  );

CREATE POLICY "Somente usuários com perfil de médico podem registrar prescrições"
  ON prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'medico'
    )
  );

CREATE POLICY "Equipe médica, enfermagem e gestão podem ler leitos"
  ON beds FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Enfermagem pode atualizar status dos leitos (limpeza)"
  ON beds FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico')
    )
  );

CREATE POLICY "Equipe pode consultar alocações de leitos"
  ON bed_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('enfermagem', 'medico', 'gestao')
    )
  );

CREATE POLICY "Todos os usuários autenticados (incluindo painel) podem ler chamadas"
  ON calls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Médicos podem gerar novas chamadas"
  ON calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'medico'
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE triages;
ALTER PUBLICATION supabase_realtime ADD TABLE beds;
ALTER PUBLICATION supabase_realtime ADD TABLE bed_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role user_role := 'recepcao';
  v_name TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    v_role := (NEW.raw_user_meta_data->>'role')::user_role;
  ELSIF NEW.email LIKE '%recepcao%' THEN
    v_role := 'recepcao';
  ELSIF NEW.email LIKE '%enfermagem%' THEN
    v_role := 'enfermagem';
  ELSIF NEW.email LIKE '%medico%' THEN
    v_role := 'medico';
  ELSIF NEW.email LIKE '%gestao%' THEN
    v_role := 'gestao';
  ELSIF NEW.email LIKE '%painel%' THEN
    v_role := 'painel';
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, v_name, v_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO medications (name, max_dose, unit, default_route) VALUES
  ('Dipirona', 1000.00, 'mg', 'Intravenosa (EV)'),
  ('Paracetamol', 1000.00, 'mg', 'Oral'),
  ('Morfina', 10.00, 'mg', 'Intravenosa (EV)'),
  ('Tramadol', 100.00, 'mg', 'Intravenosa (EV)'),
  ('Amoxicilina', 875.00, 'mg', 'Oral'),
  ('Ceftriaxona', 2000.00, 'mg', 'Intravenosa (EV)'),
  ('Diazepam', 10.00, 'mg', 'Intravenosa (EV)'),
  ('Fentanil', 100.00, 'mcg', 'Intravenosa (EV)'),
  ('Ondansetrona', 8.00, 'mg', 'Intravenosa (EV)'),
  ('Cetoprofeno', 100.00, 'mg', 'Intravenosa (EV)'),
  ('Insulina Regular', 20.00, 'UI', 'Subcutânea (SC)')
ON CONFLICT (name) DO UPDATE
SET max_dose = EXCLUDED.max_dose,
    unit = EXCLUDED.unit,
    default_route = EXCLUDED.default_route;

INSERT INTO beds (name, ward, status) VALUES
  ('Leito Vermelho 01', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 02', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 03', 'Sala Vermelha', 'livre'),
  ('Leito Vermelho 04', 'Sala Vermelha', 'livre'),
  ('Leito Observação 01', 'Observação', 'livre'),
  ('Leito Observação 02', 'Observação', 'livre'),
  ('Leito Observação 03', 'Observação', 'livre'),
  ('Leito Observação 04', 'Observação', 'livre'),
  ('Leito Observação 05', 'Observação', 'livre'),
  ('Leito Observação 06', 'Observação', 'livre')
ON CONFLICT DO NOTHING;

INSERT INTO patients (id, name, birth_date, gender, phone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'João da Silva Sauro', '1952-04-10', 'M', '(11) 98765-4321'),
  ('22222222-2222-2222-2222-222222222222', 'Mariana Oliveira Santos', '2019-08-15', 'F', '(11) 97654-3210'),
  ('33333333-3333-3333-3333-333333333333', 'Carlos Eduardo Lima', '1990-11-20', 'M', '(11) 96543-2109'),
  ('44444444-4444-4444-4444-444444444444', 'Ana Paula Ferreira', '1985-03-30', 'F', '(11) 95432-1098'),
  ('55555555-5555-5555-5555-555555555555', 'Roberto Mendes Costa', '1945-09-05', 'M', '(11) 94321-0987')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patient_allergies (patient_id, allergen_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dipirona'),
  ('22222222-2222-2222-2222-222222222222', 'Amoxicilina'),
  ('33333333-3333-3333-3333-333333333333', 'Morfina')
ON CONFLICT DO NOTHING;
