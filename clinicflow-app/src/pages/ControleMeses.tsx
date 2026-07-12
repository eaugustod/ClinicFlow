import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Lock, Unlock, Edit3, Trash2, Loader, HelpCircle } from 'lucide-react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { ControleMeses as IControleMeses } from '../types';

export const ControleMeses: React.FC = () => {
  const [months, setMonths] = useState<IControleMeses[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  
  // Modal States
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  
  // Form States
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [mes, setMes] = useState('01');
  const [status, setStatus] = useState<'aberto' | 'fechado'>('aberto');
  const [obs, setObs] = useState('');

  const loadMonths = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('controle_meses')
        .select('*')
        .order('ano_mes', { ascending: false });
      
      if (error) throw error;
      const mapped = (data || []).map(mappers.dbToControle);
      setMonths(mapped);
      setSyncStatus(`Sincronizado • ${mapped.length} registro(s)`);
    } catch (e: any) {
      console.error(e);
      setSyncStatus(`Erro ao carregar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonths();
  }, []);

  const openAddModal = () => {
    const now = new Date();
    setEditId(null);
    setAno(now.getFullYear());
    setMes(String(now.getMonth() + 1).padStart(2, '0'));
    setStatus('aberto');
    setObs('');
    setIsOpen(true);
  };

  const openEditModal = (item: IControleMeses) => {
    setEditId(item.id);
    const [y, m] = item.anoMes.split('-');
    setAno(Number(y));
    setMes(m || '01');
    setStatus(item.status);
    setObs(item.obs);
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir o controle de fechamento deste mês?')) return;
    try {
      const { error } = await supabase
        .from('controle_meses')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Controle excluído com sucesso.');
      loadMonths();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao excluir: ${e.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const formattedAnoMes = `${ano}-${String(mes).padStart(2, '0')}`;
    const payload: Partial<IControleMeses> = {
      anoMes: formattedAnoMes,
      status,
      obs,
      alteradoPor: 'Administrador'
    };

    try {
      if (editId) {
        const { error } = await supabase
          .from('controle_meses')
          .update(mappers.controleToDb(payload))
          .eq('id', editId);
        if (error) throw error;
        alert('Controle de mês atualizado!');
      } else {
        // Check for duplicates
        const duplicated = months.some(m => m.anoMes === formattedAnoMes);
        if (duplicated) {
          alert('Este mês/ano já está cadastrado.');
          setSubmitting(false);
          return;
        }

        const { error } = await supabase
          .from('controle_meses')
          .insert([mappers.controleToDb(payload)]);
        if (error) throw error;
        alert('Controle de mês criado!');
      }
      setIsOpen(false);
      loadMonths();
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar controle de mês: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatAnoMes = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Administração do Sistema</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Controle de Meses</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie o status de abertura/fechamento de cada mês para controle de alterações na agenda.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
        >
          <Plus size={14} />
          Novo Mês
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3 shadow-lg">
        <HelpCircle size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 leading-relaxed">
          <strong className="text-white">Como funciona:</strong> Meses com status <strong className="text-rose-400 font-bold">Fechado</strong> bloqueiam qualquer alteração nos agendamentos por usuários com perfil <strong className="text-slate-200">Recepção</strong> e <strong className="text-slate-200">Profissional</strong>. Apenas <strong className="text-indigo-400 font-bold">Administradores</strong> podem editar agendamentos em meses fechados. Crie um registro para cada mês que deseja controlar.
        </p>
      </div>

      {/* Table Card */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <span className="font-bold text-slate-200 text-sm">Meses Cadastrados</span>
          <span className="text-[10px] text-slate-400 font-mono">{syncStatus}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                <th className="p-4">Mês / Ano</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Observações</th>
                <th className="p-4">Alterado Por</th>
                <th className="p-4">Última Alteração</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader size={16} className="animate-spin text-indigo-500 inline-block mr-2" />
                    Carregando controle de meses...
                  </td>
                </tr>
              ) : months.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors font-mono">{formatAnoMes(m.anoMes)}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                      m.status === 'fechado'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                    }`}>
                      {m.status === 'fechado' ? <Lock size={10} /> : <Unlock size={10} />}
                      {m.status === 'fechado' ? 'Fechado' : 'Aberto'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-300 max-w-[220px] truncate" title={m.obs}>{m.obs || '—'}</td>
                  <td className="p-4 text-slate-400 font-semibold">{m.alteradoPor}</td>
                  <td className="p-4 text-slate-400 font-mono">{formatDate(m.updatedAt || m.createdAt || '')}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(m)}
                        className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                        title="Editar"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 rounded-lg text-rose-400 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {months.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum mês cadastrado. Clique em "Novo Mês" para adicionar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editId ? 'Editar Mês' : 'Novo Mês'}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Cadastre o controle de abertura/fechamento da agenda</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Ano *</label>
                  <input
                    type="number"
                    required
                    min={2020}
                    max={2099}
                    value={ano}
                    onChange={(e) => setAno(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Mês *</label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                  >
                    <option value="01">Janeiro</option>
                    <option value="02">Fevereiro</option>
                    <option value="03">Março</option>
                    <option value="04">Abril</option>
                    <option value="05">Maio</option>
                    <option value="06">Junho</option>
                    <option value="07">Julho</option>
                    <option value="08">Agosto</option>
                    <option value="09">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Status *</label>
                <div className="flex gap-4 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setStatus('aberto')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${
                      status === 'aberto'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-lg shadow-emerald-500/5'
                        : 'bg-white/[0.01] text-slate-400 border-white/[0.04] hover:bg-white/[0.03]'
                    }`}
                  >
                    <Unlock size={12} />
                    Aberto
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('fechado')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${
                      status === 'fechado'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/25 shadow-lg shadow-rose-500/5'
                        : 'bg-white/[0.01] text-slate-400 border-white/[0.04] hover:bg-white/[0.03]'
                    }`}
                  >
                    <Lock size={12} />
                    Fechado
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                <textarea
                  rows={3}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none text-xs focus:outline-none"
                  placeholder="Descreva o motivo de fechar ou abrir o período..."
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                >
                  {submitting && <Loader size={12} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
