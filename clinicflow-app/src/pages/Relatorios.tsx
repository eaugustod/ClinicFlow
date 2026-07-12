import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Stethoscope, AlertTriangle, ShieldCheck, Clock, Download, Calendar, Users, FileText, CheckCircle, AlertOctagon, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { Historico } from '../types';

export const Relatorios: React.FC = () => {
  const { agendamentos, profissionais, guias, planos, pacientes, getBaseStatus, loadAgendamentosMes } = useApp();
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'atendimentos' | 'auditoria' | 'faixa-etaria'>('dashboard');

  const [auditHistory, setAuditHistory] = useState<Historico[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load data for the selected month automatically
  useEffect(() => {
    loadAgendamentosMes(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    loadAgendamentosMes(reportDate.slice(0, 7));
  }, [reportDate]);

  // Audit Filters
  const [auditProfFilter, setAuditProfFilter] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState('');

  useEffect(() => {
    const loadAuditHistory = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('historico')
          .select('*')
          .like('data', `${selectedMonth}%`);
        if (error) throw error;
        setAuditHistory(data.map(mappers.dbToHist));
      } catch (e) {
        console.error('[ClinicFlow Reports] Error fetching history:', e);
      } finally {
        setLoadingHistory(false);
      }
    };
    loadAuditHistory();
  }, [selectedMonth]);

  // Filter agendamentos for selected month
  const monthAgendamentos = agendamentos.filter(a => a.dataISO.startsWith(selectedMonth));
  
  // Calculate totals
  const totalConsultas = monthAgendamentos.length;
  const atendidas = monthAgendamentos.filter(a => getBaseStatus(a.status) === 'atendido').length;
  const canceladas = monthAgendamentos.filter(a => {
    const base = getBaseStatus(a.status);
    return base === 'cancelado' || base === 'desmarcado';
  }).length;
  const pendentes = monthAgendamentos.filter(a => {
    const base = getBaseStatus(a.status);
    return base === 'agendado' || base === 'confirmado';
  }).length;

  // Professional Commission Calculations
  const profCommissions = profissionais.map(p => {
    const profAppts = monthAgendamentos.filter(a => a.profId === p.id && getBaseStatus(a.status) === 'atendido');
    
    const totalGasto = profAppts.reduce((acc, a) => {
      const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
      const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
      const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');
      
      if (isParticular) {
        return acc + (p.valorParticular || 0);
      }
      if (isAval) {
        return acc;
      }
      if (isDev) {
        return acc + ((p as any).valorDevolutiva || (p as any).valorAvaliacao || 120);
      }
      const dur = a.durMin || 30;
      if (dur >= 60) {
        return acc + (p.valor60 || 100);
      }
      return acc + (p.valor30 || 60);
    }, 0);

    return {
      id: p.id,
      nome: p.nome,
      especialidade: p.esp,
      sessoes: profAppts.length,
      faturamento: totalGasto
    };
  }).filter(c => c.sessoes > 0);

  // Financial summary
  const totalFaturado = profCommissions.reduce((acc, c) => acc + c.faturamento, 0);

  // CSV Export for atendimentos
  const exportToCsv = () => {
    const headers = ['Paciente', 'Plano/Convenio', 'Profissional', 'Data', 'Hora', 'Status', 'Valor (R$)'];
    const rows = monthAgendamentos.map(a => {
      const plano = a.plano || 'Particular';
      const prof = profissionais.find(p => p.id === a.profId);
      const profNome = prof?.nome || 'Não Vinculado';
      let valor = 60;
      if (prof) {
        const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
        const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
        const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');
        if (isParticular) {
          valor = prof.valorParticular || 0;
        } else if (isAval) {
          valor = 0;
        } else if (isDev) {
          valor = (prof as any).valorDevolutiva || (prof as any).valorAvaliacao || 120;
        } else {
          const dur = a.durMin || 30;
          valor = dur >= 60 ? (prof.valor60 || 100) : (prof.valor30 || 60);
        }
      }
      return [
        `"${a.paciente}"`,
        `"${plano}"`,
        `"${profNome}"`,
        `"${a.dataISO}"`,
        `"${a.hora || ''}"`,
        `"${a.status}"`,
        valor.toFixed(2)
      ];
    });
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `atendimentos_mensais_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AUDIT ENGINE: status discrepancies (agenda x historico)
  const auditDivergencias = () => {
    const issues: {
      id: string;
      type: 'no-evolution' | 'no-appointment';
      severity: 'high' | 'medium';
      paciente: string;
      data: string;
      profId: number | null;
      desc: string;
    }[] = [];

    // Check 1: Appointments marked 'atendido' but missing evolucao in clinical history
    monthAgendamentos.forEach((a, idx) => {
      if (getBaseStatus(a.status) !== 'atendido') return;

      const pac = pacientes.find(p => p.nome.toLowerCase().trim() === a.paciente.toLowerCase().trim());
      if (!pac) return;

      const hasEvolucao = auditHistory.some(h => 
        h.pacId === pac.id && 
        h.tipo === 'evolucao' && 
        h.data === a.dataISO
      );

      if (!hasEvolucao) {
        issues.push({
          id: `no-evol-${idx}`,
          type: 'no-evolution',
          severity: 'high',
          paciente: a.paciente,
          data: a.dataISO,
          profId: a.profId,
          desc: 'Agendamento está marcado como ATENDIDO na agenda, mas não possui nenhuma evolução clínica registrada no prontuário do paciente.'
        });
      }
    });

    // Check 2: History records of type 'evolucao' in the selected month but no matching appointment marked as 'atendido'
    const monthEvols = auditHistory.filter(h => h.tipo === 'evolucao');
    monthEvols.forEach((e, idx) => {
      const pac = pacientes.find(p => p.id === e.pacId);
      if (!pac) return;

      const hasApptAtendido = agendamentos.some(a => 
        a.paciente.toLowerCase().trim() === pac.nome.toLowerCase().trim() && 
        a.dataISO === e.data && 
        getBaseStatus(a.status) === 'atendido'
      );

      if (!hasApptAtendido) {
        issues.push({
          id: `no-appt-${idx}`,
          type: 'no-appointment',
          severity: 'medium',
          paciente: pac.nome,
          data: e.data,
          profId: e.profId || null,
          desc: 'Evolução clínica registrada no prontuário, mas não há agendamento correspondente marcado como "Atendido" na agenda.'
        });
      }
    });

    return issues;
  };

  const discrepancies = auditDivergencias();

  const filteredDiscrepancies = discrepancies.filter(issue => {
    const matchesProf = !auditProfFilter || String(issue.profId) === auditProfFilter;
    const matchesType = !auditTypeFilter || issue.type === auditTypeFilter;
    return matchesProf && matchesType;
  });

  const totalAuditItems = monthAgendamentos.filter(a => getBaseStatus(a.status) === 'atendido').length + auditHistory.filter(h => h.tipo === 'evolucao').length;
  const integrityScore = totalAuditItems > 0 
    ? Math.max(0, Math.round(((totalAuditItems - discrepancies.length) / totalAuditItems) * 100))
    : 100;

  // Age calculation helper
  const calculateAge = (nascStr: string): number => {
    if (!nascStr || nascStr === '—') return -1;
    let birthDate: Date;
    if (nascStr.includes('/')) {
      const [d, m, y] = nascStr.split('/').map(Number);
      birthDate = new Date(y, m - 1, d);
    } else {
      birthDate = new Date(nascStr);
    }
    if (isNaN(birthDate.getTime())) return -1;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getAgeRangeLabel = (age: number): string => {
    if (age < 0) return 'Não Informado';
    if (age <= 14) return 'Criança (0 a 14)';
    if (age <= 18) return 'Adolescente (15 a 18)';
    if (age <= 64) return 'Adulto (19 a 64)';
    return 'Idoso (65 a 130)';
  };

  // Filter agendamentos for reportDate
  const dayAgendamentos = agendamentos.filter(a => a.dataISO === reportDate);

  // Group patients by age range
  const patientsAgeData = dayAgendamentos.map(a => {
    const pac = pacientes.find(p => p.nome.toLowerCase().trim() === a.paciente.toLowerCase().trim());
    const nasc = pac?.nasc || '';
    const age = calculateAge(nasc);
    const range = getAgeRangeLabel(age);
    const prof = profissionais.find(p => p.id === a.profId)?.nome || 'Não Vinculado';
    return {
      paciente: a.paciente,
      nasc: nasc || '—',
      idade: age >= 0 ? `${age} anos` : '—',
      ageNum: age,
      range,
      prof,
      status: a.status
    };
  });

  const countCrianças = patientsAgeData.filter(p => p.ageNum >= 0 && p.ageNum <= 14).length;
  const countAdolescentes = patientsAgeData.filter(p => p.ageNum >= 15 && p.ageNum <= 18).length;
  const countAdultos = patientsAgeData.filter(p => p.ageNum >= 19 && p.ageNum <= 64).length;
  const countIdosos = patientsAgeData.filter(p => p.ageNum >= 65 && p.ageNum <= 130).length;
  const countDesconhecido = patientsAgeData.filter(p => p.ageNum < 0).length;

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans font-semibold">Análises & Auditoria</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Relatórios & Insights</h2>
          <p className="text-xs text-slate-400 mt-1">Monitore repasses, atendimentos mensais e a consistência dos prontuários clínicos</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-[#131622]/60 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2.5 text-white font-bold font-mono focus:outline-none transition-all focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* SUB-REPORTS TAB BAR */}
      <div className="flex gap-2 border-b border-white/[0.04] pb-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-3 px-4 font-bold transition-all relative ${
            activeTab === 'dashboard'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Métricas Gerais (Dash)
        </button>
        <button
          onClick={() => setActiveTab('atendimentos')}
          className={`pb-3 px-4 font-bold transition-all relative ${
            activeTab === 'atendimentos'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Atendimentos Mensais
        </button>
        <button
          onClick={() => setActiveTab('auditoria')}
          className={`pb-3 px-4 font-bold transition-all relative flex items-center gap-1.5 ${
            activeTab === 'auditoria'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Auditoria de Prontuários
          {discrepancies.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('faixa-etaria')}
          className={`pb-3 px-4 font-bold transition-all relative ${
            activeTab === 'faixa-etaria'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Faixa Etária (Dia)
        </button>
      </div>

      {/* TAB VIEWPORT */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atendimentos Realizados</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-lg">
                  <TrendingUp size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl font-black text-white">{atendidas}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">De um total de {totalConsultas} no mês</p>
              </div>
            </div>

            <div className="p-4 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faturamento Mensal</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-lg">
                  <DollarSign size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl font-black text-white font-mono">R$ {totalFaturado.toFixed(2)}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Sob sessões atendidas do mês</p>
              </div>
            </div>

            <div className="p-4 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Desmarcações/Cancelados</span>
                <div className="p-2 bg-rose-500/10 text-rose-400 border border-rose-500/15 rounded-lg">
                  <AlertTriangle size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl font-black text-white">{canceladas}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Sessões não realizadas no mês</p>
              </div>
            </div>

            <div className="p-4 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agendados/Pendentes</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-lg">
                  <Clock size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xl font-black text-white">{pendentes}</p>
                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Aguardando atendimento</p>
              </div>
            </div>
          </div>

          {/* Commissions Grid */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="pb-4 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="font-bold text-xs tracking-wider text-white uppercase flex items-center gap-2">
                <Stethoscope size={14} className="text-indigo-400" />
                Repasses de Profissionais
              </h3>
              <span className="text-[10px] font-bold text-indigo-400 font-mono bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10">
                {profCommissions.length} ativos
              </span>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.02] pb-2">
                    <th className="pb-3">Profissional</th>
                    <th className="pb-3">Especialidade</th>
                    <th className="pb-3 text-center">Sessões Realizadas</th>
                    <th className="pb-3 text-right">Faturamento Repassado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {profCommissions.map((c) => (
                    <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-3 font-bold text-slate-200">{c.nome}</td>
                      <td className="py-3 text-slate-400 font-semibold">{c.especialidade}</td>
                      <td className="py-3 text-center font-bold text-slate-300 font-mono">{c.sessoes}</td>
                      <td className="py-3 text-right font-bold text-slate-200 font-mono">R$ {c.faturamento.toFixed(2)}</td>
                    </tr>
                  ))}
                  {profCommissions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#555d74] font-medium">
                        Nenhum atendimento com faturamento no mês selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'atendimentos' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center p-4 bg-[#131622]/40 border border-white/[0.04] rounded-2xl">
            <div>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">Atendimentos do Período</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Lista geral de consultas mensais com planos e profissionais correspondentes</p>
            </div>
            <button
              onClick={exportToCsv}
              disabled={monthAgendamentos.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              <Download size={13} />
              Exportar CSV
            </button>
          </div>

          <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                    <th className="p-4">Paciente</th>
                    <th className="p-4">Convênio / Plano</th>
                    <th className="p-4">Profissional</th>
                    <th className="p-4 text-center">Data / Hora</th>
                    <th className="p-4 text-center">Valor Estimado</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {monthAgendamentos.map((a, idx) => {
                    const profObj = profissionais.find(p => p.id === a.profId);
                    const prof = profObj?.nome || 'Não Vinculado';
                    let valor = 60;
                    if (profObj) {
                      const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
                      const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
                      const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');
                      if (isParticular) {
                        valor = profObj.valorParticular || 0;
                      } else if (isAval) {
                        valor = 0;
                      } else if (isDev) {
                        valor = (profObj as any).valorDevolutiva || (profObj as any).valorAvaliacao || 120;
                      } else {
                        const dur = a.durMin || 30;
                        valor = dur >= 60 ? (profObj.valor60 || 100) : (profObj.valor30 || 60);
                      }
                    }
                    return (
                      <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                        <td className="p-4 font-semibold text-slate-200 group-hover:text-indigo-400 transition-all">{a.paciente}</td>
                        <td className="p-4 text-slate-300">{a.plano || 'Particular'}</td>
                        <td className="p-4 text-slate-300">{prof}</td>
                        <td className="p-4 text-center font-mono text-slate-400">
                          {a.dataISO.split('-').reverse().join('/')} {a.hora || ''}
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-slate-200">
                          R$ {valor.toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            a.status === 'atendido'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                              : a.status === 'cancelado' || a.status === 'desmarcado'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {monthAgendamentos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#555d74] font-medium">
                        Nenhum atendimento registrado no mês selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'auditoria' && (
        <div className="space-y-6 animate-fade-in">
          {/* Audit Metrics Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Integridade de Prontuários</span>
                <p className="text-3xl font-black text-white mt-1.5 font-mono">{integrityScore}%</p>
                <p className="text-[9px] text-slate-400 mt-1">Conformidade entre sessões atendidas e evoluções</p>
              </div>
              <div className={`p-3 border rounded-2xl ${
                integrityScore > 90 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                integrityScore > 75 ? 'bg-amber-500/10 text-amber-400 border-amber-500/15' :
                'bg-rose-500/10 text-rose-400 border-rose-500/15'
              }`}>
                <ShieldCheck size={28} />
              </div>
            </div>

            <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Divergências Encontradas</span>
                <p className="text-3xl font-black text-white mt-1.5 font-mono">{filteredDiscrepancies.length}</p>
                <p className="text-[9px] text-slate-400 mt-1">Divergências críticas e moderadas na auditoria</p>
              </div>
              <div className={`p-3 border rounded-2xl ${
                filteredDiscrepancies.length === 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                'bg-rose-500/10 text-rose-400 border-rose-500/15'
              }`}>
                <AlertOctagon size={28} />
              </div>
            </div>

            <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registros Analisados</span>
                <p className="text-3xl font-black text-white mt-1.5 font-mono">{totalAuditItems}</p>
                <p className="text-[9px] text-slate-400 mt-1">Total de consultas atendidas + evoluções clínicas</p>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-2xl">
                <FileText size={28} />
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="p-6 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="pb-4 border-b border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="font-bold text-xs tracking-wider text-white uppercase flex items-center gap-2">
                <ShieldCheck size={14} className="text-indigo-400" />
                Relatório Analítico de Auditoria
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={auditProfFilter}
                  onChange={(e) => setAuditProfFilter(e.target.value)}
                  className="bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-[10px] focus:outline-none"
                >
                  <option value="">— Todos os Profissionais —</option>
                  {profissionais.filter(p => p.status === 'Ativo').map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>

                <select
                  value={auditTypeFilter}
                  onChange={(e) => setAuditTypeFilter(e.target.value)}
                  className="bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-white text-[10px] focus:outline-none"
                >
                  <option value="">— Todos os Tipos —</option>
                  <option value="no-evolution">Atendimento sem Evolução</option>
                  <option value="no-appointment">Evolução sem Agendamento</option>
                </select>
              </div>
            </div>

            {loadingHistory ? (
              <div className="py-12 flex justify-center items-center gap-2 text-slate-400 text-xs">
                <Loader size={16} className="animate-spin text-indigo-500" />
                Carregando registros de prontuários...
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {filteredDiscrepancies.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all ${
                      issue.severity === 'high'
                        ? 'border-rose-500/20 bg-rose-500/5 text-rose-400'
                        : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                    }`}
                  >
                    <AlertOctagon size={18} className="shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs">{issue.paciente}</span>
                        <span className="text-[9px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono font-semibold text-slate-300">
                          {issue.data.split('-').reverse().join('/')}
                        </span>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          issue.severity === 'high'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/15'
                        }`}>
                          {issue.severity === 'high' ? 'Crítico' : 'Moderado'}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed mt-1">{issue.desc}</p>
                    </div>
                  </div>
                ))}

                {filteredDiscrepancies.length === 0 && (
                  <div className="p-8 text-center bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-slate-300 flex flex-col items-center justify-center gap-3">
                    <CheckCircle size={32} className="text-emerald-400 animate-bounce" />
                    <div>
                      <p className="font-bold text-emerald-400 text-sm">Sem Inconsistências de Prontuário</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Ótimo! 100% de conformidade detectada neste mês. Todas as evoluções clínicas cadastradas correspondem perfeitamente aos agendamentos atendidos na agenda.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'faixa-etaria' && (
        <div className="space-y-6 animate-fade-in">
          {/* DATE SELECTOR SECTION */}
          <div className="flex justify-between items-center p-4 bg-[#131622]/40 border border-white/[0.04] rounded-2xl font-sans">
            <div>
              <h3 className="font-bold text-xs text-white uppercase tracking-wider">Perfil Etário Diário</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Selecione o dia para analisar a distribuição etária dos pacientes agendados</p>
            </div>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="bg-[#131622]/60 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2 text-white font-bold font-mono focus:outline-none transition-all focus:border-indigo-500/50 text-[10px]"
            />
          </div>

          {/* AGE GROUP CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl shadow-lg flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Crianças (0-14)</span>
              <p className="text-2xl font-black text-blue-400 mt-2 font-mono">{countCrianças}</p>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl shadow-lg flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Adolescentes (15-18)</span>
              <p className="text-2xl font-black text-emerald-400 mt-2 font-mono">{countAdolescentes}</p>
            </div>
            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl shadow-lg flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Adultos (19-64)</span>
              <p className="text-2xl font-black text-amber-400 mt-2 font-mono">{countAdultos}</p>
            </div>
            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl shadow-lg flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Idosos (65-130)</span>
              <p className="text-2xl font-black text-rose-400 mt-2 font-mono">{countIdosos}</p>
            </div>
            <div className="p-4 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-lg flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Não Informado</span>
              <p className="text-2xl font-black text-slate-300 mt-2 font-mono">{countDesconhecido}</p>
            </div>
          </div>

          {/* DETAIL LIST */}
          <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                    <th className="p-4">Paciente</th>
                    <th className="p-4">Data Nasc.</th>
                    <th className="p-4 text-center">Idade</th>
                    <th className="p-4">Faixa Etária</th>
                    <th className="p-4">Profissional</th>
                    <th className="p-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {patientsAgeData.map((p, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-4 font-semibold text-slate-200 group-hover:text-indigo-400 transition-all">{p.paciente}</td>
                      <td className="p-4 font-mono text-slate-300">{p.nasc}</td>
                      <td className="p-4 text-center font-mono text-slate-300">{p.idade}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          p.range.startsWith('Criança') ? 'bg-blue-500/10 text-blue-400 border-blue-500/15' :
                          p.range.startsWith('Adolescente') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                          p.range.startsWith('Adulto') ? 'bg-amber-500/10 text-amber-400 border-amber-500/15' :
                          p.range.startsWith('Idoso') ? 'bg-rose-500/10 text-rose-400 border-rose-500/15' :
                          'bg-slate-500/10 text-slate-400 border-white/10'
                        }`}>
                          {p.range}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300">{p.prof}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                          getBaseStatus(p.status) === 'atendido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' :
                          getBaseStatus(p.status) === 'cancelado' || getBaseStatus(p.status) === 'desmarcado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/15' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/15'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {patientsAgeData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#555d74] font-medium">
                        Nenhum agendamento encontrado para a data selecionada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
