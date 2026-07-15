import React, { useState, useEffect } from 'react';
import { Clock, Plus, ChevronLeft, ChevronRight, Calendar, FileText, Trash2, Video, Sparkles, Loader, CalendarDays, Lock, Unlock, HelpCircle, Key, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Agendamento, GuiaSadt, ProcedimentoGuia } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

export const Agenda: React.FC = () => {
  const { agendamentos, profissionais, planos, procedimentos, pacientes, statusAgendamentos, getBaseStatus, getStatusColor: getStatusColorHex, logStatusChange, refreshAll, loadAgendamentosMes, loadAgendamentosPeriodo } = useApp();

  // View Control
  const [viewType, setViewType] = useState<'diario' | 'semanal' | 'mensal' | 'anual'>('diario');
  const [selectedProf, setSelectedProf] = useState<number | 'all'>('all');
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // "YYYY-MM"
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal Control
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
  const [groupInputVal, setGroupInputVal] = useState('');

  // Single Paciente
  const [paciente, setPaciente] = useState('');
  const [planoId, setPlanoId] = useState<number>(5);
  const [carteirinha, setCarteirinha] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState('sessao');
  const [status, setStatus] = useState<string>('Agendado');
  const [obs, setObs] = useState('');
  const [searchPacientes, setSearchPacientes] = useState<any[]>([]);

  // Recorrência
  const [hasRecorrencia, setHasRecorrencia] = useState(false);
  const [recFrequencia, setRecFrequencia] = useState<'diario' | 'semanal' | 'quinzenal' | 'mensal'>('semanal');
  const [recLimite, setRecLimite] = useState<'ilimitado' | 'qtd'>('ilimitado');
  const [recQtd, setRecQtd] = useState<number>(10);

  // Form State - Tab 2 (SADT Guide)
  const [sadtAns, setSadtAns] = useState('');
  const [sadtGuiaPrincipal, setSadtGuiaPrincipal] = useState('');
  const [sadtOperadora, setSadtOperadora] = useState('');
  const [sadtDtAut, setSadtDtAut] = useState('');
  const [sadtSenha, setSadtSenha] = useState('');
  const [sadtValSenha, setSadtValSenha] = useState('');
  const [sadtNumOp, setSadtNumOp] = useState('');
  const [sadtBeneficiario, setSadtBeneficiario] = useState('');
  const [sadtCns, setSadtCns] = useState('');
  const [sadtCodPrestador, setSadtCodPrestador] = useState('');
  const [sadtPrestador, setSadtPrestador] = useState('');

  // SADT Procedures Table
  const [sadtProcs, setSadtProcs] = useState<ProcedimentoGuia[]>([
    { codigo: '50000470', desc: 'Sessão de Psicoterapia', qtd: 1, valor: 60.00, total: 60.00 }
  ]);

  // Sync date selection
  useEffect(() => {
    setDataAg(currentDate);
  }, [currentDate]);

  // Load appointments dynamically as user navigates
  useEffect(() => {
    if (viewType === 'anual') {
      loadAgendamentosPeriodo(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
    } else {
      const monthToLoad = viewType === 'mensal' ? selectedMonth : currentDate.slice(0, 7);
      loadAgendamentosMes(monthToLoad);
    }
  }, [currentDate, selectedMonth, selectedYear, viewType]);

  // Recalculate horaFim when horaIni or duracao changes
  useEffect(() => {
    if (duracao === 0) return; // Custom
    const [h, m] = horaIni.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m + duracao);
    const fh = d.getHours().toString().padStart(2, '0');
    const fm = d.getMinutes().toString().padStart(2, '0');
    setHoraFim(`${fh}:${fm}`);
  }, [horaIni, duracao]);

  // Sync profile data when professional is changed
  useEffect(() => {
    const p = profissionais.find(prof => prof.id === profIdForm);
    if (p) {
      setSadtCodPrestador(p.num || '');
    }
  }, [profIdForm]);

  // Sync patient plano when patient is typed/selected
  useEffect(() => {
    const fetchPatientData = async () => {
      const pacSelected = pacientes.find(p => p.nome.trim().toLowerCase() === paciente.trim().toLowerCase()) ||
                          searchPacientes.find(p => p.nome.trim().toLowerCase() === paciente.trim().toLowerCase());
      if (pacSelected) {
        setPlanoId(pacSelected.planoId || pacSelected.plano_id || 5);
        setCarteirinha(pacSelected.carteirinha || '');
        setSadtBeneficiario(pacSelected.nome);
        setSadtCns(pacSelected.cpf || pacSelected.cns || '');
        return;
      }

      if (paciente.trim().length >= 3) {
        try {
          const { data } = await supabase
            .from('pacientes')
            .select('*')
            .eq('status', 'Ativo')
            .ilike('nome', paciente.trim())
            .limit(1);

          if (data && data.length > 0) {
            const dbPac = data[0];
            setPlanoId(dbPac.plano_id || 5);
            setCarteirinha(dbPac.carteirinha || '');
            setSadtBeneficiario(dbPac.nome);
            setSadtCns(dbPac.cpf || '');
          }
        } catch (err) {
          console.error('Erro ao buscar dados do paciente no banco:', err);
        }
      }
    };

    fetchPatientData();
  }, [paciente, pacientes, searchPacientes]);

  // Dynamic database search as they type
  useEffect(() => {
    if (!paciente.trim() || paciente.trim().length < 3) {
      setSearchPacientes([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('pacientes')
          .select('id, nome, plano_id, carteirinha, cpf')
          .eq('status', 'Ativo')
          .ilike('nome', `%${paciente.trim()}%`)
          .limit(10);
        if (data) {
          setSearchPacientes(data);
        }
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [paciente]);

  const getDatalistOptions = () => {
    const list = [...pacientes.filter(p => p.status === 'Ativo')];
    searchPacientes.forEach(sp => {
      if (!list.some(p => p.id === sp.id)) {
        list.push({
          id: sp.id,
          nome: sp.nome,
          planoId: sp.plano_id,
          carteirinha: sp.carteirinha,
          cpf: sp.cpf,
          status: 'Ativo'
        } as any);
      }
    });
    return list;
  };

  // Time slots from 07:00 to 19:30 (30m intervals)
  const timeSlots: string[] = [];
  for (let h = 7; h <= 19; h++) {
    timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
  }

  // State for drag and drop highlighting
  const [dragOverCell, setDragOverCell] = useState<{ slot: string; profId: number } | null>(null);

  // Helper to find if any appointment for this professional overlaps with the 30-minute slot starting at slotTime
  const getOverlappingAppt = (slotTime: string, profId: number) => {
    return agendamentos.find(a => {
      if (a.dataISO !== currentDate || a.profId !== profId) return false;

      const [sh, sm] = a.hora.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = startMin + (a.durMin || 30);

      const [slotH, slotM] = slotTime.split(':').map(Number);
      const slotMin = slotH * 60 + slotM;

      return slotMin >= startMin && slotMin < endMin;
    });
  };

  // Helper to get number of grid rows spanned by appointment duration (min 1 row per 30 minutes)
  const getApptSpan = (appt: Agendamento) => {
    return Math.max(1, Math.ceil((appt.durMin || 30) / 30));
  };

  // Handler to update appointment time and professional after a drag & drop drop event
  const handleMoveAppointment = async (apptId: number, targetTime: string, targetProfId: number) => {
    try {
      const appt = agendamentos.find(a => a.id === apptId);
      if (!appt) return;

      const duration = appt.durMin || 30;
      const [h, m] = targetTime.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m + duration);
      const fh = d.getHours().toString().padStart(2, '0');
      const fm = d.getMinutes().toString().padStart(2, '0');
      const targetTimeEnd = `${fh}:${fm}`;

      const { error } = await supabase
        .from('agendamentos')
        .update({
          prof_id: targetProfId,
          hora: targetTime,
          hora_fim: targetTimeEnd
        })
        .eq('id', apptId);

      if (error) throw error;
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert('Erro ao mover agendamento.');
    }
  };

  // Active professionals list
  const activeProfs = (() => {
    if (selectedProf !== 'all') {
      return profissionais.filter(p => p.id === selectedProf);
    }
    const profsWithAppts = profissionais.filter(p =>
      p.status === 'Ativo' &&
      agendamentos.some(a => a.profId === p.id && a.dataISO === currentDate)
    );
    return profsWithAppts.length > 0
      ? profsWithAppts
      : profissionais.filter(p => p.status === 'Ativo');
  })();

  // Status changers
  const handleStatusChange = async (id: number, newStatus: string) => {
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
      alert('Erro ao alterar status.');
    }
  };

  // Add / Edit Trigger
  const resetSadtStates = () => {
    setSadtAns('');
    setSadtGuiaPrincipal('');
    setSadtOperadora('');
    setSadtDtAut('');
    setSadtSenha('');
    setSadtValSenha('');
    setSadtNumOp('');
    setSadtBeneficiario('');
    setSadtCns('');
    setSadtCodPrestador('');
    setSadtPrestador('');
    setSadtProcs([
      { codigo: '50000470', desc: 'Sessão de Psicoterapia', qtd: 1, valor: 60.00, total: 60.00 }
    ]);
  };

  const openAddModal = (initialTime?: string, initialProfId?: number) => {
    setEditId(null);
    setProfIdForm(initialProfId || profissionais[0]?.id || 0);
    setDataAg(currentDate);
    setHoraIni(initialTime || '09:00');
    setDuracao(30);
    setModalidade('presencial');
    setMeetLink('');
    setIsGroupMode(false);
    setGroupPacientes([]);
    setPaciente('');
    setPlanoId(5);
    setCarteirinha('');
    setTipoAtendimento('sessao');
    setStatus(statusAgendamentos[0]?.nome || 'Agendado');
    setObs('');
    setHasRecorrencia(false);
    resetSadtStates();
    setModalTab('dados');
    setIsModalOpen(true);
  };

  const openEditModal = async (a: Agendamento) => {
    setEditId(a.id);
    setProfIdForm(a.profId || profissionais[0]?.id || 0);
    setDataAg(a.dataISO);
    setHoraIni(a.hora);
    const calculatedDuration = a.durMin || 30;
    setDuracao(calculatedDuration);
    setHoraFim(a.horaFim);
    setModalidade(a.modalidade || 'presencial');
    setMeetLink(a.meetLink || '');
    setIsGroupMode(false);
    setPaciente(a.paciente);
    setPlanoId(a.planoId || 5);
    setCarteirinha(a.carteirinha || '');
    const matchedStatus = statusAgendamentos.find(s => s.nome.toLowerCase() === a.status.toLowerCase())?.nome || a.status;
    setStatus(matchedStatus);
    setObs(a.obs || '');
    setHasRecorrencia(false);
    setTipoAtendimento(a.tipo || 'sessao');
    
    // Reset/Load SADT Guide
    resetSadtStates();
    try {
      const { data: guideData, error } = await supabase
        .from('guias_sadt')
        .select('*')
        .eq('agendamento_id', a.id)
        .maybeSingle();

      if (guideData && !error) {
        setSadtAns(guideData.dados?.ans || '');
        setSadtGuiaPrincipal(guideData.dados?.guiaPrincipal || '');
        setSadtOperadora(guideData.dados?.operadora || '');
        setSadtDtAut(guideData.dados?.dataAutorizacao || '');
        setSadtSenha(guideData.dados?.senha || '');
        setSadtValSenha(guideData.dados?.validadeSenha || '');
        setSadtNumOp(guideData.numOp || '');
        setSadtBeneficiario(guideData.dados?.beneficiario || '');
        setSadtCns(guideData.dados?.cns || '');
        setSadtCodPrestador(guideData.dados?.codPrestador || '');
        setSadtPrestador(guideData.dados?.prestador || '');
        if (guideData.dados?.procs) {
          setSadtProcs(guideData.dados.procs);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar guia SADT:', err);
    }
    
    setModalTab('dados');
    setIsModalOpen(true);
  };

  const handleDeleteAppt = async () => {
    if (!editId) return;
    if (!confirm('Deseja realmente excluir este agendamento?')) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', editId);
      if (error) throw error;
      alert('Agendamento excluído.');
      setIsModalOpen(false);
      await refreshAll();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao excluir agendamento: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Date Navigator functions
  const handlePrevDay = () => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const getStartOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(d.setDate(diff));
  };

  const getWeekDays = () => {
    const start = getStartOfWeek(new Date(currentDate + 'T00:00:00'));
    const days = [];
    for (let i = 0; i < 6; i++) { // Monday to Saturday
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const handlePrevWeek = () => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Submit Handler
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const patientsToSchedule = isGroupMode ? groupPacientes : [paciente];

    if (patientsToSchedule.length === 0 || !patientsToSchedule[0]) {
      alert('Por favor, informe ao menos um paciente.');
      setSubmitting(false);
      return;
    }

    try {
      const plName = planos.find(pl => pl.id === Number(planoId))?.nome || 'Particular';
      const totalSadtVal = sadtProcs.reduce((acc, curr) => acc + curr.total, 0);

      // Find the matched patient object from datalist options to get their pacId
      const matchedPac = getDatalistOptions().find(p => p.nome.trim().toLowerCase() === patientsToSchedule[0]?.trim().toLowerCase());
      const pacId = matchedPac ? matchedPac.id : null;

      if (editId) {
        // Edit flow
        const apptPayload: Partial<Agendamento> = {
          profId: profIdForm,
          pacId,
          paciente: patientsToSchedule[0],
          plano: plName,
          planoId: Number(planoId),
          hora: horaIni,
          horaFim,
          durMin: duracao || 30,
          dataISO: dataAg,
          status,
          obs,
          modalidade,
          meetLink: modalidade === 'online' ? meetLink : '',
          carteirinha,
          tipo: tipoAtendimento,
          guia: totalSadtVal > 0 ? {
            autorizacao: sadtNumOp || 'PRESTADOR_GUIA',
            total: totalSadtVal
          } : null
        };

        const oldAppt = agendamentos.find(a => a.id === editId);
        const statusChanged = oldAppt && oldAppt.status !== status;

        const { error } = await supabase
          .from('agendamentos')
          .update(mappers.apptToDb(apptPayload))
          .eq('id', editId);

        if (error) throw error;
        if (statusChanged) {
          await logStatusChange(editId, status);
        }

        // SADT Guide update/upsert on edit
        if (totalSadtVal > 0) {
          const guidePayload: Partial<GuiaSadt> = {
            num: sadtNumOp || `0${Date.now().toString().slice(-6)}`,
            pac: patientsToSchedule[0],
            planoId: Number(planoId),
            plano: plName,
            profId: profIdForm,
            valor: totalSadtVal,
            status: 'Pendente',
            data: dataAg,
            carteirinha: carteirinha,
            numOp: sadtNumOp,
            dados: {
              cns: sadtCns,
              tipoAtendimento,
              guiaPrincipal: sadtGuiaPrincipal,
              ans: sadtAns,
              operadora: sadtOperadora,
              dataAutorizacao: sadtDtAut,
              senha: sadtSenha,
              validadeSenha: sadtValSenha,
              beneficiario: sadtBeneficiario,
              codPrestador: sadtCodPrestador,
              prestador: sadtPrestador,
              procs: sadtProcs
            }
          };

          const { data: existingGuide } = await supabase
            .from('guias_sadt')
            .select('id')
            .eq('agendamento_id', editId)
            .maybeSingle();

          if (existingGuide) {
            const { error: guideErr } = await supabase
              .from('guias_sadt')
              .update(mappers.guiaToDb(guidePayload))
              .eq('id', existingGuide.id);
            if (guideErr) throw guideErr;
          } else {
            const { error: guideErr } = await supabase
              .from('guias_sadt')
              .insert([mappers.guiaToDb({ ...guidePayload, agendamentoId: editId })]);
            if (guideErr) throw guideErr;
          }
        } else {
          await supabase
            .from('guias_sadt')
            .delete()
            .eq('agendamento_id', editId);
        }

        alert('Agendamento atualizado!');
      } else {
        // Create flow (supports recurrence)
        const datesToSchedule = [dataAg];
        if (hasRecorrencia) {
          let baseDate = new Date(dataAg + 'T00:00:00');
          const limitCount = recLimite === 'qtd' ? recQtd : 12;
          for (let i = 1; i < limitCount; i++) {
            if (recFrequencia === 'diario') baseDate.setDate(baseDate.getDate() + 1);
            else if (recFrequencia === 'semanal') baseDate.setDate(baseDate.getDate() + 7);
            else if (recFrequencia === 'quinzenal') baseDate.setDate(baseDate.getDate() + 14);
            else if (recFrequencia === 'mensal') baseDate.setMonth(baseDate.getMonth() + 1);
            datesToSchedule.push(baseDate.toISOString().split('T')[0]);
          }
        }

        for (const d of datesToSchedule) {
          for (const pacName of patientsToSchedule) {
            const currentPac = getDatalistOptions().find(p => p.nome.trim().toLowerCase() === pacName.trim().toLowerCase());
            const currentPacId = currentPac ? currentPac.id : null;

            const apptPayload: Partial<Agendamento> = {
              profId: profIdForm,
              pacId: currentPacId,
              paciente: pacName,
              plano: plName,
              planoId: Number(planoId),
              hora: horaIni,
              horaFim,
              durMin: duracao || 30,
              dataISO: d,
              status,
              obs,
              modalidade,
              meetLink: modalidade === 'online' ? meetLink : '',
              carteirinha,
              waSent: false,
              tipo: tipoAtendimento,
              guia: totalSadtVal > 0 ? {
                autorizacao: sadtNumOp || 'PRESTADOR_GUIA',
                total: totalSadtVal
              } : null
            };

            const { data: insertedAppt, error: apptErr } = await supabase
              .from('agendamentos')
              .insert([mappers.apptToDb(apptPayload)])
              .select()
              .single();

            if (apptErr) throw apptErr;
            if (insertedAppt) {
              await logStatusChange(insertedAppt.id, status);
            }

            if (totalSadtVal > 0) {
              const guidePayload: Partial<GuiaSadt> = {
                num: sadtNumOp || `0${Date.now().toString().slice(-6)}`,
                pac: pacName,
                planoId: Number(planoId),
                plano: plName,
                profId: profIdForm,
                valor: totalSadtVal,
                status: 'Pendente',
                data: d,
                carteirinha: carteirinha,
                numOp: sadtNumOp,
                dados: {
                  cns: sadtCns,
                  tipoAtendimento,
                  guiaPrincipal: sadtGuiaPrincipal,
                  ans: sadtAns,
                  operadora: sadtOperadora,
                  dataAutorizacao: sadtDtAut,
                  senha: sadtSenha,
                  validadeSenha: sadtValSenha,
                  beneficiario: sadtBeneficiario,
                  codPrestador: sadtCodPrestador,
                  prestador: sadtPrestador,
                  procs: sadtProcs
                }
              };

              const { error: guideErr } = await supabase
                .from('guias_sadt')
                .insert([mappers.guiaToDb({ ...guidePayload, agendamentoId: insertedAppt.id })]);
              if (guideErr) throw guideErr;
            }
          }
        }
        alert('Agendamento cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar agendamento.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group pacientes helpers
  const addGroupPaciente = () => {
    if (groupInputVal.trim() && !groupPacientes.includes(groupInputVal.trim())) {
      setGroupPacientes([...groupPacientes, groupInputVal.trim()]);
      setGroupInputVal('');
    }
  };

  const removeGroupPaciente = (idx: number) => {
    setGroupPacientes(groupPacientes.filter((_, i) => i !== idx));
  };

  // SADT procedures helper
  const addSadtProcRow = () => {
    setFeriadosRows();
  };

  const setFeriadosRows = () => {
    setSadtProcs([...sadtProcs, { codigo: '', desc: '', qtd: 1, valor: 0, total: 0 }]);
  };

  const removeSadtProcRow = (idx: number) => {
    setSadtProcs(sadtProcs.filter((_, i) => i !== idx));
  };

  const updateSadtProcRow = (idx: number, field: keyof ProcedimentoGuia, val: any) => {
    const copy = [...sadtProcs];
    const target = { ...copy[idx] };
    if (field === 'codigo') {
      target.codigo = val;
      const match = procedimentos.find(p => p.codigo === val);
      if (match) {
        target.desc = match.desc;
        target.valor = match.valPlano;
      }
    } else if (field === 'desc') {
      target.desc = val;
    } else if (field === 'qtd') {
      target.qtd = Number(val);
    } else if (field === 'valor') {
      target.valor = Number(val);
    }
    target.total = target.qtd * target.valor;
    copy[idx] = target;
    setSadtProcs(copy);
  };

  // Month grid helpers
  const getMonthDays = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const firstDayIndex = new Date(y, m - 1, 1).getDay(); // Sunday is 0
    const totalDays = new Date(y, m, 0).getDate();

    const days = [];
    const adjustOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // start from Monday
    for (let i = 0; i < adjustOffset; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDays; i++) {
      days.push(`${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return days;
  };

  const formatMonthTitle = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  };

  // Get color by status
  const getStatusColor = (st: string) => {
    const base = getBaseStatus(st);
    if (base === 'atendido') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/40';
    if (base === 'confirmado') return 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:border-blue-500/40';
    if (base === 'cancelado' || base === 'desmarcado') return 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:border-rose-500/40';
    return 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:border-indigo-500/40';
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">

      {/* Top Controls Header */}
      <div className="sticky top-0 bg-[#07090e]/95 backdrop-blur-md z-20 pb-4 pt-1 -mx-8 px-8 border-b border-white/[0.04] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Quadro Operacional</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Quadro de Agendamentos</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie consultas, atendimentos, recorrências e guias SADT dos profissionais</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Select */}
          <div className="flex gap-1 bg-[#131622]/60 p-1 rounded-xl border border-white/[0.04] shadow-md">
            {(['diario', 'semanal', 'mensal', 'anual'] as const).map((vt) => (
              <button
                key={vt}
                onClick={() => setViewType(vt)}
                className={`px-3 py-1.5 rounded-lg font-bold text-[10px] capitalize transition-all ${viewType === vt ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {vt}
              </button>
            ))}
          </div>

          {/* Date Navigator */}
          {viewType === 'diario' && (
            <div className="flex items-center bg-[#131622]/60 border border-white/[0.06] rounded-xl overflow-hidden shadow-lg">
              <button onClick={handlePrevDay} className="p-2.5 hover:bg-white/5 border-r border-white/[0.04] text-slate-400 transition-all"><ChevronLeft size={14} /></button>
              <span className="px-4 py-2 text-[10px] font-bold text-slate-200 min-w-[210px] text-center font-mono">
                {new Date(currentDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleNextDay} className="p-2.5 hover:bg-white/5 border-l border-white/[0.04] text-slate-400 transition-all"><ChevronRight size={14} /></button>
            </div>
          )}

          {viewType === 'semanal' && (
            <div className="flex items-center bg-[#131622]/60 border border-white/[0.06] rounded-xl overflow-hidden shadow-lg">
              <button onClick={handlePrevWeek} className="p-2.5 hover:bg-white/5 border-r border-white/[0.04] text-slate-400 transition-all"><ChevronLeft size={14} /></button>
              <span className="px-4 py-2 text-[10px] font-bold text-slate-200 min-w-[180px] text-center">
                Semana de {new Date(getWeekDays()[0] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a {new Date(getWeekDays()[5] + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              </span>
              <button onClick={handleNextWeek} className="p-2.5 hover:bg-white/5 border-l border-white/[0.04] text-slate-400 transition-all"><ChevronRight size={14} /></button>
            </div>
          )}

          {viewType === 'mensal' && (
            <div className="flex items-center bg-[#131622]/60 border border-white/[0.06] rounded-xl overflow-hidden shadow-lg">
              <button onClick={handlePrevMonth} className="p-2.5 hover:bg-white/5 border-r border-white/[0.04] text-slate-400 transition-all"><ChevronLeft size={14} /></button>
              <span className="px-4 py-2 text-[10px] font-bold text-slate-200 min-w-[160px] text-center font-mono">
                {formatMonthTitle(selectedMonth)}
              </span>
              <button onClick={handleNextMonth} className="p-2.5 hover:bg-white/5 border-l border-white/[0.04] text-slate-400 transition-all"><ChevronRight size={14} /></button>
            </div>
          )}

          {viewType === 'anual' && (
            <div className="flex items-center bg-[#131622]/60 border border-white/[0.06] rounded-xl overflow-hidden shadow-lg">
              <button onClick={() => setSelectedYear(selectedYear - 1)} className="p-2.5 hover:bg-white/5 border-r border-white/[0.04] text-slate-400 transition-all"><ChevronLeft size={14} /></button>
              <span className="px-5 py-2 text-[10px] font-bold text-slate-200 min-w-[80px] text-center font-mono">{selectedYear}</span>
              <button onClick={() => setSelectedYear(selectedYear + 1)} className="p-2.5 hover:bg-white/5 border-l border-white/[0.04] text-slate-400 transition-all"><ChevronRight size={14} /></button>
            </div>
          )}

          {/* Quick actions */}
          <select
            value={selectedProf}
            onChange={(e) => setSelectedProf(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-[#131622]/60 border border-white/[0.06] rounded-xl px-3 py-2 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
          >
            <option value="all">Todos os profissionais</option>
            {profissionais.filter(p => p.status === 'Ativo').map(p => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>

          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-[10px]"
          >
            <Plus size={12} />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* ── DAILY VIEW ── */}
      {viewType === 'diario' && (
        <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
            <div
              className="min-w-[800px] grid"
              style={{
                gridTemplateColumns: `80px repeat(${activeProfs.length}, minmax(200px, 1fr))`,
                gridTemplateRows: `auto repeat(${timeSlots.length}, 72px)`
              }}
            >
              {/* Spacer Header Cell */}
              <div className="sticky top-0 z-20 border-b border-r border-white/[0.04] bg-[#131622]" style={{ gridColumn: 1, gridRow: 1 }} />

              {/* Professional name headers */}
              {activeProfs.map((p, idx) => (
                <div
                  key={p.id}
                  className="sticky top-0 z-20 p-3 border-b border-r border-white/[0.04] bg-[#131622] flex flex-col items-center justify-center gap-1 min-w-[200px]"
                  style={{ gridColumn: idx + 2, gridRow: 1 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: p.cor }} />
                    <span className="font-bold text-slate-200 text-xs text-center truncate max-w-[160px]">{p.nomeAgenda || p.nome}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{p.esp}</span>
                </div>
              ))}

              {/* Time slot label column */}
              {timeSlots.map((slotTime, slotIdx) => (
                <div
                  key={slotTime}
                  className="p-3 border-b border-r border-white/[0.04] flex items-center justify-center font-mono font-bold text-slate-400 text-[10px]"
                  style={{ gridColumn: 1, gridRow: slotIdx + 2 }}
                >
                  {slotTime}
                </div>
              ))}

              {/* Base background cells & drop zones */}
              {timeSlots.flatMap((slotTime, slotIdx) =>
                activeProfs.map((p, pIdx) => {
                  const R = slotIdx + 2;
                  const C = pIdx + 2;
                  const hasOverlap = !!getOverlappingAppt(slotTime, p.id);
                  const isDragOver = dragOverCell?.slot === slotTime && dragOverCell?.profId === p.id;

                  return (
                    <div
                      key={`${slotTime}-${p.id}`}
                      className={`border-b border-r border-white/[0.03] p-1.5 flex items-center justify-center relative group transition-all ${isDragOver ? 'bg-[#4f46e5]/10 border border-dashed border-[#4f46e5]/40' : ''
                        }`}
                      style={{ gridColumn: C, gridRow: R }}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => setDragOverCell({ slot: slotTime, profId: p.id })}
                      onDragLeave={() => setDragOverCell(null)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setDragOverCell(null);
                        const apptIdStr = e.dataTransfer.getData('text/plain');
                        if (!apptIdStr) return;
                        await handleMoveAppointment(Number(apptIdStr), slotTime, p.id);
                      }}
                    >
                      {!hasOverlap && (
                        <button
                          onClick={() => openAddModal(slotTime, p.id)}
                          className="opacity-0 group-hover:opacity-100 w-full py-2 border border-dashed border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.005] rounded-xl text-slate-500 hover:text-slate-300 font-bold transition-all text-center text-[9px] cursor-pointer"
                        >
                          + Novo Slot
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              {/* Appointments overlay cards */}
              {agendamentos
                .filter(a => a.dataISO === currentDate && timeSlots.includes(a.hora) && (selectedProf === 'all' || a.profId === selectedProf))
                .map(appt => {
                  const pIdx = activeProfs.findIndex(p => p.id === appt.profId);
                  if (pIdx === -1) return null;
                  const slotIdx = timeSlots.indexOf(appt.hora);
                  if (slotIdx === -1) return null;

                  const R = slotIdx + 2;
                  const C = pIdx + 2;
                  const span = getApptSpan(appt);

                  return (
                    <div
                      key={appt.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', appt.id.toString());
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => openEditModal(appt)}
                      className={`m-1 p-2.5 rounded-xl border transition-all text-[10px] space-y-1 relative group/appt cursor-pointer flex flex-col justify-between z-10 ${getStatusColor(appt.status)}`}
                      style={{
                        gridColumn: C,
                        gridRow: `${R} / span ${span}`,
                        height: 'calc(100% - 8px)',
                        borderLeft: `6px solid ${getStatusColorHex(appt.status)}`,
                        borderColor: `${getStatusColorHex(appt.status)}30`
                      }}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-slate-200 leading-tight block truncate max-w-[120px]" title={appt.paciente}>
                            {appt.paciente}
                          </span>
                          {!appt.guia && appt.plano !== 'Particular' && (
                            <span className="shrink-0 text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/15 px-1 py-0.25 rounded">
                              s/ guia
                            </span>
                          )}
                        </div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide truncate max-w-[140px] ${getPlanoBadgeStyles(appt.plano)}`}>
                          {appt.plano}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500 flex justify-between items-center font-mono">
                        <span>{appt.durMin} min</span>
                        <span>{appt.hora}</span>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      )}

      {/* ── WEEKLY VIEW ── */}
      {viewType === 'semanal' && (
        <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden flex flex-col">
          <div className="grid grid-cols-6 divide-x divide-white/[0.04]">
            {getWeekDays().map((day) => {
              const appts = agendamentos.filter(a => a.dataISO === day && (selectedProf === 'all' || a.profId === selectedProf))
                .sort((a, b) => a.hora.localeCompare(b.hora));
              const dateObj = new Date(day + 'T00:00:00');
              const isToday = day === new Date().toISOString().split('T')[0];

              return (
                <div key={day} className="flex flex-col min-h-[500px]">
                  {/* Day Header */}
                  <div className={`p-4 text-center border-b border-white/[0.04] ${isToday ? 'bg-indigo-500/5' : 'bg-white/[0.01]'}`}>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                      {dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}
                    </span>
                    <span className={`text-base font-black ${isToday ? 'text-indigo-400' : 'text-slate-200'}`}>
                      {dateObj.getDate()}
                    </span>
                  </div>

                  {/* Appointments list */}
                  <div className="p-3 flex-1 space-y-2.5 overflow-y-auto max-h-[600px] scrollbar-thin">
                    {appts.map((appt) => {
                      const prof = profissionais.find(p => p.id === appt.profId);
                      return (
                        <div
                          key={appt.id}
                          onClick={() => openEditModal(appt)}
                          className={`p-2.5 rounded-xl border cursor-pointer hover:scale-[1.01] transition-all space-y-1.5 ${getStatusColor(appt.status)}`}
                          style={{
                            borderLeft: `6px solid ${getStatusColorHex(appt.status)}`,
                            borderColor: `${getStatusColorHex(appt.status)}30`
                          }}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <span className="font-bold text-slate-200 block truncate max-w-[90px]">{appt.paciente}</span>
                            <span className="font-mono text-[9px] text-slate-500">{appt.hora}</span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide truncate max-w-[90px] ${getPlanoBadgeStyles(appt.plano)}`}>
                              {appt.plano}
                            </span>
                            {prof && (
                              <span className="w-2 h-2 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: prof.cor }} title={prof.nome} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => { setDataAg(day); openAddModal(); }}
                      className="w-full py-2.5 border border-dashed border-white/5 hover:border-white/15 rounded-xl text-center text-slate-500 hover:text-slate-400 transition-all font-bold text-[9px] cursor-pointer"
                    >
                      + Novo Agendamento
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MONTHLY VIEW ── */}
      {viewType === 'mensal' && (
        <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Weekday headers */}
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(wd => (
              <div key={wd} className="text-center font-bold text-slate-400 uppercase py-2 text-[9px] tracking-wider">{wd}</div>
            ))}

            {getMonthDays().map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="bg-transparent border-0 min-h-[90px]" />;
              const appts = agendamentos.filter(a => a.dataISO === day && (selectedProf === 'all' || a.profId === selectedProf))
                .sort((a, b) => a.hora.localeCompare(b.hora));
              const dateObj = new Date(day + 'T00:00:00');
              const isToday = day === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={day}
                  className={`min-h-[95px] p-2 rounded-xl border flex flex-col justify-between hover:border-white/10 transition-all ${isToday ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-[#161a26]/40 border-white/[0.03]'
                    }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-mono font-bold ${isToday ? 'text-indigo-400' : 'text-slate-300'}`}>{dateObj.getDate()}</span>
                    {appts.length > 0 && <span className="text-[8px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.25 rounded-md font-bold">{appts.length} c.</span>}
                  </div>

                  <div className="space-y-1 flex-1 overflow-y-auto max-h-[60px] scrollbar-none py-1">
                    {appts.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); openEditModal(a); }}
                        className="px-1.5 py-0.5 rounded text-[8px] truncate font-bold bg-white/[0.02] border border-white/[0.04] text-slate-300 hover:text-indigo-400 transition-colors cursor-pointer"
                        title={`${a.hora} - ${a.paciente}`}
                      >
                        {a.hora} {a.paciente}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setDataAg(day); openAddModal(); }}
                    className="w-full text-left text-slate-600 hover:text-slate-400 text-[8px] font-bold block pt-1.5 border-t border-white/[0.03] mt-auto cursor-pointer"
                  >
                    + Agendar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── YEARLY VIEW ── */}
      {viewType === 'anual' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 12 }).map((_, i) => {
            const mStr = String(i + 1).padStart(2, '0');
            const ym = `${selectedYear}-${mStr}`;
            const monthAppts = agendamentos.filter(a => a.dataISO.startsWith(ym) && (selectedProf === 'all' || a.profId === selectedProf));
            const countAtendidos = monthAppts.filter(a => getBaseStatus(a.status) === 'atendido').length;
            const countAgendados = monthAppts.filter(a => {
              const base = getBaseStatus(a.status);
              return base === 'agendado' || base === 'confirmado';
            }).length;

            return (
              <div
                key={i}
                onClick={() => { setSelectedMonth(ym); setViewType('mensal'); }}
                className="p-5 bg-[#131622]/50 border border-white/[0.04] rounded-2xl hover:border-indigo-500/30 transition-all cursor-pointer flex flex-col justify-between space-y-4 hover:translate-y-[-2px]"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-200 border-b border-white/[0.04] pb-2">
                    {new Date(selectedYear, i, 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
                  </h3>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Agendados:</span>
                      <span className="font-mono text-slate-200 font-bold">{countAgendados}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Atendidos:</span>
                      <span className="font-mono text-emerald-400 font-bold">{countAtendidos}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.04] flex justify-between items-center text-[9px] text-slate-500">
                  <span>Total Consultas:</span>
                  <span className="font-mono font-bold text-indigo-400 text-xs">{monthAppts.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Advanced Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] bg-[#131622]/40 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{editId ? 'Editar Agendamento' : 'Novo Agendamento'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Preencha e parametrize os dados da consulta ou guia SADT</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-base">&times;</button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/[0.04] px-6 bg-[#131622]/20">
              <button
                type="button"
                onClick={() => setModalTab('dados')}
                className={`flex items-center gap-1.5 py-3 px-4 border-b-2 font-bold tracking-wide transition-all ${modalTab === 'dados' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Calendar size={13} />
                Dados do Agendamento
              </button>
              {!editId && (
                <button
                  type="button"
                  onClick={() => setModalTab('sadt')}
                  className={`flex items-center gap-1.5 py-3 px-4 border-b-2 font-bold tracking-wide transition-all ${modalTab === 'sadt' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <FileText size={13} />
                  Guia SADT / TISS
                </button>
              )}
            </div>

            <form onSubmit={handleScheduleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {modalTab === 'dados' ? (
                /* TAB 1: DADOS DO AGENDAMENTO */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Profissional / Terapeuta</label>
                      <select
                        value={profIdForm}
                        onChange={(e) => setProfIdForm(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        {profissionais.filter(p => p.status === 'Ativo').map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Data da Consulta</label>
                      <input
                        type="date"
                        value={dataAg}
                        onChange={(e) => setDataAg(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Horário Início</label>
                      <input
                        type="time"
                        value={horaIni}
                        onChange={(e) => setHoraIni(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Duração</label>
                      <select
                        value={duracao}
                        onChange={(e) => setDuracao(Number(e.target.value))}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                        <option value={0}>Personalizado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Horário Fim</label>
                      <input
                        type="time"
                        value={horaFim}
                        onChange={(e) => setHoraFim(e.target.value)}
                        disabled={duracao !== 0}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono disabled:opacity-55"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Modalidade</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setModalidade('presencial')}
                          className={`flex-1 py-2 rounded-lg font-bold border transition-all ${modalidade === 'presencial' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' : 'bg-[#161a26] border-white/[0.04] text-slate-400'
                            }`}
                        >
                          Presencial
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalidade('online')}
                          className={`flex-1 py-2 rounded-lg font-bold border transition-all ${modalidade === 'online' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25' : 'bg-[#161a26] border-white/[0.04] text-slate-400'
                            }`}
                        >
                          Teleconsulta (Online)
                        </button>
                      </div>
                    </div>
                    {modalidade === 'online' && (
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Link da Sala Virtual (Google Meet / Zoom)</label>
                        <input
                          type="text"
                          value={meetLink}
                          onChange={(e) => setMeetLink(e.target.value)}
                          placeholder="https://meet.google.com/..."
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Group Mode vs Single mode */}
                  {!editId && (
                    <div className="border border-white/[0.04] p-3.5 rounded-xl bg-white/[0.01]">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-200">Atendimento em Grupo?</span>
                        <button
                          type="button"
                          onClick={() => setIsGroupMode(!isGroupMode)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-bold border transition-all ${isGroupMode ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-[#161a26] text-slate-400 border-white/[0.06]'
                            }`}
                        >
                          {isGroupMode ? 'Desativar' : 'Ativar'}
                        </button>
                      </div>

                      {isGroupMode ? (
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={groupInputVal}
                              onChange={(e) => setGroupInputVal(e.target.value)}
                              placeholder="Nome do paciente..."
                              className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs"
                            />
                            <button
                              type="button"
                              onClick={addGroupPaciente}
                              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-bold"
                            >
                              Adicionar
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {groupPacientes.map((pacName, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161a26] border border-white/[0.06] text-slate-300 text-[10px]">
                                {pacName}
                                <button type="button" onClick={() => removeGroupPaciente(idx)} className="text-rose-400 hover:text-rose-300 font-bold">&times;</button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Paciente *</label>
                            <input
                              type="text"
                              list="agenda-pacientes-list"
                              value={paciente}
                              onChange={(e) => setPaciente(e.target.value)}
                              placeholder="Buscar ou digite novo..."
                              className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                            />
                            <datalist id="agenda-pacientes-list">
                              {getDatalistOptions().map(p => (
                                <option key={p.id} value={p.nome} />
                              ))}
                            </datalist>
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde</label>
                            <select
                              value={planoId}
                              onChange={(e) => setPlanoId(Number(e.target.value))}
                              className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                            >
                              {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                                <option key={pl.id} value={pl.id}>{pl.nome}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Single Mode Form Edit Helper */}
                  {editId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Paciente *</label>
                        <input
                          type="text"
                          value={paciente}
                          onChange={(e) => setPaciente(e.target.value)}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde</label>
                        <select
                          value={planoId}
                          onChange={(e) => setPlanoId(Number(e.target.value))}
                          className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                        >
                          {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.nome}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nº Carteirinha</label>
                      <input
                        type="text"
                        value={carteirinha}
                        onChange={(e) => setCarteirinha(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Tipo de Atendimento</label>
                      <select
                        value={tipoAtendimento}
                        onChange={(e) => setTipoAtendimento(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        <option value="sessao">Sessão Regular</option>
                        <option value="avaliacao">Avaliação Neuropsicológica</option>
                        <option value="continua">Continuidade Neuropsicológica</option>
                        <option value="devolutiva">Devolutiva Neuropsicológica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                      >
                        {statusAgendamentos.map(s => (
                          <option key={s.nome} value={s.nome}>
                            {s.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Observações da Consulta</label>
                    <textarea
                      rows={2}
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Ex: Primeira sessão, trazer laudo de encaminhamento..."
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none"
                    />
                  </div>

                  {/* Recorrência (Only for new schedules) */}
                  {!editId && (
                    <div className="border border-white/[0.04] p-3.5 rounded-xl bg-white/[0.01]">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200 mb-3">
                        <input
                          type="checkbox"
                          checked={hasRecorrencia}
                          onChange={(e) => setHasRecorrencia(e.target.checked)}
                          className="rounded text-indigo-500 bg-[#161a26] border-white/[0.06] focus:ring-indigo-500"
                        />
                        Repetir Agendamento (Recorrência)?
                      </label>

                      {hasRecorrencia && (
                        <div className="grid grid-cols-3 gap-4 animate-fade-in">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1 text-[10px]">Frequência</label>
                            <select
                              value={recFrequencia}
                              onChange={(e) => setRecFrequencia(e.target.value as any)}
                              className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                            >
                              <option value="diario">Diário</option>
                              <option value="semanal">Semanal</option>
                              <option value="quinzenal">Quinzenal</option>
                              <option value="mensal">Mensal</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1 text-[10px]">Limitar Por</label>
                            <select
                              value={recLimite}
                              onChange={(e) => setRecLimite(e.target.value as any)}
                              className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                            >
                              <option value="ilimitado">Sem limite (12x)</option>
                              <option value="qtd">Qtd. Ocorrências</option>
                            </select>
                          </div>
                          {recLimite === 'qtd' && (
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1 text-[10px]">Qtd. Repetições</label>
                              <input
                                type="number"
                                min={2}
                                max={50}
                                value={recQtd}
                                onChange={(e) => setRecQtd(Number(e.target.value))}
                                className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 2: GUIA SADT / TISS */
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Registro ANS</label>
                      <input
                        type="text"
                        value={sadtAns}
                        onChange={(e) => setSadtAns(e.target.value)}
                        placeholder="Ex: 418374"
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nº Guia Principal</label>
                      <input
                        type="text"
                        value={sadtGuiaPrincipal}
                        onChange={(e) => setSadtGuiaPrincipal(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nome da Operadora</label>
                      <input
                        type="text"
                        value={sadtOperadora}
                        onChange={(e) => setSadtOperadora(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Data Autorização</label>
                      <input
                        type="date"
                        value={sadtDtAut}
                        onChange={(e) => setSadtDtAut(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Senha Aut.</label>
                      <input
                        type="text"
                        value={sadtSenha}
                        onChange={(e) => setSadtSenha(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Validade Senha</label>
                      <input
                        type="date"
                        value={sadtValSenha}
                        onChange={(e) => setSadtValSenha(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nº Guia Operadora</label>
                      <input
                        type="text"
                        value={sadtNumOp}
                        onChange={(e) => setSadtNumOp(e.target.value)}
                        placeholder="Ex: 8872361"
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nome do Beneficiário</label>
                      <input
                        type="text"
                        value={sadtBeneficiario}
                        onChange={(e) => setSadtBeneficiario(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">CNS / CPF</label>
                      <input
                        type="text"
                        value={sadtCns}
                        onChange={(e) => setSadtCns(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Código do Prestador</label>
                      <input
                        type="text"
                        value={sadtCodPrestador}
                        onChange={(e) => setSadtCodPrestador(e.target.value)}
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-400 font-semibold mb-1">Nome do Prestador Executor</label>
                      <input
                        type="text"
                        value={sadtPrestador}
                        onChange={(e) => setSadtPrestador(e.target.value)}
                        placeholder="Ex: Clínica Integrada..."
                        className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>

                  {/* Procedures Table */}
                  <div className="space-y-2 border border-white/[0.04] p-4 rounded-xl bg-white/[0.01]">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">Procedimentos Autorizados</span>
                      <button
                        type="button"
                        onClick={addSadtProcRow}
                        className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
                      >
                        + Adicionar Procedimento
                      </button>
                    </div>

                    <div className="space-y-2">
                      {sadtProcs.map((proc, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <select
                            value={proc.codigo}
                            onChange={(e) => updateSadtProcRow(idx, 'codigo', e.target.value)}
                            className="w-28 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1 text-white focus:outline-none text-[10px]"
                          >
                            <option value="">— Selecione —</option>
                            {procedimentos.map(p => (
                              <option key={p.codigo} value={p.codigo}>{p.codigo} - {p.desc}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="Descrição"
                            value={proc.desc}
                            onChange={(e) => updateSadtProcRow(idx, 'desc', e.target.value)}
                            className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1 text-white text-[10px]"
                          />
                          <input
                            type="number"
                            min={1}
                            placeholder="Qtd"
                            value={proc.qtd}
                            onChange={(e) => updateSadtProcRow(idx, 'qtd', Number(e.target.value))}
                            className="w-12 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1 text-white text-center text-[10px]"
                          />
                          <input
                            type="number"
                            placeholder="R$"
                            value={proc.valor}
                            onChange={(e) => updateSadtProcRow(idx, 'valor', Number(e.target.value))}
                            className="w-16 bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1 text-white text-right font-mono text-[10px]"
                          />
                          <button
                            type="button"
                            onClick={() => removeSadtProcRow(idx)}
                            className="p-1 hover:bg-white/5 text-rose-400 rounded-lg"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/[0.04] flex justify-between items-center bg-[#131622]/20">
                <div>
                  {editId && (
                    <button
                      type="button"
                      onClick={handleDeleteAppt}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5"
                    >
                      <Trash2 size={12} />
                      Excluir Agendamento
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5 transition-all text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20 text-xs"
                  >
                    {submitting ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Confirmar e Agendar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function getPlanoBadgeStyles(plano: string) {
  const p = String(plano || '').toLowerCase().trim();
  
  if (p.includes('amil')) {
    return 'bg-orange-500/10 text-orange-400 border border-orange-500/20';
  }
  if (p.includes('sulamerica') || p.includes('sul américa')) {
    return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
  }
  if (p.includes('bradesco')) {
    return 'bg-red-500/10 text-red-400 border border-red-500/20';
  }
  if (p.includes('unimed')) {
    return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
  }
  if (p.includes('vivest')) {
    return 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20';
  }
  if (p.includes('particular')) {
    return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
  }
  
  // Default fallback style for other plans (uses purple/violet color)
  return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
}
