import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CalendarCheck, Edit3, Loader, Sparkles } from 'lucide-react';
import { Feriado } from '../types';

export const Feriados: React.FC = () => {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form States
  const [data, setData] = useState('');
  const [desc, setDesc] = useState('');

  const defaultFeriados: Feriado[] = [
    { data: '2026-01-01', desc: 'Confraternização Universal' },
    { data: '2026-02-16', desc: 'Carnaval' },
    { data: '2026-02-17', desc: 'Carnaval' },
    { data: '2026-04-03', desc: 'Sexta-feira Santa' },
    { data: '2026-04-21', desc: 'Tiradentes' },
    { data: '2026-05-01', desc: 'Dia do Trabalho' },
    { data: '2026-06-04', desc: 'Corpus Christi' },
    { data: '2026-09-07', desc: 'Independência do Brasil' },
    { data: '2026-10-12', desc: 'Nossa Senhora Aparecida' },
    { data: '2026-11-02', desc: 'Finados' },
    { data: '2026-11-15', desc: 'Proclamação da República' },
    { data: '2026-12-25', desc: 'Natal' }
  ];

  const loadFeriados = () => {
    const saved = localStorage.getItem('cf_feriados');
    if (saved) {
      try {
        setFeriados(JSON.parse(saved));
      } catch (e) {
        console.error(e);
        setFeriados(defaultFeriados);
      }
    } else {
      setFeriados(defaultFeriados);
      localStorage.setItem('cf_feriados', JSON.stringify(defaultFeriados));
    }
  };

  useEffect(() => {
    loadFeriados();
  }, []);

  const openAddModal = () => {
    setEditingIndex(null);
    setData('');
    setDesc('');
    setIsModalOpen(true);
  };

  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setData(feriados[index].data);
    setDesc(feriados[index].desc);
    setIsModalOpen(true);
  };

  const handleDelete = (index: number) => {
    if (!confirm(`Deseja remover o feriado "${feriados[index].desc}"?`)) return;
    const updated = feriados.filter((_, i) => i !== index);
    setFeriados(updated);
    localStorage.setItem('cf_feriados', JSON.stringify(updated));
    alert('Feriado removido!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !desc.trim()) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    // Check duplicate dates, ignoring current editing index
    const dateExists = feriados.some((f, idx) => f.data === data && idx !== editingIndex);
    if (dateExists) {
      alert('Já existe um feriado cadastrado para esta data.');
      return;
    }

    let updated = [...feriados];
    if (editingIndex !== null) {
      updated[editingIndex] = { data, desc: desc.trim() };
    } else {
      updated.push({ data, desc: desc.trim() });
    }

    // Sort by date chronologically
    updated.sort((a, b) => a.data.localeCompare(b.data));

    setFeriados(updated);
    localStorage.setItem('cf_feriados', JSON.stringify(updated));
    setIsModalOpen(false);
    alert(editingIndex !== null ? 'Feriado atualizado!' : 'Feriado adicionado!');
  };

  const formatFeriadoDate = (d: string) => {
    if (!d) return '';
    const [year, month, day] = d.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Configurações Gerais</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Cadastro de Feriados</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie feriados nacionais e locais para o cálculo de dias úteis e bloqueios na agenda.</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
        >
          <Plus size={14} />
          Novo Feriado
        </button>
      </div>

      {/* Grid List */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.04] bg-white/[0.01]">
          <span className="font-bold text-slate-200 text-sm">Feriados Cadastrados</span>
          <span className="text-[10px] text-slate-400 font-mono">Total • {feriados.length} registro(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                <th className="p-4 w-1/4">Data</th>
                <th className="p-4 w-1/2">Descrição / Nome</th>
                <th className="p-4 text-center w-1/4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02] text-xs">
              {feriados.map((f, index) => (
                <tr key={index} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors font-mono flex items-center gap-2.5">
                    <CalendarCheck size={14} className="text-indigo-400/80" />
                    {formatFeriadoDate(f.data)}
                  </td>
                  <td className="p-4 text-slate-300 font-semibold">{f.desc}</td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(index)}
                        className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                        title="Editar"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => handleDelete(index)}
                        className="p-1.5 bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 rounded-lg text-rose-400 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {feriados.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-500 font-medium">
                    Nenhum feriado cadastrado. Clique em "Novo Feriado" para adicionar.
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
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editingIndex !== null ? 'Editar Feriado' : 'Novo Feriado'}
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">Cadastre a data e descrição do feriado</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white" type="button">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Data *</label>
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Descrição / Nome *</label>
                <input
                  type="text"
                  required
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ex: Finados, Aniversário da Cidade..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                />
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
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold text-xs"
                >
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
