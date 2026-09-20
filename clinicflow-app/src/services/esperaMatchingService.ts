import { Agendamento, Profissional, ListaEspera, ClinicaConfig, SalaClinica, EncaixeOportunidade } from '../types';

export const SALAS_PADRAO_CLINICA: SalaClinica[] = [
  { id: 'sala-01', nome: 'Sala 01 - Geral / Psicoterapia', tipo: 'Consultório', cor: '#4f8ef7' },
  { id: 'sala-02', nome: 'Sala 02 - Ludoterapia / Infantil', tipo: 'Infantil', cor: '#a855f7' },
  { id: 'sala-03', nome: 'Sala 03 - Integração Sensorial / T.O.', tipo: 'T.O.', cor: '#10b981' },
  { id: 'sala-04', nome: 'Sala 04 - Fonoaudiologia', tipo: 'Fono', cor: '#f59e0b' },
  { id: 'sala-05', nome: 'Sala 05 - Multidisciplinar / Avaliação', tipo: 'Multiuso', cor: '#ec4899' },
  { id: 'sala-06', nome: 'Sala 06 - Atendimento Clínico', tipo: 'Consultório', cor: '#06b6d4' }
];

export const DIAS_SEMANA_MAP: { [key: number]: string } = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
};

/**
 * Converte string de horário "HH:MM" para minutos desde 00:00
 */
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Converte minutos para string "HH:MM"
 */
export const minutesToTime = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Retorna as salas da clínica a partir da configuração ou o fallback padrão
 */
export const obterSalasClinica = (config?: ClinicaConfig): SalaClinica[] => {
  if (config && Array.isArray(config.salas) && config.salas.length > 0) {
    return config.salas.map((s: any, idx: number) => {
      if (typeof s === 'string') {
        return {
          id: `sala-${idx + 1}`,
          nome: s,
          tipo: 'Consultório',
          cor: SALAS_PADRAO_CLINICA[idx % SALAS_PADRAO_CLINICA.length].cor
        };
      }
      return {
        id: s.id || `sala-${idx + 1}`,
        nome: s.nome || `Sala ${idx + 1}`,
        tipo: s.tipo || 'Consultório',
        cor: s.cor || '#4f8ef7'
      };
    });
  }
  return SALAS_PADRAO_CLINICA;
};

/**
 * Checa se dois intervalos de horário se sobrepõem
 */
export const isHorarioSobreposto = (
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string
): boolean => {
  const iniMinA = timeToMinutes(inicioA);
  const fimMinA = timeToMinutes(fimA);
  const iniMinB = timeToMinutes(inicioB);
  const fimMinB = timeToMinutes(fimB);

  return iniMinA < fimMinB && fimMinA > iniMinB;
};

/**
 * Retorna as salas físicas da clínica que estão 100% livres no dia e intervalo especificado.
 * Verifica exclusivamente contra os agendamentos presenciais ativos do dia.
 */
export const verificarSalasLivres = (
  dataISO: string,
  horaIni: string,
  horaFim: string,
  agendamentos: Agendamento[],
  salasDisponiveis: SalaClinica[]
): SalaClinica[] => {
  // Filtra agendamentos presenciais ativos no mesmo dia
  const agendamentosDia = agendamentos.filter(a => {
    if (a.dataISO !== dataISO) return false;
    const st = (a.status || '').toLowerCase();
    if (st === 'cancelado' || st === 'desmarcado') return false;
    if (a.modalidade === 'online') return false; // Online não ocupa sala física
    return true;
  });

  // Identifica salas ocupadas no mesmo intervalo de horário
  const salasOcupadas = new Set<string>();

  agendamentosDia.forEach(a => {
    const aHoraIni = a.hora;
    const aHoraFim = a.horaFim || minutesToTime(timeToMinutes(a.hora) + (a.durMin || 30));

    if (isHorarioSobreposto(horaIni, horaFim, aHoraIni, aHoraFim)) {
      if (a.sala) salasOcupadas.add(a.sala.trim().toLowerCase());
      if (a.salaId) salasOcupadas.add(String(a.salaId).trim().toLowerCase());
    }
  });

  return salasDisponiveis.filter(sala => {
    const nomeNorm = sala.nome.trim().toLowerCase();
    const idNorm = String(sala.id).trim().toLowerCase();
    return !salasOcupadas.has(nomeNorm) && !salasOcupadas.has(idNorm);
  });
};

/**
 * Calcula a compatibilidade entre o paciente em espera e o profissional
 */
export const calcularCompatibilidadeProfissional = (
  espera: ListaEspera,
  prof: Profissional
): { compativel: boolean; score: number; motivos: string[]; avisos: string[] } => {
  const motivos: string[] = [];
  const avisos: string[] = [];
  let score = 40; // Base inicial para profissional ativo

  // 1. Especialidade
  const rawEspEspera = (espera.especialidade || '').toLowerCase();
  const espProf = (prof.esp || '').toLowerCase();

  const espLista = rawEspEspera
    .split(/[,/]+/)
    .map(s => s.trim())
    .filter(Boolean);

  let matchEspecialidade = false;

  if (espLista.length === 0 || rawEspEspera === 'geral') {
    matchEspecialidade = true;
    score += 25;
    motivos.push('Especialidade Geral compatível');
  } else {
    for (const esp of espLista) {
      if (espProf.includes(esp) || esp.includes(espProf)) {
        matchEspecialidade = true;
        score += 35;
        motivos.push(`Especialidade compatível: ${prof.esp}`);
        break;
      }
    }
  }

  if (!matchEspecialidade) {
    avisos.push(`Especialidade diferente (${prof.esp} vs ${espera.especialidade || 'não informada'})`);
    score = Math.max(10, score - 30);
  }

  // 2. Convênio / Plano
  const planoEspera = (espera.plano || '').toLowerCase().trim();
  if (planoEspera && planoEspera !== 'particular') {
    motivos.push(`Atendimento pelo convênio ${espera.plano}`);
    score += 15;
  } else {
    motivos.push('Atendimento Particular aceito');
    score += 10;
  }

  return {
    compativel: matchEspecialidade,
    score: Math.min(100, score),
    motivos,
    avisos
  };
};

/**
 * Verifica se um horário específico bate com as preferências do paciente
 */
export const pontuarPreferenciaHorario = (
  horaStr: string,
  diaSemanaNome: string,
  espera: ListaEspera
): { bonusScore: number; matches: string[] } => {
  let bonus = 0;
  const matches: string[] = [];
  const horaMin = timeToMinutes(horaStr);

  // 1. Dias da semana
  const diasPreferencia = Array.isArray(espera.dias) ? espera.dias : [];
  if (diasPreferencia.length > 0) {
    const diaEncontrado = diasPreferencia.some(d =>
      diaSemanaNome.toLowerCase().includes(d.toLowerCase()) ||
      d.toLowerCase().includes(diaSemanaNome.toLowerCase())
    );
    if (diaEncontrado) {
      bonus += 15;
      matches.push(`Dia da semana preferido: ${diaSemanaNome}`);
    }
  } else {
    bonus += 5;
  }

  // 2. Turnos / Período
  const periodosPreferencia = Array.isArray(espera.periodos) ? espera.periodos : [];
  const periodoGeral = (espera.periodo || 'Ambos').toLowerCase();

  const isManha = horaMin >= 420 && horaMin < 720; // 07:00 às 12:00
  const isTarde = horaMin >= 720 && horaMin < 1080; // 12:00 às 18:00
  const isNoite = horaMin >= 1080; // 18:00+

  if (periodoGeral === 'manhã' || periodoGeral === 'manha') {
    if (isManha) {
      bonus += 10;
      matches.push('Turno matutino de preferência');
    }
  } else if (periodoGeral === 'tarde') {
    if (isTarde) {
      bonus += 10;
      matches.push('Turno vespertino de preferência');
    }
  } else if (periodoGeral === 'ambos') {
    bonus += 5;
  }

  // Horários específicos ou posições na agenda
  periodosPreferencia.forEach(pref => {
    const pLower = pref.toLowerCase();
    if (pLower.includes('primeiro horário') && horaStr === '08:00') {
      bonus += 15;
      matches.push('Primeiro horário da agenda');
    }
    if (pLower.includes('último horário') && horaMin >= 1020) {
      bonus += 15;
      matches.push('Final do dia / Último horário');
    }
    if (pLower.includes(horaStr)) {
      bonus += 20;
      matches.push(`Horário exato pretendido: ${horaStr}`);
    }
  });

  return { bonusScore: Math.min(30, bonus), matches };
};

export interface GerarOportunidadesParams {
  diasJanela?: number; // Ex: 7, 14, 30 dias
  duracaoMin?: number; // Ex: 30, 45, 60
  modalidade?: 'presencial' | 'online';
  filtroProfId?: number | 'all';
  apenasSalasLivres?: boolean;
}

/**
 * Motor Principal: Gera as oportunidades de encaixe cruzando
 * Lista de Espera -> Compatibilidade -> Horário Livre -> Sala Livre -> Profissional
 */
export const gerarOportunidadesEncaixe = (
  esperaItem: ListaEspera,
  profissionais: Profissional[],
  agendamentos: Agendamento[],
  clinicaConfig?: ClinicaConfig,
  params: GerarOportunidadesParams = {}
): EncaixeOportunidade[] => {
  const {
    diasJanela = 14,
    duracaoMin = 30,
    modalidade = 'presencial',
    filtroProfId = 'all',
    apenasSalasLivres = true
  } = params;

  const salasClinica = obterSalasClinica(clinicaConfig);
  const oportunidades: EncaixeOportunidade[] = [];

  // 1. Filtrar profissionais ativos e compatíveis
  const profsAtivos = profissionais.filter(p => {
    if (p.status !== 'Ativo') return false;
    if (filtroProfId !== 'all' && p.id !== filtroProfId) return false;
    return true;
  });

  // Avalia compatibilidade básica
  const profsCompativeis = profsAtivos
    .map(p => ({
      prof: p,
      comp: calcularCompatibilidadeProfissional(esperaItem, p)
    }))
    .filter(item => item.comp.compativel);

  if (profsCompativeis.length === 0) {
    return [];
  }

  // 2. Definir grade padrão de horários de atendimento (08:00 às 18:30)
  const slotsPadrao: string[] = [];
  for (let h = 8; h <= 18; h++) {
    slotsPadrao.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 18) {
      slotsPadrao.push(`${h.toString().padStart(2, '0')}:30`);
    }
  }

  // 3. Iterar pelos próximos dias a partir de amanhã
  const hoje = new Date();
  
  for (let d = 1; d <= diasJanela; d++) {
    const dataAlvo = new Date(hoje);
    dataAlvo.setDate(hoje.getDate() + d);

    const diaSemanaNum = dataAlvo.getDay();
    if (diaSemanaNum === 0) continue; // Pula domingos

    const diaSemanaNome = DIAS_SEMANA_MAP[diaSemanaNum];
    const dataISO = dataAlvo.toISOString().split('T')[0];
    const dataFormatada = dataAlvo.toLocaleDateString('pt-BR');

    // Agendamentos ativos do dia
    const agendamentosDoDia = agendamentos.filter(a => {
      if (a.dataISO !== dataISO) return false;
      const st = (a.status || '').toLowerCase();
      return st !== 'cancelado' && st !== 'desmarcado';
    });

    for (const { prof, comp } of profsCompativeis) {
      const agendamentosProfDia = agendamentosDoDia.filter(a => a.profId === prof.id);

      for (const slotHora of slotsPadrao) {
        const slotHoraFim = minutesToTime(timeToMinutes(slotHora) + duracaoMin);

        // Checa se o profissional está livre neste slot
        const conflitoProf = agendamentosProfDia.some(a => {
          const aHoraFim = a.horaFim || minutesToTime(timeToMinutes(a.hora) + (a.durMin || 30));
          return isHorarioSobreposto(slotHora, slotHoraFim, a.hora, aHoraFim);
        });

        if (conflitoProf) {
          continue; // Profissional ocupado
        }

        // Checa disponibilidade de sala física (se presencial)
        let salasLivresNoHorario: SalaClinica[] = [];
        let salaSugerida: string | undefined = undefined;

        if (modalidade === 'presencial') {
          salasLivresNoHorario = verificarSalasLivres(
            dataISO,
            slotHora,
            slotHoraFim,
            agendamentosDoDia,
            salasClinica
          );

          if (apenasSalasLivres && salasLivresNoHorario.length === 0) {
            continue; // Nenhuma sala física livre na clínica neste horário
          }

          salaSugerida = salasLivresNoHorario[0]?.nome;
        }

        // Pontuação de preferência de dia e horário
        const prefPontos = pontuarPreferenciaHorario(slotHora, diaSemanaNome, esperaItem);
        const scoreFinal = Math.min(100, comp.score + prefPontos.bonusScore);
        const motivosTodos = [...comp.motivos, ...prefPontos.matches];

        oportunidades.push({
          profissionalId: prof.id,
          profissionalNome: prof.nomeAgenda || prof.nome,
          profissionalFoto: prof.foto,
          especialidade: prof.esp,
          cor: prof.cor || '#4f8ef7',
          dataISO,
          dataFormatada,
          diaSemana: diaSemanaNome,
          horaInicio: slotHora,
          horaFim: slotHoraFim,
          duracaoMin,
          salaSugerida,
          salasLivres: salasLivresNoHorario,
          scoreMatch: scoreFinal,
          motivosMatch: motivosTodos,
          avisos: comp.avisos
        });
      }
    }
  }

  // Ordena por maior pontuação (melhor match) e depois pela data mais próxima
  return oportunidades.sort((a, b) => {
    if (b.scoreMatch !== a.scoreMatch) {
      return b.scoreMatch - a.scoreMatch;
    }
    if (a.dataISO !== b.dataISO) {
      return a.dataISO.localeCompare(b.dataISO);
    }
    return a.horaInicio.localeCompare(b.horaInicio);
  });
};
