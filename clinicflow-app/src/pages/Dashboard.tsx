import React, { useState, useEffect } from 'react';
import { Users, Calendar, FileText, Key, Clock, TrendingUp, Filter, CalendarDays, Award } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const Dashboard: React.FC = () => {
  const { pacientes, agendamentos, guias, senhas, espera, profissionais } = useApp();

  // Filters
  const [filterType, setFilterType] = useState<'dia' | 'mes' | 'ano'>('dia');
  const [selectedDate, setSelectedDate] = useState('2026-06-21');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Automatically sync month and year when date changes
  const handleDateChange = (dateVal: string) => {
    setSelectedDate(dateVal);
    if (dateVal) {
      const [y, m] = dateVal.split('-');
      setSelectedMonth(`${y}-${m}`);
      setSelectedYear(y);
    }
  };

  const handleMonthChange = (monthVal: string) => {
    setSelectedMonth(monthVal);
    if (monthVal) {
      const [y] = monthVal.split('-');
      setSelectedYear(y);
    }
  };

  // Filtered lists
  const apptsToday = agendamentos.filter(a => a.dataISO === selectedDate);
  const apptsMonth = agendamentos.filter(a => a.dataISO.startsWith(selectedMonth));
  const apptsYear = agendamentos.filter(a => a.dataISO.startsWith(selectedYear));

  // Determine current active count of appointments based on filterType
  const activeApptsCount = filterType === 'dia' 
    ? apptsToday.length 
    : filterType === 'mes' 
      ? apptsMonth.length 
      : apptsYear.length;

  // Professional stats for the selected date (Hoje)
  const profsToday = profissionais.map(p => {
    const count = apptsToday.filter(a => a.profId === p.id).length;
    return { prof: p, count };
  }).filter(x => x.count > 0);

  // Group monthly appointments by health insurance plan
  const planGroups: { [plano: string]: number } = {};
  apptsMonth.forEach(a => {
    const planName = a.plano || 'Particular';
    planGroups[planName] = (planGroups[planName] || 0) + 1;
  });

  const plansData = Object.entries(planGroups)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxPlanCount = plansData.length > 0 ? Math.max(...plansData.map(p => p.count)) : 1;

  // Group monthly appointments by professional
  const profsMonthData = profissionais.map(p => {
    const count = apptsMonth.filter(a => a.profId === p.id).length;
    return { prof: p, count };
  }).filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const maxProfCount = profsMonthData.length > 0 ? Math.max(...profsMonthData.map(p => p.count)) : 1;

  // Basic KPIs
  const totalPacientes = pacientes.filter(p => p.status === 'Ativo').length;
  const guiasPendentes = guias.filter(g => g.status === 'Pendente').length;
  const senhasAtivas = senhas.filter(s => s.status === 'Ativa').length;

  const stats = [
    {
      label: 'Pacientes Cadastrados',
      val: totalPacientes,
      icon: Users,
      color: 'from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/20',
      glow: 'shadow-[0_0_24px_rgba(6,182,212,0.15)]',
      trend: 'Geral da clínica'
    },
    {
      label: 'Agendamentos Filtrados',
      val: activeApptsCount,
      icon: Calendar,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/20',
      glow: 'shadow-[0_0_24px_rgba(16,185,129,0.15)]',
      trend: `Período: ${filterType === 'dia' ? 'Dia' : filterType === 'mes' ? 'Mês' : 'Ano'}`
    },
    {
      label: 'Guias Pendentes',
      val: guiasPendentes,
      icon: FileText,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/20',
      glow: 'shadow-[0_0_24px_rgba(245,158,11,0.15)]',
      trend: 'Aguardando envio'
    },
    {
      label: 'Senhas / Autorizações',
      val: senhasAtivas,
      icon: Key,
      color: 'from-indigo-500/20 to-violet-500/20 text-indigo-400 border-indigo-500/20',
      glow: 'shadow-[0_0_24px_rgba(99,102,241,0.15)]',
      trend: 'Vigência ativa'
    },
  ];

  const formatMonthLabel = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  };

  const formatDateLabel = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Header and Filter Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-semibold">Dashboard Principal</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">Visão Geral da Clínica</h2>
          <p className="text-xs text-slate-400 mt-1">Monitore atendimentos, faturamentos e indicadores de desempenho em tempo real</p>
        </div>
        
        {/* Filters Panel */}
        <div className="flex items-center gap-2 flex-wrap bg-[#131622]/60 backdrop-blur-md border border-white/[0.04] p-2 rounded-2xl shadow-lg">
          <div className="flex gap-1 bg-[#161a26] p-1 rounded-xl border border-white/[0.04]">
            <button
              onClick={() => setFilterType('dia')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                filterType === 'dia' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Dia
            </button>
            <button
              onClick={() => setFilterType('mes')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                filterType === 'mes' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mês
            </button>
            <button
              onClick={() => setFilterType('ano')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                filterType === 'ano' ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ano
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {filterType === 'dia' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-1.5 text-white font-bold font-mono focus:outline-none focus:border-indigo-500/50 text-[10px]"
              />
            )}
            {filterType === 'mes' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-1.5 text-white font-bold font-mono focus:outline-none focus:border-indigo-500/50 text-[10px]"
              />
            )}
            {filterType === 'ano' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-[#161a26] border border-white/[0.06] rounded-xl px-3 py-1.5 text-white font-bold font-mono focus:outline-none focus:border-indigo-500/50 text-[10px]"
              >
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className={`p-5 bg-gradient-to-br bg-[#131622]/60 backdrop-blur-md border border-white/[0.03] rounded-2xl ${item.glow} hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                <div className={`p-2 bg-[#161a26] border border-white/[0.06] rounded-xl text-indigo-400 group-hover:scale-105 transition-transform duration-300`}>
                  <Icon size={14} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-black text-white font-mono">{item.val}</p>
                <div className="flex items-center gap-1 mt-1.5 text-[9px] text-slate-400 font-semibold tracking-wide uppercase">
                  <TrendingUp size={10} className="text-indigo-400" />
                  <span>{item.trend}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns (Schedules of the day and pending guides) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profissionais Hoje (referente ao dia selecionado) */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/[0.04] mb-4">
              <div>
                <h3 className="font-bold text-xs tracking-wider text-slate-200 uppercase">Profissionais Hoje</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Schedules mapped on {formatDateLabel(selectedDate)}</p>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                {profsToday.length} ativos
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profsToday.map((x, i) => (
                <div key={i} className="p-3 bg-[#161a26]/40 border border-white/[0.04] rounded-xl flex items-center justify-between hover:border-white/10 transition-all">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: x.prof.cor || '#6366f1' }} />
                    <div>
                      <span className="font-bold text-slate-200 block" style={{ color: x.prof.cor || '#f1f5f9' }}>{x.prof.nome}</span>
                      <span className="text-[9px] text-slate-400">{x.prof.esp || 'Profissional'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-300 text-xs block">{x.count}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">Consultas</span>
                  </div>
                </div>
              ))}
              {profsToday.length === 0 && (
                <div className="col-span-2 py-8 text-center text-slate-500 font-medium">
                  Nenhum atendimento agendado para o dia selecionado.
                </div>
              )}
            </div>
          </div>

          {/* Pending Guides SADT */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
              <div>
                <h3 className="font-bold text-xs tracking-wider text-slate-200 uppercase">Guias SADT Pendentes</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Guias prontas para processamento no lote</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15">
                {guiasPendentes} pendentes
              </span>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.02]">
                    <th className="pb-3 font-semibold">Paciente</th>
                    <th className="pb-3 font-semibold">Convênio</th>
                    <th className="pb-3 font-semibold">Valor Unitário</th>
                    <th className="pb-3 font-semibold text-center">Data Emissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02] text-xs">
                  {guias.filter(g => g.status === 'Pendente').slice(0, 5).map((g) => (
                    <tr key={g.id} className="hover:bg-white/[0.01] transition-colors group cursor-pointer">
                      <td className="py-3 font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{g.pac}</td>
                      <td className="py-3 text-slate-400 font-semibold">{g.plano}</td>
                      <td className="py-3 text-slate-200 font-mono">R$ {g.valor.toFixed(2)}</td>
                      <td className="py-3 text-center text-slate-400 font-mono">{g.data.split('-').reverse().join('/')}</td>
                    </tr>
                  ))}
                  {guiasPendentes === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500 font-medium">
                        Nenhuma guia pendente encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Columns (Holidays, plans, and waitlists) */}
        <div className="space-y-6">
          
          {/* Indicador por Plano Mensal */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="pb-3 border-b border-white/[0.04] mb-4">
              <h3 className="font-bold text-xs tracking-wider text-slate-200 uppercase">Consultas por Plano</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Competência: {formatMonthLabel(selectedMonth)}</p>
            </div>

            <div className="space-y-3.5">
              {plansData.map((plan, idx) => {
                const percentage = Math.round((plan.count / maxPlanCount) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-300 font-semibold">
                      <span>{plan.name}</span>
                      <span className="font-mono text-slate-400">{plan.count} agendamento(s)</span>
                    </div>
                    <div className="h-2 bg-slate-800/60 border border-white/[0.02] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {plansData.length === 0 && (
                <div className="py-8 text-center text-slate-500 font-medium">
                  Nenhum registro para este período.
                </div>
              )}
            </div>
          </div>

          {/* Indicador por Profissional Mensal */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="pb-3 border-b border-white/[0.04] mb-4">
              <h3 className="font-bold text-xs tracking-wider text-slate-200 uppercase">Consultas por Profissional</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Competência: {formatMonthLabel(selectedMonth)}</p>
            </div>

            <div className="space-y-3.5">
              {profsMonthData.map((x, idx) => {
                const percentage = Math.round((x.count / maxProfCount) * 100);
                const profColor = x.prof.cor || '#6366f1';
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-300 font-semibold">
                      <span style={{ color: profColor }}>{x.prof.nome}</span>
                      <span className="font-mono text-slate-400">{x.count} agendamento(s)</span>
                    </div>
                    <div className="h-2 bg-slate-800/60 border border-white/[0.02] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${percentage}%`, backgroundColor: profColor }}
                      />
                    </div>
                  </div>
                );
              })}
              {profsMonthData.length === 0 && (
                <div className="py-8 text-center text-slate-500 font-medium">
                  Nenhum registro para este período.
                </div>
              )}
            </div>
          </div>

          {/* Waitlist Sidebar */}
          <div className="p-5 bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl flex flex-col">
            <div className="flex justify-between items-center pb-3 border-b border-white/[0.04] mb-4">
              <div>
                <h3 className="font-bold text-xs tracking-wider text-slate-200 uppercase">Lista de Espera</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Pacientes aguardando vaga</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                {espera.filter(e => e.status === 'Aguardando').length} em espera
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
              {espera.filter(e => e.status === 'Aguardando').slice(0, 5).map((e) => (
                <div
                  key={e.id}
                  className="p-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.02] hover:border-white/[0.04] rounded-xl flex items-center justify-between transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{e.nome}</p>
                    <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{e.tel}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-2 py-0.5 rounded-full">
                    <Clock size={10} />
                    <span>{e.dataEntrada}</span>
                  </div>
                </div>
              ))}
              {espera.filter(e => e.status === 'Aguardando').length === 0 && (
                <div className="text-center text-slate-500 font-medium py-6">
                  Nenhum paciente aguardando.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
