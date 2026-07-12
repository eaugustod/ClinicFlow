import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Loader, Sparkles, Sliders, Palette, Link } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusAgendamento } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const StatusAgendamentoPage: React.FC = () => {
  const { statusAgendamentos, refreshAll } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState('#4f8ef7');
  const [statusAgendamento, setStatusAgendamento] = useState<'agendado' | 'confirmado' | 'atendido' | 'desmarcado' | 'cancelado'>('agendado');
  const [statusHistorico, setStatusHistorico] = useState('');

  const colors = [
    '#6366f1', // Indigo
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#10b981', // Emerald
    '#f43f5e', // Rose
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#f97316', // Orange
    '#06b6d4', // Cyan
  ];

  const openAddModal = () => {
    setEditingId(null);
    setNome('');
    setCor('#6366f1');
    setStatusAgendamento('agendado');
    setStatusHistorico('Agendado');
    setIsModalOpen(true);
  };

  const openEditModal = (item: StatusAgendamento) => {
    setEditingId(item.id || null);
    setNome(item.nome);
    setCor(item.cor);
    setStatusAgendamento(item.statusAgendamento);
    setStatusHistorico(item.statusHistorico || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Deseja remover o status "${name}"?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('status_agendamento')
        .delete()
        .eq('id', id);
      if (error) throw error;
      alert('Status removido!');
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao remover status: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('O nome do status é obrigatório.');
      return;
    }

    setSubmitting(true);
    const payload = mappers.statusAgToDb({
      nome: nome.trim(),
      cor,
      statusAgendamento,
      statusHistorico: statusHistorico.trim() || undefined
    });

    try {
      if (editingId) {
        const { error } = await supabase
          .from('status_agendamento')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        alert('Status atualizado!');
      } else {
        const { error } = await supabase
          .from('status_agendamento')
          .insert([payload]);
        if (error) throw error;
        alert('Status adicionado!');
      }
      setIsModalOpen(false);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao salvar status: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Configurações Gerais</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Status de Agendamento</h2>
          <p className="text-xs text-slate-400 mt-1">Crie status de consulta personalizados e mapeie-os para regras de faturamento e históricos do paciente.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
        >
          <Plus size={14} />
          Novo Status
        </button>
      </div>

      {/* Grid List */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <span className="font-bold text-slate-200 text-sm">Status Cadastrados</span>
          <span className="text-[10px] text-slate-400 font-mono">Total • {statusAgendamentos.length} registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                <th className="p-4 w-1/4">Status</th>
                <th className="p-4 w-1/4">Status Agendamento (Interno)</th>
                <th className="p-4 w-1/4">Status Prontuário/Histórico</th>
                <th className="p-4 text-center w-1/4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {statusAgendamentos.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: item.cor }} />
                    {item.nome}
                  </td>
                  <td className="p-4 text-slate-300 font-semibold uppercase font-mono text-[10px]">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-white/[0.06] bg-white/[0.01]">
                      {item.statusAgendamento}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-semibold">
                    {item.statusHistorico ? (
                      <span className="text-slate-300">{item.statusHistorico}</span>
                    ) : (
                      <span className="text-slate-600 italic">Nenhum log no prontuário</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                        title="Editar"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => item.id && handleDelete(item.id, item.nome)}
                        className="p-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 rounded-lg text-rose-400 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {statusAgendamentos.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum status cadastrado. Clique em "Novo Status" para adicionar.
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
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editingId !== null ? 'Editar Status' : 'Novo Status'}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Cadastre o nome, cor e mapeamento para as regras do sistema</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-lg font-bold" type="button">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Nome do Status *</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Em Espera (Chegou), Pré-Confirmado..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
                  <Palette size={13} className="text-indigo-400" />
                  Cor de Identificação
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCor(c)}
                      className={`w-6 h-6 rounded-full border transition-all ${
                        cor === c ? 'scale-110 border-white ring-2 ring-indigo-500/50' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-6 h-6 rounded-full bg-transparent border-0 cursor-pointer p-0 overflow-hidden"
                  />
                </div>
              </div>

              {/* Base Status Mapping */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Link size={13} className="text-indigo-400" />
                  Mapeamento de Agendamento (Interno) *
                </label>
                <select
                  required
                  value={statusAgendamento}
                  onChange={(e) => setStatusAgendamento(e.target.value as any)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                >
                  <option value="agendado">📅 Agendado (Pendente de atendimento)</option>
                  <option value="confirmado">🔵 Confirmado (Paciente confirmado/Em espera)</option>
                  <option value="atendido">🟢 Atendido (Sessão realizada/Comissão gerada)</option>
                  <option value="desmarcado">🟡 Desmarcado (Cancelamento com aviso prévio)</option>
                  <option value="cancelado">🔴 Cancelado (Falta/Cancelamento sem aviso)</option>
                </select>
                <p className="text-[9px] text-slate-500 mt-1">Garante que o ClinicFlow entenda como processar o faturamento e comissões para esse status.</p>
              </div>

              {/* History Mapping */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Sliders size={13} className="text-indigo-400" />
                  Status no Histórico do Paciente (Prontuário)
                </label>
                <input
                  type="text"
                  value={statusHistorico}
                  onChange={(e) => setStatusHistorico(e.target.value)}
                  placeholder="Ex: Em Espera, Confirmado, Falta (Deixe vazio para não salvar log)"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                />
                <p className="text-[9px] text-slate-500 mt-1">Ao definir um valor, uma alteração neste status irá gravar automaticamente um log no prontuário do paciente.</p>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold text-xs disabled:opacity-50 flex items-center gap-1.5"
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
