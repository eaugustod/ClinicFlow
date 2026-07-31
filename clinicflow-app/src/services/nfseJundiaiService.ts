import { supabase } from './supabase';
import { mappers } from './mappers';
import { NotaFiscalJundiai, ConfiguracaoFiscalJundiai } from '../types';

const STORAGE_KEY = 'cf_nfse_jundiai';
const CONFIG_KEY = 'cf_config_fiscal_jundiai';

export const defaultConfigFiscal: ConfiguracaoFiscalJundiai = {
  cnpjEmissor: '12.345.678/0001-90',
  inscricaoMunicipal: '987654',
  razaoSocial: 'Kosmos Clínica de Saúde & Psicologia Ltda',
  ambiente: 'Homologação',
  codigoServicoPadrao: '04.01', // Serviços de psicologia / fisioterapia / medicina
  aliquotaIssPadrao: 2.0, // 2% ISS Jundiaí
  optanteSimplesNacional: true,
  certificadoValidade: '2027-12-31'
};

export const nfseJundiaiService = {
  getConfig: (): ConfiguracaoFiscalJundiai => {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return defaultConfigFiscal;
  },

  saveConfig: (config: ConfiguracaoFiscalJundiai) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  },

  listNotas: async (): Promise<NotaFiscalJundiai[]> => {
    try {
      const { data, error } = await supabase
        .from('notas_fiscais')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data.map(mappers.dbToNf);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
      }
    } catch (e) {
      console.warn('[NFS-e Jundiaí] Fallback to local cache:', e);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    // Default mock data for initial demonstration
    const initialMocks: NotaFiscalJundiai[] = [
      {
        id: 'nf_1001',
        numeroRps: 'RPS-2026-001',
        numeroNota: 'NFS-2026/0482',
        codigoVerificacao: 'JUND-9821-X7',
        dataEmissao: new Date(Date.now() - 86400000 * 2).toISOString(),
        tomadorNome: 'Eduardo Augusto Donato',
        tomadorCpfCnpj: '255.250.148-66',
        tomadorEmail: 'eadonato@gmail.com',
        tomadorEndereco: 'Rua do Retiro, 1200 - Anhangabaú, Jundiaí - SP',
        servicoCodigo: '04.01',
        descricaoServico: 'Prestação de Serviços de Psicologia Clínica e Acompanhamento Terapêutico referente ao mês de Julho/2026.',
        valorServico: 350.00,
        aliquotaIss: 2.0,
        valorIss: 7.00,
        status: 'Aprovada',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        xmlUrl: 'data:text/xml;charset=utf-8,<NFe><InfNFe><id>JUND20260482</id></InfNFe></NFe>',
        ambiente: 'Homologação'
      },
      {
        id: 'nf_1002',
        numeroRps: 'RPS-2026-002',
        numeroNota: 'NFS-2026/0483',
        codigoVerificacao: 'JUND-7412-B9',
        dataEmissao: new Date(Date.now() - 86400000).toISOString(),
        tomadorNome: 'Maria Cecilia Benessuti Donato',
        tomadorCpfCnpj: '277.001.968-69',
        tomadorEmail: 'mceciliadonato@gmail.com',
        tomadorEndereco: 'Av. 9 de Julho, 2500 - Jundiaí - SP',
        servicoCodigo: '04.01',
        descricaoServico: 'Consulta e Atendimento de Fonoaudiologia Especializada.',
        valorServico: 280.00,
        aliquotaIss: 2.0,
        valorIss: 5.60,
        status: 'Aprovada',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        ambiente: 'Homologação'
      }
    ];

    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMocks));
    return initialMocks;
  },

  emitirNota: async (payload: Omit<NotaFiscalJundiai, 'id' | 'numeroRps' | 'status' | 'valorIss'>): Promise<NotaFiscalJundiai> => {
    const config = nfseJundiaiService.getConfig();
    const now = new Date();
    const timestamp = Date.now();

    const valorIss = Number(((payload.valorServico * (payload.aliquotaIss || config.aliquotaIssPadrao)) / 100).toFixed(2));
    const rpsNum = `RPS-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const novaNota: NotaFiscalJundiai = {
      ...payload,
      id: `nf_${timestamp}`,
      numeroRps: rpsNum,
      valorIss,
      status: 'Processando',
      dataEmissao: now.toISOString(),
      ambiente: config.ambiente
    };

    // Simulate API transmission to Prefeitura de Jundiaí (SP)
    await new Promise((res) => setTimeout(res, 1200));

    // Simulation of success response from Prefeitura de Jundiaí FISCONET WebService
    const numNotaGerada = `NFS-${now.getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const codVerificacao = `JUND-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

    const notaAprovada: NotaFiscalJundiai = {
      ...novaNota,
      numeroNota: numNotaGerada,
      codigoVerificacao: codVerificacao,
      status: 'Aprovada',
      pdfUrl: '#',
      xmlUrl: '#'
    };

    try {
      await supabase.from('notas_fiscais').upsert(mappers.nfToDb(notaAprovada));
    } catch (e) {
      console.warn('[NFS-e Jundiaí] Could not save to DB, persisting in local storage:', e);
    }

    const current = await nfseJundiaiService.listNotas();
    const updated = [notaAprovada, ...current.filter((n) => n.id !== notaAprovada.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    return notaAprovada;
  },

  cancelarNota: async (id: string, motivo: string): Promise<boolean> => {
    const current = await nfseJundiaiService.listNotas();
    const idx = current.findIndex((n) => n.id === id);
    if (idx === -1) return false;

    current[idx].status = 'Cancelada';
    current[idx].motivoRejeicao = `Cancelamento solicitado: ${motivo}`;

    try {
      await supabase.from('notas_fiscais').update({ status: 'Cancelada', motivo_rejeicao: motivo }).eq('id', id);
    } catch (_) {}

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return true;
  }
};
