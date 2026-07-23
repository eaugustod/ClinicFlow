import React, { useState, useEffect } from 'react';
import { Search, Loader2, Calendar, User, CheckCircle2, AlertCircle, RefreshCw, Filter, Check, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Agendamento } from '../types';

interface GroupedPatient {
  pacienteNome: string;
  agendamentos: Agendamento[];
}

export const AnaliseFechamento: React.FC = () => {
  const { profissionais, statusAgendamentos, getStatusColor, logStatusChange, refreshAll } = useApp();

  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [groupedData, setGroupedData] = useState<GroupedPatient[]>([]);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auto-select first professional when loaded
  useEffect(() => {
    if (profissionais.length > 0 && selectedProfId === null) {
      setSelectedProfId(profissionais[0].id);
    }
  }, [profissionais, selectedProfId]);

  // Execute initial search when therapist is ready
  useEffect(() => {
    if (selectedProfId !== null && !hasSearched) {
      handleAnalisar();
    }
  }, [selectedProfId]);

  // Format month (e.g., 2026-06 -> Junho de 2026)
  const formatMonthLabel = (monthIso: string) => {
    if (!monthIso) return '';
    const [y, m] = monthIso.split('-').map(Number);
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${monthNames[m - 1]} de ${y}`;
  };

  // Format short date (e.g., 2026-06-01 -> 01/06/26)
  const formatDateShort = (dateIso: string) => {
    if (!dateIso) return '—';
    const parts = dateIso.split('-');
    if (parts.length < 3) return dateIso;
    const [y, m, d] = parts;
    return `${d}/${m}/${y.slice(2)}`;
  };

  // Fetch agendamentos for therapist & month
  const handleAnalisar = async () => {
    if (!selectedProfId || !selectedMonth) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const primDay = `${selectedMonth}-01`;
      const ultDay = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('prof_id', selectedProfId)
        .gte('data_iso', primDay)
        .lte('data_iso', ultDay)
        .order('data_iso', { ascending: true });

      if (error) throw error;

      const mapped: Agendamento[] = (data || []).map(mappers.dbToAppt);

      // Group by patient name
      const map = new Map<string, Agendamento[]>();
      mapped.forEach(a => {
        const name = (a.paciente || 'Sem Nome').trim();
        if (!map.has(name)) map.set(name, []);
        map.get(name)!.push(a);
      });

      const groups: GroupedPatient[] = Array.from(map.entries())
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, 'pt-BR'))
        .map(([name, appts]) => ({
          pacienteNome: name,
          agendamentos: appts.sort((x, y) => x.dataISO.localeCompare(y.dataISO))
        }));

      setGroupedData(groups);
    } catch (e) {
      console.error('[AnaliseFechamento] Erro ao buscar agendamentos:', e);
      alert('Erro ao carregar dados de análise.');
    } finally {
      setLoading(false);
    }
  };

  // Update appointment status in Supabase
  const handleStatusChange = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      await logStatusChange(id, newStatus);
      await refreshAll();

      // Update local state
      setGroupedData(prev => prev.map(group => ({
        ...group,
        agendamentos: group.agendamentos.map(a => 
          a.id === id ? { ...a, status: newStatus } : a
        )
      })));

      showToast(`Status gravado no Supabase com sucesso: "${newStatus}"`);
    } catch (e: any) {
      console.error('[AnaliseFechamento] Erro ao atualizar status:', e);
      alert('Erro ao gravar alteração de status no Supabase.');
    } finally {
      setUpdatingId(null);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Calculate totals
  const totalAgendamentos = groupedData.reduce((acc, g) => acc + g.agendamentos.length, 0);
  const totalPacientes = groupedData.length;
  const selectedProfObj = profissionais.find(p => p.id === selectedProfId);

  const availableStatuses = statusAgendamentos.length > 0 
    ? statusAgendamentos.map(s => s.nome)
    : ['Agendado', 'Confirmado', 'Em espera (Chegou)', 'Atendido', 'Desmarcado', 'Cancelado'];

  // Helper to resolve raw DB status (e.g. "desmarcado", "atendido") to mapped status name (e.g. "Desmarcado", "Atendido")
  const getMatchingStatusName = (rawStatus: string) => {
    if (!rawStatus) return 'Agendado';
    const found = statusAgendamentos.find(
      s => s.nome.toLowerCase() === rawStatus.toLowerCase()
    );
    if (found) return found.nome;

    const foundByBase = statusAgendamentos.find(
      s => s.statusAgendamento.toLowerCase() === rawStatus.toLowerCase()
    );
    if (foundByBase) return foundByBase.nome;

    const foundAvailable = availableStatuses.find(
      st => st.toLowerCase() === rawStatus.toLowerCase()
    );
    if (foundAvailable) return foundAvailable;

    return rawStatus;
  };

  return (
    <div className="space-y-6 text-xs animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--bg-surface)] border border-emerald-500/40 text-[var(--text-primary)] px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
          <span className="font-semibold text-xs">{toastMsg}</span>
        </div>
      )}

      {/* Header & Filter Card */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-6 transition-colors duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-widest">
              Gestão Financeira
            </span>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-wide mt-0.5 font-sans">
              Analise do Fechamento por Terapeuta
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Consulte e altere o status das consultas por paciente e profissional para conferência mensal.
            </p>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Mês/Ano */}
            <div className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5">
              <Calendar size={14} className="text-[var(--accent)]" />
              <label className="text-[11px] font-bold text-[var(--text-muted)]">Mês/Ano:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer [color-scheme:dark]"
              />
            </div>

            {/* Filter Profissional */}
            <div className="flex items-center gap-2 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-3 py-1.5">
              <User size={14} className="text-[var(--accent)]" />
              <label className="text-[11px] font-bold text-[var(--text-muted)]">Profissional:</label>
              <select
                value={selectedProfId || ''}
                onChange={(e) => setSelectedProfId(Number(e.target.value))}
                className="bg-transparent text-[11px] font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer max-w-[180px]"
              >
                {profissionais.map(p => (
                  <option key={p.id} value={p.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Button Analisar */}
            <button
              onClick={handleAnalisar}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold shadow-lg shadow-[var(--accent-glow)] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Analisar</span>
            </button>
          </div>
        </div>

        {/* Selected Info Summary Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Competência</span>
              <p className="text-sm font-bold text-[var(--accent)]">{formatMonthLabel(selectedMonth)}</p>
            </div>
            <div className="h-6 w-[1px] bg-[var(--border)]" />
            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Profissional</span>
              <p className="text-sm font-bold text-[var(--text-primary)]">{selectedProfObj?.nome || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-center">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Pacientes</span>
              <p className="text-xs font-black text-[var(--text-primary)] font-mono">{totalPacientes}</p>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-raised)] border border-[var(--border)] text-center">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Consultas</span>
              <p className="text-xs font-black text-[var(--accent)] font-mono">{totalAgendamentos}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
            <Loader2 size={32} className="text-[var(--accent)] animate-spin" />
            <p className="text-xs font-semibold">Buscando agendamentos no Supabase...</p>
          </div>
        ) : groupedData.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
            <AlertCircle size={32} className="text-[var(--text-muted)]" />
            <p className="text-xs font-semibold">Nenhum agendamento encontrado para o período e terapeuta selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6 w-2/5">Paciente</th>
                  <th className="py-3.5 px-6 w-1/4">Data Agenda</th>
                  <th className="py-3.5 px-6 w-1/3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-xs">
                {groupedData.map((group, groupIdx) => (
                  <React.Fragment key={group.pacienteNome + groupIdx}>
                    {/* Patient Group Header */}
                    <tr className="bg-[var(--bg-raised)]/60 font-bold border-t border-b border-[var(--border)]">
                      <td colSpan={3} className="py-3 px-6 text-[var(--text-primary)]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black tracking-wide text-[var(--text-primary)]">
                            {group.pacienteNome}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)] px-2 py-0.5 rounded-full">
                            {group.agendamentos.length} consulta(s)
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Patient Appointments Rows */}
                    {group.agendamentos.map((appt) => {
                      const isUpdatingThis = updatingId === appt.id;
                      const currentStatusName = getMatchingStatusName(appt.status);
                      const statusColor = getStatusColor(currentStatusName);

                      return (
                        <tr
                          key={appt.id}
                          className="hover:bg-[var(--table-hover)] transition-colors duration-150"
                        >
                          {/* Indented cell for patient line */}
                          <td className="py-2.5 px-6 pl-10 text-[var(--text-secondary)] font-medium">
                            {group.pacienteNome}
                          </td>

                          {/* Data Agenda */}
                          <td className="py-2.5 px-6 font-mono font-bold text-[var(--text-primary)]">
                            {formatDateShort(appt.dataISO)}
                          </td>

                          {/* Editable Status */}
                          <td className="py-2.5 px-6">
                            <div className="flex items-center gap-2">
                              {isUpdatingThis ? (
                                <div className="flex items-center gap-2 text-[var(--text-muted)] text-[11px]">
                                  <Loader2 size={13} className="animate-spin text-[var(--accent)]" />
                                  <span>Salvando...</span>
                                </div>
                              ) : (
                                <select
                                  value={currentStatusName}
                                  onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                                  style={{
                                    borderColor: `${statusColor}50`,
                                    color: statusColor,
                                    backgroundColor: `${statusColor}10`
                                  }}
                                  className="border rounded-xl px-3 py-1 text-[11px] font-bold focus:outline-none cursor-pointer font-sans transition-all hover:opacity-90 max-w-[200px]"
                                >
                                  {availableStatuses.map((st) => (
                                    <option
                                      key={st}
                                      value={st}
                                      className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                                    >
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
