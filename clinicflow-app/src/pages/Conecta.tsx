import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Calculator, Users, Plus, Edit, Trash2, HelpCircle, Eye, Printer, CheckCircle, FileText, X, Building2, DollarSign } from 'lucide-react';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

interface ConectaProps {
  activeTab: string;
  onNavigate: (page: string) => void;
}

interface SalaConecta {
  id: string | number;
  nome: string;
  descricao: string;
  capacidade: number;
  cor: string;
  ativo?: boolean;
}

interface Locatario {
  id: string | number;
  nome: string;
  esp: string;
  tel: string;
  email: string;
  cpf: string;
  conselho: string;
  valorHora: number;
  valorMeio: number;
  valorDia: number;
  salaPref?: string | null;
  status: 'ativo' | 'inativo';
  obs: string;
}

interface ReservaSala {
  id: string | number;
  salaId: string | number;
  locId: string | number;
  data: string;
  horaIni: string;
  horaFim: string;
  durMin: number;
  status: 'confirmado' | 'cancelado';
  obs: string;
  recorrencia: 'unica' | 'semanal' | 'quinzenal';
  serieId?: string | null;
  valorCobrado?: number | null;
}

interface FechamentoConecta {
  id?: string | number;
  competencia: string;
  locatarioId: string | number;
  totalReservas: number;
  totalHoras: number;
  totalValor: number;
  status?: string;
  emitidoEm?: string;
  detalhes?: any;
  dataConfirmacao?: string;
}

export const Conecta: React.FC<ConectaProps> = ({ activeTab, onNavigate }) => {
  // State variables loaded from localStorage/Supabase
  const [salas, setSalas] = useState<SalaConecta[]>([]);
  const [locatarios, setLocatarios] = useState<Locatario[]>([]);
  const [reservas, setReservas] = useState<ReservaSala[]>([]);
  const [fechamentos, setFechamentos] = useState<FechamentoConecta[]>([]);
  const [loading, setLoading] = useState(false);

  // Navigation / Filter States
  const [weekOffset, setWeekOffset] = useState(0);
  const [salaFiltro, setSalaFiltro] = useState<string>('');
  const [fechamentoMes, setFechamentoMes] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modal Control States
  const [isSalaModalOpen, setIsSalaModalOpen] = useState(false);
  const [isLocModalOpen, setIsLocModalOpen] = useState(false);
  const [isReservaModalOpen, setIsReservaModalOpen] = useState(false);
  const [isDetReservaModalOpen, setIsDetReservaModalOpen] = useState(false);

  // Form Editing States (Salas)
  const [editSalaId, setEditSalaId] = useState<string | number | null>(null);
  const [salaNome, setSalaNome] = useState('');
  const [salaCap, setSalaCap] = useState(2);
  const [salaDesc, setSalaDesc] = useState('');
  const [salaCor, setSalaCor] = useState('sala1');

  // Form Editing States (Locatarios)
  const [editLocId, setEditLocId] = useState<string | number | null>(null);
  const [locNome, setLocNome] = useState('');
  const [locEsp, setLocEsp] = useState('');
  const [locTel, setLocTel] = useState('');
  const [locEmail, setLocEmail] = useState('');
  const [locCpf, setLocCpf] = useState('');
  const [locConselho, setLocConselho] = useState('');
  const [locValorHora, setLocValorHora] = useState<number>(0);
  const [locValorMeio, setLocValorMeio] = useState<number>(0);
  const [locValorDia, setLocValorDia] = useState<number>(0);
  const [locSalaPref, setLocSalaPref] = useState('');
  const [locStatus, setLocStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [locObs, setLocObs] = useState('');

  // Form Editing States (Reservas)
  const [resSalaId, setResSalaId] = useState<string | number>('');
  const [resLocId, setResLocId] = useState<string | number>('');
  const [resData, setResData] = useState('');
  const [resHoraIni, setResHoraIni] = useState('08:00');
  const [resDuracao, setResDuracao] = useState(60);
  const [resRecorrencia, setResRecorrencia] = useState<'unica' | 'semanal' | 'quinzenal'>('unica');
  const [resRecorrAte, setResRecorrAte] = useState('');
  const [resObs, setResObs] = useState('');

  // Active / Selected item detail states
  const [selectedResId, setSelectedResId] = useState<string | number | null>(null);

  // Calculations states for Fechamento
  const [fechamentoCalculado, setFechamentoCalculado] = useState(false);
  const [fechamentoKPIs, setFechamentoKPIs] = useState({ totalReservas: 0, totalHoras: 0, totalValor: 0 });
  const [fechamentoDetLocs, setFechamentoDetLocs] = useState<{
    loc: Locatario;
    horas: number;
    valor: number;
    reservas: ReservaSala[];
    porSala: { [salaId: string]: { count: number; horas: number; valor: number } };
  }[]>([]);

  // Load from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const safeQuery = async (queryPromise: any, label: string) => {
          try {
            const res = await queryPromise;
            if (res.error) {
              const code = res.error?.code || '';
              const msg = res.error?.message || '';
              if (code === 'PGRST116' || code === '42P01' || msg.includes('does not exist')) {
                console.info(`[ClinicFlow Conecta] Table "${label}" not found — fallback to local.`);
                return null;
              }
              console.warn(`[ClinicFlow Conecta] Error loading ${label}:`, res.error.message);
              return null;
            }
            return res.data;
          } catch (e: any) {
            console.warn(`[ClinicFlow Conecta] Exception loading ${label}:`, e.message);
            return null;
          }
        };

        const [salasDb, locsDb, reservasDb, fechDb] = await Promise.all([
          safeQuery(supabase.from('salas_conecta').select('*').eq('ativo', true).order('nome'), 'salas_conecta'),
          safeQuery(supabase.from('locatarios').select('*').order('nome'), 'locatarios'),
          safeQuery(supabase.from('reservas_salas').select('*').order('data'), 'reservas_salas'),
          safeQuery(supabase.from('fechamentos_locacao').select('*').order('competencia', { ascending: false }), 'fechamentos_locacao')
        ]);

        let salasLoaded = salasDb ? salasDb.map(mappers.dbToSala) : [];
        let locatariosLoaded = locsDb ? locsDb.map(mappers.dbToLoc) : [];
        let reservasLoaded = reservasDb ? reservasDb.map(mappers.dbToRes) : [];
        let fechamentosLoaded = fechDb ? fechDb.map(mappers.dbToFech) : [];

        // Fallback to localStorage if empty
        if (!salasDb || salasLoaded.length === 0) {
          const s = localStorage.getItem('cf_conecta_salas');
          salasLoaded = s ? JSON.parse(s) : [
            { id: 's1', nome: 'Sala 1', descricao: 'Sala individual — ar-condicionado, divã', capacidade: 2, cor: 'sala1' },
            { id: 's2', nome: 'Sala 2', descricao: 'Sala individual — mesa redonda, 4 cadeiras', capacidade: 4, cor: 'sala2' },
            { id: 's3', nome: 'Sala 3', descricao: 'Sala em group — até 10 pessoas', capacidade: 10, cor: 'sala3' },
          ];
        }

        if (!locsDb || locatariosLoaded.length === 0) {
          const l = localStorage.getItem('cf_conecta_locs');
          locatariosLoaded = l ? JSON.parse(l) : [
            { id: 'l1', nome: 'Dra. Ana Martins', esp: 'Psicologia', tel: '(11) 98765-0001', email: 'ana@clinica.com', cpf: '111.222.333-44', conselho: 'CRP 06/111222', valorHora: 50, valorMeio: 180, valorDia: 320, salaPref: 's1', status: 'ativo', obs: '' },
            { id: 'l2', nome: 'Dr. Carlos Ramos', esp: 'Psiquiatria', tel: '(11) 98765-0002', email: 'carlos@clinica.com', cpf: '222.333.444-55', conselho: 'CRM 12345/SP', valorHora: 80, valorMeio: 280, valorDia: 500, salaPref: 's2', status: 'ativo', obs: '' },
            { id: 'l3', nome: 'Dra. Sofia Lima', esp: 'Neuropsicologia', tel: '(11) 98765-0003', email: 'sofia@clinica.com', cpf: '333.444.555-66', conselho: 'CRP 06/222333', valorHora: 65, valorMeio: 220, valorDia: 380, salaPref: '', status: 'ativo', obs: 'Atende grupos às quintas' },
          ];
        }

        if (!reservasDb || reservasLoaded.length === 0) {
          const r = localStorage.getItem('cf_conecta_reservas');
          if (r) {
            reservasLoaded = JSON.parse(r);
          } else {
            const hoje = new Date();
            const seg = new Date(hoje);
            seg.setDate(hoje.getDate() - hoje.getDay() + 1); // Monday
            const fmt = (d: Date) => d.toISOString().slice(0, 10);

            const d0 = new Date(seg); d0.setDate(seg.getDate() + 0);
            const d1 = new Date(seg); d1.setDate(seg.getDate() + 1);
            const d2 = new Date(seg); d2.setDate(seg.getDate() + 2);
            const d3 = new Date(seg); d3.setDate(seg.getDate() + 3);

            reservasLoaded = [
              { id: 'r1', salaId: 's1', locId: 'l1', data: fmt(d0), horaIni: '08:00', horaFim: '10:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'unica' },
              { id: 'r2', salaId: 's1', locId: 'l2', data: fmt(d0), horaIni: '14:00', horaFim: '16:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'unica' },
              { id: 'r3', salaId: 's2', locId: 'l3', data: fmt(d1), horaIni: '09:00', horaFim: '12:00', durMin: 180, status: 'confirmado', obs: 'Grupo terapêutico', recorrencia: 'semanal' },
              { id: 'r4', salaId: 's1', locId: 'l1', data: fmt(d2), horaIni: '08:00', horaFim: '10:00', durMin: 120, status: 'confirmado', obs: '', recorrencia: 'semanal' },
              { id: 'r5', salaId: 's3', locId: 'l2', data: fmt(d3), horaIni: '13:00', horaFim: '17:00', durMin: 240, status: 'confirmado', obs: 'Capacitação', recorrencia: 'unica' },
            ];
          }
        }

        if (!fechDb || fechamentosLoaded.length === 0) {
          const f = localStorage.getItem('cf_conecta_fechamentos');
          fechamentosLoaded = f ? JSON.parse(f) : [];
        }

        setSalas(salasLoaded);
        setLocatarios(locatariosLoaded);
        setReservas(reservasLoaded);
        setFechamentos(fechamentosLoaded);

        localStorage.setItem('cf_conecta_salas', JSON.stringify(salasLoaded));
        localStorage.setItem('cf_conecta_locs', JSON.stringify(locatariosLoaded));
        localStorage.setItem('cf_conecta_reservas', JSON.stringify(reservasLoaded));
        localStorage.setItem('cf_conecta_fechamentos', JSON.stringify(fechamentosLoaded));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Save changes helper
  const saveSalas = (newSalas: SalaConecta[]) => {
    setSalas(newSalas);
    localStorage.setItem('cf_conecta_salas', JSON.stringify(newSalas));
  };
  const saveLocatarios = (newLocs: Locatario[]) => {
    setLocatarios(newLocs);
    localStorage.setItem('cf_conecta_locs', JSON.stringify(newLocs));
  };
  const saveReservas = (newRes: ReservaSala[]) => {
    setReservas(newRes);
    localStorage.setItem('cf_conecta_reservas', JSON.stringify(newRes));
  };
  const saveFechamentos = (newFech: FechamentoConecta[]) => {
    setFechamentos(newFech);
    localStorage.setItem('cf_conecta_fechamentos', JSON.stringify(newFech));
  };

  // Date/Week Calculations
  const getWeekDates = () => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const formatWeekLabel = () => {
    const ini = weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const fim = weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${ini} — ${fim}`;
  };

  const HORAS = ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

  const getSalaColorClass = (cor: string) => {
    if (cor === 'sala2') return 'bg-purple-500/10 border-purple-500/20 text-purple-400';
    if (cor === 'sala3') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (cor === 'sala4') return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    if (cor === 'sala5') return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
    if (cor === 'sala6') return 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
    return 'bg-blue-500/10 border-blue-500/20 text-blue-400'; // sala1 / fallback
  };

  const getTagColorClass = (cor: string) => {
    if (cor === 'sala2') return 'bg-purple-500/20 text-purple-200 border-purple-500/30';
    if (cor === 'sala3') return 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30';
    if (cor === 'sala4') return 'bg-amber-500/20 text-amber-200 border-amber-500/30';
    if (cor === 'sala5') return 'bg-rose-500/20 text-rose-200 border-rose-500/30';
    if (cor === 'sala6') return 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30';
    return 'bg-blue-500/20 text-blue-200 border-blue-500/30';
  };

  // Helper value calculation
  const calcReservaValor = (loc: Locatario | undefined, durMin: number) => {
    if (!loc) return 0;
    if (durMin >= 480 && loc.valorDia) return loc.valorDia;
    if (durMin >= 210 && loc.valorMeio) return loc.valorMeio;
    return (durMin / 60) * (loc.valorHora || 0);
  };

  const formatBRL = (v: number) => {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Room CRUD Handlers
  const handleOpenSalaAdd = () => {
    setEditSalaId(null);
    setSalaNome('');
    setSalaCap(2);
    setSalaDesc('');
    setSalaCor('sala1');
    setIsSalaModalOpen(true);
  };

  const handleOpenSalaEdit = (s: SalaConecta) => {
    if (!s) return;
    setEditSalaId(s.id);
    setSalaNome(s.nome || '');
    setSalaCap(s.capacidade || 2);
    setSalaDesc(s.descricao || '');
    setSalaCor(s.cor || 'sala1');
    setIsSalaModalOpen(true);
  };

  const handleSalaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaNome || !salaNome.trim()) return alert('Nome da sala é obrigatório');

    const dados = {
      nome: salaNome.trim(),
      capacidade: Number(salaCap) || 2,
      descricao: salaDesc ? salaDesc.trim() : '',
      cor: salaCor || 'sala1',
      ativo: true
    };

    try {
      if (editSalaId !== null && editSalaId !== undefined) {
        try {
          const { error } = await supabase.from('salas_conecta').update(mappers.salaToDb(dados)).eq('id', editSalaId);
          if (error) console.warn('[ClinicFlow Conecta] Error updating room in Supabase:', error.message);
        } catch (_) {}

        const updated = salas.map(s => String(s.id) === String(editSalaId) ? { ...s, ...dados } : s);
        saveSalas(updated);
        alert('✅ Cadastro da sala atualizado com sucesso!');
      } else {
        let newSalaObj: SalaConecta | null = null;
        try {
          const { data, error } = await supabase.from('salas_conecta').insert([mappers.salaToDb(dados)]).select().single();
          if (!error && data) {
            newSalaObj = mappers.dbToSala(data);
          }
        } catch (_) {}

        if (!newSalaObj) {
          newSalaObj = {
            id: `s_${Date.now()}`,
            ...dados
          };
        }

        saveSalas([...salas, newSalaObj]);
        alert('✅ Nova sala cadastrada com sucesso!');
      }
      setIsSalaModalOpen(false);
      setEditSalaId(null);
      setSalaNome('');
      setSalaCap(2);
      setSalaDesc('');
      setSalaCor('sala1');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar sala: ' + (err?.message || err));
    }
  };

  const handleSalaDelete = async (id: string | number) => {
    const hasReservations = reservas.some(r => String(r.salaId) === String(id) && r.status !== 'cancelado');
    if (hasReservations) return alert('Não é possível excluir uma sala com reservas ativas.');
    if (!confirm('Deseja realmente excluir esta sala?')) return;

    try {
      const { error } = await supabase.from('salas_conecta').update({ ativo: false }).eq('id', id);
      if (error) { alert('Erro ao excluir no Supabase: ' + error.message); return; }

      const filtered = salas.filter(s => s.id !== id);
      saveSalas(filtered);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Locatario CRUD Handlers
  const handleOpenLocAdd = () => {
    setEditLocId(null);
    setLocNome('');
    setLocEsp('');
    setLocTel('');
    setLocEmail('');
    setLocCpf('');
    setLocConselho('');
    setLocValorHora(0);
    setLocValorMeio(0);
    setLocValorDia(0);
    setLocSalaPref('');
    setLocStatus('ativo');
    setLocObs('');
    setIsLocModalOpen(true);
  };

  const handleOpenLocEdit = (l: Locatario) => {
    setEditLocId(l.id);
    setLocNome(l.nome);
    setLocEsp(l.esp);
    setLocTel(l.tel);
    setLocEmail(l.email);
    setLocCpf(l.cpf);
    setLocConselho(l.conselho);
    setLocValorHora(l.valorHora);
    setLocValorMeio(l.valorMeio);
    setLocValorDia(l.valorDia);
    setLocSalaPref(l.salaPref || '');
    setLocStatus(l.status);
    setLocObs(l.obs || '');
    setIsLocModalOpen(true);
  };

  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locNome.trim()) return alert('Nome é obrigatório');

    const payload = {
      nome: locNome,
      esp: locEsp,
      tel: locTel,
      email: locEmail,
      cpf: locCpf,
      conselho: locConselho,
      valorHora: locValorHora,
      valorMeio: locValorMeio,
      valorDia: locValorDia,
      salaPref: locSalaPref || null,
      status: locStatus,
      obs: locObs
    };

    try {
      if (editLocId) {
        const { error } = await supabase.from('locatarios').update(mappers.locToDb(payload)).eq('id', editLocId);
        if (error) { alert('Erro ao salvar no Supabase: ' + error.message); return; }

        const updated = locatarios.map(l => l.id === editLocId ? { ...l, ...payload } : l);
        saveLocatarios(updated);
      } else {
        const { data, error } = await supabase.from('locatarios').insert([mappers.locToDb(payload)]).select().single();
        if (error) { alert('Erro ao salvar no Supabase: ' + error.message); return; }

        const newLoc = mappers.dbToLoc(data);
        saveLocatarios([...locatarios, newLoc]);
      }
      setIsLocModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleLocDelete = async (id: string | number) => {
    const hasReservations = reservas.some(r => String(r.locId) === String(id) && r.status !== 'cancelado');
    if (hasReservations) return alert('Não é possível excluir locatário com reservas ativas.');
    if (!confirm('Deseja realmente excluir este locatário?')) return;

    try {
      const { error } = await supabase.from('locatarios').delete().eq('id', id);
      if (error) { alert('Erro ao excluir no Supabase: ' + error.message); return; }

      const filtered = locatarios.filter(l => l.id !== id);
      saveLocatarios(filtered);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Reserva CRUD Handlers
  const handleOpenReservaAdd = (salaId?: string | number, dateStr?: string, startHour?: string) => {
    setResSalaId(salaId || salas[0]?.id || '');
    setResLocId(locatarios.filter(l => l.status === 'ativo')[0]?.id || '');
    setResData(dateStr || new Date().toISOString().split('T')[0]);
    setResHoraIni(startHour || '08:00');
    setResDuracao(60);
    setResRecorrencia('unica');
    setResRecorrAte('');
    setResObs('');
    setIsReservaModalOpen(true);
  };

  const handleReservaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resSalaId || !resLocId || !resData || !resHoraIni) {
      return alert('Preencha os campos obrigatórios.');
    }

    const duration = Number(resDuracao);
    const [sh, sm] = resHoraIni.split(':').map(Number);
    const totalStartMin = sh * 60 + sm;
    const totalEndMin = totalStartMin + duration;
    const eh = String(Math.floor(totalEndMin / 60) % 24).padStart(2, '0');
    const em = String(totalEndMin % 60).padStart(2, '0');
    const computedHoraFim = `${eh}:${em}`;

    const dates = [resData];
    const isRecurrent = resRecorrencia !== 'unica' && resRecorrAte && resRecorrAte > resData;
    const serieId = isRecurrent ? crypto.randomUUID() : null;

    if (isRecurrent && resRecorrAte) {
      const interval = resRecorrencia === 'semanal' ? 7 : 14;
      let d = new Date(resData + 'T12:00:00');
      const limit = new Date(resRecorrAte + 'T12:00:00');
      while (true) {
        d.setDate(d.getDate() + interval);
        if (d > limit) break;
        dates.push(d.toISOString().slice(0, 10));
      }
    }

    let addedCount = 0;
    let conflictCount = 0;
    const newReservas = [...reservas];
    const loc = locatarios.find(l => String(l.id) === String(resLocId));
    const valorCobrado = calcReservaValor(loc, duration);

    for (const dt of dates) {
      const isConflict = reservas.some(r =>
        String(r.salaId) === String(resSalaId) && r.data === dt && r.status !== 'cancelado' &&
        !(computedHoraFim <= r.horaIni || resHoraIni >= r.horaFim)
      );
      if (isConflict) {
        conflictCount++;
        continue;
      }

      const novaRes = {
        salaId: resSalaId,
        locId: resLocId,
        data: dt,
        horaIni: resHoraIni,
        horaFim: computedHoraFim,
        durMin: duration,
        status: 'confirmado' as const,
        obs: resObs,
        recorrencia: resRecorrencia,
        serieId,
        valorCobrado
      };

      try {
        const { data: dbRow, error } = await supabase.from('reservas_salas')
          .insert([mappers.resToDb(novaRes)]).select().single();
        if (error) {
          conflictCount++;
          console.error('[Reserva INSERT]', error.message);
          continue;
        }
        newReservas.push(mappers.dbToRes(dbRow));
        addedCount++;
      } catch (err: any) {
        conflictCount++;
        console.error(err);
      }
    }

    if (addedCount > 0) {
      saveReservas(newReservas);
      setIsReservaModalOpen(false);
      if (conflictCount > 0) {
        alert(`Sucesso: ${addedCount} reserva(s) criada(s). ${conflictCount} conflito(s) ignorado(s).`);
      } else {
        alert('Reserva efetuada com sucesso!');
      }
    } else {
      alert('Conflito de horário ou erro ao salvar! Nenhuma reserva pôde ser criada.');
    }
  };

  const handleReservaCancel = async (id: string | number, scope: 'unica' | 'futuras' | 'todas') => {
    const resObj = reservas.find(r => r.id === id);
    if (!resObj) return;

    let targetIds: (string | number)[] = [];
    if (scope === 'unica') {
      targetIds = [id];
    } else if (scope === 'futuras') {
      targetIds = reservas
        .filter(r => r.serieId && r.serieId === resObj.serieId && r.data >= resObj.data && r.status !== 'cancelado')
        .map(r => r.id);
    } else {
      targetIds = reservas
        .filter(r => r.serieId && r.serieId === resObj.serieId)
        .map(r => r.id);
    }

    try {
      const { error } = await supabase.from('reservas_salas')
        .update({ status: 'cancelado' })
        .in('id', targetIds);

      if (error) { alert('Erro ao cancelar no Supabase: ' + error.message); return; }

      const updated = reservas.map(r =>
        targetIds.includes(r.id) ? { ...r, status: 'cancelado' as const } : r
      );
      saveReservas(updated);
      setIsDetReservaModalOpen(false);
      alert('Reserva(s) cancelada(s) com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao cancelar: ' + err.message);
    }
  };

  const handleReservaDelete = async (id: string | number, scope: 'unica' | 'futuras' | 'todas') => {
    const resObj = reservas.find(r => r.id === id);
    if (!resObj) return;

    let targetIds: (string | number)[] = [];
    if (scope === 'unica') {
      targetIds = [id];
    } else if (scope === 'futuras') {
      targetIds = reservas
        .filter(r => r.serieId && r.serieId === resObj.serieId && r.data >= resObj.data)
        .map(r => r.id);
    } else {
      targetIds = reservas
        .filter(r => r.serieId && r.serieId === resObj.serieId)
        .map(r => r.id);
    }

    try {
      const { error } = await supabase.from('reservas_salas')
        .delete()
        .in('id', targetIds);

      if (error) { alert('Erro ao excluir no Supabase: ' + error.message); return; }

      const updated = reservas.filter(r => !targetIds.includes(r.id));
      saveReservas(updated);
      setIsDetReservaModalOpen(false);
      alert('Reserva(s) excluída(s) com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir: ' + err.message);
    }
  };

  // Calculations logic (Fechamento)
  const calculateFechamento = () => {
    if (!fechamentoMes) return alert('Selecione o mês para fechamento');
    const [y, m] = fechamentoMes.split('-').map(Number);
    const prim = `${y}-${String(m).padStart(2, '0')}-01`;
    const ult = new Date(y, m, 0).toISOString().slice(0, 10);

    const resMes = reservas.filter(r => r.status !== 'cancelado' && r.data >= prim && r.data <= ult);
    
    // KPIs
    const totalReservas = resMes.length;
    const totalHoras = resMes.reduce((acc, r) => acc + r.durMin / 60, 0);
    
    let totalValor = 0;
    const detailedLocs = locatarios
      .map(loc => {
        const resLoc = resMes.filter(r => String(r.locId) === String(loc.id));
        const horas = resLoc.reduce((acc, r) => acc + r.durMin / 60, 0);
        const valor = resLoc.reduce((acc, r) => acc + calcReservaValor(loc, r.durMin), 0);
        
        // Sum por sala
        const porSala: { [salaId: string]: { count: number; horas: number; valor: number } } = {};
        resLoc.forEach(r => {
          if (!porSala[r.salaId]) porSala[r.salaId] = { count: 0, horas: 0, valor: 0 };
          porSala[r.salaId].count++;
          porSala[r.salaId].horas += r.durMin / 60;
          porSala[r.salaId].valor += calcReservaValor(loc, r.durMin);
        });

        totalValor += valor;
        return { loc, horas, valor, reservas: resLoc, porSala };
      })
      .filter(x => x.reservas.length > 0);

    setFechamentoKPIs({ totalReservas, totalHoras, totalValor });
    setFechamentoDetLocs(detailedLocs);
    setFechamentoCalculado(true);
  };

  const confirmFechamento = async () => {
    if (!fechamentoMes) return;
    if (!confirm(`Deseja registrar o fechamento de ${fechamentoMes} no histórico?`)) return;

    let salvos = 0;
    const newFechamentos = [...fechamentos];

    for (const x of fechamentoDetLocs) {
      const detalhes = x.reservas.map(r => ({
        id: r.id, data: r.data, horaIni: r.horaIni, horaFim: r.horaFim,
        durMin: r.durMin, salaId: r.salaId, obs: r.obs
      }));

      const fechObj = {
        competencia: fechamentoMes,
        locatarioId: x.loc.id,
        totalReservas: x.reservas.length,
        totalHoras: x.horas,
        totalValor: x.valor,
        status: 'emitido',
        emitidoEm: new Date().toISOString(),
        detalhes
      };

      try {
        const payload = mappers.fechToDb(fechObj);
        const { data, error } = await supabase.from('fechamentos_locacao')
          .upsert(payload, { onConflict: 'competencia,locatario_id' })
          .select()
          .single();

        if (error) {
          console.error('[Fechamento UPSERT]', error.message);
          alert('Erro ao registrar fechamento no Supabase: ' + error.message);
          return;
        }

        const mappedFech = mappers.dbToFech(data);
        const existIdx = newFechamentos.findIndex(f =>
          f.competencia === fechamentoMes && String(f.locatarioId) === String(x.loc.id)
        );
        if (existIdx >= 0) {
          newFechamentos[existIdx] = mappedFech;
        } else {
          newFechamentos.push(mappedFech);
        }
        salvos++;
      } catch (err: any) {
        console.error(err);
      }
    }

    saveFechamentos(newFechamentos);
    alert(`Fechamento de ${salvos} locatário(s) registrado com sucesso!`);
  };

  // Generate printable/download HTML report
  const printReport = () => {
    if (!fechamentoMes) return;
    const [ano, mes] = fechamentoMes.split('-').map(Number);
    const label = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const capLabel = label.charAt(0).toUpperCase() + label.slice(1);
    const dataEmis = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const rows = fechamentoDetLocs.map(x => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${x.loc.nome}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${x.loc.esp || '—'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${x.reservas.length}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${x.horas.toFixed(1)}h</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatBRL(x.loc.valorHora)}/h</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: #16a34a;">${formatBRL(x.valor)}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Fechamento de Locação — ${capLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
          .header { border-bottom: 3px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
          .title { font-size: 24px; font-weight: bold; color: #1e3a8a; }
          .meta { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #6366f1; color: white; padding: 12px 10px; text-align: left; }
          tr:nth-child(even) { background: #f8fafc; }
          .total { background: #e0e7ff; font-weight: bold; }
          .total td { padding: 12px 10px; font-size: 16px; color: #16a34a; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">ClinicFlow — Espaço Conecta</div>
          <div style="font-size: 14px; margin-top: 5px;">Relatório Mensal de Locação de Salas</div>
        </div>
        <div class="meta">
          <span>Competência: <strong>${capLabel}</strong></span>
          <span>Gerado em: ${dataEmis}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Locatário</th>
              <th>Especialidade</th>
              <th style="text-align: center;">Reservas</th>
              <th style="text-align: center;">Horas</th>
              <th style="text-align: right;">Tarifa/h</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr class="total">
              <td colspan="2">TOTAL GERAL</td>
              <td style="text-align: center;">${fechamentoKPIs.totalReservas}</td>
              <td style="text-align: center;">${fechamentoKPIs.totalHoras.toFixed(1)}h</td>
              <td></td>
              <td style="text-align: right;">${formatBRL(fechamentoKPIs.totalValor)}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Helper values for active / selected items
  const selectedRes = reservas.find(r => String(r.id) === String(selectedResId));
  const selectedLoc = selectedRes ? locatarios.find(l => String(l.id) === String(selectedRes.locId)) : undefined;
  const selectedSala = selectedRes ? salas.find(s => String(s.id) === String(selectedRes.salaId)) : undefined;

  const salasFiltradas = salaFiltro ? salas.filter(s => String(s.id) === String(salaFiltro)) : salas;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-4 animate-fade-in text-xs overflow-hidden">
      
      {/* Header Section */}
      <div className="shrink-0 bg-[#07090e]/95 backdrop-blur-md z-10 pb-4 border-b border-white/[0.04] space-y-4">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Módulo Espaço Conecta</span>
            <h2 className="text-2xl font-black tracking-wide text-white mt-0.5 font-sans">
              {activeTab === 'conecta-agenda' ? 'Agendamento de Salas' : activeTab === 'conecta-profissionais' ? 'Profissionais Locatários' : 'Fechamento de Locação'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {activeTab === 'conecta-agenda' ? 'Gerencie a reserva de salas do Espaço Conecta' : activeTab === 'conecta-profissionais' ? 'Monitore o cadastro de locatários e preços' : 'Controle mensal do faturamento de locações'}
            </p>
          </div>

          {/* Global actions */}
          <div className="flex items-center gap-3">
            {activeTab === 'conecta-agenda' && (
              <>
                <select
                  value={salaFiltro}
                  onChange={(e) => setSalaFiltro(e.target.value)}
                  className="bg-[#131622]/60 border border-white/[0.06] rounded-xl px-3 py-2 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="">Todas as salas</option>
                  {salas.map(s => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>

                <button
                  onClick={handleOpenSalaAdd}
                  className="flex items-center gap-1 px-3.5 py-2 bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06] text-slate-200 rounded-xl font-bold transition-all text-[10px]"
                >
                  <Building2 size={12} />
                  Gerenciar Salas
                </button>

                <button
                  onClick={() => handleOpenReservaAdd()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 text-[10px]"
                >
                  <Plus size={12} />
                  Nova Reserva
                </button>
              </>
            )}

            {activeTab === 'conecta-profissionais' && (
              <button
                onClick={handleOpenLocAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 text-[10px]"
              >
                <Plus size={12} />
                Novo Locatário
              </button>
            )}
          </div>
        </div>

        {/* Tab-specific Calendar Navigator */}
        {activeTab === 'conecta-agenda' && (
          <div className="flex items-center justify-between bg-[#131622]/40 border border-white/[0.04] p-3 rounded-2xl">
            <span className="font-bold text-slate-200 text-xs font-mono">{formatWeekLabel()}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="px-3 py-1.5 bg-[#0f111a] border border-white/[0.06] hover:bg-white/5 text-slate-400 rounded-lg font-bold"
              >
                ‹ Anterior
              </button>
              <button
                onClick={() => setWeekOffset(0)}
                className="px-3 py-1.5 bg-[#0f111a] border border-white/[0.06] hover:bg-white/5 text-slate-300 rounded-lg font-bold"
              >
                Hoje
              </button>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="px-3 py-1.5 bg-[#0f111a] border border-white/[0.06] hover:bg-white/5 text-slate-400 rounded-lg font-bold"
              >
                Próxima ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-6 pr-1">
        {/* ── TAB 1: AGENDA DE RESERVAS DE SALA ── */}
        {activeTab === 'conecta-agenda' && (
        <div className="space-y-6">

          {/* Rooms and Weekly Grid List */}
          <div className="space-y-6">
            {salasFiltradas.map((sala) => {
              return (
                <div key={sala.id} className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
                  {/* Room Info Header */}
                  <div className="p-4 border-b border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg border font-bold text-[10px] uppercase ${getSalaColorClass(sala.cor)}`}>
                        🚪 {sala.nome}
                      </span>
                      <span className="text-slate-400 text-[11px]">{sala.descricao}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-500 font-bold">👥 Cap. {sala.capacidade}</span>
                      <button
                        onClick={() => handleOpenSalaEdit(sala)}
                        className="px-2 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all"
                        title="Editar cadastro desta sala"
                      >
                        <Edit size={10} />
                        Editar
                      </button>
                      <button
                        onClick={() => handleOpenReservaAdd(sala.id)}
                        className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg text-[9px]"
                      >
                        + Reservar
                      </button>
                    </div>
                  </div>

                  {/* Room Weekly Grid */}
                  <div className="overflow-x-auto scrollbar-none p-0">
                    <div className="min-w-[800px] grid grid-cols-8 divide-x divide-white/[0.03]">
                      {/* Hours Column Header */}
                      <div className="bg-[#0f111a]/40 text-center py-2.5 font-bold text-[9px] text-slate-500 uppercase tracking-wider">Hora</div>
                      {/* Dates Headers */}
                      {weekDates.map((date) => {
                        const isHoje = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
                        return (
                          <div
                            key={date.toISOString()}
                            className={`text-center py-2.5 font-bold text-[10px] uppercase ${
                              isHoje ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-400'
                            }`}
                          >
                            {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          </div>
                        );
                      })}

                      {/* Row Slots */}
                      {HORAS.map((hora) => (
                        <React.Fragment key={hora}>
                          {/* Hour tag label */}
                          <div className="py-2.5 border-t border-white/[0.03] text-center font-mono font-bold text-slate-400 text-[10px]">
                            {hora}
                          </div>
                          {/* 7 Days Columns */}
                          {weekDates.map((date) => {
                            const dateISO = date.toISOString().split('T')[0];
                            // Get reservation matching this sala, date, and hour
                            const resObj = reservas.find(r =>
                              String(r.salaId) === String(sala.id) &&
                              r.data === dateISO &&
                              r.status !== 'cancelado' &&
                              r.horaIni <= hora && r.horaFim > hora
                            );
                            const loc = resObj ? locatarios.find(l => String(l.id) === String(resObj.locId)) : undefined;

                            return (
                              <div
                                key={dateISO}
                                onClick={() => {
                                  if (resObj) {
                                    setSelectedResId(resObj.id);
                                    setIsDetReservaModalOpen(true);
                                  } else {
                                    handleOpenReservaAdd(sala.id, dateISO, hora);
                                  }
                                }}
                                className={`border-t border-white/[0.02] p-1 min-h-[46px] transition-all flex items-stretch relative group cursor-pointer hover:bg-white/[0.01]`}
                              >
                                {resObj ? (
                                  <div
                                    className={`w-full py-1.5 px-2 rounded-lg border text-[9px] font-bold truncate transition-all ${getTagColorClass(sala.cor)}`}
                                    title={`${loc?.nome || '—'} (${resObj.horaIni}-${resObj.horaFim})`}
                                  >
                                    {loc?.nome?.split(' ')[0] || '—'}
                                  </div>
                                ) : (
                                  <div className="w-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-[8px] font-bold text-slate-600 hover:text-slate-400 transition-opacity">
                                    + Reservar
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: PROFISSIONAIS LOCATÁRIOS ── */}
      {activeTab === 'conecta-profissionais' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locatarios.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 font-sans">
              Nenhum locatário cadastrado. Clique em "Novo Locatário" para começar.
            </div>
          ) : (
            locatarios.map((loc) => {
              // Calculate monthly stats
              const currentMonth = new Date().toISOString().slice(0, 7);
              const resMes = reservas.filter(r => String(r.locId) === String(loc.id) && r.data.startsWith(currentMonth) && r.status !== 'cancelado');
              const totalHoras = resMes.reduce((acc, r) => acc + r.durMin / 60, 0);
              const totalValor = resMes.reduce((acc, r) => acc + calcReservaValor(loc, r.durMin), 0);
              const salaPrefObj = salas.find(s => String(s.id) === String(loc.salaPref));

              return (
                <div key={loc.id} className="bg-[#131622]/50 border border-white/[0.04] p-5 rounded-2xl shadow-lg flex flex-col justify-between space-y-4">
                  {/* Card Header Info */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
                        {loc.nome.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200 text-xs">{loc.nome}</h4>
                        <p className="text-[10px] text-slate-400">{loc.esp || 'Sem esp.'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold capitalize ${
                        loc.status === 'ativo' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      }`}>
                        {loc.status}
                      </span>
                      <button onClick={() => handleOpenLocEdit(loc)} className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-slate-200">
                        <Edit size={12} />
                      </button>
                      <button onClick={() => handleLocDelete(loc.id)} className="p-1 hover:bg-white/5 rounded text-rose-400 hover:text-rose-300">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Hourly stats / faturamento monthly projection */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#0f111a]/40 border border-white/[0.02] p-2 rounded-xl text-center">
                      <span className="block text-[11px] font-bold text-slate-200">{formatBRL(loc.valorHora)}</span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">Hora</span>
                    </div>
                    <div className="bg-[#0f111a]/40 border border-white/[0.02] p-2 rounded-xl text-center">
                      <span className="block text-[11px] font-bold text-indigo-400">{totalHoras.toFixed(1)}h</span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">Este Mês</span>
                    </div>
                    <div className="bg-[#0f111a]/40 border border-white/[0.02] p-2 rounded-xl text-center">
                      <span className="block text-[11px] font-bold text-emerald-400">{formatBRL(totalValor)}</span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">A Faturar</span>
                    </div>
                  </div>

                  {/* Contacts */}
                  <div className="pt-2 border-t border-white/[0.03] space-y-1 text-[10px] text-slate-500 font-medium">
                    {loc.tel && <div>📞 Tel: <span className="text-slate-300">{loc.tel}</span></div>}
                    {salaPrefObj && <div>🚪 Pref: <span className="text-slate-300">{salaPrefObj.nome}</span></div>}
                    {loc.conselho && <div>🪪 Reg: <span className="text-slate-300">{loc.conselho}</span></div>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB 3: FECHAMENTO DE LOCAÇÃO ── */}
      {activeTab === 'conecta-fechamento' && (
        <div className="space-y-6 animate-fade-in">
          {/* Picker Controls */}
          <div className="p-4 bg-[#131622]/40 border border-white/[0.04] rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="font-bold text-slate-300 text-xs">Mês de Competência:</label>
              <input
                type="month"
                value={fechamentoMes}
                onChange={(e) => {
                  setFechamentoMes(e.target.value);
                  setFechamentoCalculado(false);
                }}
                className="bg-[#0f111a] border border-white/[0.06] rounded-xl px-3 py-1.5 text-slate-300 font-bold text-[10px] focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={calculateFechamento}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-[10px]"
              >
                Calcular Fechamento
              </button>
            </div>

            {fechamentoCalculado && (
              <div className="flex gap-2">
                <button
                  onClick={printReport}
                  className="flex items-center gap-1 px-4 py-2 bg-[#0f111a] border border-white/[0.06] hover:bg-white/5 text-slate-300 rounded-xl font-bold text-[10px]"
                >
                  <Printer size={12} />
                  Emitir Relatório (PDF)
                </button>
                <button
                  onClick={confirmFechamento}
                  className="flex items-center gap-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-[10px]"
                >
                  <CheckCircle size={12} />
                  Confirmar Fechamento
                </button>
              </div>
            )}
          </div>

          {/* Calculation result KPIs */}
          {fechamentoCalculado && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#131622]/50 border border-white/[0.04] p-4 rounded-2xl text-center space-y-1 shadow-lg">
                <span className="block text-2xl font-black text-indigo-400 font-mono">{fechamentoKPIs.totalReservas}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Reservas no Mês</span>
              </div>
              <div className="bg-[#131622]/50 border border-white/[0.04] p-4 rounded-2xl text-center space-y-1 shadow-lg">
                <span className="block text-2xl font-black text-amber-400 font-mono">{fechamentoKPIs.totalHoras.toFixed(1)}h</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Horas Locadas</span>
              </div>
              <div className="bg-[#131622]/50 border border-white/[0.04] p-4 rounded-2xl text-center space-y-1 shadow-lg">
                <span className="block text-2xl font-black text-emerald-400 font-mono">{formatBRL(fechamentoKPIs.totalValor)}</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total a Faturar</span>
              </div>
            </div>
          )}

          {/* Tenant Breakdown Cards */}
          {fechamentoCalculado && (
            <div className="space-y-6">
              {fechamentoDetLocs.length === 0 ? (
                <div className="bg-[#131622]/50 border border-white/[0.04] p-10 rounded-2xl text-center text-slate-500 font-sans">
                  Nenhuma reserva confirmada para este mês.
                </div>
              ) : (
                fechamentoDetLocs.map((item) => {
                  return (
                    <div key={item.loc.id} className="bg-[#131622]/50 border border-white/[0.04] p-5 rounded-2xl shadow-lg space-y-5">
                      {/* Tenant Row Header */}
                      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/[0.04] pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] font-mono">
                            {item.loc.nome.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-200 text-xs">{item.loc.nome}</h4>
                            <p className="text-[10px] text-slate-500">{item.loc.esp || '—'} · {item.loc.conselho || '—'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="block text-sm font-black text-emerald-400 font-mono">{formatBRL(item.valor)}</span>
                          <span className="text-[10px] text-slate-500 font-bold">{item.horas.toFixed(1)}h em {item.reservas.length} reservas</span>
                        </div>
                      </div>

                      {/* Summary per room */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Por Sala</span>
                        <div className="border border-white/[0.04] rounded-xl overflow-hidden divide-y divide-white/[0.03]">
                          {Object.entries(item.porSala).map(([sId, data]) => {
                            const roomObj = salas.find(s => String(s.id) === String(sId));
                            return (
                              <div key={sId} className="flex justify-between items-center p-3 text-[10px] bg-white/[0.005]">
                                <span className={`px-2 py-0.5 rounded-lg border font-bold text-[9px] uppercase ${getSalaColorClass(roomObj?.cor || 'sala1')}`}>
                                  {roomObj?.nome || sId}
                                </span>
                                <span className="text-slate-400">{data.count} reserva(s)</span>
                                <span className="font-mono text-slate-300">{data.horas.toFixed(1)}h</span>
                                <span className="font-mono font-bold text-slate-200">{formatBRL(data.valor)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detailed Reservation List */}
                      <div className="space-y-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Detalhamento das Reservas</span>
                        <div className="border border-white/[0.04] rounded-xl overflow-hidden divide-y divide-white/[0.03]">
                          {item.reservas.map((res) => {
                            const roomObj = salas.find(s => String(s.id) === String(res.salaId));
                            const val = calcReservaValor(item.loc, res.durMin);
                            const dtLabel = new Date(res.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                            
                            return (
                              <div key={res.id} className="flex justify-between items-center p-2.5 text-[10px] font-mono">
                                <span className="text-slate-400 font-bold">{dtLabel}</span>
                                <span className="text-slate-300 font-sans">{res.horaIni} – {res.horaFim} {res.obs ? `(${res.obs})` : ''}</span>
                                <span className={`px-1.5 py-0.25 rounded text-[8px] font-bold uppercase font-sans ${getSalaColorClass(roomObj?.cor || 'sala1')}`}>
                                  {roomObj?.nome || res.salaId}
                                </span>
                                <span className="text-slate-400">{(res.durMin / 60).toFixed(1)}h</span>
                                <span className="font-bold text-emerald-400">{formatBRL(val)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Fechamentos Histórico List */}
          <div className="bg-[#131622]/50 border border-white/[0.04] p-5 rounded-2xl shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Histórico de Fechamentos Confirmados</h3>
            
            {fechamentos.length === 0 ? (
              <div className="py-4 text-center text-slate-500 font-sans">Nenhum fechamento registrado ainda.</div>
            ) : (
              <div className="space-y-4">
                {/* Group by competencia */}
                {Array.from(new Set(fechamentos.map(f => f.competencia)))
                  .sort((a, b) => b.localeCompare(a))
                  .map(comp => {
                    const monthFechs = fechamentos.filter(f => f.competencia === comp);
                    const totalVal = monthFechs.reduce((acc, f) => acc + f.totalValor, 0);
                    const totalHrs = monthFechs.reduce((acc, f) => acc + f.totalHoras, 0);
                    const [y, m] = comp.split('-').map(Number);
                    const compLabel = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                    return (
                      <div key={comp} className="bg-[#0f111a]/40 border border-white/[0.03] p-4 rounded-xl space-y-3">
                        <div className="flex justify-between items-center border-b border-white/[0.03] pb-2">
                          <span className="font-bold text-slate-200 capitalize">{compLabel}</span>
                          <div className="flex gap-4 font-mono font-bold text-[10px]">
                            <span className="text-slate-400">{totalHrs.toFixed(1)}h</span>
                            <span className="text-emerald-400">{formatBRL(totalVal)}</span>
                          </div>
                        </div>
                        <div className="divide-y divide-white/[0.02]">
                          {monthFechs.map(f => {
                            const loc = locatarios.find(l => String(l.id) === String(f.locatarioId));
                            return (
                              <div key={f.id} className="flex justify-between items-center py-2 text-[10px]">
                                <span className="font-semibold text-slate-300">{loc?.nome || 'Desconhecido'}</span>
                                <span className="text-slate-500">{f.totalReservas} reservas</span>
                                <span className="font-mono text-slate-400">{f.totalHoras.toFixed(1)}h</span>
                                <span className="font-mono font-bold text-emerald-400">{formatBRL(f.totalValor)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ── MODAL: GERENCIAR SALAS ── */}
      {isSalaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#131726] border border-indigo-500/30 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in text-xs max-h-[90vh]">
            <div className="p-5 border-b border-slate-700/60 bg-[#1a2035] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-400" />
                  Gerenciar Cadastro de Salas
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">Cadastre, edite ou altere as salas de atendimento do Espaço Conecta</p>
              </div>
              <button
                onClick={() => setIsSalaModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg text-lg transition-all"
              >
                &times;
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto scrollbar-thin">
              {/* LISTA DE SALAS CADASTRADAS (ESQUERDA - 6 COLS) */}
              <div className="md:col-span-6 space-y-3 border-b md:border-b-0 md:border-r border-slate-700/60 pb-4 md:pb-0 md:pr-4">
                <div className="flex justify-between items-center pb-1 border-b border-slate-700/40">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Salas Cadastradas ({salas.length})</h4>
                  <button
                    onClick={handleOpenSalaAdd}
                    className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-lg border border-indigo-500/30 text-[10px] transition-all flex items-center gap-1"
                  >
                    <Plus size={12} /> Nova Sala
                  </button>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {salas.length === 0 ? (
                    <p className="text-slate-400 text-xs py-6 text-center italic">Nenhuma sala cadastrada ainda.</p>
                  ) : (
                    salas.map((s) => (
                      <div
                        key={s.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                          String(editSalaId) === String(s.id)
                            ? 'bg-indigo-500/20 border-2 border-indigo-500 shadow-lg'
                            : 'bg-[#1c2237] border-slate-700/80 hover:border-slate-500'
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase inline-block ${getSalaColorClass(s.cor)}`}>
                            🚪 {s.nome}
                          </span>
                          <p className="text-xs text-slate-200 font-medium truncate max-w-[160px]">{s.descricao || 'Sem descrição'}</p>
                          <span className="text-[10px] text-slate-400 font-semibold block">Capacidade: {s.capacidade} pessoas</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSalaEdit(s);
                            }}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] shadow transition-all flex items-center gap-1"
                            title="Editar esta sala"
                          >
                            <Edit size={12} />
                            Editar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSalaDelete(s.id);
                            }}
                            className="p-1.5 bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600 text-rose-300 hover:text-white font-bold rounded-lg text-[10px] transition-all"
                            title="Excluir esta sala"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FORMULÁRIO DE EDIÇÃO / ADIÇÃO (DIREITA - 6 COLS) */}
              <form onSubmit={handleSalaSubmit} className="md:col-span-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-700/60">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    {editSalaId ? '✏️ Alterar Sala Selecionada' : '➕ Cadastrar Nova Sala'}
                  </h4>
                  {editSalaId && (
                    <button
                      type="button"
                      onClick={handleOpenSalaAdd}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[10px] font-bold transition-all"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-200 font-bold text-xs mb-1">Nome da Sala *</label>
                  <input
                    type="text"
                    required
                    value={salaNome || ''}
                    onChange={(e) => setSalaNome(e.target.value)}
                    placeholder="Ex: Sala 1, Sala Atendimento..."
                    className="w-full bg-[#0d101d] border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium placeholder-slate-500 outline-none text-xs transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-200 font-bold text-xs mb-1">Capacidade (Pessoas)</label>
                    <input
                      type="number"
                      min={1}
                      value={salaCap || 2}
                      onChange={(e) => setSalaCap(Number(e.target.value))}
                      className="w-full bg-[#0d101d] border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold outline-none text-xs transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-200 font-bold text-xs mb-1">Identificação / Cor</label>
                    <select
                      value={salaCor || 'sala1'}
                      onChange={(e) => setSalaCor(e.target.value)}
                      className="w-full bg-[#0d101d] border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium outline-none text-xs transition-all cursor-pointer"
                    >
                      <option value="sala1" className="bg-[#0d101d] text-white">Azul</option>
                      <option value="sala2" className="bg-[#0d101d] text-white">Roxo</option>
                      <option value="sala3" className="bg-[#0d101d] text-white">Verde</option>
                      <option value="sala4" className="bg-[#0d101d] text-white">Amarelo</option>
                      <option value="sala5" className="bg-[#0d101d] text-white">Vermelho</option>
                      <option value="sala6" className="bg-[#0d101d] text-white">Ciano</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-200 font-bold text-xs mb-1">Descrição</label>
                  <textarea
                    rows={3}
                    value={salaDesc || ''}
                    onChange={(e) => setSalaDesc(e.target.value)}
                    placeholder="Ex: Sala individual com divã, poltronas e ar-condicionado..."
                    className="w-full bg-[#0d101d] border border-slate-600 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 rounded-xl px-3.5 py-2.5 text-white font-medium placeholder-slate-500 outline-none text-xs transition-all"
                  />
                </div>

                <div className="pt-3 border-t border-slate-700/60 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSalaModalOpen(false)}
                    className="px-4 py-2.5 border border-slate-600 rounded-xl text-slate-200 font-bold hover:bg-white/10 transition-all text-xs"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg transition-all text-xs"
                  >
                    {editSalaId ? 'Salvar Alterações' : 'Cadastrar Sala'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NOVO / EDITAR LOCATÁRIO ── */}
      {isLocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in text-xs max-h-[90vh]">
            <div className="p-5 border-b border-white/[0.04] bg-[#131622]/40 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{editLocId ? 'Editar Locatário' : 'Novo Locatário'}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Preencha os dados e os planos de tarifa do profissional</p>
              </div>
              <button onClick={() => setIsLocModalOpen(false)} className="text-slate-400 hover:text-white text-base">&times;</button>
            </div>

            <form onSubmit={handleLocSubmit} className="p-6 space-y-4 overflow-y-auto scrollbar-thin flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    value={locNome}
                    onChange={(e) => setLocNome(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Especialidade</label>
                  <input
                    type="text"
                    value={locEsp}
                    onChange={(e) => setLocEsp(e.target.value)}
                    placeholder="Ex: Psicólogo, Psiquiatra..."
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    value={locTel}
                    onChange={(e) => setLocTel(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={locEmail}
                    onChange={(e) => setLocEmail(e.target.value)}
                    placeholder="locatario@clinica.com"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">CPF</label>
                  <input
                    type="text"
                    value={locCpf}
                    onChange={(e) => setLocCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Conselho Profissional / UF</label>
                  <input
                    type="text"
                    value={locConselho}
                    onChange={(e) => setLocConselho(e.target.value)}
                    placeholder="Ex: CRP 06/12345"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Sala de Preferência</label>
                  <select
                    value={locSalaPref}
                    onChange={(e) => setLocSalaPref(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">Sem preferência</option>
                    {salas.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tariffs section */}
              <div className="border border-white/[0.04] p-4 rounded-xl bg-white/[0.01] space-y-4">
                <span className="font-bold text-slate-200">Tabela de Preços de Aluguel</span>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Valor por Hora (R$)</label>
                    <input
                      type="number"
                      required
                      value={locValorHora}
                      onChange={(e) => setLocValorHora(Number(e.target.value))}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Meio Período (R$)</label>
                    <input
                      type="number"
                      value={locValorMeio}
                      onChange={(e) => setLocValorMeio(Number(e.target.value))}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Dia Inteiro (R$)</label>
                    <input
                      type="number"
                      value={locValorDia}
                      onChange={(e) => setLocValorDia(Number(e.target.value))}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status</label>
                  <select
                    value={locStatus}
                    onChange={(e) => setLocStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none font-bold"
                  >
                    <option value="ativo">🟢 Ativo</option>
                    <option value="inativo">🔴 Inativo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                  <input
                    type="text"
                    value={locObs}
                    onChange={(e) => setLocObs(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsLocModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg"
                >
                  Salvar Locatário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: NOVA RESERVA ── */}
      {isReservaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in text-xs max-h-[90vh]">
            <div className="p-5 border-b border-white/[0.04] bg-[#131622]/40 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nova Reserva de Sala</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Informe os dados do aluguel da sala</p>
              </div>
              <button onClick={() => setIsReservaModalOpen(false)} className="text-slate-400 hover:text-white text-base">&times;</button>
            </div>

            <form onSubmit={handleReservaSubmit} className="p-6 space-y-4 overflow-y-auto scrollbar-thin flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Sala *</label>
                  <select
                    value={String(resSalaId)}
                    onChange={(e) => setResSalaId(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    {salas.map(s => (
                      <option key={String(s.id)} value={String(s.id)}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Profissional Locatário *</label>
                  <select
                    value={String(resLocId)}
                    onChange={(e) => setResLocId(e.target.value)}
                    required
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {locatarios.filter(l => l.status === 'ativo').map(l => (
                      <option key={String(l.id)} value={String(l.id)}>{l.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={resData}
                    onChange={(e) => setResData(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Horário Início *</label>
                  <input
                    type="time"
                    required
                    value={resHoraIni}
                    onChange={(e) => setResHoraIni(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duração</label>
                  <select
                    value={resDuracao}
                    onChange={(e) => setResDuracao(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value={30}>30 min</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1h30min</option>
                    <option value={120}>2 horas</option>
                    <option value={180}>3 horas</option>
                    <option value={240}>Meio período (4h)</option>
                    <option value={480}>Dia inteiro (8h)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Recorrência</label>
                  <select
                    value={resRecorrencia}
                    onChange={(e) => setResRecorrencia(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="unica">Única</option>
                    <option value="semanal">Semanal</option>
                    <option value="quinzenal">Quinzenal</option>
                  </select>
                </div>
                {resRecorrencia !== 'unica' && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Repetir Até</label>
                    <input
                      type="date"
                      value={resRecorrAte}
                      onChange={(e) => setResRecorrAte(e.target.value)}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações</label>
                <input
                  type="text"
                  value={resObs}
                  onChange={(e) => setResObs(e.target.value)}
                  placeholder="Ex: Treinamento, dinâmica de grupo..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                />
              </div>

              {/* Estimate Preview */}
              <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/25 rounded-xl flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase">Valor Estimado</span>
                  <span className="text-lg font-black text-emerald-400 font-mono">
                    {formatBRL(calcReservaValor(locatarios.find(l => l.id === resLocId), resDuracao))}
                  </span>
                </div>
                <div className="text-right text-[9px] text-slate-500">
                  Calculado de acordo com as tarifas do locatário.
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReservaModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg"
                >
                  Salvar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DETALHES DE RESERVA ── */}
      {isDetReservaModalOpen && selectedRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in text-xs">
            <div className="p-5 border-b border-white/[0.04] bg-[#131622]/40 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Detalhes da Reserva</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Visualize as informações e cancele ou exclua a reserva</p>
              </div>
              <button onClick={() => setIsDetReservaModalOpen(false)} className="text-slate-400 hover:text-white text-base">&times;</button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[10px] font-mono">
                  {selectedLoc?.nome.charAt(0) || '?'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-200 text-xs">{selectedLoc?.nome || 'Locatário'}</h4>
                  <p className="text-[10px] text-slate-400">{selectedLoc?.esp || '—'}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold uppercase ml-auto ${getSalaColorClass(selectedSala?.cor || 'sala1')}`}>
                  {selectedSala?.nome || 'Sala'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl">
                  <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Data</span>
                  <span className="text-xs font-bold text-slate-200">{new Date(`${selectedRes.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl">
                  <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Horário</span>
                  <span className="text-xs font-bold text-slate-200">{selectedRes.horaIni} – {selectedRes.horaFim} ({selectedRes.durMin} min)</span>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl">
                  <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Recorrência</span>
                  <span className="text-xs font-bold text-slate-200 capitalize">{selectedRes.recorrencia}</span>
                </div>
                <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl">
                  <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Valor Estimado</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{formatBRL(calcReservaValor(selectedLoc, selectedRes.durMin))}</span>
                </div>
              </div>

              {selectedRes.obs && (
                <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-xl">
                  <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Observações</span>
                  <p className="text-slate-300 text-xs">{selectedRes.obs}</p>
                </div>
              )}

              {/* Cancel / Delete Actions */}
              <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedRes.recorrencia !== 'unica') {
                      if (confirm('Cancelar toda a série de reservas?')) {
                        handleReservaCancel(selectedRes.id, 'todas');
                      }
                    } else {
                      if (confirm('Cancelar esta reserva?')) {
                        handleReservaCancel(selectedRes.id, 'unica');
                      }
                    }
                  }}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-xl font-bold transition-all text-[10px]"
                >
                  Cancelar Reserva
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedRes.recorrencia !== 'unica') {
                        if (confirm('Deseja excluir permanentemente toda a série de reservas?')) {
                          handleReservaDelete(selectedRes.id, 'todas');
                        }
                      } else {
                        if (confirm('Excluir permanentemente esta reserva?')) {
                          handleReservaDelete(selectedRes.id, 'unica');
                        }
                      }
                    }}
                    className="px-3 py-2 border border-white/[0.06] text-slate-400 hover:text-slate-200 rounded-xl font-bold"
                  >
                    Excluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsDetReservaModalOpen(false)}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTÃO DE SALAS (List & Add) ── */}
      {isSalaModalOpen && editSalaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          {/* Managed inside handleSalaSubmit or via room list panel */}
        </div>
      )}

      {isSalaModalOpen === false && (
        /* Hidden rooms modal list panel wrapper for room configurations */
        <div className="hidden"></div>
      )}
    </div>
  );
};
