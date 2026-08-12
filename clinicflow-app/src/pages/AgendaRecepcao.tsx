import React, { useState, useEffect } from 'react';
import {
  Clock, Plus, ChevronLeft, ChevronRight, Calendar, FileText, Trash2, Video, Sparkles, Loader,
  CalendarDays, Lock, Unlock, HelpCircle, Key, Check, Search, Bell, Filter, UserCheck, Shield, Users
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Agendamento, GuiaSadt, ProcedimentoGuia, Paciente } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const AgendaRecepcao: React.FC = () => {
  const {
    agendamentos, profissionais, planos, procedimentos, pacientes, statusAgendamentos,
    getBaseStatus, getStatusColor: getStatusColorHex, logStatusChange, refreshAll,
    loadAgendamentosMes, loadAgendamentosPeriodo
  } = useApp();

  const { isDark } = useTheme();

  // View Controls: Day, Week, Month, Year
  const [viewTab, setViewTab] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Global Patient Search & Therapist Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfFilter, setSelectedProfFilter] = useState<number | 'all'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // Dynamic Patient Search State in Modal
  const [searchedPacientes, setSearchedPacientes] = useState<Paciente[]>([]);
  const [isSearchingPac, setIsSearchingPac] = useState(false);
  const [showPacDropdown, setShowPacDropdown] = useState(false);

  const handleSearchPaciente = async (termToSearch?: string) => {
    const query = (termToSearch !== undefined ? termToSearch : paciente).trim();
    if (!query) return;
    setIsSearchingPac(true);
    try {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome', `%${query}%`)
        .order('nome')
        .limit(30);

      if (error) throw error;
      if (data) {
        setSearchedPacientes(data.map(mappers.dbToPac));
        setShowPacDropdown(true);
      }
    } catch (err) {
      console.error('Erro ao buscar pacientes:', err);
    } finally {
      setIsSearchingPac(false);
    }
  };

  const handleSelectPacienteObj = (p: Paciente) => {
    setPaciente(p.nome);
    if (p.planoId) {
      setPlanoId(p.planoId);
    }
    if (p.carteirinha) {
      setCarteirinha(p.carteirinha);
    }
    setShowPacDropdown(false);
  };

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

  // Filter agendamentos by therapist dropdown, search query and active date
  const filteredAgendamentos = agendamentos.filter(a => {
    // Therapist filter
    if (selectedProfFilter !== 'all' && a.profId !== selectedProfFilter) {
      return false;
    }
    // Patient Search filter
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
    setProfIdForm(initialProfId || (typeof selectedProfFilter === 'number' ? selectedProfFilter : profissionais[0]?.id || 0));
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
    setSearchedPacientes([]);
    setShowPacDropdown(false);
    setIsSearchingPac(false);
    setIsModalOpen(true);
  };

  const openEditModal = (a: Agendamento) => {
    setEditId(a.id);
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

  // Render Day View (Compact Dynamic Schedule Grid with Theme Support)
  const renderDayView = () => {
    const dayAppts = filteredAgendamentos.filter(a => a.dataISO === currentDate);

    // Time Slots 08:00 to 20:00 (in 30-min intervals)
    const timeSlots = [];
    for (let h = 8; h <= 20; h++) {
      const hStr = String(h).padStart(2, '0');
      timeSlots.push(`${hStr}:00`);
      if (h < 20) timeSlots.push(`${hStr}:30`);
    }

    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden text-[var(--text-primary)] font-sans">
        {/* Sub Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-raised)] gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1.5 hover:bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl transition-all active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
                Agenda do Dia
              </h3>
              <p className="text-xs text-[var(--text-muted)] font-medium capitalize mt-0.5">
                {new Date(currentDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => navigateDate('next')}
              className="p-1.5 hover:bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl transition-all active:scale-95 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate('today')}
              className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl text-xs font-bold hover:bg-[var(--bg-raised)] transition-all shadow-xs"
            >
              Hoje
            </button>
            <span className="text-xs font-semibold px-3 py-1 bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/20">
              {dayAppts.length} Agendamento(s) hoje
            </span>
          </div>
        </div>

        {/* Compact Schedule List (100% Width Responsive Grid per Time Slot) */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] p-2">
          {timeSlots.map(slot => {
            const slotAppts = dayAppts.filter(a => a.hora && a.hora === slot);

            return (
              <div
                key={slot}
                className="flex flex-col md:flex-row items-start md:items-stretch gap-3 py-2.5 px-3 hover:bg-[var(--bg-raised)]/60 transition-colors rounded-xl group"
              >
                {/* Time Label Column */}
                <div className="w-20 pt-1 text-xs font-black font-mono text-[var(--text-muted)] shrink-0 flex items-center justify-between">
                  <span>{slot}</span>
                  <button
                    onClick={() => openNewModal(slot)}
                    title="Adicionar agendamento neste horário"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-indigo-500 hover:bg-indigo-500/10 rounded transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Cards Container (Side-by-side Cards) */}
                <div className="flex-1 flex flex-wrap gap-2.5 w-full items-stretch min-h-[42px]">
                  {slotAppts.length === 0 ? (
                    <div
                      onClick={() => openNewModal(slot)}
                      className="flex-1 py-2 px-3 border border-dashed border-[var(--border)] rounded-xl text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-mid)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} /> Clique para agendar às {slot}
                    </div>
                  ) : (
                    slotAppts.map(appt => {
                      const prof = profissionais.find(p => p.id === appt.profId);
                      const pColor = prof?.cor || '#6366f1';
                      const stColor = getStatusColorHex(appt.status);

                      return (
                        <div
                          key={appt.id}
                          onClick={() => openEditModal(appt)}
                          className="flex-1 min-w-[220px] max-w-[340px] p-3 rounded-xl text-xs bg-[var(--bg-surface)] shadow-xs border border-[var(--border)] transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer flex flex-col justify-between"
                          style={{
                            borderLeft: `4px solid ${pColor}`,
                            backgroundColor: isDark ? `${pColor}1a` : '#ffffff'
                          }}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1">
                              <span className="font-extrabold text-[var(--text-primary)] truncate text-sm">
                                {appt.paciente}
                              </span>
                              <span
                                className="text-[9px] px-2 py-0.5 rounded-md font-bold text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: stColor }}
                              >
                                {appt.status}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between mt-0.5">
                              <span>{appt.hora} - {appt.horaFim || '09:30'}</span>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                {appt.plano}
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] font-bold text-[var(--text-primary)] mt-2.5 pt-1.5 border-t border-[var(--border)] flex items-center justify-between">
                            <span className="truncate flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pColor }} />
                              {prof?.nomeAgenda || prof?.nome || 'Profissional'}
                            </span>
                            {appt.modalidade === 'online' && (
                              <span className="flex items-center gap-0.5 text-indigo-500 font-bold shrink-0">
                                <Video size={11} /> Online
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
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
      <div className="flex-1 flex flex-col bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden text-[var(--text-primary)] font-sans">
        <div className="grid grid-cols-7 divide-x divide-[var(--border)] border-b border-[var(--border)] bg-[var(--bg-raised)] text-xs font-bold text-[var(--text-secondary)]">
          {weekDays.map(dStr => {
            const d = new Date(dStr + 'T12:00:00');
            const isToday = dStr === new Date().toISOString().split('T')[0];

            return (
              <div key={dStr} className={`p-3 text-center ${isToday ? 'bg-indigo-500/10 text-indigo-500 font-extrabold' : ''}`}>
                <div className="uppercase text-[10px] tracking-wider text-[var(--text-muted)]">{d.toLocaleDateString('pt-BR', { weekday: 'short' })}</div>
                <div className="text-base font-black mt-0.5">{d.getDate()}</div>
              </div>
            );
          })}
        </div>

        <div className="flex-1 grid grid-cols-7 divide-x divide-[var(--border)] overflow-y-auto">
          {weekDays.map(dStr => {
            const dayAppts = filteredAgendamentos.filter(a => a.dataISO === dStr);

            return (
              <div
                key={dStr}
                onClick={() => openNewModal(undefined, undefined)}
                className="p-2 space-y-2 hover:bg-[var(--bg-raised)]/50 transition-colors min-h-[400px]"
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
                      className="p-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border)] shadow-xs hover:shadow-md cursor-pointer"
                      style={{ borderLeft: `4px solid ${pColor}` }}
                    >
                      <div className="font-bold text-[var(--text-primary)] truncate">{appt.paciente}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{appt.hora} - {prof?.nome.split(' ')[0]}</div>
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
      <div className="flex-1 flex flex-col bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden text-[var(--text-primary)] font-sans">
        {/* Navigation Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-raised)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate('prev')}
              className="p-1.5 hover:bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-lg font-black text-[var(--text-primary)] capitalize">
              {new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => navigateDate('next')}
              className="p-1.5 hover:bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            onClick={() => navigateDate('today')}
            className="px-3.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-xs font-bold hover:bg-[var(--bg-raised)] text-[var(--text-primary)] transition-all shadow-xs"
          >
            Hoje
          </button>
        </div>

        {/* 7 Columns Header */}
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg-raised)] text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider text-center py-2">
          <div>DOM</div>
          <div>SEG</div>
          <div>TER</div>
          <div>QUA</div>
          <div>QUI</div>
          <div>SEX</div>
          <div>SÁB</div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[var(--border)] overflow-y-auto">
          {calendarCells.map((dStr, idx) => {
            if (!dStr) {
              return <div key={`empty-${idx}`} className="bg-[var(--bg-raised)]/40 p-2" />;
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
                className={`p-2 flex flex-col justify-between hover:bg-indigo-500/10 transition-colors cursor-pointer min-h-[90px] ${
                  isToday ? 'bg-indigo-500/15' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${isToday ? 'w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center' : 'text-[var(--text-primary)]'}`}>
                    {dayNum}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{dayAppts.length} appts</span>
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
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold truncate bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-raised)] transition-colors"
                        style={{ borderLeft: `3px solid ${pColor}` }}
                      >
                        {appt.hora} - {appt.paciente}
                      </div>
                    );
                  })}
                  {dayAppts.length > 3 && (
                    <div className="text-[9px] font-bold text-indigo-500 text-center pt-0.5">
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
      if (count === 0) return 'bg-[var(--bg-raised)] text-[var(--text-muted)]';
      if (count <= 2) return 'bg-indigo-500/20 text-indigo-500 font-bold';
      if (count <= 5) return 'bg-indigo-500/40 text-indigo-400 font-extrabold';
      if (count <= 8) return 'bg-indigo-500 text-white font-extrabold';
      return 'bg-indigo-700 text-white font-black';
    };

    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-sm font-sans p-6 space-y-6 overflow-y-auto text-[var(--text-primary)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <h3 className="text-xl font-black text-[var(--text-primary)]">Visão Anual - {selectedYear}</h3>
            <p className="text-xs text-[var(--text-muted)] font-medium">Densidade de agendamentos por dia na clínica</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <span>Baixa demanda</span>
              <div className="flex gap-1">
                <span className="w-4 h-4 rounded bg-[var(--bg-raised)] border border-[var(--border)]" />
                <span className="w-4 h-4 rounded bg-indigo-500/20" />
                <span className="w-4 h-4 rounded bg-indigo-500/40" />
                <span className="w-4 h-4 rounded bg-indigo-500" />
                <span className="w-4 h-4 rounded bg-indigo-700" />
              </div>
              <span>Alta demanda</span>
            </div>

            <div className="flex items-center gap-2 bg-[var(--bg-raised)] p-1 rounded-xl border border-[var(--border)]">
              <button
                onClick={() => setSelectedYear(selectedYear - 1)}
                className="p-1 hover:bg-[var(--bg-surface)] rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-extrabold text-sm px-2 text-[var(--text-primary)]">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear(selectedYear + 1)}
                className="p-1 hover:bg-[var(--bg-surface)] rounded-lg transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
              <div key={mName} className="p-4 bg-[var(--bg-raised)]/60 border border-[var(--border)] rounded-2xl space-y-3">
                <h4 className="text-sm font-extrabold text-[var(--text-primary)]">{mName}</h4>
                <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-[var(--text-muted)] text-center">
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
    <div className="flex flex-col h-[calc(100vh-80px)] bg-[var(--bg-base)] p-4 gap-4 animate-fade-in font-sans text-[var(--text-primary)] transition-colors duration-300">
      {/* RESTRUCTURED TOP HEADER BAR */}
      <div className="bg-[var(--bg-surface)] px-6 py-4 rounded-2xl border border-[var(--border)] shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-500 to-violet-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)] leading-tight">Agenda Recepção</h2>
            <p className="text-xs text-[var(--text-muted)] font-medium">Visão integrada de alta densidade por profissional</p>
          </div>
        </div>

        {/* View Switcher Tabs: Dia / Semana / Mês / Ano */}
        <div className="flex items-center bg-[var(--bg-raised)] p-1 rounded-xl border border-[var(--border)] self-start lg:self-auto">
          {(['day', 'week', 'month', 'year'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                viewTab === tab
                  ? 'bg-[var(--bg-surface)] text-indigo-500 shadow-sm font-extrabold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'day' ? 'Dia' : tab === 'week' ? 'Semana' : tab === 'month' ? 'Mês' : 'Ano (Heatmap)'}
            </button>
          ))}
        </div>

        {/* Filters, Patient Search & Button Novo Agendamento */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Dropdown Terapeuta Filter */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedProfFilter}
              onChange={(e) => setSelectedProfFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full pl-3 pr-8 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer"
            >
              <option value="all">👥 Todos os Terapeutas ({profissionais.length})</option>
              {profissionais.map(p => (
                <option key={p.id} value={p.id}>
                  👤 {p.nomeAgenda || p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Search Patient Input */}
          <div className="relative min-w-[180px]">
            <Search size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>

          {/* Button Novo Agendamento */}
          <button
            onClick={() => openNewModal()}
            className="py-2 px-4 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-extrabold text-xs shadow-md flex items-center gap-2 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <Plus size={16} />
            + Novo Agendamento
          </button>
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER (FULL 100% WIDTH) */}
      <div className="flex-1 flex overflow-hidden w-full">
        {viewTab === 'day' && renderDayView()}
        {viewTab === 'week' && renderWeekView()}
        {viewTab === 'month' && renderMonthView()}
        {viewTab === 'year' && renderYearView()}
      </div>

      {/* MODAL NOVO / EDITAR AGENDAMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[var(--border-mid)] text-[var(--text-primary)] space-y-4 animate-scale-up font-sans">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-lg font-black text-[var(--text-primary)]">
                {editId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] font-bold text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Profissional *</label>
                  <select
                    value={profIdForm}
                    onChange={(e) => setProfIdForm(Number(e.target.value))}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--accent)]"
                  >
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Paciente *</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={paciente}
                      onChange={(e) => {
                        setPaciente(e.target.value);
                        if (showPacDropdown) setShowPacDropdown(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSearchPaciente(paciente);
                        }
                      }}
                      placeholder="Nome completo do paciente"
                      className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-semibold focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleSearchPaciente(paciente)}
                      disabled={isSearchingPac}
                      className="px-3 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
                      title="Buscar paciente no Supabase"
                    >
                      {isSearchingPac ? (
                        <Loader size={14} className="animate-spin" />
                      ) : (
                        <Search size={14} />
                      )}
                    </button>
                  </div>

                  {/* Dropdown de Resultados da Busca */}
                  {showPacDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-surface)] border border-[var(--border-mid)] rounded-xl shadow-2xl max-h-56 overflow-y-auto z-[999] p-1 divide-y divide-[var(--border)]">
                      {searchedPacientes.length === 0 ? (
                        <div className="p-3 text-xs text-center text-[var(--text-muted)] font-medium">
                          Nenhum paciente encontrado com "{paciente}".
                        </div>
                      ) : (
                        searchedPacientes.map(p => {
                          const planoObj = planos.find(pl => pl.id === p.planoId);

                          return (
                            <div
                              key={p.id}
                              onClick={() => handleSelectPacienteObj(p)}
                              className="p-2.5 hover:bg-[var(--bg-raised)] rounded-lg cursor-pointer transition-colors text-xs flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="font-bold text-[var(--text-primary)]">{p.nome}</div>
                                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                                  {p.cpf ? `CPF: ${p.cpf}` : ''} {p.carteirinha ? ` | Cart: ${p.carteirinha}` : ''}
                                </div>
                              </div>
                              <div className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-500 rounded-md border border-indigo-500/20 shrink-0">
                                {planoObj?.nome || p.plano || 'Particular'}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={dataAg}
                    onChange={(e) => setDataAg(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Horário *</label>
                  <input
                    type="time"
                    required
                    value={horaIni}
                    onChange={(e) => setHoraIni(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Duração (min)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={duracao}
                    onChange={(e) => setDuracao(Number(e.target.value))}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl font-semibold text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Plano de Saúde</label>
                  <select
                    value={planoId}
                    onChange={(e) => setPlanoId(Number(e.target.value))}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-semibold focus:outline-none"
                  >
                    {planos.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-bold mb-1">Status do Agendamento</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] font-semibold focus:outline-none"
                  >
                    {statusAgendamentos.map(s => (
                      <option key={s.nome} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[var(--bg-raised)] hover:bg-[var(--border)] text-[var(--text-primary)] rounded-xl font-bold text-xs cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold text-xs shadow-md cursor-pointer transition-all"
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
