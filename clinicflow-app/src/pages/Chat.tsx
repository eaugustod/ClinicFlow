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
  const [connStatus, setConnStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('CONNECTED');
  
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

  // Fetch messages helper function
  const fetchMessages = async (cId: number, silent = false) => {
    if (!silent) setLoadingChat(true);
    try {
      const { data: msgs, error: msgsErr } = await supabase
        .from('mensagens')
        .select('*')
        .eq('conversa_id', Number(cId))
        .order('enviada_em', { ascending: true });

      if (msgsErr) {
        console.error('[ClinicFlow Chat] Error fetching msgs:', msgsErr);
        if (!silent) setConnStatus('DISCONNECTED');
        return;
      }

      setMessages(msgs || []);
      setConnStatus('CONNECTED');

      // Auto-mark patient messages as read in background without breaking connStatus
      supabase
        .from('mensagens')
        .update({ lida: true })
        .eq('conversa_id', Number(cId))
        .eq('tipo_remetente', 'paciente')
        .eq('lida', false)
        .then(() => {});

    } catch (err) {
      console.error('[ClinicFlow Chat] Exception fetching msgs:', err);
      if (!silent) setConnStatus('DISCONNECTED');
    } finally {
      if (!silent) setLoadingChat(false);
    }
  };

  // Load patient meta (conversation id) and initial messages
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
        const pId = Number(selectedPac.id);
        
        // Select existing primary conversation (avoiding maybeSingle duplicate errors)
        let { data: convList, error: convErr } = await supabase
          .from('conversas')
          .select('id')
          .eq('paciente_id', pId)
          .order('id', { ascending: true })
          .limit(1);

        if (convErr) {
          console.error('[ClinicFlow Chat] Error selecting conversa:', convErr);
          if ((convErr as any).status === 403 || convErr.code === '42501' || String(convErr.message).includes('403')) {
            alert('Aviso de Permissão (Erro 403 Forbidden): A tabela "conversas" no banco Supabase precisa das permissões RLS. Execute o script "fix_chat_rls_policies.sql" no Supabase SQL Editor.');
          }
        }

        let activeConvId = convList && convList.length > 0 ? convList[0].id : null;

        if (!activeConvId) {
          const { data: newConv, error: insertErr } = await supabase
            .from('conversas')
            .upsert([{ paciente_id: pId, status: 'ativa' }], { onConflict: 'paciente_id' })
            .select('id')
            .single();

          if (insertErr) {
            console.error('[ClinicFlow Chat] Error inserting conversa:', insertErr);
          }
          activeConvId = newConv?.id;
        }

        if (activeConvId) {
          setConversaId(activeConvId);
          setConnStatus('CONNECTED');
          await fetchMessages(activeConvId, false);
        } else {
          setConnStatus('DISCONNECTED');
          setLoadingChat(false);
        }
      } catch (err) {
        console.error('[ClinicFlow Chat] Error loading conversa:', err);
        setConnStatus('DISCONNECTED');
        setLoadingChat(false);
      }
    };

    loadConversation();
  }, [selectedPac]);

  // Realtime subscription + Polling Fallback (3s) for 100% sync reliability
  useEffect(() => {
    if (!conversaId) return;

    // 1. WebSocket Realtime Channel
    const channel = supabase
      .channel(`chat-room-${conversaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `conversa_id=eq.${conversaId}` },
        (payload) => {
          const newMsg = payload.new as Mensagem;
          setMessages((prev) => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setConnStatus('CONNECTED');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('CONNECTED');
        }
      });

    // 2. Polling fallback every 3 seconds
    const pollInterval = setInterval(() => {
      fetchMessages(conversaId, true);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
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
    const profNome = prox ? profissionais.find(p => p.id === prox.profId)?.nome || 'Profissional' : 'Profissional';
    const dataFmt = prox ? prox.dataISO.split('-').reverse().join('/') : '';

    if (notifTipo === 'confirmar') {
      setNotifMsg(`Olá ${primNome}! Passando para confirmar sua presença na consulta com ${profNome} amanhã, dia ${dataFmt}, às ${prox?.hora || ''}h. Confirma?`);
    } else if (notifTipo === 'lembrete') {
      setNotifMsg(`Lembrete: sua consulta na clínica está agendada para ${dataFmt} às ${prox?.hora || ''}h com ${profNome}.`);
    } else if (notifTipo === 'resultado') {
      setNotifMsg(`Olá ${primNome}! O resultado do seu exame/avaliação já está pronto e disponível no portal.`);
    } else {
      setNotifMsg(`Olá ${primNome}! `);
    }
  }, [selectedPac, notifTipo]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedPac) return;

    let targetConvId = conversaId;

    // Resolve conversation on-the-fly if needed
    if (!targetConvId) {
      const pId = Number(selectedPac.id);
      const { data: convList } = await supabase
        .from('conversas')
        .select('id')
        .eq('paciente_id', pId)
        .order('id', { ascending: true })
        .limit(1);

      if (convList && convList.length > 0) {
        targetConvId = convList[0].id;
        setConversaId(targetConvId);
      } else {
        const { data: newConv } = await supabase
          .from('conversas')
          .insert([{ paciente_id: pId, status: 'ativa' }])
          .select('id')
          .single();
        if (newConv?.id) {
          targetConvId = newConv.id;
          setConversaId(newConv.id);
        }
      }
    }

    if (!targetConvId) {
      alert('Não foi possível conectar com a conversa deste paciente. Tente novamente.');
      return;
    }

    const textToSend = inputText.trim();
    setInputText('');

    try {
      const { data: inserted, error } = await supabase
        .from('mensagens')
        .insert([
          {
            conversa_id: targetConvId,
            tipo_remetente: 'clinica',
            conteudo: textToSend,
            lida: false
          }
        ])
        .select('*')
        .single();

      if (error) throw error;

      if (inserted) {
        setMessages((prev) => {
          if (prev.some(m => m.id === inserted.id)) return prev;
          return [...prev, inserted];
        });
      }

      // Update last message timestamp
      await supabase
        .from('conversas')
        .update({ ultima_mensagem_em: new Date().toISOString() })
        .eq('id', targetConvId);

      setConnStatus('CONNECTED');
    } catch (err: any) {
      console.error('[ClinicFlow Chat] Error sending msg:', err);
      alert('Erro ao enviar mensagem: ' + (err.message || err));
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

    let targetConvId = conversaId;
    if (!targetConvId) {
      const pId = Number(selectedPac.id);
      const { data: convList } = await supabase
        .from('conversas')
        .select('id')
        .eq('paciente_id', pId)
        .order('id', { ascending: true })
        .limit(1);
      if (convList && convList.length > 0) targetConvId = convList[0].id;
    }

    setSendingNotif(true);
    try {
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

      // 2. If instantaneous, insert system message into active chat
      if (isAgora && targetConvId) {
        const { data: newSysMsg, error: msgErr } = await supabase
          .from('mensagens')
          .insert([
            {
              conversa_id: targetConvId,
              tipo_remetente: 'sistema',
              conteudo: `🔔 ${notifMsg.trim()}`,
              lida: false
            }
          ])
          .select('*')
          .single();

        if (msgErr) throw msgErr;
        if (newSysMsg) {
          setMessages((prev) => [...prev, newSysMsg]);
        }
      }

      alert(isAgora ? 'Notificação enviada com sucesso ao paciente!' : 'Notificação agendada com sucesso!');
    } catch (err: any) {
      console.error('[ClinicFlow Chat] Error sending notif:', err);
      alert('Erro ao processar notificação: ' + err.message);
    } finally {
      setSendingNotif(false);
    }
  };

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
    <div className="flex h-[calc(100vh-140px)] min-h-0 bg-[var(--bg-surface)] backdrop-blur-xl border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl text-xs w-full">
      
      {/* ── LEFT COLUMN: PATIENT LIST ── */}
      <div className="w-72 h-full border-r border-[var(--border)] flex flex-col bg-[var(--sidebar-bg)] shrink-0 min-h-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--border)] shrink-0">
          <h3 className="font-black text-sm tracking-wide text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-[var(--accent)]" />
            Chat com Pacientes
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente ativo..."
              className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] scrollbar-thin">
          {filteredPacientes.map((p) => {
            const active = selectedPac?.id === p.id;
            const initials = p.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPac(p)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all cursor-pointer ${
                  active ? 'bg-[var(--accent-soft)] border-l-4 border-[var(--accent)]' : 'hover:bg-[var(--bg-raised)]/40'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] flex items-center justify-center font-bold text-[10px] shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--text-primary)] truncate">{p.nome}</div>
                  <div className="text-[9px] text-[var(--text-muted)] truncate mt-0.5 font-semibold">
                    {p.prox 
                      ? `Próx: ${p.prox.dataISO.split('-').reverse().join('/')} ${p.prox.hora}` 
                      : 'Sem consulta agendada'}
                  </div>
                </div>
                {p.prox && (
                  <span className="text-[8px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase">
                    Agendado
                  </span>
                )}
              </button>
            );
          })}
          {filteredPacientes.length === 0 && (
            <div className="p-8 text-center text-[var(--text-muted)] font-semibold">
              Nenhum paciente ativo encontrado.
            </div>
          )}
        </div>
      </div>

      {/* ── MIDDLE COLUMN: MESSAGES ── */}
      <div className="flex-1 h-full flex flex-col bg-[var(--bg-base)] min-h-0 overflow-hidden relative">
        {selectedPac ? (
          <div className="flex-1 h-full flex flex-col min-h-0 overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--header-bg)] flex justify-between items-center shrink-0">
              <div>
                <h4 className="font-bold text-[var(--text-primary)] text-sm">{selectedPac.nome}</h4>
                <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">CPF: <span className="font-mono">{selectedPac.cpf || '—'}</span> | Plano: {selectedPac.plano}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border)] px-3 py-1 rounded-full shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  connStatus === 'CONNECTED' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
                  connStatus === 'CONNECTING' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                }`} />
                <span className="text-[9px] text-[var(--text-primary)] font-bold uppercase tracking-wider">
                  {connStatus === 'CONNECTED' ? 'Conectado (Realtime & Cloud)' : connStatus === 'CONNECTING' ? 'Conectando...' : 'Desconectado'}
                </span>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-thin">
              {loadingChat ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
                  Carregando mensagens...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] gap-1">
                  <MessageSquare size={32} className="opacity-30" />
                  <p className="font-semibold text-[var(--text-primary)]">Nenhuma mensagem nesta conversa.</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">Envie uma mensagem abaixo ou um lembrete para conectar com o app do paciente.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isClinic = m.tipo_remetente === 'clinica';
                  const isSys = m.tipo_remetente === 'sistema';
                  const time = new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  
                  if (isSys) {
                    return (
                      <div key={m.id} className="max-w-[85%] bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-amber-600 dark:text-amber-400 self-start space-y-1 shadow-sm">
                        <span className="text-[8px] font-black uppercase tracking-wider block">🔔 Notificação de Sistema</span>
                        <p className="text-[var(--text-primary)] leading-relaxed text-xs">{m.conteudo.replace(/^🔔\s*/, '')}</p>
                        <span className="text-[8px] text-[var(--text-muted)] font-mono block text-right">{time}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs flex flex-col shadow-sm ${
                        isClinic
                          ? 'bg-[var(--accent)] text-white rounded-br-none ml-auto'
                          : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.conteudo}</p>
                      <span className={`text-[8px] font-mono mt-1 text-right ${
                        isClinic ? 'text-white/70' : 'text-[var(--text-muted)]'
                      }`}>
                        {time} {isClinic && (m.lida ? '✓✓' : '✓')}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Row */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface)] flex gap-3 shrink-0">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem (Pressione Enter para enviar)..."
                rows={1}
                className="flex-1 bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] text-xs focus:outline-none focus:border-[var(--accent)] resize-none max-h-24 leading-normal scrollbar-thin"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[var(--accent-glow)] transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shadow-sm">
              <MessageSquare size={22} className="opacity-40 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-bold text-[var(--text-primary)]">Nenhuma Conversa Selecionada</p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1 max-w-[240px] mx-auto leading-relaxed">
                Selecione um paciente na lista à esquerda para conversar e enviar notificações em tempo real para o app do paciente.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN: INFO & REMINDERS ── */}
      <div className="w-72 h-full border-l border-[var(--border)] flex flex-col bg-[var(--sidebar-bg)] shrink-0 min-h-0 overflow-hidden">
        {selectedPac ? (
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)] scrollbar-thin">
            {/* Patient Info Appts */}
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-1">
                <Calendar size={12} />
                Histórico de Consultas
              </h4>
              <div className="space-y-2">
                {pacAppts.map((appt) => {
                  const time = appt.dataISO.split('-').reverse().join('/');
                  return (
                    <div key={appt.id} className="p-2.5 bg-[var(--bg-raised)]/60 border border-[var(--border)] rounded-xl flex gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[var(--text-primary)] font-mono text-[10px]">{time} • {appt.hora}</div>
                        <div className="text-[9px] text-[var(--text-secondary)] truncate mt-0.5">{getProfName(appt.profId)}</div>
                        <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.25 rounded-full mt-1.5 border ${
                          appt.status === 'atendido' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                          appt.status === 'confirmado' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                          appt.status === 'cancelado' || appt.status === 'desmarcado' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' :
                          'bg-indigo-500/10 border-indigo-500/20 text-indigo-500'
                        }`}>
                          {appt.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {pacAppts.length === 0 && (
                  <p className="text-[var(--text-muted)] italic text-[10px]">Nenhum agendamento encontrado.</p>
                )}
              </div>
            </div>

            {/* Send Reminders Panel */}
            <div className="p-4 space-y-3">
              <h4 className="font-bold text-[10px] text-[var(--accent)] uppercase tracking-widest flex items-center gap-1">
                <Bell size={12} />
                Lembretes & Avisos
              </h4>
              <form onSubmit={handleSendNotification} className="space-y-3.5">
                <div>
                  <label className="block text-[var(--text-secondary)] font-semibold mb-1">Tipo de Aviso</label>
                  <select
                    value={notifTipo}
                    onChange={(e) => setNotifTipo(e.target.value as any)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] text-xs focus:outline-none"
                  >
                    <option value="confirmar">Confirmação de Consulta</option>
                    <option value="lembrete">Lembrete de Horário</option>
                    <option value="resultado">Aviso de Resultado</option>
                    <option value="outros">Mensagem Customizada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-semibold mb-1">Envio / Agendamento</label>
                  <select
                    value={notifQuando}
                    onChange={(e) => setNotifQuando(e.target.value as any)}
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text-primary)] text-xs focus:outline-none"
                  >
                    <option value="Agora">Enviar agora (Instantâneo)</option>
                    <option value="Amanha8h">Amanhã às 08:00h</option>
                    <option value="Amanha9h">Amanhã às 09:00h</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[var(--text-secondary)] font-semibold mb-1">Corpo da Mensagem</label>
                  <textarea
                    value={notifMsg}
                    onChange={(e) => setNotifMsg(e.target.value)}
                    rows={5}
                    required
                    className="w-full bg-[var(--bg-raised)] border border-[var(--border)] rounded-lg px-2.5 py-2 text-[var(--text-primary)] text-xs resize-none focus:outline-none font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[var(--accent-glow)] active:scale-95 transition-all disabled:opacity-45 cursor-pointer"
                >
                  <Send size={11} />
                  {sendingNotif ? 'Enviando...' : notifQuando === 'Agora' ? 'Enviar Notificação' : 'Agendar Notificação'}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center gap-2">
            <AlertCircle size={28} className="opacity-30" />
            <p className="font-semibold text-[10px]">Informações indisponíveis.</p>
          </div>
        )}
      </div>

    </div>
  );
};
