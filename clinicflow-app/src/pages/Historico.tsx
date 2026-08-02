import React, { useState, useEffect } from 'react';
import { 
  Search, 
  History, 
  BookOpen, 
  Stethoscope, 
  Plus, 
  Save, 
  Clock, 
  CheckCircle2, 
  FileText, 
  ClipboardList, 
  AlertCircle, 
  Calendar, 
  User, 
  FileSpreadsheet, 
  XCircle,
  Download
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Paciente } from '../types';

// Premium Markdown Renderer Helpers
const parseBoldText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return <strong key={i} className="font-black text-white">{boldText}</strong>;
    }
    // Check for *italic*
    const italicParts = part.split(/(\*.*?\*)/g);
    return italicParts.map((subPart, j) => {
      if (subPart.startsWith('*') && subPart.endsWith('*')) {
        return <em key={j} className="text-slate-400 italic font-semibold">{subPart.slice(1, -1)}</em>;
      }
      return subPart;
    });
  });
};

const renderMarkdown = (text: string) => {
  if (!text) return <span className="text-slate-500">Nenhum texto inserido.</span>;

  const lines = text.split('\n');
  return lines.map((line, idx) => {
    const cleanLine = line.trim();

    // Horizontal Rule
    if (cleanLine === '---') {
      return <hr key={idx} className="my-4 border-t border-white/[0.06]" />;
    }

    // Headers
    if (cleanLine.startsWith('### ')) {
      return (
        <h4 key={idx} className="text-[10px] font-black text-indigo-400 mt-4 mb-1.5 uppercase tracking-wider font-sans">
          {cleanLine.slice(4)}
        </h4>
      );
    }
    if (cleanLine.startsWith('## ')) {
      return (
        <h3 key={idx} className="text-xs font-black text-white mt-5 mb-2 uppercase tracking-wide font-sans border-b border-indigo-500/10 pb-1">
          {cleanLine.slice(3)}
        </h3>
      );
    }
    if (cleanLine.startsWith('# ')) {
      return (
        <h2 key={idx} className="text-sm font-black text-white mt-6 mb-2.5 uppercase tracking-widest font-sans">
          {cleanLine.slice(2)}
        </h2>
      );
    }

    // List items
    const isBullet = cleanLine.startsWith('* ') || cleanLine.startsWith('- ');
    if (isBullet) {
      const content = cleanLine.slice(2);
      return (
        <div key={idx} className="pl-4 relative py-0.5 text-slate-300 font-sans leading-relaxed text-[11px] flex items-start gap-1.5">
          <span className="text-indigo-400 mt-1 select-none">•</span>
          <span className="flex-1">{parseBoldText(content)}</span>
        </div>
      );
    }

    // Empty space
    if (cleanLine === '') {
      return <div key={idx} className="h-1.5" />;
    }

    return (
      <p key={idx} className="text-slate-300 font-sans leading-relaxed text-[11px] my-0.5">
        {parseBoldText(line)}
      </p>
    );
  });
};

export const Historico: React.FC = () => {
  const { 
    pacientes, 
    historico, 
    lazyLoadHistorico, 
    profissionais, 
    agendamentos, 
    guias, 
    lazyLoadGuias,
    getBaseStatus,
    getStatusColor
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchedPacientes, setSearchedPacientes] = useState<Paciente[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPacId, setSelectedPacId] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'timeline' | 'evolucao' | 'anamnese' | 'guias' | 'prontuario'>('timeline');
  
  // Creation States
  const [tipo, setTipo] = useState<'evolucao' | 'anamnese'>('evolucao');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [profId, setProfId] = useState<number>(profissionais[0]?.id || 0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (selectedPacId > 0) {
      lazyLoadHistorico(selectedPacId);
      lazyLoadGuias();
      setActiveTab('timeline');
    }
  }, [selectedPacId]);

  const selectedPaciente = pacientes.find(p => p.id === selectedPacId) || searchedPacientes.find(p => p.id === selectedPacId);

  // Filter patient's agendamentos
  const patientAgendamentos = selectedPaciente
    ? agendamentos.filter(a => a.paciente.toLowerCase().trim() === selectedPaciente.nome.toLowerCase().trim())
    : [];

  // Filter patient's guias
  const patientGuias = selectedPaciente
    ? guias.filter(g => g.pac.toLowerCase().trim() === selectedPaciente.nome.toLowerCase().trim())
    : [];

  // Filter patient's history logs
  const pacHistory = historico.filter(h => h.pacId === selectedPacId);

  // Stats calculation
  const totalAgendamentos = patientAgendamentos.length;
  
  const totalAtendimentos = patientAgendamentos.filter(a => {
    const base = getBaseStatus(a.status);
    return base === 'atendido';
  }).length;

  const totalEvolucoes = pacHistory.filter(h => h.tipo === 'evolucao').length;
  
  const totalAnamneses = pacHistory.filter(h => h.tipo === 'anamnese').length;

  const totalCancelados = patientAgendamentos.filter(a => {
    const base = getBaseStatus(a.status);
    return base === 'cancelado' || base === 'desmarcado';
  }).length;

  // Age calculation helper
  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return '';
    let birthDate: Date;
    if (birthDateStr.includes('/')) {
      const [d, m, a] = birthDateStr.split('/');
      birthDate = new Date(Number(a), Number(m) - 1, Number(d));
    } else if (birthDateStr.includes('-')) {
      const [a, m, d] = birthDateStr.split('-');
      birthDate = new Date(Number(a), Number(m) - 1, Number(d));
    } else {
      return '';
    }
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} anos`;
  };

  const handleSearchPatients = async () => {
    if (!searchTerm.trim()) {
      alert('Digite parte do nome para buscar.');
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome', `%${searchTerm}%`)
        .order('nome');
      if (error) throw error;
      
      if (data) {
        setSearchedPacientes(data.map(mappers.dbToPac));
      }
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
      alert('Erro ao buscar pacientes.');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPacId) {
      alert('Selecione um paciente primeiro.');
      return;
    }
    setSubmitting(true);

    const payload = {
      pac_id: selectedPacId,
      tipo,
      titulo: titulo || (tipo === 'evolucao' ? 'Evolução Clínica' : 'Anamnese Geral'),
      conteudo: {
        texto,
        profId: Number(profId)
      },
      prof_id: Number(profId),
      data: new Date().toISOString(),
      fonte: 'Web App'
    };

    try {
      const { error } = await supabase.from('historico').insert([payload]);
      if (error) throw error;
      setTexto('');
      setTitulo('');
      await lazyLoadHistorico(selectedPacId);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar registro no prontuário.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group status updates (agendamentos) with close evolution/anamnese notes
  const getGroupedTimeline = () => {
    const timelineItems: any[] = [];
    const usedIds = new Set<number>();

    // Sort pacHistory by data descending (latest first)
    const sortedHistory = [...pacHistory].sort((a, b) => b.data.localeCompare(a.data));

    sortedHistory.forEach(item => {
      if (usedIds.has(item.id)) return;

      if (item.tipo === 'agendamento') {
        // Try to find a matching evolution/anamnese for this appointment status change
        // We match by: same patient, same professional, and close timestamps (within 30 minutes)
        const match = sortedHistory.find(other => {
          if (other.id === item.id) return false;
          if (usedIds.has(other.id)) return false;
          if (other.tipo !== 'evolucao' && other.tipo !== 'anamnese') return false;
          
          // Match by professional
          if (other.profId !== item.profId) return false;

          // Match by proximity of creation date (within 30 minutes)
          const diffMs = Math.abs(new Date(other.data).getTime() - new Date(item.data).getTime());
          if (diffMs < 30 * 60 * 1000) return true;

          return false;
        });

        if (match) {
          usedIds.add(match.id);
          timelineItems.push({
            ...item,
            complemento: match
          });
        } else {
          timelineItems.push(item);
        }
        usedIds.add(item.id);
      } else {
        // It's an evolution or anamnese that wasn't grouped
        timelineItems.push(item);
        usedIds.add(item.id);
      }
    });

    return timelineItems;
  };

  // Filtered logs for display based on active tab
  const getFilteredLogs = () => {
    if (activeTab === 'evolucao') return pacHistory.filter(h => h.tipo === 'evolucao');
    if (activeTab === 'anamnese') return pacHistory.filter(h => h.tipo === 'anamnese');
    if (activeTab === 'timeline') return getGroupedTimeline();
    return pacHistory;
  };

  const displayedLogs = getFilteredLogs();

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* STICKY HEADER AND SELECTOR */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans">Prontuário Eletrônico (PEP)</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Histórico Clínico</h2>
          <p className="text-xs text-slate-400 mt-1">Consulte evolução terapêutica, anamneses e histórico de consultas dos pacientes</p>
        </div>

        {/* Patient Search */}
        <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl space-y-3">
          <label className="block text-slate-400 font-semibold mb-1">Buscar Paciente</label>
          <div className="flex gap-2 max-w-xl">
            <input
              type="text"
              placeholder="Digite parte do nome do paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchPatients();
              }}
              className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-semibold text-xs"
            />
            <button
              type="button"
              onClick={handleSearchPatients}
              disabled={searching}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition-all"
            >
              <Search size={14} />
              {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searchedPacientes.length > 0 && (
            <div className="pt-2 animate-fade-in">
              <label className="block text-slate-400 font-semibold mb-1 text-[10px] uppercase tracking-wide">Resultados encontrados:</label>
              <select
                value={selectedPacId}
                onChange={(e) => setSelectedPacId(Number(e.target.value))}
                className="w-full md:w-96 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-bold"
              >
                <option value={0}>— Selecione o Paciente —</option>
                {searchedPacientes.map(p => (
                  <option key={p.id} value={p.id}>{p.nome} (CPF: {p.cpf || 'Sem CPF'})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {selectedPacId > 0 && selectedPaciente ? (
        <div className="space-y-6">
          {/* Indicators Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#131622]/40 border border-white/[0.04] p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-indigo-400 font-mono">{totalAgendamentos}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Agendamentos</span>
            </div>
            <div className="bg-[#131622]/40 border border-white/[0.04] p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-emerald-400 font-mono">{totalAtendimentos}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Atendimentos</span>
            </div>
            <div className="bg-[#131622]/40 border border-white/[0.04] p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-sky-400 font-mono">{totalEvolucoes}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Evoluções</span>
            </div>
            <div className="bg-[#131622]/40 border border-white/[0.04] p-4 rounded-xl flex flex-col items-center justify-center text-center">
              <span className="text-xl font-black text-amber-400 font-mono">{totalAnamneses}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Anamneses</span>
            </div>
            <div className="bg-[#131622]/40 border border-white/[0.04] p-4 rounded-xl flex flex-col items-center justify-center text-center col-span-2 sm:col-span-1">
              <span className="text-xl font-black text-rose-500 font-mono">{totalCancelados}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Cancelados</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timeline, Details and Tabbed List Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Tabs Navigation */}
              <div className="flex border-b border-white/[0.06] overflow-x-auto gap-2">
                {[
                  { id: 'timeline', label: 'Linha do tempo', icon: Clock },
                  { id: 'evolucao', label: 'Evoluções', icon: Stethoscope },
                  { id: 'anamnese', label: 'Anamnese', icon: BookOpen },
                  { id: 'guias', label: 'Guias SADT', icon: FileSpreadsheet },
                  { id: 'prontuario', label: 'Prontuário completo', icon: ClipboardList }
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveTab(t.id as any)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold border-b-2 transition-all whitespace-nowrap ${
                        activeTab === t.id
                          ? 'border-indigo-500 text-indigo-400 bg-indigo-500/[0.02]'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.01]'
                      }`}
                    >
                      <Icon size={12} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents: Timeline, Evolucoes, Anamneses */}
              {(activeTab === 'timeline' || activeTab === 'evolucao' || activeTab === 'anamnese') && (
                <div className="space-y-4 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5 animate-fade-in">
                  {displayedLogs.map((item) => {
                    const ItemIcon = item.tipo === 'anamnese' ? BookOpen : item.tipo === 'agendamento' ? Clock : Stethoscope;
                    const docName = profissionais.find(p => p.id === item.profId)?.nome || 'Profissional';
                    const c = typeof item.conteudo === 'string' ? (() => { try { return JSON.parse(item.conteudo); } catch { return { texto: item.conteudo }; } })() : (item.conteudo || {});
                    const textoExibir = c.texto || c.obs || c.text || (typeof item.conteudo === 'string' ? item.conteudo : '');
                    const compC = item.complemento ? (typeof item.complemento.conteudo === 'string' ? (() => { try { return JSON.parse(item.complemento.conteudo); } catch { return { texto: item.complemento.conteudo }; } })() : (item.complemento.conteudo || {})) : null;

                    return (
                      <div key={item.id} className="relative pl-12 group">
                        {/* Time marker */}
                        <div className="absolute left-3.5 top-0.5 w-6 h-6 rounded-full bg-[#131622] border border-white/[0.08] flex items-center justify-center text-slate-400 group-hover:border-indigo-500/50 group-hover:text-indigo-400 transition-all">
                          <ItemIcon size={12} />
                        </div>

                        {/* Timeline Item Card */}
                        <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] group-hover:border-white/[0.08] rounded-xl space-y-3 transition-all">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-slate-200">{item.titulo}</h4>
                                {item.tipo === 'agendamento' && item.status && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 uppercase">
                                    {item.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] text-slate-500 font-semibold tracking-wider mt-0.5">
                                Por <span className="text-slate-400">{docName}</span> | Fonte: {item.fonte}
                              </p>
                            </div>
                            <span className="font-mono text-[9px] text-slate-400 bg-white/[0.01] px-2 py-0.5 border border-white/[0.03] rounded-lg">
                              {new Date(item.data).toLocaleString('pt-BR')}
                            </span>
                          </div>

                          {/* Nested evolution note / anamnese (complemento) */}
                          {item.complemento ? (
                            <div className="mt-3 p-3 bg-[#0f111a]/65 border border-white/[0.03] rounded-lg space-y-2">
                              <div className="flex justify-between items-center border-b border-white/[0.03] pb-1.5">
                                <span className="font-bold text-indigo-400 text-[10px] flex items-center gap-1.5">
                                  {item.complemento.tipo === 'anamnese' ? <BookOpen size={10} /> : <Stethoscope size={10} />}
                                  {item.complemento.titulo}
                                </span>
                                <span className="text-[8px] text-slate-500 font-semibold">
                                  Fonte: {item.complemento.fonte}
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px]">
                                {renderMarkdown(compC?.texto || compC?.obs || compC?.text || '')}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 text-[11px]">
                              {renderMarkdown(textoExibir)}
                              
                              {/* Renderização de Anexo no Prontuário */}
                              {c.anexoUrl && (
                                <div className="mt-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={20} className="text-indigo-400 shrink-0" />
                                    <div className="truncate">
                                      <p className="font-bold text-xs text-white truncate">{c.anexoNome || 'Documento Anexado'}</p>
                                      <span className="text-[9px] text-slate-400 font-mono">Origem: {c.origem || item.fonte || 'Chat / Prontuário'}</span>
                                    </div>
                                  </div>
                                  <a
                                    href={c.anexoUrl}
                                    download={c.anexoNome || 'anexo_prontuario'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                                  >
                                    <Download size={13} />
                                    <span>Baixar / Visualizar Anexo</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {displayedLogs.length === 0 && (
                    <div className="pl-12 py-6 text-slate-500 font-medium">
                      Nenhum registro clínico encontrado nesta categoria.
                    </div>
                  )}
                </div>
              )}

              {/* Tab Contents: Guias SADT */}
              {activeTab === 'guias' && (
                <div className="space-y-3 animate-fade-in">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Guias SADT ({patientGuias.length})</h4>
                  <div className="overflow-x-auto border border-white/[0.04] rounded-2xl bg-[#131622]/30 divide-y divide-white/[0.02]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-white/[0.02] text-slate-400 font-bold">
                        <tr>
                          <th className="p-3">Número Guia</th>
                          <th className="p-3">Data</th>
                          <th className="p-3">Plano de Saúde</th>
                          <th className="p-3">Valor</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02] font-semibold text-slate-300">
                        {patientGuias.map((guia) => (
                          <tr key={guia.id} className="hover:bg-white/[0.005]">
                            <td className="p-3 font-mono font-bold text-slate-200">{guia.num}</td>
                            <td className="p-3 font-mono">
                              {guia.data ? guia.data.split('-').reverse().join('/') : '—'}
                            </td>
                            <td className="p-3">{guia.plano}</td>
                            <td className="p-3 font-mono">
                              {guia.valor ? `R$ ${guia.valor.toFixed(2)}` : 'R$ 0,00'}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                                guia.status === 'Pago' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                guia.status === 'Enviado' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                guia.status === 'Glosado' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                                'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              }`}>
                                {guia.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {patientGuias.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-500">
                              Nenhuma guia SADT encontrada para este paciente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab Contents: Prontuário completo */}
              {activeTab === 'prontuario' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Dados cadastrais */}
                  <div className="bg-[#131622]/40 border border-white/[0.04] p-5 rounded-2xl space-y-4">
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Dados cadastrais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                      <div>
                        <span className="text-slate-500 font-semibold block">Nome:</span>
                        <span className="text-slate-200 font-bold">{selectedPaciente.nome}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">CPF:</span>
                        <span className="text-slate-200 font-bold font-mono">{selectedPaciente.cpf || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Nasc:</span>
                        <span className="text-slate-200 font-bold font-mono">
                          {selectedPaciente.nasc ? selectedPaciente.nasc.split('-').reverse().join('/') : '—'}
                          {selectedPaciente.nasc && ` (${calculateAge(selectedPaciente.nasc)})`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Telefone:</span>
                        <span className="text-slate-200 font-bold font-mono">{selectedPaciente.tel || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Plano:</span>
                        <span className="text-slate-200 font-bold">{selectedPaciente.plano || 'Particular'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block">Carteirinha:</span>
                        <span className="text-slate-200 font-bold font-mono">{selectedPaciente.carteirinha || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Todos os agendamentos */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                      Todos os agendamentos ({patientAgendamentos.length})
                    </h4>
                    <div className="overflow-x-auto border border-white/[0.04] rounded-2xl bg-[#131622]/30 divide-y divide-white/[0.02]">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-white/[0.02] text-slate-400 font-bold">
                          <tr>
                            <th className="p-3">Data</th>
                            <th className="p-3">Hora</th>
                            <th className="p-3">Profissional</th>
                            <th className="p-3">Plano</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02] font-semibold text-slate-300">
                          {patientAgendamentos.map((appt) => {
                            const docName = profissionais.find(p => p.id === appt.profId)?.nome || 'Profissional';
                            const statusColor = getStatusColor(appt.status);
                            return (
                              <tr key={appt.id} className="hover:bg-white/[0.005]">
                                <td className="p-3 font-mono">
                                  {appt.dataISO ? appt.dataISO.split('-').reverse().join('/') : '—'}
                                </td>
                                <td className="p-3 font-mono">{appt.hora}</td>
                                <td className="p-3">{docName}</td>
                                <td className="p-3">{appt.plano}</td>
                                <td className="p-3">
                                  <span
                                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                                    style={{ backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}25` }}
                                  >
                                    {appt.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                          {patientAgendamentos.length === 0 && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-500">
                                Nenhum agendamento encontrado para este paciente.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Creation Form Column */}
            <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl h-fit">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-4">Adicionar Registro</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo de Registro</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTipo('evolucao')}
                      className={`py-2 border rounded-xl font-bold transition-all ${
                        tipo === 'evolucao'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-white/[0.06] hover:bg-white/5 text-slate-400'
                      }`}
                    >
                      Evolução Clínica
                    </button>
                    <button
                      type="button"
                      onClick={() => setTipo('anamnese')}
                      className={`py-2 border rounded-xl font-bold transition-all ${
                        tipo === 'anamnese'
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-white/[0.06] hover:bg-white/5 text-slate-400'
                      }`}
                    >
                      Anamnese
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Profissional Responsável</label>
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
                  <label className="block text-slate-400 font-semibold mb-1">Título do Registro (Opcional)</label>
                  <input
                    type="text"
                    placeholder={tipo === 'evolucao' ? "Ex: Sessão de Fonoterapia" : "Ex: Avaliação Inicial"}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Evolução / Anotações Clínicas</label>
                  <textarea
                    rows={8}
                    required
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Digite detalhadamente as anotações do atendimento..."
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  {submitting ? 'Salvando...' : 'Salvar no Prontuário'}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-[#555d74] border border-dashed border-white/[0.05] rounded-2xl bg-[#131622]/20">
          <History size={36} className="mb-3 animate-pulse" />
          <p className="font-semibold text-xs">Busque por um paciente acima para ver e gerenciar seu prontuário clínico.</p>
        </div>
      )}
    </div>
  );
};
