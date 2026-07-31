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
      if (!error && data && data.length > 0) {
        const mapped = data.map(mappers.dbToCategoria);
        localStorage.setItem(STORAGE_KEY_CATEGORIAS, JSON.stringify(mapped));
        return mapped;
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

  // --------------------------------------------------------------------------
  // CONTAS A RECEBER
  // --------------------------------------------------------------------------
  listContasReceber: async (): Promise<ContaReceber[]> => {
    try {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .order('data_vencimento', { ascending: false });

      if (!error && data && data.length > 0) {
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

    const todayIso = new Date().toISOString().substring(0, 10);
    const initialMocks: ContaReceber[] = [
      {
        id: 'rec_1001',
        pacienteId: 1,
        pacienteNome: 'Eduardo Augusto Donato',
        descricao: 'Sessão de Psicologia Clínica & Acompanhamento Terapêutico',
        valor: 350.00,
        valorRecebido: 350.00,
        dataVencimento: todayIso,
        dataRecebimento: new Date().toISOString(),
        status: 'Recebido',
        formaPagamento: 'PIX',
        categoriaId: 'cat_rec_1',
        categoriaNome: 'Consultas Particulares'
      },
      {
        id: 'rec_1002',
        pacienteId: 2,
        pacienteNome: 'Maria Cecilia Benessuti Donato',
        descricao: 'Atendimento Especializado Fonoaudiologia',
        valor: 280.00,
        valorRecebido: 0,
        dataVencimento: new Date(Date.now() + 86400000 * 3).toISOString().substring(0, 10),
        status: 'Pendente',
        formaPagamento: 'Cartao_Credito',
        categoriaId: 'cat_rec_1',
        categoriaNome: 'Consultas Particulares'
      },
      {
        id: 'rec_1003',
        pacienteId: 3,
        pacienteNome: 'Juliana Paes de Oliveira',
        descricao: 'Guia SADT Lote TISS #482 (Convênio Bradesco Saúde)',
        valor: 1450.00,
        valorRecebido: 0,
        dataVencimento: new Date(Date.now() + 86400000 * 10).toISOString().substring(0, 10),
        status: 'Pendente',
        formaPagamento: 'Convenio',
        categoriaId: 'cat_rec_2',
        categoriaNome: 'Faturamento Convênios (TISS)'
      }
    ];

    localStorage.setItem(STORAGE_KEY_RECEBER, JSON.stringify(initialMocks));
    return initialMocks;
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

      if (!error && data && data.length > 0) {
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

    const todayIso = new Date().toISOString().substring(0, 10);
    const initialMocks: ContaPagar[] = [
      {
        id: 'pag_2001',
        fornecedorNome: 'Imobiliária Jundiaí Centro',
        descricao: 'Aluguel do Consultório Clínico - Julho/2026',
        valor: 3200.00,
        valorPago: 3200.00,
        dataVencimento: todayIso,
        dataPagamento: new Date().toISOString(),
        status: 'Pago',
        formaPagamento: 'PIX',
        categoriaId: 'cat_desp_2',
        categoriaNome: 'Aluguel e Condomínio'
      },
      {
        id: 'pag_2002',
        fornecedorNome: 'Dra. Patricia Lima (Psicóloga)',
        profId: 101,
        descricao: 'Repasse Profissional referente aos atendimentos de Julho/2026',
        valor: 1850.00,
        valorPago: 0,
        dataVencimento: new Date(Date.now() + 86400000 * 5).toISOString().substring(0, 10),
        status: 'Pendente',
        formaPagamento: 'PIX',
        categoriaId: 'cat_desp_1',
        categoriaNome: 'Repasse a Médicos e Psicólogos'
      },
      {
        id: 'pag_2003',
        fornecedorNome: 'Dental & Med Jundiaí Ltda',
        descricao: 'Insumos Médicos, Luvas e Material de Higienização',
        valor: 480.00,
        valorPago: 0,
        dataVencimento: new Date(Date.now() + 86400000 * 2).toISOString().substring(0, 10),
        status: 'Pendente',
        formaPagamento: 'Boleto',
        categoriaId: 'cat_desp_3',
        categoriaNome: 'Insumos e Materiais Médicos'
      }
    ];

    localStorage.setItem(STORAGE_KEY_PAGAR, JSON.stringify(initialMocks));
    return initialMocks;
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
  getResumoCaixa: async (): Promise<ResumoFluxoCaixa> => {
    const receber = await financeiroFluxoCaixaService.listContasReceber();
    const pagar = await financeiroFluxoCaixaService.listContasPagar();

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
