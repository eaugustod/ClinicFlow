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

export function calcularValorSessao(a: any, profData?: any): number {
  const st = (a.status || '').toLowerCase().trim();
  const pres = (a.presenca || '').toLowerCase().trim();
  const horaStr = a.hora_inicio || a.hora || a.horario || '';
  const isApos18h = horaStr >= '18:00';
  const isDesmarque = st.includes('desmarc') || st.includes('cancel') || pres === 'falta' || pres.includes('justif');

  if (isApos18h && isDesmarque) {
    let vDesm18 = Number(profData?.valor_desmarque_apos18 ?? profData?.valorDesmarqueApos18 ?? profData?.vlrDesmarqueApos18 ?? 0);
    return vDesm18;
  }

  // REGRA EXPLICITA: Apenas agendamentos atestados como ATENDIDO (ou presente) geram valor!
  // Agendamentos "confirmado", "agendado", "em espera", "desmarcado", "cancelado" ficam obrigatoriamente com R$ 0,00.
  const isAtendido = st.includes('atendid') || st === 'presente' || pres === 'presente';

  if (!isAtendido) {
    return 0;
  }

  if (a.valor && Number(a.valor) > 0) {
    return Number(a.valor);
  }

  let v30 = Number(profData?.valor_30 ?? profData?.valor30 ?? profData?.vlr30 ?? 0);
  let v60 = Number(profData?.valor_60 ?? profData?.valor60 ?? profData?.vlr60 ?? 0);
  let vPart = Number(profData?.valor_particular ?? profData?.valorParticular ?? profData?.vlrParticular ?? 0);
  let vAval = Number(profData?.valor_aval ?? profData?.valorAval ?? profData?.vlrAval ?? 0);

  if (!v30) v30 = 60;
  if (!v60) v60 = 100;

  const planoStr = (a.procedimento || a.plano || a.convenio || '').toLowerCase();
  const tipoStr = (a.tipo_sessao || a.tipo || '').toLowerCase();
  const obsStr = (a.obs || '').toLowerCase();
  const pacStr = (a.paciente || a.paciente_nome || '').toLowerCase();

  const isParticular = planoStr === 'particular' || planoStr.includes('particular') || a.plano_id === 5 || a.planoId === 5;
  const isDev = tipoStr.includes('devolutiva') || obsStr.includes('devolutiva') || pacStr.includes('devolutiva');
  const isAval = tipoStr.includes('avaliacao') || tipoStr.includes('avaliac') || tipoStr.includes('continua') || obsStr.includes('avaliação') || obsStr.includes('aval');

  if (isParticular) {
    return vPart > 0 ? vPart : v30;
  }

  if (isAval) {
    return 0;
  }

  if (isDev) {
    return vAval;
  }

  let dur = Number(a.dur_min || a.durMin || 0);
  if (!dur && a.dur) {
    const parsed = parseInt(String(a.dur), 10);
    if (!isNaN(parsed)) dur = parsed;
  }
  if (!dur) dur = 30;

  return dur >= 45 ? v60 : v30;
}

export function qualificaParaFechamento(a: any): boolean {
  const st = (a.status || '').toLowerCase().trim();
  const pres = (a.presenca || '').toLowerCase().trim();
  const horaStr = a.hora_inicio || a.hora || a.horario || '';
  const isApos18h = horaStr >= '18:00';
  const isDesmarque = st.includes('desmarc') || st.includes('cancel') || pres === 'falta' || pres.includes('justif');
  const isAtendido = st.includes('atendid') || st === 'presente' || pres === 'presente';

  // Inclui apenas agendamentos efetivamente atendidos OU desmarques/cancelados pós-18h (taxa de desmarque)
  return isAtendido || (isDesmarque && isApos18h);
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

    // Busca agendamentos do mês para identificar terapeutas ativos na competência
    const primDay = `${anoMes}-01`;
    const [year, month] = anoMes.split('-').map(Number);
    const ultDay = new Date(year, month, 0).toISOString().split('T')[0];

    const { data: agendamentosMes } = await supabase
      .from('agendamentos')
      .select('prof_id')
      .gte('data_iso', primDay)
      .lte('data_iso', ultDay);

    const profsComAgendamentoSet = new Set((agendamentosMes || []).map(a => Number(a.prof_id)));

    const resultado: FechamentoPeriodoGestao[] = [];

    for (const prof of profissionaisLista) {
      const p = periodosMap.get(prof.id);
      const profItens = p ? itensRes.filter(it => it.fechamento_periodo_id === p.id) : [];

      // Filtra apenas terapeutas que possuem agendamentos no mês ou itens de fechamento gerados
      const temAgendamentoNoMes = profsComAgendamentoSet.has(Number(prof.id)) || profItens.length > 0;
      if (!temAgendamentoNoMes) {
        continue;
      }

      const qtdTotal = profItens.length;
      const qtdPend = profItens.filter(it => it.status_item === 'pendente').length;
      const qtdCont = profItens.filter(it => it.status_item === 'contestado' || it.status_item === 'em_analise').length;
      const qtdConf = profItens.filter(it => it.status_item === 'confirmado' || it.status_item === 'confirmado_automaticamente' || it.status_item.startsWith('resolvido')).length;

      // FIX: sempre recalcula o valor ao vivo (ignora campo do banco que pode estar desatualizado)
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
        valor_total_calculado: valorTotal, // FIX: sempre usa valor recalculado ao vivo
        qtd_itens_total: qtdTotal,
        qtd_pendentes: qtdPend,
        qtd_contestados: qtdCont,
        qtd_confirmados: qtdConf
      });
    }

    resultado.sort((a, b) => b.qtd_contestados - a.qtd_contestados);

    return resultado;
  },

  /**
   * Abre a conferência de um profissional no mês especificado
   */
  async abrirConferenciaProfissional(profId: number, anoMes: string, diaPrazoMesSeguinte: number = 10): Promise<boolean> {
    const competencia = `${anoMes}-01`;
    const [year, month] = anoMes.split('-').map(Number);
    const prazoDate = new Date(year, month, diaPrazoMesSeguinte, 23, 59, 59);

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

    if (periodoId) {
      await this.sincronizarAgendamentosPeriodo(periodoId);
    }

    return true;
  },

  /**
   * Sincroniza os itens de um período com os agendamentos atuais na agenda:
   * - Recalcula valores de atendimentos cujo status foi alterado para Atendido
   * - Insere novos atendimentos do mês que ainda não estavam no período
   * - Remove desmarques/cancelamentos diurnos zerados que não qualificam para repasse
   * - Recalcula e atualiza o valor_total_calculado no fechamento_periodo
   */
  async sincronizarAgendamentosPeriodo(periodoId: string): Promise<{ inseridos: number; atualizados: number; removidos: number }> {
    if (!periodoId) return { inseridos: 0, atualizados: 0, removidos: 0 };

    // 1. Busca período
    const { data: periodo, error: pErr } = await supabase
      .from('fechamento_periodo')
      .select('*')
      .eq('id', periodoId)
      .maybeSingle();

    if (pErr || !periodo) {
      console.error('[fechamentoGestaoService] Período não encontrado para sincronização:', pErr);
      return { inseridos: 0, atualizados: 0, removidos: 0 };
    }

    const profId = periodo.profissional_id;
    const competencia = periodo.competencia; // YYYY-MM-01
    const anoMes = competencia.slice(0, 7);
    const [year, month] = anoMes.split('-').map(Number);
    const primDay = `${anoMes}-01`;
    const ultDay = new Date(year, month, 0).toISOString().split('T')[0];

    // 2. Busca dados do profissional para cálculo de taxas
    const { data: profData } = await supabase
      .from('profissionais')
      .select('id, nome, valor_30, valor_60, valor_particular, valor_aval, valor_desmarque_apos18')
      .eq('id', profId)
      .maybeSingle();

    // 3. Busca agendamentos do profissional no mês
    const { data: appts } = await supabase
      .from('agendamentos')
      .select('*')
      .eq('prof_id', profId)
      .gte('data_iso', primDay)
      .lte('data_iso', ultDay);

    const apptsList = appts || [];
    const apptsMap = new Map<number, any>(apptsList.map(a => [a.id, a]));

    // 4. Busca itens existentes no fechamento_item
    const { data: itensExistentes } = await supabase
      .from('fechamento_item')
      .select('*')
      .eq('fechamento_periodo_id', periodoId);

    const itensList = itensExistentes || [];
    const itensApptIdMap = new Map<number, any>();
    itensList.forEach(it => {
      if (it.atendimento_id) itensApptIdMap.set(it.atendimento_id, it);
    });

    let inseridos = 0;
    let atualizados = 0;
    let removidos = 0;

    // 5. Atualiza itens existentes ou remove itens que não qualificam mais
    for (const it of itensList) {
      if (!it.atendimento_id) continue;
      const appt = apptsMap.get(it.atendimento_id);

      // Se o agendamento foi apagado da agenda ou não qualifica (ex: desmarque diurno zerado)
      // e não é um item com contestação resolvida manualmente pela gestão:
      const qualifica = appt ? qualificaParaFechamento(appt) : false;
      const ehItemManual = it.status_item === 'resolvido_ajustado' || it.status_item === 'resolvido_mantido' || it.status_item === 'contestado';

      if (!qualifica && !ehItemManual) {
        // Remove item não qualificado para não inflar atendimentos com zeros
        await supabase.from('fechamento_item').delete().eq('id', it.id);
        removidos++;
        continue;
      }

      if (appt && !ehItemManual) {
        const valorRecalculado = calcularValorSessao(appt, profData);
        if (Number(it.valor_calculado) !== valorRecalculado) {
          await supabase
            .from('fechamento_item')
            .update({ valor_calculado: valorRecalculado })
            .eq('id', it.id);
          atualizados++;
        }
      }
    }

    // 6. Insere agendamentos qualificantes novos que ainda não estavam no fechamento_item
    const novosParaInserir: any[] = [];
    for (const appt of apptsList) {
      if (!itensApptIdMap.has(appt.id) && qualificaParaFechamento(appt)) {
        novosParaInserir.push({
          fechamento_periodo_id: periodoId,
          atendimento_id: appt.id,
          status_item: 'pendente',
          valor_calculado: calcularValorSessao(appt, profData)
        });
      }
    }

    if (novosParaInserir.length > 0) {
      await supabase.from('fechamento_item').insert(novosParaInserir);
      inseridos += novosParaInserir.length;

      // Se novos itens foram inseridos e o período estava como 'aprovado_pelo_terapeuta',
      // retorna para 'aberto_para_conferencia' para que o terapeuta aprove os novos itens.
      if (periodo.status === 'aprovado_pelo_terapeuta') {
        await supabase
          .from('fechamento_periodo')
          .update({ status: 'aberto_para_conferencia' })
          .eq('id', periodoId);
      }
    }

    // 7. Recalcula o valor_total_calculado do período e atualiza fechamento_periodo
    const { data: itensAtualizados } = await supabase
      .from('fechamento_item')
      .select('valor_calculado, valor_ajustado, status_item')
      .eq('fechamento_periodo_id', periodoId);

    const totalAtualizado = (itensAtualizados || []).reduce((acc, it) => {
      if (it.status_item === 'resolvido_ajustado' && it.valor_ajustado !== null) {
        return acc + Number(it.valor_ajustado);
      }
      return acc + Number(it.valor_calculado || 0);
    }, 0);

    await supabase
      .from('fechamento_periodo')
      .update({ valor_total_calculado: totalAtualizado })
      .eq('id', periodoId);

    return { inseridos, atualizados, removidos };
  },

  /**
   * Sincroniza todos os períodos de uma competência (ou cria para quem teve atendimento)
   */
  async sincronizarTodosPeriodosMes(anoMes: string, profissionaisLista: any[]): Promise<{ totalPeriodos: number; totalInseridos: number; totalAtualizados: number; totalRemovidos: number }> {
    const competencia = `${anoMes}-01`;
    const { data: periodos } = await supabase
      .from('fechamento_periodo')
      .select('id, status, profissional_id')
      .eq('competencia', competencia);

    let totalInseridos = 0;
    let totalAtualizados = 0;
    let totalRemovidos = 0;
    let count = 0;

    for (const p of (periodos || [])) {
      if (p.status !== 'fechado_pela_clinica') {
        const res = await this.sincronizarAgendamentosPeriodo(p.id);
        totalInseridos += res.inseridos;
        totalAtualizados += res.atualizados;
        totalRemovidos += res.removidos;
        count++;
      }
    }

    return { totalPeriodos: count, totalInseridos, totalAtualizados, totalRemovidos };
  },

  /**
   * Busca itens de fechamento de um período com detalhes dos agendamentos
   */
  async buscarItensFechamentoPeriodo(periodoId: string): Promise<FechamentoItemGestao[]> {
    if (!periodoId) return [];

    const { data: periodoData } = await supabase
      .from('fechamento_periodo')
      .select('profissional_id')
      .eq('id', periodoId)
      .maybeSingle();

    let profData: any = null;
    if (periodoData?.profissional_id) {
      const { data: pData } = await supabase
        .from('profissionais')
        .select('id, nome, valor_30, valor_60, valor_particular, valor_aval, valor_desmarque_apos18')
        .eq('id', periodoData.profissional_id)
        .maybeSingle();
      profData = pData;
    }

    const { data: itens, error } = await supabase
      .from('fechamento_item')
      .select('*')
      .eq('fechamento_periodo_id', periodoId);

    if (error) {
      console.error('[fechamentoGestaoService] Erro ao buscar itens:', error);
      return [];
    }

    const apptIds = (itens || []).map(i => i.atendimento_id).filter(Boolean);
    let apptsMap = new Map<number, any>();
    let apptsList: any[] = [];

    if (apptIds.length > 0) {
      const { data: appts } = await supabase
        .from('agendamentos')
        .select('*')
        .in('id', apptIds);

      apptsList = appts || [];
      apptsList.forEach(a => apptsMap.set(a.id, a));
    }

    // Busca evoluções na tabela historico
    const evolucaoMap = new Map<number, string>();
    const evolucaoByPacDataMap = new Map<string, string>();
    const evolucaoByNomeDataMap = new Map<string, string>();

    if (apptsList.length > 0 && periodoData?.profissional_id) {
      const { data: histData } = await supabase
        .from('historico')
        .select('*')
        .or(`prof_id.eq.${periodoData.profissional_id},agendamento_id.in.(${apptIds.join(',')})`);

      (histData || []).forEach((h: any) => {
        let texto = '';
        let pacienteNome = '';
        try {
          const conteudo = typeof h.conteudo === 'string' ? JSON.parse(h.conteudo) : (h.conteudo || {});
          texto = conteudo.texto || h.observacao || h.descricao || h.detalhes || '';
          pacienteNome = conteudo.paciente || '';
        } catch {
          texto = h.observacao || h.descricao || '';
        }

        if (!texto && h.titulo && h.titulo.includes('✓ Sessão')) {
          texto = h.titulo;
        }

        if (texto) {
          if (h.agendamento_id) {
            evolucaoMap.set(Number(h.agendamento_id), texto);
          }

          let dataIsoFormatada = '';
          if (h.titulo && h.titulo.includes('·')) {
            const partes = h.titulo.split('·');
            if (partes.length >= 2) {
              const dataStr = partes[1].trim();
              const dParts = dataStr.split('/');
              if (dParts.length === 3) {
                dataIsoFormatada = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
              }
            }
          }
          if (!dataIsoFormatada && h.data) {
            dataIsoFormatada = h.data.split('T')[0];
          }

          if (!pacienteNome && h.titulo && h.titulo.includes('—')) {
            pacienteNome = h.titulo.replace('✓ Sessão —', '').split('·')[0].trim();
          }

          if (h.pac_id && dataIsoFormatada) {
            evolucaoByPacDataMap.set(`${h.pac_id}_${dataIsoFormatada}`, texto);
          }

          if (pacienteNome && dataIsoFormatada) {
            const normNome = pacienteNome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            evolucaoByNomeDataMap.set(`${normNome}_${dataIsoFormatada}`, texto);
          }
        }
      });
    }

    const resultado: FechamentoItemGestao[] = [];

    for (const it of (itens || [])) {
      const appt = it.atendimento_id ? apptsMap.get(it.atendimento_id) : null;
      let valCalc = Number(it.valor_calculado || 0);

      if (appt) {
        const valorEst = calcularValorSessao(appt, profData);
        if (valCalc !== valorEst) {
          valCalc = valorEst;
          supabase
            .from('fechamento_item')
            .update({ valor_calculado: valCalc })
            .eq('id', it.id)
            .then();
        }
      }

      let evolTexto = appt?.evolucao || '';
      if (!evolTexto && appt) {
        if (evolucaoMap.has(appt.id)) {
          evolTexto = evolucaoMap.get(appt.id)!;
        } else if (appt.pac_id && (appt.data_iso || appt.data)) {
          const dt = appt.data_iso || appt.data;
          const key = `${appt.pac_id}_${dt}`;
          if (evolucaoByPacDataMap.has(key)) {
            evolTexto = evolucaoByPacDataMap.get(key)!;
          }
        }

        if (!evolTexto && appt.paciente && (appt.data_iso || appt.data)) {
          const dt = appt.data_iso || appt.data;
          const normNome = appt.paciente.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
          const key = `${normNome}_${dt}`;
          if (evolucaoByNomeDataMap.has(key)) {
            evolTexto = evolucaoByNomeDataMap.get(key)!;
          }
        }
      }

      resultado.push({
        ...it,
        valor_calculado: valCalc,
        valor_ajustado: it.valor_ajustado !== null ? Number(it.valor_ajustado) : null,
        atendimento: appt ? {
          id: appt.id,
          data_iso: appt.data_iso || appt.data,
          hora_inicio: appt.hora_inicio || appt.horario || '—',
          paciente: appt.paciente || appt.paciente_nome || '—',
          tipo_sessao: appt.tipo || appt.tipo_sessao || 'Sessão',
          procedimento: appt.plano || appt.convenio || appt.procedimento || 'Particular',
          status: appt.status || 'Agendado'
        } : undefined
      });
    }

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
