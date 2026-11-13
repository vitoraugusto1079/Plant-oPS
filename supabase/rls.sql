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