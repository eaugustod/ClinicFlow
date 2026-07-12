import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, Key, Calendar, ClipboardList, Filter, Edit3, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { SenhaPlano, ProcedimentoSenha } from '../types';

export const Senhas: React.FC = () => {
  const { senhas, lazyLoadSenhas, planos, pacientes, procedimentos, refreshAll } = useApp();

  const [buscaPac, setBuscaPac] = useState('');
  const [planoFiltro, setPlanoFiltro] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSenha, setEditingSenha] = useState<SenhaPlano | null>(null);

  // Form State
  const [planoId, setPlanoId] = useState<number>(planos[0]?.id || 5);
  const [paciente, setPaciente] = useState('');
  const [carteirinha, setCarteirinha] = useState('');
  const [numGuiaOp, setNumGuiaOp] = useState('');
  const [numSenha, setNumSenha] = useState('');
  const [dataAut, setDataAut] = useState(new Date().toISOString().split('T')[0]);
  const [validade, setValidade] = useState('');
  const [qtdAutorizada, setQtdAutorizada] = useState<number>(10);
  const [qtdUsada, setQtdUsada] = useState<number>(0);
  const [cid, setCid] = useState('');
  const [status, setStatus] = useState<'Ativa' | 'Vencida' | 'Usada' | 'Cancelada'>('Ativa');
  const [obs, setObs] = useState('');
  const [procs, setProcs] = useState<ProcedimentoSenha[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Trigger lazy loading on mount
  useEffect(() => {
    lazyLoadSenhas();
  }, []);

  // Generate month list strictly from the dataAut field
  const meses = Array.from(new Set(
    senhas.map(s => (s.dataAut || '').slice(0, 7)).filter(Boolean)
  )).sort().reverse();

  // Filter list
  let filtered = senhas;
  if (planoFiltro) {
    filtered = filtered.filter(s => String(s.planoId) === planoFiltro);
  }
  if (mesFiltro) {
    filtered = filtered.filter(s => s.dataAut && s.dataAut.slice(0, 7) === mesFiltro);
  }
  if (statusFiltro) {
    filtered = filtered.filter(s => s.status === statusFiltro);
  }
  if (buscaPac.trim()) {
    const q = buscaPac.toLowerCase().trim();
    filtered = filtered.filter(s => s.paciente.toLowerCase().includes(q));
  }

  // Stats calculation
  const ativas = filtered.filter(s => s.status === 'Ativa').length;
  const vencidas = filtered.filter(s => s.status === 'Vencida').length;
  const usadas = filtered.filter(s => s.status === 'Usada').length;

  const stats = [
    { label: 'Exibidas', val: filtered.length, color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10' },
    { label: 'Ativas', val: ativas, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' },
    { label: 'Vencidas', val: vencidas, color: 'text-rose-400 bg-rose-500/5 border-rose-500/10' },
    { label: 'Usadas / Concluídas', val: usadas, color: 'text-slate-400 bg-white/5 border-white/[0.04]' },
  ];

  // Handlers
  const openAddModal = () => {
    setEditingSenha(null);
    setPlanoId(planos[0]?.id || 5);
    setPaciente('');
    setCarteirinha('');
    setNumGuiaOp('');
    setNumSenha('');
    setDataAut(new Date().toISOString().split('T')[0]);
    setValidade('');
    setQtdAutorizada(10);
    setQtdUsada(0);
    setCid('');
    setStatus('Ativa');
    setObs('');
    setProcs([{ codigo: procedimentos[0]?.codigo || '50000470', desc: procedimentos[0]?.desc || 'Sessão de Terapia' }]);
    setIsModalOpen(true);
  };

  const openEditModal = (s: SenhaPlano) => {
    setEditingSenha(s);
    setPlanoId(s.planoId);
    setPaciente(s.paciente);
    setCarteirinha(s.carteirinha || '');
    setNumGuiaOp(s.numGuiaOp || '');
    setNumSenha(s.numSenha);
    setDataAut(s.dataAut || '');
    setValidade(s.validade || '');
    setQtdAutorizada(s.qtdAutorizada);
    setQtdUsada(s.qtdUsada);
    setCid(s.cid || '');
    setStatus(s.status);
    setObs(s.obs || '');
    setProcs(s.procs && s.procs.length > 0 ? s.procs : [{ codigo: procedimentos[0]?.codigo || '50000470', desc: procedimentos[0]?.desc || 'Sessão de Terapia' }]);
    setIsModalOpen(true);
  };

  const handlePacienteChange = (val: string) => {
    setPaciente(val);
    const pac = pacientes.find(p => p.nome === val);
    if (pac) {
      setCarteirinha(pac.carteirinha || '');
      setPlanoId(pac.planoId);
    }
  };

  const addProcRow = () => {
    const defaultProc = procedimentos[0];
    setProcs([
      ...procs,
      {
        codigo: defaultProc?.codigo || '50000470',
        desc: defaultProc?.desc || 'Sessão de Terapia'
      }
    ]);
  };

  const removeProcRow = (idx: number) => {
    if (procs.length > 1) {
      setProcs(procs.filter((_, i) => i !== idx));
    }
  };

  const updateProcRow = (idx: number, field: keyof ProcedimentoSenha, val: string) => {
    const updated = procs.map((p, i) => {
      if (i !== idx) return p;
      const newP = { ...p, [field]: val };
      if (field === 'codigo') {
        const pr = procedimentos.find(x => x.codigo === val);
        if (pr) newP.desc = pr.desc;
      }
      return newP;
    });
    setProcs(updated);
  };

  const handleDeleteSenha = async (senha: SenhaPlano) => {
    if (!confirm(`Deseja realmente excluir a senha ${senha.numSenha} do paciente ${senha.paciente}?`)) {
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('senhas_plano')
        .delete()
        .eq('id', senha.id);
      if (error) throw error;

      await refreshAll();
      alert('Senha excluída com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir senha.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Partial<SenhaPlano> = {
      planoId: Number(planoId),
      paciente,
      carteirinha,
      numGuiaOp,
      numSenha,
      dataAut,
      validade,
      qtdAutorizada: Number(qtdAutorizada),
      qtdUsada: Number(qtdUsada),
      cid,
      status,
      obs,
      procs,
      ativa: status === 'Ativa'
    };

    try {
      if (editingSenha) {
        const { error } = await supabase.from('senhas_plano').update(mappers.senhaToDb(payload)).eq('id', editingSenha.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('senhas_plano').insert([mappers.senhaToDb(payload)]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar senha de autorização.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-xs">
      {/* STICKY HEADER AND CONTROLS */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] space-y-4">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans font-semibold">Faturamento</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Senhas & Autorizações</h2>
            <p className="text-xs text-slate-400 mt-1">Gerenciamento e controle de senhas de atendimento liberadas pelos planos</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            Nova senha/autorização
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {stats.map((s, idx) => (
            <div key={idx} className={`p-5 rounded-2xl border ${s.color} backdrop-blur-md shadow-lg`}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-2xl font-black mt-2 text-white">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Filters Area */}
        <div className="p-6 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.03] text-[10px] font-bold text-slate-300 uppercase tracking-wider">
            <Filter size={14} className="text-indigo-400" />
            <span>Filtros Rápidos</span>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[240px] relative">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Pesquisar por nome do paciente..."
                value={buscaPac}
                onChange={(e) => setBuscaPac(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0f1118]/60 border border-white/[0.04] focus:border-indigo-500/50 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all duration-200"
              />
            </div>

            <select
              value={planoFiltro}
              onChange={(e) => setPlanoFiltro(e.target.value)}
              className="px-4 py-2.5 bg-[#0f1118]/60 border border-white/[0.04] focus:border-indigo-500/50 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="">Todos os planos</option>
              {planos.filter(p => p.status === 'Ativo').map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>

            <select
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              className="px-4 py-2.5 bg-[#0f1118]/60 border border-white/[0.04] focus:border-indigo-500/50 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="">Todos os períodos</option>
              {meses.map(m => {
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

            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="px-4 py-2.5 bg-[#0f1118]/60 border border-white/[0.04] focus:border-indigo-500/50 rounded-xl text-xs text-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="">Todos os status</option>
              <option value="Ativa">Ativa</option>
              <option value="Vencida">Vencida</option>
              <option value="Usada">Usada</option>
              <option value="Cancelada">Cancelada</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-white/[0.04] text-slate-400 font-bold uppercase tracking-wider text-[9px] pb-3 bg-[#131622]">
                <th className="pb-3 px-2">Paciente</th>
                <th className="pb-3 px-2">Plano</th>
                <th className="pb-3 px-2">Nº Senha</th>
                <th className="pb-3 px-2 text-center">Qtd. Autorizada</th>
                <th className="pb-3 px-2 text-center">Qtd. Usada</th>
                <th className="pb-3 px-4 text-center">Data Aut.</th>
                <th className="pb-3 px-4 text-center">Validade</th>
                <th className="pb-3 px-2">Status</th>
                <th className="pb-3 px-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filtered.map((s) => {
                const plan = planos.find(p => p.id === s.planoId);
                const color = s.status === 'Ativa' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : s.status === 'Vencida' ? 'bg-rose-500/10 text-rose-400 border-rose-500/15' : 'bg-white/5 text-[#8b92a8] border-transparent';
                return (
                  <tr key={s.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="py-4 px-2 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{s.paciente}</td>
                    <td className="py-4 px-2 text-slate-400 font-semibold">{plan?.nome || 'Particular'}</td>
                    <td className="py-4 px-2 text-slate-200 font-mono tracking-wider">{s.numSenha}</td>
                    <td className="py-4 px-2 text-center text-slate-300 font-medium">{s.qtdAutorizada}</td>
                    <td className="py-4 px-2 text-center text-slate-300 font-medium">{s.qtdUsada}</td>
                    <td className="py-4 px-4 text-center text-slate-400 font-semibold font-mono">{s.dataAut.split('-').reverse().join('/')}</td>
                    <td className="py-4 px-4 text-center text-slate-400 font-semibold font-mono">{s.validade.split('-').reverse().join('/')}</td>
                    <td className="py-4 px-2">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${color}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                        title="Editar"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteSenha(s)}
                        className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/20 rounded-lg text-slate-300 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhuma senha encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                {editingSenha ? 'Editar Autorização / Senha' : 'Nova Autorização / Senha'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde *</label>
                  <select
                    value={planoId}
                    onChange={(e) => setPlanoId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Paciente *</label>
                  <select
                    value={paciente}
                    onChange={(e) => handlePacienteChange(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                    required
                  >
                    <option value="">— Selecione —</option>
                    {pacientes.filter(p => p.status === 'Ativo').map(p => (
                      <option key={p.id} value={p.nome}>{p.nome}</option>
                    ))}
                    {paciente && !pacientes.some(p => p.nome === paciente && p.status === 'Ativo') && (
                      <option value={paciente}>{paciente}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                  <input
                    type="text"
                    value={carteirinha}
                    onChange={(e) => setCarteirinha(e.target.value)}
                    placeholder="000000000000000"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Guia na Operadora</label>
                  <input
                    type="text"
                    value={numGuiaOp}
                    onChange={(e) => setNumGuiaOp(e.target.value)}
                    placeholder="Nº atribuído pelo plano"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block pt-2 border-t border-white/[0.02]">Dados da Autorização</div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Senha / Autorização *</label>
                  <input
                    type="text"
                    required
                    value={numSenha}
                    onChange={(e) => setNumSenha(e.target.value)}
                    placeholder="Ex: 2026030001"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data da Autorização</label>
                  <input
                    type="date"
                    required
                    value={dataAut}
                    onChange={(e) => setDataAut(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Validade da Senha</label>
                  <input
                    type="date"
                    value={validade}
                    onChange={(e) => setValidade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Qtd. Sessões Autorizadas</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={qtdAutorizada}
                    onChange={(e) => setQtdAutorizada(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block pt-2 border-t border-white/[0.02]">Procedimentos Autorizados</div>
              
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {procs.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
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
                    <div className="col-span-7">
                      <input
                        type="text"
                        value={p.desc}
                        onChange={(e) => updateProcRow(idx, 'desc', e.target.value)}
                        placeholder="Descrição do procedimento"
                        className="w-full bg-[#161a26]/40 border border-white/[0.06] rounded-lg px-2 py-1.5 text-white"
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
                className="w-full py-1.5 border border-dashed border-white/[0.08] hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-xl font-semibold text-slate-400 hover:text-indigo-400 transition-all"
              >
                + Adicionar Procedimento
              </button>

              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block pt-2 border-t border-white/[0.02]">Outros</div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">CID-10</label>
                  <input
                    type="text"
                    value={cid}
                    onChange={(e) => setCid(e.target.value)}
                    placeholder="Ex: F80.0"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="Ativa">Ativa</option>
                    <option value="Usada">Usada</option>
                    <option value="Vencida">Vencida</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={2}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 resize-none"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
