import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Clock, User, Calendar, Bell, ChevronRight, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { Paciente, Agendamento } from '../types';

interface Mensagem {
  id: number;
  conversa_id: number;
  tipo_remetente: 'clinica' | 'paciente' | 'sistema';
  conteudo: string;
  lida: boolean;
  enviada_em: string;
}

export const ChatPage: React.FC = () => {
  const { pacientes, agendamentos, profissionais } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPac, setSelectedPac] = useState<Paciente | null>(null);
  
  // Chat States
  const [conversaId, setConversaId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [connStatus, setConnStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  
  // Notification form states
  const [notifTipo, setNotifTipo] = useState<'lembrete' | 'confirmar' | 'resultado' | 'outros'>('confirmar');
  const [notifQuando, setNotifQuando] = useState<'Agora' | 'Amanha8h' | 'Amanha9h'>('Agora');
  const [notifMsg, setNotifMsg] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Filter patients
  const todayStr = new Date().toISOString().split('T')[0];
  const getProxConsulta = (nome: string) => {
    const pAppts = agendamentos.filter(a => a.paciente.toLowerCase().trim() === nome.toLowerCase().trim() && a.dataISO >= todayStr && a.status !== 'cancelado' && a.status !== 'desmarcado');
    pAppts.sort((a, b) => a.dataISO.localeCompare(b.dataISO) || a.hora.localeCompare(b.hora));
    return pAppts[0] || null;
  };

  const filteredPacientes = pacientes
    .filter(p => p.status === 'Ativo' && p.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    .map(p => ({
      ...p,
      prox: getProxConsulta(p.nome)
    }))
    .sort((a, b) => {
      if (a.prox && !b.prox) return -1;
      if (!a.prox && b.prox) return 1;
      return a.nome.localeCompare(b.nome);
    });

  // Load patient meta (conversation id) and messages
  useEffect(() => {
    if (!selectedPac) {
      setConversaId(null);
      setMessages([]);
      return;
    }

    const loadConversation = async () => {
      setLoadingChat(true);
      setConnStatus('CONNECTING');
      try {
        // Find or create conversa
        let { data: conversa, error: convErr } = await supabase
          .from('conversas')
          .select('id')
          .eq('paciente_id', selectedPac.id)
          .eq('status', 'ativa')
          .maybeSingle();

        if (convErr) throw convErr;

        let activeConvId = conversa?.id;

        if (!activeConvId) {
          const { data: newConv, error: insertErr } = await supabase
            .from('conversas')
            .insert([{ paciente_id: selectedPac.id, status: 'ativa' }])
            .select('id')
            .single();
          if (insertErr) throw insertErr;
          activeConvId = newConv.id;
        }

        setConversaId(activeConvId);

        // Fetch messages
        const { data: msgs, error: msgsErr } = await supabase
          .from('mensagens')
          .select('*')
          .eq('conversa_id', activeConvId)
          .order('enviada_em', { ascending: true });

        if (msgsErr) throw msgsErr;
        setMessages(msgs || []);
        setConnStatus('CONNECTED');
      } catch (err) {
        console.error('[ClinicFlow Chat] Error loading conversa/msgs:', err);
        setConnStatus('DISCONNECTED');
      } finally {
        setLoadingChat(false);
      }
    };

    loadConversation();
  }, [selectedPac]);

  // Realtime subscription
  useEffect(() => {
    if (!conversaId) return;

    const channel = supabase
      .channel(`chat-room-${conversaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` },
        (payload) => {
          const newMsg = payload.new as Mensagem;
          setMessages((prev) => {
            // Avoid duplicate additions
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('CONNECTED');
        } else {
          setConnStatus('CONNECTING');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversaId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-generate notification text based on patient/appointment info
  useEffect(() => {
    if (!selectedPac) return;
    const prox = getProxConsulta(selectedPac.nome);
    const primNome = selectedPac.nome.split(' ')[0];
    const dataFmt = prox ? prox.dataISO.split('-').reverse().join('/') : '';
    const profNome = prox ? profissionais.find(p => p.id === prox.profId)?.nomeAgenda || 'Profissional' : '';

    if (notifTipo === 'lembrete') {
      setNotifMsg(`Olá ${primNome}! Lembrete de consulta com ${profNome} no dia ${dataFmt} às ${prox?.hora || ''}h. Qualquer dúvida estamos à disposição!`);
    } else if (notifTipo === 'confirmar') {
      setNotifMsg(`Olá ${primNome}! Passando para confirmar sua presença na consulta com ${profNome} amanhã, dia ${dataFmt}, às ${prox?.hora || ''}h. Confirma?`);
    } else if (notifTipo === 'resultado') {
      setNotifMsg(`Olá ${primNome}! O resultado do seu exame/avaliação na ${profNome} já está pronto e disponível no portal.`);
    } else {
      setNotifMsg(`Olá ${primNome}! `);
    }
  }, [selectedPac, notifTipo]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !conversaId) return;

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase.from('mensagens').insert([
        {
          conversa_id: conversaId,
          tipo_remetente: 'clinica',
          conteudo: textToSend,
          lida: false
        }
      ]);
      if (error) throw error;

      // Update last message timestamp
      await supabase
        .from('conversas')
        .update({ ultima_mensagem_em: new Date().toISOString() })
        .eq('id', conversaId);

    } catch (err: any) {
      console.error('[ClinicFlow Chat] Error sending msg:', err);
      alert('Erro ao enviar mensagem: ' + err.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPac || !notifMsg.trim()) return;

    setSendingNotif(true);
    try {
      // Calculate schedule date
      let agendadaPara = new Date();
      if (notifQuando === 'Amanha8h') {
        agendadaPara.setDate(agendadaPara.getDate() + 1);
        agendadaPara.setHours(8, 0, 0, 0);
      } else if (notifQuando === 'Amanha9h') {
        agendadaPara.setDate(agendadaPara.getDate() + 1);
        agendadaPara.setHours(9, 0, 0, 0);
      }

      const isAgora = notifQuando === 'Agora';

      // 1. Insert into notifications queue
      const { error: notifErr } = await supabase.from('notificacoes').insert([
        {
          paciente_id: selectedPac.id,
          titulo: notifTipo === 'lembrete' ? 'Lembrete de Consulta' : notifTipo === 'confirmar' ? 'Confirmação' : notifTipo === 'resultado' ? 'Resultado Disponível' : 'Notificação da Clínica',
          corpo: notifMsg.trim(),
          tipo: notifTipo,
          enviada: isAgora,
          agendada_para: agendadaPara.toISOString()
        }
      ]);

      if (notifErr) throw notifErr;

      // 2. If it's instantaneous, insert system message into active chat
      if (isAgora && conversaId) {
        const { error: msgErr } = await supabase.from('mensagens').insert([
          {
            conversa_id: conversaId,
            tipo_remetente: 'sistema',
            conteudo: `🔔 ${notifMsg.trim()}`,
            lida: false
          }
        ]);
        if (msgErr) throw msgErr;
      }

      alert(isAgora ? 'Notificação enviada com sucesso!' : 'Notificação agendada com sucesso!');
    } catch (err: any) {
      console.error('[ClinicFlow Chat] Error sending notif:', err);
      alert('Erro ao processar notificação: ' + err.message);
    } finally {
      setSendingNotif(false);
    }
  };

  // Helper BRL / details
  const getProfName = (id: number) => {
    return profissionais.find(p => p.id === id)?.nome || 'Profissional';
  };

  const pacAppts = selectedPac
    ? agendamentos
        .filter(a => a.paciente.toLowerCase().trim() === selectedPac.nome.toLowerCase().trim())
        .sort((a, b) => b.dataISO.localeCompare(a.dataISO) || b.hora.localeCompare(a.hora))
        .slice(0, 5)
    : [];

  return (
    <div className="flex h-[calc(100vh-130px)] bg-[#0c0e16]/60 backdrop-blur-xl border border-white/[0.04] rounded-2xl overflow-hidden shadow-2xl text-xs">
      
      {/* ── LEFT COLUMN: PATIENT LIST ── */}
      <div className="w-72 border-r border-white/[0.04] flex flex-col bg-[#0f111a]/80 shrink-0">
        <div className="p-4 border-b border-white/[0.04]">
          <h3 className="font-black text-sm tracking-wide text-white mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-400" />
            Chat com Pacientes
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente ativo..."
              className="w-full bg-[#161a26] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2 text-white text-xs focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02] scrollbar-thin">
          {filteredPacientes.map((p) => {
            const active = selectedPac?.id === p.id;
            const initials = p.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPac(p)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
                  active ? 'bg-indigo-500/10 border-l-4 border-indigo-500' : 'hover:bg-white/[0.01]'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-200 truncate">{p.nome}</div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5 font-semibold">
                    {p.prox 
                      ? `Próx: ${p.prox.dataISO.split('-').reverse().join('/')} ${p.prox.hora}` 
                      : 'Sem consulta agendada'}
                  </div>
                </div>
                {p.prox && (
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 px-1.5 py-0.5 rounded-full font-bold uppercase">
                    Agendado
                  </span>
                )}
              </button>
            );
          })}
          {filteredPacientes.length === 0 && (
            <div className="p-8 text-center text-slate-600 font-semibold">
              Nenhum paciente ativo encontrado.
            </div>
          )}
        </div>
      </div>

      {/* ── MIDDLE COLUMN: MESSAGES ── */}
      <div className="flex-1 flex flex-col bg-[#07090e]/40 overflow-hidden relative">
        {selectedPac ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-white/[0.04] bg-[#0c0e16]/40 flex justify-between items-center shrink-0">
              <div>
                <h4 className="font-bold text-slate-200 text-sm">{selectedPac.nome}</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">CPF: <span className="font-mono">{selectedPac.cpf || '—'}</span> | Plano: {selectedPac.plano}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[#131622] border border-white/[0.06] px-2.5 py-1 rounded-full">
                <span className={`w-2 h-2 rounded-full ${
                  connStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                  connStatus === 'CONNECTING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                  {connStatus === 'CONNECTED' ? 'Realtime Conectado' : connStatus === 'CONNECTING' ? 'Conectando...' : 'Desconectado'}
                </span>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
              {loadingChat ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-1">
                  <MessageSquare size={32} className="opacity-20" />
                  <p className="font-semibold">Nenhuma mensagem nesta conversa.</p>
                  <p className="text-[10px] text-slate-500">Envie uma mensagem abaixo para iniciar.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isClinic = m.tipo_remetente === 'clinica';
                  const isSys = m.tipo_remetente === 'sistema';
                  const time = new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  
                  if (isSys) {
                    return (
                      <div key={m.id} className="max-w-[85%] bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3 text-amber-400 self-start space-y-1">
                        <span className="text-[8px] font-black uppercase tracking-wider block">🔔 Lembrete de Sistema</span>
                        <p className="text-slate-300 leading-relaxed text-xs">{m.conteudo.replace(/^🔔\s*/, '')}</p>
                        <span className="text-[8px] text-slate-500 font-mono block text-right">{time}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs flex flex-col ${
                        isClinic
                          ? 'bg-indigo-500 text-white rounded-br-none ml-auto'
                          : 'bg-[#161a26] border border-white/[0.04] text-slate-200 rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>
                      <span className={`text-[8px] font-mono mt-1 text-right ${
                        isClinic ? 'text-white/60' : 'text-slate-500'
                      }`}>
                        {time}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Row */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.04] bg-[#0c0e16]/40 flex gap-3 shrink-0">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem (Pressione Enter para enviar)..."
                rows={1}
                className="flex-1 bg-[#161a26] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50 resize-none max-h-24 leading-normal scrollbar-thin"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.01] border border-white/[0.04] flex items-center justify-center text-slate-500 shadow-inner">
              <MessageSquare size={22} className="opacity-40 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-300">Nenhuma Conversa Selecionada</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                Selecione um paciente na lista à esquerda para conversar e enviar lembretes em tempo real.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN: INFO & REMINDERS ── */}
      <div className="w-72 border-l border-white/[0.04] flex flex-col bg-[#0f111a]/80 shrink-0 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
        {selectedPac ? (
          <>
            {/* Patient Info Appts */}
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-[10px] text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                Histórico de Consultas
              </h4>
              <div className="space-y-2">
                {pacAppts.map((appt) => {
                  const time = appt.dataISO.split('-').reverse().join('/');
                  return (
                    <div key={appt.id} className="p-2.5 bg-[#161a26]/60 border border-white/[0.03] rounded-xl flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-300 font-mono text-[10px]">{time} • {appt.hora}</div>
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">{getProfName(appt.profId)}</div>
                        <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.25 rounded-full mt-1.5 border ${
                          appt.status === 'atendido' ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' :
                          appt.status === 'confirmado' ? 'bg-blue-500/10 border-blue-500/15 text-blue-400' :
                          appt.status === 'cancelado' || appt.status === 'desmarcado' ? 'bg-rose-500/10 border-rose-500/15 text-rose-400' :
                          'bg-indigo-500/10 border-indigo-500/15 text-indigo-400'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {pacAppts.length === 0 && (
                  <p className="text-slate-500 italic text-[10px]">Nenhum agendamento encontrado.</p>
                )}
              </div>
            </div>

            {/* Send Reminders Panel */}
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-[10px] text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                <Bell size={12} />
                Lembretes & Avisos
              </h4>
              <form onSubmit={handleSendNotification} className="space-y-3.5">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tipo de Aviso</label>
                  <select
                    value={notifTipo}
                    onChange={(e) => setNotifTipo(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="confirmar">Confirmação de Consulta</option>
                    <option value="lembrete">Lembrete de Horário</option>
                    <option value="resultado">Aviso de Resultado</option>
                    <option value="outros">Mensagem Customizada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Envio / Agendamento</label>
                  <select
                    value={notifQuando}
                    onChange={(e) => setNotifQuando(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                  >
                    <option value="Agora">Enviar agora (Instantâneo)</option>
                    <option value="Amanha8h">Amanhã às 08:00h</option>
                    <option value="Amanha9h">Amanhã às 09:00h</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Corpo da Mensagem</label>
                  <textarea
                    value={notifMsg}
                    onChange={(e) => setNotifMsg(e.target.value)}
                    rows={6}
                    required
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-2.5 py-2 text-white text-xs resize-none focus:outline-none font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="w-full py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/10 active:scale-95 transition-all disabled:opacity-45"
                >
                  <Send size={11} />
                  {sendingNotif ? 'Enviando...' : notifQuando === 'Agora' ? 'Enviar Notificação' : 'Agendar Notificação'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8 text-center gap-2">
            <AlertCircle size={28} className="opacity-20" />
            <p className="font-semibold text-[10px]">Informações indisponíveis.</p>
          </div>
        )}
      </div>

    </div>
  );
};
