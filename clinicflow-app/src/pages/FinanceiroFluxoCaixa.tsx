import React, { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Building,
  UserCheck,
  Receipt,
  Tag,
  Calendar,
  CreditCard,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Check,
  Edit3,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContaReceber, ContaPagar, CategoriaFinanceira, ResumoFluxoCaixa } from '../types';
import { financeiroFluxoCaixaService } from '../services/financeiroFluxoCaixaService';

export const FinanceiroFluxoCaixa: React.FC = () => {
  const { pacientes, profissionais } = useApp();

  const [activeTab, setActiveTab] = useState<'overview' | 'receber' | 'pagar' | 'categorias'>('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Data States
  const [resumo, setResumo] = useState<ResumoFluxoCaixa>({
    saldoAtual: 0,
    totalReceberMes: 0,
    totalPagarMes: 0,
    resultadoLiquido: 0,
    taxaInadimplencia: 0,
    entradasRecebidas: 0,
    saidasPagas: 0
  });

  const [contasReceber, setContasReceber] = useState<ContaReceber[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);

  // Modal States
  const [isReceberModalOpen, setIsReceberModalOpen] = useState(false);
  const [editingReceberId, setEditingReceberId] = useState<string | null>(null);

  const [isPagarModalOpen, setIsPagarModalOpen] = useState(false);
  const [editingPagarId, setEditingPagarId] = useState<string | null>(null);

  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // Form States - Conta a Receber
  const [recPacienteId, setRecPacienteId] = useState<number | null>(null);
  const [recPacienteNome, setRecPacienteNome] = useState('');
  const [recDescricao, setRecDescricao] = useState('');
  const [recValor, setRecValor] = useState<number | ''>('');
  const [recVencimento, setRecVencimento] = useState(new Date().toISOString().substring(0, 10));
  const [recFormaPag, setRecFormaPag] = useState<'PIX' | 'Cartao_Credito' | 'Cartao_Debito' | 'Boleto' | 'Dinheiro' | 'Convenio'>('PIX');
  const [recCategoriaId, setRecCategoriaId] = useState('cat_rec_1');

  // Form States - Conta a Pagar
  const [pagFornecedor, setPagFornecedor] = useState('');
  const [pagProfId, setPagProfId] = useState<number | null>(null);
  const [pagDescricao, setPagDescricao] = useState('');
  const [pagValor, setPagValor] = useState<number | ''>('');
  const [pagVencimento, setPagVencimento] = useState(new Date().toISOString().substring(0, 10));
  const [pagFormaPag, setPagFormaPag] = useState<'PIX' | 'Transferencia' | 'Boleto' | 'Cartao' | 'Dinheiro'>('PIX');
  const [pagCategoriaId, setPagCategoriaId] = useState('cat_desp_1');

  // Form States - Categoria
  const [catNome, setCatNome] = useState('');
  const [catTipo, setCatTipo] = useState<'Receita' | 'Despesa'>('Despesa');
  const [catCor, setCatCor] = useState('#6366f1');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [res, recList, pagList, catList] = await Promise.all([
        financeiroFluxoCaixaService.getResumoCaixa(),
        financeiroFluxoCaixaService.listContasReceber(),
        financeiroFluxoCaixaService.listContasPagar(),
        financeiroFluxoCaixaService.listCategorias()
      ]);
      setResumo(res);
      setContasReceber(recList);
      setContasPagar(pagList);
      setCategorias(catList);
    } catch (e) {
      console.error('[Financeiro] Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS CONTAS A RECEBER
  // --------------------------------------------------------------------------
  const handleOpenNewReceber = () => {
    resetReceberForm();
    setIsReceberModalOpen(true);
  };

  const handleOpenEditReceber = (item: ContaReceber) => {
    setEditingReceberId(item.id);
    setRecPacienteId(item.pacienteId || null);
    setRecPacienteNome(item.pacienteNome);
    setRecDescricao(item.descricao);
    setRecValor(item.valor);
    setRecVencimento(item.dataVencimento);
    setRecFormaPag(item.formaPagamento);
    setRecCategoriaId(item.categoriaId || 'cat_rec_1');
    setIsReceberModalOpen(true);
  };

  const handleCreateOrUpdateReceber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recPacienteNome || !recDescricao || !recValor || Number(recValor) <= 0) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const catObj = categorias.find(c => c.id === recCategoriaId);
      await financeiroFluxoCaixaService.salvarContaReceber({
        id: editingReceberId || undefined,
        pacienteId: recPacienteId,
        pacienteNome: recPacienteNome,
        descricao: recDescricao,
        valor: Number(recValor),
        dataVencimento: recVencimento,
        status: 'Pendente',
        formaPagamento: recFormaPag,
        categoriaId: recCategoriaId,
        categoriaNome: catObj?.nome || 'Consultas Particulares'
      });

      alert(editingReceberId ? '✅ Conta a Receber atualizada com sucesso!' : '✅ Conta a Receber cadastrada com sucesso!');
      setIsReceberModalOpen(false);
      resetReceberForm();
      await loadAllData();
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReceber = async (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento de receita?')) {
      await financeiroFluxoCaixaService.excluirContaReceber(id);
      await loadAllData();
    }
  };

  const handleBaixaReceber = async (id: string) => {
    if (confirm('Confirmar o recebimento desta conta?')) {
      await financeiroFluxoCaixaService.darBaixaReceber(id);
      await loadAllData();
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS CONTAS A PAGAR
  // --------------------------------------------------------------------------
  const handleOpenNewPagar = () => {
    resetPagarForm();
    setIsPagarModalOpen(true);
  };

  const handleOpenEditPagar = (item: ContaPagar) => {
    setEditingPagarId(item.id);
    setPagFornecedor(item.fornecedorNome);
    setPagProfId(item.profId || null);
    setPagDescricao(item.descricao);
    setPagValor(item.valor);
    setPagVencimento(item.dataVencimento);
    setPagFormaPag(item.formaPagamento);
    setPagCategoriaId(item.categoriaId || 'cat_desp_1');
    setIsPagarModalOpen(true);
  };

  const handleCreateOrUpdatePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagFornecedor || !pagDescricao || !pagValor || Number(pagValor) <= 0) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    setSubmitting(true);
    try {
      const catObj = categorias.find(c => c.id === pagCategoriaId);
      await financeiroFluxoCaixaService.salvarContaPagar({
        id: editingPagarId || undefined,
        fornecedorNome: pagFornecedor,
        profId: pagProfId,
        descricao: pagDescricao,
        valor: Number(pagValor),
        dataVencimento: pagVencimento,
        status: 'Pendente',
        formaPagamento: pagFormaPag,
        categoriaId: pagCategoriaId,
        categoriaNome: catObj?.nome || 'Despesas Gerais'
      });

      alert(editingPagarId ? '✅ Conta a Pagar atualizada com sucesso!' : '✅ Conta a Pagar cadastrada com sucesso!');
      setIsPagarModalOpen(false);
      resetPagarForm();
      await loadAllData();
    } catch (err: any) {
      alert(`Erro ao salvar despesa: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePagar = async (id: string) => {
    if (confirm('Deseja realmente excluir este lançamento de despesa?')) {
      await financeiroFluxoCaixaService.excluirContaPagar(id);
      await loadAllData();
    }
  };

  const handleBaixaPagar = async (id: string) => {
    if (confirm('Confirmar o pagamento desta despesa?')) {
      await financeiroFluxoCaixaService.darBaixaPagar(id);
      await loadAllData();
    }
  };

  // --------------------------------------------------------------------------
  // HANDLERS CATEGORIAS
  // --------------------------------------------------------------------------
  const handleOpenNewCategoria = () => {
    setEditingCategoriaId(null);
    setCatNome('');
    setCatTipo('Despesa');
    setCatCor('#6366f1');
    setIsCategoriaModalOpen(true);
  };

  const handleOpenEditCategoria = (cat: CategoriaFinanceira) => {
    setEditingCategoriaId(cat.id);
    setCatNome(cat.nome);
    setCatTipo(cat.tipo);
    setCatCor(cat.cor);
    setIsCategoriaModalOpen(true);
  };

  const handleSaveCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNome) {
      alert('Informe o nome da categoria.');
      return;
    }

    setSubmitting(true);
    try {
      await financeiroFluxoCaixaService.salvarCategoria({
        id: editingCategoriaId || undefined,
        nome: catNome,
        tipo: catTipo,
        cor: catCor
      });

      alert(editingCategoriaId ? '✅ Categoria atualizada!' : '✅ Categoria cadastrada com sucesso!');
      setIsCategoriaModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      alert(`Erro ao salvar categoria: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategoria = async (id: string) => {
    if (confirm('Deseja realmente excluir esta categoria?')) {
      await financeiroFluxoCaixaService.excluirCategoria(id);
      await loadAllData();
    }
  };

  const resetReceberForm = () => {
    setEditingReceberId(null);
    setRecPacienteId(null);
    setRecPacienteNome('');
    setRecDescricao('');
    setRecValor('');
    setRecVencimento(new Date().toISOString().substring(0, 10));
    setRecFormaPag('PIX');
    setRecCategoriaId('cat_rec_1');
  };

  const resetPagarForm = () => {
    setEditingPagarId(null);
    setPagFornecedor('');
    setPagProfId(null);
    setPagDescricao('');
    setPagValor('');
    setPagVencimento(new Date().toISOString().substring(0, 10));
    setPagFormaPag('PIX');
    setPagCategoriaId('cat_desp_1');
  };

  const filteredReceber = contasReceber.filter(c => {
    const matchesQuery = c.pacienteNome.toLowerCase().includes(searchQuery.toLowerCase()) || c.descricao.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesQuery && matchesStatus;
  });

  const filteredPagar = contasPagar.filter(c => {
    const matchesQuery = c.fornecedorNome.toLowerCase().includes(searchQuery.toLowerCase()) || c.descricao.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen text-slate-100 font-sans">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-[#101422] to-[#161c30] p-6 rounded-2xl border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Gestão Financeira & Fluxo de Caixa
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  ClinicFlow ERP
                </span>
              </h1>
              <p className="text-xs text-slate-400">Controle completo de entradas, saídas, repasses médicos e conciliação de caixa.</p>
            </div>
          </div>
        </div>

        {/* HEADER ACTIONS */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <button
            onClick={handleOpenNewReceber}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-xs active:scale-95"
          >
            <Plus size={16} />
            Nova Conta a Receber
          </button>
          
          <button
            onClick={handleOpenNewPagar}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg shadow-rose-500/20 transition-all text-xs active:scale-95"
          >
            <Plus size={16} />
            Nova Conta a Pagar
          </button>

          <button
            onClick={loadAllData}
            className="p-2.5 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl text-slate-300 transition-all"
            title="Atualizar dados financeiro"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS (GLASSMORPHISM) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* SALDO EM CAIXA REALIZADO */}
        <div className="p-5 bg-[#121625]/80 border border-white/[0.08] rounded-2xl space-y-2 shadow-xl backdrop-blur-md relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saldo Atual em Caixa</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-white font-mono">
            R$ {resumo.saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
            <ArrowUpRight size={14} />
            <span>Entradas Realizadas: R$ {resumo.entradasRecebidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* TOTAL A RECEBER (PENDENTE) */}
        <div className="p-5 bg-[#121625]/80 border border-white/[0.08] rounded-2xl space-y-2 shadow-xl backdrop-blur-md relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Receber (Pendente)</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-400 font-mono">
            R$ {resumo.totalReceberMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>{contasReceber.filter(r => r.status === 'Pendente').length} faturamentos pendentes</span>
          </div>
        </div>

        {/* TOTAL A PAGAR (PENDENTE) */}
        <div className="p-5 bg-[#121625]/80 border border-white/[0.08] rounded-2xl space-y-2 shadow-xl backdrop-blur-md relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total a Pagar (Pendente)</span>
            <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl">
              <TrendingDown size={18} />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-400 font-mono">
            R$ {resumo.totalPagarMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-rose-400 font-semibold">
            <ArrowDownRight size={14} />
            <span>Saídas Pagas: R$ {resumo.saidasPagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* RESULTADO LÍQUIDO PREVISTO (DRE) */}
        <div className="p-5 bg-[#121625]/80 border border-white/[0.08] rounded-2xl space-y-2 shadow-xl backdrop-blur-md relative overflow-hidden group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resultado Líquido (DRE)</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
              <Receipt size={18} />
            </div>
          </div>
          <p className={`text-2xl font-black font-mono ${resumo.resultadoLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            R$ {resumo.resultadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Inadimplência: <strong className="text-amber-400">{resumo.taxaInadimplencia}%</strong></span>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wallet size={14} />
            Visão Geral & Fluxo de Caixa
          </button>
          
          <button
            onClick={() => setActiveTab('receber')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'receber'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp size={14} />
            Contas a Receber ({contasReceber.length})
          </button>

          <button
            onClick={() => setActiveTab('pagar')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'pagar'
                ? 'border-rose-500 text-rose-400 bg-rose-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingDown size={14} />
            Contas a Pagar ({contasPagar.length})
          </button>

          <button
            onClick={() => setActiveTab('categorias')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'categorias'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t-xl'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag size={14} />
            Categorias & DRE ({categorias.length})
          </button>
        </div>

        {/* SEARCH AND FILTERS */}
        {(activeTab === 'receber' || activeTab === 'pagar') && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Buscar lançamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 bg-[#141824] border border-white/[0.08] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#141824] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="recebido">Recebido / Pago</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: VISÃO GERAL & FLUXO DE CAIXA */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* PROJEÇÃO FLUXO DE CAIXA */}
          <div className="bg-[#121625]/80 border border-white/[0.08] p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="text-indigo-400" size={18} /> Projeção de Fluxo de Caixa (Realizado vs. Previsto)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Comparativo das entradas e saídas financeiras da clínica.</p>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Liquidez Saudável
              </span>
            </div>

            {/* BAR PROGRESS PROJECTION */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-emerald-400">Entradas Totais Previstas (R$ {(resumo.entradasRecebidas + resumo.totalReceberMes).toFixed(2)})</span>
                  <span className="text-slate-400">{(resumo.entradasRecebidas + resumo.totalReceberMes) > 0 ? '100%' : '0%'}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((resumo.entradasRecebidas / (resumo.entradasRecebidas + resumo.totalReceberMes || 1)) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-rose-400">Saídas Totais Previstas (R$ {(resumo.saidasPagas + resumo.totalPagarMes).toFixed(2)})</span>
                  <span className="text-slate-400">{(resumo.saidasPagas + resumo.totalPagarMes) > 0 ? 'Comprometido' : '0%'}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-pink-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((resumo.saidasPagas / (resumo.saidasPagas + resumo.totalPagarMes || 1)) * 100))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* DRE RESUMIDO & CATEGORIAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PRÓXIMOS RECEBIMENTOS */}
            <div className="bg-[#121625]/80 border border-white/[0.08] p-5 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <ArrowUpRight size={16} /> Próximos Recebimentos (Contas a Receber)
              </h4>
              <div className="space-y-2">
                {contasReceber.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhum lançamento a receber cadastrado.</p>
                ) : (
                  contasReceber.slice(0, 4).map((rec) => (
                    <div key={rec.id} className="p-3 bg-[#161a28] rounded-xl flex justify-between items-center border border-white/5">
                      <div>
                        <strong className="text-xs text-white block">{rec.pacienteNome}</strong>
                        <span className="text-[10px] text-slate-400">{rec.descricao} • Venc: {rec.dataVencimento}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-400 font-mono block">R$ {rec.valor.toFixed(2)}</span>
                        {rec.status === 'Pendente' && (
                          <button onClick={() => handleBaixaReceber(rec.id)} className="text-[9px] text-indigo-400 hover:underline">
                            Dar Baixa
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PRÓXIMOS PAGAMENTOS */}
            <div className="bg-[#121625]/80 border border-white/[0.08] p-5 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <ArrowDownRight size={16} /> Próximos Pagamentos (Contas a Pagar)
              </h4>
              <div className="space-y-2">
                {contasPagar.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Nenhum lançamento a pagar cadastrado.</p>
                ) : (
                  contasPagar.slice(0, 4).map((pag) => (
                    <div key={pag.id} className="p-3 bg-[#161a28] rounded-xl flex justify-between items-center border border-white/5">
                      <div>
                        <strong className="text-xs text-white block">{pag.fornecedorNome}</strong>
                        <span className="text-[10px] text-slate-400">{pag.descricao} • Venc: {pag.dataVencimento}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-400 font-mono block">R$ {pag.valor.toFixed(2)}</span>
                        {pag.status === 'Pendente' && (
                          <button onClick={() => handleBaixaPagar(pag.id)} className="text-[9px] text-indigo-400 hover:underline">
                            Dar Baixa
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTAS A RECEBER */}
      {activeTab === 'receber' && (
        <div className="bg-[#121625]/80 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <TrendingUp className="text-emerald-400" size={16} /> Lançamentos de Contas a Receber
            </h3>
            <span className="text-xs font-mono text-slate-400">Total: {filteredReceber.length} itens</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161a28] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5">Paciente / Tomador</th>
                  <th className="p-3.5">Descrição</th>
                  <th className="p-3.5">Categoria</th>
                  <th className="p-3.5">Vencimento</th>
                  <th className="p-3.5 text-right">Valor (R$)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredReceber.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum lançamento a receber encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredReceber.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-bold text-white">{item.pacienteNome}</td>
                      <td className="p-3.5 text-slate-300">{item.descricao}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20 text-[10px]">
                          {item.categoriaNome || 'Geral'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{item.dataVencimento}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                        R$ {item.valor.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          item.status === 'Recebido'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : item.status === 'Atrasado'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center flex items-center justify-center gap-1.5">
                        {item.status === 'Pendente' && (
                          <button
                            onClick={() => handleBaixaReceber(item.id)}
                            className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold transition-all"
                            title="Dar baixa no recebimento"
                          >
                            Dar Baixa
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditReceber(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Alterar lançamento"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteReceber(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Excluir receita"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CONTAS A PAGAR */}
      {activeTab === 'pagar' && (
        <div className="bg-[#121625]/80 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/[0.06] flex justify-between items-center">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <TrendingDown className="text-rose-400" size={16} /> Lançamentos de Contas a Pagar
            </h3>
            <span className="text-xs font-mono text-slate-400">Total: {filteredPagar.length} despesas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161a28] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.06]">
                <tr>
                  <th className="p-3.5">Fornecedor / Favorecido</th>
                  <th className="p-3.5">Descrição da Despesa</th>
                  <th className="p-3.5">Categoria</th>
                  <th className="p-3.5">Vencimento</th>
                  <th className="p-3.5 text-right">Valor (R$)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredPagar.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Nenhum lançamento a pagar encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPagar.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-bold text-white">{item.fornecedorNome}</td>
                      <td className="p-3.5 text-slate-300">{item.descricao}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-md border border-rose-500/20 text-[10px]">
                          {item.categoriaNome || 'Despesa'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{item.dataVencimento}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-rose-400">
                        R$ {item.valor.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          item.status === 'Pago'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : item.status === 'Atrasado'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center flex items-center justify-center gap-1.5">
                        {item.status === 'Pendente' && (
                          <button
                            onClick={() => handleBaixaPagar(item.id)}
                            className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 rounded-lg text-[10px] font-bold transition-all"
                            title="Dar baixa no pagamento"
                          >
                            Dar Baixa
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditPagar(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Alterar despesa"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePagar(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Excluir despesa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CATEGORIAS & DRE */}
      {activeTab === 'categorias' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#121625]/80 border border-white/[0.08] p-5 rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="text-amber-400" size={16} /> Categorias de Receitas e Despesas
              </h3>
              <button
                onClick={handleOpenNewCategoria}
                className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
              >
                <Plus size={14} /> Nova Categoria
              </button>
            </div>

            <div className="space-y-2">
              {categorias.map(cat => (
                <div key={cat.id} className="p-3 bg-[#161a28] rounded-xl flex justify-between items-center border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                    <span className="text-xs text-white font-semibold">{cat.nome}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      cat.tipo === 'Receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {cat.tipo}
                    </span>
                    <button
                      onClick={() => handleOpenEditCategoria(cat)}
                      className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                      title="Editar categoria"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategoria(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Excluir categoria"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#121625]/80 border border-white/[0.08] p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="text-indigo-400" size={16} /> DRE Resumido (Demonstrativo do Resultado)
            </h3>
            
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                <span className="text-slate-300">(+) Receita Bruta Operacional</span>
                <strong className="text-emerald-400">R$ {(resumo.entradasRecebidas + resumo.totalReceberMes).toFixed(2)}</strong>
              </div>

              <div className="flex justify-between p-2.5 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                <span className="text-slate-300">(-) Custos e Despesas Operacionais</span>
                <strong className="text-rose-400">R$ {(resumo.saidasPagas + resumo.totalPagarMes).toFixed(2)}</strong>
              </div>

              <div className="flex justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm font-bold">
                <span className="text-white font-sans">(=) Resultado Líquido do Período</span>
                <strong className={resumo.resultadoLiquido >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  R$ {resumo.resultadoLiquido.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONTA A RECEBER (CRIAR / EDITAR) */}
      {isReceberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <TrendingUp className="text-emerald-400" size={18} /> {editingReceberId ? 'Alterar Conta a Receber' : 'Nova Conta a Receber'}
              </h3>
              <button onClick={() => setIsReceberModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrUpdateReceber} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Selecionar Paciente (Opcional)</label>
                <select
                  onChange={(e) => {
                    const pId = Number(e.target.value);
                    if (pId) {
                      const p = pacientes.find(x => x.id === pId);
                      if (p) {
                        setRecPacienteId(p.id);
                        setRecPacienteNome(p.nome);
                        setRecDescricao(`Atendimento Clínico - ${p.nome}`);
                      }
                    }
                  }}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                >
                  <option value="">— Selecionar da lista de pacientes —</option>
                  {pacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome do Paciente / Tomador *</label>
                <input
                  type="text"
                  required
                  value={recPacienteNome}
                  onChange={(e) => setRecPacienteNome(e.target.value)}
                  placeholder="Nome do cliente ou tomador"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição do Lançamento *</label>
                <input
                  type="text"
                  required
                  value={recDescricao}
                  onChange={(e) => setRecDescricao(e.target.value)}
                  placeholder="Ex: Consulta Particular de Psicologia"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={recValor}
                    onChange={(e) => setRecValor(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={recVencimento}
                    onChange={(e) => setRecVencimento(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Forma de Pagamento</label>
                  <select
                    value={recFormaPag}
                    onChange={(e) => setRecFormaPag(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartao_Credito">Cartão de Crédito</option>
                    <option value="Cartao_Debito">Cartão de Débito</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Convenio">Faturamento Convênio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Categoria de Receita</label>
                  <select
                    value={recCategoriaId}
                    onChange={(e) => setRecCategoriaId(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                  >
                    {categorias.filter(c => c.tipo === 'Receita').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceberModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar Receita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONTA A PAGAR (CRIAR / EDITAR) */}
      {isPagarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <TrendingDown className="text-rose-400" size={18} /> {editingPagarId ? 'Alterar Conta a Pagar' : 'Nova Conta a Pagar (Despesa)'}
              </h3>
              <button onClick={() => setIsPagarModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateOrUpdatePagar} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Fornecedor / Favorecido *</label>
                <input
                  type="text"
                  required
                  value={pagFornecedor}
                  onChange={(e) => setPagFornecedor(e.target.value)}
                  placeholder="Nome da empresa ou médico para repasse"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  required
                  value={pagDescricao}
                  onChange={(e) => setPagDescricao(e.target.value)}
                  placeholder="Ex: Aluguel do imóvel / Repasse de Honorários"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={pagValor}
                    onChange={(e) => setPagValor(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0.00"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={pagVencimento}
                    onChange={(e) => setPagVencimento(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Forma de Pagamento</label>
                  <select
                    value={pagFormaPag}
                    onChange={(e) => setPagFormaPag(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Transferencia">Transferência Bancária (TED/DOC)</option>
                    <option value="Boleto">Boleto Bancário</option>
                    <option value="Cartao">Cartão de Crédito Corp.</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Categoria de Despesa</label>
                  <select
                    value={pagCategoriaId}
                    onChange={(e) => setPagCategoriaId(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                  >
                    {categorias.filter(c => c.tipo === 'Despesa').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPagarModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CATEGORIA (CRIAR / EDITAR) */}
      {isCategoriaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Tag className="text-amber-400" size={18} /> {editingCategoriaId ? 'Editar Categoria' : 'Nova Categoria Financeira'}
              </h3>
              <button onClick={() => setIsCategoriaModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveCategoria} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome da Categoria *</label>
                <input
                  type="text"
                  required
                  value={catNome}
                  onChange={(e) => setCatNome(e.target.value)}
                  placeholder="Ex: Consultas Especializadas, Manutenção de Equipamentos"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tipo de Categoria *</label>
                <select
                  value={catTipo}
                  onChange={(e) => setCatTipo(e.target.value as any)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white"
                >
                  <option value="Receita">Receita (+ Entradas)</option>
                  <option value="Despesa">Despesa (- Saídas)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Cor do Indicador</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={catCor}
                    onChange={(e) => setCatCor(e.target.value)}
                    className="w-10 h-9 bg-transparent border-0 cursor-pointer rounded-lg"
                  />
                  <span className="font-mono text-slate-400">{catCor}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCategoriaModalOpen(false)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  {submitting ? 'Salvando...' : 'Salvar Categoria'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
