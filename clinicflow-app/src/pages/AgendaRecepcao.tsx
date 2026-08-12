import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, ChevronLeft, ChevronRight, Calendar, FileText, Trash2, Video, Sparkles, Loader,
  CalendarDays, Lock, Unlock, HelpCircle, Key, Check, Search, Bell, Filter, UserCheck, Shield
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Agendamento, GuiaSadt, ProcedimentoGuia } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const AgendaRecepcao: React.FC = () => {
  const {
    agendamentos, profissionais, planos, procedimentos, pacientes, statusAgendamentos,
    getBaseStatus, getStatusColor: getStatusColorHex, logStatusChange, refreshAll,
    loadAgendamentosMes, loadAgendamentosPeriodo
  } = useApp();

  // View Controls: Day, Week, Month, Year
  const [viewTab, setViewTab] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Global Patient Search
  const [searchQuery, setSearchQuery] = useState('');

  // Professional Checkbox Filters (Default: all selected)
  const [selectedProfIds, setSelectedProfIds] = useState<number[]>([]);

  useEffect(() => {
    if (profissionais.length > 0 && selectedProfIds.length === 0) {
      setSelectedProfIds(profissionais.map(p => p.id));
    }
  }, [profissionais]);

  const toggleProfFilter = (id: number) => {
    if (selectedProfIds.includes(id)) {
      setSelectedProfIds(selectedProfIds.filter(pId => pId !== id));
    } else {
      setSelectedProfIds([...selectedProfIds, id]);
    }
  };

  const toggleAllProfs = () => {
    if (selectedProfIds.length === profissionais.length) {
      setSelectedProfIds([]);
    } else {
      setSelectedProfIds(profissionais.map(p => p.id));
    }
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalTab, setModalTab] = useState<'dados' | 'sadt'>('dados');

  // Form State - Tab 1 (Dados)
  const [profIdForm, setProfIdForm] = useState<number>(profissionais[0]?.id || 0);
  const [dataAg, setDataAg] = useState(currentDate);
  const [horaIni, setHoraIni] = useState('09:00');
  const [duracao, setDuracao] = useState<number>(30);
  const [horaFim, setHoraFim] = useState('09:30');
  const [modalidade, setModalidade] = useState<'presencial' | 'online'>('presencial');
  const [meetLink, setMeetLink] = useState('');

  // Group Mode
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupPacientes, setGroupPacientes] = useState<string[]>([]);

  // Single Paciente
  const [paciente, setPaciente] = useState('');
  const [planoId, setPlanoId] = useState<number>(5);
  const [carteirinha, setCarteirinha] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('sessao');
  const [status, setStatus] = useState<string>('Agendado');
  const [obs, setObs] = useState('');

  // Load appointments dynamically as user navigates
  useEffect(() => {
    if (viewTab === 'year') {
      loadAgendamentosPeriodo(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
    } else {
      const monthToLoad = viewTab === 'month' ? selectedMonth : currentDate.slice(0, 7);
      loadAgendamentosMes(monthToLoad);
    }
  }, [currentDate, selectedMonth, selectedYear, viewTab]);

  // Recalculate horaFim when horaIni or duracao changes
  useEffect(() => {
    if (duracao === 0) return;
    const [h, m] = horaIni.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + duracao);
    const fh = d.getHours().toString().padStart(2, '0');
    const fm = d.getMinutes().toString().padStart(2, '0');
    setHoraFim(`${fh}:${fm}`);
  }, [horaIni, duracao]);

  // Date Navigation Helpers
  const navigateDate = (dir: 'prev' | 'next' | 'today') => {
    if (dir === 'today') {
      const nowStr = new Date().toISOString().split('T')[0];
      setCurrentDate(nowStr);
      setSelectedMonth(nowStr.slice(0, 7));
      setSelectedYear(new Date().getFullYear());
      return;
    }

    if (viewTab === 'day') {
      const d = new Date(currentDate + 'T12:00:00');
      d.setDate(d.getDate() + (dir === 'next' ? 1 : -1));
      const nStr = d.toISOString().split('T')[0];
      setCurrentDate(nStr);
      setSelectedMonth(nStr.slice(0, 7));
    } else if (viewTab === 'week') {
      const d = new Date(currentDate + 'T12:00:00');
      d.setDate(d.getDate() + (dir === 'next' ? 7 : -7));
      const nStr = d.toISOString().split('T')[0];
      setCurrentDate(nStr);
      setSelectedMonth(nStr.slice(0, 7));
    } else if (viewTab === 'month') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 1 + (dir === 'next' ? 1 : -1), 1);
      const yStr = d.getFullYear();
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${yStr}-${mStr}`);
    } else if (viewTab === 'year') {
      setSelectedYear(selectedYear + (dir === 'next' ? 1 : -1));
    }
  };

  // Filter agendamentos by professional checkboxes, query and active view date
  const filteredAgendamentos = agendamentos.filter(a => {
    // Professional filter
    if (selectedProfIds.length > 0 && !selectedProfIds.includes(a.profId)) {
      return false;
    }
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchPac = a.paciente.toLowerCase().includes(q);
      const matchProf = (profissionais.find(p => p.id === a.profId)?.nome || '').toLowerCase().includes(q);
      if (!matchPac && !matchProf) return false;
    }
    return true;
  });

  // Modal Reset and Open
  const openNewModal = (initialTime?: string, initialProfId?: number) => {
    setEditId(null);
    setModalTab('dados');
    setProfIdForm(initialProfId || selectedProfIds[0] || profissionais[0]?.id || 0);
    setDataAg(currentDate);
    setHoraIni(initialTime || '09:00');
    setDuracao(30);
    setIsGroupMode(false);
    setGroupPacientes([]);
    setPaciente('');
    setCarteirinha('');
    setPlanoId(5);
    setTipoAtendimento('sessao');
    setStatus('Agendado');
    setObs('');
    setModalidade('presencial');
    setMeetLink('');
    setIsModalOpen(true);
  };

  const openEditModal = (a: Agendamento) => {
    setEditId(a.id);
    setModalTab('dados');
    setProfIdForm(a.profId);
    setDataAg(a.dataISO || currentDate);
    setHoraIni(a.hora || '09:00');

    if (a.hora && a.horaFim) {
      const [h1, m1] = a.hora.split(':').map(Number);
      const [h2, m2] = a.horaFim.split(':').map(Number);
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      setDuracao(diff > 0 ? diff : 30);
    } else {
      setDuracao(30);
    }

    if (a.paciente.includes(',')) {
      setIsGroupMode(true);
      setGroupPacientes(a.paciente.split(',').map(p => p.trim()));
      setPaciente('');
    } else {
      setIsGroupMode(false);
      setGroupPacientes([]);
      setPaciente(a.paciente);
    }

    setPlanoId(a.planoId || 5);
    setCarteirinha(a.carteirinha || '');
    setTipoAtendimento(a.tipo || 'sessao');
    setStatus(a.status || 'Agendado');
    setObs(a.obs || '');
    setModalidade((a.modalidade as any) || 'presencial');
    setMeetLink(a.meetLink || '');
    setIsModalOpen(true);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const finalPaciente = isGroupMode ? groupPacientes.join(', ') : paciente;
      const planoObj = planos.find(p => p.id === planoId);

      const payload: Partial<Agendamento> = {
        profId: profIdForm,
        paciente: finalPaciente,
        planoId,
        plano: planoObj?.nome || 'Particular',
        hora: horaIni,
        horaFim,
        durMin: duracao,
        dataISO: dataAg,
        status,
        obs,
        modalidade,
        meetLink: modalidade === 'online' ? meetLink : undefined,
        carteirinha,
        tipo: tipoAtendimento
      };

      if (editId) {
        const { error } = await supabase
          .from('agendamentos')
          .update(mappers.apptToDb(payload))
          .eq('id', editId);
        if (error) throw error;
        await logStatusChange(editId, status);
      } else {
        const { data, error } = await supabase
          .from('agendamentos')
          .insert([mappers.apptToDb(payload)])
          .select();
        if (error) throw error;
        if (data && data[0]) {
          await logStatusChange(data[0].id, status);
        }
      }

      setIsModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Color Helper for Professional Cards
  const getProfColor = (profId: number) => {
    const prof = profissionais.find(p => p.id === profId);
    return prof?.cor || '#6366f1';
  };

  // Render Day View (High Density Unified Schedule)
  const renderDayView = () => {
    const dayAppts = filteredAgendamentos.filter(a => a.dataISO === currentDate);
    const activeProfs = profissionais.filter(p => selectedProfIds.includes(p.id));

    // Time Slots 08:00 to 20:00
    const timeSlots = [];
    for (let h = 8; h <= 20; h++) {
      timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    }

    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-800 font-sans">
        {/* Sub Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Unified Schedule (High Density)</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Data: {new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              {activeProfs.length} Profissionais visíveis
            </span>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
              {dayAppts.length} Agendamentos hoje
            </span>
          </div>
        </div>

        {/* High Density Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[800px] flex border-b border-slate-100 bg-slate-50/80 text-xs font-bold text-slate-600 sticky top-0 z-10 backdrop-blur-md">
            <div className="w-20 px-3 py-3 text-center border-r border-slate-200/60 font-mono">Horário</div>
            <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-slate-200/60">
              {activeProfs.map(prof => (
                <div key={prof.id} className="px-3 py-3 flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: prof.cor || '#6366f1' }} />
                  <span className="truncate">{prof.nomeAgenda || prof.nome}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 min-w-[800px]">
            {timeSlots.map(slot => {
              return (
                <div key={slot} className="flex min-h-[64px]">
                  <div className="w-20 px-3 py-3 text-xs font-bold text-slate-400 font-mono text-center border-r border-slate-200/60 shrink-0 bg-slate-50/30">
                    {slot}
                  </div>
                  <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-slate-200/60">
                    {activeProfs.map(prof => {
                      const profSlotAppts = dayAppts.filter(a => a.profId === prof.id && a.hora && a.hora.startsWith(slot.slice(0, 2)));

                      return (
                        <div
                          key={prof.id}
                          onClick={() => openNewModal(slot, prof.id)}
                          className="p-1.5 hover:bg-indigo-50/20 transition-colors cursor-pointer relative group flex flex-col gap-1.5"
                        >
                          {profSlotAppts.map(appt => {
                            const pColor = prof.cor || '#6366f1';
                            const stColor = getStatusColorHex(appt.status);

                            return (
                              <div
                                key={appt.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(appt);
                                }}
                                className="p-2.5 rounded-xl text-xs shadow-sm border border-slate-200/80 transition-all hover:shadow-md hover:scale-[1.01] flex flex-col justify-between"
                                style={{
                                  backgroundColor: `${pColor}0d`,
                                  borderLeft: `4px solid ${pColor}`
                                }}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-bold text-slate-900 truncate">
                                      {appt.paciente}
                                    </span>
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-md font-semibold text-white shrink-0"
                                      style={{ backgroundColor: stColor }}
                                    >
                                      {appt.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-medium">
                                    {appt.hora} - {appt.horaFim || '09:30'}
                                  </div>
                                </div>
                                <div className="text-[10px] font-semibold text-slate-600 mt-1 flex items-center justify-between">
                                  <span>{prof.nomeAgenda || prof.nome.split(' ')[0]}</span>
                                  {appt.modalidade === 'online' && (
                                    <span className="flex items-center gap-0.5 text-indigo-600 font-bold">
                                      <Video size={10} /> Online
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render Week View
  const renderWeekView = () => {
    const curr = new Date(currentDate + 'T12:00:00');
    const dayOfWeek = curr.getDay();
    const firstDayOfWeek = new Date(curr);
    firstDayOfWeek.setDate(curr.getDate() - dayOfWeek);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(firstDayOfWeek);
      d.setDate(firstDayOfWeek.getDate() + i);
      weekDays.push(d.toISOString().split('T')[0]);
    }

    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-800 font-sans">
        <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          {weekDays.map(dStr => {
            const d = new Date(dStr + 'T12:00:00');
            const isToday = dStr === new Date().toISOString().split('T')[0];

            return (
              <div key={dStr} className={`p-3 text-center ${isToday ? 'bg-indigo-50/60 text-indigo-700 font-extrabold' : ''}`}>
                <div className="uppercase text-[10px] tracking-wider text-slate-400">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                <div className="text-base font-black mt-0.5">{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200 overflow-y-auto">
          {weekDays.map(dStr => {
            const dayAppts = filteredAgendamentos.filter(a => a.dataISO === dStr);

            return (
              <div
                key={dStr}
                onClick={() => openNewModal(undefined, undefined)}
                className="p-2 space-y-2 hover:bg-slate-50/50 transition-colors min-h-[400px]"
              >
                {dayAppts.map(appt => {
                  const pColor = getProfColor(appt.profId);
                  const prof = profissionais.find(p => p.id === appt.profId);

                  return (
                    <div
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(appt);
                      }}
                      className="p-2 rounded-xl text-xs bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md cursor-pointer"
                      style={{ borderLeft: `4px solid ${pColor}` }}
                    >
                      <div className="font-bold text-slate-900 truncate">{appt.paciente}</div>
                      <div className="text-[10px] text-slate-500">{appt.hora} - {prof?.nome.split(' ')[0]}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Month View
  const renderMonthView = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendarCells = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      calendarCells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarCells.push(dStr);
    }

    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-800 font-sans">
        {/* Navigation Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-all active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-lg font-black text-slate-900 capitalize">
              {new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => navigateDate('next')}
              className="p-1.5 hover:bg-slate-200/60 rounded-lg transition-all active:scale-95"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={() => navigateDate('today')}
            className="px-3.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            Hoje
          </button>
        </div>

        {/* 7 Columns Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider text-center py-2">
          <div>SUN</div>
          <div>MON</div>
          <div>TUE</div>
          <div>WED</div>
          <div>THU</div>
          <div>FRI</div>
          <div>SAT</div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-200 overflow-y-auto">
          {calendarCells.map((dStr, idx) => {
            if (!dStr) {
              return <div key={`empty-${idx}`} className="bg-slate-50/40 p-2" />;
            }
            const dayNum = Number(dStr.split('-')[2]);
            const dayAppts = filteredAgendamentos.filter(a => a.dataISO === dStr);
            const isToday = dStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={dStr}
                onClick={() => {
                  setCurrentDate(dStr);
                  openNewModal(undefined, undefined);
                }}
                className={`p-2 flex flex-col justify-between hover:bg-indigo-50/20 transition-colors cursor-pointer min-h-[90px] ${
                  isToday ? 'bg-indigo-50/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                    {dayNum}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">{dayAppts.length} appts</span>
                  )}
                </div>

                <div className="space-y-1 mt-1">
                  {dayAppts.slice(0, 3).map(appt => {
                    const pColor = getProfColor(appt.profId);

                    return (
                      <div
                        key={appt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(appt);
                        }}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold truncate bg-slate-100 text-slate-800 border border-slate-200/60 hover:bg-slate-200 transition-colors"
                        style={{ borderLeft: `3px solid ${pColor}` }}
                      >
                        {appt.hora} - {appt.paciente}
                      </div>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <div className="text-[9px] font-bold text-indigo-600 text-center pt-0.5">
                      + {dayAppts.length - 3} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render Year View (Density Heatmap)
  const renderYearView = () => {
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const apptCountMap: Record<string, number> = {};
    filteredAgendamentos.forEach(a => {
      if (a.dataISO && a.dataISO.startsWith(String(selectedYear))) {
        apptCountMap[a.dataISO] = (apptCountMap[a.dataISO] || 0) + 1;
      }
    });

    const getHeatColorClass = (count: number) => {
      if (count === 0) return 'bg-slate-100 text-slate-400';
      if (count <= 2) return 'bg-indigo-100 text-indigo-800 font-bold';
      if (count <= 5) return 'bg-indigo-300 text-indigo-900 font-extrabold';
      if (count <= 8) return 'bg-indigo-500 text-white font-extrabold';
      return 'bg-indigo-800 text-white font-black';
    };

    return (
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-slate-800 font-sans p-6 space-y-6 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-xl font-black text-slate-900">Visão Anual - {selectedYear}</h3>
            <p className="text-xs text-slate-500 font-medium">Densidade de agendamentos por dia na clínica</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>Baixa demanda</span>
              <div className="flex gap-1">
                <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200" />
                <span className="w-4 h-4 rounded bg-indigo-100" />
                <span className="w-4 h-4 rounded bg-indigo-300" />
                <span className="w-4 h-4 rounded bg-indigo-500" />
                <span className="w-4 h-4 rounded bg-indigo-800" />
              </div>
              <span>Alta demanda</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-1 hover:bg-white rounded-lg transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-extrabold text-sm px-2">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-1 hover:bg-white rounded-lg transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {monthNames.map((mName, mIdx) => {
            const daysInM = new Date(selectedYear, mIdx + 1, 0).getDate();
            const startDay = new Date(selectedYear, mIdx, 1).getDay();

            const cells = [];
            for (let i = 0; i < startDay; i++) cells.push(null);
            for (let d = 1; d <= daysInM; d++) {
              const dStr = `${selectedYear}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              cells.push({ day: d, dateStr: dStr, count: apptCountMap[dStr] || 0 });
            }

            return (
              <div key={mName} className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
                <h4 className="text-sm font-extrabold text-slate-800">{mName}</h4>
                <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-400 text-center">
                  <span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {cells.map((cell, cIdx) => {
                    if (!cell) return <div key={`empty-${cIdx}`} className="h-6" />;
                    return (
                      <div
                        key={cell.dateStr}
                        onClick={() => {
                          setCurrentDate(cell.dateStr);
                          setViewTab('day');
                        }}
                        title={`${cell.dateStr}: ${cell.count} agendamento(s)`}
                        className={`h-6 rounded-md text-[10px] flex items-center justify-center cursor-pointer transition-all hover:scale-110 shadow-xs ${getHeatColorClass(cell.count)}`}
                      >
                        {cell.day}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-100/60 p-4 gap-4 animate-fade-in font-sans text-slate-800">
      {/* TOP HEADER BAR */}
      <div className="bg-white px-6 py-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 font-black tracking-wide text-sm">
            TherapySync
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-tight">Agenda Recepção</h2>
            <p className="text-xs text-slate-500 font-medium">Visão integrada de alta densidade por profissional</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-start md:self-auto">
          {(['day', 'week', 'month', 'year'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                viewTab === tab
                  ? 'bg-white text-indigo-700 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'day' ? 'Dia' : tab === 'week' ? 'Semana' : tab === 'month' ? 'Mês' : 'Ano (Heatmap)'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <button className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 relative transition-all">
            <Bell size={16} />
            <span className="w-2 h-2 bg-indigo-600 rounded-full absolute top-1.5 right-1.5" />
          </button>
        </div>
      </div>

      {/* MAIN BODY AREA */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* LEFT SIDEBAR / FILTERS PANEL */}
        <div className="w-64 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col gap-5 shrink-0 overflow-y-auto">
          <button
            onClick={() => openNewModal()}
            className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus size={16} />
            Create Appointment
          </button>

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                FILTERS ({profissionais.length})
              </span>
              <button
                onClick={toggleAllProfs}
                className="text-[10px] text-indigo-600 font-bold hover:underline"
              >
                {selectedProfIds.length === profissionais.length ? 'Desmarcar' : 'Marcar todos'}
              </button>
            </div>

            <div className="space-y-2">
              {profissionais.map(p => {
                const isChecked = selectedProfIds.includes(p.id);

                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors text-xs font-medium text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleProfFilter(p.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.cor || '#6366f1' }}
                    />
                    <span className="truncate">{p.nomeAgenda || p.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* VIEW CONTAINER */}
        {viewTab === 'day' && renderDayView()}
        {viewTab === 'week' && renderWeekView()}
        {viewTab === 'month' && renderMonthView()}
        {viewTab === 'year' && renderYearView()}
      </div>

      {/* MODAL NOVO / EDITAR AGENDAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 text-slate-800 space-y-4 animate-scale-up font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Profissional *</label>
                  <select
                    value={profIdForm}
                    onChange={(e) => setProfIdForm(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Paciente *</label>
                  <input
                    type="text"
                    required
                    value={paciente}
                    onChange={(e) => setPaciente(e.target.value)}
                    placeholder="Nome completo do paciente"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={dataAg}
                    onChange={(e) => setDataAg(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={horaIni}
                    onChange={(e) => setHoraIni(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Duração (min)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={duracao}
                    onChange={(e) => setDuracao(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Plano de Saúde</label>
                  <select
                    value={planoId}
                    onChange={(e) => setPlanoId(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none"
                  >
                    {planos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Status do Agendamento</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-semibold focus:outline-none"
                  >
                    {statusAgendamentos.map(s => (
                      <option key={s.nome} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md"
                >
                  {submitting ? 'Salvando...' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
