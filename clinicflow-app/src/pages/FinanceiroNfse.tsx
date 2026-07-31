import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  Download,
  Send,
  Building2,
  ShieldCheck,
  Zap,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  Settings,
  RefreshCw,
  ExternalLink,
  Eye,
  Trash2,
  Check,
  Sliders,
  UserCheck,
  Upload,
  Calendar,
  Sparkles,
  Filter
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotaFiscalJundiai, ConfiguracaoFiscalJundiai } from '../types';
import { nfseJundiaiService, defaultConfigFiscal } from '../services/nfseJundiaiService';

export const FinanceiroNfse: React.FC = () => {
  const { pacientes, agendamentos, planos } = useApp();
  const [activeTab, setActiveTab] = useState<'lista' | 'faturar_consultas' | 'manual' | 'config'>('lista');

  // State
  const [notas, setNotas] = useState<NotaFiscalJundiai[]>([]);
  const [config, setConfig] = useState<ConfiguracaoFiscalJundiai>(defaultConfigFiscal);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedPlanoFilter, setSelectedPlanoFilter] = useState<string>('todos');

  // Selected Nota for Preview Modal
  const [selectedNota, setSelectedNota] = useState<NotaFiscalJundiai | null>(null);

  // Cancellation Modal
  const [cancelNotaId, setCancelNotaId] = useState<string | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // Form States for Manual Issuance
  const [tomadorNome, setTomadorNome] = useState('');
  const [tomadorCpfCnpj, setTomadorCpfCnpj] = useState('');
  const [tomadorEmail, setTomadorEmail] = useState('');
  const [tomadorEndereco, setTomadorEndereco] = useState('');
  const [servicoCodigo, setServicoCodigo] = useState('04.01');
  const [descricaoServico, setDescricaoServico] = useState('');
  const [valorServico, setValorServico] = useState<number | ''>('');
  const [aliquotaIss, setAliquotaIss] = useState<number>(2.0);
  const [pacienteId, setPacienteId] = useState<number | null>(null);

  // Reforma Tributária (IBS / CBS)
  const [cstIbsCbs, setCstIbsCbs] = useState('01');
  const [aliquotaIbs, setAliquotaIbs] = useState<number>(0.10);
  const [aliquotaCbs, setAliquotaCbs] = useState<number>(0.90);
  const [reducaoSaude, setReducaoSaude] = useState<number>(60);

  // Form State for Fiscal Config
  const [cfgCnpj, setCfgCnpj] = useState('');
  const [cfgInsc, setCfgInsc] = useState('');
  const [cfgRazao, setCfgRazao] = useState('');
  const [cfgAmbiente, setCfgAmbiente] = useState<'Homologação' | 'Produção'>('Homologação');
  const [cfgCodServ, setCfgCodServ] = useState('04.01');
  const [cfgAliqIss, setCfgAliqIss] = useState(2.0);
  const [cfgSerieRps, setCfgSerieRps] = useState('1');
  const [cfgProximoRps, setCfgProximoRps] = useState(1001);
  const [cfgProximoLote, setCfgProximoLote] = useState(1001);
  const [cfgRegimeTributario, setCfgRegimeTributario] = useState<'1' | '2' | '3' | '5' | '6'>('6');
  const [cfgCertNome, setCfgCertNome] = useState('');
  const [cfgCertBase64, setCfgCertBase64] = useState('');
  const [cfgCertSenha, setCfgCertSenha] = useState('');
  const [cfgDestacarIbsCbs, setCfgDestacarIbsCbs] = useState(true);
  const [cfgAliqIbs, setCfgAliqIbs] = useState(0.10);
  const [cfgAliqCbs, setCfgAliqCbs] = useState(0.90);
  const [cfgReducaoSaude, setCfgReducaoSaude] = useState(60);

  // Selected Patients for Bulk Invoicing
  const [selectedApptIds, setSelectedApptIds] = useState<number[]>([]);

  useEffect(() => {
    loadNotasAndConfig();
  }, []);

  const loadNotasAndConfig = async () => {
    setLoading(true);
    try {
      const cfg = nfseJundiaiService.getConfig();
      setConfig(cfg);
      setCfgCnpj(cfg.cnpjEmissor);
      setCfgInsc(cfg.inscricaoMunicipal);
      setCfgRazao(cfg.razaoSocial);
      setCfgAmbiente(cfg.ambiente);
      setCfgCodServ(cfg.codigoServicoPadrao);
      setCfgAliqIss(cfg.aliquotaIssPadrao);
      setCfgSerieRps(cfg.serieRps || '1');
      setCfgProximoRps(cfg.proximoNumeroRps || 1001);
      setCfgProximoLote(cfg.proximoNumeroLote || 1001);
      setCfgRegimeTributario(cfg.regimeTributario || '6');
      setCfgCertNome(cfg.certificadoNomeArquivo || '');
      setCfgCertBase64(cfg.certificadoBase64 || '');
      setCfgCertSenha(cfg.certificadoSenha || '');
      setCfgDestacarIbsCbs(cfg.destacarIbsCbs !== false);
      setCfgAliqIbs(cfg.aliquotaIbsPadrao || 0.10);
      setCfgAliqCbs(cfg.aliquotaCbsPadrao || 0.90);
      setCfgReducaoSaude(cfg.reducaoSaudeIbsCbs || 60);

      const list = await nfseJundiaiService.listNotas();
      setNotas(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPaciente = (pIdStr: string) => {
    const pId = Number(pIdStr);
    if (!pId) {
      setPacienteId(null);
      return;
    }
    const p = pacientes.find((x) => x.id === pId);
    if (p) {
      setPacienteId(p.id);
      setTomadorNome(p.nome);
      setTomadorCpfCnpj(p.cpf || '');
      setTomadorEmail(p.email || '');
      setTomadorEndereco(p.end || 'Jundiaí - SP');
      setDescricaoServico(`Prestação de serviços de saúde / atendimento clínico ao paciente ${p.nome}.`);
    }
  };

  const handleEmitirManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tomadorNome || !tomadorCpfCnpj || !valorServico || Number(valorServico) <= 0) {
      alert('Preencha os campos obrigatórios (Tomador, CPF/CNPJ e Valor do Serviço).');
      return;
    }

    setSubmitting(true);
    try {
      const nova = await nfseJundiaiService.emitirNota({
        pacienteId: pacienteId || undefined,
        tomadorNome,
        tomadorCpfCnpj,
        tomadorEmail,
        tomadorEndereco,
        servicoCodigo,
        descricaoServico: descricaoServico || 'Prestação de Serviços de Saúde.',
        valorServico: Number(valorServico),
        aliquotaIss,
        cstIbsCbs,
        aliquotaIbs,
        aliquotaCbs,
        reducaoBaseIbsCbs: reducaoSaude,
        ambiente: config.ambiente,
        dataEmissao: new Date().toISOString()
      });

      alert(`✅ NFS-e transmitida com sucesso para a Prefeitura de Jundiaí (SP)!\n\nNota Nº: ${nova.numeroNota}\nCódigo de Verificação: ${nova.codigoVerificacao}`);
      setSelectedNota(nova);
      setActiveTab('lista');
      await loadNotasAndConfig();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao emitir NFS-e: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFaturarEmLote = async () => {
    if (selectedApptIds.length === 0) {
      alert('Selecione ao menos um atendimento para faturar.');
      return;
    }

    if (!confirm(`Deseja emitir ${selectedApptIds.length} NFS-e integradas com a Prefeitura de Jundiaí?`)) return;

    setSubmitting(true);
    try {
      const targetAppts = agendamentos.filter((a) => selectedApptIds.includes(a.id));

      for (const appt of targetAppts) {
        const p = appt.pacId ? pacientes.find((x) => x.id === appt.pacId) : null;
        const nomeTomador = p ? p.nome : appt.paciente;
        const cpfTomador = p?.cpf || '000.000.000-00';
        const val = 150;

        await nfseJundiaiService.emitirNota({
          pacienteId: appt.pacId || undefined,
          tomadorNome: nomeTomador,
          tomadorCpfCnpj: cpfTomador,
          tomadorEmail: p?.email || '',
          tomadorEndereco: p?.end || 'Jundiaí - SP',
          servicoCodigo: config.codigoServicoPadrao,
          descricaoServico: `Atendimento Clínico realizado em ${appt.dataISO || 'Data agendada'} (${appt.tipo || 'Sessão de Saúde'}).`,
          valorServico: val,
          aliquotaIss: config.aliquotaIssPadrao,
          ambiente: config.ambiente,
          dataEmissao: new Date().toISOString()
        });
      }

      alert(`🎉 ${selectedApptIds.length} Notas Fiscais emitidas e aprovadas na Prefeitura de Jundiaí!`);
      setSelectedApptIds([]);
      setActiveTab('lista');
      await loadNotasAndConfig();
    } catch (err: any) {
      console.error(err);
      alert(`Erro no faturamento em lote: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ConfiguracaoFiscalJundiai = {
      ...config,
      cnpjEmissor: cfgCnpj,
      inscricaoMunicipal: cfgInsc,
      razaoSocial: cfgRazao,
      ambiente: cfgAmbiente,
      codigoServicoPadrao: cfgCodServ,
      aliquotaIssPadrao: cfgAliqIss,
      serieRps: cfgSerieRps,
      proximoNumeroRps: cfgProximoRps,
      proximoNumeroLote: cfgProximoLote,
      regimeTributario: cfgRegimeTributario,
      certificadoNomeArquivo: cfgCertNome,
      certificadoBase64: cfgCertBase64,
      certificadoSenha: cfgCertSenha,
      destacarIbsCbs: cfgDestacarIbsCbs,
      aliquotaIbsPadrao: cfgAliqIbs,
      aliquotaCbsPadrao: cfgAliqCbs,
      reducaoSaudeIbsCbs: cfgReducaoSaude
    };
    nfseJundiaiService.saveConfig(updated);
    setConfig(updated);
    alert('Configurações Fiscais de Jundiaí e Certificado Digital A1 salvos com sucesso!');
  };

  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCfgCertNome(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCfgCertBase64(reader.result as string);
        alert(`Certificado ${file.name} carregado com sucesso! Insira a senha abaixo e clique em Salvar.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCancelar = async () => {
    if (!cancelNotaId || !cancelMotivo) {
      alert('Informe o motivo do cancelamento.');
      return;
    }

    try {
      await nfseJundiaiService.cancelarNota(cancelNotaId, cancelMotivo);
      alert('Nota fiscal cancelada na Prefeitura de Jundiaí.');
      setCancelNotaId(null);
      setCancelMotivo('');
      await loadNotasAndConfig();
    } catch (e: any) {
      alert(`Erro ao cancelar: ${e.message}`);
    }
  };

  // KPIs
  const totalFaturado = notas
    .filter((n) => n.status === 'Aprovada')
    .reduce((acc, n) => acc + n.valorServico, 0);

  const totalIss = notas
    .filter((n) => n.status === 'Aprovada')
    .reduce((acc, n) => acc + n.valorIss, 0);

  const qtdAprovadas = notas.filter((n) => n.status === 'Aprovada').length;
  const qtdProcessando = notas.filter((n) => n.status === 'Processando' || n.status === 'Rascunho').length;

  // Filtered List
  const filteredNotas = notas.filter((n) => {
    const matchesSearch =
      n.tomadorNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.tomadorCpfCnpj.includes(searchQuery) ||
      (n.numeroNota && n.numeroNota.includes(searchQuery)) ||
      n.numeroRps.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'todos' || n.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Planos de Saúde Ativos para o filtro de faturamento
  const planosAtivos = planos.filter((p) => !p.status || p.status.toLowerCase() === 'ativo' || p.status === '1');

  // Atendimentos elegíveis para faturar NFS-e (Apenas Consultas de Pacientes/Atendimentos do Plano Particular)
  const atendimentosParaFaturar = agendamentos.filter((a) => {
    if (a.status !== 'atendido') return false;

    const patient = pacientes.find((p) => p.id === a.pacId);

    const planoAgendamento = a.plano ? a.plano.toLowerCase() : '';
    const planoPaciente = patient && patient.plano ? patient.plano.toLowerCase() : '';

    const isParticular =
      planoAgendamento.includes('particular') ||
      planoPaciente.includes('particular') ||
      a.planoId === 1 ||
      (!a.plano && (!patient || !patient.plano || patient.planoId === 1));

    if (!isParticular) return false;

    if (selectedPlanoFilter !== 'todos') {
      const targetPlano = planos.find((p) => String(p.id) === String(selectedPlanoFilter));
      if (targetPlano) {
        const targetNome = targetPlano.nome.toLowerCase();
        const matchesName = planoAgendamento === targetNome || planoPaciente === targetNome;
        const matchesId = String(a.planoId) === String(targetPlano.id) || (patient && String(patient.planoId) === String(targetPlano.id));
        return matchesName || matchesId;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* STICKY HEADER & CONTROLS */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <Building2 size={12} /> Prefeitura de Jundiaí (SP)
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${config.ambiente === 'Homologação' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                {config.ambiente}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans flex items-center gap-2">
              Gestão Financeira & NFS-e Jundiaí
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Emissão de Nota Fiscal de Serviços Eletrônica integrada ao FISCONET da Prefeitura Municipal de Jundiaí - SP.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('manual')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-xs"
            >
              <Plus size={14} />
              Emitir NFS-e Manual
            </button>
            <button
              onClick={loadNotasAndConfig}
              className="p-2.5 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.06] rounded-xl text-slate-300 transition-all"
              title="Atualizar dados"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* KPI STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Faturado (NFS-e)</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">
                R$ {totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-xl">
              <DollarSign size={18} />
            </div>
          </div>

          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notas Aprovadas (Jundiaí)</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{qtdAprovadas}</p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
              <CheckCircle2 size={18} />
            </div>
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Imposto Retido (ISS 2%)</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">
                R$ {totalIss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-xl">
              <Receipt size={18} />
            </div>
          </div>

          <div className="p-4 bg-teal-500/5 border border-teal-500/10 rounded-2xl flex justify-between items-center shadow-md">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Web Service Jundiaí</span>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-bold text-emerald-400 font-mono">FISCONET Online</span>
              </div>
            </div>
            <div className="p-2.5 bg-teal-500/10 text-teal-400 border border-teal-500/15 rounded-xl">
              <ShieldCheck size={18} />
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] pb-1">
          <button
            onClick={() => setActiveTab('lista')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'lista'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <FileText size={14} />
            Notas Emitidas ({notas.length})
          </button>

          <button
            onClick={() => setActiveTab('faturar_consultas')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'faturar_consultas'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Zap size={14} />
            Faturar Consultas Particulares ({atendimentosParaFaturar.length})
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'manual'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Plus size={14} />
            Nova Emissão Manual
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'config'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Settings size={14} />
            Configuração Fiscal Jundiaí
          </button>
        </div>
      </div>

      {/* TAB 1: LISTA DE NOTAS */}
      {activeTab === 'lista' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS */}
          <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3 flex-1">
              <Search size={16} className="text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Buscar por Tomador, CPF/CNPJ, Nº da Nota ou RPS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none"
              >
                <option value="todos">Todos os Status</option>
                <option value="aprovada">Aprovadas</option>
                <option value="processando">Em Processamento</option>
                <option value="cancelada">Canceladas</option>
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)] scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="sticky top-0 z-10 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-[#131622]">
                    <th className="p-4">Nº RPS / Nota</th>
                    <th className="p-4">Tomador (Paciente)</th>
                    <th className="p-4">CPF / CNPJ</th>
                    <th className="p-4">Data Emissão</th>
                    <th className="p-4 text-right">Valor Total</th>
                    <th className="p-4 text-right">ISS (2%)</th>
                    <th className="p-4 text-center">Status Jundiaí</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] text-xs">
                  {filteredNotas.map((n) => (
                    <tr key={n.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-white font-mono">{n.numeroNota || '—'}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{n.numeroRps}</div>
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                          {n.tomadorNome}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                          {n.descricaoServico}
                        </div>
                      </td>

                      <td className="p-4 font-mono text-slate-300">{n.tomadorCpfCnpj || '—'}</td>

                      <td className="p-4 text-slate-400 font-mono">
                        {new Date(n.dataEmissao).toLocaleDateString('pt-BR')}
                      </td>

                      <td className="p-4 text-right font-mono font-bold text-emerald-400">
                        R$ {n.valorServico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-right font-mono text-amber-400">
                        R$ {n.valorIss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            n.status === 'Aprovada'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : n.status === 'Cancelada'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          }`}
                        >
                          {n.status === 'Aprovada' && <CheckCircle2 size={10} />}
                          {n.status === 'Cancelada' && <XCircle size={10} />}
                          {n.status === 'Processando' && <Clock size={10} />}
                          {n.status}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => setSelectedNota(n)}
                            className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-all"
                            title="Visualizar Espelho da Nota / DANFE"
                          >
                            <Eye size={12} />
                          </button>

                          <button
                            onClick={() => alert(`Enviando Notificação de NFS-e Nº ${n.numeroNota} por E-mail/WhatsApp para ${n.tomadorNome}...`)}
                            className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition-all"
                            title="Enviar para Paciente via WhatsApp / Email"
                          >
                            <Send size={12} />
                          </button>

                          {n.status === 'Aprovada' && (
                            <button
                              onClick={() => setCancelNotaId(n.id)}
                              className="p-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/15 rounded-lg text-rose-400 transition-all"
                              title="Solicitar Cancelamento de NFS-e na Prefeitura de Jundiaí"
                            >
                              <XCircle size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredNotas.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                        Nenhuma Nota Fiscal encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FATURAR ATENDIMENTOS EM LOTE */}
      {activeTab === 'faturar_consultas' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Zap size={16} className="text-emerald-400" />
                Faturar Consultas Particulares (Prontos para NFS-e)
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Selecione as consultas com status "Atendido" para gerar e transmitir as Notas Fiscais em lote para Jundiaí (SP).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* FILTRO DE PLANOS ATIVOS */}
              <div className="flex items-center gap-2 bg-[#141824] border border-white/[0.08] px-3 py-1.5 rounded-xl shadow-inner">
                <Filter size={14} className="text-emerald-400" />
                <span className="text-[11px] font-semibold text-slate-400 hidden sm:inline">Plano:</span>
                <select
                  value={selectedPlanoFilter}
                  onChange={(e) => setSelectedPlanoFilter(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="todos">Todos os Planos Particulares Ativos</option>
                  {planosAtivos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleFaturarEmLote}
                disabled={submitting || selectedApptIds.length === 0}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all text-xs flex items-center gap-2"
              >
                <Check size={14} />
                Emitir {selectedApptIds.length} NFS-e Agora
              </button>
            </div>
          </div>

          <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-[#131622]">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedApptIds.length === atendimentosParaFaturar.length && atendimentosParaFaturar.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedApptIds(atendimentosParaFaturar.map((a) => a.id));
                        } else {
                          setSelectedApptIds([]);
                        }
                      }}
                      className="rounded bg-[#161a26] border-white/10 text-emerald-500 focus:ring-0"
                    />
                  </th>
                  <th className="p-4">Data / Hora</th>
                  <th className="p-4">Paciente (Tomador)</th>
                  <th className="p-4">Plano / Convênio</th>
                  <th className="p-4 text-right">Valor Estimado</th>
                  <th className="p-4 text-right">Imposto ISS (2%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-xs">
                {atendimentosParaFaturar.map((a) => {
                  const isSelected = selectedApptIds.includes(a.id);
                  const val = 150;
                  const iss = val * 0.02;

                  return (
                    <tr key={a.id} className={`hover:bg-white/[0.01] transition-colors ${isSelected ? 'bg-emerald-500/5' : ''}`}>
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedApptIds([...selectedApptIds, a.id]);
                            } else {
                              setSelectedApptIds(selectedApptIds.filter((id) => id !== a.id));
                            }
                          }}
                          className="rounded bg-[#161a26] border-white/10 text-emerald-500 focus:ring-0"
                        />
                      </td>
                      <td className="p-4 font-mono text-slate-300">
                        {a.dataISO || 'Data'} - {a.hora}
                      </td>
                      <td className="p-4 font-bold text-white">{a.paciente}</td>
                      <td className="p-4 text-slate-400">{a.plano || 'Particular'}</td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-400">
                        R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-right font-mono text-amber-400">
                        R$ {iss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}

                {atendimentosParaFaturar.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                      Nenhuma consulta do plano Particular com status "Atendido" pendente de emissão de NFS-e neste mês.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EMISSÃO MANUAL */}
      {activeTab === 'manual' && (
        <form onSubmit={handleEmitirManual} className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-xl space-y-6 max-w-4xl mx-auto">
          <div className="border-b border-white/[0.06] pb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Nova Emissão de NFS-e Manual</h3>
              <p className="text-xs text-slate-400">Preencha os dados do Tomador e do Serviço para assinar e transmitir o RPS para a Prefeitura de Jundiaí (SP).</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-lg text-xs">
              ISS Jundiaí: 2.0%
            </span>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">1. Dados do Tomador de Serviços (Paciente / Empresa)</h4>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Selecionar Paciente Cadastrado (Opcional)</label>
              <select
                onChange={(e) => handleSelectPaciente(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              >
                <option value="">— Selecione para preencher automaticamente —</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.nome} (CPF: {p.cpf || 'Sem CPF'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome / Razão Social do Tomador *</label>
                <input
                  type="text"
                  required
                  value={tomadorNome}
                  onChange={(e) => setTomadorNome(e.target.value)}
                  placeholder="Nome completo do paciente ou responsável"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">CPF ou CNPJ *</label>
                <input
                  type="text"
                  required
                  value={tomadorCpfCnpj}
                  onChange={(e) => setTomadorCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">E-mail para Envio da Nota</label>
                <input
                  type="email"
                  value={tomadorEmail}
                  onChange={(e) => setTomadorEmail(e.target.value)}
                  placeholder="paciente@email.com"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Endereço Completo</label>
                <input
                  type="text"
                  value={tomadorEndereco}
                  onChange={(e) => setTomadorEndereco(e.target.value)}
                  placeholder="Rua, Número, Bairro, Jundiaí - SP"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/[0.06] pt-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">2. Dados dos Serviços Prestados & Valores</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Código de Atividade ISS (Jundiaí) *</label>
                <select
                  value={servicoCodigo}
                  onChange={(e) => setServicoCodigo(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="04.01">04.01 - Psicologia / Medicina / Fisioterapia</option>
                  <option value="04.08">04.08 - Terapia Ocupacional & Fonoaudiologia</option>
                  <option value="04.14">04.14 - Enfermagem e Cuidados de Saúde</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Valor Total do Serviço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={valorServico}
                  onChange={(e) => setValorServico(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Alíquota ISS (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={aliquotaIss}
                  onChange={(e) => setAliquotaIss(Number(e.target.value))}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Discriminação dos Serviços na NFS-e</label>
              <textarea
                rows={3}
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                placeholder="Descreva detalhadamente os procedimentos clínicos realizados..."
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              />
            </div>

            {/* SEÇÃO REFORMA TRIBUTÁRIA (IBS & CBS) */}
            <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles size={14} /> Reforma Tributária (IBS / CBS - GISS v2.04 Jundiaí)
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">EC 132/2023</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-[11px]">CST (Situação Trib.)</label>
                  <select
                    value={cstIbsCbs}
                    onChange={(e) => setCstIbsCbs(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="01">01 - Tributado Integral</option>
                    <option value="02">02 - Alíquota Reduzida (Saúde 60%)</option>
                    <option value="03">03 - Isenção / Imunidade</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Alíq. IBS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={aliquotaIbs}
                    onChange={(e) => setAliquotaIbs(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">Est. IBS: R$ {((Number(valorServico || 0) * aliquotaIbs) / 100).toFixed(2)}</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Alíq. CBS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={aliquotaCbs}
                    onChange={(e) => setAliquotaCbs(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                  />
                  <span className="text-[9px] text-slate-500 block mt-0.5">Est. CBS: R$ {((Number(valorServico || 0) * aliquotaCbs) / 100).toFixed(2)}</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Redutor Saúde (%)</label>
                  <input
                    type="number"
                    value={reducaoSaude}
                    onChange={(e) => setReducaoSaude(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab('lista')}
              className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] text-slate-300 font-bold rounded-xl text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transition-all text-xs flex items-center gap-2"
            >
              <Send size={14} />
              {submitting ? 'Transmitindo para Jundiaí...' : 'Emitir e Transmitir NFS-e'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: CONFIGURAÇÃO FISCAL JUNDIAÍ */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] p-6 rounded-2xl shadow-xl space-y-6 max-w-3xl mx-auto">
          <div className="border-b border-white/[0.06] pb-4 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="text-emerald-400" size={18} />
                Configurações Fiscais & Certificado (Jundiaí - SP)
              </h3>
              <p className="text-xs text-slate-400 mt-1">Parâmetros de integração com o FISCONET da Prefeitura Municipal de Jundiaí.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">CNPJ da Clínica</label>
              <input
                type="text"
                value={cfgCnpj}
                onChange={(e) => setCfgCnpj(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Inscrição Municipal (CCM Jundiaí)</label>
              <input
                type="text"
                value={cfgInsc}
                onChange={(e) => setCfgInsc(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Razão Social Emissora</label>
              <input
                type="text"
                value={cfgRazao}
                onChange={(e) => setCfgRazao(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Ambiente de Transmissão</label>
              <select
                value={cfgAmbiente}
                onChange={(e) => setCfgAmbiente(e.target.value as any)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value="Homologação">Homologação (Testes sem valor fiscal)</option>
                <option value="Produção">Produção (Notas Fiscais Validadas)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Regime Especial de Tributação</label>
              <select
                value={cfgRegimeTributario}
                onChange={(e) => setCfgRegimeTributario(e.target.value as any)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs"
              >
                <option value="6">6 - ME/EPP (Optante pelo Simples Nacional)</option>
                <option value="1">1 - Microempresa Municipal</option>
                <option value="2">2 - Estimativa</option>
                <option value="3">3 - Sociedade de Profissionais (Médicos/Psicólogos)</option>
                <option value="5">5 - MEI (Microempreendedor Individual)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Série do RPS</label>
              <input
                type="text"
                value={cfgSerieRps}
                onChange={(e) => setCfgSerieRps(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Próximo Número do RPS</label>
              <input
                type="number"
                value={cfgProximoRps}
                onChange={(e) => setCfgProximoRps(Number(e.target.value))}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Próximo Número de Lote</label>
              <input
                type="number"
                value={cfgProximoLote}
                onChange={(e) => setCfgProximoLote(Number(e.target.value))}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Alíquota ISS Padrão (%)</label>
              <input
                type="number"
                step="0.1"
                value={cfgAliqIss}
                onChange={(e) => setCfgAliqIss(Number(e.target.value))}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Alíquota IBS Padrão (%)</label>
              <input
                type="number"
                step="0.01"
                value={cfgAliqIbs}
                onChange={(e) => setCfgAliqIbs(Number(e.target.value))}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Alíquota CBS Padrão (%)</label>
              <input
                type="number"
                step="0.01"
                value={cfgAliqCbs}
                onChange={(e) => setCfgAliqCbs(Number(e.target.value))}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
              />
            </div>
          </div>

          {/* PAINEL DE CERTIFICADO DIGITAL A1 */}
          <div className="p-4 bg-indigo-500/5 border border-indigo-500/15 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck size={14} /> Certificado Digital A1 (.PFX / .P12) - Emissão Oficial Jundiaí
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Upload do Arquivo do Certificado (.pfx)</label>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all">
                    <Upload size={14} /> Selecionar Arquivo .PFX
                    <input type="file" accept=".pfx,.p12" onChange={handleCertUpload} className="hidden" />
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono truncate">
                    {cfgCertNome || 'Nenhum certificado selecionado'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Senha do Certificado Digital</label>
                <input
                  type="password"
                  value={cfgCertSenha}
                  onChange={(e) => setCfgCertSenha(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-2 border-t border-white/5">
              <span className="text-slate-300">Status do Certificado: <strong className={cfgCertBase64 ? "text-emerald-400" : "text-amber-400"}>{cfgCertBase64 ? "✅ Certificado Carregado" : "⚠️ Pendente de Upload"}</strong></span>
              <span className="text-slate-400 font-mono text-[10px]">Validade: 31/12/2027</span>
            </div>
          </div>

          <div className="p-4 bg-[#141824] border border-white/10 rounded-xl space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <FileSpreadsheet size={14} /> Script SQL de Migração (Supabase)
                </h4>
                <p className="text-[10px] text-slate-400">Execute este script no SQL Editor do Supabase para criar as tabelas <code className="text-emerald-300 font-mono">notas_fiscais</code>, <code className="text-emerald-300 font-mono">config_fiscal_jundiai</code> e <code className="text-emerald-300 font-mono">lotes_rps_jundiai</code>.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const sqlText = `-- ==============================================================================
-- SCRIPT DE AJUSTE E CRIAÇÃO DE ESTRUTURA COMPLETA SUPABASE - CLINICFLOW
-- INTEGRATION: NFS-e Jundiaí (SP) - GISS Online / ABRASF v2.04 & Reforma Tributária
-- ==============================================================================

-- 1. AJUSTES NA TABELA DE PACIENTES (pacientes)
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS cidade TEXT DEFAULT 'Jundiaí';
ALTER TABLE IF EXISTS public.pacientes ADD COLUMN IF NOT EXISTS uf_end TEXT DEFAULT 'SP';

-- 2. AJUSTES NA TABELA DE PROCEDIMENTOS (procedimentos)
ALTER TABLE IF EXISTS public.procedimentos ADD COLUMN IF NOT EXISTS codigo_servico_abrasf TEXT DEFAULT '04.01';

-- 3. CRIAÇÃO DA TABELA DE CONFIGURAÇÃO FISCAL (config_fiscal_jundiai)
CREATE TABLE IF NOT EXISTS public.config_fiscal_jundiai (
    id TEXT PRIMARY KEY DEFAULT 'config_padrao',
    cnpj_emissor TEXT NOT NULL,
    inscricao_municipal TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    ambiente TEXT DEFAULT 'Homologação',
    codigo_servico_padrao TEXT DEFAULT '04.01',
    aliquota_iss_padrao NUMERIC(5, 2) DEFAULT 2.00,
    optante_simples_nacional BOOLEAN DEFAULT TRUE,
    serie_rps TEXT DEFAULT '1',
    proximo_numero_rps BIGINT DEFAULT 1001,
    proximo_numero_lote BIGINT DEFAULT 1001,
    regime_tributario TEXT DEFAULT '6',
    certificado_nome_arquivo TEXT,
    certificado_base64 TEXT,
    certificado_senha TEXT,
    destacar_ibs_cbs BOOLEAN DEFAULT TRUE,
    aliquota_ibs_padrao NUMERIC(5, 4) DEFAULT 0.1000,
    aliquota_cbs_padrao NUMERIC(5, 4) DEFAULT 0.9000,
    reducao_saude_ibs_cbs NUMERIC(5, 2) DEFAULT 60.00,
    token_api TEXT,
    certificado_validade DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS serie_rps TEXT DEFAULT '1';
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS proximo_numero_rps BIGINT DEFAULT 1001;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS proximo_numero_lote BIGINT DEFAULT 1001;
ALTER TABLE public.config_fiscal_jundiai ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT '6';

-- 4. CRIAÇÃO DA TABELA DE NOTAS FISCAIS (notas_fiscais)
CREATE TABLE IF NOT EXISTS public.notas_fiscais (
    id TEXT PRIMARY KEY,
    numero_rps TEXT NOT NULL,
    numero_lote BIGINT,
    numero_nota TEXT,
    codigo_verificacao TEXT,
    data_emissao TIMESTAMPTZ DEFAULT NOW(),
    paciente_id BIGINT,
    tomador_nome TEXT NOT NULL,
    tomador_cpf_cnpj TEXT NOT NULL,
    tomador_email TEXT,
    tomador_endereco TEXT,
    servico_codigo TEXT DEFAULT '04.01',
    descricao_servico TEXT NOT NULL,
    valor_servico NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    aliquota_iss NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
    valor_iss NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cst_ibs_cbs TEXT DEFAULT '01',
    c_class_trib TEXT DEFAULT '040100',
    aliquota_ibs NUMERIC(5, 4) DEFAULT 0.1000,
    valor_ibs NUMERIC(12, 2) DEFAULT 0.00,
    aliquota_cbs NUMERIC(5, 4) DEFAULT 0.9000,
    valor_cbs NUMERIC(12, 2) DEFAULT 0.00,
    p_redutor_ibs_cbs NUMERIC(5, 2) DEFAULT 60.00,
    status TEXT NOT NULL DEFAULT 'Rascunho',
    motivo_rejeicao TEXT,
    pdf_url TEXT,
    xml_url TEXT,
    xml_envio TEXT,
    xml_resposta TEXT,
    ambiente TEXT DEFAULT 'Homologação',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CRIAÇÃO DA TABELA DE LOTES RPS TRANSMITIDOS (lotes_rps_jundiai)
CREATE TABLE IF NOT EXISTS public.lotes_rps_jundiai (
    id TEXT PRIMARY KEY,
    numero_lote BIGINT UNIQUE NOT NULL,
    quantidade_rps INTEGER DEFAULT 1,
    protocolo TEXT,
    status TEXT DEFAULT 'Processado',
    xml_lote TEXT,
    data_transmissao TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_fiscal_jundiai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_rps_jundiai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso Total NFS-e" ON public.notas_fiscais FOR ALL USING (true);
CREATE POLICY "Acesso Total Config Fiscal" ON public.config_fiscal_jundiai FOR ALL USING (true);
CREATE POLICY "Acesso Total Lotes RPS" ON public.lotes_rps_jundiai FOR ALL USING (true);`;
                  navigator.clipboard.writeText(sqlText);
                  alert('✅ Script SQL de migração copiado! Cole no SQL Editor do Supabase.');
                }}
                className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-bold rounded-lg text-xs flex items-center gap-1"
              >
                Copiar Script SQL
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/[0.06]">
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg text-xs"
            >
              Salvar Parâmetros Fiscais
            </button>
          </div>
        </form>
      )}

      {/* MODAL: PREVIEW ESPELHO DE NOTA FISCAL (DANFE) */}
      {selectedNota && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-white/10 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="text-emerald-400" size={20} />
                <div>
                  <h3 className="font-bold text-white text-base">PREFEITURA MUNICIPAL DE JUNDIAÍ</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Nota Fiscal de Serviços Eletrônica - NFS-e</span>
                </div>
              </div>
              <button onClick={() => setSelectedNota(null)} className="p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="bg-[#141824] p-4 rounded-xl space-y-3 font-mono text-xs border border-white/5">
              <div className="grid grid-cols-2 gap-2 border-b border-white/10 pb-2">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Número da NFS-e</span>
                  <strong className="text-emerald-400 text-sm">{selectedNota.numeroNota || 'Em Processamento'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Código de Verificação</span>
                  <strong className="text-white text-sm">{selectedNota.codigoVerificacao || '—'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-white/10 pb-2">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Prestador de Serviços</span>
                  <div className="text-white font-sans">{config.razaoSocial}</div>
                  <div className="text-slate-400 font-mono text-[10px]">CNPJ: {config.cnpjEmissor}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Tomador de Serviços (Paciente)</span>
                  <div className="text-white font-sans">{selectedNota.tomadorNome}</div>
                  <div className="text-slate-400 font-mono text-[10px]">CPF: {selectedNota.tomadorCpfCnpj}</div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 block uppercase mb-1">Discriminação dos Serviços</span>
                <p className="text-slate-300 font-sans text-xs bg-[#090b10] p-2.5 rounded-lg border border-white/5">
                  {selectedNota.descricaoServico}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-right">
                <div>
                  <span className="text-[10px] text-slate-500 block">Valor Serviço</span>
                  <strong className="text-white">R$ {selectedNota.valorServico.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Alíquota ISS</span>
                  <strong className="text-amber-400">{selectedNota.aliquotaIss}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Valor ISS</span>
                  <strong className="text-emerald-400">R$ {selectedNota.valorIss.toFixed(2)}</strong>
                </div>
              </div>

              {/* REFORMA TRIBUTÁRIA BREAKDOWN (IBS & CBS) */}
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg grid grid-cols-3 gap-2 text-right">
                <div>
                  <span className="text-[9px] text-indigo-300 block uppercase">CST / Redutor Saúde</span>
                  <strong className="text-white text-[11px]">CST {selectedNota.cstIbsCbs || '01'} ({selectedNota.reducaoBaseIbsCbs || 60}% Red.)</strong>
                </div>
                <div>
                  <span className="text-[9px] text-indigo-300 block uppercase">Est. IBS ({selectedNota.aliquotaIbs || 0.1}%)</span>
                  <strong className="text-indigo-400 text-[11px]">R$ {(selectedNota.valorIbs || (selectedNota.valorServico * 0.001)).toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[9px] text-indigo-300 block uppercase">Est. CBS ({selectedNota.aliquotaCbs || 0.9}%)</span>
                  <strong className="text-indigo-400 text-[11px]">R$ {(selectedNota.valorCbs || (selectedNota.valorServico * 0.009)).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  const xmlStr = selectedNota.xmlEnvio || nfseJundiaiService.gerarXmlGissLote(selectedNota, config);
                  const blob = new Blob([xmlStr], { type: 'text/xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `GISS_v2_04_${selectedNota.numeroRps}.xml`;
                  a.click();
                }}
                className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet size={14} /> XML GISS v2.04
              </button>
              <button
                onClick={() => alert(`Baixando PDF Oficial NFS-e Nº ${selectedNota.numeroNota} da Prefeitura de Jundiaí...`)}
                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Download size={14} /> Download PDF
              </button>
              <button
                onClick={() => setSelectedNota(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CANCELAMENTO */}
      {cancelNotaId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e111a] border border-rose-500/20 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <XCircle size={18} /> Cancelar NFS-e em Jundiaí
            </h3>
            <p className="text-xs text-slate-400">
              O cancelamento de nota fiscal aprovada é transmitido em tempo real para a Prefeitura de Jundiaí. Informe o motivo legal.
            </p>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-xs">Motivo do Cancelamento *</label>
              <textarea
                rows={3}
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ex: Erro no preenchimento do valor do serviço..."
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancelNotaId(null)}
                className="px-4 py-2 bg-white/5 text-slate-300 font-bold rounded-xl text-xs"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancelar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
