import React, { useState, useEffect } from 'react';
import { Search, Plus, Clock, CheckCircle2, XCircle, Edit3 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ListaEspera } from '../types';
import { supabase } from '../services/supabase';

export const Espera: React.FC = () => {
  const { espera, lazyLoadEspera, refreshAll } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [obs, setObs] = useState('');
  const [plano, setPlano] = useState('Particular');
  const [carteirinha, setCarteirinha] = useState('');

  useEffect(() => {
    lazyLoadEspera();
  }, []);

  const filteredEspera = espera.filter(e =>
    e.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.tel.includes(searchQuery)
  );

  const openAddModal = () => {
    setNome('');
    setTel('');
    setEmail('');
    setObs('');
    setPlano('Particular');
    setCarteirinha('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      nome,
      tel,
      email,
      obs,
      plano,
      carteirinha,
      status: 'Aguardando',
      data_entrada: new Date().toLocaleDateString('pt-BR')
    };

    try {
      const { error } = await supabase.from('lista_espera').insert([payload]);
      if (error) throw error;
      setIsModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao adicionar à lista de espera');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Fila de Atendimento</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Lista de Espera</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie os pacientes que aguardam por vagas na agenda dos profissionais</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus size={16} />
          Adicionar Paciente
        </button>
      </div>

      {/* Filter bar */}
      <div className="p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl flex items-center gap-3">
        <Search size={16} className="text-slate-400 ml-1" />
        <input
          type="text"
          placeholder="Buscar na lista de espera..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-transparent border-0 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0"
        />
      </div>

      {/* Espera List Table */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                <th className="p-4">Paciente</th>
                <th className="p-4">Contato / Plano</th>
                <th className="p-4 text-center">Data Entrada</th>
                <th className="p-4">Observações</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {filteredEspera.map((e) => (
                <tr key={e.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4">
                    <p className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{e.nome}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{e.email || 'Sem e-mail'}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-slate-300 font-semibold">{e.tel}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{e.plano} {e.carteirinha ? `(${e.carteirinha})` : ''}</p>
                  </td>
                  <td className="p-4 text-center font-mono text-slate-400">{e.dataEntrada}</td>
                  <td className="p-4 text-slate-400 max-w-[200px] truncate" title={e.obs}>{e.obs || '—'}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold border ${
                      e.status === 'Aguardando'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                        : e.status === 'Convertido'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                    }`}>
                      {e.status === 'Aguardando' ? <Clock size={10} /> : e.status === 'Convertido' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                      {e.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      {e.status === 'Aguardando' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(e, 'Convertido')}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/10 rounded-lg text-emerald-400 text-[10px] font-bold transition-all"
                          >
                            Agendar
                          </button>
                          <button
                            onClick={() => handleStatusChange(e, 'Cancelado')}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/10 rounded-lg text-rose-400 text-[10px] font-bold transition-all"
                          >
                            Remover
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEspera.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhum paciente aguardando vaga.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Adicionar à Fila de Espera
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
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
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                  <input
                    type="text"
                    value={carteirinha}
                    onChange={(e) => setCarteirinha(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações / Requisitos de Horário</label>
                <textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="Ex: Disponível somente de tarde. Aguardando terapia de integração sensorial."
                />
              </div>
              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold"
                >
                  {submitting ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
