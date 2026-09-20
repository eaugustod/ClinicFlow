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
 * Extrai a idade numérica do paciente a partir do texto de idade ou da data de nascimento
 */
export const extrairIdadeNumerica = (idadeStr?: string, nascStr?: string): number | null => {
  // 1. A partir da data de nascimento (ex: '2016-05-20' ou '20/05/2016')
  if (nascStr && nascStr.trim()) {
    const hoje = new Date();
    let dNasc: Date | null = null;
    const str = nascStr.trim();
    if (str.includes('-')) {
      const parts = str.split('-').map(Number);
      if (parts[0] > 1900) dNasc = new Date(parts[0], parts[1] - 1, parts[2]);
    } else if (str.includes('/')) {
      const parts = str.split('/').map(Number);
      if (parts[2] > 1900) dNasc = new Date(parts[2], parts[1] - 1, parts[0]);
    }
    if (dNasc && !isNaN(dNasc.getTime())) {
      let idade = hoje.getFullYear() - dNasc.getFullYear();
      const m = hoje.getMonth() - dNasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < dNasc.getDate())) {
        idade--;
      }
      return idade >= 0 ? idade : null;
    }
  }

  // 2. A partir do campo de texto de idade (ex: "8 anos", "5", "10 meses", "32a")
  if (!idadeStr || !idadeStr.trim()) return null;
  const raw = idadeStr.toLowerCase().trim();

  // Se expressa em meses (ex: "6 meses", "10m") -> idade em anos é 0
  if (raw.includes('mes') || raw.includes('mês')) {
    return 0;
  }

  const match = raw.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }

  return null;
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

  // 2. Faixa Etária Atendida pelo Profissional
  const idadePaciente = extrairIdadeNumerica(espera.idade, espera.nasc);
  if (idadePaciente !== null) {
    const min = prof.idadeMinima !== undefined && prof.idadeMinima !== null ? prof.idadeMinima : 0;
    const max = prof.idadeMaxima !== undefined && prof.idadeMaxima !== null ? prof.idadeMaxima : 120;

    if (idadePaciente < min || idadePaciente > max) {
      return {
        compativel: false,
        score: 0,
        motivos: [],
        avisos: [`Fora da faixa etária: Paciente tem ${idadePaciente} anos (Terapeuta atende de ${min} a ${max} anos)`]
      };
    } else {
      score += 20;
      motivos.push(`Faixa etária atendida: ${idadePaciente} anos (${min} a ${max} anos)`);
    }
  }

  // 3. Convênio / Plano
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
 * Verifica se um dia e horário específico atende às preferências cadastradas na lista de espera
 */
export const verificarCompatibilidadeDisponibilidade = (
  slotHora: string,
  diaSemanaNome: string,
  espera: ListaEspera
): { compativel: boolean; matches: string[]; bonusScore: number } => {
  const matches: string[] = [];
  let bonusScore = 0;
  const horaMin = timeToMinutes(slotHora);

  // 1. Verificação de Dias da Semana
  const diasPreferencia = Array.isArray(espera.dias) ? espera.dias : [];
  let matchDia = true;
  if (diasPreferencia.length > 0) {
    const diaEncontrado = diasPreferencia.some(d =>
      diaSemanaNome.toLowerCase().includes(d.toLowerCase()) ||
      d.toLowerCase().includes(diaSemanaNome.toLowerCase())
    );
    if (diaEncontrado) {
      matches.push(`Dia solicitado: ${diaSemanaNome}`);
      bonusScore += 20;
    } else {
      matchDia = false;
    }
  }

  // 2. Verificação de Período Geral (Manhã, Tarde, Noite, Ambos)
  const periodoGeral = (espera.periodo || 'Ambos').toLowerCase();
  const isManha = horaMin >= 420 && horaMin < 720;  // 07:00 às 12:00
  const isTarde = horaMin >= 720 && horaMin < 1080; // 12:00 às 18:00
  const isNoite = horaMin >= 1080;                  // 18:00+

  let matchPeriodoGeral = true;
  if (periodoGeral === 'manhã' || periodoGeral === 'manha') {
    if (isManha) {
      matches.push('Turno matutino solicitado');
      bonusScore += 15;
    } else {
      matchPeriodoGeral = false;
    }
  } else if (periodoGeral === 'tarde') {
    if (isTarde) {
      matches.push('Turno vespertino solicitado');
      bonusScore += 15;
    } else {
      matchPeriodoGeral = false;
    }
  } else if (periodoGeral === 'noite') {
    if (isNoite) {
      matches.push('Turno noturno solicitado');
      bonusScore += 15;
    } else {
      matchPeriodoGeral = false;
    }
  }

  // 3. Verificação de Períodos Específicos / Posições na Agenda
  const periodosEspecificos = Array.isArray(espera.periodos) ? espera.periodos : [];
  let matchPeriodoEspecifico = periodosEspecificos.length === 0;

  if (periodosEspecificos.length > 0) {
    for (const pref of periodosEspecificos) {
      const pLower = pref.toLowerCase();

      if (pLower.includes('manhã') || pLower.includes('manha')) {
        if (isManha) {
          matchPeriodoEspecifico = true;
          matches.push('Manhã (08h-12h)');
          bonusScore += 15;
        }
      }
      if (pLower.includes('tarde')) {
        if (isTarde) {
          matchPeriodoEspecifico = true;
          matches.push('Tarde (12h-18h)');
          bonusScore += 15;
        }
      }
      if (pLower.includes('noite')) {
        if (isNoite) {
          matchPeriodoEspecifico = true;
          matches.push('Noite (18h-21h)');
          bonusScore += 15;
        }
      }
      if (pLower.includes('primeiro horário') && slotHora === '08:00') {
        matchPeriodoEspecifico = true;
        matches.push('Primeiro horário');
        bonusScore += 20;
      }
      if (pLower.includes('último horário') && horaMin >= 1020) {
        matchPeriodoEspecifico = true;
        matches.push('Último horário');
        bonusScore += 20;
      }
      if (pLower.includes('primeiro ou último') && (slotHora === '08:00' || horaMin >= 1020)) {
        matchPeriodoEspecifico = true;
        matches.push('Primeiro ou último horário');
        bonusScore += 20;
      }

      // Janela "Após XX:XX"
      const matchApos = pLower.match(/(?:após|apos|a partir)\s*(\d{1,2})(?::(\d{2}))?/);
      if (matchApos) {
        const hMin = parseInt(matchApos[1]) * 60 + (matchApos[2] ? parseInt(matchApos[2]) : 0);
        if (horaMin >= hMin) {
          matchPeriodoEspecifico = true;
          matches.push(`Após ${matchApos[1]}:${matchApos[2] || '00'}`);
          bonusScore += 15;
        }
      }

      // Janela "Até XX:XX"
      const matchAte = pLower.match(/até\s*(\d{1,2})(?::(\d{2}))?/);
      if (matchAte) {
        const hMax = parseInt(matchAte[1]) * 60 + (matchAte[2] ? parseInt(matchAte[2]) : 0);
        if (horaMin <= hMax) {
          matchPeriodoEspecifico = true;
          matches.push(`Até ${matchAte[1]}:${matchAte[2] || '00'}`);
          bonusScore += 15;
        }
      }

      // Horário exato (ex: "14:00")
      if (pLower.includes(slotHora)) {
        matchPeriodoEspecifico = true;
        matches.push(`Horário exato: ${slotHora}`);
        bonusScore += 25;
      }
    }
  }

  // Compatível se o dia bate E (o turno geral bate OU algum horário específico bate)
  const compativel = matchDia && (matchPeriodoGeral || matchPeriodoEspecifico);

  return {
    compativel,
    matches: Array.from(new Set(matches)),
    bonusScore: Math.min(35, bonusScore)
  };
};

export interface GerarOportunidadesParams {
  diasJanela?: number; // Ex: 7, 14, 30 dias
  duracaoMin?: number; // Ex: 30, 45, 60
  modalidade?: 'presencial' | 'online';
  filtroProfId?: number | 'all';
  apenasSalasLivres?: boolean;
  estritoDisponibilidadePaciente?: boolean; // Se true, filtra estritamente dia e horário do paciente
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
    apenasSalasLivres = true,
    estritoDisponibilidadePaciente = true
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
      // 3.1. Verifica a escala/jornada semanal do terapeuta para o dia da semana
      const jornadaDia = Array.isArray(prof.jornada)
        ? prof.jornada.find(j => j.diaSemana === diaSemanaNome)
        : undefined;

      // Se o terapeuta possui jornada configurada e está marcado como inativo/folga neste dia, pula o terapeuta
      if (jornadaDia && !jornadaDia.ativo) {
        continue;
      }

      const agendamentosProfDia = agendamentosDoDia.filter(a => a.profId === prof.id);

      for (const slotHora of slotsPadrao) {
        const slotHoraFim = minutesToTime(timeToMinutes(slotHora) + duracaoMin);

        // REGRA 1: Bloqueio estrito de horário de almoço (12:00 às 13:00)
        if (isHorarioSobreposto(slotHora, slotHoraFim, '12:00', '13:00')) {
          continue;
        }

        // REGRA 2: Respeitar horário de expediente do terapeuta
        if (jornadaDia) {
          const slotIniMin = timeToMinutes(slotHora);
          const slotFimMin = timeToMinutes(slotHoraFim);
          const jIniMin = timeToMinutes(jornadaDia.horaInicio || '08:00');
          const jFimMin = timeToMinutes(jornadaDia.horaFim || '18:00');

          // Fora do expediente de trabalho
          if (slotIniMin < jIniMin || slotFimMin > jFimMin) {
            continue;
          }

          // Intervalo de almoço customizado do terapeuta (se diferente de 12-13)
          if (jornadaDia.intervaloInicio && jornadaDia.intervaloFim) {
            if (isHorarioSobreposto(slotHora, slotHoraFim, jornadaDia.intervaloInicio, jornadaDia.intervaloFim)) {
              continue;
            }
          }
        }

        // Checa se o profissional já tem agendamento ativo neste slot
        const conflitoProf = agendamentosProfDia.some(a => {
          const aHoraFim = a.horaFim || minutesToTime(timeToMinutes(a.hora) + (a.durMin || 30));
          return isHorarioSobreposto(slotHora, slotHoraFim, a.hora, aHoraFim);
        });

        if (conflitoProf) {
          continue; // Profissional ocupado
        }

        // REGRA 3: Checagem e Vínculo de Consultório Físico (se presencial)
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

          // Se o terapeuta tem um consultório alocado para este dia da semana
          if (jornadaDia?.salaPadrao && jornadaDia.salaPadrao.trim() !== '') {
            const salaFixaNome = jornadaDia.salaPadrao.trim().toLowerCase();
            const salaFixaDisponivel = salasLivresNoHorario.some(s => s.nome.trim().toLowerCase() === salaFixaNome);

            if (salaFixaDisponivel) {
              salaSugerida = jornadaDia.salaPadrao;
              // Ordena para que o consultório fixo apareça em primeiro
              salasLivresNoHorario.sort((a, b) =>
                a.nome.trim().toLowerCase() === salaFixaNome ? -1 : (b.nome.trim().toLowerCase() === salaFixaNome ? 1 : 0)
              );
            } else if (apenasSalasLivres) {
              // Se o consultório fixo deste terapeuta estiver ocupado por outra consulta, não oferece para evitar choque
              continue;
            } else {
              salaSugerida = salasLivresNoHorario[0]?.nome || jornadaDia.salaPadrao;
            }
          } else {
            if (apenasSalasLivres && salasLivresNoHorario.length === 0) {
              continue; // Nenhuma sala física livre na clínica neste horário
            }
            salaSugerida = salasLivresNoHorario[0]?.nome;
          }
        }

        // REGRA 4: Respeitar disponibilidade do paciente (Dias da semana, períodos e horários solicitados)
        const disp = verificarCompatibilidadeDisponibilidade(slotHora, diaSemanaNome, esperaItem);
        if (estritoDisponibilidadePaciente && !disp.compativel) {
          continue; // Vaga fora dos dias/horários solicitados pelo paciente na fila de espera
        }

        let bonusVinculo = 0;
        const motivosTodos = [...comp.motivos, ...disp.matches];

        if (jornadaDia?.salaPadrao) {
          bonusVinculo = 10;
          motivosTodos.push(`Consultório vinculado: ${jornadaDia.salaPadrao}`);
        }

        const scoreFinal = Math.min(100, comp.score + disp.bonusScore + bonusVinculo);

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
