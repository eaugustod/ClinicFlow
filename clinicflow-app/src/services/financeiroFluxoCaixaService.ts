import { supabase } from './supabase';
import { mappers } from './mappers';
import { ContaReceber, ContaPagar, CategoriaFinanceira, ResumoFluxoCaixa } from '../types';

const STORAGE_KEY_RECEBER = 'cf_contas_receber';
const STORAGE_KEY_PAGAR = 'cf_contas_pagar';
const STORAGE_KEY_CATEGORIAS = 'cf_categorias_financeiras';

export const defaultCategorias: CategoriaFinanceira[] = [
  { id: 'cat_rec_1', nome: 'Consultas Particulares', tipo: 'Receita', cor: '#10b981', icone: 'UserCheck' },
  { id: 'cat_rec_2', nome: 'Faturamento Convênios (TISS)', tipo: 'Receita', cor: '#06b6d4', icone: 'Receipt' },
  { id: 'cat_rec_3', nome: 'Procedimentos e Exames', tipo: 'Receita', cor: '#3b82f6', icone: 'Activity' },
  { id: 'cat_desp_1', nome: 'Repasse a Médicos e Psicólogos', tipo: 'Despesa', cor: '#8b5cf6', icone: 'User' },
  { id: 'cat_desp_2', nome: 'Aluguel e Condomínio', tipo: 'Despesa', cor: '#ef4444', icone: 'Building' },
  { id: 'cat_desp_3', nome: 'Insumos e Materiais Médicos', tipo: 'Despesa', cor: '#f59e0b', icone: 'Package' },
  { id: 'cat_desp_4', nome: 'Sistemas e Tecnologia (Software)', tipo: 'Despesa', cor: '#6366f1', icone: 'Cpu' },
  { id: 'cat_desp_5', nome: 'Impostos e Taxas Municipais (ISS)', tipo: 'Despesa', cor: '#ec4899', icone: 'Percent' }
];

export const financeiroFluxoCaixaService = {
  // --------------------------------------------------------------------------
  // CATEGORIAS
  // --------------------------------------------------------------------------
  listCategorias: async (): Promise<CategoriaFinanceira[]> => {
    try {
      const { data, error } = await supabase.from('categorias_financeiras').select('*').order('nome');
      if (!error && data) {
        const mapped = data.map(mappers.dbToCategoria);
        if (mapped.length > 0) {
          localStorage.setItem(STORAGE_KEY_CATEGORIAS, JSON.stringify(mapped));
          return mapped;
        }
      }
    } catch (_) {}

    const saved = localStorage.getItem(STORAGE_KEY_CATEGORIAS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    localStorage.setItem(STORAGE_KEY_CATEGORIAS, JSON.stringify(defaultCategorias));
    return defaultCategorias;
  },

  salvarCategoria: async (item: Partial<CategoriaFinanceira>): Promise<CategoriaFinanceira> => {
    const isEdit = Boolean(item.id);
    const id = item.id || `cat_${Date.now()}`;
    const payload: CategoriaFinanceira = {
      id,
      nome: item.nome || 'Nova Categoria',
      tipo: item.tipo || 'Despesa',
      cor: item.cor || '#6366f1',
      icone: item.icone || 'Tag'
    };

    try {
      await supabase.from('categorias_financeiras').upsert(mappers.categoriaToDb(payload));
    } catch (_) {}

    const current = await financeiroFluxoCaixaService.listCategorias();
    const updated = isEdit ? current.map(c => c.id === id ? payload : c) : [payload, ...current];
    localStorage.setItem(STORAGE_KEY_CATEGORIAS, JSON.stringify(updated));
    return payload;
  },

  excluirCategoria: async (id: string): Promise<boolean> => {
    try {
      await supabase.from('categorias_financeiras').delete().eq('id', id);
    } catch (_) {}

    const current = await financeiroFluxoCaixaService.listCategorias();
    const updated = current.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY_CATEGORIAS, JSON.stringify(updated));
    return true;
  },

  // --------------------------------------------------------------------------
  // CONTAS A RECEBER
  // --------------------------------------------------------------------------
  listContasReceber: async (): Promise<ContaReceber[]> => {
    try {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (!error && data) {
        const mapped = data.map(mappers.dbToContaReceber);
        localStorage.setItem(STORAGE_KEY_RECEBER, JSON.stringify(mapped));
        return mapped;
      }
    } catch (_) {}

    const saved = localStorage.getItem(STORAGE_KEY_RECEBER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    return [];
  },

  salvarContaReceber: async (item: Partial<ContaReceber>): Promise<ContaReceber> => {
    const isEdit = Boolean(item.id);
    const id = item.id || `rec_${Date.now()}`;
    const payload: ContaReceber = {
      id,
      pacienteId: item.pacienteId || null,
      pacienteNome: item.pacienteNome || 'Cliente Diversos',
      descricao: item.descricao || 'Lançamento de Receita',
      valor: Number(item.valor) || 0,
      valorRecebido: item.status === 'Recebido' ? (Number(item.valorRecebido) || Number(item.valor)) : 0,
      dataVencimento: item.dataVencimento || new Date().toISOString().substring(0, 10),
      dataRecebimento: item.status === 'Recebido' ? (item.dataRecebimento || new Date().toISOString()) : undefined,
      status: item.status || 'Pendente',
      formaPagamento: item.formaPagamento || 'PIX',
      categoriaId: item.categoriaId || 'cat_rec_1',
      categoriaNome: item.categoriaNome || 'Consultas Particulares',
      observacoes: item.observacoes || ''
    };

    try {
      await supabase.from('contas_receber').upsert(mappers.contaReceberToDb(payload));
    } catch (_) {}

    const list = await financeiroFluxoCaixaService.listContasReceber();
    const updated = isEdit ? list.map(c => c.id === id ? payload : c) : [payload, ...list];
    localStorage.setItem(STORAGE_KEY_RECEBER, JSON.stringify(updated));
    return payload;
  },

  excluirContaReceber: async (id: string): Promise<boolean> => {
    try {
      await supabase.from('contas_receber').delete().eq('id', id);
    } catch (_) {}

    const list = await financeiroFluxoCaixaService.listContasReceber();
    const updated = list.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY_RECEBER, JSON.stringify(updated));
    return true;
  },

  darBaixaReceber: async (id: string, valorRecebido?: number): Promise<boolean> => {
    const list = await financeiroFluxoCaixaService.listContasReceber();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return false;

    const val = valorRecebido !== undefined ? valorRecebido : list[idx].valor;
    list[idx].status = 'Recebido';
    list[idx].valorRecebido = val;
    list[idx].dataRecebimento = new Date().toISOString();

    try {
      await supabase.from('contas_receber').update({
        status: 'Recebido',
        valor_recebido: val,
        data_recebimento: new Date().toISOString()
      }).eq('id', id);
    } catch (_) {}

    localStorage.setItem(STORAGE_KEY_RECEBER, JSON.stringify(list));
    return true;
  },

  // --------------------------------------------------------------------------
  // CONTAS A PAGAR
  // --------------------------------------------------------------------------
  listContasPagar: async (): Promise<ContaPagar[]> => {
    try {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (!error && data) {
        const mapped = data.map(mappers.dbToContaPagar);
        localStorage.setItem(STORAGE_KEY_PAGAR, JSON.stringify(mapped));
        return mapped;
      }
    } catch (_) {}

    const saved = localStorage.getItem(STORAGE_KEY_PAGAR);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    return [];
  },

  salvarContaPagar: async (item: Partial<ContaPagar>): Promise<ContaPagar> => {
    const isEdit = Boolean(item.id);
    const id = item.id || `pag_${Date.now()}`;
    const payload: ContaPagar = {
      id,
      fornecedorNome: item.fornecedorNome || 'Fornecedor Diversos',
      profId: item.profId || null,
      descricao: item.descricao || 'Lançamento de Despesa',
      valor: Number(item.valor) || 0,
      valorPago: item.status === 'Pago' ? (Number(item.valorPago) || Number(item.valor)) : 0,
      dataVencimento: item.dataVencimento || new Date().toISOString().substring(0, 10),
      dataPagamento: item.status === 'Pago' ? (item.dataPagamento || new Date().toISOString()) : undefined,
      status: item.status || 'Pendente',
      formaPagamento: item.formaPagamento || 'PIX',
      categoriaId: item.categoriaId || 'cat_desp_1',
      categoriaNome: item.categoriaNome || 'Outras Despesas',
      observacoes: item.observacoes || ''
    };

    try {
      await supabase.from('contas_pagar').upsert(mappers.contaPagarToDb(payload));
    } catch (_) {}

    const list = await financeiroFluxoCaixaService.listContasPagar();
    const updated = isEdit ? list.map(c => c.id === id ? payload : c) : [payload, ...list];
    localStorage.setItem(STORAGE_KEY_PAGAR, JSON.stringify(updated));
    return payload;
  },

  excluirContaPagar: async (id: string): Promise<boolean> => {
    try {
      await supabase.from('contas_pagar').delete().eq('id', id);
    } catch (_) {}

    const list = await financeiroFluxoCaixaService.listContasPagar();
    const updated = list.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEY_PAGAR, JSON.stringify(updated));
    return true;
  },

  darBaixaPagar: async (id: string, valorPago?: number): Promise<boolean> => {
    const list = await financeiroFluxoCaixaService.listContasPagar();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return false;

    const val = valorPago !== undefined ? valorPago : list[idx].valor;
    list[idx].status = 'Pago';
    list[idx].valorPago = val;
    list[idx].dataPagamento = new Date().toISOString();

    try {
      await supabase.from('contas_pagar').update({
        status: 'Pago',
        valor_pago: val,
        data_pagamento: new Date().toISOString()
      }).eq('id', id);
    } catch (_) {}

    localStorage.setItem(STORAGE_KEY_PAGAR, JSON.stringify(list));
    return true;
  },

  // --------------------------------------------------------------------------
  // CÁLCULO DE DASHBOARD E FLUXO DE CAIXA
  // --------------------------------------------------------------------------
  getResumoCaixa: async (mesAno?: string): Promise<ResumoFluxoCaixa> => {
    let receber = await financeiroFluxoCaixaService.listContasReceber();
    let pagar = await financeiroFluxoCaixaService.listContasPagar();

    if (mesAno && mesAno !== 'todos') {
      receber = receber.filter(r => (r.dataVencimento && r.dataVencimento.startsWith(mesAno)) || (r.dataRecebimento && r.dataRecebimento.startsWith(mesAno)));
      pagar = pagar.filter(p => (p.dataVencimento && p.dataVencimento.startsWith(mesAno)) || (p.dataPagamento && p.dataPagamento.startsWith(mesAno)));
    }

    const entradasRecebidas = receber
      .filter(r => r.status === 'Recebido')
      .reduce((acc, r) => acc + (r.valorRecebido || r.valor), 0);

    const saidasPagas = pagar
      .filter(p => p.status === 'Pago')
      .reduce((acc, p) => acc + (p.valorPago || p.valor), 0);

    const totalReceberMes = receber
      .filter(r => r.status === 'Pendente' || r.status === 'Atrasado')
      .reduce((acc, r) => acc + r.valor, 0);

    const totalPagarMes = pagar
      .filter(p => p.status === 'Pendente' || p.status === 'Atrasado')
      .reduce((acc, p) => acc + p.valor, 0);

    const saldoAtual = entradasRecebidas - saidasPagas;
    const resultadoLiquido = (entradasRecebidas + totalReceberMes) - (saidasPagas + totalPagarMes);

    const atrasadas = receber.filter(r => r.status === 'Atrasado').length;
    const taxaInadimplencia = receber.length > 0 ? Number(((atrasadas / receber.length) * 100).toFixed(1)) : 0;

    return {
      saldoAtual,
      totalReceberMes,
      totalPagarMes,
      resultadoLiquido,
      taxaInadimplencia,
      entradasRecebidas,
      saidasPagas
    };
  }
};
