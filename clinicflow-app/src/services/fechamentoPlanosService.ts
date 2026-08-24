import { supabase } from './supabase';

export interface FechamentoPlano {
  id: number;
  planoId?: number | null;
  planoNome: string;
  planoCodigo: string;
  dataEntregaInicial: string; // YYYY-MM-DD
  dataEntregaFinal: string;   // YYYY-MM-DD
  dataPagamento: string;      // YYYY-MM-DD
  observacoes?: string;
  status: 'ativo' | 'concluido' | 'cancelado';
  createdAt?: string;
  updatedAt?: string;
}

export interface AlertaNotification {
  id: string;
  fechamentoId: number;
  planoNome: string;
  planoCodigo: string;
  tipo: 'uma_semana_inicio' | 'tres_dias_inicio' | 'quatro_dias_final' | 'hoje_final' | 'vencido';
  titulo: string;
  mensagem: string;
  nivel: 'info' | 'warning' | 'urgent' | 'error';
  diasRestantes: number;
  dataAlvo: string;
  lida?: boolean;
}

const STORAGE_KEY = 'cf_fechamentos_planos_cache';

// Mock/Default de demonstração inicial caso a tabela ainda não tenha registros
const defaultFechamentos: FechamentoPlano[] = [
  {
    id: 1,
    planoId: 1,
    planoNome: 'Unimed Jundiaí',
    planoCodigo: 'UNI-001',
    dataEntregaInicial: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 dias a partir de hoje (Alerta 1 semana)
    dataEntregaFinal: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dataPagamento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    observacoes: 'Entregar lote físico na central até as 17h.',
    status: 'ativo'
  },
  {
    id: 2,
    planoId: 2,
    planoNome: 'Bradesco Saúde',
    planoCodigo: 'BRAD-002',
    dataEntregaInicial: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 dias a partir de hoje (Alerta 3 dias)
    dataEntregaFinal: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],   // 3 dias a partir de hoje (Alerta 4 dias prazo final)
    dataPagamento: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    observacoes: 'Envio via portal TISS Bradesco.',
    status: 'ativo'
  },
  {
    id: 3,
    planoId: 3,
    planoNome: 'SulAmérica',
    planoCodigo: 'SUL-003',
    dataEntregaInicial: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dataEntregaFinal: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Exatamente 4 dias para o encerramento
    dataPagamento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    observacoes: 'Faturamento eletrônico mensal.',
    status: 'ativo'
  }
];

export const fechamentoPlanosService = {
  /**
   * Listar todos os prazos de fechamento salvos no Supabase com fallback local
   */
  list: async (): Promise<FechamentoPlano[]> => {
    try {
      const { data, error } = await supabase
        .from('fechamentos_planos')
        .select('*')
        .order('data_entrega_inicial', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: FechamentoPlano[] = data.map((item: any) => ({
          id: Number(item.id),
          planoId: item.plano_id ? Number(item.plano_id) : undefined,
          planoNome: item.plano_nome || '',
          planoCodigo: item.plano_codigo || '',
          dataEntregaInicial: item.data_entrega_inicial || '',
          dataEntregaFinal: item.data_entrega_final || '',
          dataPagamento: item.data_pagamento || '',
          observacoes: item.observacoes || '',
          status: item.status || 'ativo',
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (_) {
      // Ignora erro do Supabase se tabela ainda não existir ou estiver offline
    }

    // Tenta carregar do cache local
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    // Salva o mock inicial no cache local se for primeira execução
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultFechamentos));
    return defaultFechamentos;
  },

  /**
   * Incluir um novo prazo de fechamento por plano no Supabase
   */
  create: async (item: Omit<FechamentoPlano, 'id'>): Promise<FechamentoPlano> => {
    const payloadDb = {
      plano_id: item.planoId || null,
      plano_nome: item.planoNome,
      plano_codigo: item.planoCodigo,
      data_entrega_inicial: item.dataEntregaInicial,
      data_entrega_final: item.dataEntregaFinal,
      data_pagamento: item.dataPagamento,
      observacoes: item.observacoes || '',
      status: item.status || 'ativo'
    };

    let newItem: FechamentoPlano = {
      ...item,
      id: Date.now(),
      status: item.status || 'ativo'
    };

    try {
      const { data, error } = await supabase
        .from('fechamentos_planos')
        .insert([payloadDb])
        .select('*')
        .single();

      if (!error && data) {
        newItem = {
          id: Number(data.id),
          planoId: data.plano_id ? Number(data.plano_id) : undefined,
          planoNome: data.plano_nome,
          planoCodigo: data.plano_codigo,
          dataEntregaInicial: data.data_entrega_inicial,
          dataEntregaFinal: data.data_entrega_final,
          dataPagamento: data.data_pagamento,
          observacoes: data.observacoes || '',
          status: data.status || 'ativo',
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
      }
    } catch (_) {}

    // Atualiza cache local
    const current = await fechamentoPlanosService.list();
    const updated = [newItem, ...current.filter((c) => c.id !== newItem.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return newItem;
  },

  /**
   * Alterar um registro existente no Supabase
   */
  update: async (id: number, item: Partial<FechamentoPlano>): Promise<FechamentoPlano> => {
    const payloadDb: any = {};
    if (item.planoId !== undefined) payloadDb.plano_id = item.planoId;
    if (item.planoNome !== undefined) payloadDb.plano_nome = item.planoNome;
    if (item.planoCodigo !== undefined) payloadDb.plano_codigo = item.planoCodigo;
    if (item.dataEntregaInicial !== undefined) payloadDb.data_entrega_inicial = item.dataEntregaInicial;
    if (item.dataEntregaFinal !== undefined) payloadDb.data_entrega_final = item.dataEntregaFinal;
    if (item.dataPagamento !== undefined) payloadDb.data_pagamento = item.dataPagamento;
    if (item.observacoes !== undefined) payloadDb.observacoes = item.observacoes;
    if (item.status !== undefined) payloadDb.status = item.status;
    payloadDb.updated_at = new Date().toISOString();

    try {
      await supabase.from('fechamentos_planos').update(payloadDb).eq('id', id);
    } catch (_) {}

    const current = await fechamentoPlanosService.list();
    const updated = current.map((c) => (c.id === id ? { ...c, ...item } : c));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return updated.find((c) => c.id === id) || ({ ...item, id } as FechamentoPlano);
  },

  /**
   * Excluir registro do Supabase
   */
  delete: async (id: number): Promise<boolean> => {
    try {
      await supabase.from('fechamentos_planos').delete().eq('id', id);
    } catch (_) {}

    const current = await fechamentoPlanosService.list();
    const updated = current.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  },

  /**
   * Calcular alertas para o ícone de sino e avisos na tela
   * Regras solicitadas:
   * 1. Notificação 1 semana (7 dias) antes do prazo inicial
   * 2. Notificação 3 dias antes do prazo inicial
   * 3. Alerta pelo menos 4 dias antes do prazo final de fechamento
   */
  calcularAlertas: (items: FechamentoPlano[]): AlertaNotification[] => {
    const alertas: AlertaNotification[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const parseLocalDate = (dateStr: string) => {
      if (!dateStr) return new Date();
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    };

    const formatDiffDays = (date: Date) => {
      const diffMs = date.getTime() - hoje.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    };

    items.forEach((item) => {
      if (item.status === 'concluido' || item.status === 'cancelado') return;

      const dInicial = parseLocalDate(item.dataEntregaInicial);
      const dFinal = parseLocalDate(item.dataEntregaFinal);

      const diffInicial = formatDiffDays(dInicial);
      const diffFinal = formatDiffDays(dFinal);

      // 1. Alerta de 1 semana (7 dias) antes da Data de Entrega Inicial (janela de 5 a 7 dias antes)
      if (diffInicial >= 4 && diffInicial <= 7) {
        alertas.push({
          id: `inicio_7d_${item.id}`,
          fechamentoId: item.id,
          planoNome: item.planoNome,
          planoCodigo: item.planoCodigo,
          tipo: 'uma_semana_inicio',
          titulo: `Prazo Inicial em ${diffInicial} dia(s) - ${item.planoNome}`,
          mensagem: `Abertura do prazo de entrega inicial em ${dInicial.toLocaleDateString('pt-BR')}. Prepare os lotes TISS.`,
          nivel: 'info',
          diasRestantes: diffInicial,
          dataAlvo: item.dataEntregaInicial
        });
      }

      // 2. Alerta de 3 dias antes da Data de Entrega Inicial (janela de 0 a 3 dias antes)
      if (diffInicial >= 0 && diffInicial <= 3) {
        alertas.push({
          id: `inicio_3d_${item.id}`,
          fechamentoId: item.id,
          planoNome: item.planoNome,
          planoCodigo: item.planoCodigo,
          tipo: 'tres_dias_inicio',
          titulo: diffInicial === 0 ? `Entrega Inicial É HOJE! - ${item.planoNome}` : `Início do Prazo em ${diffInicial} dia(s) - ${item.planoNome}`,
          mensagem: diffInicial === 0
            ? `Início da entrega das guias do convênio ${item.planoNome} hoje.`
            : `Atenção: Faltam apenas ${diffInicial} dia(s) para a abertura do prazo inicial de entrega.`,
          nivel: diffInicial <= 1 ? 'warning' : 'info',
          diasRestantes: diffInicial,
          dataAlvo: item.dataEntregaInicial
        });
      }

      // 3. Alerta pelo menos 4 dias antes do prazo FINAL para fechamento
      if (diffFinal >= 0 && diffFinal <= 4) {
        alertas.push({
          id: `final_4d_${item.id}`,
          fechamentoId: item.id,
          planoNome: item.planoNome,
          planoCodigo: item.planoCodigo,
          tipo: diffFinal === 0 ? 'hoje_final' : 'quatro_dias_final',
          titulo: diffFinal === 0 ? `🚨 FECHAMENTO ENCERRA HOJE! - ${item.planoNome}` : `⚠️ Alerta Fechamento: Faltam ${diffFinal} dia(s) - ${item.planoNome}`,
          mensagem: diffFinal === 0
            ? `Hoje (${dFinal.toLocaleDateString('pt-BR')}) é a data limite final para envio dos fechamentos do convênio ${item.planoNome}!`
            : `Faltam ${diffFinal} dia(s) para o prazo final de fechamento de ${item.planoNome} (${dFinal.toLocaleDateString('pt-BR')}).`,
          nivel: diffFinal <= 1 ? 'urgent' : 'warning',
          diasRestantes: diffFinal,
          dataAlvo: item.dataEntregaFinal
        });
      }

      // 4. Fechamento vencido sem conclusão
      if (diffFinal < 0) {
        alertas.push({
          id: `vencido_${item.id}`,
          fechamentoId: item.id,
          planoNome: item.planoNome,
          planoCodigo: item.planoCodigo,
          tipo: 'vencido',
          titulo: `🛑 Fechamento Expirado - ${item.planoNome}`,
          mensagem: `O prazo final de entrega (${dFinal.toLocaleDateString('pt-BR')}) expirou há ${Math.abs(diffFinal)} dia(s).`,
          nivel: 'error',
          diasRestantes: diffFinal,
          dataAlvo: item.dataEntregaFinal
        });
      }
    });

    // Ordenar alertas por prioridade: error > urgent > warning > info
    const priority = { error: 1, urgent: 2, warning: 3, info: 4 };
    return alertas.sort((a, b) => priority[a.nivel] - priority[b.nivel]);
  }
};
