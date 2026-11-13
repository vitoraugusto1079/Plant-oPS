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
