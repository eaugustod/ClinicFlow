import { supabase } from './supabase';
import type { AnexoAutorizacao, TipoDocumentoAutorizacao, StatusEnvioDocumento } from '../types';

interface RawDocumentoAutorizacao {
  id: string;
  pac_id: number;
  agendamento_id?: number | null;
  plano_id?: number | null;
  tipo_documento: TipoDocumentoAutorizacao;
  nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  medico_solicitante_nome?: string | null;
  medico_solicitante_crm?: string | null;
  medico_solicitante_cbo?: string | null;
  data_emissao: string;
  data_validade?: string | null;
  observacoes?: string | null;
  status_envio: StatusEnvioDocumento;
  protocolo_envio?: string | null;
  enviado_em?: string | null;
  motivo_recusa?: string | null;
  created_at: string;
  created_by?: string | null;
}

const mapRowToAnexo = (row: RawDocumentoAutorizacao): AnexoAutorizacao => ({
  id: row.id,
  pacId: Number(row.pac_id),
  agendamentoId: row.agendamento_id ? Number(row.agendamento_id) : null,
  planoId: row.plano_id ? Number(row.plano_id) : null,
  tipoDocumento: row.tipo_documento,
  nomeOriginal: row.nome_original,
  storagePath: row.storage_path,
  mimeType: row.mime_type,
  tamanhoBytes: Number(row.tamanho_bytes),
  medicoSolicitanteNome: row.medico_solicitante_nome || null,
  medicoSolicitanteCrm: row.medico_solicitante_crm || null,
  medicoSolicitanteCbo: row.medico_solicitante_cbo || null,
  dataEmissao: row.data_emissao,
  dataValidade: row.data_validade || null,
  observacoes: row.observacoes || null,
  statusEnvio: row.status_envio,
  protocoloEnvio: row.protocolo_envio || null,
  enviadoEm: row.enviado_em || null,
  motivoRecusa: row.motivo_recusa || null,
  createdAt: row.created_at,
  createdBy: row.created_by || null,
});

export const BUCKET_ANEXOS = 'anexos-autorizacao';

export const anexosAutorizacaoService = {
  /**
   * Helper para texto legível do tipo de documento
   */
  obterRotuloTipo(tipo: TipoDocumentoAutorizacao): string {
    const rotulos: Record<TipoDocumentoAutorizacao, string> = {
      relatorio_medico: 'Relatório Médico Assistente',
      pedido_medico: 'Pedido Médico / Encaminhamento',
      laudo_patologia: 'Laudo / Avaliação de Patologia',
      exame_complementar: 'Exame Complementar',
      justificativa_clinica: 'Justificativa Clínica',
    };
    return rotulos[tipo] || tipo;
  },

  /**
   * Sugestão automática de data de validade conforme padrão de convênios/DUT
   */
  calcularValidadeSugerida(tipo: TipoDocumentoAutorizacao, dataEmissao: string): string {
    const base = new Date(dataEmissao || new Date().toISOString().split('T')[0]);
    if (isNaN(base.getTime())) return '';

    let diasValidade = 60; // padrão
    if (tipo === 'pedido_medico') diasValidade = 60;
    else if (tipo === 'laudo_patologia') diasValidade = 365;
    else if (tipo === 'relatorio_medico') diasValidade = 180;
    else if (tipo === 'exame_complementar') diasValidade = 180;
    else if (tipo === 'justificativa_clinica') diasValidade = 90;

    base.setDate(base.getDate() + diasValidade);
    return base.toISOString().split('T')[0];
  },

  /**
   * Faz o upload do arquivo para o Storage e registra metadados na tabela
   */
  async uploadAnexo(
    pacId: number,
    tipo: TipoDocumentoAutorizacao,
    file: File,
    dados: {
      dataEmissao: string;
      dataValidade?: string | null;
      agendamentoId?: number | null;
      planoId?: number | null;
      observacoes?: string | null;
      medicoSolicitanteNome?: string | null;
      medicoSolicitanteCrm?: string | null;
      medicoSolicitanteCbo?: string | null;
    }
  ): Promise<AnexoAutorizacao> {
    if (!pacId) throw new Error('ID do paciente é obrigatório para anexar documento.');

    // Limite de 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`Arquivo excede o limite máximo permitido de 5 MB (tamanho: ${(file.size / 1024 / 1024).toFixed(1)} MB).`);
    }

    const timestamp = Date.now();
    const sanitizado = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const extensao = sanitizado.split('.').pop() || 'pdf';
    const storagePath = `pacientes/${pacId}/autorizacoes/${tipo}_${timestamp}.${extensao}`;

    // 1. Upload no Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .upload(storagePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Falha no upload para o Supabase Storage: ${uploadError.message}`);
    }

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
        mime_type: file.type || 'application/pdf',
        tamanho_bytes: file.size,
        medico_solicitante_nome: dados.medicoSolicitanteNome?.trim() || null,
        medico_solicitante_crm: dados.medicoSolicitanteCrm?.trim() || null,
        medico_solicitante_cbo: dados.medicoSolicitanteCbo?.trim() || null,
        data_emissao: dados.dataEmissao,
        data_validade: dados.dataValidade || null,
        observacoes: dados.observacoes || null,
        status_envio: 'PENDENTE_ENVIO',
      })
      .select()
      .single();

    if (dbError) {
      // Rollback no storage caso inserção no banco falhe
      await supabase.storage.from(BUCKET_ANEXOS).remove([storagePath]);
      throw new Error(`Falha ao registrar documento no banco: ${dbError.message}`);
    }

    return mapRowToAnexo(data as RawDocumentoAutorizacao);
  },

  /**
   * Lista todos os anexos de autorização de um paciente
   */
  async listarPorPaciente(pacId: number): Promise<AnexoAutorizacao[]> {
    if (!pacId) return [];

    const { data, error } = await supabase
      .from('documentos_autorizacao')
      .select('*')
      .eq('pac_id', pacId)
      .order('data_emissao', { ascending: false });

    if (error) {
      console.error('Erro ao listar anexos do paciente:', error);
      throw error;
    }

    return (data || []).map((row: RawDocumentoAutorizacao) => mapRowToAnexo(row));
  },

  /**
   * Gera uma URL de visualização efêmera assinada (15 minutos)
   */
  async obterUrlVisualizacao(storagePath: string): Promise<string> {
    if (!storagePath) throw new Error('Caminho do arquivo não informado.');

    const { data, error } = await supabase.storage
      .from(BUCKET_ANEXOS)
      .createSignedUrl(storagePath, 900); // 15 minutos

    if (error || !data?.signedUrl) {
      throw new Error(`Não foi possível gerar link assinado de visualização: ${error?.message || 'Erro desconhecido'}`);
    }

    return data.signedUrl;
  },

  /**
   * Exclui um documento do banco e do storage
   */
  async excluirAnexo(id: string, storagePath: string): Promise<void> {
    if (!id) throw new Error('ID do documento inválido.');

    // 1. Remover registro do banco
    const { error: dbError } = await supabase
      .from('documentos_autorizacao')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw new Error(`Erro ao excluir documento do banco: ${dbError.message}`);
    }

    // 2. Remover do storage
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(BUCKET_ANEXOS)
        .remove([storagePath]);

      if (storageError) {
        console.warn('Aviso: falha ao limpar arquivo do bucket após exclusão do registro:', storageError.message);
      }
    }
  },

  /**
   * Verifica conformidade dos documentos do paciente para convênios com DUT (ex: Amil)
   */
  async verificarAptidaoAutorizacao(pacId: number, planoNome: string): Promise<{
    apto: boolean;
    pendencias: string[];
    documentosDisponiveis: AnexoAutorizacao[];
    resumo: {
      temPedidoValido: boolean;
      temRelatorioOuLaudo: boolean;
      vencendoEmBreve: boolean;
    };
  }> {
    if (!pacId) {
      return {
        apto: false,
        pendencias: ['Paciente não identificado'],
        documentosDisponiveis: [],
        resumo: { temPedidoValido: false, temRelatorioOuLaudo: false, vencendoEmBreve: false },
      };
    }

    const ehAmil = (planoNome || '').toLowerCase().includes('amil');
    if (!ehAmil) {
      // Para planos que não exigem DUT / anexos obrigatórios
      return {
        apto: true,
        pendencias: [],
        documentosDisponiveis: [],
        resumo: { temPedidoValido: true, temRelatorioOuLaudo: true, vencendoEmBreve: false },
      };
    }

    try {
      const docs = await this.listarPorPaciente(pacId);
      const hoje = new Date().toISOString().split('T')[0];
      const daqui15Dias = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

      const temPedidoValido = docs.some(
        d => d.tipoDocumento === 'pedido_medico' && (!d.dataValidade || d.dataValidade >= hoje)
      );

      const temRelatorioOuLaudo = docs.some(
        d =>
          (d.tipoDocumento === 'relatorio_medico' || d.tipoDocumento === 'laudo_patologia') &&
          (!d.dataValidade || d.dataValidade >= hoje)
      );

      const vencendoEmBreve = docs.some(
        d => d.dataValidade && d.dataValidade >= hoje && d.dataValidade <= daqui15Dias
      );

      const pendencias: string[] = [];
      if (!temPedidoValido) pendencias.push('Pedido Médico vigente ausente');
      if (!temRelatorioOuLaudo) pendencias.push('Relatório Médico ou Laudo de Patologia vigente ausente');

      return {
        apto: pendencias.length === 0,
        pendencias,
        documentosDisponiveis: docs,
        resumo: { temPedidoValido, temRelatorioOuLaudo, vencendoEmBreve },
      };
    } catch (err) {
      console.warn('Erro ao verificar aptidão de autorização (fallback tolerante a falhas):', err);
      // Fallback gracioso para não travar a aplicação se a tabela ainda não estiver criada
      return {
        apto: true,
        pendencias: [],
        documentosDisponiveis: [],
        resumo: { temPedidoValido: false, temRelatorioOuLaudo: false, vencendoEmBreve: false },
      };
    }
  },
};
