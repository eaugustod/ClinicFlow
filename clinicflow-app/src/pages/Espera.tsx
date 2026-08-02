import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, CheckCircle2, XCircle, Edit3, Trash2, Calendar, Watch, Sparkles, Filter, Users, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ListaEspera } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

const ESPECIALIDADES_OPCOES = [
  'AN',
  'Psicologia',
  'Fonoterapia',
  'Terapia Ocupacional',
  'ABA',
  'Psicopedagogia',
  'Musicoterapia'
];

const DIAS_OPCOES = [
  { full: 'Segunda', short: 'Seg' },
  { full: 'Terça', short: 'Ter' },
  { full: 'Quarta', short: 'Qua' },
  { full: 'Quinta', short: 'Qui' },
  { full: 'Sexta', short: 'Sex' },
  { full: 'Sábado', short: 'Sáb' }
];

const PERIODOS_OPCOES = [
  'Manhã (08h-12h)',
  'Tarde (12h-18h)',
  'Noite (18h-21h)',
  'Online'
];

export const Espera: React.FC = () => {
  const { espera, lazyLoadEspera, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [especialidadeFiltro, setEspecialidadeFiltro] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ListaEspera | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [idade, setIdade] = useState('');
  const [periodo, setPeriodo] = useState('Ambos');
  const [dias, setDias] = useState<string[]>([]);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [obs, setObs] = useState('');
  const [plano, setPlano] = useState('Particular');
  const [carteirinha, setCarteirinha] = useState('');

  useEffect(() => {
    lazyLoadEspera();
  }, []);

  const extractAnoMes = (dtStr?: string) => {
    if (!dtStr) return '';
    const s = dtStr.trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const ano = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const mes = parts[1].padStart(2, '0');
        return `${ano}-${mes}`;
      }
    }
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}`;
      }
    }
    return '';
  };

  const mesesDisponiveis = Array.from(new Set(
    espera.map(e => extractAnoMes(e.dataCadastro || e.dataEntrada)).filter(Boolean)
  )).sort().reverse();

  const formatDataBr = (str?: string) => {
    if (!str) return '—';
    const s = str.trim();
    if (s.includes('/')) return s;
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD
        if (parts[2].length === 4) return `${parts[0]}/${parts[1]}/${parts[2]}`; // DD-MM-YYYY
      }
    }
    return s;
  };

  const formatTelefone = (telStr?: string) => {
    if (!telStr) return '—';
    const clean = telStr.replace(/\D/g, '');
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    }
    if (clean.length === 10) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
    }
    return telStr;
  };

  const parseDateToTimestamp = (e: ListaEspera) => {
    const dtStr = e.dataCadastro || e.dataEntrada;
    if (!dtStr) return e.id || 0;
    const s = dtStr.trim();
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const ts = new Date(`${year}-${month}-${day}`).getTime();
        return isNaN(ts) ? e.id || 0 : ts;
      }
    }
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        let yyyy = parts[0];
        let mm = parts[1];
        let dd = parts[2];
        if (parts[2].length === 4) {
          yyyy = parts[2];
          dd = parts[0];
        }
        const ts = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`).getTime();
        return isNaN(ts) ? e.id || 0 : ts;
      }
    }
    return e.id || 0;
  };

  const filteredEspera = espera.filter(e => {
    if (mesFiltro) {
      const ym = extractAnoMes(e.dataCadastro || e.dataEntrada);
      if (ym !== mesFiltro) return false;
    }
    if (especialidadeFiltro) {
      if (!e.especialidade || !e.especialidade.toLowerCase().includes(especialidadeFiltro.toLowerCase())) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        e.nome.toLowerCase().includes(q) ||
        (e.tel && e.tel.includes(q)) ||
        (e.especialidade && e.especialidade.toLowerCase().includes(q)) ||
        (e.periodo && e.periodo.toLowerCase().includes(q)) ||
        (e.plano && e.plano.toLowerCase().includes(q)) ||
        (e.dias && e.dias.some(d => d.toLowerCase().includes(q)));
      if (!match) return false;
    }
    return true;
  }).sort((a, b) => {
    const timeA = parseDateToTimestamp(a);
    const timeB = parseDateToTimestamp(b);
    if (timeA !== timeB) return timeB - timeA; // Descending order (most recent first)
    return (b.id || 0) - (a.id || 0); // Fallback by ID descending
  });

  const toggleEspecialidade = (spec: string) => {
    setEspecialidades(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
  };

  const toggleDia = (diaFull: string) => {
    setDias(prev => prev.includes(diaFull) ? prev.filter(d => d !== diaFull) : [...prev, diaFull]);
  };

  const togglePeriodo = (pStr: string) => {
    setPeriodos(prev => prev.includes(pStr) ? prev.filter(x => x !== pStr) : [...prev, pStr]);
  };

  const openAddModal = () => {
    setEditingItem(null);
    setNome('');
    setTel('');
    setEmail('');
    setEspecialidades([]);
    setIdade('');
    setPeriodo('Ambos');
    setDias([]);
    setPeriodos([]);
    setObs('');
    setPlano('Particular');
    setCarteirinha('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: ListaEspera) => {
    setEditingItem(item);
    setNome(item.nome || '');
    setTel(item.tel || '');
    setEmail(item.email || '');

    // Parse item.especialidade into array if string
    const rawSpec = item.especialidade || '';
    const parsedSpecs = rawSpec
      .split(/[,/]+/)
      .map(s => s.trim())
      .filter(Boolean);
    setEspecialidades(parsedSpecs);

    setIdade(item.idade || '');
    setPeriodo(item.periodo || 'Ambos');
    setDias(Array.isArray(item.dias) ? item.dias : []);
    setPeriodos(Array.isArray(item.periodos) ? item.periodos : []);
    setObs(item.obs || '');
    setPlano(item.plano || 'Particular');
    setCarteirinha(item.carteirinha || '');
    setIsModalOpen(true);
  };

  const handleStatusChange = async (item: ListaEspera, newStatus: 'Aguardando' | 'Convertido' | 'Cancelado') => {
    try {
      const { error } = await supabase
        .from('lista_espera')
        .update({ status: newStatus })
        .eq('id', item.id);
      if (error) throw error;
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status.');
    }
  };

  const handleDelete = async (item: ListaEspera) => {
    if (!confirm(`Deseja realmente remover o paciente ${item.nome} da lista de espera?`)) return;
    try {
      const { error } = await supabase
        .from('lista_espera')
        .delete()
        .eq('id', item.id);
      if (error) throw error;
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Erro ao remover paciente da lista.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const especialidadeString = especialidades.join(', ');

    const payload: Partial<ListaEspera> = {
      nome,
      tel,
      email,
      especialidade: especialidadeString,
      idade,
      periodo,
      dias,
      periodos,
      obs,
      plano,
      carteirinha,
      status: editingItem ? editingItem.status : 'Aguardando',
      dataEntrada: editingItem ? editingItem.dataEntrada : new Date().toLocaleDateString('pt-BR'),
      dataCadastro: editingItem ? editingItem.dataCadastro : new Date().toLocaleDateString('pt-BR')
    };

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('lista_espera')
          .update(mappers.esperaToDb(payload))
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lista_espera')
          .insert([mappers.esperaToDb(payload)]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar na lista de espera: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const cleanIdadeDisplay = (idadeVal?: string, nomeVal?: string) => {
    if (!idadeVal) return 'Idade não inf.';
    const val = idadeVal.trim();
    if (val.toLowerCase().startsWith('idade:')) {
      const rest = val.substring(6).trim();
      return cleanIdadeDisplay(rest, nomeVal);
    }
    if (nomeVal && val.toLowerCase().includes(nomeVal.toLowerCase().split(' ')[0]) && val.length > 4) {
      return 'Idade não inf.';
    }
    if (val.length > 15) return 'Idade não inf.';
    return `Idade: ${val}`;
  };

  const isPlanoName = (str?: string) => {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes('sulamerica') || s.includes('sul américa') || s.includes('bradesco') || s.includes('amil') || s.includes('particular') || s.includes('unimed');
  };

  const cleanSpecList = (specVal?: string) => {
    if (!specVal) return ['Geral'];
    if (isPlanoName(specVal)) return ['Geral'];
    const parts = specVal.split(/[,/]+/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['Geral'];
  };

  // Metric calculation based strictly on filteredEspera
  const totalPacientes = filteredEspera.length;

  const especCounts: Record<string, number> = {};
  filteredEspera.forEach(e => {
    const list = cleanSpecList(e.especialidade);
    list.forEach(sp => {
      especCounts[sp] = (especCounts[sp] || 0) + 1;
    });
  });

  const parseIdadeNum = (idadeStr?: string) => {
    if (!idadeStr) return null;
    const match = idadeStr.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  let criancasAte7 = 0;
  let criancas8a12 = 0;
  let mais13 = 0;
  let idadeNaoInf = 0;

  filteredEspera.forEach(e => {
    const n = parseIdadeNum(e.idade);
    if (n === null) {
      idadeNaoInf++;
    } else if (n <= 7) {
      criancasAte7++;
    } else if (n <= 12) {
      criancas8a12++;
    } else {
      mais13++;
    }
  });

  const aguardandoCount = filteredEspera.filter(e => e.status === 'Aguardando').length;
  const convertidoCount = filteredEspera.filter(e => e.status === 'Convertido').length;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3.5 animate-fade-in text-xs max-w-full overflow-hidden">
      {/* Header (Shrink-0) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Fila de Atendimento</span>
          <h2 className="text-xl md:text-2xl font-black tracking-wide text-white mt-0.5">Lista de Espera</h2>
          <p className="text-xs text-slate-400 mt-0.5">Gerencie os pacientes que aguardam por vagas na agenda dos profissionais</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Adicionar Paciente
        </button>
      </div>

      {/* Cards de Resumo e Métricas (Shrink-0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {/* Card 1: Total Geral */}
        <div className="p-3.5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total na Fila</span>
            <div className="text-xl font-black text-white mt-0.5">{totalPacientes}</div>
            <p className="text-[10px] text-indigo-300/80 font-medium">Pacientes filtrados</p>
          </div>
        </div>

        {/* Card 2: Por Especialidade */}
        <div className="p-3.5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Por Especialidade</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-[48px] overflow-y-auto scrollbar-thin">
            {Object.keys(especCounts).length > 0 ? (
              Object.entries(especCounts).map(([sp, count]) => (
                <span key={sp} className="px-2 py-0.5 bg-violet-500/15 text-violet-200 border border-violet-500/20 rounded-md text-[9px] font-bold">
                  {sp}: {count}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-slate-500">Nenhum registro</span>
            )}
          </div>
        </div>

        {/* Card 3: Por Faixa Etária */}
        <div className="p-3.5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-1.5">
            <UserCheck size={14} className="text-emerald-400" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Por Faixa Etária</span>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] font-semibold">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md">
              0-7 anos: {criancasAte7}
            </span>
            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-md">
              8-12 anos: {criancas8a12}
            </span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-md">
              13+ anos: {mais13}
            </span>
          </div>
        </div>

        {/* Card 4: Status da Fila */}
        <div className="p-3.5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex items-center justify-between">
          <div className="space-y-1 w-full">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status da Fila</span>
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Clock size={11} />
                <span>{aguardandoCount} Fila</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <CheckCircle2 size={11} />
                <span>{convertidoCount} Agendados</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar & Filters (Shrink-0) */}
      <div className="p-3 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex flex-col md:flex-row items-center gap-3 shadow-lg shrink-0">
        {/* Input Search */}
        <div className="flex-1 flex items-center gap-2 w-full">
          <Search size={15} className="text-slate-400 ml-1 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone, especialidade, dia da semana ou período..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Filters Area */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.04]">
          {/* Especialidade Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Filter size={13} className="text-violet-400 shrink-0" />
            <select
              value={especialidadeFiltro}
              onChange={(e) => setEspecialidadeFiltro(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-[#161a26] border border-white/[0.08] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer font-medium"
            >
              <option value="">Todas Especialidades</option>
              {ESPECIALIDADES_OPCOES.map(sp => (
                <option key={sp} value={sp}>{sp}</option>
              ))}
            </select>
          </div>

          {/* Month/Year Filter */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Calendar size={13} className="text-indigo-400 shrink-0" />
            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="w-full sm:w-auto px-3 py-1.5 bg-[#161a26] border border-white/[0.08] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 cursor-pointer font-medium"
            >
              <option value="">Todos os meses / anos</option>
              {mesesDisponiveis.map(m => {
                const [y, mo] = m.split('-');
                const date = new Date(Number(y), Number(mo) - 1, 1);
                const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={m}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Table Section (Flex-1: Enquadrada Perfeitamente na Janela sem Scroll de Página) */}
      <div className="flex-1 min-h-0 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.06] bg-[#161a26] sticky top-0 z-10 shadow-md">
                <th className="py-3.5 px-3">Paciente</th>
                <th className="py-3.5 px-3">Especialidades / Idade</th>
                <th className="py-3.5 px-3">Preferência</th>
                <th className="py-3.5 px-3">Contato / Convênio</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Data Cad.</th>
                <th className="py-3.5 px-3">Observações</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-3 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {filteredEspera.map((e) => {
                const specsList = cleanSpecList(e.especialidade);
                const planoDisplay = e.plano || (isPlanoName(e.especialidade) ? e.especialidade : 'Particular');
                const temDias = Array.isArray(e.dias) && e.dias.length > 0;
                const temPeriodos = Array.isArray(e.periodos) && e.periodos.length > 0;

                return (
                  <tr key={e.id} className="hover:bg-white/[0.01] transition-colors group">
                    {/* Paciente */}
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors text-xs leading-tight">{e.nome}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{e.email || 'Sem e-mail'}</p>
                    </td>

                    {/* Especialidades / Idade */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {specsList.map((sp, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {sp}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-400">{cleanIdadeDisplay(e.idade, e.nome)}</p>
                    </td>

                    {/* Preferência de Horário & Dias */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        {temDias ? (
                          <div className="flex flex-wrap gap-0.5">
                            {e.dias.map((d, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-indigo-500/15 text-indigo-300 rounded text-[9px] font-bold border border-indigo-500/20">
                                {d.slice(0, 3)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-500">Qualquer dia</span>
                        )}

                        {temPeriodos ? (
                          <div className="flex flex-wrap gap-0.5">
                            {e.periodos.map((p, i) => (
                              <span key={i} className="px-1.5 py-0.5 bg-violet-500/15 text-violet-300 rounded text-[9px] font-bold border border-violet-500/20">
                                ⏱️ {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/5 text-slate-300 border border-white/10">
                            ⏱️ {e.periodo || 'Ambos'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Contato / Convênio */}
                    <td className="py-3 px-3">
                      <p className="text-slate-200 font-semibold font-mono text-[11px] whitespace-nowrap">{formatTelefone(e.tel)}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{planoDisplay} {e.carteirinha ? `(${e.carteirinha})` : ''}</p>
                    </td>

                    {/* Data Cadastro */}
                    <td className="py-3 px-3 text-center font-mono text-slate-300 font-medium text-[11px] whitespace-nowrap">
                      {formatDataBr(e.dataCadastro || e.dataEntrada)}
                    </td>

                    {/* Observações */}
                    <td className="py-3 px-3 text-slate-400 max-w-[140px] truncate" title={e.obs || 'Nenhuma observação'}>
                      {e.obs || '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        e.status === 'Aguardando'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : e.status === 'Convertido'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {e.status === 'Aguardando' ? <Clock size={10} /> : e.status === 'Convertido' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                        {e.status}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(e)}
                          className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-indigo-300 transition-all cursor-pointer"
                          title="Editar cadastro"
                        >
                          <Edit3 size={13} />
                        </button>

                        {e.status === 'Aguardando' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(e, 'Convertido')}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-emerald-400 transition-all cursor-pointer"
                              title="Marcar como Agendado"
                            >
                              <CheckCircle2 size={13} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(e, 'Cancelado')}
                              className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-amber-400 transition-all cursor-pointer"
                              title="Cancelar da fila"
                            >
                              <XCircle size={13} />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handleDelete(e)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-rose-400 transition-all cursor-pointer"
                          title="Remover permanentemente"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEspera.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhum paciente encontrado na lista de espera.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/60">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingItem ? 'Editar Paciente na Fila de Espera' : 'Adicionar à Fila de Espera'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Multi-Seleção de Especialidades */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={13} className="text-indigo-400" />
                    <span>Especialidades Desejadas (Selecione 1 ou mais)</span>
                  </span>
                  {especialidades.length > 0 && (
                    <span className="text-[10px] text-indigo-400 font-bold">{especialidades.length} selecionada(s)</span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ESPECIALIDADES_OPCOES.map((spec) => {
                    const selected = especialidades.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => toggleEspecialidade(spec)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selected
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                            : 'bg-[#161a26] text-slate-400 border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Idade</label>
                  <input
                    type="text"
                    placeholder="Ex: 8 anos"
                    value={idade}
                    onChange={(e) => setIdade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Período Geral</label>
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Ambos">Ambos</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              {/* Preferência de Dias da Semana */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-400" />
                  <span>Dias da Semana com Preferência</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_OPCOES.map((d) => {
                    const selected = dias.includes(d.full);
                    return (
                      <button
                        key={d.full}
                        type="button"
                        onClick={() => toggleDia(d.full)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          selected
                            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-indigo-400 shadow-md shadow-indigo-500/20'
                            : 'bg-[#161a26] text-slate-400 border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferência de Horários / Períodos */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Watch size={13} className="text-violet-400" />
                  <span>Horários / Períodos de Preferência</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PERIODOS_OPCOES.map((p) => {
                    const selected = periodos.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePeriodo(p)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left border ${
                          selected
                            ? 'bg-violet-600/30 text-violet-200 border-violet-500 shadow-md shadow-violet-500/20'
                            : 'bg-[#161a26] text-slate-400 border-white/[0.06] hover:bg-white/[0.04] hover:text-slate-200'
                        }`}
                      >
                        ⏱️ {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Telefone *</label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde</label>
                  <input
                    type="text"
                    value={plano}
                    onChange={(e) => setPlano(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                  <input
                    type="text"
                    value={carteirinha}
                    onChange={(e) => setCarteirinha(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações / Requisitos de Horário</label>
                <textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-indigo-500/50"
                  placeholder="Ex: Disponível somente de tarde. Aguardando integração sensorial."
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  {submitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
