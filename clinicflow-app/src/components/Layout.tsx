import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Calendar,
  CalendarRange,
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
  ChevronLeft,
  ChevronRight,
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
  Upload,
  ExternalLink,
  Wallet
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('cf_sidebar_collapsed') === 'true';
  });
  const [faturamentoOpen, setFaturamentoOpen] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(false);
  const [conectaOpen, setConectaOpen] = useState(false);
  const [ferramentasOpen, setFerramentasOpen] = useState(false);
  const [fechamentoOpen, setFechamentoOpen] = useState(false);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('cf_sidebar_collapsed', String(next));
      return next;
    });
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', icon: Calendar },
    { id: 'agenda-recepcao', label: 'Agenda Recepção', icon: CalendarRange },
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
    { id: 'financeiro-fluxo-caixa', label: 'Fluxo de Caixa & Contas', icon: Wallet },
    { id: 'analise-fechamento', label: 'Análise por Terapeuta', icon: UserCheck },
    { id: 'fechamento', label: 'Fechamento Mensal', icon: Calculator },
    { id: 'financeiro', label: 'Repasses / Pagamentos', icon: CreditCard },
    { id: 'financeiro-nfse', label: 'NFS-e (Prefeitura Jundiaí)', icon: Building2 },
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
    { id: 'importar-espera', label: 'Importar Lista de Espera', icon: ListOrdered },
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

    // Perfil Recepção tem acesso garantido à Agenda Recepção
    if (itemId === 'agenda-recepcao' && (user.perfil?.toLowerCase().includes('recep') || user.perfil?.toLowerCase() === 'recepcao')) return true;

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
    if (pageId === 'chat') {
      const chatUrl = `${window.location.origin}${window.location.pathname}?page=chat`;
      window.open(chatUrl, '_blank', 'noopener,noreferrer');
      setSidebarOpen(false);
      return;
    }
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
        className={`fixed inset-y-0 left-0 z-50 flex flex-col ${
          sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[256px]'
        } w-[256px] bg-[var(--sidebar-bg)] backdrop-blur-xl border-r border-[var(--border)] transition-all duration-300 ease-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header com Botao de Recolher/Expandir ao lado do Logo */}
        <div className={`flex items-center ${sidebarCollapsed ? 'lg:justify-between lg:px-3' : 'justify-between px-6'} h-20 border-b border-[var(--border)] transition-all duration-300`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] shrink-0">
              CF
            </div>
            {!sidebarCollapsed && (
              <div className="hidden lg:block">
                <span className="font-bold text-base tracking-wider text-[var(--text-primary)]">
                  ClinicFlow
                </span>
                <p className="text-[9px] text-[var(--accent)] font-semibold tracking-widest uppercase">v2026.1</p>
              </div>
            )}
            <div className="lg:hidden">
              <span className="font-bold text-base tracking-wider text-[var(--text-primary)]">
                ClinicFlow
              </span>
              <p className="text-[9px] text-[var(--accent)] font-semibold tracking-widest uppercase">v2026.1</p>
            </div>
          </div>

          {/* Botao Recolher / Expandir Menu */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
            title={sidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <button className="lg:hidden p-1 hover:bg-[var(--bg-raised)] rounded-lg" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'lg:px-2' : 'px-4'} py-6 space-y-1 overflow-y-auto scrollbar-thin`}>
          {menuItems.filter(item => hasPermission(item.id)).map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            const isChat = item.id === 'chat';
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center w-full gap-3.5 ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/5 text-indigo-400 border border-indigo-500/10 shadow-[0_4px_16px_rgba(99,102,241,0.06)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon size={16} className={`shrink-0 ${active ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className={`flex-1 text-left ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                {isChat && !sidebarCollapsed && (
                  <span className="flex items-center gap-1 text-[9px] bg-indigo-500/15 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase lg:block">
                    Nova Aba <ExternalLink size={10} />
                  </span>
                )}
              </button>
            );
          })}

          {/* Cadastros Dropdown */}
          {cadastroItems.filter(item => hasPermission(item.id)).length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setCadastrosOpen(!cadastrosOpen);
                }}
                title={sidebarCollapsed ? "Cadastros" : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5">
                  <ClipboardList size={16} className="shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Cadastros</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    cadastrosOpen ? 'rotate-180 text-indigo-400' : ''
                  } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                />
              </button>
              {cadastrosOpen && (
                <div className={`${sidebarCollapsed ? 'lg:pl-0' : 'pl-6'} space-y-1 relative ${sidebarCollapsed ? '' : 'before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5'}`}>
                  {cadastroItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center w-full ${
                          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-4'
                        } py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setFaturamentoOpen(!faturamentoOpen);
                }}
                title={sidebarCollapsed ? "Faturamento" : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5">
                  <FileText size={16} className="shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Faturamento</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    faturamentoOpen ? 'rotate-180 text-indigo-400' : ''
                  } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                />
              </button>
              {faturamentoOpen && (
                <div className={`${sidebarCollapsed ? 'lg:pl-0' : 'pl-6'} space-y-1 relative ${sidebarCollapsed ? '' : 'before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5'}`}>
                  {fatItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center w-full ${
                          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-4'
                        } py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setFechamentoOpen(!fechamentoOpen);
                }}
                title={sidebarCollapsed ? "Fechamento Mensal" : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5">
                  <Calculator size={16} className="shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Fechamento Mensal</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    fechamentoOpen ? 'rotate-180 text-indigo-400' : ''
                  } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                />
              </button>
              {fechamentoOpen && (
                <div className={`${sidebarCollapsed ? 'lg:pl-0' : 'pl-6'} space-y-1 relative ${sidebarCollapsed ? '' : 'before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5'}`}>
                  {fechamentoItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center w-full ${
                          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-4'
                        } py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setConectaOpen(!conectaOpen);
                }}
                title={sidebarCollapsed ? "Espaço Conecta" : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5">
                  <Building2 size={16} className="shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Espaço Conecta</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    conectaOpen ? 'rotate-180 text-indigo-400' : ''
                  } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                />
              </button>
              {conectaOpen && (
                <div className={`${sidebarCollapsed ? 'lg:pl-0' : 'pl-6'} space-y-1 relative ${sidebarCollapsed ? '' : 'before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5'}`}>
                  {conectaItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center w-full ${
                          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-4'
                        } py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setFerramentasOpen(!ferramentasOpen);
                }}
                title={sidebarCollapsed ? "Ferramentas" : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer`}
              >
                <div className="flex items-center gap-3.5">
                  <Upload size={16} className="shrink-0" />
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Ferramentas</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 ${
                    ferramentasOpen ? 'rotate-180 text-indigo-400' : ''
                  } ${sidebarCollapsed ? 'lg:hidden' : ''}`}
                />
              </button>
              {ferramentasOpen && (
                <div className={`${sidebarCollapsed ? 'lg:pl-0' : 'pl-6'} space-y-1 relative ${sidebarCollapsed ? '' : 'before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/5'}`}>
                  {ferramentasItems.filter(item => hasPermission(item.id)).map((item) => {
                    const Icon = item.icon;
                    const active = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        className={`flex items-center w-full ${
                          sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3 px-4'
                        } py-2.5 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-[1.01] cursor-pointer ${
                          active
                            ? 'bg-indigo-500/10 text-indigo-400'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.01]'
                        }`}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
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
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center w-full ${
                  sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'gap-3.5 px-4'
                } py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-indigo-500/15 to-violet-500/5 text-indigo-400 border border-indigo-500/10 shadow-[0_4px_16px_rgba(99,102,241,0.06)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon size={16} className={`shrink-0 ${active ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User profile & Info card */}
        <div className={`p-4 border-t border-white/[0.04] bg-[#0c0e16]/40 flex flex-col gap-2 ${sidebarCollapsed ? 'lg:p-2' : ''}`}>
          <div
            title={sidebarCollapsed ? (user?.nome || 'Clínica Admin') : undefined}
            className={`flex items-center ${sidebarCollapsed ? 'lg:justify-center lg:p-1.5' : 'gap-3 p-2'} rounded-xl bg-white/[0.01] border border-white/[0.02] shadow-inner`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/20 shadow-lg uppercase shrink-0">
              {user?.nome ? user.nome.slice(0, 3) : 'ADM'}
            </div>
            <div className={`overflow-hidden ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-[11px] font-bold text-slate-200 truncate">{user?.nome || 'Clínica Admin'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Sparkles size={8} className="text-yellow-400 animate-pulse" />
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase">{user?.perfil || 'Master Account'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            title={sidebarCollapsed ? "Efetuar Logout" : undefined}
            className={`flex items-center justify-center gap-2 w-full ${
              sidebarCollapsed ? 'lg:px-2 lg:py-2.5' : 'py-3'
            } mt-1 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 hover:text-rose-300 border border-rose-500/10 hover:border-rose-500/20 transition-all duration-200 cursor-pointer`}
          >
            <LogOut size={14} className="shrink-0" />
            <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Efetuar Logout</span>
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
        <main className="flex-1 overflow-hidden p-3 sm:p-4 lg:p-5 w-full max-w-full flex flex-col min-h-0">
          <div className="w-full max-w-[1920px] mx-auto h-full flex flex-col flex-1 min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
