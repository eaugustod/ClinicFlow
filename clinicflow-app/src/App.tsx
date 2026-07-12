import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Senhas } from './pages/Senhas';
import { Pacientes } from './pages/Pacientes';
import { Profissionais } from './pages/Profissionais';
import { PlanosProcedimentos } from './pages/PlanosProcedimentos';
import { Configuracoes } from './pages/Configuracoes';
import { Espera } from './pages/Espera';
import { Agenda } from './pages/Agenda';
import { Historico } from './pages/Historico';
import { GuiasSadt } from './pages/GuiasSadt';
import { LotesTiss } from './pages/LotesTiss';
import { Relatorios } from './pages/Relatorios';
import { Fechamento } from './pages/Fechamento';
import { ControleMeses } from './pages/ControleMeses';
import { Feriados } from './pages/Feriados';
import { Usuarios } from './pages/Usuarios';
import { Perfis } from './pages/Perfis';
import { Atendimento } from './pages/Atendimento';
import { Conecta } from './pages/Conecta';
import { StatusAgendamentoPage } from './pages/StatusAgendamento';
import { ChatPage } from './pages/Chat';
import { Importador } from './pages/Importador';
import { useApp } from './context/AppContext';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const { loading } = useApp();

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

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard />;
      case 'agenda':
        return <Agenda />;
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
      case 'fechamento':
        return <Fechamento initialTab="calculo" />;
      case 'financeiro':
        return <Fechamento initialTab="financeiro" />;

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
