# PLANO DIRETOR DE IMPLEMENTAÇÃO NO CLINICFLOW
## Módulo de Gestão de Anexos Clínicos e Documentos para Autorização de Convênios (Amil & Demais Operadoras)

**Versão:** 1.0  
**Data:** 12 de Outubro de 2026  
**Status:** Proposta Técnica para Aprovação Prévia  
**Ambiente:** ClinicFlow Web App + Supabase (PostgreSQL / Storage)  
**Integração:** ClinicFlow RPA (`apps/worker-autorizacao`)

---

## 1. RESUMO EXECUTIVO & OBJETIVO

Para que o robô de automação RPA ([`apps/worker-autorizacao`](file:///home/eduardo/Documentos/Projetos_Kosmos/clinicflow-rpa/apps/worker-autorizacao/src/index.js)) execute com sucesso a emissão de guias e senhas SADT junto à **Amil** e outras operadoras com Diretrizes de Utilização (DUT/ANS), é indispensável submeter arquivos comprobatórios (Relatório Médico, Pedido Médico, Laudos de Avaliação e Exames de Patologia).

Atualmente, o **ClinicFlow** não possui uma interface ou repositório estruturado para cadastro, classificação e controle de vigência desses arquivos clínicos voltados à autorização de convênios.

Este documento estabelece o plano diretor completo para a construção do **Módulo de Gestão de Anexos Clínicos** no ClinicFlow, permitindo que a recepção e o corpo clínico façam o upload estruturado desses documentos, enquanto o RPA consome essas informações de forma 100% autônoma, segura e auditável.

---

## 2. ARQUITETURA GERAL DA SOLUÇÃO

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLINICFLOW (WEB APP)                                 │
│                                                                                  │
│   [Recepção / Terapeuta]                                                         │
│            │                                                                     │
│            ▼                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐               │
│   │  Aba "Autorizações & Anexos" na Ficha do Paciente / Agenda   │               │
│   │  • Upload Drag & Drop (PDF / JPG / PNG)                      │               │
│   │  • Seletor: Tipo de Documento + Data de Validade             │               │
│   │  • Badge na Agenda: "⚠️ Falta Anexo Amil" / "✅ Vigente"     │               │
│   └──────────────────────────────┬───────────────────────────────┘               │
└──────────────────────────────────┼───────────────────────────────────────────────┘
                                   │ Upload via Supabase Client
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            SUPABASE (BACKEND / NUVEM)                            │
│                                                                                  │
│   ┌─────────────────────────────────────┐   ┌────────────────────────────────┐   │
│   │      Supabase Storage (Privado)     │   │      PostgreSQL (Database)     │   │
│   │      Bucket: `anexos-autorizacao`   │   │  Tabela: `documentos_          │   │
│   │                                     │   │           autorizacao`         │   │
│   │  pacientes/{pac_id}/autorizacoes/   │◄──┤  • Metadados & Tipos           │   │
│   │  {tipo_documento}_{timestamp}.pdf   │   │  • Vínculo Paciente/Agendamento│   │
│   │                                     │   │  • Status de Envio RPA         │   │
│   └──────────────────┬──────────────────┘   └───────────────┬────────────────┘   │
└──────────────────────┼──────────────────────────────────────┼────────────────────┘
                       │ Signed URL efêmera (15 min)          │ Leitura & Atualização
                       ▼                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          CLINICFLOW-RPA (BACKGROUND)                             │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │  Scheduler (`apps/scheduler-elegibilidade`):                             │   │
│   │  Só despacha para a fila de autorização se anexos obrigatórios existirem │   │
│   └──────────────────────────────────┬───────────────────────────────────────┘   │
│                                      ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │  Worker Autorização Amil (`amil.attachments.js` + Playwright):           │   │
│   │  1. Download efêmero do bucket em `storage/temp/anexos/{job_id}/`        │   │
│   │  2. Injeção no portal Amil via `page.setInputFiles()`                    │   │
│   │  3. Captura do protocolo de anexo e purge compulsório do disco           │   │
│   │  4. Atualização de status para 'ENVIADO_PLANO' no banco                  │   │
│   └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. BANCO DE DADOS & SUPABASE STORAGE

### 3.1. Bucket de Armazenamento (`anexos-autorizacao`)
* **Nome do Bucket:** `anexos-autorizacao`
* **Visibilidade:** `private` (100% privado, protegido por Row Level Security - RLS).
* **MIME Types Permitidos:** `application/pdf`, `image/jpeg`, `image/png`.
* **Limite de Tamanho:** 5.242.880 bytes (5 MB por arquivo individual).
* **Estrutura de Pastas:**
  ```
  pacientes/{pac_id}/autorizacoes/{tipo_documento}_{timestamp}.pdf
  ```

### 3.2. Script SQL de Migração (Tabelas, Enums e Políticas RLS)

```sql
-- 1. Enum com os tipos de documentos clínicos para operadoras
CREATE TYPE tipo_documento_autorizacao AS ENUM (
  'relatorio_medico',        -- Relatório detalhado do médico assistente com diagnóstico/CID
  'pedido_medico',           -- Guia ou receituário de encaminhamento assinado
  'laudo_patologia',         -- Avaliação neuropsicológica, laudo multidisciplinar ou patologia
  'exame_complementar',      -- Audiometria, tomografia, exames genéticos ou laboratoriais
  'justificativa_clinica'    -- Justificativa técnica para extensão de quantidade de sessões
);

-- 2. Enum de status do envio pelo RPA
CREATE TYPE status_envio_documento AS ENUM (
  'PENDENTE_ENVIO',          -- Documento anexado no ClinicFlow, aguardando envio pelo robô
  'ENVIADO_PLANO',           -- Submetido com sucesso no portal da operadora
  'REJEITADO_PLANO',         -- Recusado pelo convênio (ex: ilegível, fora do prazo)
  'DISPENSADO'               -- Convênio/procedimento não exigiu anexo
);

-- 3. Tabela de Documentos de Autorização
CREATE TABLE IF NOT EXISTS public.documentos_autorizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pac_id BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  agendamento_id BIGINT REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  plano_id BIGINT REFERENCES public.planos_saude(id) ON DELETE SET NULL,
  
  tipo_documento tipo_documento_autorizacao NOT NULL,
  nome_original VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  tamanho_bytes BIGINT NOT NULL,
  
  -- Controle de Vigência Clínica
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,        -- Ex: Pedido médico costuma ter 30 a 90 dias; Laudos até 1 ano
  observacoes TEXT,
  
  -- Metadados de Envio pelo RPA
  status_envio status_envio_documento NOT NULL DEFAULT 'PENDENTE_ENVIO',
  protocolo_envio VARCHAR(100),
  enviado_em TIMESTAMPTZ,
  motivo_recusa TEXT,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. Índices para performance de busca do RPA e do ClinicFlow
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_pac_tipo ON public.documentos_autorizacao (pac_id, tipo_documento);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_agendamento ON public.documentos_autorizacao (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_doc_autorizacao_status ON public.documentos_autorizacao (status_envio);

-- 5. RLS (Row Level Security) na tabela
ALTER TABLE public.documentos_autorizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem visualizar documentos de autorização"
  ON public.documentos_autorizacao FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir documentos de autorização"
  ON public.documentos_autorizacao FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar documentos de autorização"
  ON public.documentos_autorizacao FOR UPDATE
  TO authenticated
  USING (true);

-- 6. Configuração do Bucket no Supabase Storage via SQL
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anexos-autorizacao',
  'anexos-autorizacao',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Acesso Leitura Autenticado Bucket Anexos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'anexos-autorizacao');

CREATE POLICY "Upload Autenticado Bucket Anexos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'anexos-autorizacao');
```

---

## 4. INTERFACE DO USUÁRIO NO CLINICFLOW (FRONTEND)

### 4.1. Localização no Sistema
1. **Ficha do Paciente (`PacienteModal` / Perfil do Paciente):**
   - Nova aba dedicada: **"Convênios & Documentos de Autorização"**.
   - Visão central de todos os laudos, pedidos e relatórios arquivados daquele paciente.
   - Indicador visual de **Vigência** (ex: `Válido até 15/12/2026` em verde, ou `⚠️ Vencido há 5 dias` em vermelho).
2. **Card/Modal de Agendamento (`AgendamentoModal`):**
   - Ao selecionar um plano que exige anexos (ex: **Amil**), o formulário exibe uma caixa de status:
     - `✅ Pedido médico e laudo disponíveis para envio automático pelo RPA`.
     - `⚠️ Pedido médico ausente. Clique aqui para anexar antes de agendar`.

### 4.2. Componente de Upload Inteligente (`AnexosAutorizacaoUpload.tsx`)
* **Área Drag & Drop:** Suporta arrastar e soltar múltiplos arquivos ou clique para navegação local.
* **Formulário de Entrada:**
  - **Tipo de Documento (Dropdown obrigatório):**
    - `Relatório Médico Assistente`
    - `Pedido Médico / Encaminhamento`
    - `Laudo / Avaliação de Patologia`
    - `Exame Complementar`
    - `Justificativa Clínica`
  - **Data de Emissão (Date Picker):** Data em que o médico assinou o laudo/pedido.
  - **Data de Validade Estimada (Auto-calculada com opção de edição):**
    - *Pedido Médico:* Sugere 60 dias a partir da emissão.
    - *Relatório/Laudo:* Sugere 180 a 365 dias a partir da emissão.
* **Pré-visualização (Preview):**
  - Miniatura com ícone de PDF ou thumbnail da imagem.
  - Modal com visualizador embutido para conferência rápida de legibilidade (evita envio de fotos borradas ou documentos cortados).

### 4.3. Badges de Atenção na Grade de Agendamentos / Recepção
Para que as recepcionistas não precisem adivinhar se a Amil vai travar:
* **Badge Vermelha (`Doc Pendente`):** Paciente Amil agendado nos próximos 7 dias sem pedido médico ou laudo anexado.
* **Badge Amarela (`Doc Vencendo`):** Laudo com validade expirando em menos de 15 dias.
* **Badge Azul (`Enviado ao Convênio`):** Robô já fez o upload e registrou o protocolo de entrega.

---

## 5. SERVIÇO TYPESCRIPT NO CLINICFLOW (`anexosAutorizacaoService.ts`)

Estrutura recomendada do serviço no frontend do ClinicFlow:

```typescript
import { supabase } from './supabase';

export interface AnexoAutorizacao {
  id: string;
  pac_id: number;
  agendamento_id?: number | null;
  plano_id?: number | null;
  tipo_documento: 'relatorio_medico' | 'pedido_medico' | 'laudo_patologia' | 'exame_complementar' | 'justificativa_clinica';
  nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  data_emissao: string;
  data_validade?: string | null;
  observacoes?: string | null;
  status_envio: 'PENDENTE_ENVIO' | 'ENVIADO_PLANO' | 'REJEITADO_PLANO' | 'DISPENSADO';
  protocolo_envio?: string | null;
  enviado_em?: string | null;
  created_at: string;
}

export const anexosAutorizacaoService = {
  /**
   * Upload de arquivo para o bucket e inserção de metadados
   */
  async uploadAnexo(
    pacId: number,
    tipo: AnexoAutorizacao['tipo_documento'],
    file: File,
    dados: {
      dataEmissao: string;
      dataValidade?: string;
      agendamentoId?: number;
      planoId?: number;
      observacoes?: string;
    }
  ): Promise<AnexoAutorizacao> {
    const timestamp = Date.now();
    const extensao = file.name.split('.').pop() || 'pdf';
    const storagePath = `pacientes/${pacId}/autorizacoes/${tipo}_${timestamp}.${extensao}`;

    // 1. Upload no Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('anexos-autorizacao')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw new Error(`Falha no upload do arquivo: ${uploadError.message}`);

    // 2. Registro no Banco de Dados
    const { data, error: dbError } = await supabase
      .from('documentos_autorizacao')
      .insert({
        pac_id: pacId,
        agendamento_id: dados.agendamentoId || null,
        plano_id: dados.planoId || null,
        tipo_documento: tipo,
        nome_original: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        tamanho_bytes: file.size,
        data_emissao: dados.dataEmissao,
        data_validade: dados.dataValidade || null,
        observacoes: dados.observacoes || null,
        status_envio: 'PENDENTE_ENVIO'
      })
      .select()
      .single();

    if (dbError) throw new Error(`Falha ao registrar documento: ${dbError.message}`);
    return data;
  },

  /**
   * Lista documentos vigentes de um paciente
   */
  async listarPorPaciente(pacId: number): Promise<AnexoAutorizacao[]> {
    const { data, error } = await supabase
      .from('documentos_autorizacao')
      .select('*')
      .eq('pac_id', pacId)
      .order('data_emissao', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Gera URL de visualização segura temporária (15 minutos)
   */
  async obterUrlVisualizacao(storagePath: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from('anexos-autorizacao')
      .createSignedUrl(storagePath, 900); // 15 minutos

    if (error || !data?.signedUrl) throw new Error('Não foi possível gerar link de visualização');
    return data.signedUrl;
  },

  /**
   * Verifica se o paciente possui os documentos mínimos vigentes para autorização
   */
  async verificarAptidaoAutorizacao(pacId: number, planoNome: string): Promise<{
    apto: boolean;
    pendencias: string[];
    documentosDisponiveis: AnexoAutorizacao[];
  }> {
    if (!planoNome.toLowerCase().includes('amil')) {
      return { apto: true, pendencias: [], documentosDisponiveis: [] };
    }

    const docs = await this.listarPorPaciente(pacId);
    const hoje = new Date().toISOString().split('T')[0];

    const temPedidoValido = docs.some(d => 
      d.tipo_documento === 'pedido_medico' && (!d.data_validade || d.data_validade >= hoje)
    );
    const temRelatorioOuLaudo = docs.some(d => 
      (d.tipo_documento === 'relatorio_medico' || d.tipo_documento === 'laudo_patologia') &&
      (!d.data_validade || d.data_validade >= hoje)
    );

    const pendencias: string[] = [];
    if (!temPedidoValido) pendencias.push('Pedido Médico vigente ausente');
    if (!temRelatorioOuLaudo) pendencias.push('Relatório Médico ou Laudo de Patologia vigente ausente');

    return {
      apto: pendencias.length === 0,
      pendencias,
      documentosDisponiveis: docs
    };
  }
};
```

---

## 6. INTEGRAÇÃO COM O CLINICFLOW-RPA

### 6.1. Proteção no Scheduler (`apps/scheduler-elegibilidade`)
Antes de enfileirar agendamentos na fila `autorizacao` do BullMQ:
1. O scheduler identifica se o plano é **Amil** (`plano_id` correspondente).
2. Faz uma consulta rápida na tabela `documentos_autorizacao` verificando se há pedido médico e laudo válidos para o `pac_id`.
3. Se faltar documento:
   - Marca o agendamento como `PENDENTE_ANEXO_CLINICO`.
   - Não enfileira no robô Playwright, evitando falhas ou bloqueios desnecessários no portal.
   - Emite log de aviso para observabilidade no Dashboard.

### 6.2. Execução no Driver Amil (`apps/worker-autorizacao/src/amil/amil.attachments.js`)
Quando o worker processar o agendamento:
1. Gera Signed URLs para os documentos cadastrados do paciente.
2. Faz streaming dos arquivos para a pasta efêmera:
   `storage/temp/anexos/${job.id}/`
3. No formulário Playwright:
   ```javascript
   const inputUpload = page.locator('input[type="file"][name*="anexo"], input[type="file"]').first();
   await inputUpload.setInputFiles(arquivosBaixadosLocais);
   ```
4. Pós-confirmação da guia no portal:
   - Atualiza `documentos_autorizacao` com `status_envio = 'ENVIADO_PLANO'`, `protocolo_envio = solicitacaoId` e `enviado_em = new Date()`.
5. No bloco `finally`:
   - Deleta compulsoriamente a pasta temporária `storage/temp/anexos/${job.id}/`.

---

## 7. CRONOGRAMA DE IMPLEMENTAÇÃO EM 4 FASES

| Fase | Escopo | Entregáveis | Impacto em SulAmérica |
| :--- | :--- | :--- | :--- |
| **Fase 1: Infraestrutura de Dados** | Supabase Storage & PostgreSQL | • Criação do bucket `anexos-autorizacao`<br>• Execução da DDL `documentos_autorizacao`<br>• Políticas de RLS | **Zero** (novas tabelas isoladas) |
| **Fase 2: Serviços & UI ClinicFlow** | Frontend do ClinicFlow | • Criação de `anexosAutorizacaoService.ts`<br>• Aba de upload na Ficha do Paciente<br>• Modal de preview de PDF/imagens | **Zero** (recurso adicional visual) |
| **Fase 3: Alertas na Recepção** | Grade de Agendamentos ClinicFlow | • Badges indicativas de documentos pendentes<br>• Bloqueio preventivo de envio sem documento | **Zero** (aplicado por filtro condicional `plano === 'Amil'`) |
| **Fase 4: Conexão com o RPA** | ClinicFlow RPA | • Módulo `amil.attachments.js`<br>• Download efêmero e upload Playwright<br>• Auditoria de protocolo e expurgo local | **Zero** (SulAmérica continua com seu fluxo atual intocado) |

---

## 8. PROTOCOLO DE SEGURANÇA & LGPD

Documentos médicos (laudos, diagnósticos e relatórios) contêm dados altamente sensíveis segundo a LGPD (Lei Geral de Proteção de Dados):
1. **Nenhum arquivo público:** O bucket `anexos-autorizacao` é estritamente privado; tentativas de acesso direto via URL anônima retornarão `403 Forbidden`.
2. **Links Temporários Efêmeros:** O frontend e o RPA utilizam apenas URLs assinadas com validade de 15 minutos.
3. **Expurgo Local Obrigatório no Servidor do RPA:** Arquivos baixados para a máquina do robô durante o processo de upload nunca permanecem no disco após a finalização do job (`finally { fs.rmSync(tempDir, { recursive: true, force: true }); }`).
4. **Log de Auditoria:** Cada upload, download e envio gera registro de autoria com `created_by` e timestamp.

---

## 9. CONCLUSÃO & RECOMENDAÇÃO

Com este plano implementado no **ClinicFlow**:
- A clínica ganha uma central completa e intuitiva de arquivamento de laudos e guias de convênio;
- A recepção é alertada com antecedência caso um paciente Amil esteja agendado sem a documentação obrigatória;
- O robô RPA Amil opera de ponta a ponta sem interrupções manuais, realizando o upload dos anexos diretamente no portal com total conformidade.
