import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit3, Save, FileText, CheckCircle2, AlertCircle, Printer, Trash2, Filter, Settings, ShieldAlert, Sparkles, ChevronDown, Check, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { GuiaSadt, ProcedimentoGuia, SenhaPlano, Paciente } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

// Holiday helpers
const getFeriados = (): { data: string; desc: string }[] => {
  try {
    const saved = localStorage.getItem('cf_feriados');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [
    { data: '2026-01-01', desc: 'Confraternização Universal' },
    { data: '2026-02-16', desc: 'Carnaval' },
    { data: '2026-02-17', desc: 'Carnaval' },
    { data: '2026-02-18', desc: 'Quarta de Cinzas' },
    { data: '2026-04-03', desc: 'Sexta-feira Santa' },
    { data: '2026-04-05', desc: 'Páscoa' },
    { data: '2026-04-21', desc: 'Tiradentes' },
    { data: '2026-05-01', desc: 'Dia do Trabalho' },
    { data: '2026-06-04', desc: 'Corpus Christi' },
    { data: '2026-09-07', desc: 'Independência do Brasil' },
    { data: '2026-10-12', desc: 'Nossa Senhora Aparecida' },
    { data: '2026-11-02', desc: 'Finados' },
    { data: '2026-11-15', desc: 'Proclamação da República' },
    { data: '2026-11-20', desc: 'Consciência Negra' },
    { data: '2026-12-25', desc: 'Natal' },
  ];
};

export const GuiasSadt: React.FC = () => {
  const { guias, lazyLoadGuias, pacientes, profissionais, planos, procedimentos, agendamentos, senhas, lazyLoadSenhas, refreshAll, user } = useApp();
  
  const isRecepcao = user?.perfil?.toLowerCase() === 'recepcao' || user?.perfil?.toLowerCase() === 'recepção';

  const isGuiaNoMesVigente = (dataStr?: string) => {
    if (!dataStr) return false;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const s = dataStr.trim();
    if (s.startsWith(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)) {
      return true;
    }
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2].length === 2 ? '20' + parts[2] : parts[2], 10);
        return month === currentMonth && year === currentYear;
      }
    }
    return false;
  };
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [periodoFilter, setPeriodoFilter] = useState<string>(''); // YYYY-MM
  
  // Submenu state
  const [showSubMenu, setShowSubMenu] = useState(false);

  // CRUD Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuia, setEditingGuia] = useState<GuiaSadt | null>(null);

  // Form State for CRUD
  const [num, setNum] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [pac, setPac] = useState('');
  const [carteirinha, setCarteirinha] = useState('');
  const [planoId, setPlanoId] = useState<number>(5);
  const [numOp, setNumOp] = useState('');
  const [senha, setSenha] = useState('');
  const [validadeSenha, setValidadeSenha] = useState('');
  const [dtAut, setDtAut] = useState('');
  const [profId, setProfId] = useState<number>(profissionais[0]?.id || 0);
  const [tipoAtend, setTipoAtend] = useState('03');
  const [indicacao, setIndicacao] = useState('');
  const [cid, setCid] = useState('');
  const [status, setStatus] = useState<'Pendente' | 'Enviado' | 'Pago' | 'Glosado'>('Pendente');
  const [procs, setProcs] = useState<ProcedimentoGuia[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Buscador dinâmico de pacientes para a modal
  const [pacSearchInput, setPacSearchInput] = useState('');
  const [searchedPacList, setSearchedPacList] = useState<Paciente[]>([]);
  const [isSearchingPac, setIsSearchingPac] = useState(false);
  const [showPacDropdown, setShowPacDropdown] = useState(false);

  const handleSearchPaciente = async (overrideTerm?: string) => {
    const term = (overrideTerm !== undefined ? overrideTerm : pacSearchInput).trim();
    if (!term) return;
    setIsSearchingPac(true);
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome', `%${term}%`)
        .order('nome')
        .limit(30);

      if (error) throw error;
      if (data) {
        setSearchedPacList(data.map(mappers.dbToPac));
        setShowPacDropdown(true);
      }
    } catch (err) {
      console.error('Erro ao buscar paciente:', err);
    } finally {
      setIsSearchingPac(false);
    }
  };

  const handleSelectPacienteObj = (p: Paciente) => {
    setPac(p.nome);
    setCarteirinha(p.carteirinha && p.carteirinha !== '—' ? p.carteirinha : '');
    if (p.planoId) {
      setPlanoId(p.planoId);
    }
    setShowPacDropdown(false);
    setPacSearchInput('');
  };

  // 1. Gerar Guias Automáticas Modal States
  const [isGerarModalOpen, setIsGerarModalOpen] = useState(false);
  const [ggMes, setGgMes] = useState('');
  const [ggPlanoId, setGgPlanoId] = useState<number>(0);
  const [ggPaciente, setGgPaciente] = useState('');
  const [ggPreview, setGgPreview] = useState<any[]>([]);
  const [selectedGgIndexes, setSelectedGgIndexes] = useState<Set<number>>(new Set());
  const [generatingAutomicas, setGeneratingAutomicas] = useState(false);
  const [previewingGuias, setPreviewingGuias] = useState(false);
  const [deletingGuiasMes, setDeletingGuiasMes] = useState(false);

  // 2. Validar Guias Modal States
  const [isValidarModalOpen, setIsValidarModalOpen] = useState(false);
  const [validationResults, setValidationResults] = useState<any[]>([]);
  const [valFilter, setValFilter] = useState<'todos' | 'critico' | 'atencao' | 'ok'>('todos');
  const [valSearch, setValSearch] = useState('');

  // 3. Validar Guias com Ajuste Modal States
  const [isValidarAjusteModalOpen, setIsValidarAjusteModalOpen] = useState(false);
  const [vajResults, setVajResults] = useState<any[]>([]);
  const [vajFilter, setVajFilter] = useState<'todos' | 'critico' | 'atencao' | 'ok'>('todos');
  const [vajSubmitting, setVajSubmitting] = useState(false);

  // 4. Exportar XML Modal States
  const [isExportarModalOpen, setIsExportarModalOpen] = useState(false);
  const [exportingXml, setExportingXml] = useState(false);

  useEffect(() => {
    lazyLoadGuias();
    lazyLoadSenhas();
  }, []);

  // Filter logic
  const filteredGuias = guias.filter(g => {
    if (isRecepcao) {
      if (g.status !== 'Pendente') return false;
      if (!isGuiaNoMesVigente(g.data)) return false;
    }
    const matchesSearch = g.pac.toLowerCase().includes(searchQuery.toLowerCase()) || g.num.includes(searchQuery);
    const matchesStatus = statusFilter === 'Todos' || g.status === statusFilter;
    const matchesPeriodo = !periodoFilter || g.data.startsWith(periodoFilter);
    return matchesSearch && matchesStatus && matchesPeriodo;
  });

  // Stats calculation
  const totalVal = filteredGuias.reduce((acc, g) => acc + g.valor, 0);
  const pendentes = filteredGuias.filter(g => g.status === 'Pendente').length;
  const enviadas = filteredGuias.filter(g => g.status === 'Enviado').length;
  const pagas = filteredGuias.filter(g => g.status === 'Pago').length;
  const glosadas = filteredGuias.filter(g => g.status === 'Glosado').length;

  const stats = [
    { label: 'Exibidas', val: filteredGuias.length, color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10' },
    { label: 'Valor Total', val: `R$ ${totalVal.toFixed(2)}`, color: 'text-sky-400 bg-sky-500/5 border-sky-500/10' },
    { label: 'Pendentes', val: pendentes, color: 'text-amber-400 bg-amber-500/5 border-amber-500/10' },
    { label: 'Enviadas', val: enviadas, color: 'text-blue-400 bg-blue-500/5 border-blue-500/10' },
    { label: 'Pagas', val: pagas, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' },
    { label: 'Glosadas', val: glosadas, color: 'text-rose-400 bg-rose-500/5 border-rose-500/10' },
  ];

  // Auto generation engine - senha-based approach
  const handleAutoGenerationPreview = async () => {
    if (!ggMes) {
      alert('Selecione o mês/ano.');
      return;
    }
    setPreviewingGuias(true);
    setGgPreview([]);
    setSelectedGgIndexes(new Set());

    // Defer to next tick so React renders the loading state first
    await new Promise(r => setTimeout(r, 50));

    try {
      const [year, month] = ggMes.split('-').map(Number);
      const isoPrim = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const isoUlt = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const feriados = getFeriados();
      const isFeriado = (d: string) => feriados.some(f => f.data === d);

      const addDays = (d: Date, days: number) => {
        const copy = new Date(d);
        copy.setDate(copy.getDate() + days);
        return copy;
      };
      const dateToISO = (d: Date) => d.toISOString().split('T')[0];

      // Advance date past weekends and holidays
      const proxDiaUtil = (d: Date): Date => {
        let r = new Date(d);
        while (r.getDay() === 0 || r.getDay() === 6 || isFeriado(dateToISO(r))) {
          r = addDays(r, 1);
        }
        return r;
      };

      // Next business day after a given date (skip weekend/holiday)
      const proximoDiaUtil = (d: Date): Date => {
        let r = addDays(d, 1);
        return proxDiaUtil(r);
      };

      // If friday -> skip to monday (3 days ahead), else +2 days util
      const dataGuia2 = (d: Date): Date => {
        const dow = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
        if (dow === 5) {
          // Friday -> next Monday
          return proxDiaUtil(addDays(d, 3));
        }
        // Otherwise next business day +1
        return proximoDiaUtil(d);
      };

      // Senhas do mês: senhas cuja dataAut está dentro do mês selecionado
      const senhasMes = senhas.filter(s => {
        if (ggPlanoId && s.planoId !== ggPlanoId) return false;
        if (ggPaciente && !s.paciente.toLowerCase().includes(ggPaciente.toLowerCase())) return false;
        // Inclui senhas com dataAut no mês OU sem dataAut mas com validade no mês
        const autNoMes = s.dataAut && s.dataAut >= isoPrim && s.dataAut <= isoUlt;
        return autNoMes;
      });

      const parsedCandidates: any[] = [];

      for (const senha of senhasMes) {
        const plano = planos.find(p => p.id === senha.planoId);
        if (!plano) continue;

        // 1. Código do procedimento: campo direto senha.procedimento (prioridade)
        //    Fallback: senha.procs[0].codigo (array legado)
        const senhaCodigo = senha.procedimento || senha.procs?.[0]?.codigo;

        // Busca na tabela procedimentos: plano_id + codigo
        // Ordem: exato (codigo+plano_id) → só codigo → qualquer do plano → primeiro
        const proc = senhaCodigo
          ? (
              procedimentos.find(p => p.codigo === senhaCodigo && p.planoId === senha.planoId) ||
              procedimentos.find(p => p.codigo === senhaCodigo) ||
              procedimentos.find(p => p.planoId === senha.planoId) ||
              procedimentos[0]
            )
          : (
              procedimentos.find(p => p.planoId === senha.planoId) ||
              procedimentos[0]
            );

        const procCod  = senhaCodigo || proc?.codigo || '';
        const procDesc = proc?.desc || '';           // mapper lê r.descricao do banco
        const procVal  = (proc?.valPlano && proc.valPlano > 0) ? proc.valPlano : (proc?.valPart || 0);

        // 2. Busca o agendamento vinculado via senha.agendamentoId
        //    Fallback: primeiro agendamento do paciente
        const agendamento = senha.agendamentoId
          ? agendamentos.find(a => a.id === senha.agendamentoId)
          : agendamentos.find(a =>
              a.paciente.toLowerCase().trim() === senha.paciente.toLowerCase().trim()
            );

        const durMinAppt  = agendamento?.durMin || 60;
        const profIdAppt  = agendamento?.profId || profissionais[0]?.id || null;
        const pacIdAppt   = agendamento?.pacId  || null;

        // 3. Data guia 1 = dataAut ajustada para dia útil
        const autDate = new Date(senha.dataAut + 'T12:00:00');
        const g1Date  = proxDiaUtil(autDate);
        const g1ISO   = dateToISO(g1Date);

        // Verifica duplicata guia 1
        const dup1 = guias.some(g =>
          g.pac.toLowerCase().trim() === senha.paciente.toLowerCase().trim() &&
          g.data === g1ISO &&
          g.planoId === senha.planoId
        );

        // 4. Se qtdAutorizada >= 2, gera guia 2 no próximo dia útil
        let g2ISO: string | null = null;
        let dup2 = false;
        if (senha.qtdAutorizada >= 2) {
          const g2Date   = dataGuia2(g1Date);
          g2ISO = dateToISO(g2Date);
          dup2  = guias.some(g =>
            g.pac.toLowerCase().trim() === senha.paciente.toLowerCase().trim() &&
            g.data === g2ISO &&
            g.planoId === senha.planoId
          );
        }

        const allDup = dup1 && (g2ISO === null || dup2);

        parsedCandidates.push({
          senha,
          plano,
          agendamento,                               // objeto agendamento para pegar .id
          profIdAppt,                                // prof_id do agendamento
          pacIdAppt,                                 // pac_id do agendamento
          pacNomeReal: senha.paciente,
          data1ISO: g1ISO,
          data2ISO: g2ISO,
          procCod,
          procDesc,
          procVal,
          durMin: durMinAppt,
          dup1,
          dup2,
          status: allDup ? 'dup' : 'ok'
        });
      }

      setGgPreview(parsedCandidates);
      setSelectedGgIndexes(new Set(
        parsedCandidates
          .map((_, i) => i)
          .filter(i => parsedCandidates[i].status === 'ok')
      ));
    } finally {
      setPreviewingGuias(false);
    }
  };

  // Delete all guides for the selected month
  const handleDeleteGuiasMes = async () => {
    if (!ggMes) {
      alert('Selecione o mês/ano.');
      return;
    }
    const [year, month] = ggMes.split('-').map(Number);
    const isoPrim = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const isoUlt = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const guiasDoMes = guias.filter(g => g.data >= isoPrim && g.data <= isoUlt);
    if (!guiasDoMes.length) {
      alert('Nenhuma guia encontrada para o mês selecionado.');
      return;
    }

    const confirmado = window.confirm(
      `Tem certeza que deseja excluir ${guiasDoMes.length} guia(s) do mês ${ggMes.split('-').reverse().join('/')}? Esta ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    setDeletingGuiasMes(true);
    try {
      const ids = guiasDoMes.map(g => g.id);
      const { error } = await supabase
        .from('guias_sadt')
        .delete()
        .in('id', ids);
      if (error) throw error;

      setGgPreview([]);
      setSelectedGgIndexes(new Set());
      await refreshAll();
      alert(`${ids.length} guia(s) excluída(s) com sucesso!`);
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir guias do mês.');
    } finally {
      setDeletingGuiasMes(false);
    }
  };

  const handleGenerateConfirm = async () => {
    if (!selectedGgIndexes.size) return;
    setGeneratingAutomicas(true);

    const selecionados = Array.from(selectedGgIndexes).map(idx => ggPreview[idx]);
    let geradas = 0;

    try {
      const keyIncrements = new Map<number, { senha: SenhaPlano; count: number }>();

      for (const r of selecionados) {
        const createGuiaRecord = async (dataISO: string, isDup: boolean) => {
          if (!dataISO || isDup) return;
          const lotNum = `0${Date.now().toString().slice(-6)}`;

          const newGuia = {
            num: lotNum,
            pac: r.pacNomeReal,
            pac_id: r.pacIdAppt || null,
            plano_id: r.plano.id,
            plano: r.plano.nome,
            prof_id: r.profIdAppt || null,
            valor: r.procVal,
            status: 'Pendente',
            data: dataISO,
            carteirinha: r.senha.carteirinha || null,
            num_op: r.senha.numGuiaOp || r.senha.numSenha || null,
            cid: r.senha.cid || null,
            agendamento_id: r.agendamento?.id || null,
            codigo_procedimento: r.procCod || null,
            dados: {
              procs: [{
                qtd: 1,
                desc: r.procDesc,
                total: r.procVal * 1,
                valor: r.procVal,
                codigo: r.procCod
              }],
              senha: r.senha.numSenha || '',
              durMin: r.durMin || 60,
              profExecNome: 'Maria Cecilia Benessuti Donato'
            }
          };

          const { error } = await supabase.from('guias_sadt').insert([newGuia]);
          if (error) throw error;

          const currentCount = keyIncrements.get(r.senha.id)?.count || 0;
          keyIncrements.set(r.senha.id, { senha: r.senha, count: currentCount + 1 });
          geradas++;
        };

        await createGuiaRecord(r.data1ISO, r.dup1);
        if (r.data2ISO) {
          await createGuiaRecord(r.data2ISO, r.dup2);
        }
      }

      // Update password usage balances
      for (const [id, value] of keyIncrements.entries()) {
        const newUsed = (value.senha.qtdUsada || 0) + value.count;
        const newStatus = newUsed >= value.senha.qtdAutorizada ? 'Usada' : 'Ativa';
        await supabase
          .from('senhas_plano')
          .update({ qtd_usada: newUsed, status: newStatus, ativa: newStatus === 'Ativa' })
          .eq('id', id);
      }

      setIsGerarModalOpen(false);
      await refreshAll();
      alert(`Sucesso! ${geradas} guias automáticas geradas com sucesso!`);
    } catch (e) {
      console.error(e);
      alert('Falha ao processar geração automática.');
    } finally {
      setGeneratingAutomicas(false);
    }
  };

  // Validations engine
  const handleValidateGuias = () => {
    const results: any[] = [];
    
    guias.forEach(g => {
      const errors: { field: string; desc: string; type: 'critico' | 'atencao' | 'informativo' }[] = [];

      if (!g.pac || !g.pac.trim()) {
        errors.push({ type: 'critico', field: 'Nome do Paciente', desc: 'Nome do beneficiário não informado.' });
      }
      if (!g.carteirinha || !g.carteirinha.trim() || g.carteirinha === '—') {
        errors.push({ type: 'critico', field: 'Nº da Carteirinha', desc: 'Número da carteirinha do beneficiário ausente.' });
      }
      if (!g.numOp || !g.numOp.trim()) {
        errors.push({ type: 'critico', field: 'Nº Guia Operadora', desc: 'Senha ou número atribuído pelo plano não encontrado.' });
      }
      if (!g.valor || g.valor <= 0) {
        errors.push({ type: 'critico', field: 'Valor da Guia', desc: 'Valor total zerado ou inválido.' });
      }
      if (!g.data) {
        errors.push({ type: 'critico', field: 'Data de Execução', desc: 'Data de execução ausente.' });
      }
      if (!g.profId) {
        errors.push({ type: 'critico', field: 'Profissional Solicitante', desc: 'Profissional não vinculado à guia.' });
      }

      let severity: 'ok' | 'critico' | 'atencao' | 'informativo' = 'ok';
      if (errors.some(e => e.type === 'critico')) severity = 'critico';
      else if (errors.some(e => e.type === 'atencao')) severity = 'atencao';
      else if (errors.some(e => e.type === 'informativo')) severity = 'informativo';

      results.push({ g, errors, severity });
    });

    setValidationResults(results);
    setIsValidarModalOpen(true);
  };

  // Validate with adjustments engine
  const handleValidateWithAdjustments = () => {
    const results: any[] = [];
    
    guias.forEach(g => {
      const errors: { field: string; desc: string; type: 'critico' | 'atencao' | 'informativo'; prop: string }[] = [];

      if (!g.pac || !g.pac.trim()) {
        errors.push({ type: 'critico', field: 'Nome do Paciente', desc: 'Nome ausente.', prop: 'pac' });
      }
      if (!g.carteirinha || !g.carteirinha.trim() || g.carteirinha === '—') {
        errors.push({ type: 'critico', field: 'Nº da Carteirinha', desc: 'Nº carteirinha ausente.', prop: 'carteirinha' });
      }
      if (!g.numOp || !g.numOp.trim()) {
        errors.push({ type: 'critico', field: 'Nº Guia Operadora', desc: 'Nº Guia ausente.', prop: 'numOp' });
      }
      if (!g.valor || g.valor <= 0) {
        errors.push({ type: 'critico', field: 'Valor da Guia', desc: 'Valor zerado.', prop: 'valor' });
      }
      if (!g.data) {
        errors.push({ type: 'critico', field: 'Data de Execução', desc: 'Data ausente.', prop: 'data' });
      }

      let severity: 'ok' | 'critico' | 'atencao' | 'informativo' = 'ok';
      if (errors.some(e => e.type === 'critico')) severity = 'critico';
      else if (errors.some(e => e.type === 'atencao')) severity = 'atencao';
      else if (errors.some(e => e.type === 'informativo')) severity = 'informativo';

      // Clone guide object for mutable states
      results.push({ g: JSON.parse(JSON.stringify(g)), errors, severity, dirty: false });
    });

    setVajResults(results);
    setIsValidarAjusteModalOpen(true);
  };

  const handleUpdateVajField = (idx: number, prop: string, value: any) => {
    const updated = [...vajResults];
    updated[idx].g[prop] = value;
    updated[idx].dirty = true;
    setVajResults(updated);
  };

  const handleSaveVajAdjustments = async () => {
    setVajSubmitting(true);
    try {
      const dirtyItems = vajResults.filter(r => r.dirty);
      for (const item of dirtyItems) {
        const { error } = await supabase
          .from('guias_sadt')
          .update(mappers.guiaToDb(item.g))
          .eq('id', item.g.id);
        if (error) throw error;
      }
      setIsValidarAjusteModalOpen(false);
      await refreshAll();
      alert('Guias ajustadas salvas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar os ajustes.');
    } finally {
      setVajSubmitting(false);
    }
  };

  // Exportar XML engine
  const handleExportXmlClick = () => {
    const pendentes = guias.filter(g => g.status === 'Pendente');
    if (!pendentes.length) {
      alert('Nenhuma guia pendente para exportar.');
      return;
    }
    setIsExportarModalOpen(true);
  };

  const pendingByPlano = () => {
    const pendentes = guias.filter(g => g.status === 'Pendente');
    const grouped: { [key: number]: { planoNome: string; guias: GuiaSadt[]; totalVal: number } } = {};
    
    pendentes.forEach(g => {
      if (!grouped[g.planoId]) {
        grouped[g.planoId] = {
          planoNome: g.plano || planos.find(p => p.id === g.planoId)?.nome || 'Sem Convênio',
          guias: [],
          totalVal: 0
        };
      }
      grouped[g.planoId].guias.push(g);
      grouped[g.planoId].totalVal += g.valor;
    });

    return Object.entries(grouped).map(([planoId, data]) => ({
      planoId: Number(planoId),
      ...data
    }));
  };

  const handleExportXmlConfirm = async () => {
    const groups = pendingByPlano();
    if (!groups.length) return;
    setExportingXml(true);

    try {
      const competencia = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      let lotesCriados = 0;

      for (const group of groups) {
        const lotNum = `L${Date.now().toString().slice(-6)}`;
        const newLote = {
          num: lotNum,
          competencia,
          planoId: group.planoId,
          plano: group.planoNome,
          qtd: group.guias.length,
          valor: group.totalVal,
          status: 'Pendente' as const,
          dataCriacao: new Date().toISOString().split('T')[0],
          obs: 'Lote gerado automaticamente via módulo Guias SADT',
          guiaIds: group.guias.map(g => g.id)
        };

        // 1. Create Lote TISS
        const { data, error } = await supabase
          .from('lotes_tiss')
          .insert([mappers.loteToDb(newLote)])
          .select()
          .single();
        
        if (error) throw error;

        // 2. Update status of the guides included in the batch to 'Enviado' and set their lote_id and lote_num
        const batchId = data.id;
        await Promise.all(
          group.guias.map(g =>
            supabase
              .from('guias_sadt')
              .update({ status: 'Enviado', lote_id: batchId, lote_num: lotNum })
              .eq('id', g.id)
          )
        );
        lotesCriados++;
      }

      setIsExportarModalOpen(false);
      await refreshAll();
      alert(`Sucesso! ${lotesCriados} lote(s) criado(s) com sucesso. As guias foram alteradas para o status 'Enviado'. Você pode baixar os arquivos XML TISS na tela de Lotes TISS.`);
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar XML e gerar lotes.');
    } finally {
      setExportingXml(false);
    }
  };

  // CRUD Operations
  const openAddModal = () => {
    setEditingGuia(null);
    setNum(`0${Date.now().toString().slice(-6)}`);
    setData(new Date().toISOString().split('T')[0]);
    setPac('');
    setCarteirinha('');
    setPlanoId(planos[0]?.id || 5);
    setNumOp('');
    setSenha('');
    setValidadeSenha('');
    setDtAut('');
    setProfId(profissionais[0]?.id || 0);
    setTipoAtend('03');
    setIndicacao('');
    setCid('');
    setStatus('Pendente');
    setProcs([
      {
        codigo: procedimentos[0]?.codigo || '50000470',
        desc: procedimentos[0]?.desc || 'Sessão de Terapia',
        qtd: 1,
        valor: procedimentos[0]?.valPlano || procedimentos[0]?.valPart || 0,
        total: procedimentos[0]?.valPlano || procedimentos[0]?.valPart || 0,
      }
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (g: GuiaSadt) => {
    setEditingGuia(g);
    setNum(g.num);
    setData(g.data);
    setPac(g.pac);
    setCarteirinha(g.carteirinha || '');
    setPlanoId(g.planoId);
    setNumOp(g.numOp || '');
    setSenha(g.dados?.senha || '');
    setValidadeSenha(g.dados?.validade || '');
    setDtAut(g.dados?.dataAut || '');
    setProfId(g.profId);
    setTipoAtend(g.dados?.tipoAtend || '03');
    setIndicacao(g.dados?.indicacao || '');
    setCid(g.cid || '');
    setStatus(g.status);
    setProcs(g.dados?.procs || [
      {
        codigo: procedimentos[0]?.codigo || '50000470',
        desc: procedimentos[0]?.desc || 'Sessão de Terapia',
        qtd: 1,
        valor: g.valor,
        total: g.valor,
      }
    ]);
    setIsModalOpen(true);
  };

  const handlePacienteChange = (val: string) => {
    setPac(val);
    const p = pacientes.find(x => x.nome === val);
    if (p) {
      setCarteirinha(p.carteirinha || '');
      setPlanoId(p.planoId);
    }
  };

  const addProcRow = () => {
    const defaultProc = procedimentos[0];
    setProcs([
      ...procs,
      {
        codigo: defaultProc?.codigo || '50000470',
        desc: defaultProc?.desc || 'Sessão de Terapia',
        qtd: 1,
        valor: defaultProc?.valPlano || defaultProc?.valPart || 0,
        total: defaultProc?.valPlano || defaultProc?.valPart || 0,
      }
    ]);
  };

  const removeProcRow = (idx: number) => {
    if (procs.length > 1) {
      setProcs(procs.filter((_, i) => i !== idx));
    }
  };

  const updateProcRow = (idx: number, field: keyof ProcedimentoGuia, value: any) => {
    const updated = procs.map((p, i) => {
      if (i !== idx) return p;
      const newP = { ...p, [field]: value };
      if (field === 'codigo') {
        const pr = procedimentos.find(x => x.codigo === value);
        if (pr) {
          newP.desc = pr.desc;
          newP.valor = pr.valPlano || pr.valPart || 0;
        }
      }
      newP.total = Number(newP.valor || 0) * Number(newP.qtd || 1);
      return newP;
    });
    setProcs(updated);
  };

  const handleCRUDSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const plano = planos.find(pl => pl.id === Number(planoId))?.nome || 'Particular';

    const payload: Partial<GuiaSadt> = {
      num,
      pac,
      planoId: Number(planoId),
      plano,
      profId: Number(profId),
      valor: totalValue,
      status,
      data,
      carteirinha,
      numOp,
      cid,
      dados: {
        procs,
        senha,
        validade: validadeSenha,
        dataAut: dtAut,
        tipoAtend,
        indicacao,
        total: totalValue
      }
    };

    try {
      if (editingGuia) {
        const { error } = await supabase.from('guias_sadt').update(mappers.guiaToDb(payload)).eq('id', editingGuia.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('guias_sadt').insert([mappers.guiaToDb(payload)]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar guia SADT.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGuia = async (id: number | string, numGuia: string) => {
    if (!confirm(`Deseja realmente excluir a Guia SADT Nº ${numGuia}?`)) return;

    try {
      const { error } = await supabase.from('guias_sadt').delete().eq('id', id);
      if (error) throw error;

      await refreshAll();
      alert(`Guia SADT Nº ${numGuia} excluída com sucesso!`);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir guia SADT: ' + (err?.message || err));
    }
  };

  const handlePrint = (g: GuiaSadt) => {
    const plano = planos.find(p => p.id === g.planoId);
    const prof = profissionais.find(p => p.id === g.profId);
    const pacInfo = pacientes.find(p => p.nome === g.pac);
    
    // Busca objeto de senha correspondente no contexto
    const senhaObj = senhas.find(s => 
      (g.dados?.senha && s.numSenha === g.dados.senha) ||
      (g.numOp && (s.numGuiaOp === g.numOp || s.numSenha === g.numOp)) ||
      (s.paciente.toLowerCase().trim() === g.pac.toLowerCase().trim() && (s.carteirinha === g.carteirinha || !g.carteirinha))
    );

    const valSenha = g.dados?.senha || g.dados?.numSenha || senhaObj?.numSenha || '';
    const valDtValSenha = g.dados?.dtValSenha || g.dados?.validade || senhaObj?.validade || '';
    const valGuiaOp = g.numOp || g.dados?.numGuiaOp || g.dados?.numGuiaPrincipal || senhaObj?.numGuiaOp || '';
    const valGuiaPrincipal = g.dados?.numGuiaPrincipal || valGuiaOp || '';

    // Dados do Profissional Solicitante (Campos 15 a 19)
    const valProfSolicitante = g.dados?.profSolicitante || senhaObj?.profSolicitante || prof?.nome || 'CASSIA MARIA CARVALHO ABRANTES DO AMARAL';
    const valProfSolicitanteConselho = g.dados?.profSolicitanteConselho || senhaObj?.profSolicitanteConselho || prof?.conselho || 'CRM';
    const valProfSolicitanteNumConselho = g.dados?.profSolicitanteNumConselho || senhaObj?.profSolicitanteNumConselho || prof?.num || '73765';
    const valProfSolicitanteUf = g.dados?.profSolicitanteUf || senhaObj?.profSolicitanteUf || prof?.uf || 'SP';
    const valProfSolicitanteCbo = g.dados?.profSolicitanteCbo || senhaObj?.profSolicitanteCbo || prof?.cbo || '225125';

    const listProcs = g.dados?.procs && g.dados.procs.length > 0
      ? g.dados.procs
      : [{ codigo: g.codigoProcedimento || '50000470', desc: 'SESSAO DE PSICOTERAPIA INDIVIDUAL POR PSICOLOGO', qtd: 1, valor: g.valor, total: g.valor }];
    
    const formattedDate = (iso?: string) => {
      if (!iso) return '';
      const clean = iso.split('T')[0].trim();
      if (clean.includes('-')) {
        return clean.split('-').reverse().join('/');
      }
      return clean;
    };

    const isAmil = (plano?.nome || '').toLowerCase().includes('amil');
    const isVivest = (plano?.nome || '').toLowerCase().includes('vivest');

    let logoHtml = '';
    if (plano?.logo) {
      logoHtml = `<img src="${plano.logo}" style="max-height:36px;max-width:150px;object-fit:contain;display:block">`;
    } else if (isAmil) {
      logoHtml = `<div style="display:flex;align-items:center;gap:6px;">
        <div style="font-family:Arial,sans-serif;font-size:24pt;font-weight:900;color:#002b80;letter-spacing:-1px;line-height:1;">amil</div>
      </div>`;
    } else if (isVivest) {
      logoHtml = `<div style="display:flex;align-items:center;gap:4px;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#005a9c"><path d="M12 2L2 22h20L12 2z"/></svg>
        <span style="font-family:Arial,sans-serif;font-size:18pt;font-weight:800;color:#005a9c;">vivest</span>
      </div>`;
    } else {
      logoHtml = `<div style="font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;color:#1e293b;">${plano?.nome || 'Padrão TISS'}</div>`;
    }

    // Linhas de Itens Assistenciais Solicitados (Campos 24-28)
    const reqRowsArr = [];
    for (let i = 0; i < 5; i++) {
      const p = listProcs[i];
      if (p) {
        reqRowsArr.push(`
          <tr>
            <td style="text-align:center;">${(p as any).tabela || '22'}</td>
            <td style="text-align:center;font-family:monospace;font-weight:bold;">${p.codigo || ''}</td>
            <td style="text-align:left;font-weight:bold;padding-left:4px;">${p.desc || ''}</td>
            <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
            <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
          </tr>
        `);
      } else {
        reqRowsArr.push(`
          <tr>
            <td>&nbsp;</td><td></td><td></td><td></td><td></td>
          </tr>
        `);
      }
    }

    // Linhas de Execução / Procedimentos Realizados (Campos 36-47)
    const execRowsArr = [];
    for (let i = 0; i < 5; i++) {
      const p = listProcs[i];
      if (p) {
        execRowsArr.push(`
          <tr>
            <td style="text-align:center;">${formattedDate(g.data)}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;">${(p as any).tabela || '22'}</td>
            <td style="text-align:center;font-family:monospace;font-weight:bold;">${p.codigo || ''}</td>
            <td style="text-align:left;font-weight:bold;padding-left:4px;">${p.desc || ''}</td>
            <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;">C</td>
            <td style="text-align:center;"></td>
            <td style="text-align:right;padding-right:2px;">${p.valor ? p.valor.toFixed(2).replace('.', ',') : '0,00'}</td>
            <td style="text-align:right;font-weight:bold;padding-right:2px;">${(p.total || p.valor || g.valor).toFixed(2).replace('.', ',')}</td>
          </tr>
        `);
      } else {
        execRowsArr.push(`
          <tr>
            <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
          </tr>
        `);
      }
    }

    const nowStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const footerRight = isAmil ? `Impresso em ${nowStr} &nbsp;&nbsp; Página: 1 de 1 &nbsp;&nbsp; Tiss - v4.02.00` : `@2026 Fácil Informática - FacPlan Novo WebPlan - Versão 1.6.9.1-556352`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Guia SADT - ${g.num}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 6.5pt;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 4px;
            -webkit-print-color-adjust: exact;
          }
          .guia-box {
            width: 100%;
            max-width: 200mm;
            margin: 0 auto;
          }
          .sec-title {
            background-color: #d9d9d9;
            font-weight: bold;
            font-size: 6.5pt;
            padding: 2px 4px;
            border: 1px solid #000;
            border-bottom: none;
            text-transform: uppercase;
            letter-spacing: 0.2px;
          }
          table.tiss-tbl {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 2px;
          }
          table.tiss-tbl td, table.tiss-tbl th {
            border: 1px solid #000;
            padding: 1.5px 3px;
            vertical-align: top;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .lbl {
            font-size: 5.5pt;
            font-weight: bold;
            color: #111;
            display: block;
            line-height: 1;
            margin-bottom: 1px;
          }
          .val {
            font-size: 7.5pt;
            font-weight: bold;
            color: #000;
            line-height: 1.1;
            min-height: 9px;
            display: block;
          }
          th.th-hdr {
            background: #e6e6e6;
            font-size: 5.5pt;
            font-weight: bold;
            text-align: center;
            border: 1px solid #000;
            padding: 2px 1px;
          }
          .serial-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1px 12px;
            font-size: 5.5pt;
            padding: 2px;
          }
          .serial-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .footer-line {
            display: flex;
            justify-content: space-between;
            font-size: 5.5pt;
            color: #333;
            margin-top: 3px;
            padding-top: 2px;
            border-top: 1px solid #000;
          }
        </style>
      </head>
      <body>
        <div class="guia-box">
          <!-- HEADER -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:3px;">
            <tr>
              <td style="width: 25%; vertical-align: middle;">${logoHtml}</td>
              <td style="width: 50%; text-align: center; vertical-align: middle;">
                <div style="font-size: 9.5pt; font-weight: bold; text-transform: uppercase; line-height: 1.1;">
                  GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE<br>DIAGNÓSTICO E TERAPIA (SP/SADT)
                </div>
              </td>
              <td style="width: 25%; text-align: right; vertical-align: top;">
                <div style="font-size: 6.5pt; font-weight: bold;">2 - Nº Guia no Prestador</div>
                <div style="font-size: 11pt; font-weight: bold; font-family: monospace;">${g.num}</div>
              </td>
            </tr>
          </table>

          <!-- CAMPOS 1 A 7 -->
          <table class="tiss-tbl">
            <tr>
              <td style="width: 14%;"><span class="lbl">1 - Registro ANS</span><span class="val">${plano?.ans || '315478'}</span></td>
              <td style="width: 36%;"><span class="lbl">3 – Número da Guia Principal</span><span class="val">${valGuiaPrincipal}</span></td>
              <td style="width: 12.5%;"><span class="lbl">4 - Data Autorização</span><span class="val">${formattedDate(g.dados?.dtAut || g.data)}</span></td>
              <td style="width: 12.5%;"><span class="lbl">5 - Senha</span><span class="val">${valSenha}</span></td>
              <td style="width: 12.5%;"><span class="lbl">6 - Validade Senha</span><span class="val">${formattedDate(valDtValSenha)}</span></td>
              <td style="width: 12.5%;"><span class="lbl">7 - Nº Guia Operadora</span><span class="val">${valGuiaOp}</span></td>
            </tr>
          </table>

          <!-- DADOS DO BENEFICIÁRIO -->
          <div class="sec-title">Dados do Beneficiário</div>
          <table class="tiss-tbl">
            <tr>
              <td style="width: 22%;"><span class="lbl">8 - Número da Carteira</span><span class="val">${g.carteirinha || pacInfo?.carteirinha || ''}</span></td>
              <td style="width: 15%;"><span class="lbl">9 - Validade Carteira</span><span class="val">${formattedDate((pacInfo as any)?.valCarteirinha || '31/12/2199')}</span></td>
              <td style="width: 38%;"><span class="lbl">10 - Nome</span><span class="val">${g.pac}</span></td>
              <td style="width: 15%;"><span class="lbl">89 - Nome Social</span><span class="val">${(pacInfo as any)?.nomeSocial || ''}</span></td>
              <td style="width: 10%;"><span class="lbl">12 - Atendimento RN</span><span class="val">${g.dados?.atendRN || 'Não'}</span></td>
            </tr>
          </table>

          <!-- DADOS DO SOLICITANTE -->
          <div class="sec-title">Dados do Solicitante</div>
          <table class="tiss-tbl">
            <tr>
              <td style="width: 20%;"><span class="lbl">13 - Código na Operadora</span><span class="val">${plano?.codPrestador || '405161'}</span></td>
              <td style="width: 80%;" colspan="7"><span class="lbl">14 - Nome do Contratado</span><span class="val">${plano?.nomeContratado || 'MARIA CECILIA B D S PSICOLOGIA LTDA'}</span></td>
            </tr>
            <tr>
              <td style="width: 38%;" colspan="2"><span class="lbl">15 - Nome do Profissional Solicitante</span><span class="val">${valProfSolicitante}</span></td>
              <td style="width: 12%;"><span class="lbl">16 - Conselho</span><span class="val">${valProfSolicitanteConselho}</span></td>
              <td style="width: 14%;"><span class="lbl">17 - Nº Conselho</span><span class="val">${valProfSolicitanteNumConselho}</span></td>
              <td style="width: 6%;"><span class="lbl">18 - UF</span><span class="val">${valProfSolicitanteUf}</span></td>
              <td style="width: 12%;"><span class="lbl">19 - Código CBO</span><span class="val">${valProfSolicitanteCbo}</span></td>
              <td style="width: 18%;"><span class="lbl">20 - Assinatura Profissional Solicitante</span><span class="val"></span></td>
            </tr>
          </table>

          <!-- DADOS DA SOLICITAÇÃO / PROCEDIMENTOS SOLICITADOS -->
          <div class="sec-title">Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados</div>
          <table class="tiss-tbl">
            <tr>
              <td style="width: 25%;"><span class="lbl">21 - Caráter do Atendimento</span><span class="val">${g.dados?.caraterAtend || 'Eletivo'}</span></td>
              <td style="width: 25%;"><span class="lbl">22 - Data da Solicitação</span><span class="val">${formattedDate(g.data)}</span></td>
              <td style="width: 25%;"><span class="lbl">23 - Indicação Clínica</span><span class="val">${g.cid || 'f41'}</span></td>
              <td style="width: 25%;"><span class="lbl">90 - Indicador Cobertura Especial</span><span class="val"></span></td>
            </tr>
          </table>

          <table class="tiss-tbl">
            <thead>
              <tr>
                <th class="th-hdr" style="width: 6%;">24-Tabela</th>
                <th class="th-hdr" style="width: 14%;">25-Código Procedimento</th>
                <th class="th-hdr" style="width: 64%;">26 - Descrição</th>
                <th class="th-hdr" style="width: 8%;">27-Qtde.Solic.</th>
                <th class="th-hdr" style="width: 8%;">28-Qtde.Aut.</th>
              </tr>
            </thead>
            <tbody>
              ${reqRowsArr.join('')}
            </tbody>
          </table>

          <!-- DADOS DO CONTRATADO EXECUTANTE -->
          <div class="sec-title">Dados do Contratado Executante</div>
          <table class="tiss-tbl">
            <tr>
              <td style="width: 20%;"><span class="lbl">29 - Código na Operadora</span><span class="val">${plano?.codPrestador || '405161'}</span></td>
              <td style="width: 60%;"><span class="lbl">30 - Nome do Contratado</span><span class="val">${plano?.nomeContratado || 'MARIA CECILIA B D S PSICOLOGIA LTDA'}</span></td>
              <td style="width: 20%;"><span class="lbl">31 - Código CNES</span><span class="val">${plano?.cnes || '0620904'}</span></td>
            </tr>
          </table>

          <!-- DADOS DO ATENDIMENTO -->
          <div class="sec-title">Dados do Atendimento</div>
          <table class="tiss-tbl">
            <tr>
              <td style="width: 18%;"><span class="lbl">32 - Tipo de Atendimento</span><span class="val">${g.dados?.tipoAtendimento || '(3) TERAPIA'}</span></td>
              <td style="width: 24%;"><span class="lbl">33 - Indicação de Acidente</span><span class="val">${g.dados?.indicacaoAcidente || '(2) OUTROS'}</span></td>
              <td style="width: 20%;"><span class="lbl">34 - Tipo de Consulta</span><span class="val">${g.dados?.tipoConsulta || '(1) PRIMEIRA CONSULTA'}</span></td>
              <td style="width: 18%;"><span class="lbl">35 - Motivo Encerramento</span><span class="val"></span></td>
              <td style="width: 10%;"><span class="lbl">91 - Regime</span><span class="val">(1) Ambulatorial</span></td>
              <td style="width: 10%;"><span class="lbl">92 - Saúde Ocup.</span><span class="val"></span></td>
            </tr>
          </table>

          <!-- DADOS DA EXECUÇÃO / PROCEDIMENTOS E EXAMES REALIZADOS -->
          <div class="sec-title">Dados da Execução / Procedimentos e Exames Realizados</div>
          <table class="tiss-tbl">
            <thead>
              <tr>
                <th class="th-hdr" style="width: 9%;">36-Data</th>
                <th class="th-hdr" style="width: 6%;">37-Hora Ini</th>
                <th class="th-hdr" style="width: 6%;">38-Hora Fim</th>
                <th class="th-hdr" style="width: 5%;">39-Tab</th>
                <th class="th-hdr" style="width: 11%;">40-Código</th>
                <th class="th-hdr" style="width: 35%;">41-Descrição</th>
                <th class="th-hdr" style="width: 5%;">42-Qtde</th>
                <th class="th-hdr" style="width: 4%;">43-Via</th>
                <th class="th-hdr" style="width: 4%;">44-Tec</th>
                <th class="th-hdr" style="width: 4%;">45-Fator</th>
                <th class="th-hdr" style="width: 5.5%;">46-Valor Unit</th>
                <th class="th-hdr" style="width: 5.5%;">47-Valor Total</th>
              </tr>
            </thead>
            <tbody>
              ${execRowsArr.join('')}
            </tbody>
          </table>

          <!-- IDENTIFICAÇÃO DO PROFISSIONAL EXECUTANTE -->
          <div class="sec-title">Identificação do(s) Profissional(is) Executante(s)</div>
          <table class="tiss-tbl">
            <thead>
              <tr>
                <th class="th-hdr" style="width: 5%;">48-Seq</th>
                <th class="th-hdr" style="width: 6%;">49-Grau</th>
                <th class="th-hdr" style="width: 15%;">50-CPF / Código Operadora</th>
                <th class="th-hdr" style="width: 40%;">51-Nome do Profissional</th>
                <th class="th-hdr" style="width: 10%;">52-Conselho</th>
                <th class="th-hdr" style="width: 12%;">53-Número Conselho</th>
                <th class="th-hdr" style="width: 4%;">54-UF</th>
                <th class="th-hdr" style="width: 8%;">55-CBO</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:center;">1</td>
                <td style="text-align:center;"></td>
                <td style="text-align:center;">${(prof as any)?.cpf || ''}</td>
                <td style="font-weight:bold;">${prof?.nome || 'MARIA CECILIA BENESSUTI DONATO'}</td>
                <td style="text-align:center;">${prof?.conselho || 'CRP'}</td>
                <td style="text-align:center;">${prof?.num || ''}</td>
                <td style="text-align:center;">${prof?.uf || 'SP'}</td>
                <td style="text-align:center;">${prof?.cbo || '251510'}</td>
              </tr>
              <tr><td style="text-align:center;">2</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            </tbody>
          </table>

          <!-- PROCEDIMENTOS EM SÉRIE -->
          <table class="tiss-tbl">
            <tr>
              <td style="background:#fff; padding:1px 3px;">
                <span class="lbl">56-Data de Realização de Procedimentos em Série &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 57-Assinatura do Beneficiário ou Responsável</span>
                <div class="serial-grid">
                  <div class="serial-item"><span>1 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>3 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>2 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>4 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>5 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>7 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>6 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>8 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>9 - __/__/____</span><span>_________________________________________</span></div>
                  <div class="serial-item"><span>10 - __/__/____</span><span>________________________________________</span></div>
                </div>
              </td>
            </tr>
          </table>

          <!-- OBSERVAÇÃO / JUSTIFICATIVA -->
          <table class="tiss-tbl">
            <tr>
              <td style="padding: 2px 3px;">
                <span class="lbl">58 - Observação / Justificativa</span>
                <span class="val" style="font-size: 6pt; font-family: monospace; font-weight: normal;">
                  Senha FacPlan ( ${valSenha || '—'} ) - Validade: ( ${formattedDate(valDtValSenha) || '—'} ) - LIBERAÇÃO REG. SERVIÇO : G.'${valGuiaOp || g.num}' PRES: '${g.num}' TELEFONE DO LOCAL DE ATENDIMENTO: 11 - 4586-8755
                </span>
              </td>
            </tr>
          </table>

          <!-- TOTAIS -->
          <table class="tiss-tbl">
            <tr>
              <td><span class="lbl">59 - Total Procedimentos</span><span class="val">R$ ${g.valor.toFixed(2).replace('.', ',')}</span></td>
              <td><span class="lbl">60 - Total Taxas/Aluguéis</span><span class="val">R$ 0,00</span></td>
              <td><span class="lbl">61 - Total Materiais</span><span class="val">R$ 0,00</span></td>
              <td><span class="lbl">62 - Total OPME</span><span class="val">R$ 0,00</span></td>
              <td><span class="lbl">63 - Total Medicamentos</span><span class="val">R$ 0,00</span></td>
              <td><span class="lbl">64 - Total Gases</span><span class="val">R$ 0,00</span></td>
              <td style="background:#f0f0f0;"><span class="lbl">65 - Total Geral</span><span class="val">R$ ${g.valor.toFixed(2).replace('.', ',')}</span></td>
            </tr>
          </table>

          <!-- ASSINATURAS FINAIS -->
          <table class="tiss-tbl" style="margin-bottom: 2px;">
            <tr style="height: 26px; vertical-align: top;">
              <td style="width: 33%;"><span class="lbl">66 - Assinatura Responsável Autorização</span></td>
              <td style="width: 34%;"><span class="lbl">67 - Assinatura Beneficiário ou Responsável</span></td>
              <td style="width: 33%;"><span class="lbl">68 - Assinatura do Contratado</span></td>
            </tr>
          </table>

          <!-- FOOTER -->
          <div class="footer-line">
            <div>Guia SP/SADT &nbsp; | &nbsp; ${g.num}</div>
            <div>${footerRight}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'width=1000,height=800');
    if (win) {
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch (e) {
          console.error(e);
        }
      }, 500);
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `guia_sadt_${g.num}.html`;
      a.click();
    }
  };

  const totalValue = procs.reduce((acc, p) => acc + (p.total || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      
      {/* STICKY HEADER AND FILTERS */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans font-semibold">Módulo Faturamento</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Guias SADT</h2>
            <p className="text-xs text-slate-400 mt-1">Gerencie guias de autorizações para consultas e sessões de terapia</p>
          </div>
          <div className="flex gap-2 relative">
            
            {/* Action Submenu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSubMenu(!showSubMenu)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 rounded-xl font-bold border border-white/[0.06] transition-all"
              >
                <Settings size={14} />
                Ações de Faturamento
                <ChevronDown size={14} />
              </button>
              {showSubMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0f111a] border border-white/[0.08] shadow-2xl z-50 py-1 overflow-hidden animate-fade-in">
                  <button
                    type="button"
                    onClick={() => { setShowSubMenu(false); setIsGerarModalOpen(true); }}
                    className="w-full text-left px-4 py-2 hover:bg-white/[0.03] text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Sparkles size={13} className="text-indigo-400" />
                    Gerar Guias Automáticas
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSubMenu(false); handleExportXmlClick(); }}
                    className="w-full text-left px-4 py-2 hover:bg-white/[0.03] text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <FileText size={13} className="text-emerald-400" />
                    Exportar XML
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSubMenu(false); handleValidateGuias(); }}
                    className="w-full text-left px-4 py-2 hover:bg-white/[0.03] text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <ShieldAlert size={13} className="text-amber-400" />
                    Validar Guias
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSubMenu(false); handleValidateWithAdjustments(); }}
                    className="w-full text-left px-4 py-2 hover:bg-white/[0.03] text-slate-300 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Edit3 size={13} className="text-sky-400" />
                    Validar com Ajustes
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={openAddModal}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
              <Plus size={16} />
              Nova Guia SADT
            </button>
          </div>
        </div>

        {/* INDICATORS SECTION */}
        {!isRecepcao && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {stats.map((s, idx) => (
              <div key={idx} className={`p-4 rounded-xl border ${s.color} backdrop-blur-md shadow-lg`}>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-black mt-1 text-white">{s.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* FILTERS BAR */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl">
          <div className="flex items-center gap-3 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por paciente ou guia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 text-xs"
            />
          </div>

          <div>
            <select
              value={isRecepcao ? 'Pendente' : statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              disabled={isRecepcao}
              className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none disabled:opacity-60 cursor-pointer"
            >
              {isRecepcao ? (
                <option value="Pendente">Status: Pendente (Recepção)</option>
              ) : (
                <>
                  <option value="Todos">— Todos os Status —</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Pago">Pago</option>
                  <option value="Glosado">Glosado</option>
                </>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1">
            <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">Emissão:</span>
            <input
              type="month"
              value={isRecepcao ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` : periodoFilter}
              onChange={(e) => setPeriodoFilter(e.target.value)}
              disabled={isRecepcao}
              className="flex-1 bg-transparent border-0 text-slate-200 focus:outline-none text-xs disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-[#131622]">
                <th className="p-4">Nº Guia</th>
                <th className="p-4">Paciente</th>
                <th className="p-4">Convênio</th>
                <th className="p-4">Data Emissão</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Lote TISS</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredGuias.map((g) => (
                <tr key={g.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 font-mono font-bold text-slate-200">{g.num}</td>
                  <td className="p-4 font-semibold text-slate-200 group-hover:text-indigo-400 transition-all">{g.pac}</td>
                  <td className="p-4 text-slate-300">{g.plano}</td>
                  <td className="p-4 font-mono text-slate-400">{g.data.split('-').reverse().join('/')}</td>
                  <td className="p-4 font-mono text-slate-200 font-semibold">R$ {g.valor.toFixed(2)}</td>
                  <td className="p-4 font-mono text-slate-400">{g.loteNum || 'Pendente'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                      g.status === 'Pago'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                        : g.status === 'Enviado'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                        : g.status === 'Glosado'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                    }`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="p-4 text-center flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEditModal(g)}
                      className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                      title="Editar Guia"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={() => handlePrint(g)}
                      className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                      title="Imprimir Guia"
                    >
                      <Printer size={11} />
                    </button>
                    <button
                      onClick={() => handleDeleteGuia(g.id, g.num)}
                      className="p-1.5 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg transition-all"
                      title="Excluir Guia"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredGuias.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhuma guia SADT encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingGuia ? 'Editar Guia SADT' : 'Nova Guia SADT'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleCRUDSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Guia Operadora / Prestador</label>
                  <input
                    type="text"
                    required
                    value={num}
                    onChange={(e) => setNum(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data do Atendimento</label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-slate-400 font-semibold mb-1">Beneficiário (Paciente) *</label>

                  {/* Buscador no banco (Supabase) */}
                  <div className="flex gap-1.5 mb-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={pacSearchInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPacSearchInput(val);
                          if (val.trim().length >= 2) {
                            handleSearchPaciente(val);
                          } else {
                            setShowPacDropdown(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSearchPaciente();
                          }
                        }}
                        placeholder="Buscar paciente no banco..."
                        className="w-full bg-[#161a26] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                      />
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSearchPaciente()}
                      disabled={isSearchingPac}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      {isSearchingPac ? '...' : 'Buscar'}
                    </button>
                  </div>

                  {/* Popover com resultados da busca no Supabase */}
                  {showPacDropdown && searchedPacList.length > 0 && (
                    <div className="absolute top-14 left-0 right-0 z-50 max-h-52 overflow-y-auto bg-[#131622] border border-indigo-500/40 rounded-xl shadow-2xl divide-y divide-white/[0.04]">
                      {searchedPacList.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPacienteObj(p)}
                          className="w-full text-left px-3 py-2 hover:bg-indigo-600/25 text-xs transition-colors flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span className="font-bold text-white">{p.nome}</span>
                          <span className="text-[10px] text-slate-400">
                            Carteirinha: <strong className="text-indigo-300">{p.carteirinha || '—'}</strong> | Plano: <strong className="text-slate-300">{p.plano || 'Particular'}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Dropdown com a lista carregada e o paciente selecionado */}
                  <select
                    value={pac}
                    onChange={(e) => handlePacienteChange(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                    required
                  >
                    <option value="">— Selecione ou busque acima —</option>
                    {pac && (
                      <option value={pac}>{pac}</option>
                    )}
                    {pacientes.filter(p => p.status === 'Ativo').map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                  </select>

                  {pac && (
                    <div className="mt-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <span>✓ Selecionado:</span>
                      <span className="text-white font-semibold">{pac}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                  <input
                    type="text"
                    value={carteirinha}
                    onChange={(e) => setCarteirinha(e.target.value)}
                    placeholder="000000000000000"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde *</label>
                  <select
                    value={planoId}
                    onChange={(e) => setPlanoId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Guia Operadora (Opcional)</label>
                  <input
                    type="text"
                    value={numOp}
                    onChange={(e) => setNumOp(e.target.value)}
                    placeholder="Nº atribuído pelo plano"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Senha / Autorização</label>
                  <input
                    type="text"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Número da senha autorizada"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Validade da Senha</label>
                  <input
                    type="date"
                    value={validadeSenha}
                    onChange={(e) => setValidadeSenha(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data Autorização</label>
                  <input
                    type="date"
                    value={dtAut}
                    onChange={(e) => setDtAut(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo de Atendimento</label>
                  <select
                    value={tipoAtend}
                    onChange={(e) => setTipoAtend(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="03">Outras terapias-3</option>
                    <option value="01">Consulta-1</option>
                    <option value="08">Fonoterapia-8</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Profissional Executante *</label>
                  <select
                    value={profId}
                    onChange={(e) => setProfId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    {profissionais.filter(p => p.status === 'Ativo').map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">CID-10</label>
                  <input
                    type="text"
                    value={cid}
                    onChange={(e) => setCid(e.target.value)}
                    placeholder="Ex: F80.0"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Indicação Clínica / CID Completo</label>
                <input
                  type="text"
                  value={indicacao}
                  onChange={(e) => setIndicacao(e.target.value)}
                  placeholder="Ex: F80.0 — Transtorno da articulação"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                />
              </div>

              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block pt-2 border-t border-white/[0.02]">Procedimentos SADT</div>
              
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 animate-fade-in">
                {procs.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-3">
                      <select
                        value={p.codigo}
                        onChange={(e) => updateProcRow(idx, 'codigo', e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white font-mono focus:outline-none"
                      >
                        {procedimentos.map(pr => (
                          <option key={pr.id} value={pr.codigo}>{pr.codigo}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={p.desc}
                        onChange={(e) => updateProcRow(idx, 'desc', e.target.value)}
                        placeholder="Descrição"
                        className="w-full bg-[#161a26]/40 border border-white/[0.06] rounded-lg px-2 py-1.5 text-white"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        min={1}
                        value={p.qtd}
                        onChange={(e) => updateProcRow(idx, 'qtd', Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-1 py-1.5 text-white text-center font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={p.valor}
                        onChange={(e) => updateProcRow(idx, 'valor', Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-1 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeProcRow(idx)}
                        disabled={procs.length <= 1}
                        className="text-slate-500 hover:text-red-400 font-bold text-sm disabled:opacity-30"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addProcRow}
                className="w-full py-1.5 border border-dashed border-white/[0.08] hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-xl font-semibold text-slate-400 hover:text-indigo-400 transition-all animate-fade-in"
              >
                + Adicionar Procedimento
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status da Guia</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Pago">Pago</option>
                    <option value="Glosado">Glosado</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end items-end p-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-semibold">Valor Total da Guia</span>
                  <span className="text-lg font-black text-indigo-400 mt-1">R$ {totalValue.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-between items-center">
                {editingGuia ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      handleDeleteGuia(editingGuia.id, editingGuia.num);
                    }}
                    className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 size={13} />
                    Excluir Guia
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                  >
                    Cancelar
                  </button>
                  {editingGuia && (
                    <button
                      type="button"
                      onClick={() => handlePrint(editingGuia)}
                      className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-white font-bold flex items-center gap-1.5"
                    >
                      <Printer size={13} />
                      Imprimir
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. GERAR GUIAS AUTOMÁTICAS MODAL */}
      {isGerarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-8 relative">

            {/* Loading overlay */}
            {(previewingGuias || generatingAutomicas || deletingGuiasMes) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f111a]/90 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
                    <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-violet-400 animate-spin" style={{animationDirection:'reverse',animationDuration:'0.7s'}}></div>
                  </div>
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">
                      {previewingGuias ? 'Calculando pré-visualização...' : deletingGuiasMes ? 'Excluindo guias do mês...' : 'Gerando guias...'}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      {previewingGuias ? 'Processando senhas e autorizações do período' : deletingGuiasMes ? 'Removendo registros do banco de dados' : 'Inserindo registros no banco de dados'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">⚡ Gerar Guias Automáticas</h3>
              <button type="button" onClick={() => { if (!previewingGuias && !generatingAutomicas && !deletingGuiasMes) setIsGerarModalOpen(false); }} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-4 p-4 bg-[#161a26]/40 rounded-xl border border-white/[0.04]">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Mês / Ano</label>
                  <input
                    type="month"
                    value={ggMes}
                    onChange={(e) => { setGgMes(e.target.value); setGgPreview([]); }}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde</label>
                  <select
                    value={ggPlanoId}
                    onChange={(e) => setGgPlanoId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="0">Todos os planos</option>
                    {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Paciente (Opcional)</label>
                  <input
                    type="text"
                    value={ggPaciente}
                    onChange={(e) => setGgPaciente(e.target.value)}
                    placeholder="Filtrar por nome"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAutoGenerationPreview}
                  disabled={previewingGuias || generatingAutomicas || deletingGuiasMes || !ggMes}
                  className="flex-1 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {previewingGuias ? <><Loader size={13} className="animate-spin" /> Calculando...</> : <><Sparkles size={13} /> Pré-visualizar Guias do Período</>}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGuiasMes}
                  disabled={previewingGuias || generatingAutomicas || deletingGuiasMes || !ggMes}
                  title="Excluir todas as guias do mês selecionado"
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deletingGuiasMes ? <Loader size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Excluir Guias do Mês
                </button>
              </div>

              {ggMes && !previewingGuias && ggPreview.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-sm">
                  <Sparkles size={28} className="mx-auto mb-2 opacity-30" />
                  Clique em "Pré-visualizar" para calcular as guias a partir das senhas e autorizações do mês.
                </div>
              )}

              {ggPreview.length > 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-semibold">{ggPreview.length} senha(s) processada(s) · {ggPreview.filter(c => c.status === 'ok').length} apta(s) · {ggPreview.filter(c => c.status === 'dup').length} duplicada(s)</span>
                    <span className="text-slate-500 text-xs">{selectedGgIndexes.size} selecionada(s)</span>
                  </div>
                  <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#131622]/20">
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/[0.01] border-b border-white/[0.04] text-slate-400 text-[9px] uppercase tracking-wider font-bold">
                            <th className="p-3 w-8">
                              <input
                                type="checkbox"
                                checked={selectedGgIndexes.size === ggPreview.filter(c => c.status === 'ok').length && ggPreview.filter(c => c.status === 'ok').length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGgIndexes(new Set(ggPreview.map((_, i) => i).filter(i => ggPreview[i].status === 'ok')));
                                  } else {
                                    setSelectedGgIndexes(new Set());
                                  }
                                }}
                                className="rounded bg-[#161a26] border-white/[0.06] text-indigo-600"
                              />
                            </th>
                            <th className="p-3">Paciente</th>
                            <th className="p-3">Plano / Autorização</th>
                            <th className="p-3">Qtd Aut.</th>
                            <th className="p-3 text-center">Data Guia 1</th>
                            <th className="p-3 text-center">Data Guia 2</th>
                            <th className="p-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02] text-[11px] text-slate-300">
                          {ggPreview.map((c, idx) => (
                            <tr key={idx} className={`hover:bg-white/[0.01] ${c.status === 'dup' ? 'opacity-50' : ''}`}>
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={selectedGgIndexes.has(idx)}
                                  disabled={c.status === 'dup'}
                                  onChange={(e) => {
                                    const next = new Set(selectedGgIndexes);
                                    if (e.target.checked) next.add(idx);
                                    else next.delete(idx);
                                    setSelectedGgIndexes(next);
                                  }}
                                  className="rounded bg-[#161a26] border-white/[0.06] text-indigo-600"
                                />
                              </td>
                              <td className="p-3 font-semibold">{c.pacNomeReal}</td>
                              <td className="p-3 font-mono text-[10px]">{c.plano.nome} / <span className="text-indigo-300">{c.senha.numSenha || '—'}</span></td>
                              <td className="p-3 text-center text-slate-400">{c.senha.qtdAutorizada}</td>
                              <td className="p-3 text-center font-mono">{c.data1ISO.split('-').reverse().join('/')}{c.dup1 ? ' ⚠️' : ''}</td>
                              <td className="p-3 text-center font-mono">{c.data2ISO ? `${c.data2ISO.split('-').reverse().join('/')}${c.dup2 ? ' ⚠️' : ''}` : '—'}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  c.status === 'dup' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                                }`}>
                                  {c.status === 'dup' ? 'Duplicada' : 'Apta'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setIsGerarModalOpen(false)}
                      className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={generatingAutomicas || !selectedGgIndexes.size}
                      onClick={handleGenerateConfirm}
                      className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {generatingAutomicas && <Loader size={12} className="animate-spin" />}
                      Gerar Guias Selecionadas ({selectedGgIndexes.size})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. VALIDAR GUIAS MODAL */}
      {isValidarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-8 animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">🔍 Relatório de Validação</h3>
              <button type="button" onClick={() => setIsValidarModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex gap-2 border-b border-white/[0.04] pb-4">
                <button
                  onClick={() => setValFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${valFilter === 'todos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Todas ({validationResults.length})
                </button>
                <button
                  onClick={() => setValFilter('critico')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${valFilter === 'critico' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Risco Crítico ({validationResults.filter(r => r.severity === 'critico').length})
                </button>
                <button
                  onClick={() => setValFilter('atencao')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${valFilter === 'atencao' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Atenção ({validationResults.filter(r => r.severity === 'atencao').length})
                </button>
                <button
                  onClick={() => setValFilter('ok')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${valFilter === 'ok' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Aprovadas ({validationResults.filter(r => r.severity === 'ok').length})
                </button>
              </div>

              <div className="space-y-4">
                {validationResults
                  .filter(r => valFilter === 'todos' || r.severity === valFilter)
                  .map((res, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${
                      res.severity === 'critico' ? 'border-rose-500/20 bg-rose-500/5' :
                      res.severity === 'atencao' ? 'border-amber-500/20 bg-amber-500/5' :
                      'border-emerald-500/20 bg-emerald-500/5'
                    } space-y-2`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{res.g.pac}</span>
                        <span className="font-mono text-slate-400 text-[10px]">Guia #{res.g.num}</span>
                      </div>
                      <div className="space-y-1">
                        {res.errors.length ? res.errors.map((e: any, idx: number) => (
                          <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                            <span className="text-rose-400 font-bold">•</span>
                            <span className="font-semibold text-slate-400">{e.field}:</span> {e.desc}
                          </div>
                        )) : (
                          <div className="text-emerald-400 text-[11px] font-semibold">✓ Nenhum erro encontrado. Guia válida para exportação.</div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VALIDAR GUIAS COM AJUSTE MODAL */}
      {isValidarAjusteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden my-8 animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">✏️ Ajuste Rápido de Guias</h3>
              <button type="button" onClick={() => setIsValidarAjusteModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="flex gap-2 border-b border-white/[0.04] pb-4">
                <button
                  onClick={() => setVajFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${vajFilter === 'todos' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Todas ({vajResults.length})
                </button>
                <button
                  onClick={() => setVajFilter('critico')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${vajFilter === 'critico' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Com Pendências Críticas ({vajResults.filter(r => r.severity === 'critico').length})
                </button>
              </div>

              <div className="space-y-6 divide-y divide-white/[0.04]">
                {vajResults
                  .filter(r => vajFilter === 'todos' || r.severity === vajFilter)
                  .map((res, idx) => (
                    <div key={idx} className="pt-6 first:pt-0 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-400 text-xs">{res.g.pac} (Guia #{res.g.num})</span>
                        {res.dirty && <span className="text-[10px] text-amber-400 font-semibold italic">Pendência modificada</span>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Nome do Paciente</label>
                          <input
                            type="text"
                            value={res.g.pac}
                            onChange={(e) => handleUpdateVajField(idx, 'pac', e.target.value)}
                            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                          <input
                            type="text"
                            value={res.g.carteirinha || ''}
                            onChange={(e) => handleUpdateVajField(idx, 'carteirinha', e.target.value)}
                            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Nº Guia Operadora / Autorização</label>
                          <input
                            type="text"
                            value={res.g.numOp || ''}
                            onChange={(e) => handleUpdateVajField(idx, 'numOp', e.target.value)}
                            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Valor Unitário</label>
                          <input
                            type="number"
                            step="0.01"
                            value={res.g.valor}
                            onChange={(e) => handleUpdateVajField(idx, 'valor', Number(e.target.value))}
                            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex justify-end gap-2 pt-6 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsValidarAjusteModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={vajSubmitting || !vajResults.some(r => r.dirty)}
                  onClick={handleSaveVajAdjustments}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {vajSubmitting && <Loader size={12} className="animate-spin" />}
                  Salvar Ajustes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. EXPORTAR XML / GERAR LOTES AUTOMÁTICOS MODAL */}
      {isExportarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8 animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">📦 Exportar XML - Criar Lote Automático</h3>
              <button type="button" onClick={() => setIsExportarModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-xs">
                As seguintes guias pendentes foram encontradas e serão agrupadas em lotes por convênio para exportação no padrão TISS XML:
              </p>

              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#131622]/20 divide-y divide-white/[0.04]">
                {pendingByPlano().map((group) => (
                  <div key={group.planoId} className="p-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-white block">{group.planoNome}</span>
                      <span className="text-[10px] text-slate-400">{group.guias.length} guia(s) pendente(s)</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">R$ {group.totalVal.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsExportarModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={exportingXml}
                  onClick={handleExportXmlConfirm}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {exportingXml && <Loader size={12} className="animate-spin" />}
                  Gerar Lotes e Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
