-- ==============================================================================
-- PlantãoPS - Políticas de Segurança Row-Level Security (RLS)
-- O cliente é considerado NÃO CONFIÁVEL: as restrições são impostas no banco.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Habilitar RLS em TODAS as tabelas do sistema
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 1. Tabela PROFILES
-- Usuários podem ver perfis dos profissionais (para identificação em telas).
-- Usuários não podem alterar seu próprio perfil de cargo/função (item 2.1).
-- ------------------------------------------------------------------------------
CREATE POLICY "Todos os usuários autenticados podem ver perfis"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas administradores podem atualizar perfis"
  ON profiles FOR UPDATE
  TO authenticated
  USING (false); -- Não permite alteração direta pelo usuário

-- ------------------------------------------------------------------------------
-- 2. Tabela PATIENTS
-- O perfil 'painel' NUNCA enxerga dados de pacientes (item 3.7).
-- Recepção, Enfermagem, Médico e Gestão podem visualizar.
-- Recepção pode inserir/atualizar dados cadastrais.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. Tabela PATIENT_ALLERGIES
-- Painel não enxerga. Recepção, Enfermagem, Médico e Gestão podem ver.
-- Recepção e Enfermagem e Médico podem cadastrar alergias.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. Tabela ENCOUNTERS
-- O perfil 'painel' não pode selecionar da tabela de atendimentos diretamente.
-- Recepção não pode ler o campo de evolução médica (ocultado via view ou nulo para recepção).
-- ------------------------------------------------------------------------------
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

-- Abertura e atualizações de atendimentos são gerenciadas primordialmente via RPC
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

-- ------------------------------------------------------------------------------
-- 5. Tabela TRIAGES
-- REGRA RLS OBRIGATÓRIA (item 3.7): "A recepção não pode ler triagens"
-- O perfil 'painel' também não pode ler.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 6. Tabela ENCOUNTER_EVENTS (Auditoria)
-- Visualização por enfermagem, médicos e gestão.
-- Inserções via funções de domínio.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 7. Tabela MEDICATIONS (Catálogo)
-- Leitura pública para autenticados médicos e gestão.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 8. Tabela PRESCRIPTIONS
-- REGRA RLS OBRIGATÓRIA (item 3.7):
-- "A recepção não pode ler evoluções nem prescrições."
-- "Somente usuários com perfil de médico podem registrar prescrições e evoluções."
-- "Logado como recepção, consulta direta à tabela de prescrições retorna vazio/erro."
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 9. Tabela BEDS
-- Enfermagem, médicos e gestão podem ver e gerenciar leitos.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 10. Tabela BED_ASSIGNMENTS
-- Enfermagem, médicos e gestão podem ler ocupações de leitos.
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 11. Tabela CALLS (Painel da Sala de Espera)
-- REGRA OBRIGATÓRIA (item 3.7):
-- "O perfil do painel só enxerga as chamadas (senha e consultório), nunca dados pessoais."
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- Publicação em Realtime (Supabase Realtime)
-- Habilita escuta em tempo real nas tabelas vitais para fila, leitos e chamadas
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE triages;
ALTER PUBLICATION supabase_realtime ADD TABLE beds;
ALTER PUBLICATION supabase_realtime ADD TABLE bed_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE calls;
