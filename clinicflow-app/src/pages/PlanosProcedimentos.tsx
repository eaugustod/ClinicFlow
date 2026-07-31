import React, { useState } from 'react';
import { Search, HeartHandshake, DollarSign, Plus, Edit3, CheckCircle2, AlertCircle, Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PlanoSaude, Procedimento } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const PlanosProcedimentos: React.FC = () => {
  const { planos, procedimentos, refreshAll } = useApp();
  const [activeTab, setActiveTab] = useState<'planos' | 'procedimentos'>('planos');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false);
  const [editingPlano, setEditingPlano] = useState<PlanoSaude | null>(null);
  const [isProcModalOpen, setIsProcModalOpen] = useState(false);
  const [editingProc, setEditingProc] = useState<Procedimento | null>(null);

  // Plano Form state
  const [planoNome, setPlanoNome] = useState('');
  const [planoCnpj, setPlanoCnpj] = useState('');
  const [planoAns, setPlanoAns] = useState('');
  const [planoTabela, setPlanoTabela] = useState('CBHPM');
  const [planoCodPrestador, setPlanoCodPrestador] = useState('');
  const [planoCNES, setPlanoCNES] = useState('');
  const [planoUsaTiss, setPlanoUsaTiss] = useState(true);
  const [planoAplicaTodos, setPlanoAplicaTodos] = useState(true);
  const [planoVersaoTiss, setPlanoVersaoTiss] = useState('4.02.00');
  const [planoTipoId, setPlanoTipoId] = useState('Código');
  const [planoJuntarGuia, setPlanoJuntarGuia] = useState(true);
  const [planoNomeContratado, setPlanoNomeContratado] = useState('');
  const [planoNumGuiaInicial, setPlanoNumGuiaInicial] = useState<number>(1);
  const [planoNomePlanoGuia, setPlanoNomePlanoGuia] = useState('');
  const [planoLogo, setPlanoLogo] = useState('');
  const [planoTel, setPlanoTel] = useState('');
  const [planoEmail, setPlanoEmail] = useState('');
  const [planoObs, setPlanoObs] = useState('');
  const [planoSubmitting, setPlanoSubmitting] = useState(false);

  const handlePlanoLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPlanoLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Procedimento Form state
  const [procCodigo, setProcCodigo] = useState('');
  const [procDesc, setProcDesc] = useState('');
  const [procDescCurta, setProcDescCurta] = useState('');
  const [procTipo, setProcTipo] = useState('Sessão');
  const [procValPart, setProcValPart] = useState<number>(0);
  const [procValPlano, setProcValPlano] = useState<number>(0);
  const [procTabela, setProcTabela] = useState('TUSS');
  const [procPlanoId, setProcPlanoId] = useState<number>(0);
  const [procStatus, setProcStatus] = useState('Ativo');
  const [procObs, setProcObs] = useState('');
  const [procSubmitting, setProcSubmitting] = useState(false);

  // Price Table Filter state
  const [procFilterPlano, setProcFilterPlano] = useState<number>(0);

  const filteredPlanos = planos.filter(p =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProcs = procedimentos.filter(p => {
    const matchesSearch = p.desc.toLowerCase().includes(searchQuery.toLowerCase()) || p.codigo.includes(searchQuery);
    const matchesPlano = procFilterPlano === 0 || p.planoId === procFilterPlano;
    return matchesSearch && matchesPlano;
  });

  // Plano Handlers
  const openAddPlano = () => {
    setEditingPlano(null);
    setPlanoNome('');
    setPlanoCnpj('');
    setPlanoAns('');
    setPlanoTabela('CBHPM');
    setPlanoCodPrestador('');
    setPlanoCNES('');
    setPlanoUsaTiss(true);
    setPlanoAplicaTodos(true);
    setPlanoVersaoTiss('4.02.00');
    setPlanoTipoId('Código');
    setPlanoJuntarGuia(true);
    setPlanoNomeContratado('');
    setPlanoNumGuiaInicial(1);
    setPlanoNomePlanoGuia('');
    setPlanoLogo('');
    setPlanoTel('');
    setPlanoEmail('');
    setPlanoObs('');
    setIsPlanoModalOpen(true);
  };

  const openEditPlano = (p: PlanoSaude) => {
    setEditingPlano(p);
    setPlanoNome(p.nome);
    setPlanoCnpj(p.cnpj);
    setPlanoAns(p.ans);
    setPlanoTabela(p.tabela);
    setPlanoCodPrestador(p.codPrestador);
    setPlanoCNES(p.cnes);
    setPlanoUsaTiss(p.usaTiss);
    setPlanoAplicaTodos(p.aplicaTodos);
    setPlanoVersaoTiss(p.versaoTiss);
    setPlanoTipoId(p.tipoId);
    setPlanoJuntarGuia(p.juntarGuia);
    setPlanoNomeContratado(p.nomeContratado || '');
    setPlanoNumGuiaInicial(p.numGuiaInicial);
    setPlanoNomePlanoGuia(p.nomePlanoGuia || '');
    setPlanoLogo(p.logo || p.foto || (p as any).foto_url || '');
    setPlanoTel(p.tel || '');
    setPlanoEmail(p.email || '');
    setPlanoObs(p.obs || '');
    setIsPlanoModalOpen(true);
  };

  const handlePlanoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanoSubmitting(true);
    const payload: Partial<PlanoSaude> = {
      nome: planoNome,
      cnpj: planoCnpj,
      ans: planoAns,
      tabela: planoTabela,
      codPrestador: planoCodPrestador,
      cnes: planoCNES,
      usaTiss: planoUsaTiss,
      aplicaTodos: planoAplicaTodos,
      versaoTiss: planoVersaoTiss,
      tipoId: planoTipoId,
      juntarGuia: planoJuntarGuia,
      nomeContratado: planoNomeContratado,
      numGuiaInicial: planoNumGuiaInicial,
      nomePlanoGuia: planoNomePlanoGuia,
      logo: planoLogo,
      tel: planoTel,
      email: planoEmail,
      obs: planoObs,
      status: 'Ativo'
    };

    try {
      if (editingPlano) {
        const { error } = await supabase.from('planos_saude').update(mappers.planoToDb(payload)).eq('id', editingPlano.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('planos_saude').insert([mappers.planoToDb(payload)]);
        if (error) throw error;
      }
      setIsPlanoModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar plano de saúde');
    } finally {
      setPlanoSubmitting(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPlanoLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Proc Handlers
  const openAddProc = () => {
    setEditingProc(null);
    setProcCodigo('');
    setProcDesc('');
    setProcDescCurta('');
    setProcTipo('Sessão');
    setProcValPart(0);
    setProcValPlano(0);
    setProcTabela('TUSS');
    setProcPlanoId(0);
    setProcStatus('Ativo');
    setProcObs('');
    setIsProcModalOpen(true);
  };

  const openEditProc = (pr: Procedimento) => {
    setEditingProc(pr);
    setProcCodigo(pr.codigo);
    setProcDesc(pr.desc);
    setProcDescCurta(pr.descCurta || '');
    setProcTipo(pr.tipo || 'Sessão');
    setProcValPart(pr.valPart);
    setProcValPlano(pr.valPlano);
    setProcTabela(pr.tabela || 'TUSS');
    setProcPlanoId(pr.planoId);
    setProcStatus(pr.status || 'Ativo');
    setProcObs(pr.obs || '');
    setIsProcModalOpen(true);
  };

  const handleProcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcSubmitting(true);
    const payload: Partial<Procedimento> = {
      codigo: procCodigo,
      desc: procDesc,
      descCurta: procDescCurta,
      tipo: procTipo,
      valPart: procValPart,
      valPlano: procValPlano,
      tabela: procTabela,
      planoId: procPlanoId,
      status: procStatus,
      obs: procObs
    };

    try {
      if (editingProc) {
        const { error } = await supabase.from('procedimentos').update(mappers.procToDb(payload)).eq('id', editingProc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('procedimentos').insert([mappers.procToDb(payload)]);
        if (error) throw error;
      }
      setIsProcModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar procedimento');
    } finally {
      setProcSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      
      {/* Sticky Header Section */}
      <div className="sticky -top-8 bg-[#07090e]/95 backdrop-blur-md z-10 pb-4 pt-9 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans">Cadastros de Faturamento</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Planos & Preços</h2>
            <p className="text-xs text-slate-400 mt-1">Gerencie os convênios parceiros e a tabela de valores dos procedimentos</p>
          </div>
          <div className="flex gap-2">
            {activeTab === 'planos' ? (
              <button
                onClick={openAddPlano}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Plus size={16} />
                Novo Plano
              </button>
            ) : (
              <button
                onClick={openAddProc}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
              >
                <Plus size={16} />
                Novo Procedimento
              </button>
            )}
          </div>
        </div>

        {/* Tabs Menu */}
        <div className="flex border-b border-white/[0.04]">
          <button
            onClick={() => { setActiveTab('planos'); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold tracking-wide transition-all ${
              activeTab === 'planos'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HeartHandshake size={14} />
            Planos de Saúde ({planos.length})
          </button>
          <button
            onClick={() => { setActiveTab('procedimentos'); setSearchQuery(''); }}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold tracking-wide transition-all ${
              activeTab === 'procedimentos'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign size={14} />
            Tabela de Preços ({procedimentos.length})
          </button>
        </div>

        {/* Search Filter */}
        <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-[#161a26]/40 px-3 py-2 rounded-xl border border-white/[0.04]">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'planos' ? "Buscar planos..." : "Buscar por código ou descrição do procedimento..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 p-0"
            />
          </div>
          {activeTab === 'procedimentos' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">Filtrar por Plano:</span>
              <select
                value={procFilterPlano}
                onChange={(e) => setProcFilterPlano(Number(e.target.value))}
                className="bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 min-w-[160px]"
              >
                <option value="0">Todos os planos</option>
                {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'planos' ? (
        /* Planos Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlanos.map((pl) => (
            <div
              key={pl.id}
              className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-300 group shadow-xl"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {(pl.logo || pl.foto) ? (
                      <img
                        src={pl.logo || pl.foto}
                        alt={pl.nome}
                        className="w-10 h-10 rounded-xl object-contain bg-white/5 p-1 border border-white/10 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                        {pl.nome.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors text-xs">
                        {pl.nome}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold tracking-wide mt-0.5">
                        ANS: <span className="font-mono text-slate-300">{pl.ans || '—'}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                    pl.status === 'Ativo'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                  }`}>
                    {pl.status}
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-[10px] text-slate-400">
                  <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                    <span className="font-medium">CNPJ:</span>
                    <span className="font-mono text-slate-300">{pl.cnpj || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                    <span className="font-medium">Registro ANS:</span>
                    <span className="font-mono text-slate-300">{pl.ans || '—'}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                    <span className="font-medium">Padrão Tabela:</span>
                    <span className="text-slate-300">{pl.tabela}</span>
                  </div>
                  <div className="flex justify-between pb-1.5 border-b border-white/[0.02]">
                    <span className="font-medium">CNES Clínica:</span>
                    <span className="text-slate-300 font-mono">{pl.cnes || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Guias Integradas (TISS):</span>
                    <span className={`font-bold ${pl.usaTiss ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {pl.usaTiss ? 'Sim' : 'Não'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.04] flex justify-end">
                <button
                  onClick={() => openEditPlano(pl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 transition-all"
                >
                  <Edit3 size={11} />
                  Editar Plano
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Procedimentos Table */
        <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                  <th className="p-4">Código</th>
                  <th className="p-4">Descrição</th>
                  <th className="p-4">Convênio Restrito</th>
                  <th className="p-4">Particular</th>
                  <th className="p-4">Convênio</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {filteredProcs.map((pr) => {
                  const plNome = planos.find(pl => pl.id === pr.planoId)?.nome || 'Todos / Livre';
                  return (
                    <tr key={pr.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-4 font-mono font-bold text-indigo-400">{pr.codigo}</td>
                      <td className="p-4 text-slate-200 font-medium">{pr.desc}</td>
                      <td className="p-4 text-slate-400">{plNome}</td>
                      <td className="p-4 font-mono text-slate-300">R$ {pr.valPart.toFixed(2)}</td>
                      <td className="p-4 font-mono text-slate-300">R$ {pr.valPlano.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => openEditProc(pr)}
                          className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300"
                        >
                          <Edit3 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plano Modal */}
      {isPlanoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl my-8 overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingPlano ? 'Editar Plano' : 'Novo Plano de Saúde'}
              </h3>
              <button type="button" onClick={() => setIsPlanoModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handlePlanoSubmit} className="p-6 space-y-6 text-xs max-h-[85vh] overflow-y-auto custom-scrollbar">
              {/* DADOS BÁSICOS */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Logomarca / Foto do Plano */}
                  <div className="md:col-span-2 space-y-2 bg-[#161a26]/50 p-3 rounded-xl border border-white/[0.06]">
                    <label className="block text-slate-400 font-semibold text-xs">Logomarca / Foto do Plano de Saúde</label>
                    <div className="flex items-center gap-4">
                      {planoLogo ? (
                        <img src={planoLogo} alt="Preview" className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1 border-2 border-indigo-500 shadow-md shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#1c2234] border border-white/10 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                          Sem Logo
                        </div>
                      )}
                      <div className="flex-1 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">Cole a URL da logomarca ou selecione um arquivo do computador</span>
                          {planoLogo && (
                            <button
                              type="button"
                              onClick={() => setPlanoLogo('')}
                              className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline cursor-pointer"
                            >
                              Remover Logo
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="URL da logomarca ou escolha um arquivo..."
                          value={planoLogo}
                          onChange={(e) => setPlanoLogo(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                          <Camera size={12} />
                          <span>Escolher Logomarca do Computador</span>
                          <input type="file" accept="image/*" onChange={handlePlanoLogoChange} className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Nome do Plano</label>
                    <input
                      type="text"
                      required
                      value={planoNome}
                      onChange={(e) => setPlanoNome(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">CNPJ</label>
                    <input
                      type="text"
                      value={planoCnpj}
                      onChange={(e) => setPlanoCnpj(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Registro ANS</label>
                    <input
                      type="text"
                      value={planoAns}
                      onChange={(e) => setPlanoAns(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={planoUsaTiss}
                        onChange={(e) => setPlanoUsaTiss(e.target.checked)}
                        className="rounded border-white/[0.06] bg-[#161a26] text-indigo-600 focus:ring-0 focus:ring-offset-0"
                      />
                      <span className="text-slate-300 font-medium">Usar padrão TISS XML para faturamento</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* CONFIGURAÇÕES TISS CONDICIONAIS */}
              {planoUsaTiss && (
                <div className="space-y-6 pt-4 border-t border-white/[0.04]">
                  <div>
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block mb-4">Configurações TISS para Guias</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Aplica-se a todos os profissionais?</label>
                        <select
                          value={planoAplicaTodos ? 'Sim' : 'Não'}
                          onChange={(e) => setPlanoAplicaTodos(e.target.value === 'Sim')}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Utilizar TISS para esta operadora</label>
                        <select
                          value={planoUsaTiss ? 'Sim' : 'Não'}
                          onChange={(e) => setPlanoUsaTiss(e.target.value === 'Sim')}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Versão do TISS</label>
                        <select
                          value={planoVersaoTiss}
                          onChange={(e) => setPlanoVersaoTiss(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="4.02.00">4.02.00</option>
                          <option value="4.01.00">4.01.00</option>
                          <option value="3.05.00">3.05.00</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Tipo de código a ser utilizado</label>
                        <select
                          value={planoTipoId}
                          onChange={(e) => setPlanoTipoId(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="Código">Código</option>
                          <option value="Matrícula">Matrícula</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Juntar proc. consulta e SP/SADT?</label>
                        <select
                          value={planoJuntarGuia ? 'Sim' : 'Não'}
                          onChange={(e) => setPlanoJuntarGuia(e.target.value === 'Sim')}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="Sim">Sim</option>
                          <option value="Não">Não</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Tabela de referência</label>
                        <select
                          value={planoTabela}
                          onChange={(e) => setPlanoTabela(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                        >
                          <option value="CBHPM">CBHPM</option>
                          <option value="TUSS">TUSS</option>
                          <option value="Própria">Própria</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.04]">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block mb-4">Dados do Prestador / Contratado neste Plano</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Código na operadora</label>
                        <input
                          type="text"
                          value={planoCodPrestador}
                          onChange={(e) => setPlanoCodPrestador(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Nome do contratado (na guia)</label>
                        <input
                          type="text"
                          value={planoNomeContratado}
                          onChange={(e) => setPlanoNomeContratado(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Código CNES</label>
                        <input
                          type="text"
                          value={planoCNES}
                          onChange={(e) => setPlanoCNES(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Nº inicial da guia</label>
                        <input
                          type="number"
                          value={planoNumGuiaInicial}
                          onChange={(e) => setPlanoNumGuiaInicial(Number(e.target.value))}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Nome do plano na guia TISS</label>
                        <input
                          type="text"
                          value={planoNomePlanoGuia}
                          onChange={(e) => setPlanoNomePlanoGuia(e.target.value)}
                          placeholder="Deixe em branco p/ usar nome da op."
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  {/* LOGOTIPO DO PLANO */}
                  <div className="pt-4 border-t border-white/[0.04]">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block mb-4">Logotopo do Plano (para Impressão de Guias)</span>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-xl border border-dashed border-white/[0.08] bg-[#131622]/40">
                      <div className="w-40 h-16 flex items-center justify-center bg-[#161a26] rounded-lg border border-white/[0.04] overflow-hidden relative group">
                        {planoLogo ? (
                          <img src={planoLogo} alt="Logo do Plano" className="max-w-full max-h-full object-contain p-2" />
                        ) : (
                          <div className="text-slate-600 text-[10px] font-medium">Sem Logotipo</div>
                        )}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/svg+xml"
                          onChange={handleLogoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <p className="text-[10px] text-slate-400">Formatos aceitos: PNG, JPG, SVG</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tamanho recomendado: 160 &times; 52 px</p>
                        <p className="text-[10px] text-slate-500 mt-1">O logo aparecerá na impressão das guias SADT</p>
                        
                        {planoLogo && (
                          <button
                            type="button"
                            onClick={() => setPlanoLogo('')}
                            className="mt-3 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-bold transition-all text-[10px]"
                          >
                            Remover logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OBSERVAÇÕES */}
              <div className="pt-4 border-t border-white/[0.04]">
                <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                <textarea
                  value={planoObs}
                  onChange={(e) => setPlanoObs(e.target.value)}
                  placeholder="Informações adicionais..."
                  rows={3}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              {/* AÇÕES */}
              <div className="pt-6 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlanoModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={planoSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {planoSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proc Modal */}
      {isProcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingProc ? 'Editar Procedimento' : 'Novo Procedimento'}
              </h3>
              <button type="button" onClick={() => setIsProcModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleProcSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Código TUSS *</label>
                  <input
                    type="text"
                    required
                    value={procCodigo}
                    onChange={(e) => setProcCodigo(e.target.value)}
                    placeholder="Ex: 50000136"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo</label>
                  <select
                    value={procTipo}
                    onChange={(e) => setProcTipo(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="Consulta">Consulta</option>
                    <option value="Sessão">Sessão</option>
                    <option value="Exame">Exame</option>
                    <option value="Cirurgia">Cirurgia</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição do Procedimento *</label>
                <input
                  type="text"
                  required
                  value={procDesc}
                  onChange={(e) => setProcDesc(e.target.value)}
                  placeholder="Nome completo do procedimento"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição resumida</label>
                <input
                  type="text"
                  value={procDescCurta}
                  onChange={(e) => setProcDescCurta(e.target.value)}
                  placeholder="Nome curto para exibição"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Valor Particular (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={procValPart}
                    onChange={(e) => setProcValPart(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Valor Convênio Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={procValPlano}
                    onChange={(e) => setProcValPlano(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tabela de referência</label>
                  <select
                    value={procTabela}
                    onChange={(e) => setProcTabela(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="CBHPM">CBHPM</option>
                    <option value="AMB">AMB</option>
                    <option value="TUSS">TUSS</option>
                    <option value="Própria">Própria</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    value={procStatus}
                    onChange={(e) => setProcStatus(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde Vinculado</label>
                <select
                  value={procPlanoId}
                  onChange={(e) => setProcPlanoId(Number(e.target.value))}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value={0}>Todos os planos / Particular (sem vínculo específico)</option>
                  {planos.map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.nome}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Cada plano pode ter sua própria tabela de preços com valores diferentes para o mesmo procedimento.</p>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                <textarea
                  value={procObs}
                  onChange={(e) => setProcObs(e.target.value)}
                  placeholder="Informações adicionais..."
                  rows={2}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsProcModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all"
                >
                  {procSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
