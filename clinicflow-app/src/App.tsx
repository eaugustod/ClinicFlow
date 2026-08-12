import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Senhas } from './pages/Senhas';
import { Pacientes } from './pages/Pacientes';
import { Profissionais } from './pages/Profissionais';
import { PlanosProcedimentos } from './pages/PlanosProcedimentos';
import { Configuracoes } from './pages/Configuracoes';
import { Espera } from './pages/Espera';
import { Agenda } from './pages/Agenda';
import { AgendaRecepcao } from './pages/AgendaRecepcao';
import { Historico } from './pages/Historico';
import { GuiasSadt } from './pages/GuiasSadt';
import { LotesTiss } from './pages/LotesTiss';
import { Relatorios } from './pages/Relatorios';
import { Fechamento } from './pages/Fechamento';
import { AnaliseFechamento } from './pages/AnaliseFechamento';
import { ControleMeses } from './pages/ControleMeses';
import { Feriados } from './pages/Feriados';
import { Usuarios } from './pages/Usuarios';
import { Perfis } from './pages/Perfis';
import { Atendimento } from './pages/Atendimento';
import { Conecta } from './pages/Conecta';
import { StatusAgendamentoPage } from './pages/StatusAgendamento';
import { ChatPage } from './pages/Chat';
import { Importador } from './pages/Importador';
import { FinanceiroNfse } from './pages/FinanceiroNfse';
import { FinanceiroFluxoCaixa } from './pages/FinanceiroFluxoCaixa';
import { Login } from './pages/Login';
import { ThemeSelector } from './components/ThemeSelector';
import { useApp } from './context/AppContext';

function App() {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('page') || 'dashboard';
  });

  const { loading, user, clinicaConfig } = useApp();
  const isStandaloneChat = new URLSearchParams(window.location.search).get('page') === 'chat';

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0f1117] text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#4f8ef7] flex items-center justify-center font-bold text-white shadow-[0_0_16px_rgba(79,142,247,0.3)] animate-pulse">
            CF
          </div>
          <p className="text-xs text-[#8b92a8] font-medium">Iniciando ClinicFlow...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Standalone Chat Dedicated View
  if (isStandaloneChat) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[var(--bg-base)] text-[var(--text-primary)] font-sans overflow-hidden">
        {/* Dedicated Standalone Chat Header */}
        <header className="h-14 px-6 border-b border-[var(--border)] bg-[var(--header-bg)] flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-xs shadow-lg">
              CF
            </div>
            <div>
              <h1 className="font-bold text-xs text-[var(--text-primary)]">Chat com Pacientes — {clinicaConfig.nome || 'Kosmos Espaço Terapêutico'}</h1>
              <p className="text-[9px] text-[var(--accent)] font-bold uppercase tracking-wider">Aba Dedicada de Atendimento em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSelector />
            <button
              onClick={() => {
                window.location.href = window.location.origin + window.location.pathname;
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-raised)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-sm"
            >
              Abrir Painel Completo
            </button>
          </div>
        </header>

        {/* Dedicated Standalone Body */}
        <main className="flex-1 p-3 overflow-hidden">
          <ChatPage />
        </main>
      </div>
    );
  }

  const hasPermission = (pageId: string) => {
    if (!user) return false;
    if (user.perfil?.toLowerCase() === 'admin') return true;
    if (!user.permissions) return true;

    let targetId = pageId;
    if (pageId === 'atendimento') targetId = 'agenda';
    if (pageId === 'analise-fechamento' || pageId === 'financeiro') targetId = 'fechamento';
    if (pageId === 'conecta-agenda') targetId = 'agenda';
    if (pageId === 'conecta-profissionais') targetId = 'profissionais';
    if (pageId === 'conecta-fechamento') targetId = 'fechamento';
    if (pageId.startsWith('importar-')) targetId = 'importar';
    if (pageId === 'status-agendamento') targetId = 'config';

    return user.permissions.includes(targetId);
  };

  const renderContent = () => {
    if (!hasPermission(activePage)) {
      return (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-500">
          <Shield className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
          <p className="text-sm font-medium">Acesso Restrito</p>
          <p className="text-xs text-slate-600 mt-1">Seu perfil de acesso não tem permissão para esta área.</p>
        </div>
      );
    }

    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'agenda':
        return <Agenda />;
      case 'agenda-recepcao':
        return <AgendaRecepcao />;
      case 'atendimento':
        return <Atendimento onNavigate={setActivePage} />;
      case 'conecta-agenda':
      case 'conecta-profissionais':
      case 'conecta-fechamento':
        return <Conecta activeTab={activePage} onNavigate={setActivePage} />;
      case 'historico':
        return <Historico />;
      case 'chat':
        return <ChatPage />;
      case 'pacientes':
        return <Pacientes />;
      case 'profissionais':
        return <Profissionais />;
      case 'planos':
      case 'procedimentos':
        return <PlanosProcedimentos />;
      case 'guias':
        return <GuiasSadt />;
      case 'lotes':
        return <LotesTiss />;
      case 'senhas':
        return <Senhas />;
      case 'analise-fechamento':
        return <AnaliseFechamento />;
      case 'fechamento':
        return <Fechamento initialTab="calculo" />;
      case 'financeiro':
        return <Fechamento initialTab="financeiro" />;
      case 'financeiro-fluxo-caixa':
        return <FinanceiroFluxoCaixa />;
      case 'financeiro-nfse':
        return <FinanceiroNfse />;

      case 'espera':
        return <Espera />;
      case 'relatorios':
        return <Relatorios />;
      case 'ctrlMeses':
        return <ControleMeses />;
      case 'feriados':
        return <Feriados />;
      case 'status-agendamento':
        return <StatusAgendamentoPage />;
      case 'usuarios':
        return <Usuarios />;
      case 'perfis':
        return <Perfis />;
      case 'config':
        return <Configuracoes />;
      case 'importar-agenda':
        return <Importador tipo="agenda" />;
      case 'importar-pacientes':
        return <Importador tipo="pacientes" />;
      case 'importar-profissionais':
        return <Importador tipo="profissionais" />;
      case 'importar-planos':
        return <Importador tipo="planos" />;
      case 'importar-procedimentos':
        return <Importador tipo="procedimentos" />;
      case 'importar-guias':
        return <Importador tipo="guias_sadt" />;
      case 'importar-senhas':
        return <Importador tipo="senhas" />;
      case 'importar-anamnese':
        return <Importador tipo="anamnese" />;
      case 'importar-evolucoes':
        return <Importador tipo="evolucoes" />;
      case 'importar-espera':
        return <Importador tipo="espera" />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[50vh] text-[#555d74]">
            <p className="text-sm font-medium">Módulo "{activePage}" em desenvolvimento</p>
          </div>
        );
    }
  };

  return (
    <Layout activePage={activePage} setActivePage={setActivePage}>
      {renderContent()}
    </Layout>
  );
}

export default App;
