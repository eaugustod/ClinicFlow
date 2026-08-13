import React, { useState } from 'react';
import { Search, UserPlus, Edit3, CheckCircle2, AlertCircle, Calendar, CreditCard, Landmark, Camera } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Profissional } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const Profissionais: React.FC = () => {
  const { profissionais, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [modalTab, setModalTab] = useState<'cadastro' | 'financeiro'>('cadastro');

  // Form State - Cadastro
  const [nome, setNome] = useState('');
  const [nomeAgenda, setNomeAgenda] = useState('');
  const [esp, setEsp] = useState('');
  const [conselho, setConselho] = useState('');
  const [num, setNum] = useState('');
  const [uf, setUf] = useState('SP');
  const [cbo, setCbo] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [cor, setCor] = useState('#4f8ef7');
  const [status, setStatus] = useState('Ativo');
  const [foto, setFoto] = useState('');
  
  // Form State - Financeiro / Valores & Pagamento
  const [valor30, setValor30] = useState<number>(0);
  const [valor60, setValor60] = useState<number>(0);
  const [valorAval, setValorAval] = useState<number>(0);
  const [valorParticular, setValorParticular] = useState<number>(0);
  const [valorDesmarqueApos18, setValorDesmarqueApos18] = useState<number>(0);
  const [contaTipo, setContaTipo] = useState<'PF' | 'PJ'>('PF');
  const [pagarComo, setPagarComo] = useState<'pix' | 'ted'>('pix');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [pix, setPix] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredProfissionais = profissionais.filter(p =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.esp.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openAddModal = () => {
    setEditingProf(null);
    setModalTab('cadastro');
    setNome('');
    setNomeAgenda('');
    setEsp('');
    setConselho('');
    setNum('');
    setUf('SP');
    setCbo('');
    setTel('');
    setEmail('');
    setCor('#4f8ef7');
    setStatus('Ativo');
    setFoto('');
    
    // Reset financial
    setValor30(0);
    setValor60(0);
    setValorAval(0);
    setValorParticular(0);
    setValorDesmarqueApos18(0);
    setContaTipo('PF');
    setPagarComo('pix');
    setRazaoSocial('');
    setPix('');
    setBanco('');
    setAgencia('');
    setConta('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Profissional) => {
    setEditingProf(p);
    setModalTab('cadastro');
    setNome(p.nome);
    setNomeAgenda(p.nomeAgenda);
    setEsp(p.esp);
    setConselho(p.conselho);
    setNum(p.num);
    setUf(p.uf || 'SP');
    setCbo(p.cbo);
    setTel(p.tel);
    setEmail(p.email);
    setCor(p.cor || '#4f8ef7');
    setStatus(p.status || 'Ativo');
    setFoto(p.foto || '');
    
    // Set financial
    setValor30(p.valor30 || 0);
    setValor60(p.valor60 || 0);
    setValorAval(p.valorAval || 0);
    setValorParticular(p.valorParticular || 0);
    setValorDesmarqueApos18(p.valorDesmarqueApos18 || 0);
    setContaTipo(p.contaTipo || 'PF');
    setPagarComo(p.pagarComo || 'pix');
    setRazaoSocial(p.razaoSocial || '');
    setPix(p.pix || '');
    setBanco(p.banco || '');
    setAgencia(p.agencia || '');
    setConta(p.conta || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Partial<Profissional> = {
      nome,
      nomeAgenda: nomeAgenda || nome.split(' ')[0],
      esp,
      conselho,
      num,
      uf,
      cbo,
      tel,
      email,
      cor,
      status,
      foto,
      valor30,
      valor60,
      valorAval,
      valorParticular,
      valorDesmarqueApos18,
      contaTipo,
      pagarComo,
      razaoSocial,
      pix,
      banco,
      agencia,
      conta
    };

    try {
      if (editingProf) {
        const { error } = await supabase
          .from('profissionais')
          .update(mappers.profToDb(payload))
          .eq('id', editingProf.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profissionais')
          .insert([mappers.profToDb(payload)]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar profissional');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-4 animate-fade-in text-xs overflow-hidden">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Equipe</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Profissionais</h2>
            <p className="text-xs text-slate-400 mt-1">Gerencie os terapeutas, médicos e dados de repasse da clínica</p>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
          >
            <UserPlus size={16} />
            Adicionar Profissional
          </button>
        </div>

        {/* Search Filter */}
        <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex items-center gap-3">
          <Search size={16} className="text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Buscar por nome ou especialidade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 text-xs"
          />
        </div>
      </div>

      {/* Grid of Professionals Container (Flex-1 overflow-y-auto) */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProfissionais.map((p) => (
          <div
            key={p.id}
            className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-300 group shadow-xl"
          >
            <div>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {p.foto ? (
                    <img
                      src={p.foto}
                      alt={p.nome}
                      className="w-10 h-10 rounded-full object-cover border border-white/20 shadow-md shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: p.cor || '#4f8ef7' }}
                    >
                      {p.nome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors text-xs">
                      {p.nome}
                    </h3>
                    <p className="text-[10px] text-indigo-400 font-semibold tracking-wide uppercase mt-0.5">
                      {p.esp || 'Sem Especialidade'}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                  p.status === 'Ativo'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                }`}>
                  {p.status}
                </span>
              </div>

              {/* General details */}
              <div className="mt-5 space-y-2 text-[10px] text-slate-400">
                <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="font-medium">Conselho / UF:</span>
                  <span className="font-mono text-slate-300">{p.conselho || '—'} {p.num ? `#${p.num}` : ''} / {p.uf || '—'}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="font-medium">Telefone:</span>
                  <span className="text-slate-300">{p.tel || '—'}</span>
                </div>
                
                {/* Financial Summary */}
                <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="font-medium text-indigo-400">Sessão (30m / 60m):</span>
                  <span className="text-slate-300 font-mono font-bold">R$ {p.valor30?.toFixed(2) || '0.00'} / R$ {p.valor60?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="font-medium text-indigo-400">Particular:</span>
                  <span className="text-slate-300 font-mono font-bold">R$ {p.valorParticular?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between border-b border-white/[0.02] pb-1.5">
                  <span className="font-medium text-indigo-400">Desmarque pós 18h:</span>
                  <span className="text-slate-300 font-mono font-bold">R$ {p.valorDesmarqueApos18?.toFixed(2) || '0.00'}</span>
                </div>
                
                {p.pagarComo === 'pix' ? (
                  <div className="flex justify-between">
                    <span className="font-medium text-emerald-400">Chave PIX ({p.contaTipo}):</span>
                    <span className="text-slate-300 font-mono truncate max-w-[150px]">{p.pix || '—'}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="font-medium text-emerald-400">TED / Conta:</span>
                    <span className="text-slate-300 font-mono truncate max-w-[150px]">{p.banco} Ag. {p.agencia} CC {p.conta}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/[0.04] flex justify-end">
              <button
                onClick={() => openEditModal(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-xl text-[10px] font-bold text-slate-300 transition-all"
              >
                <Edit3 size={11} />
                Editar Perfil
              </button>
            </div>
          </div>
        ))}
        {filteredProfissionais.length === 0 && (
          <div className="col-span-full py-12 text-center text-[#555d74] font-medium text-xs">
            Nenhum profissional cadastrado ou correspondente à busca.
          </div>
        )}
        </div>
      </div>

      {/* Professional Modal with Tabs */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {editingProf ? 'Editar Profissional' : 'Adicionar Profissional'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Cadastre o perfil e configure as regras de repasse e dados bancários</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/[0.04] px-6 bg-[#131622]/20">
              <button
                type="button"
                onClick={() => setModalTab('cadastro')}
                className={`flex items-center gap-1.5 py-3 px-4 border-b-2 font-bold tracking-wide transition-all ${
                  modalTab === 'cadastro' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar size={13} />
                Dados Cadastrais
              </button>
              <button
                type="button"
                onClick={() => setModalTab('financeiro')}
                className={`flex items-center gap-1.5 py-3 px-4 border-b-2 font-bold tracking-wide transition-all ${
                  modalTab === 'financeiro' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <CreditCard size={13} />
                Valores & Pagamento
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {modalTab === 'cadastro' ? (
                /* TAB 1: CADASTRO */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Foto do Profissional */}
                    <div className="md:col-span-2 space-y-2 bg-[#161a26]/50 p-3 rounded-xl border border-white/[0.06]">
                      <label className="block text-slate-400 font-semibold text-xs">Foto do Profissional</label>
                      <div className="flex items-center gap-4">
                        {foto ? (
                          <img src={foto} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-md shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#1c2234] border border-white/10 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                            Sem Foto
                          </div>
                        )}
                        <div className="flex-1 space-y-1.5">
                          <input
                            type="text"
                            placeholder="URL da foto ou escolha um arquivo..."
                            value={foto}
                            onChange={(e) => setFoto(e.target.value)}
                            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                            <Camera size={12} />
                            <span>Escolher Foto do Computador</span>
                            <input type="file" accept="image/*" onChange={handleFotoChange} className="hidden" />
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-semibold mb-1">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nome na Agenda</label>
                      <input
                        type="text"
                        value={nomeAgenda}
                        onChange={(e) => setNomeAgenda(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Especialidade</label>
                      <input
                        type="text"
                        required
                        value={esp}
                        onChange={(e) => setEsp(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Conselho (Ex: CRM, CRP)</label>
                      <input
                        type="text"
                        value={conselho}
                        onChange={(e) => setConselho(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nº Registro Conselho</label>
                      <input
                        type="text"
                        value={num}
                        onChange={(e) => setNum(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">UF Conselho</label>
                      <input
                        type="text"
                        value={uf}
                        onChange={(e) => setUf(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Código CBO</label>
                      <input
                        type="text"
                        value={cbo}
                        onChange={(e) => setCbo(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                      <input
                        type="text"
                        value={tel}
                        onChange={(e) => setTel(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">E-mail</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Cor Identificadora</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={cor}
                          onChange={(e) => setCor(e.target.value)}
                          className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={cor}
                          onChange={(e) => setCor(e.target.value)}
                          className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        <option value="Ativo">Ativo</option>
                        <option value="Inativo">Inativo</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: VALORES & PAGAMENTO */
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Sessão 30m (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valor30}
                        onChange={(e) => setValor30(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Sessão 60m (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valor60}
                        onChange={(e) => setValor60(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Particular (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorParticular}
                        onChange={(e) => setValorParticular(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Aval. Neuro (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorAval}
                        onChange={(e) => setValorAval(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Desm. &gt;18h (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorDesmarqueApos18}
                        onChange={(e) => setValorDesmarqueApos18(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tipo de Conta</label>
                      <select
                        value={contaTipo}
                        onChange={(e) => setContaTipo(e.target.value as any)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        <option value="PF">Pessoa Física (PF)</option>
                        <option value="PJ">Pessoa Jurídica (PJ)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Forma de Pagamento</label>
                      <select
                        value={pagarComo}
                        onChange={(e) => setPagarComo(e.target.value as any)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        <option value="pix">PIX</option>
                        <option value="ted">TED / Transferência</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Nome / Razão Social</label>
                    <input
                      type="text"
                      placeholder="Nome completo ou Razão Social do beneficiário"
                      value={razaoSocial}
                      onChange={(e) => setRazaoSocial(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                    />
                  </div>

                  {pagarComo === 'pix' ? (
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Chave PIX</label>
                      <input
                        type="text"
                        placeholder="CPF, CNPJ, E-mail, Celular ou chave aleatória"
                        value={pix}
                        onChange={(e) => setPix(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4 animate-fade-in">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Banco</label>
                        <input
                          type="text"
                          placeholder="Ex: Nubank"
                          value={banco}
                          onChange={(e) => setBanco(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Agência</label>
                        <input
                          type="text"
                          placeholder="0001"
                          value={agencia}
                          onChange={(e) => setAgencia(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Conta Corrente</label>
                        <input
                          type="text"
                          placeholder="12345-6"
                          value={conta}
                          onChange={(e) => setConta(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-3 bg-[#131622]/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50"
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
