import React, { useState } from 'react';
import { Search, UserPlus, Edit3, Trash2, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
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
  const [planoId, setPlanoId] = useState<number>(5);
  const [carteirinha, setCarteirinha] = useState('');
  const [sexo, setSexo] = useState('M');
  const [status, setStatus] = useState('Ativo');
  const [obs, setObs] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

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
    setPlanoId(planos[0]?.id || 5);
    setCarteirinha('');
    setSexo('M');
    setStatus('Ativo');
    setObs('');
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
    setPlanoId(p.planoId);
    setCarteirinha(p.carteirinha);
    setSexo(p.sexo || 'M');
    setStatus(p.status || 'Ativo');
    setObs(p.obs);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const plano = planos.find(pl => pl.id === Number(planoId))?.nome || 'Particular';
    const payload: Partial<Paciente> = {
      nome,
      nasc,
      cpf,
      tel,
      email,
      end,
      planoId: Number(planoId),
      plano,
      carteirinha,
      sexo,
      status,
      obs
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
                    <p className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{p.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.email || 'Sem e-mail'}</p>
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

                <div className="md:col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">Endereço</label>
                  <input
                    type="text"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
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
