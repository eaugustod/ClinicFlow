import React, { useState, useMemo } from 'react';
import {
  X, Sparkles, CheckCircle2, Clock, Calendar, DoorOpen, User, Check,
  ChevronRight, Filter, AlertCircle, Phone, Send, ArrowRight, ShieldCheck,
  Video, MapPin, SlidersHorizontal, RefreshCw, Stethoscope
} from 'lucide-react';
import { ListaEspera, Profissional, Agendamento, ClinicaConfig, EncaixeOportunidade, SalaClinica } from '../../types';
import { gerarOportunidadesEncaixe, obterSalasClinica, extrairIdadeNumerica } from '../../services/esperaMatchingService';
import { supabase } from '../../services/supabase';
import { mappers } from '../../services/mappers';
import { useApp } from '../../context/AppContext';

interface PainelDisponibilidadeEsperaProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteEspera: ListaEspera | null;
  listaCompletaEspera: ListaEspera[];
  onSelectOutroPaciente: (p: ListaEspera) => void;
  profissionais: Profissional[];
  agendamentos: Agendamento[];
  clinicaConfig?: ClinicaConfig;
  onAgendamentoSucesso: () => Promise<void>;
}

export const PainelDisponibilidadeEspera: React.FC<PainelDisponibilidadeEsperaProps> = ({
  isOpen,
  onClose,
  pacienteEspera,
  listaCompletaEspera,
  onSelectOutroPaciente,
  profissionais,
  agendamentos,
  clinicaConfig,
  onAgendamentoSucesso
}) => {
  // Filtros de busca
  const [diasJanela, setDiasJanela] = useState<number>(14);
  const [duracaoMin, setDuracaoMin] = useState<number>(30);
  const [modalidade, setModalidade] = useState<'presencial' | 'online'>('presencial');
  const [filtroProfId, setFiltroProfId] = useState<number | 'all'>('all');
  const [apenasSalasLivres, setApenasSalasLivres] = useState<boolean>(true);
  const [estritoDisponibilidade, setEstritoDisponibilidade] = useState<boolean>(true);

  // Estado de confirmação de agendamento
  const [oportunidadeSelecionada, setOportunidadeSelecionada] = useState<EncaixeOportunidade | null>(null);
  const [salaEscolhida, setSalaEscolhida] = useState<string>('');
  const [salvando, setSalvando] = useState<boolean>(false);
  const [sucessoModal, setSucessoModal] = useState<boolean>(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string>('');

  const { salasClinica: ctxSalasClinica } = useApp();
  const salasClinica = useMemo(() => {
    if (ctxSalasClinica && ctxSalasClinica.length > 0) return ctxSalasClinica;
    return obterSalasClinica(clinicaConfig);
  }, [ctxSalasClinica, clinicaConfig]);

  // Lista de pacientes aguardando vaga para troca rápida
  const pacientesAguardando = useMemo(() => {
    return listaCompletaEspera.filter(e => e.status === 'Aguardando');
  }, [listaCompletaEspera]);

  // Executa o motor de matching
  const oportunidades = useMemo(() => {
    if (!pacienteEspera) return [];
    return gerarOportunidadesEncaixe(
      pacienteEspera,
      profissionais,
      agendamentos,
      clinicaConfig,
      {
        diasJanela,
        duracaoMin,
        modalidade,
        filtroProfId,
        apenasSalasLivres,
        estritoDisponibilidadePaciente: estritoDisponibilidade
      }
    );
  }, [
    pacienteEspera,
    profissionais,
    agendamentos,
    clinicaConfig,
    diasJanela,
    duracaoMin,
    modalidade,
    filtroProfId,
    apenasSalasLivres,
    estritoDisponibilidade
  ]);

  if (!isOpen || !pacienteEspera) return null;

  const handleIniciarAgendamento = (op: EncaixeOportunidade) => {
    setOportunidadeSelecionada(op);
    setSalaEscolhida(op.salaSugerida || (op.salasLivres[0]?.nome || 'Consultório 01'));
  };

  const handleConfirmarAgendamento = async () => {
    if (!oportunidadeSelecionada || !pacienteEspera) return;
    setSalvando(true);

    try {
      // 1. Verificar se o paciente já existe na tabela `pacientes` pelo nome ou telefone
      let pacId: number | null = null;
      const { data: pacExistente } = await supabase
        .from('pacientes')
        .select('id, nome')
        .ilike('nome', pacienteEspera.nome.trim())
        .maybeSingle();

      if (pacExistente) {
        pacId = pacExistente.id;
      } else {
        // Cria automaticamente o cadastro do paciente a partir da lista de espera
        const { data: novoPac, error: errNovoPac } = await supabase
          .from('pacientes')
          .insert([{
            nome: pacienteEspera.nome,
            tel: pacienteEspera.tel,
            email: pacienteEspera.email || null,
            plano: pacienteEspera.plano || 'Particular',
            carteirinha: pacienteEspera.carteirinha || null,
            status: 'Ativo',
            obs: `Originado da Lista de Espera em ${new Date().toLocaleDateString('pt-BR')}. ${pacienteEspera.obs || ''}`
          }])
          .select('id')
          .single();

        if (!errNovoPac && novoPac) {
          pacId = novoPac.id;
        }
      }

      // 2. Criar agendamento formal
      const payloadAgendamento: Partial<Agendamento> = {
        profId: oportunidadeSelecionada.profissionalId,
        pacId: pacId,
        paciente: pacienteEspera.nome,
        plano: pacienteEspera.plano || 'Particular',
        planoId: 5,
        hora: oportunidadeSelecionada.horaInicio,
        horaFim: oportunidadeSelecionada.horaFim,
        durMin: oportunidadeSelecionada.duracaoMin,
        dataISO: oportunidadeSelecionada.dataISO,
        status: 'agendado',
        obs: `Agendado via Encaixe Inteligente da Lista de Espera. ${pacienteEspera.obs || ''}`,
        modalidade: modalidade,
        carteirinha: pacienteEspera.carteirinha || undefined,
        sala: modalidade === 'presencial' ? salaEscolhida : undefined,
        tipo: 'sessao'
      };

      const { data: apptCriado, error: errAppt } = await supabase
        .from('agendamentos')
        .insert([mappers.apptToDb(payloadAgendamento)])
        .select('id')
        .single();

      if (errAppt) throw errAppt;

      // 3. Atualizar registro na lista de espera para 'Convertido'
      const agoraISO = new Date().toISOString();
      await supabase
        .from('lista_espera')
        .update({
          status: 'Convertido',
          convertido_em: agoraISO,
          convertido_agendamento_id: apptCriado?.id || null,
          convertido_por: 'Recepção (Painel de Disponibilidade)'
        })
        .eq('id', pacienteEspera.id);

      // 4. Montar mensagem pronta para WhatsApp
      const cleanPhone = (pacienteEspera.tel || '').replace(/\D/g, '');
      const salaTexto = modalidade === 'presencial' && salaEscolhida ? `\n📍 *Local/Sala:* ${salaEscolhida}` : '';
      const textoMensagem = encodeURIComponent(
        `Olá, *${pacienteEspera.nome}*! Tudo bem?\n\n` +
        `Temos uma ótima notícia! Conseguimos um horário disponível para o seu atendimento com a nossa equipe no *ClinicFlow*:\n\n` +
        `📅 *Data:* ${oportunidadeSelecionada.dataFormatada} (${oportunidadeSelecionada.diaSemana})\n` +
        `⏰ *Horário:* ${oportunidadeSelecionada.horaInicio} às ${oportunidadeSelecionada.horaFim}\n` +
        `👩‍⚕️ *Profissional:* ${oportunidadeSelecionada.profissionalNome} (${oportunidadeSelecionada.especialidade})\n` +
        `🩺 *Modalidade:* ${modalidade === 'presencial' ? 'Presencial' : 'Online'}${salaTexto}\n\n` +
        `Por gentileza, responda esta mensagem para confirmar sua presença! ✨`
      );

      const urlWpp = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${textoMensagem}` : '';
      setWhatsAppUrl(urlWpp);

      await onAgendamentoSucesso();
      setSucessoModal(true);
    } catch (err: any) {
      console.error('Erro ao agendar via lista de espera:', err);
      alert(`Falha ao concluir agendamento: ${err.message || 'Erro inesperado'}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0b0d14] border border-white/[0.08] w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        
        {/* Top Header com o Stepper Visual de 6 Passos */}
        <div className="p-4 sm:px-6 bg-[#10131d] border-b border-white/[0.06] flex flex-col gap-3 shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  Painel de Disponibilidade & Encaixe da Lista de Espera
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Recepção Inteligente
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Cruzamento automático de compatibilidade, horários vagos e salas livres da clínica
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper horizontal das 6 etapas */}
          <div className="grid grid-cols-6 gap-1 bg-[#090b10] p-1 rounded-xl border border-white/[0.04] text-[10px] font-semibold text-center overflow-x-auto">
            <div className="py-1.5 px-2 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[9px] font-bold">1</span>
              <span className="truncate">Lista Espera</span>
            </div>
            <div className="py-1.5 px-2 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500/40 text-white flex items-center justify-center text-[9px] font-bold">2</span>
              <span className="truncate">Compatibilidade</span>
            </div>
            <div className="py-1.5 px-2 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500/40 text-white flex items-center justify-center text-[9px] font-bold">3</span>
              <span className="truncate">Horário Livre</span>
            </div>
            <div className="py-1.5 px-2 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500/40 text-white flex items-center justify-center text-[9px] font-bold">4</span>
              <span className="truncate">Sala Livre</span>
            </div>
            <div className="py-1.5 px-2 rounded-lg bg-indigo-600/20 text-indigo-300 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500/40 text-white flex items-center justify-center text-[9px] font-bold">5</span>
              <span className="truncate">Profissional</span>
            </div>
            <div className="py-1.5 px-2 rounded-lg bg-emerald-600/20 text-emerald-300 flex items-center justify-center gap-1">
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-bold">6</span>
              <span className="truncate">Agendamento</span>
            </div>
          </div>
        </div>

        {/* Corpo Principal (Dividido em Sidebar do Paciente + Grade de Oportunidades) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Coluna Esquerda: Dados do Paciente e Filtros */}
          <div className="w-full md:w-80 bg-[#0d1017] border-b md:border-b-0 md:border-r border-white/[0.06] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar shrink-0">
            
            {/* Seletor rápido de paciente */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Paciente Selecionado
              </label>
              <select
                value={pacienteEspera.id}
                onChange={(e) => {
                  const p = listaCompletaEspera.find(x => x.id === Number(e.target.value));
                  if (p) onSelectOutroPaciente(p);
                }}
                className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {pacientesAguardando.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — {p.especialidade || 'Geral'}
                  </option>
                ))}
              </select>
            </div>

            {/* Card com os requisitos do paciente */}
            <div className="p-3 rounded-xl bg-[#121622] border border-white/[0.06] space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="font-bold text-white text-sm">{pacienteEspera.nome}</span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {pacienteEspera.status}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Especialidades:</span>
                  <span className="font-bold text-indigo-300 text-right max-w-[140px] truncate" title={pacienteEspera.especialidade}>
                    {pacienteEspera.especialidade || 'Geral'}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Plano:</span>
                  <span className="font-bold text-slate-200">{pacienteEspera.plano || 'Particular'}</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Telefone:</span>
                  <span className="font-mono text-slate-300">{pacienteEspera.tel || '—'}</span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Faixa Etária / Idade:</span>
                  <span className="font-bold text-amber-300 text-right">
                    {pacienteEspera.idade || (pacienteEspera.nasc ? `${extrairIdadeNumerica(undefined, pacienteEspera.nasc)} anos` : 'Não informada')}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Dias Solicitados:</span>
                  <span className="font-bold text-slate-200 text-right">
                    {pacienteEspera.dias && pacienteEspera.dias.length > 0 ? pacienteEspera.dias.join(', ') : 'Qualquer dia'}
                  </span>
                </div>

                <div className="flex justify-between text-slate-400">
                  <span>Turnos / Horários:</span>
                  <span className="font-bold text-slate-200 text-right max-w-[140px] truncate" title={pacienteEspera.periodos?.join(', ') || pacienteEspera.periodo}>
                    {pacienteEspera.periodos && pacienteEspera.periodos.length > 0 ? pacienteEspera.periodos.join(', ') : (pacienteEspera.periodo || 'Ambos')}
                  </span>
                </div>

                {pacienteEspera.obs && (
                  <div className="pt-1.5 border-t border-white/[0.04] text-[10px] text-slate-400 italic">
                    "{pacienteEspera.obs}"
                  </div>
                )}
              </div>
            </div>

            {/* Filtros da Busca */}
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                <SlidersHorizontal size={11} /> Ajustes de Varredura
              </span>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Janela de Busca</label>
                <div className="grid grid-cols-3 gap-1">
                  {[7, 14, 30].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDiasJanela(d)}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        diasJanela === d
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#141824] text-slate-400 hover:text-white border border-white/[0.04]'
                      }`}
                    >
                      {d} dias
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Duração da Sessão</label>
                <div className="grid grid-cols-3 gap-1">
                  {[30, 45, 60].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDuracaoMin(m)}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        duracaoMin === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#141824] text-slate-400 hover:text-white border border-white/[0.04]'
                      }`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Modalidade</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setModalidade('presencial')}
                    className={`py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      modalidade === 'presencial'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#141824] text-slate-400 hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    <DoorOpen size={12} /> Presencial
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalidade('online')}
                    className={`py-1 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      modalidade === 'online'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#141824] text-slate-400 hover:text-white border border-white/[0.04]'
                    }`}
                  >
                    <Video size={12} /> Online
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Filtrar Profissional</label>
                <select
                  value={filtroProfId}
                  onChange={(e) => setFiltroProfId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">Todos os compatíveis</option>
                  {profissionais.filter(p => p.status === 'Ativo').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nomeAgenda || p.nome} ({p.esp})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 space-y-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={estritoDisponibilidade}
                    onChange={(e) => setEstritoDisponibilidade(e.target.checked)}
                    className="rounded border-white/10 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Apenas dias & horários solicitados</span>
                </label>

                {modalidade === 'presencial' && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={apenasSalasLivres}
                      onChange={(e) => setApenasSalasLivres(e.target.checked)}
                      className="rounded border-white/10 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Apenas horários com Sala Livre</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Oportunidades de Encaixe Encontradas */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Vagas e Horários Encontrados
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {oportunidades.length} oportunidade(s)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ordenado por maior pontuação de compatibilidade e proximidade de data
                </p>
              </div>
            </div>

            {oportunidades.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/[0.08] rounded-2xl">
                <AlertCircle size={36} className="text-slate-500 mb-3" />
                <h4 className="text-sm font-bold text-slate-300 mb-1">Nenhuma vaga livre encontrada no período</h4>
                <p className="text-xs text-slate-500 max-w-md">
                  Experimente aumentar a janela de busca para 30 dias, ajustar a duração da sessão ou desmarcar a exigência de salas livres.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {oportunidades.map((op, idx) => {
                  const isTopMatch = op.scoreMatch >= 90;
                  const isGoodMatch = op.scoreMatch >= 75;

                  return (
                    <div
                      key={`${op.profissionalId}-${op.dataISO}-${op.horaInicio}-${idx}`}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 relative ${
                        isTopMatch
                          ? 'bg-[#121727] border-indigo-500/40 hover:border-indigo-400 shadow-lg shadow-indigo-500/5'
                          : 'bg-[#11141e] border-white/[0.06] hover:border-white/[0.12]'
                      }`}
                    >
                      {/* Badge de Score de Compatibilidade */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-md"
                            style={{ backgroundColor: op.cor }}
                          >
                            {op.profissionalFoto ? (
                              <img src={op.profissionalFoto} alt={op.profissionalNome} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              op.profissionalNome.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{op.profissionalNome}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{op.especialidade}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isTopMatch
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : isGoodMatch
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {op.scoreMatch}% Match
                        </span>
                      </div>

                      {/* Informações de Data, Horário e Consultório */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#0b0d14] border border-white/[0.04] text-[11px]">
                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Data & Dia</span>
                          <span className="font-bold text-slate-200">{op.dataFormatada}</span>
                          <span className="text-indigo-400 block text-[10px] font-semibold">{op.diaSemana}</span>
                        </div>

                        <div>
                          <span className="text-slate-500 block text-[9px] uppercase font-bold">Horário Livre</span>
                          <span className="font-bold text-emerald-400 font-mono text-xs">{op.horaInicio} às {op.horaFim}</span>
                          <span className="text-slate-400 block text-[10px]">{op.duracaoMin} min</span>
                        </div>
                      </div>

                      {/* Sala Física da Clínica (ou Tag Online) */}
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        {modalidade === 'presencial' ? (
                          <div className="flex items-center gap-1.5">
                            <DoorOpen size={13} className="text-emerald-400" />
                            <span className="text-slate-400">Sala Disponível:</span>
                            <span className="font-bold text-emerald-300">
                              {op.salaSugerida || (op.salasLivres[0]?.nome || 'Consultório')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-blue-400">
                            <Video size={13} />
                            <span className="font-bold">Teleconsulta / Online</span>
                          </div>
                        )}

                        <span className="text-[10px] text-slate-500">
                          {op.salasLivres.length > 1 ? `+${op.salasLivres.length - 1} salas livres` : ''}
                        </span>
                      </div>

                      {/* Motivos do Match (Pills) */}
                      <div className="flex flex-wrap gap-1">
                        {op.motivosMatch.slice(0, 3).map((m, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 text-[9px]">
                            ✓ {m}
                          </span>
                        ))}
                      </div>

                      {/* Ação de Agendamento */}
                      <button
                        type="button"
                        onClick={() => handleIniciarAgendamento(op)}
                        className="w-full mt-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>⚡ Agendar este Horário</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal de Confirmação Final do Agendamento */}
        {oportunidadeSelecionada && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#10131e] border border-white/[0.1] w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up">
              <div className="flex justify-between items-center border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    6
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Confirmar Agendamento</h3>
                    <p className="text-[10px] text-slate-400">Etapa final: converter da lista de espera para a agenda</p>
                  </div>
                </div>
                <button
                  onClick={() => setOportunidadeSelecionada(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              </div>

              {/* Resumo do Encaixe */}
              <div className="p-3.5 rounded-xl bg-[#0b0d14] border border-white/[0.06] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Paciente:</span>
                  <span className="font-bold text-white">{pacienteEspera.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profissional:</span>
                  <span className="font-bold text-indigo-300">
                    {oportunidadeSelecionada.profissionalNome} ({oportunidadeSelecionada.especialidade})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Data & Horário:</span>
                  <span className="font-bold text-emerald-400">
                    {oportunidadeSelecionada.dataFormatada} ({oportunidadeSelecionada.diaSemana}) às {oportunidadeSelecionada.horaInicio}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Plano / Convênio:</span>
                  <span className="font-bold text-slate-200">{pacienteEspera.plano || 'Particular'}</span>
                </div>

                {/* Seletor de Sala Física da Clínica */}
                {modalidade === 'presencial' && (
                  <div className="pt-2 border-t border-white/[0.04] space-y-1">
                    <label className="block text-slate-400 font-semibold text-[11px]">
                      Consultório / Sala da Clínica:
                    </label>
                    <select
                      value={salaEscolhida}
                      onChange={(e) => setSalaEscolhida(e.target.value)}
                      className="w-full bg-[#141824] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {oportunidadeSelecionada.salasLivres.map(s => (
                        <option key={s.id} value={s.nome}>
                          🟢 {s.nome}
                        </option>
                      ))}
                      {oportunidadeSelecionada.salasLivres.length === 0 && (
                        <option value="Consultório Geral">Consultório Geral</option>
                      )}
                    </select>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => setOportunidadeSelecionada(null)}
                  className="px-4 py-2 rounded-xl border border-white/[0.08] text-slate-300 font-bold hover:bg-white/[0.04] transition-all cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={handleConfirmarAgendamento}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-lg shadow-emerald-500/20 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {salvando ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Agendando...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirmar e Agendar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Sucesso com Botão do WhatsApp */}
        {sucessoModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <div className="bg-[#10131e] border border-emerald-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-center animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={28} />
              </div>

              <h3 className="text-base font-bold text-white">Agendamento Realizado com Sucesso!</h3>
              <p className="text-xs text-slate-300">
                O paciente foi agendado na grade da clínica e marcado como <strong className="text-emerald-400">Convertido</strong> na lista de espera.
              </p>

              {whatsAppUrl && (
                <div className="pt-2">
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
                  >
                    <Send size={14} />
                    <span>Enviar Confirmação no WhatsApp</span>
                  </a>
                </div>
              )}

              <div className="pt-3 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => {
                    setSucessoModal(false);
                    setOportunidadeSelecionada(null);
                    onClose();
                  }}
                  className="w-full py-2 rounded-xl bg-[#141824] hover:bg-[#1a2030] text-slate-300 font-bold text-xs border border-white/[0.08] transition-all cursor-pointer"
                >
                  Fechar Painel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
