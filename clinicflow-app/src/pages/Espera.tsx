import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, CheckCircle2, XCircle, Edit3, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ListaEspera } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const Espera: React.FC = () => {
  const { espera, lazyLoadEspera, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ListaEspera | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [idade, setIdade] = useState('');
  const [periodo, setPeriodo] = useState('Ambos');
  const [obs, setObs] = useState('');
  const [plano, setPlano] = useState('Particular');
  const [carteirinha, setCarteirinha] = useState('');

  useEffect(() => {
    lazyLoadEspera();
  }, []);

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

  const filteredEspera = espera.filter(e =>
    e.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.tel && e.tel.includes(searchQuery)) ||
    (e.especialidade && e.especialidade.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.periodo && e.periodo.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.plano && e.plano.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAddModal = () => {
    setEditingItem(null);
    setNome('');
    setTel('');
    setEmail('');
    setEspecialidade('');
    setIdade('');
    setPeriodo('Ambos');
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
    setEspecialidade(item.especialidade || '');
    setIdade(item.idade || '');
    setPeriodo(item.periodo || 'Ambos');
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

    const payload: Partial<ListaEspera> = {
      nome,
      tel,
      email,
      especialidade,
      idade,
      periodo,
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

  // Helper to fix display if especialidade contains plan name
  const isPlanoName = (str?: string) => {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes('sulamerica') || s.includes('sul américa') || s.includes('bradesco') || s.includes('amil') || s.includes('particular') || s.includes('unimed');
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Fila de Atendimento</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Lista de Espera</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie os pacientes que aguardam por vagas na agenda dos profissionais</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
        >
          <Plus size={16} />
          Adicionar Paciente
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex items-center gap-3 shadow-lg">
        <Search size={16} className="text-slate-400 ml-1" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone, especialidade, convênio ou período..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-0 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0"
        />
      </div>

      {/* Table Section */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.02]">
                <th className="py-4 px-4">Paciente</th>
                <th className="py-4 px-4">Especialidade / Idade</th>
                <th className="py-4 px-4 text-center">Período Desejado</th>
                <th className="py-4 px-4">Contato / Convênio</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">Data Cadastro</th>
                <th className="py-4 px-4">Observações</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {filteredEspera.map((e) => {
                const specDisplay = isPlanoName(e.especialidade) ? 'Geral' : (e.especialidade || 'Geral');
                const planoDisplay = e.plano || (isPlanoName(e.especialidade) ? e.especialidade : 'Particular');
                return (
                  <tr key={e.id} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors text-sm">{e.nome}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{e.email || 'Sem e-mail'}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-1">
                        {specDisplay}
                      </span>
                      <p className="text-[10px] text-slate-400">{e.idade ? `Idade: ${e.idade}` : 'Idade não inf.'}</p>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                        ⏱️ {e.periodo || 'Ambos'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="text-slate-200 font-semibold font-mono tracking-wide">{formatTelefone(e.tel)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{planoDisplay} {e.carteirinha ? `(${e.carteirinha})` : ''}</p>
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono text-slate-300 font-medium whitespace-nowrap">
                      {formatDataBr(e.dataCadastro || e.dataEntrada)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 max-w-[180px] truncate" title={e.obs || 'Nenhuma observação'}>
                      {e.obs || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                        e.status === 'Aguardando'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : e.status === 'Convertido'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {e.status === 'Aguardando' ? <Clock size={11} /> : e.status === 'Convertido' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {e.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(e)}
                          className="p-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg text-slate-300 transition-all cursor-pointer"
                          title="Editar cadastro"
                        >
                          <Edit3 size={13} />
                        </button>
                        {e.status === 'Aguardando' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(e, 'Convertido')}
                              className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/20 rounded-lg text-emerald-400 text-[10px] font-bold transition-all cursor-pointer"
                            >
                              Agendar
                            </button>
                            <button
                              onClick={() => handleStatusChange(e, 'Cancelado')}
                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/15 rounded-lg text-amber-400 text-[10px] font-bold transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(e)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/15 rounded-lg text-rose-400 transition-all cursor-pointer"
                          title="Excluir"
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
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
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

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Especialidade</label>
                  <select
                    value={especialidade}
                    onChange={(e) => setEspecialidade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="">— Selecione —</option>
                    <option value="AN">AN</option>
                    <option value="Psicologia">Psicologia</option>
                    <option value="Fonoterapia">Fonoterapia</option>
                    <option value="Terapia Ocupacional">Terapia Ocupacional</option>
                    <option value="ABA">ABA</option>
                    <option value="Psicopedagogia">Psicopedagogia</option>
                    <option value="Musicoterapia">Musicoterapia</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Idade</label>
                  <input
                    type="text"
                    placeholder="Ex: 8 anos"
                    value={idade}
                    onChange={(e) => setIdade(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Período *</label>
                  <select
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl px-2.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                  >
                    <option value="Manhã">Manhã</option>
                    <option value="Tarde">Tarde</option>
                    <option value="Ambos">Ambos</option>
                    <option value="Online">Online</option>
                  </select>
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
                  placeholder="Ex: Disponível somente de tarde."
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
