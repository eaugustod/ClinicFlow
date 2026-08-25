# Manual de Uso — Painel de Fechamentos e Conferência da Gestão

**Projeto:** ClinicFlow (`clinicflow-app`)  
**Público-alvo:** Equipe Financeira, Administrativa e Gestores da Clínica  
**Objetivo:** Operacionalizar a abertura do período de conferência, analisar contestações enviadas por terapeutas, efetuar o fechamento oficial congelado e integrá-lo ao repasse financeiro.

---

## 1. Visão Geral e Benefícios

O **Painel de Fechamentos (Conferência)** centraliza todo o fluxo de reconciliação financeira entre a clínica e os terapeutas. Em vez de a equipe administrativa conferir manualmente prontuários e planilhas paralelas, a própria plataforma coloca os terapeutas para auditarem os atendimentos que eles mesmos lançaram. A gestão atua **exclusivamente nas divergências pontuais (contestações)**.

---

## 2. Como Acessar

1. Acesse o **ClinicFlow** com seu usuário administrativo.
2. No menu lateral, acesse **Fechamento** e clique em **Análise do Fechamento**.
3. Na barra de topo, certifique-se de estar na aba **Painel de Fechamentos (Tela 5.2)**.
4. Selecione o **Mês/Ano** de competência no filtro superior (ex: `2026-08`).

---

## 3. Ciclo de Vida do Fechamento (5 Estados)

Cada terapeuta passa pelos seguintes estados no mês:

| Estado | Descrição | Quem Atua |
|---|---|---|
| `nao_iniciado` | Conferência do mês ainda não foi aberta para o terapeuta. | Gestão |
| `aberto_para_conferencia` | Terapeuta pode auditar suas sessões pelo app Agenda Terapeuta. | Terapeuta |
| `contestado` | Terapeuta contestou um ou mais itens e aguarda decisão da gestão. | Gestão |
| `aprovado_pelo_terapeuta` | Terapeuta conferiu 100% dos itens, não há pendências e aprovou o total. | Gestão |
| `fechado_pela_clinica` | Gestão oficializou o fechamento do mês (edições congeladas). | Sistema |

---

## 4. Passo a Passo da Rotina Administrativa

### Passo 1: Abertura da Conferência Mensal
No início de cada mês (ou período de apuração):
1. Selecione o mês no filtro superior.
2. Para abrir a conferência de **todos os terapeutas** de uma só vez, clique no botão azul **Abrir Todos**.
3. Para abrir individualmente para um terapeuta específico, clique em **Abrir Conferência** no card do profissional.
4. O status mudará para `Aberto` e os terapeutas já visualizarão as sessões em seus aplicativos.

### Passo 2: Acompanhamento da Fila de Terapeutas
- A lista de terapeutas na coluna esquerda é **ordenada automaticamente por quantidade de contestações (decrescente)**. Terapeutas com itens em `Em Contestação` aparecem no topo da lista para priorização.
- Cada card exibe: Total de Atendimentos, Qtd. Pendentes, Qtd. Contestados, Status do Período e Valor Total Calculado.

### Passo 3: Resolução de Contestações
1. Clique sobre o terapeuta desejado para abrir o painel detalhado de atendimentos na coluna direita.
2. Os itens com divergência estarão destacados em tom abóbora com status `Aguardando Análise` ou `Em Contestação`.
3. Analise lado a lado:
   - O registro original no sistema (data, hora, paciente, plano e valor calculado).
   - A alegação do terapeuta (motivo da contestação, observação escrita e paciente/data sugeridos se for sessão ausente).
4. Escolha uma das ações:
   - **Botão Ajustar**: Se a reclamação do terapeuta for procedente, informe o **Novo Valor Ajustado (R$)**, preencha a **Justificativa da Gestão** e confirme. O item passa para `Ajustado`.
   - **Botão Manter**: Se o registro do sistema estiver correto, preencha a **Justificativa da Gestão** explicando o motivo do indeferimento e confirme. O item passa para `Mantido Original`.

> [!IMPORTANT]
> O preenchimento da **Justificativa / Observação da Gestão** é obrigatório em ambas as decisões. Essa mensagem ficará visível para o terapeuta no app dele.

### Passo 4: Reabertura de Itens (Função Administrativa)
Caso um terapeuta confirme um atendimento por engano e peça para corrigir, apenas a gestão pode reabrir:
1. No painel de itens do terapeuta, localize o atendimento confirmado.
2. Clique no botão **Reabrir**. O item retornará para o status `Pendente` para o terapeuta.

### Passo 5: Consulta da Trilha de Auditoria
Para consultar qualquer histórico de alteração em uma sessão:
1. Clique no ícone de histórico (🕒 **History**) na linha do atendimento.
2. O sistema exibirá o histórico cronológico completo: quem alterou (terapeuta, gestão ou sistema), data/hora exata, valores anteriores e novos, e as observações registradas.

### Passo 6: Fechamento Oficial da Clínica (`fechado_pela_clinica`)
Quando o terapeuta aprova a conferência no aplicativo dele:
1. O status do terapeuta no ClinicFlow mudará para **Aprovado Terapeuta** (destacado em verde).
2. O botão verde **Efetuar Fechamento Oficial** (🔒) estará habilitado.
3. Clique no botão e confirme a mensagem.
4. O sistema irá:
   - Recalcular e congelar o `valor_total_calculado` exato (somando valores originais e ajustados).
   - Bloquear qualquer nova edição de itens ou contestações naquele período.
   - Atualizar a data e o usuário responsável pelo fechamento.

---

## 5. Integração com as Demais Rotinas do Fechamento no ClinicFlow

O módulo de Conferência de Fechamento está **100% integrado** à estrutura financeira pré-existente do ClinicFlow:

### 1. Integração com a Aba Calculo e Repasses (`Fechamento.tsx`)
- O valor final apurado na conferência (`valor_total_calculado`) alimenta diretamente o controle de **Pagamento de Terapeutas** (`pagamentos_terapeutas`).
- A conferência respeita a segregação por convênio/plano (Bradesco, Unimed, Particular) e as durações registradas (30 min / 60 min).
- Havendo descontos ou adicionais de meses anteriores, estes continuam sendo aplicados de forma transparente no cálculo consolidado de repasse.

### 2. Integração com a Análise de Consultas (`AnaliseFechamento.tsx`)
- O usuário administrativo pode alternar entre a visão de **Painel de Fechamentos (Tela 5.2)** e a visão de **Análise Individual de Consultas**, permitindo consultar ou alterar status brutos de agendamentos no Supabase quando necessário.

### 3. Integração com o Fluxo de Caixa e DRE (`FinanceiroFluxoCaixa.tsx`)
- Ao efetuar o pagamento do repasse após o fechamento oficial da clínica, o lançamento no contas a pagar do fluxo de caixa referencia o valor auditado e fechado na conferência, garantindo consistência total no DRE.
