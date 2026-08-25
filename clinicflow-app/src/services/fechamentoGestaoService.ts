import { supabase } from './supabase';

export interface FechamentoPeriodoGestao {
  id: string;
  profissional_id: number;
  profissional_nome?: string;
  competencia: string;
  status: 'nao_iniciado' | 'aberto_para_conferencia' | 'contestado' | 'aprovado_pelo_terapeuta' | 'fechado_pela_clinica';
  prazo_conferencia: string | null;
  aberto_em: string;
  aprovado_em: string | null;
  fechado_em: string | null;
  fechado_por: string | null;
  valor_total_calculado: number;
  qtd_itens_total: number;
  qtd_pendentes: number;
  qtd_contestados: number;
  qtd_confirmados: number;
}

export interface FechamentoItemGestao {
  id: string;
  fechamento_periodo_id: string;
  atendimento_id: number | null;
  status_item: 'pendente' | 'confirmado' | 'confirmado_automaticamente' | 'contestado' | 'em_analise' | 'resolvido_ajustado' | 'resolvido_mantido';
  valor_calculado: number;
  valor_ajustado: number | null;
  motivo_contestacao: string | null;
  observacao_terapeuta: string | null;
  observacao_gestao: string | null;
  paciente_sugerido?: string | null;
  data_sugerida?: string | null;
  criado_em: string;
  atualizado_em: string;
  atendimento?: {
    id: number;
    data_iso: string;
    hora_inicio: string;
    paciente: string;
    tipo_sessao: string;
    procedimento: string;
    status: string;
  };
}

export interface FechamentoHistoricoItem {
  id: string;
  fechamento_item_id: string;
  status_anterior: string | null;
  status_novo: string;
  valor_anterior: number | null;
  valor_novo: number | null;
  alterado_por: string | null;
  alterado_em: string;
  observacao: string | null;
}

export const fechamentoGestaoService = {
  /**
   * Executa a expiração de itens pendentes vencidos no banco via RPC
   */
  async expirarPendentesVencidos(): Promise<void> {
    try {
      await supabase.rpc('expirar_fechamentos_pendentes_vencidos');
    } catch (e) {
      console.error('[fechamentoGestaoService] Erro ao expirar pendentes:', e);
    }
  },

  /**
   * Listagem consolidada de fechamentos para uma competência (YYYY-MM).
   */
  async listarFechamentosPorCompetencia(anoMes: string, profissionaisLista: any[]): Promise<FechamentoPeriodoGestao[]> {
    await this.expirarPendentesVencidos();
    const competencia = `${anoMes}-01`;

    const { data: periodos, error: pErr } = await supabase
      .from('fechamento_periodo')
      .select('*')
      .eq('competencia', competencia);

    if (pErr) {
      console.error('[fechamentoGestaoService] Erro ao listar periodos:', pErr);
    }

    const periodosMap = new Map<number, any>();
    (periodos || []).forEach(p => periodosMap.set(p.profissional_id, p));

    // Busca contadores de itens por período
    const pIds = (periodos || []).map(p => p.id);
    let itensRes: any[] = [];

    if (pIds.length > 0) {
      const { data: itens, error: iErr } = await supabase
        .from('fechamento_item')
        .select('id, fechamento_periodo_id, status_item, valor_calculado, valor_ajustado')
        .in('fechamento_periodo_id', pIds);

      if (!iErr && itens) {
        itensRes = itens;
      }
    }

    const resultado: FechamentoPeriodoGestao[] = [];

    for (const prof of profissionaisLista) {
      const p = periodosMap.get(prof.id);
      const profItens = p ? itensRes.filter(it => it.fechamento_periodo_id === p.id) : [];

      const qtdTotal = profItens.length;
      const qtdPend = profItens.filter(it => it.status_item === 'pendente').length;
      const qtdCont = profItens.filter(it => it.status_item === 'contestado' || it.status_item === 'em_analise').length;
      const qtdConf = profItens.filter(it => it.status_item === 'confirmado' || it.status_item === 'confirmado_automaticamente' || it.status_item.startsWith('resolvido')).length;

      const valorTotal = profItens.reduce((acc, it) => {
        if (it.status_item === 'resolvido_ajustado' && it.valor_ajustado !== null) {
          return acc + Number(it.valor_ajustado);
        }
        return acc + Number(it.valor_calculado || 0);
      }, 0);

      resultado.push({
        id: p?.id || '',
        profissional_id: prof.id,
        profissional_nome: prof.nome,
        competencia: competencia,
        status: p?.status || 'nao_iniciado',
        prazo_conferencia: p?.prazo_conferencia || null,
        aberto_em: p?.aberto_em || '',
        aprovado_em: p?.aprovado_em || null,
        fechado_em: p?.fechado_em || null,
        fechado_por: p?.fechado_por || null,
        valor_total_calculado: p?.valor_total_calculado ? Number(p.valor_total_calculado) : valorTotal,
        qtd_itens_total: qtdTotal,
        qtd_pendentes: qtdPend,
        qtd_contestados: qtdCont,
        qtd_confirmados: qtdConf
      });
    }

    // Ordenação padrão da tela 5.2: por quantidade de contestados (decrescente)
    resultado.sort((a, b) => b.qtd_contestados - a.qtd_contestados);

    return resultado;
  },

  /**
   * Abre a conferência de um profissional no mês especificado
   */
  async abrirConferenciaProfissional(profId: number, anoMes: string, diaPrazoMesSeguinte: number = 5): Promise<boolean> {
    const competencia = `${anoMes}-01`;
    const [year, month] = anoMes.split('-').map(Number);

    // Prazo padrão: dia X do mês seguinte às 23:59:59
    const prazoDate = new Date(year, month, diaPrazoMesSeguinte, 23, 59, 59);

    // 1. Verifica se já existe período
    const { data: existente } = await supabase
      .from('fechamento_periodo')
      .select('*')
      .eq('profissional_id', profId)
      .eq('competencia', competencia)
      .maybeSingle();

    let periodoId = existente?.id;

    if (!existente) {
      const { data: novoP, error: pErr } = await supabase
        .from('fechamento_periodo')
        .insert({
          profissional_id: profId,
          competencia: competencia,
          status: 'aberto_para_conferencia',
          prazo_conferencia: prazoDate.toISOString()
        })
        .select()
        .single();

      if (pErr) {
        console.error('[fechamentoGestaoService] Erro ao criar periodo:', pErr);
        return false;
      }
      periodoId = novoP.id;
    } else {
      await supabase
        .from('fechamento_periodo')
        .update({
          status: existente.status === 'nao_iniciado' ? 'aberto_para_conferencia' : existente.status,
          prazo_conferencia: prazoDate.toISOString()
        })
        .eq('id', existente.id);
    }

    // 2. Sincroniza agendamentos
    const primDay = `${anoMes}-01`;
    const ultDay = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: appts } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('prof_id', profId)
      .gte('data_iso', primDay)
      .lte('data_iso', ultDay);

    if (appts && appts.length > 0 && periodoId) {
      const { data: itensExistentes } = await supabase
        .from('fechamento_item')
        .select('atendimento_id')
        .eq('fechamento_periodo_id', periodoId);

      const jaExistentesSet = new Set((itensExistentes || []).map(i => i.atendimento_id));
      const novosItens = appts
        .filter(a => !jaExistentesSet.has(a.id))
        .map(a => ({
          fechamento_periodo_id: periodoId,
          atendimento_id: a.id,
          status_item: 'pendente',
          valor_calculado: Number(a.valor || a.valor_sessao || 0)
        }));

      if (novosItens.length > 0) {
        await supabase.from('fechamento_item').insert(novosItens);
      }
    }

    return true;
  },

  /**
   * Busca itens de fechamento de um período com detalhes dos agendamentos
   */
  async buscarItensFechamentoPeriodo(periodoId: string): Promise<FechamentoItemGestao[]> {
    if (!periodoId) return [];

    const { data: itens, error } = await supabase
      .from('fechamento_item')
      .select('*')
      .eq('fechamento_periodo_id', periodoId);

    if (error) {
      console.error('[fechamentoGestaoService] Erro ao buscar itens:', error);
      return [];
    }

    // Coleta IDs de atendimento para buscar agendamentos
    const apptIds = (itens || []).map(i => i.atendimento_id).filter(Boolean);
    let apptsMap = new Map<number, any>();

    if (apptIds.length > 0) {
      const { data: appts } = await supabase
        .from('agendamentos')
        .select('*')
        .in('id', apptIds);

      (appts || []).forEach(a => apptsMap.set(a.id, a));
    }

    const resultado: FechamentoItemGestao[] = (itens || []).map(it => {
      const appt = it.atendimento_id ? apptsMap.get(it.atendimento_id) : null;
      return {
        ...it,
        valor_calculado: Number(it.valor_calculado || 0),
        valor_ajustado: it.valor_ajustado !== null ? Number(it.valor_ajustado) : null,
        atendimento: appt ? {
          id: appt.id,
          data_iso: appt.data_iso || appt.data,
          hora_inicio: appt.hora_inicio || appt.horario || '—',
          paciente: appt.paciente || appt.paciente_nome || '—',
          tipo_sessao: appt.tipo_sessao || appt.procedimento || 'Sessão',
          procedimento: appt.procedimento || appt.convenio || 'Particular',
          status: appt.status || 'Agendado'
        } : undefined
      };
    });

    return resultado;
  },

  /**
   * Gestão resolve contestação enviada pelo terapeuta (ajustando valor ou mantendo original).
   */
  async resolverContestacao(
    itemId: string,
    acao: 'ajustar' | 'manter',
    valorAjustado: number | null,
    observacaoGestao: string,
    usuarioNome: string
  ): Promise<boolean> {
    if (!observacaoGestao.trim()) return false;

    const { data: itemAtual } = await supabase.from('fechamento_item').select('*').eq('id', itemId).single();
    if (!itemAtual) return false;

    const novoStatus = acao === 'ajustar' ? 'resolvido_ajustado' : 'resolvido_mantido';

    const { error } = await supabase
      .from('fechamento_item')
      .update({
        status_item: novoStatus,
        valor_ajustado: acao === 'ajustar' ? valorAjustado : null,
        observacao_gestao: observacaoGestao
      })
      .eq('id', itemId);

    if (error) {
      console.error('[fechamentoGestaoService] Erro ao resolver contestação:', error);
      return false;
    }

    // Grava histórico de auditoria
    await supabase.from('fechamento_item_historico').insert({
      fechamento_item_id: itemId,
      status_anterior: itemAtual.status_item,
      status_novo: novoStatus,
      valor_anterior: itemAtual.valor_calculado,
      valor_novo: acao === 'ajustar' ? valorAjustado : itemAtual.valor_calculado,
      alterado_por: usuarioNome,
      observacao: `Decisão da Gestão (${acao}): ${observacaoGestao}`
    });

    // Verifica se ainda restam contestações em aberto no período
    const { data: contestaRestantes } = await supabase
      .from('fechamento_item')
      .select('id')
      .eq('fechamento_periodo_id', itemAtual.fechamento_periodo_id)
      .in('status_item', ['contestado', 'em_analise']);

    if (!contestaRestantes || contestaRestantes.length === 0) {
      // Se não restam contestações pendentes, atualiza período de contestado para aberto_para_conferencia
      await supabase
        .from('fechamento_periodo')
        .update({ status: 'aberto_para_conferencia' })
        .eq('id', itemAtual.fechamento_periodo_id)
        .eq('status', 'contestado');
    }

    return true;
  },

  /**
   * Gestão reabre item confirmado de volta para status 'pendente'
   */
  async reabrirItem(itemId: string, usuarioNome: string): Promise<boolean> {
    const { data: itemAtual } = await supabase.from('fechamento_item').select('*').eq('id', itemId).single();
    if (!itemAtual) return false;

    const { error } = await supabase
      .from('fechamento_item')
      .update({
        status_item: 'pendente',
        motivo_contestacao: null,
        observacao_terapeuta: null,
        observacao_gestao: null
      })
      .eq('id', itemId);

    if (error) return false;

    await supabase.from('fechamento_item_historico').insert({
      fechamento_item_id: itemId,
      status_anterior: itemAtual.status_item,
      status_novo: 'pendente',
      valor_anterior: itemAtual.valor_calculado,
      valor_novo: itemAtual.valor_calculado,
      alterado_por: usuarioNome,
      observacao: 'Item reaberto pela Gestão'
    });

    return true;
  },

  /**
   * Efetua o fechamento oficial da clínica para o período.
   */
  async fecharPeriodoOficial(periodoId: string, usuarioId: string, usuarioNome: string): Promise<boolean> {
    // 1. Busca todos os itens para recalcular valor_total_calculado exato
    const { data: itens } = await supabase
      .from('fechamento_item')
      .select('*')
      .eq('fechamento_periodo_id', periodoId);

    if (!itens) return false;

    const valorTotalFinal = itens.reduce((acc, item) => {
      if (item.status_item === 'resolvido_ajustado' && item.valor_ajustado !== null) {
        return acc + Number(item.valor_ajustado);
      }
      return acc + Number(item.valor_calculado || 0);
    }, 0);

    const { error } = await supabase
      .from('fechamento_periodo')
      .update({
        status: 'fechado_pela_clinica',
        fechado_em: new Date().toISOString(),
        fechado_por: usuarioId,
        valor_total_calculado: valorTotalFinal
      })
      .eq('id', periodoId);

    if (error) {
      console.error('[fechamentoGestaoService] Erro ao fechar período:', error);
      return false;
    }

    return true;
  },

  /**
   * Consulta histórico de auditoria por item
   */
  async buscarHistoricoItem(itemId: string): Promise<FechamentoHistoricoItem[]> {
    const { data, error } = await supabase
      .from('fechamento_item_historico')
      .select('*')
      .eq('fechamento_item_id', itemId)
      .order('alterado_em', { ascending: false });

    if (error) return [];
    return data || [];
  }
};
