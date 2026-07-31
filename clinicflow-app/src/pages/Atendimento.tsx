import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check, X, ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';

interface AtendimentoProps {
  onNavigate: (page: string) => void;
}

export const Atendimento: React.FC<AtendimentoProps> = ({ onNavigate }) => {
  const { pacientes, agendamentos, profissionais, statusAgendamentos, getStatusColor, logStatusChange, refreshAll } = useApp();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedProfId, setSelectedProfId] = useState<number | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Navigate days
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Change status query
  const handleQuickStatus = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      await logStatusChange(id, newStatus);
      await refreshAll();
    } catch (e) {
      console.error(e);
      alert('Erro ao atualizar status.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Filter daily agendamentos by date and selected therapist
  const dailyAppts = agendamentos
    .filter(a => {
      const matchDate = a.dataISO === selectedDate;
      const matchProf = selectedProfId === 'all' || Number(a.profId) === Number(selectedProfId);
      return matchDate && matchProf;
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Color generator for patient avatar based on initials
  const getAvatarBg = (initials: string) => {
    const colors = [
      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'bg-violet-500/10 text-violet-400 border-violet-500/20',
      'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'bg-rose-500/10 text-rose-400 border-rose-500/20'
    ];
    let sum = 0;
    for (let i = 0; i < initials.length; i++) {
      sum += initials.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  // Formatting date title (e.g. "Consultas de 22/06")
  const formatDateTitle = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `Consultas de ${d}/${m}`;
  };

  // Status badge styles
  const getStatusBadge = (st: string) => {
    const base = 'px-2 py-0.75 rounded-md text-[10px] font-bold border';
    const color = getStatusColor(st);
    return (
      <span 
        className={base}
        style={{
          backgroundColor: `${color}15`,
          borderColor: `${color}30`,
          color: color
        }}
      >
        {st}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Sticky Header and Controls */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 space-y-4 -mx-8 px-8 border-b border-white/[0.04]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Painel Assistencial</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Gerenciador de Atendimentos</h2>
            <p className="text-xs text-slate-400 mt-1">Monitore e atualize o status das consultas diárias de forma rápida e eficiente</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Terapeuta / Profissional */}
            <div className="flex items-center gap-2 bg-[#0d0f17]/80 border border-white/[0.06] rounded-xl px-3 py-1.5 shadow-lg">
              <UserCheck size={13} className="text-indigo-400 shrink-0" />
              <select
                value={selectedProfId}
                onChange={(e) => setSelectedProfId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-[11px] font-bold text-slate-200 focus:outline-none cursor-pointer pr-1 font-sans"
              >
                <option value="all" className="bg-[#131622] text-slate-200">Todos os Terapeutas</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#131622] text-slate-200">
                    {p.nomeAgenda || p.nome}
                  </option>
                ))}
              </select>
            </div>

            <h3 className="text-xs font-bold text-slate-200 font-sans hidden sm:block">
              {formatDateTitle(selectedDate)}
            </h3>
            
            {/* Date Navigator */}
            <div className="flex items-center bg-[#0d0f17]/80 border border-white/[0.06] rounded-xl overflow-hidden shadow-lg">
              <button onClick={handlePrevDay} className="p-2 hover:bg-white/5 border-r border-white/[0.04] text-slate-400 transition-all cursor-pointer">
                <ChevronLeft size={13} />
              </button>
              <input 
                type="date" 
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[10px] font-bold text-slate-300 font-mono px-3 py-1 focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              <button onClick={handleNextDay} className="p-2 hover:bg-white/5 border-l border-white/[0.04] text-slate-400 transition-all cursor-pointer">
                <ChevronRight size={13} />
              </button>
            </div>

            <button
              onClick={() => onNavigate('agenda')}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-slate-200 rounded-xl font-bold transition-all text-[10px] cursor-pointer"
            >
              Ver agenda <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Table Body */}
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-white/[0.04] bg-[#131622] text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                <th className="p-4 pl-6">Horário</th>
                <th className="p-4">Paciente</th>
                <th className="p-4">Profissional</th>
                <th className="p-4">Plano</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Alterar Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {dailyAppts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500 font-medium font-sans">
                    {selectedProfId !== 'all' 
                      ? `Nenhum agendamento encontrado para este terapeuta nesta data.`
                      : `Nenhum agendamento encontrado para esta data.`}
                  </td>
                </tr>
              ) : (
                dailyAppts.map((appt) => {
                  const prof = profissionais.find(p => p.id === appt.profId);
                  const pacObj = appt.pacId 
                    ? pacientes.find(p => p.id === appt.pacId) 
                    : pacientes.find(p => p.nome.toLowerCase().trim() === appt.paciente.toLowerCase().trim());
                  const patientInitials = getInitials(appt.paciente);
                  const isUpdating = updatingId === appt.id;

                  return (
                    <tr 
                      key={appt.id} 
                      className={`hover:bg-white/[0.005] transition-colors ${
                        isUpdating ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {/* Horário */}
                      <td className="p-4 pl-6 font-mono font-bold text-slate-300 text-xs">
                        {appt.hora}
                      </td>

                      {/* Paciente */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {pacObj?.foto ? (
                            <img
                              src={pacObj.foto}
                              alt={appt.paciente}
                              className="w-7 h-7 rounded-lg object-cover border border-white/10 shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-[10px] shrink-0 shadow-sm ${getAvatarBg(patientInitials)}`}>
                              {patientInitials}
                            </div>
                          )}
                          <span className="font-semibold text-slate-200 text-xs truncate max-w-[200px]" title={appt.paciente}>
                            {appt.paciente}
                          </span>
                        </div>
                      </td>

                      {/* Profissional */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full border border-white/10 shrink-0" 
                            style={{ backgroundColor: prof?.cor || '#4f8ef7' }} 
                          />
                          <span className="font-semibold text-slate-300">
                            {prof?.nomeAgenda || prof?.nome || 'Não designado'}
                          </span>
                        </div>
                      </td>

                      {/* Plano */}
                      <td className="p-4 text-slate-400 font-medium">
                        {appt.plano}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {getStatusBadge(appt.status)}
                      </td>
                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end">
                          <select
                            value={statusAgendamentos.find(s => s.nome.toLowerCase() === appt.status.toLowerCase())?.nome || appt.status}
                            disabled={isUpdating}
                            onChange={(e) => handleQuickStatus(appt.id, e.target.value)}
                            className="bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-bold max-w-[180px] cursor-pointer"
                          >
                            {statusAgendamentos.map((s) => (
                              <option key={s.id || s.nome} value={s.nome}>
                                {s.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
