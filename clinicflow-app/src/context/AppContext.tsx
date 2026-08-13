import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import {
  Paciente,
  Profissional,
  PlanoSaude,
  Procedimento,
  Agendamento,
  GuiaSadt,
  LoteTiss,
  SenhaPlano,
  ListaEspera,
  Historico,
  ClinicaConfig,
  StatusAgendamento
} from '../types';

interface AppContextType {
  pacientes: Paciente[];
  profissionais: Profissional[];
  planos: PlanoSaude[];
  procedimentos: Procedimento[];
  agendamentos: Agendamento[];
  clinicaConfig: ClinicaConfig;
  senhas: SenhaPlano[];
  guias: GuiaSadt[];
  lotes: LoteTiss[];
  espera: ListaEspera[];
  historico: Historico[];
  statusAgendamentos: StatusAgendamento[];

  loading: boolean;
  syncing: boolean;

  loadedSenhas: boolean;
  loadedEspera: boolean;
  loadedGuias: boolean;

  lazyLoadSenhas: () => Promise<void>;
  lazyLoadEspera: () => Promise<void>;
  lazyLoadGuias: () => Promise<void>;
  lazyLoadHistorico: (pacId: number) => Promise<void>;
  loadAgendamentosMes: (yearMonth: string) => Promise<Agendamento[]>;
  loadAgendamentosPeriodo: (start: string, end: string) => Promise<Agendamento[]>;

  refreshAll: () => Promise<void>;
  getBaseStatus: (statusName: string) => 'agendado' | 'confirmado' | 'atendido' | 'desmarcado' | 'cancelado';
  getStatusColor: (statusName: string) => string;
  logStatusChange: (apptId: number, newStatus: string) => Promise<void>;
  user: any | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

const CACHE_KEY = 'cf_cache_v3';

const safeSaveCache = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014) {
      console.warn('[ClinicFlow Context] LocalStorage quota exceeded. Clearing legacy keys and caching core data.');
      try {
        const keysToKeep = [key, 'cf_auth_session', 'sb-supabase-auth-token'];
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && !keysToKeep.includes(k) && k.startsWith('cf_')) {
            localStorage.removeItem(k);
          }
        }
        const trimmedData = {
          ...data,
          agendamentos: Array.isArray(data.agendamentos) ? data.agendamentos.slice(0, 150) : [],
          pacientes: Array.isArray(data.pacientes) ? data.pacientes.slice(0, 300) : []
        };
        localStorage.setItem(key, JSON.stringify(trimmedData));
      } catch (_) {
        try {
          const minimalData = {
            profissionais: data.profissionais || [],
            planos: data.planos || [],
            procedimentos: data.procedimentos || [],
            clinica: data.clinica || {},
            statusAgendamentos: data.statusAgendamentos || [],
            ts: Date.now()
          };
          localStorage.setItem(key, JSON.stringify(minimalData));
        } catch (_) {
          console.warn('[ClinicFlow Context] Storage quota limit reached. Bypassing offline cache.');
        }
      }
    }
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [planos, setPlanos] = useState<PlanoSaude[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [clinicaConfig, setClinicaConfig] = useState<ClinicaConfig>({
    nome: 'ClinicFlow',
    cnpj: '',
    endereco: '',
    telefone: '',
    email: '',
    codPrestador: '',
    cnes: ''
  });

  const [senhas, setSenhas] = useState<SenhaPlano[]>([]);
  const [guias, setGuias] = useState<GuiaSadt[]>([]);
  const [lotes, setLotes] = useState<LoteTiss[]>([]);
  const [espera, setEspera] = useState<ListaEspera[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [statusAgendamentos, setStatusAgendamentos] = useState<StatusAgendamento[]>([]);

  const defaultStatusAgendamentos: StatusAgendamento[] = [
    { nome: 'Agendado', cor: '#6366f1', statusAgendamento: 'agendado', statusHistorico: 'Agendado' },
    { nome: 'Confirmado', cor: '#3b82f6', statusAgendamento: 'confirmado', statusHistorico: 'Confirmado' },
    { nome: 'Em espera (Chegou)', cor: '#eab308', statusAgendamento: 'confirmado', statusHistorico: 'Em Espera' },
    { nome: 'Atendido', cor: '#10b981', statusAgendamento: 'atendido', statusHistorico: 'Atendido' },
    { nome: 'Desmarcado', cor: '#f43f5e', statusAgendamento: 'desmarcado', statusHistorico: 'Desmarcado' },
    { nome: 'Cancelado', cor: '#ef4444', statusAgendamento: 'cancelado', statusHistorico: 'Cancelado' }
  ];

  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const [loadedSenhas, setLoadedSenhas] = useState(false);
  const [loadedEspera, setLoadedEspera] = useState(false);
  const [loadedGuias, setLoadedGuias] = useState(false);

  // Restore cache immediately at startup if user is logged in
  useEffect(() => {
    const storedUser = localStorage.getItem('cf_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const cache = JSON.parse(cached);
          if (cache.profissionais) setProfissionais(cache.profissionais);
          if (cache.planos) setPlanos(cache.planos);
          if (cache.procedimentos) setProcedimentos(cache.procedimentos);
          if (cache.pacientes) setPacientes(cache.pacientes);
          if (cache.agendamentos) setAgendamentos(cache.agendamentos);
          if (cache.clinica) setClinicaConfig(cache.clinica);
          if (cache.statusAgendamentos) setStatusAgendamentos(cache.statusAgendamentos);
          setLoading(false);
        } catch (e) {
          localStorage.removeItem(CACHE_KEY);
        }
      }
      loadInitialData();
    } else {
      setLoading(false);
    }
  }, []);

  const loadInitialData = async () => {
    setSyncing(true);
    try {
      // Refresh user permissions if user is set
      const storedUser = localStorage.getItem('cf_user');
      if (storedUser) {
        const uObj = JSON.parse(storedUser);
        const { data: dbUserR } = await supabase
          .from('usuarios')
          .select('perfil,perfil_id')
          .eq('id', uObj.id)
          .maybeSingle();
        
        if (dbUserR) {
          let allowedModulos: string[] = [];
          if (dbUserR.perfil_id) {
            const { data: profAccess } = await supabase
              .from('perfis_acesso')
              .select('modulos')
              .eq('id', dbUserR.perfil_id)
              .maybeSingle();
            if (profAccess && profAccess.modulos) {
              allowedModulos = typeof profAccess.modulos === 'string' ? JSON.parse(profAccess.modulos) : profAccess.modulos;
            }
          }
          if (allowedModulos.length === 0) {
            if (dbUserR.perfil === 'admin') {
              allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'chat', 'pacientes', 'profissionais', 'planos', 'procedimentos', 'espera', 'historico', 'guias', 'senhas', 'lotes', 'importar', 'relatorios', 'fechamento', 'financeiro', 'analise-fechamento', 'ctrlMeses', 'feriados', 'config', 'usuarios', 'perfis'];
            } else if (dbUserR.perfil === 'recepcao') {
              allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'chat', 'pacientes', 'planos', 'espera', 'senhas', 'guias'];
            } else if (dbUserR.perfil === 'profissional') {
              allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'chat', 'historico', 'guias'];
            }
          }
          const updatedUser = { ...uObj, perfil: dbUserR.perfil, permissions: allowedModulos };
          setUser(updatedUser);
          localStorage.setItem('cf_user', JSON.stringify(updatedUser));
        }
      }

      // Phase 1 - Core startup tables
      const [prof, pl, proc, pacR, agR, cfg] = await Promise.all([
        supabase.from('profissionais').select('*').order('nome').limit(500),
        supabase.from('planos_saude').select('*').order('nome').limit(500),
        supabase.from('procedimentos').select('*').order('id').limit(5000),
        supabase.from('pacientes').select('*').order('nome').limit(5000),
        supabase.from('agendamentos').select('*').order('data_iso', { ascending: false }).limit(2000),
        supabase.from('config_clinica').select('*').limit(1),
      ]);

      // Fetch status_agendamento
      const { data: statusData, error: statusErr } = await supabase.from('status_agendamento').select('*').order('nome');
      let mappedStatus = defaultStatusAgendamentos;
      if (!statusErr && statusData && statusData.length > 0) {
        mappedStatus = statusData.map(mappers.dbToStatusAg);
      }

      const mappedProf = (prof.data || []).map(mappers.dbToProf);
      const mappedPlanos = (pl.data || []).map(mappers.dbToPlano);
      const mappedProcs = (proc.data || []).map(mappers.dbToProc);
      const mappedPacientes = (pacR.data || []).map(mappers.dbToPac);
      const mappedAg = (agR.data || []).map(mappers.dbToAppt);

      setProfissionais(mappedProf);
      setPlanos(mappedPlanos);
      setProcedimentos(mappedProcs);
      setPacientes(mappedPacientes);
      setAgendamentos(mappedAg);
      setStatusAgendamentos(mappedStatus);

      if (cfg.data && cfg.data.length > 0) {
        setClinicaConfig(cfg.data[0].dados || {});
      }

      // Save to Cache (Safely handled to prevent QuotaExceededError)
      safeSaveCache(CACHE_KEY, {
        profissionais: mappedProf,
        planos: mappedPlanos,
        procedimentos: mappedProcs,
        pacientes: mappedPacientes,
        agendamentos: mappedAg,
        clinica: cfg.data?.[0]?.dados || {},
        statusAgendamentos: mappedStatus,
        ts: Date.now()
      });

      // Non-blocking deferred loading for Phase 2 background loading
      setTimeout(loadBackgroundData, 1000);

    } catch (e) {
      console.error('[ClinicFlow Context] Startup load error:', e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const loadBackgroundData = async () => {
    try {
      const [lo, se, esp, gu, hist] = await Promise.all([
        supabase.from('lotes_tiss').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('senhas_plano').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('lista_espera').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('guias_sadt').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('historico').select('*').order('data', { ascending: false }).limit(2000),
      ]);

      if (lo.data) setLotes(lo.data.map(mappers.dbToLote));
      if (se.data) {
        setSenhas(se.data.map(mappers.dbToSenha));
        setLoadedSenhas(true);
      }
      if (esp.data) {
        setEspera(esp.data.map(mappers.dbToEspera));
        setLoadedEspera(true);
      }
      if (gu.data) {
        setGuias(gu.data.map(mappers.dbToGuia));
        setLoadedGuias(true);
      }
      if (hist.data) setHistorico(hist.data.map(mappers.dbToHist));

    } catch (e) {
      console.error('[ClinicFlow Context] Background load error:', e);
    }
  };

  // Lazy Load functions
  const lazyLoadSenhas = async () => {
    if (loadedSenhas) return;
    try {
      const { data, error } = await supabase.from('senhas_plano').select('*').order('created_at', { ascending: false }).limit(3000);
      if (error) throw error;
      setSenhas(data.map(mappers.dbToSenha));
      setLoadedSenhas(true);
    } catch (e) {
      console.error('[ClinicFlow LazyLoad] Senhas error:', e);
    }
  };

  const lazyLoadEspera = async () => {
    if (loadedEspera) return;
    try {
      const { data, error } = await supabase.from('lista_espera').select('*').order('created_at', { ascending: false }).limit(2000);
      if (error) throw error;
      setEspera(data.map(mappers.dbToEspera));
      setLoadedEspera(true);
    } catch (e) {
      console.error('[ClinicFlow LazyLoad] Espera error:', e);
    }
  };

  const lazyLoadGuias = async () => {
    if (loadedGuias) return;
    try {
      const [lo, gu] = await Promise.all([
        supabase.from('lotes_tiss').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase.from('guias_sadt').select('*').order('created_at', { ascending: false }).limit(3000)
      ]);
      if (lo.data) setLotes(lo.data.map(mappers.dbToLote));
      if (gu.data) setGuias(gu.data.map(mappers.dbToGuia));
      setLoadedGuias(true);
    } catch (e) {
      console.error('[ClinicFlow LazyLoad] Guias error:', e);
    }
  };

  const lazyLoadHistorico = async (pacId: number) => {
    try {
      const { data, error } = await supabase.from('historico').select('*').eq('pac_id', pacId).order('data', { ascending: false }).limit(2000);
      if (error) throw error;
      setHistorico(prev => [
        ...prev.filter(h => h.pacId !== pacId),
        ...data.map(mappers.dbToHist)
      ]);
    } catch (e) {
      console.error('[ClinicFlow LazyLoad] Historico error:', e);
    }
  };

  const loadAgendamentosMes = async (yearMonth: string): Promise<Agendamento[]> => {
    if (!yearMonth) return [];
    try {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const lastDay = new Date(year, month, 0).getDate();

      const start1 = `${yearMonth}-01`;
      const end1 = `${yearMonth}-15`;
      const start2 = `${yearMonth}-16`;
      const end2 = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      // Run both halves in parallel to stay well below the 1000-row PostgREST limit per request
      const [res1, res2] = await Promise.all([
        supabase.from('agendamentos').select('*').gte('data_iso', start1).lte('data_iso', end1),
        supabase.from('agendamentos').select('*').gte('data_iso', start2).lte('data_iso', end2)
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      const data = [...(res1.data || []), ...(res2.data || [])];
      if (data.length > 0) {
        const mapped = data.map(mappers.dbToAppt);
        setAgendamentos(prev => {
          const map = new Map(prev.map(a => [a.id, a]));
          mapped.forEach(a => map.set(a.id, a));
          return Array.from(map.values()).sort((a, b) => b.dataISO.localeCompare(a.dataISO));
        });
        return mapped;
      }
    } catch (e) {
      console.error('[ClinicFlow AppContext] Error loading month:', e);
    }
    return [];
  };

  const loadAgendamentosPeriodo = async (start: string, end: string): Promise<Agendamento[]> => {
    if (!start || !end) return [];
    try {
      // Split the range into months and fetch each month in parallel using loadAgendamentosMes to bypass limits
      const startDate = new Date(start + 'T00:00:00');
      const endDate = new Date(end + 'T00:00:00');

      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth();
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth();

      const monthsToLoad: string[] = [];
      let currentYear = startYear;
      let currentMonth = startMonth;

      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const ymStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        monthsToLoad.push(ymStr);
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
      }

      const results = await Promise.all(monthsToLoad.map(ym => loadAgendamentosMes(ym)));
      const merged = results.flat();
      return merged.filter(a => a.dataISO >= start && a.dataISO <= end);
    } catch (e) {
      console.error('[ClinicFlow AppContext] Error loading period:', e);
    }
    return [];
  };

  const refreshAll = async () => {
    setLoadedSenhas(false);
    setLoadedEspera(false);
    setLoadedGuias(false);
    await loadInitialData();
  };

  const getBaseStatus = (statusName: string): 'agendado' | 'confirmado' | 'atendido' | 'desmarcado' | 'cancelado' => {
    const found = statusAgendamentos.find(s => s.nome.toLowerCase() === statusName.toLowerCase());
    if (found) return found.statusAgendamento;
    const defaultFound = defaultStatusAgendamentos.find(s => s.nome.toLowerCase() === statusName.toLowerCase());
    if (defaultFound) return defaultFound.statusAgendamento;
    return 'agendado';
  };

  const getStatusColor = (statusName: string): string => {
    const found = statusAgendamentos.find(s => s.nome.toLowerCase() === statusName.toLowerCase());
    if (found) return found.cor;
    const defaultFound = defaultStatusAgendamentos.find(s => s.nome.toLowerCase() === statusName.toLowerCase());
    if (defaultFound) return defaultFound.cor;
    return '#6366f1';
  };

  const logStatusChange = async (apptId: number, newStatusName: string): Promise<void> => {
    const appt = agendamentos.find(a => a.id === apptId);
    if (!appt) return;
    const foundStatus = statusAgendamentos.find(s => s.nome.toLowerCase() === newStatusName.toLowerCase()) || 
                        defaultStatusAgendamentos.find(s => s.nome.toLowerCase() === newStatusName.toLowerCase());
    if (!foundStatus || !foundStatus.statusHistorico) return;

    const pac = pacientes.find(p => p.nome.toLowerCase().trim() === appt.paciente.toLowerCase().trim());
    const targetPacId = appt.pacId || pac?.id;
    if (!targetPacId) return;

    try {
      await supabase.from('historico').insert([{
        pac_id: targetPacId,
        tipo: 'agendamento',
        titulo: `Status do Agendamento: ${foundStatus.nome}`,
        conteudo: {
          texto: `Agendamento no dia ${appt.dataISO ? appt.dataISO.split('-').reverse().join('/') : ''} às ${appt.hora} teve o status alterado para "${foundStatus.nome}".`,
          profId: appt.profId,
          hora: appt.hora,
          status: foundStatus.statusHistorico
        },
        prof_id: appt.profId,
        data: new Date().toISOString(),
        status: foundStatus.statusHistorico,
        fonte: 'Web App'
      }]);
      await lazyLoadHistorico(targetPacId);
    } catch (e) {
      console.error('[ClinicFlow AppContext] Error writing history log:', e);
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: pass
      });
      if (authErr) {
        alert('Erro de login: ' + authErr.message);
        return false;
      }
      // Busca perfil na tabela usuarios
      const { data: users, error: userErr } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .limit(1);
      if (userErr || !users || users.length === 0) {
        alert('Perfil de usuário não encontrado no sistema.');
        await supabase.auth.signOut();
        return false;
      }
      const dbUser = users[0];
      if (dbUser.status !== 'Ativo') {
        alert('Usuário inativo. Contate o administrador.');
        await supabase.auth.signOut();
        return false;
      }

      // Query allowed modules
      let allowedModulos: string[] = [];
      if (dbUser.perfil_id) {
        const { data: profAccess } = await supabase
          .from('perfis_acesso')
          .select('modulos')
          .eq('id', dbUser.perfil_id)
          .maybeSingle();
        if (profAccess && profAccess.modulos) {
          allowedModulos = typeof profAccess.modulos === 'string' ? JSON.parse(profAccess.modulos) : profAccess.modulos;
        }
      }
      if (allowedModulos.length === 0) {
        if (dbUser.perfil === 'admin') {
          allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'chat', 'pacientes', 'profissionais', 'planos', 'procedimentos', 'espera', 'historico', 'guias', 'senhas', 'lotes', 'importar', 'relatorios', 'fechamento', 'financeiro', 'analise-fechamento', 'ctrlMeses', 'feriados', 'config', 'usuarios', 'perfis'];
        } else if (dbUser.perfil === 'recepcao') {
          allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'chat', 'pacientes', 'planos', 'espera', 'senhas', 'guias'];
        } else if (dbUser.perfil === 'profissional') {
          allowedModulos = ['dashboard', 'agenda', 'agenda-recepcao', 'historico', 'guias'];
        }
      }

      const activeUser = {
        id: dbUser.id,
        nome: dbUser.nome || email,
        email: email,
        perfil: dbUser.perfil || 'recepcao',
        permissions: allowedModulos
      };
      setUser(activeUser);
      localStorage.setItem('cf_user', JSON.stringify(activeUser));
      // Carrega dados iniciais após o login
      setTimeout(loadInitialData, 100);
      return true;
    } catch (e: any) {
      alert('Erro de rede: ' + e.message);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    localStorage.removeItem('cf_user');
    localStorage.removeItem(CACHE_KEY);
    // Limpa estados de dados
    setPacientes([]);
    setProfissionais([]);
    setPlanos([]);
    setProcedimentos([]);
    setAgendamentos([]);
    setClinicaConfig({
      nome: 'ClinicFlow',
      cnpj: '',
      endereco: '',
      telefone: '',
      email: '',
      codPrestador: '',
      cnes: ''
    });
  };

  return (
    <AppContext.Provider value={{
      pacientes,
      profissionais,
      planos,
      procedimentos,
      agendamentos,
      clinicaConfig,
      senhas,
      guias,
      lotes,
      espera,
      historico,
      statusAgendamentos,
      loading,
      syncing,
      loadedSenhas,
      loadedEspera,
      loadedGuias,
      lazyLoadSenhas,
      lazyLoadEspera,
      lazyLoadGuias,
      lazyLoadHistorico,
      loadAgendamentosMes,
      loadAgendamentosPeriodo,
      refreshAll,
      getBaseStatus,
      getStatusColor,
      logStatusChange,
      user,
      login,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
};
