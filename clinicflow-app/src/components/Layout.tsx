import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  History,
  Users,
  Stethoscope,
  HeartHandshake,
  DollarSign,
  FileText,
  Layers,
  Key,
  ListOrdered,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bell,
  Sparkles,
  Calculator,
  CreditCard,
  CalendarDays,
  CalendarCheck,
  Users as UsersIcon,
  Shield,
  ClipboardList,
  UserCheck,
  Building2,
  Sliders,
  MessageSquare,
  Upload
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ThemeSelector } from './ThemeSelector';

interface LayoutProps {
  children: React.ReactNode;
  activePage: string;
  setActivePage: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage }) => {
  const { clinicaConfig, user, logout } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [faturamentoOpen, setFaturamentoOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [conectaOpen, setConectaOpen] = useState(false);
  const [ferramentasOpen, setFerramentasOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'atendimento', label: 'Atendimento', icon: UserCheck },
    { id: 'historico', label: 'Histórico / Prontuário', icon: History },
    { id: 'chat', label: 'Chat com Pacientes', icon: MessageSquare },
  ];

  const cadastroItems = [
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'profissionais', label: 'Profissionais', icon: Stethoscope },
    { id: 'planos', label: 'Planos de Saúde', icon: HeartHandshake },
    { id: 'procedimentos', label: 'Tabela de Preços', icon: DollarSign },
    { id: 'ctrlMeses', label: 'Controle de Meses', icon: CalendarDays },
    { id: 'feriados', label: 'Feriados', icon: CalendarCheck },
    { id: 'status-agendamento', label: 'Status de Agendamento', icon: Sliders },
  ];

  const fatItems = [
    { id: 'guias', label: 'Guias SADT', icon: FileText },
    { id: 'lotes', label: 'Lotes TISS', icon: Layers },
    { id: 'senhas', label: 'Senhas & Autorizações', icon: Key },
  ];

  const fechamentoItems = [
    { id: 'analise-fechamento', label: 'Análise por Terapeuta', icon: UserCheck },
    { id: 'fechamento', label: 'Fechamento Mensal', icon: Calculator },
    { id: 'financeiro', label: 'Repasses / Pagamentos', icon: CreditCard },
  ];

  const conectaItems = [
    { id: 'conecta-agenda', label: 'Agendamento de Salas', icon: Calendar },
    { id: 'conecta-profissionais', label: 'Profissionais Locatários', icon: Users },
    { id: 'conecta-fechamento', label: 'Fechamento de Locação', icon: Calculator },
  ];

  const ferramentasItems = [
    { id: 'importar-agenda', label: 'Importar Agenda', icon: Calendar },
    { id: 'importar-pacientes', label: 'Importar Pacientes', icon: Users },
    { id: 'importar-profissionais', label: 'Importar Profissionais', icon: Stethoscope },
    { id: 'importar-planos', label: 'Importar Planos de Saúde', icon: HeartHandshake },
    { id: 'importar-procedimentos', label: 'Importar Tabela de Preços', icon: DollarSign },
    { id: 'importar-guias', label: 'Importar Guias SADT', icon: FileText },
    { id: 'importar-senhas', label: 'Importar Senhas & Aut.', icon: Key },
    { id: 'importar-anamnese', label: 'Importar Anamnese', icon: ClipboardList },
    { id: 'importar-evolucoes', label: 'Importar Evoluções', icon: FileText },
  ];

  const otherItems = [
    { id: 'espera', label: 'Lista de Espera', icon: ListOrdered },
    { id: 'usuarios', label: 'Usuários & Acesso', icon: UsersIcon },
    { id: 'perfis', label: 'Perfis de Acesso', icon: Shield },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'config', label: 'Configurações', icon: Settings },
  ];

  // Auto-expand menus based on activePage
  useEffect(() => {
    if (cadastroItems.some((item) => item.id === activePage)) {
      setCadastrosOpen(true);
    }
    if (fatItems.some((item) => item.id === activePage)) {
      setFaturamentoOpen(true);
    }
    if (fechamentoItems.some((item) => item.id === activePage)) {
      setFechamentoOpen(true);
    }
    if (conectaItems.some((item) => item.id === activePage)) {
      setConectaOpen(true);
    }
    if (ferramentasItems.some((item) => item.id === activePage)) {
      setFerramentasOpen(true);
    }
  }, [activePage]);

  const hasPermission = (itemId: string) => {
    if (!user) return false;
    // Admins e usuários sem restrição explícita (fallback) têm acesso total
    if (user.perfil?.toLowerCase() === 'admin') return true;
    if (!user.permissions) return true;

    // Normaliza IDs específicos para casar com Perfis de Acesso
    let targetId = itemId;
    if (itemId === 'atendimento') targetId = 'agenda';
    if (itemId === 'analise-fechamento') targetId = 'fechamento';
    if (itemId === 'financeiro') targetId = 'fechamento';
    if (itemId === 'conecta-agenda') targetId = 'agenda';
    if (itemId === 'conecta-profissionais') targetId = 'profissionais';
    if (itemId === 'conecta-fechamento') targetId = 'fechamento';
    if (itemId.startsWith('importar-')) targetId = 'importar';
    if (itemId === 'status-agendamento') targetId = 'config';

    return user.permissions.includes(targetId);
  };

  const handleNavClick = (pageId: string) => {
    setActivePage(pageId);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden relative transition-colors duration-300">
      {/* Background glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--accent)]/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[256px] bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--border)] transition-all duration-300 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              CF
            </div>
            <div>
              <span className="font-bold text-base tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-[#f1f5f9] to-indigo-300">
                ClinicFlow
              </span>
              <p className="text-[9px] text-indigo-400 font-semibold tracking-widest uppercase">v2026.1</p>
            </div>
          </div>
          <button className="lg:hidden p-1 hover:bg-white/5 rounded-lg" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-thin">
          {menuItems.filter(item => hasPermission(item.id)).map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center w-full gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/5 text-indigo-400 border border-indigo-500/10 shadow-[0_4px_16px_rgba(99,102,241,0.06)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon size={16} className={active ? 'text-indigo-400' : 'text-slate-400'} />
                {item.label}
              </button>
            );
          })}

          {/* Cadastros Dropdown */}
          {cadastroItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setCadastrosOpen(!cadastrosOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <ClipboardList size={16} />
                  <span>Cadastros</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    cadastrosOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {cadastrosOpen && (
                <div className="pl-6 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                  {cadastroItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Faturamento Dropdown */}
          {fatItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setFaturamentoOpen(!faturamentoOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <FileText size={16} />
                  <span>Faturamento</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    faturamentoOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {faturamentoOpen && (
                <div className="pl-6 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                  {fatItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Fechamento Mensal Dropdown */}
          {fechamentoItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setFechamentoOpen(!fechamentoOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <Calculator size={16} />
                  <span>Fechamento Mensal</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    fechamentoOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {fechamentoOpen && (
                <div className="pl-6 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                  {fechamentoItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Espaço Conecta Dropdown */}
          {conectaItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setConectaOpen(!conectaOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <Building2 size={16} />
                  <span>Espaço Conecta</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    conectaOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {conectaOpen && (
                <div className="pl-6 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                  {conectaItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Ferramentas Dropdown */}
          {ferramentasItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setFerramentasOpen(!ferramentasOpen)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200"
              >
                <div className="flex items-center gap-3.5">
                  <Upload size={16} />
                  <span>Ferramentas</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    ferramentasOpen ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>
              {ferramentasOpen && (
                <div className="pl-6 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5">
                  {ferramentasItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {otherItems.filter(item => hasPermission(item.id)).map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex items-center w-full gap-3.5 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/5 text-indigo-400 border border-indigo-500/10 shadow-[0_4px_16px_rgba(99,102,241,0.06)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon size={16} className={active ? 'text-indigo-400' : 'text-slate-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User profile & Info card */}
        <div className="p-4 border-t border-white/[0.04] bg-[#0c0e16]/40 flex flex-col gap-2">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.01] border border-white/[0.02] shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/20 shadow-lg uppercase">
              {user?.nome ? user.nome.slice(0, 3) : 'ADM'}
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-bold text-slate-200 truncate">{user?.nome || 'Clínica Admin'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Sparkles size={8} className="text-yellow-400 animate-pulse" />
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">{user?.perfil || 'Master Account'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full py-3 mt-1 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 hover:text-rose-300 border border-rose-500/10 hover:border-rose-500/20 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={14} />
            Efetuar Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between h-20 px-8 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-md transition-colors duration-300 relative z-50">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} className="text-[var(--text-secondary)]" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--accent)] font-bold uppercase tracking-wider">Unidade Conectada</span>
              <h2 className="text-sm font-bold text-[var(--text-primary)] tracking-wide mt-0.5">
                {clinicaConfig.nome || 'Painel Principal'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Selector */}
            <ThemeSelector />

            {/* Notification button */}
            <button className="relative p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border)] hover:border-[var(--border-mid)] transition-all">
              <Bell size={16} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-indigo-400 to-violet-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 scrollbar-thin w-full max-w-full">
          <div className="max-w-6xl mx-auto space-y-8 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
