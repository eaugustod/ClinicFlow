import React, { useState } from 'react';
import { Search, UserPlus, Edit3, Trash2, CheckCircle2, AlertCircle, Loader, Camera, Key } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Paciente } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const Pacientes: React.FC = () => {
  const { pacientes, planos, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPac, setEditingPac] = useState<Paciente | null>(null);
  
  // Database Search State
  const [dbSearchResults, setDbSearchResults] = useState<Paciente[]>([]);
  const [searchingDb, setSearchingDb] = useState(false);

  const handleSearchDb = async () => {
    if (!searchQuery.trim()) return;
    setSearchingDb(true);
    try {
      const cleanQuery = searchQuery.trim();
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .or(`nome.ilike.%${cleanQuery}%,cpf.like.%${cleanQuery}%,tel.like.%${cleanQuery}%`)
        .limit(100);

      if (error) throw error;
      if (data) {
        const mapped = data.map(mappers.dbToPac);
        setDbSearchResults(mapped);
      }
    } catch (e) {
      console.error('[ClinicFlow Pacientes] DB search error:', e);
      alert('Erro ao buscar paciente no banco de dados.');
    } finally {
      setSearchingDb(false);
    }
  };

  // Form State
  const [nome, setNome] = useState('');
  const [nasc, setNasc] = useState('');
  const [cpf, setCpf] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [end, setEnd] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('Jundiaí');
  const [ufEnd, setUfEnd] = useState('SP');
  const [planoId, setPlanoId] = useState<number>(5);
  const [carteirinha, setCarteirinha] = useState('');
  const [sexo, setSexo] = useState('M');
  const [status, setStatus] = useState('Ativo');
  const [obs, setObs] = useState('');
  const [foto, setFoto] = useState('');
  const [senhaChat, setSenhaChat] = useState('');
  
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

  // Merge context patients and database search results to avoid duplicates
  const allPacientes = [...pacientes];
  dbSearchResults.forEach(dp => {
    if (!allPacientes.some(p => p.id === dp.id)) {
      allPacientes.push(dp);
    }
  });

  const filteredPacientes = allPacientes.filter(p =>
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.cpf.includes(searchQuery) ||
    p.tel.includes(searchQuery)
  );

  const openAddModal = () => {
    setEditingPac(null);
    setNome('');
    setNasc('');
    setCpf('');
    setTel('');
    setEmail('');
    setEnd('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setCep('');
    setCidade('Jundiaí');
    setUfEnd('SP');
    setPlanoId(planos[0]?.id || 5);
    setCarteirinha('');
    setSexo('M');
    setStatus('Ativo');
    setObs('');
    setFoto('');
    setSenhaChat('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Paciente) => {
    setEditingPac(p);
    setNome(p.nome);
    setNasc(p.nasc);
    setCpf(p.cpf);
    setTel(p.tel);
    setEmail(p.email);
    setEnd(p.end);
    setLogradouro(p.logradouro || '');
    setNumero(p.numero || '');
    setComplemento(p.complemento || '');
    setBairro(p.bairro || '');
    setCep(p.cep || '');
    setCidade(p.cidade || 'Jundiaí');
    setUfEnd(p.ufEnd || 'SP');
    setPlanoId(p.planoId);
    setCarteirinha(p.carteirinha);
    setSexo(p.sexo || 'M');
    setStatus(p.status || 'Ativo');
    setObs(p.obs);
    setFoto(p.foto || '');
    setSenhaChat(p.senhaChat || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const plano = planos.find(pl => pl.id === Number(planoId))?.nome || 'Particular';
    const fullEnd = logradouro ? `${logradouro}, ${numero || 'S/N'}${complemento ? ` (${complemento})` : ''} - ${bairro || ''}, ${cidade} - ${ufEnd}` : end;

    const payload: Partial<Paciente> = {
      nome,
      nasc,
      cpf,
      tel,
      email,
      end: fullEnd,
      logradouro,
      numero,
      complemento,
      bairro,
      cep,
      cidade,
      ufEnd,
      planoId: Number(planoId),
      plano,
      carteirinha,
      sexo,
      status,
      obs,
      foto,
      senhaChat
    };

    try {
      if (editingPac) {
        const { error } = await supabase
          .from('pacientes')
          .update(mappers.pacToDb(payload))
          .eq('id', editingPac.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pacientes')
          .insert([mappers.pacToDb(payload)]);
        if (error) throw error;
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar paciente');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Base de Dados</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Pacientes</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie os registros de pacientes cadastrados na clínica</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <UserPlus size={16} />
          Cadastrar Paciente
        </button>
      </div>

      {/* Filters Card */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex items-center gap-3">
          <Search size={16} className="text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (!val.trim()) {
                setDbSearchResults([]);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchDb();
            }}
            className="flex-1 bg-transparent border-0 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0"
          />
        </div>
        <button
          onClick={handleSearchDb}
          disabled={searchingDb || !searchQuery.trim()}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 rounded-2xl font-bold border border-white/[0.06] transition-all disabled:opacity-50 text-xs cursor-pointer"
          title="Pesquisar diretamente na base de dados completa (Supabase)"
        >
          {searchingDb ? (
            <Loader size={13} className="animate-spin text-indigo-500" />
          ) : (
            <Search size={13} />
          )}
          Buscar no Banco
        </button>
      </div>

      {/* Patients Table */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-[#131622]">
                <th className="p-4">Nome</th>
                <th className="p-4">Convênio / Carteirinha</th>
                <th className="p-4">CPF</th>
                <th className="p-4">Telefone</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredPacientes.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.foto ? (
                        <img
                          src={p.foto}
                          alt={p.nome}
                          className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {p.nome.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{p.nome}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.email || 'Sem e-mail'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-slate-300">{p.plano}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{p.carteirinha}</p>
                  </td>
                  <td className="p-4 font-mono text-slate-400">{p.cpf || '—'}</td>
                  <td className="p-4 text-slate-400">{p.tel || '—'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                      p.status === 'Ativo'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                    }`}>
                      {p.status === 'Ativo' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] rounded-lg text-slate-300 transition-all"
                        title="Editar Paciente"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPacientes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhum paciente cadastrado ou correspondente à busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {editingPac ? 'Editar Paciente' : 'Novo Paciente'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Foto do Paciente */}
                <div className="md:col-span-2 space-y-2 bg-[#161a26]/50 p-3 rounded-xl border border-white/[0.06]">
                  <label className="block text-slate-400 font-semibold text-xs">Foto do Paciente</label>
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

                {/* Senha do Chat */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Senha de Acesso ao Chat / App (`senha_chat`)</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cadastrar ou alterar senha do paciente para o Chat/App..."
                      value={senhaChat}
                      onChange={(e) => setSenhaChat(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data Nascimento</label>
                  <input
                    type="date"
                    value={nasc}
                    onChange={(e) => setNasc(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">CPF</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    placeholder="paciente@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* ENDEREÇO ESTRUTURADO PARA NFS-E */}
                <div className="md:col-span-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
                  <span className="text-xs font-bold text-indigo-400 block uppercase tracking-wider">Endereço Fiscal (Tomador da NFS-e)</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Logradouro (Rua / Av)</label>
                      <input
                        type="text"
                        placeholder="Ex: Rua do Retiro"
                        value={logradouro}
                        onChange={(e) => setLogradouro(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Número</label>
                      <input
                        type="text"
                        placeholder="Ex: 1200"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Complemento</label>
                      <input
                        type="text"
                        placeholder="Apto / Bloco"
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Bairro</label>
                      <input
                        type="text"
                        placeholder="Anhangabaú"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">CEP</label>
                      <input
                        type="text"
                        placeholder="13209-000"
                        value={cep}
                        onChange={(e) => setCep(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1 text-[11px]">Cidade / UF</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                          className="w-3/4 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                        <input
                          type="text"
                          value={ufEnd}
                          onChange={(e) => setUfEnd(e.target.value.toUpperCase())}
                          maxLength={2}
                          className="w-1/4 bg-[#161a26] border border-white/[0.06] rounded-lg px-1 text-center text-white text-xs font-mono uppercase focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde</label>
                  <select
                    value={planoId}
                    onChange={(e) => setPlanoId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Carteirinha</label>
                  <input
                    type="text"
                    value={carteirinha}
                    onChange={(e) => setCarteirinha(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Sexo</label>
                  <select
                    value={sexo}
                    onChange={(e) => setSexo(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl hover:bg-white/5 text-slate-300 font-bold transition-all"
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
