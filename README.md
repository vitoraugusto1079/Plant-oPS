# 🏥 PlantãoPS - Cada Minuto Conta!

Sistema de Pronto-Socorro desenvolvido em **React**, **TypeScript** e **Supabase**, projetado para gerenciar e otimizar todo o fluxo de atendimento hospitalar, desde a recepção e acolhimento do paciente até a alta médica ou internação.

---

## 📋 Sumário
- [Arquitetura e Organização](#-arquitetura-e-organização)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Perfis de Acesso](#-perfis-de-acesso)
- [Instruções para Criação do Banco de Dados](#-instruções-para-criação-do-banco-de-dados)
- [Configuração das Variáveis de Ambiente](#-configuração-das-variáveis-de-ambiente)
- [Instalação e Execução](#-instalação-e-execução)
- [Executando os Testes Automatizados](#-executando-os-testes-automatizados)
- [Usuários de Teste por Perfil](#-usuários-de-teste-por-perfil)

---

## 🏛️ Arquitetura e Organização

O projeto segue uma arquitetura em camadas bem definida, garantindo desacoplamento entre regras de negócio, serviços de infraestrutura e componentes de apresentação:

```
PlantãoPS/
├── src/
│   ├── domain/               # Regras de negócio puras (classificação, ordenação, transições, validações)
│   │   ├── types.ts          # Definições de tipos e interfaces do domínio
│   │   ├── triage.ts         # Classificação de risco Manchester Simplificado (funções puras)
│   │   ├── queue.ts          # Algoritmo de ordenação e desempate etário da fila
│   │   ├── transitions.ts    # Máquina de estados das transições permitidas e proibidas
│   │   └── prescription.ts   # Validações de dose máxima e alergias
│   ├── services/             # Camada de comunicação com o Supabase e chamadas RPC
│   │   ├── supabaseClient.ts # Inicialização segura do cliente Supabase (chave anon)
│   │   ├── authService.ts    # Login, sessão e perfil do profissional
│   │   ├── patientService.ts # Cadastro, busca e alergias de pacientes
│   │   ├── encounterService.ts # Abertura com senha, fila, triagem e conduta médica
│   │   ├── medicationService.ts# Catálogo de remédios e prescrições médicas
│   │   ├── bedService.ts     # Gestão, alocação concorrente e limpeza de leitos
│   │   ├── callService.ts    # Histórico de chamadas da TV e médias de espera
│   │   └── managementService.ts # Métricas e indicadores clínicos para a gestão
│   ├── hooks/                # Hooks personalizados reutilizáveis
│   │   ├── useAuth.ts        # Gerenciamento de sessão, perfil e permissões de acesso
│   │   ├── useQueue.ts       # Fila em tempo real ordenada com filtros por cor
│   │   └── useRealtimeTable.ts # Sincronização automática com TanStack Query e Realtime
│   ├── components/           # Componentes reutilizáveis
│   │   ├── RiskBadge.tsx     # Badge com cor e texto acessível (suporte a daltonismo)
│   │   ├── QueueItem.tsx     # Item da fila com tempo decorrido e queixa
│   │   ├── WaitTimer.tsx     # Contador de espera com destaque visual de atraso
│   │   ├── VitalSignsForm.tsx# Formulário de sinais vitais com React Hook Form + Zod
│   │   ├── BedTile.tsx       # Visualização e alocação de leitos (drag-and-drop)
│   │   ├── StatCard.tsx      # Indicador analítico para dashboards
│   │   └── ConfirmModal.tsx  # Diálogo de confirmação para ações críticas
│   ├── pages/                # Telas especializadas por perfil
│   │   ├── LoginPage.tsx     # Autenticação e seleção de perfil
│   │   ├── ReceptionPage.tsx # Recepção: cadastro e abertura de senhas
│   │   ├── TriagePage.tsx    # Triagem clínica e reclassificação de risco
│   │   ├── QueuePage.tsx     # Fila geral de atendimento em tempo real
│   │   ├── DoctorPage.tsx    # Consultório médico, evolução e prescrição
│   │   ├── BedMapPage.tsx    # Mapa das alas Sala Vermelha e Observação
│   │   ├── ManagementPage.tsx# Indicadores de gestão hospitalar e exportação CSV
│   │   ├── KioskPanelPage.tsx# Painel TV sem nomes (privacidade) com alerta sonoro
│   │   ├── EncounterDetailPage.tsx # Linha do tempo e detalhes do atendimento
│   │   ├── PatientDetailPage.tsx   # Ficha cadastral e histórico do paciente
│   │   └── NotFoundPage.tsx  # Tratamento de rota 404
│   ├── layouts/              # Layouts protegidos e modo quiosque
│   │   ├── ProtectedRoute.tsx# Controle de acesso estrito baseado em RBAC
│   │   ├── MainLayout.tsx    # Barra superior com navegação por perfil
│   │   └── KioskLayout.tsx   # Modo tela cheia sem menus para TVs
│   └── tests/                # Suíte de testes automatizados com Vitest e Testing Library
├── supabase/                 # Scripts SQL para recriação integral do banco
│   ├── schema.sql            # Tabelas, tipos ENUM, chaves estrangeiras e índices únicos
│   ├── rpc.sql               # Stored procedures atômicas em PL/pgSQL
│   ├── rls.sql               # Políticas de segurança Row-Level Security por perfil
│   ├── triggers.sql          # Triggers de sincronização e auditoria
│   └── seed.sql              # Catálogo de medicamentos, leitos e pacientes fictícios
├── package.json
└── README.md
```

---

## 🚀 Funcionalidades Principais

1. **Recepção:**
   - Busca inteligente de pacientes já cadastrados por nome ou data de nascimento.
   - Cadastro ágil com validação de campos obrigatórios e alergias conhecidas.
   - Abertura de atendimento gerando a próxima **senha sequencial diária** (ex: `A001`, `A023`).
   - Bloqueio no banco e na interface que impede atendimentos duplicados simultâneos para o mesmo paciente.

2. **Triagem de Enfermagem (Protocolo Manchester Simplificado):**
   - Fila de acolhimento ordenada por tempo de chegada.
   - Registro estruturado de sinais vitais (PA, FC, Temperatura, Saturação O₂, Dor 0-10, Nível de Consciência e Queixa).
   - **Sugestão automática da cor de risco** baseada nos critérios mais graves.
   - Possibilidade de confirmação ou alteração da cor com **justificativa obrigatória**.
   - Suporte a **reclassificação de risco** em pacientes que já estão aguardando, preservando todo o histórico.

3. **Fila Médica em Tempo Real:**
   - Ordenação estrita por gravidade clínica: **Vermelho > Laranja > Amarelo > Verde > Azul**.
   - Desempate por maior tempo de espera na mesma cor.
   - Critério legal de desempate: prioridade para idosos (≥ 60 anos) e crianças (< 12 anos).
   - Destaque visual imediato quando o tempo limite de atendimento da cor é ultrapassado.
   - Filtros instantâneos por cor e indicadores de total por classificação.

4. **Atendimento Médico e Segurança do Paciente:**
   - Botão atômico **"Chamar Próximo"** utilizando `FOR UPDATE SKIP LOCKED` (dois médicos chamando ao mesmo tempo nunca recebem o mesmo paciente).
   - Tela de atendimento exibindo resumo da triagem, sinais vitais, histórico de passagens anteriores e destaque para alergias.
   - Registro de evolução clínica em texto livre.
   - Prescrição a partir de catálogo oficial de medicamentos com **dupla validação no cliente e no banco**:
     - Bloqueio se o paciente possuir alergia relatada ao medicamento.
     - Bloqueio se a dosagem ultrapassar o teto máximo cadastrado no catálogo.
   - Definição do destino: Alta, Observação, Internação ou Transferência.

5. **Mapa de Leitos e Prevenção de Conflitos Concorrentes:**
   - Visualização das alas **Sala Vermelha** e **Observação**.
   - Status dos leitos: `livre`, `ocupado`, `em_limpeza` e `bloqueado`.
   - Alocação via *drag-and-drop* com trava transacional no banco (apenas um usuário consegue ocupar um leito disputado simultaneamente).
   - Alta/transferência envia o leito automaticamente para `em_limpeza`, liberado apenas após higienização pela enfermagem.

6. **Painel TV Quiosque (Sala de Espera):**
   - Modo tela cheia sem menus com tipografia ampliada de alta visibilidade.
   - Destaque para a chamada atual (Senha + Consultório) e lista das últimas 5 chamadas.
   - **Privacidade total**: nomes de pacientes nunca são exibidos.
   - Exibição do tempo médio de espera atual por cor.
   - Alerta sonoro sutil gerado via Web Audio API a cada nova chamada.

7. **Painel da Gestão Hospitalar:**
   - Atendimentos por hora no dia (histograma 00:00 às 23:00).
   - Distribuição de atendimentos por cor de risco.
   - Comparativo do tempo médio de espera vs. tempo máximo permitido.
   - Percentual de pacientes atendidos fora do prazo estipulado.
   - Taxa de ocupação dos leitos hospitalares.
   - Filtros por período: Hoje, Últimos 7 dias e Últimos 30 dias.
   - Exportação completa dos relatórios em formato CSV.

---

## 🔒 Perfis de Acesso

| Perfil | Acesso Permitido | Restrições RLS |
| :--- | :--- | :--- |
| **Recepção** | Cadastro de pacientes, abertura de atendimentos e listagem do dia. | Não tem acesso a triagens clínicas, evoluções nem prescrições. |
| **Enfermagem** | Triagem, reclassificação, fila geral, mapa de leitos e liberação pós-limpeza. | Não pode prescrever medicamentos nem definir conduta médica final. |
| **Médico** | Fila de atendimento, chamar próximo, consulta, prescrição e destino. | Somente médicos podem prescrever e registrar evolução clínica. |
| **Gestão** | Indicadores hospitalares, ocupação de leitos e exportação de dados. | Somente leitura de dados agregados e métricas clínicas. |
| **Painel** | Tela de chamadas da sala de espera (modo quiosque). | Enxerga exclusivamente a tabela de chamadas (sem dados pessoais). |

---

## 🗄️ Instruções para Criação do Banco de Dados

Todos os scripts SQL necessários para recriar o banco do zero estão disponíveis na pasta `supabase/`:

1. Acesse o console do seu projeto no **[Supabase](https://supabase.com)**.
2. Navegue até o menu lateral **SQL Editor**.
3. Execute os arquivos na seguinte sequência:
   - **`supabase/schema.sql`**: Criação de tipos ENUM, tabelas, chaves estrangeiras e índices únicos parciais.
   - **`supabase/rpc.sql`**: Criação das funções atômicas PL/pgSQL (`create_encounter`, `save_triage`, `call_next_patient`, `prescribe_medication`, `assign_bed`, `clean_bed`, `conclude_medical_encounter`, `cancel_encounter`).
   - **`supabase/rls.sql`**: Ativação do Row-Level Security em todas as tabelas e publicação no canal Realtime.
   - **`supabase/triggers.sql`**: Trigger para associação automática do perfil de usuário na criação de contas.
   - **`supabase/seed.sql`**: Carga inicial do catálogo de medicamentos, leitos das alas e pacientes de teste.

---

## ⚙️ Configuração das Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as credenciais anônimas do seu Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

> ⚠️ **IMPORTANTE:** A chave `service_role` **NUNCA** deve ser inserida no frontend ou no repositório.

---

## 💻 Instalação e Execução

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse a aplicação no navegador em `http://localhost:5173`.

---

## 🧪 Executando os Testes Automatizados

O projeto conta com suítes de testes unitários e de integração utilizando **Vitest** e **Testing Library**:

```bash
# Executa todos os testes automatizados
npm test

# Executa em modo interativo (watch)
npm run test:watch
```

### Cobertura de Testes:
- **Classificação de Risco:** Teste de todas as 5 cores (Vermelho, Laranja, Amarelo, Verde, Azul) e valores-limite de cada critério clínico.
- **Ordenação da Fila:** Prioridade por cor, maior tempo de espera e desempate por faixa etária (idosos e crianças).
- **Máquina de Estados:** Todas as transições de situação permitidas e bloqueio das proibidas.
- **Prescrição Segura:** Bloqueio por alergia conhecida e bloqueio por superdosagem (> dose máxima).
- **Componentes Visuais:** Renderização de sinais vitais, cálculo dinâmico de sugestão e acessibilidade para pessoas com daltonismo.

---

## 👥 Usuários de Teste por Perfil

Para validar o fluxo completo entre múltiplos perfis, crie as contas correspondentes no menu **Authentication > Users** do Supabase ou utilize a tela de login:

| Perfil | E-mail Sugerido | Senha Sugerida |
| :--- | :--- | :--- |
| **Recepção** | `recepcao@plantaops.com` | `senha123` |
| **Enfermagem** | `enfermagem@plantaops.com` | `senha123` |
| **Médico** | `medico@plantaops.com` | `senha123` |
| **Gestão** | `gestao@plantaops.com` | `senha123` |
| **Painel TV** | `painel@plantaops.com` | `senha123` |
