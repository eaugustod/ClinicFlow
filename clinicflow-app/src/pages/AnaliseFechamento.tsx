import React, { useState, useEffect } from 'react';
import { Search, Loader2, Calendar, User, CheckCircle2, AlertCircle, Clock, ShieldAlert, Check, X, FileText, History, RefreshCw, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Agendamento } from '../types';
import { fechamentoGestaoService, type FechamentoPeriodoGestao, type FechamentoItemGestao, type FechamentoHistoricoItem } from '../services/fechamentoGestaoService';

interface GroupedPatient {
  pacienteNome: string;
  agendamentos: Agendamento[];
}

export const AnaliseFechamento: React.FC = () => {
  const { profissionais, statusAgendamentos, getStatusColor, logStatusChange, refreshAll, user } = useApp();

  // Aba ativa: 'analise' (original) ou 'painel_fechamento' (novo escopo 5.2)
  const [activeTab, setActiveTab] = useState<'analise' | 'painel_fechamento'>('painel_fechamento');

  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [groupedData, setGroupedData] = useState<GroupedPatient[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Estados da Aba Painel de Fechamentos (Conferência 5.2)
  const [periodosGestao, setPeriodosGestao] = useState<FechamentoPeriodoGestao[]>([]);
  const [loadingPainel, setLoadingPainel] = useState(false);
  const [selectedPeriodoDetail, setSelectedPeriodoDetail] = useState<FechamentoPeriodoGestao | null>(null);
  const [itensPeriodoDetail, setItensPeriodoDetail] = useState<FechamentoItemGestao[]>([]);
  const [loadingItensDetail, setLoadingItensDetail] = useState(false);

  // Modal Ajustar / Manter Original
  const [resolvingItem, setResolvingItem] = useState<FechamentoItemGestao | null>(null);
  const [resolveAction, setResolveAction] = useState<'ajustar' | 'manter'>('ajustar');
  const [valorAjustadoInput, setValorAjustadoInput] = useState<string>('');
  const [obsGestaoInput, setObsGestaoInput] = useState<string>('');
  const [savingResolution, setSavingResolution] = useState(false);

  // Modal de Histórico
  const [historicoModalItem, setHistoricoModalItem] = useState<FechamentoItemGestao | null>(null);
  const [historicoLogs, setHistoricoLogs] = useState<FechamentoHistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  // Modal Fechamento Oficial
  const [closingPeriodo, setClosingPeriodo] = useState<FechamentoPeriodoGestao | null>(null);
  const [executingClose, setExecutingClose] = useState(false);
  const [diaPrazo, setDiaPrazo] = useState<number>(10);

  // Auto-select first professional when loaded for single search tab
  useEffect(() => {
    if (profissionais.length > 0 && selectedProfId === null) {
      setSelectedProfId(profissionais[0].id);
    }
  }, [profissionais, selectedProfId]);

  useEffect(() => {
    if (selectedProfId !== null && !hasSearched) {
      handleAnalisar();
    }
  }, [selectedProfId]);

  // Carrega painel de fechamento por competência
  const carregarPainelFechamento = async () => {
    if (!selectedMonth || profissionais.length === 0) return;
    setLoadingPainel(true);
    try {
      const lista = await fechamentoGestaoService.listarFechamentosPorCompetencia(selectedMonth, profissionais);
      setPeriodosGestao(lista);

      // Se havia um detalhe selecionado, atualiza ele
      if (selectedPeriodoDetail) {
        const atualizado = lista.find(p => p.profissional_id === selectedPeriodoDetail.profissional_id);
        if (atualizado) {
          setSelectedPeriodoDetail(atualizado);
        }
      }
    } catch (e) {
      console.error('[AnaliseFechamento] Erro ao carregar painel:', e);
    } finally {
      setLoadingPainel(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'painel_fechamento') {
      carregarPainelFechamento();
    }
  }, [activeTab, selectedMonth, profissionais]);

  // Carrega detalhe de atendimentos de um período selecionado
  const handleSelectPeriodoDetail = async (p: FechamentoPeriodoGestao) => {
    setSelectedPeriodoDetail(p);
    if (!p.id) {
      setItensPeriodoDetail([]);
      return;
    }

    setLoadingItensDetail(true);
    try {
      const itens = await fechamentoGestaoService.buscarItensFechamentoPeriodo(p.id);
      setItensPeriodoDetail(itens);
    } catch (e) {
      console.error('[AnaliseFechamento] Erro ao carregar itens:', e);
    } finally {
      setLoadingItensDetail(false);
    }
  };

  // Abrir conferência para um terapeuta
  const handleAbrirConferencia = async (profId: number) => {
    const ok = await fechamentoGestaoService.abrirConferenciaProfissional(profId, selectedMonth, diaPrazo);
    if (ok) {
      showToast('Conferência aberta com sucesso para o terapeuta!');
      carregarPainelFechamento();
    } else {
      showToast('Erro ao abrir conferência.');
    }
  };

  // Abrir conferência para todos os terapeutas do mês
  const handleAbrirConferenciaTodos = async () => {
    setLoadingPainel(true);
    let count = 0;
    for (const p of profissionais) {
      const ok = await fechamentoGestaoService.abrirConferenciaProfissional(p.id, selectedMonth, diaPrazo);
      if (ok) count++;
    }
    setLoadingPainel(false);
    showToast(`Conferência aberta para ${count} terapeuta(s)!`);
    carregarPainelFechamento();
  };

  // Abrir modal de resolução de contestação
  const handleOpenResolveModal = (item: FechamentoItemGestao, acao: 'ajustar' | 'manter') => {
    setResolvingItem(item);
    setResolveAction(acao);
    setValorAjustadoInput(String(item.valor_ajustado !== null ? item.valor_ajustado : item.valor_calculado));
    setObsGestaoInput('');
  };

  const handleSalvarResolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingItem || !obsGestaoInput.trim()) {
      alert('A justificativa / observação da gestão é obrigatória.');
      return;
    }

    const valorNum = resolveAction === 'ajustar' ? parseFloat(valorAjustadoInput) : null;
    if (resolveAction === 'ajustar' && (isNaN(valorNum!) || valorNum! < 0)) {
      alert('Por favor, informe um valor ajustado válido.');
      return;
    }

    setSavingResolution(true);
    const usuarioNome = user?.nome || 'Gestão';
    const ok = await fechamentoGestaoService.resolverContestacao(
      resolvingItem.id,
      resolveAction,
      valorNum,
      obsGestaoInput,
      usuarioNome
    );
    setSavingResolution(false);

    if (ok) {
      showToast('Contestação resolvida com sucesso!');
      setResolvingItem(null);
      if (selectedPeriodoDetail) {
        carregarItensDetalhados(selectedPeriodoDetail.id);
      }
      carregarPainelFechamento();
    } else {
      showToast('Erro ao salvar resolução.');
    }
  };

  // Reabrir item
  const handleReabrirItem = async (item: FechamentoItemGestao) => {
    if (!confirm('Deseja reabrir este atendimento para o status PENDENTE?')) return;
    const usuarioNome = user?.nome || 'Gestão';
    const ok = await fechamentoGestaoService.reabrirItem(item.id, usuarioNome);
    if (ok) {
      showToast('Item reaberto com sucesso!');
      if (selectedPeriodoDetail) {
        carregarItensDetalhados(selectedPeriodoDetail.id);
      }
      carregarPainelFechamento();
    } else {
      showToast('Erro ao reabrir item.');
    }
  };

  // Ver histórico
  const handleVerHistorico = async (item: FechamentoItemGestao) => {
    setHistoricoModalItem(item);
    setLoadingHistorico(true);
    const logs = await fechamentoGestaoService.buscarHistoricoItem(item.id);
    setHistoricoLogs(logs);
    setLoadingHistorico(false);
  };

  // Fechar período oficialmente
  const handleConfirmarFechamentoOficial = async () => {
    if (!closingPeriodo) return;
    setExecutingClose(true);
    const usuarioId = user?.id || '00000000-0000-0000-0000-000000000000';
    const usuarioNome = user?.nome || 'Gestão';
    const ok = await fechamentoGestaoService.fecharPeriodoOficial(closingPeriodo.id, usuarioId, usuarioNome);
    setExecutingClose(false);
    setClosingPeriodo(null);

    if (ok) {
      showToast('Período fechado oficialmente pela clínica com sucesso!');
      carregarPainelFechamento();
    } else {
      showToast('Erro ao fechar período.');
    }
  };

  // Format month (e.g., 2026-06 -> Junho de 2026)
  const formatMonthLabel = (monthIso: string) => {
    if (!monthIso) return '';
    const [y, m] = monthIso.split('-').map(Number);
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[m - 1]} de ${y}`;
  };

  const formatDateShort = (dateIso: string) => {
    if (!dateIso) return '—';
    const parts = dateIso.split('-');
    if (parts.length < 3) return dateIso;
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(2)}`;
  };

  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Fetch agendamentos for therapist & month (Aba de Análise Original)
  const handleAnalisar = async () => {
    if (!selectedProfId || !selectedMonth) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const primDay = `${selectedMonth}-01`;
      const ultDay = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('prof_id', selectedProfId)
        .gte('data_iso', primDay)
        .lte('data_iso', ultDay)
        .order('data_iso', { ascending: true });

      if (error) throw error;

      const mapped: Agendamento[] = (data || []).map(mappers.dbToAppt);

      const map = new Map<string, Agendamento[]>();
      mapped.forEach(a => {
        const name = (a.paciente || 'Sem Nome').trim();
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(a);
      });

      const groups: GroupedPatient[] = Array.from(map.entries())
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, 'pt-BR'))
        .map(([name, appts]) => ({
          pacienteNome: name,
          agendamentos: appts.sort((x, y) => x.dataISO.localeCompare(y.dataISO))
        }));

      setGroupedData(groups);
    } catch (e) {
      console.error('[AnaliseFechamento] Erro ao buscar agendamentos:', e);
      alert('Erro ao carregar dados de análise.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      await logStatusChange(id, newStatus);
      await refreshAll();

      setGroupedData(prev => prev.map(group => ({
        ...group,
        agendamentos: group.agendamentos.map(a => 
          a.id === id ? { ...a, status: newStatus } : a
        )
      })));

      showToast(`Status gravado no Supabase com sucesso: "${newStatus}"`);
    } catch (e: any) {
      console.error('[AnaliseFechamento] Erro ao atualizar status:', e);
      alert('Erro ao gravar alteração de status no Supabase.');
    } finally {
      setUpdatingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const totalAgendamentos = groupedData.reduce((acc, g) => acc + g.agendamentos.length, 0);
  const totalPacientes = groupedData.length;
  const selectedProfObj = profissionais.find(p => p.id === selectedProfId);

  const availableStatuses = statusAgendamentos.length > 0 
    ? statusAgendamentos.map(s => s.nome)
    : ['Agendado', 'Confirmado', 'Em espera (Chegou)', 'Atendido', 'Desmarcado', 'Cancelado'];

  const getMatchingStatusName = (rawStatus: string) => {
    if (!rawStatus) return 'Agendado';
    const found = statusAgendamentos.find(
      s => s.nome.toLowerCase() === rawStatus.toLowerCase()
    );
    if (found) return found.nome;

    const foundByBase = statusAgendamentos.find(
      s => s.statusAgendamento.toLowerCase() === rawStatus.toLowerCase()
    );
    if (foundByBase) return foundByBase.nome;

    const foundAvailable = availableStatuses.find(
      st => st.toLowerCase() === rawStatus.toLowerCase()
    );
    if (foundAvailable) return foundAvailable;

    return rawStatus;
  };

  const getStatusPeriodoBadgeGestao = (st: string) => {
    switch (st) {
      case 'nao_iniciado':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">Não Iniciado</span>;
      case 'aberto_para_conferencia':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Aberto</span>;
      case 'contestado':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Em Contestação</span>;
      case 'aprovado_pelo_terapeuta':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Aprovado Terapeuta</span>;
      case 'fechado_pela_clinica':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">Fechado Clínica</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-500/20 text-gray-400">{st}</span>;
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-4 animate-fade-in text-xs overflow-hidden">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--bg-surface)] border border-emerald-500/40 text-[var(--text-primary)] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-xs">{toastMsg}</span>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4 transition-colors duration-300 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-widest">
              Gestão Financeira
            </span>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-wide mt-0.5 font-sans">
              Análise e Painel de Fechamentos
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Gerencie a conferência de atendimentos, resolva contestações de terapeutas e efetue o fechamento mensal oficial.
            </p>
          </div>

          {/* Abas de Navegação e Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Abas */}
            <div className="flex items-center bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('painel_fechamento')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'painel_fechamento'
                    ? 'bg-[var(--accent)] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Painel de Fechamentos (Tela 5.2)
              </button>
              <button
                onClick={() => setActiveTab('analise')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'analise'
                    ? 'bg-[var(--accent)] text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Análise Individual de Consultas
              </button>
            </div>

            {/* Filter Mês/Ano */}
            <div className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-[var(--accent)]" />
              <label className="text-[11px] font-bold text-[var(--text-muted)]">Mês/Ano:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>

            {/* Filter Dia Limite do Prazo */}
            <div className="flex items-center gap-1.5 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5" title="Dia limite do mês seguinte para encerramento da conferência pelos terapeutas">
              <Clock size={14} className="text-[var(--accent)]" />
              <label className="text-[11px] font-bold text-[var(--text-muted)]">Dia Limite:</label>
              <input
                type="number"
                min="1"
                max="31"
                value={diaPrazo}
                onChange={(e) => setDiaPrazo(Math.max(1, Math.min(31, parseInt(e.target.value) || 10)))}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] w-8 text-center focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: PAINEL DE FECHAMENTOS (ESCORPO TELA 5.2) */}
      {activeTab === 'painel_fechamento' && (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          {/* Coluna Esquerda: Lista de Terapeutas no Mês (Lg: col 5) */}
          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-3">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-sm">Status dos Terapeutas</h3>
                <p className="text-[11px] text-[var(--text-muted)]">Ordenado por quantidade de contestações</p>
              </div>
              <button
                onClick={handleAbrirConferenciaTodos}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-all cursor-pointer"
                title="Abrir conferência para todos os terapeutas no mês"
              >
                Abrir Todos
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
              {loadingPainel ? (
                <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
                  <span>Carregando dados dos terapeutas...</span>
                </div>
              ) : periodosGestao.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)]">
                  Nenhum terapeuta encontrado.
                </div>
              ) : (
                periodosGestao.map((p) => {
                  const isSelected = selectedPeriodoDetail?.profissional_id === p.profissional_id;
                  const temContestacao = p.qtd_contestados > 0;

                  return (
                    <div
                      key={p.profissional_id}
                      onClick={() => {
                        setSelectedPeriodoDetail(p);
                        if (p.id) carregarItensDetalhados(p.id);
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'border-[var(--accent)] bg-[var(--bg-raised)] shadow-md'
                          : 'border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{p.profissional_nome}</span>
                        {getStatusPeriodoBadgeGestao(p.status)}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span>Total Atendimentos: <strong>{p.qtd_itens_total}</strong></span>
                        <span>Pendentes: <strong>{p.qtd_pendentes}</strong></span>
                        <span className={temContestacao ? 'text-amber-400 font-bold' : ''}>
                          Contestados: <strong>{p.qtd_contestados}</strong>
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50">
                        <span className="font-bold text-[var(--accent)] text-xs font-mono">
                          {formatMoney(p.valor_total_calculado)}
                        </span>

                        <div className="flex items-center gap-2">
                          {p.status === 'nao_iniciado' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAbrirConferencia(p.profissional_id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] cursor-pointer"
                            >
                              Abrir Conferência
                            </button>
                          )}

                          {p.status === 'aprovado_pelo_terapeuta' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setClosingPeriodo(p);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer shadow-sm animate-pulse"
                            >
                              Fechar Período
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna Direita: Detalhe dos Atendimentos & Resolução de Contestações (Lg: col 7) */}
          <div className="lg:col-span-7 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-col min-h-0 overflow-hidden">
            {!selectedPeriodoDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                <FileText size={36} className="opacity-40" />
                <p className="font-semibold text-xs">Selecione um terapeuta à esquerda para visualizar e gerenciar as contestações.</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
                {/* Header do Terapeuta Selecionado */}
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)] text-base">
                      {selectedPeriodoDetail.profissional_nome}
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Competência: {formatMonthLabel(selectedMonth)} | Status: {selectedPeriodoDetail.status}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPeriodoDetail.status === 'aprovado_pelo_terapeuta' && (
                      <button
                        onClick={() => setClosingPeriodo(selectedPeriodoDetail)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock size={14} />
                        <span>Efetuar Fechamento Oficial</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabela Detalhada dos Itens */}
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 border border-[var(--border)] rounded-xl">
                  {loadingItensDetail ? (
                    <div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center gap-2">
                      <Loader2 size={24} className="animate-spin text-[var(--accent)]" />
                      <span>Carregando itens do período...</span>
                    </div>
                  ) : itensPeriodoDetail.length === 0 ? (
                    <div className="p-8 text-center text-[var(--text-muted)]">
                      Período ainda não gerou itens ou sem atendimentos.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-wider sticky top-0 bg-[var(--bg-surface)]">
                          <th className="py-2.5 px-3">Data/Hora</th>
                          <th className="py-2.5 px-3">Paciente</th>
                          <th className="py-2.5 px-3 text-right">Valor Calc.</th>
                          <th className="py-2.5 px-3">Status / Contestação</th>
                          <th className="py-2.5 px-3 text-right">Ações da Gestão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {itensPeriodoDetail.map((item) => {
                          const isEmAnalise = item.status_item === 'em_analise' || item.status_item === 'contestado';
                          const isConfirmado = item.status_item === 'confirmado' || item.status_item === 'confirmado_automaticamente';

                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-[var(--table-hover)] transition-colors ${
                                isEmAnalise ? 'bg-amber-500/10 dark:bg-amber-500/5' : ''
                              }`}
                            >
                              {/* Data/Hora */}
                              <td className="py-2.5 px-3 font-mono font-bold">
                                {formatDateShort(item.atendimento?.data_iso || item.criado_em)}
                                <div className="text-[10px] text-[var(--text-muted)] font-normal">{item.atendimento?.hora_inicio || '—'}</div>
                              </td>

                              {/* Paciente */}
                              <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                                {item.atendimento?.paciente || item.paciente_sugerido || '—'}
                              </td>

                              {/* Valor */}
                              <td className="py-2.5 px-3 text-right font-mono font-bold">
                                {item.status_item === 'resolvido_ajustado' && item.valor_ajustado !== null ? (
                                  <div>
                                    <span className="line-through text-[var(--text-muted)] text-[10px] mr-1">{formatMoney(item.valor_calculado)}</span>
                                    <span className="text-blue-400">{formatMoney(item.valor_ajustado)}</span>
                                  </div>
                                ) : (
                                  <span>{formatMoney(item.valor_calculado)}</span>
                                )}
                              </td>

                              {/* Status / Contestação */}
                              <td className="py-2.5 px-3">
                                <div>{getStatusPeriodoBadgeGestao(item.status_item)}</div>

                                {item.motivo_contestacao && (
                                  <div className="text-[10px] text-amber-400 font-semibold mt-1">
                                    Motivo: {item.motivo_contestacao}
                                  </div>
                                )}
                                {item.observacao_terapeuta && (
                                  <div className="text-[10px] text-[var(--text-muted)] italic">
                                    "{item.observacao_terapeuta}"
                                  </div>
                                )}
                                {item.observacao_gestao && (
                                  <div className="text-[10px] text-emerald-400 font-medium">
                                    Gestão: "{item.observacao_gestao}"
                                  </div>
                                )}
                              </td>

                              {/* Ações */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isEmAnalise && (
                                    <>
                                      <button
                                        onClick={() => handleOpenResolveModal(item, 'ajustar')}
                                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Ajustar
                                      </button>
                                      <button
                                        onClick={() => handleOpenResolveModal(item, 'manter')}
                                        className="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-[10px] font-bold cursor-pointer"
                                      >
                                        Manter
                                      </button>
                                    </>
                                  )}

                                  {isConfirmado && (
                                    <button
                                      onClick={() => handleReabrirItem(item)}
                                      className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-bold cursor-pointer"
                                      title="Reabrir item para status Pendente"
                                    >
                                      Reabrir
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleVerHistorico(item)}
                                    className="p-1 rounded bg-[var(--bg-raised)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                                    title="Ver Histórico de Auditoria"
                                  >
                                    <History size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: ANÁLISE INDIVIDUAL DE CONSULTAS (MANTIDO 100% IGUAL AO ORIGINAL) */}
      {activeTab === 'analise' && (
        <>
          {/* Controls Bar da Análise Individual */}
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5">
                <User size={14} className="text-[var(--accent)]" />
                <label className="text-[11px] font-bold text-[var(--text-muted)]">Profissional:</label>
                <select
                  value={selectedProfId || ''}
                  onChange={(e) => setSelectedProfId(Number(e.target.value))}
                  className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer max-w-[180px]"
                >
                  {profissionais.map(p => (
                    <option key={p.id} value={p.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAnalisar}
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--accent-glow)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                <span>Analisar Consultas</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-center">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Pacientes</span>
                <p className="text-xs font-black text-[var(--text-primary)] font-mono">{totalPacientes}</p>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-center">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Consultas</span>
                <p className="text-xs font-black text-[var(--accent)] font-mono">{totalAgendamentos}</p>
              </div>
            </div>
          </div>

          {/* Tabela da Análise Individual */}
          <div className="flex-1 min-h-0 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm transition-colors duration-300 flex flex-col">
            <div className="overflow-auto flex-1 scrollbar-thin">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
                <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
                <p className="text-xs font-semibold">Buscando agendamentos no Supabase...</p>
              </div>
            ) : groupedData.length === 0 ? (
              <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
                <AlertCircle size={32} className="text-[var(--text-muted)]" />
                <p className="text-xs font-semibold">Nenhum agendamento encontrado para o período e terapeuta selecionados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6 w-2/5">Paciente</th>
                      <th className="py-3.5 px-6 w-1/4">Data Agenda</th>
                      <th className="py-3.5 px-6 w-1/3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] text-xs">
                    {groupedData.map((group, groupIdx) => (
                      <React.Fragment key={group.pacienteNome + groupIdx}>
                        <tr className="bg-[var(--bg-raised)]/60 font-bold border-t border-b border-[var(--border)]">
                          <td colSpan={3} className="py-3 px-6 text-[var(--text-primary)]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black tracking-wide text-[var(--text-primary)]">
                                {group.pacienteNome}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                                {group.agendamentos.length} consulta(s)
                              </span>
                            </div>
                          </td>
                        </tr>

                        {group.agendamentos.map((appt) => {
                          const isUpdatingThis = updatingId === appt.id;
                          const currentStatusName = getMatchingStatusName(appt.status);
                          const statusColor = getStatusColor(currentStatusName);

                          return (
                            <tr
                              key={appt.id}
                              className="hover:bg-[var(--table-hover)] transition-colors duration-150"
                            >
                              <td className="py-2.5 px-6 pl-10 text-[var(--text-secondary)] font-medium">
                                {group.pacienteNome}
                              </td>

                              <td className="py-2.5 px-6 font-mono font-bold text-[var(--text-primary)]">
                                {formatDateShort(appt.dataISO)}
                              </td>

                              <td className="py-2.5 px-6">
                                <div className="flex items-center gap-2">
                                  {isUpdatingThis ? (
                                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-[11px]">
                                      <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
                                      <span>Salvando...</span>
                                    </div>
                                  ) : (
                                    <select
                                      value={currentStatusName}
                                      onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                                      style={{
                                        borderColor: `${statusColor}50`,
                                        color: statusColor,
                                        backgroundColor: `${statusColor}10`
                                      }}
                                      className="border rounded-xl px-3 py-1 text-[11px] font-bold focus:outline-none cursor-pointer font-sans transition-all hover:opacity-90 max-w-[200px]"
                                    >
                                      {availableStatuses.map((st) => (
                                        <option
                                          key={st}
                                          value={st}
                                          className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                                        >
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        </>
      )}

      {/* MODAL DE RESOLUÇÃO DA CONTESTAÇÃO (AJUSTAR OU MANTER) */}
      {resolvingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold">
                {resolveAction === 'ajustar' ? 'Ajustar Registro Contestado' : 'Manter Registro Original'}
              </h3>
              <button onClick={() => setResolvingItem(null)} className="text-[var(--text-muted)] font-bold text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarResolucao} className="space-y-4">
              <div className="bg-[var(--bg-raised)] p-3 rounded-xl text-xs space-y-1">
                <div><strong>Paciente:</strong> {resolvingItem.atendimento?.paciente || resolvingItem.paciente_sugerido || '—'}</div>
                <div><strong>Valor original:</strong> {formatMoney(resolvingItem.valor_calculado)}</div>
                <div><strong>Motivo do Terapeuta:</strong> {resolvingItem.motivo_contestacao || '—'}</div>
                {resolvingItem.observacao_terapeuta && (
                  <div><strong>Obs. Terapeuta:</strong> "{resolvingItem.observacao_terapeuta}"</div>
                )}
              </div>

              {resolveAction === 'ajustar' && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                    Novo Valor Ajustado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorAjustadoInput}
                    onChange={(e) => setValorAjustadoInput(e.target.value)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs font-bold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">
                  Justificativa / Observação da Gestão *
                </label>
                <textarea
                  rows={3}
                  value={obsGestaoInput}
                  onChange={(e) => setObsGestaoInput(e.target.value)}
                  placeholder="Escreva a justificativa da decisão da gestão..."
                  className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingItem(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingResolution}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  {savingResolution ? 'Salvando...' : 'Confirmar Decisão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE TRILHA DE AUDITORIA */}
      {historicoModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <History size={18} className="text-[var(--accent)]" />
                <span>Trilha de Auditoria do Atendimento</span>
              </h3>
              <button onClick={() => setHistoricoModalItem(null)} className="text-[var(--text-muted)] font-bold text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto scrollbar-thin space-y-2">
              {loadingHistorico ? (
                <div className="p-8 text-center text-[var(--text-muted)]">Carregando histórico...</div>
              ) : historicoLogs.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)]">Nenhum registro de alteração encontrado.</div>
              ) : (
                historicoLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[var(--accent)]">{log.status_anterior || 'início'} ➔ {log.status_novo}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {new Date(log.alterado_em).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      Alterado por: <strong>{log.alterado_por || 'Sistema'}</strong>
                    </div>
                    {log.observacao && (
                      <div className="text-[11px] text-[var(--text-primary)] font-italic">
                        "{log.observacao}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoricoModalItem(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-bold cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FECHAMENTO OFICIAL DA CLÍNICA */}
      {closingPeriodo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-[var(--text-primary)] text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center text-2xl font-bold">
              🔒
            </div>
            <h3 className="text-base font-bold">Confirmar Fechamento Oficial da Clínica?</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Terapeuta: <strong>{closingPeriodo.profissional_nome}</strong><br />
              Competência: <strong>{formatMonthLabel(selectedMonth)}</strong><br />
              Valor Total Fechado: <strong className="text-emerald-400 text-sm font-mono">{formatMoney(closingPeriodo.valor_total_calculado)}</strong>
            </p>
            <p className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              ⚠️ Esta ação fechará oficialmente o período e congelará edições posteriores nos itens deste mês.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClosingPeriodo(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarFechamentoOficial}
                disabled={executingClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-lg transition-all"
              >
                {executingClose ? 'Fechando...' : 'Confirmar Fechamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
