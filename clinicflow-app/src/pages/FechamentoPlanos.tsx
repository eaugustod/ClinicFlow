import React, { useState, useEffect, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  Calendar,
  CalendarDays,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Edit3,
  Filter,
  DollarSign,
  AlertCircle,
  Info,
  X,
  Building2,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  fechamentoPlanosService,
  FechamentoPlano,
  AlertaNotification
} from '../services/fechamentoPlanosService';

export const FechamentoPlanosPage: React.FC = () => {
  const { planos } = useApp();
  const [items, setItems] = useState<FechamentoPlano[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FechamentoPlano | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    planoId: '' as string | number,
    planoNome: '',
    planoCodigo: '',
    dataEntregaInicial: '',
    dataEntregaFinal: '',
    dataPagamento: '',
    observacoes: '',
    status: 'ativo' as 'ativo' | 'concluido' | 'cancelado'
  });

  const [formError, setFormError] = useState('');

  // Carregar dados do Supabase
  const loadData = async () => {
    setLoading(true);
    const data = await fechamentoPlanosService.list();
    setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Alertas calculados dinamicamente
  const alertas = useMemo(() => {
    return fechamentoPlanosService.calcularAlertas(items);
  }, [items]);

  // Estatísticas dos cards superiores
  const stats = useMemo(() => {
    const total = items.length;
    const ativos = items.filter((i) => i.status === 'ativo').length;
    const comAlertaCritico = alertas.filter(
      (a) => a.tipo === 'quatro_dias_final' || a.tipo === 'hoje_final' || a.tipo === 'vencido'
    ).length;
    const comNotifInicio = alertas.filter(
      (a) => a.tipo === 'uma_semana_inicio' || a.tipo === 'tres_dias_inicio'
    ).length;

    return { total, ativos, comAlertaCritico, comNotifInicio };
  }, [items, alertas]);

  // Filtro da lista
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.planoNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.planoCodigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.observacoes && item.observacoes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus =
        statusFilter === 'todos' ? true : item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [items, searchTerm, statusFilter]);

  // Abrir Modal de Novo
  const handleOpenNew = () => {
    setEditingItem(null);
    setFormError('');
    setFormData({
      planoId: planos.length > 0 ? planos[0].id : '',
      planoNome: planos.length > 0 ? planos[0].nome : '',
      planoCodigo: planos.length > 0 ? planos[0].ans || planos[0].codPrestador || `PLN-${planos[0].id}` : '',
      dataEntregaInicial: new Date().toISOString().split('T')[0],
      dataEntregaFinal: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dataPagamento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      observacoes: '',
      status: 'ativo'
    });
    setModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEdit = (item: FechamentoPlano) => {
    setEditingItem(item);
    setFormError('');
    setFormData({
      planoId: item.planoId || '',
      planoNome: item.planoNome,
      planoCodigo: item.planoCodigo,
      dataEntregaInicial: item.dataEntregaInicial,
      dataEntregaFinal: item.dataEntregaFinal,
      dataPagamento: item.dataPagamento,
      observacoes: item.observacoes || '',
      status: item.status
    });
    setModalOpen(true);
  };

  // Ao selecionar um plano no formulário, autopreencher dados do plano
  const handleSelectPlanoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;
    const selected = planos.find((p) => String(p.id) === String(val));
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        planoId: selected.id,
        planoNome: selected.nome,
        planoCodigo: selected.ans || selected.codPrestador || `PLN-${selected.id}`
      }));
    }
  };

  // Salvar formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.planoNome.trim()) {
      setFormError('Informe o nome do Plano de Saúde.');
      return;
    }
    if (!formData.dataEntregaInicial) {
      setFormError('Selecione a data de entrega inicial.');
      return;
    }
    if (!formData.dataEntregaFinal) {
      setFormError('Selecione a data de entrega final.');
      return;
    }
    if (!formData.dataPagamento) {
      setFormError('Selecione a data de pagamento.');
      return;
    }

    if (new Date(formData.dataEntregaFinal) < new Date(formData.dataEntregaInicial)) {
      setFormError('A data de entrega final não pode ser anterior à data inicial.');
      return;
    }

    setFormError('');

    const payload = {
      planoId: formData.planoId ? Number(formData.planoId) : undefined,
      planoNome: formData.planoNome.trim(),
      planoCodigo: formData.planoCodigo.trim(),
      dataEntregaInicial: formData.dataEntregaInicial,
      dataEntregaFinal: formData.dataEntregaFinal,
      dataPagamento: formData.dataPagamento,
      observacoes: formData.observacoes.trim(),
      status: formData.status
    };

    if (editingItem) {
      await fechamentoPlanosService.update(editingItem.id, payload);
    } else {
      await fechamentoPlanosService.create(payload);
    }

    setModalOpen(false);
    loadData();
  };

  // Confirmar Exclusão
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await fechamentoPlanosService.delete(deleteId);
    setDeleteId(null);
    loadData();
  };

  // Formatação de Datas
  const formatDate = (dStr: string) => {
    if (!dStr) return '-';
    const [y, m, d] = dStr.split('-');
    return `${d}/${m}/${y}`;
  };

  // Utilitário para resgatar badge de alerta por fechamento
  const getBadgeAlerta = (item: FechamentoPlano) => {
    const itemAlertas = alertas.filter((a) => a.fechamentoId === item.id);
    if (itemAlertas.length === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 size={12} /> Prazo Regular
        </span>
      );
    }

    const maisUrgente = itemAlertas[0];

    if (maisUrgente.tipo === 'vencido') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 animate-pulse">
          <AlertCircle size={12} /> Prazo Expirado
        </span>
      );
    }

    if (maisUrgente.tipo === 'hoje_final' || maisUrgente.tipo === 'quatro_dias_final') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <AlertTriangle size={12} /> Alerta Encerramento ({maisUrgente.diasRestantes}d)
        </span>
      );
    }

    if (maisUrgente.tipo === 'tres_dias_inicio') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          <Clock size={12} /> Início em 3d
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
        <Info size={12} /> Início em 1 Sem.
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1">
      {/* Header da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border)] shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
            <HeartHandshake size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-wide">
              Prazos de Fechamento por Plano de Saúde
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Gerencie os prazos de entrega inicial/final e datas de pagamento com alertas automatizados (7d, 3d e 4d).
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-xs shadow-lg shadow-indigo-500/25 transition-all duration-200 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          <span>Novo Prazo de Fechamento</span>
        </button>
      </div>

      {/* Cards de Resumo e Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <CalendarDays size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Total de Registros</span>
            <p className="text-xl font-bold text-[var(--text-primary)] mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Alertas Encerramento (&le;4d)</span>
            <p className="text-xl font-bold text-amber-400 mt-0.5">{stats.comAlertaCritico}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Início Próximo (7d / 3d)</span>
            <p className="text-xl font-bold text-blue-400 mt-0.5">{stats.comNotifInicio}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)] flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Prazos Ativos</span>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">{stats.ativos}</p>
          </div>
        </div>
      </div>

      {/* Faixa de Alertas Ativos Recentes */}
      {alertas.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <AlertTriangle size={15} /> Notificações Ativas do Sistema ({alertas.length})
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {alertas.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 bg-[var(--bg-surface)]/80 backdrop-blur-sm border border-[var(--border)] px-3 py-1.5 rounded-xl text-xs"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    a.nivel === 'error'
                      ? 'bg-rose-500 animate-ping'
                      : a.nivel === 'urgent'
                      ? 'bg-amber-400 animate-pulse'
                      : a.nivel === 'warning'
                      ? 'bg-yellow-400'
                      : 'bg-indigo-400'
                  }`}
                />
                <span className="font-bold text-[var(--text-primary)]">{a.planoNome}:</span>
                <span className="text-[var(--text-secondary)]">{a.mensagem}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--bg-surface)] p-4 rounded-2xl border border-[var(--border)]">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por plano de saúde, código ou observação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={15} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="concluido">Concluídos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
      </div>

      {/* Tabela de Fechamentos */}
      <div className="flex-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-md flex flex-col min-h-[350px]">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#0f1118]/60 text-[var(--text-secondary)] font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4">Plano de Saúde & Código</th>
                <th className="py-3.5 px-4">Data Entrega Inicial</th>
                <th className="py-3.5 px-4">Data Entrega Final</th>
                <th className="py-3.5 px-4">Data de Pagamento</th>
                <th className="py-3.5 px-4">Status / Alerta</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                      Carregando prazos de fechamento do Supabase...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Nenhum prazo de fechamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-400 text-xs shrink-0">
                          {item.planoNome.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-primary)] text-xs">{item.planoNome}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono">{item.planoCodigo || 'Sem código'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                        <Calendar size={13} className="text-indigo-400" />
                        <span>{formatDate(item.dataEntregaInicial)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                        <CalendarDays size={13} className="text-amber-400" />
                        <span>{formatDate(item.dataEntregaFinal)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                        <DollarSign size={13} className="text-emerald-400" />
                        <span>{formatDate(item.dataPagamento)}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">{getBadgeAlerta(item)}</td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer"
                          title="Alterar registro"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                          title="Excluir registro"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Incluir / Alterar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[#0f1118]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <HeartHandshake size={18} />
                </div>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">
                  {editingItem ? 'Alterar Prazo de Fechamento' : 'Incluir Novo Prazo de Fechamento'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} /> {formError}
                </div>
              )}

              {/* Seletor de Plano de Saúde Cadastrado */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Selecionar Plano de Saúde Cadastrado
                </label>
                <select
                  value={formData.planoId}
                  onChange={handleSelectPlanoChange}
                  className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="">-- Digitação Manual / Escolha da Tabela --</option>
                  {planos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.ans || p.codPrestador || `Código #${p.id}`})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Nome do Plano de Saúde *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.planoNome}
                    onChange={(e) => setFormData({ ...formData, planoNome: e.target.value })}
                    placeholder="Ex: Unimed Jundiaí"
                    className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Código do Plano (ANS / Prestador)
                  </label>
                  <input
                    type="text"
                    value={formData.planoCodigo}
                    onChange={(e) => setFormData({ ...formData, planoCodigo: e.target.value })}
                    placeholder="Ex: 345678"
                    className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Data Entrega Inicial *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dataEntregaInicial}
                    onChange={(e) => setFormData({ ...formData, dataEntregaInicial: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Data Entrega Final *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dataEntregaFinal}
                    onChange={(e) => setFormData({ ...formData, dataEntregaFinal: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                    Data de Pagamento *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dataPagamento}
                    onChange={(e) => setFormData({ ...formData, dataPagamento: e.target.value })}
                    className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Observações / Instruções de Envio
                </label>
                <textarea
                  rows={3}
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Ex: Entregar protocolo físico assinado na filial Jundiaí..."
                  className="w-full px-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-raised)] text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  {editingItem ? 'Salvar Alterações' : 'Cadastrar Prazo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <Trash2 size={20} />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Excluir Prazo de Fechamento</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Tem certeza que deseja excluir este registro de prazo de fechamento do Supabase? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-raised)] text-xs text-slate-300 font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-lg shadow-rose-600/25 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
