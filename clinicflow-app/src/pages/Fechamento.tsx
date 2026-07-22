import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, Users, Award, Printer, Check, ShieldAlert, ArrowUpRight, CheckCircle2, AlertTriangle, FileText, Download, Edit3, Loader, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { PagamentoTerapeuta, FechamentoMensal } from '../types';

interface FechamentoProps {
  initialTab?: 'calculo' | 'financeiro';
}

export const Fechamento: React.FC<FechamentoProps> = ({ initialTab = 'calculo' }) => {
  const { agendamentos, profissionais, guias, planos, refreshAll, loadAgendamentosMes, getBaseStatus } = useApp();

  const [activeTab, setActiveTab] = useState<'calculo' | 'financeiro'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  // Tab 1: Calculo States
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calculated, setCalculated] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [savingFechamento, setSavingFechamento] = useState(false);
  
  const [terapeutasCalculados, setTerapeutasCalculados] = useState<any[]>([]);
  
  // Tab 2: Financeiro States
  const [finRegistros, setFinRegistros] = useState<PagamentoTerapeuta[]>([]);
  const [loadingFin, setLoadingFin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [finMesFilter, setFinMesFilter] = useState('');
  const [finStatusFilter, setFinStatusFilter] = useState('');
  
  // Edit Payment Modal States
  const [editingPayment, setEditingPayment] = useState<PagamentoTerapeuta | null>(null);
  const [modalStatus, setModalStatus] = useState<'pendente' | 'pago'>('pendente');
  const [modalValorPago, setModalValorPago] = useState(0);
  const [modalDataPagamento, setModalDataPagamento] = useState('');
  const [modalNfNome, setModalNfNome] = useState('');
  const [modalNfUrl, setModalNfUrl] = useState('');
  const [modalObs, setModalObs] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [selectedProfDetail, setSelectedProfDetail] = useState<any | null>(null);

  // Load financeiro records
  const loadFinanceiro = async () => {
    setLoadingFin(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_terapeutas')
        .select('*')
        .order('competencia', { ascending: false });
      if (error) throw error;
      setFinRegistros(data.map(mappers.dbToPagamento));
    } catch (e) {
      console.error('[ClinicFlow Fechamento] Error loading payments:', e);
    } finally {
      setLoadingFin(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'financeiro') {
      loadFinanceiro();
    }
  }, [activeTab]);

  // Calculate Fechamento
  const handleCalculate = async () => {
    setCalculating(true);
    
    let currentAgendamentos = agendamentos;
    try {
      const fetched = await loadAgendamentosMes(selectedMonth);
      if (fetched && fetched.length > 0) {
        // Merge fetched data with current local array for immediate calculation
        const map = new Map(agendamentos.map(a => [a.id, a]));
        fetched.forEach(a => map.set(a.id, a));
        currentAgendamentos = Array.from(map.values());
      }
    } catch(e) {
      console.error('[ClinicFlow Fechamento] Error pre-loading month:', e);
    }
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const primDay = `${selectedMonth}-01`;
    const ultDay = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Filter attended appointments of selected month
    const atendidos = currentAgendamentos.filter(a => 
      getBaseStatus(a.status) === 'atendido' && 
      a.dataISO >= primDay && 
      a.dataISO <= ultDay
    );

    // Filter ALL appointments of selected month
    const todosAgendamentos = currentAgendamentos.filter(a => 
      a.dataISO >= primDay && 
      a.dataISO <= ultDay
    );

    const terapeutaFechamentos: any[] = [];

    profissionais.forEach(p => {
      const profAppts = atendidos.filter(a => a.profId === p.id);
      const profApptsAll = todosAgendamentos.filter(a => a.profId === p.id);
      if (profApptsAll.length === 0) return;

      // Agrupa por paciente com breakdown por categoria/duração
      const pacientesMap: {
        [nome: string]: {
          atendidos30: number;
          atendidos60: number;
          atendidosDev: number;
          atendidosAval: number;
          atendidosPart: number;
          faltas: number;
          justificadas: number;
        };
      } = {};

      profApptsAll.forEach(a => {
        const pacNome = a.paciente;
        if (!pacientesMap[pacNome]) {
          pacientesMap[pacNome] = {
            atendidos30: 0, atendidos60: 0,
            atendidosDev: 0, atendidosAval: 0, atendidosPart: 0,
            faltas: 0, justificadas: 0
          };
        }

        const isAtendido = getBaseStatus(a.status) === 'atendido' || a.status.toLowerCase().includes('atendido');
        const isFalta = a.status.toLowerCase().includes('falta') || getBaseStatus(a.status) === 'cancelado';
        const isJustificada = a.status.toLowerCase().includes('justific') || a.status.toLowerCase().includes('desmarcado') || getBaseStatus(a.status) === 'desmarcado';
        const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
        const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
        const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');

        if (isAtendido) {
          if (isParticular) {
            pacientesMap[pacNome].atendidosPart++;
          } else if (isDev) {
            pacientesMap[pacNome].atendidosDev++;
          } else if (isAval) {
            pacientesMap[pacNome].atendidosAval++;
          } else {
            const dur = a.durMin || 30;
            if (dur >= 60) {
              pacientesMap[pacNome].atendidos60++;
            } else {
              pacientesMap[pacNome].atendidos30++;
            }
          }
        } else if (isFalta) {
          pacientesMap[pacNome].faltas++;
        } else if (isJustificada) {
          pacientesMap[pacNome].justificadas++;
        }
      });

      const pacientesLista = Object.entries(pacientesMap).map(([nome, counts]) => ({
        nome,
        ...counts,
        atendidos: counts.atendidos30 + counts.atendidos60 + counts.atendidosDev + counts.atendidosAval + counts.atendidosPart,
        total: counts.atendidos30 + counts.atendidos60 + counts.atendidosDev + counts.atendidosAval + counts.atendidosPart + counts.faltas + counts.justificadas
      })).sort((a, b) => a.nome.localeCompare(b.nome));

      const profDesmarquesApos18 = profApptsAll.filter(a => {
        const isDesmarcado = getBaseStatus(a.status) === 'desmarcado' || a.status.toLowerCase().includes('desmarcado');
        return isDesmarcado && a.hora >= '18:00';
      });

      const countDesmarqueApos18 = profDesmarquesApos18.length;
      const valorDesmarqueApos18Total = countDesmarqueApos18 * parseFloat((p as any).valorDesmarqueApos18 || 0);

      let count30 = 0;
      let valor30 = 0;
      let count60 = 0;
      let valor60 = 0;
      let countDev = 0;
      let valorDev = 0;
      let countAval = 0;
      let countPart = 0;
      let valorPart = 0;

      profAppts.forEach(a => {
        const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
        const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
        const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');

        if (isParticular) {
          countPart++;
          const partSessionVal = parseFloat((p as any).valorParticular || 0);
          valorPart += partSessionVal;
        } else if (isAval) {
          countAval++;
        } else if (isDev) {
          countDev++;
          const devSessionVal = p.valorAval || 0;
          valorDev += devSessionVal;
        } else {
          const dur = a.durMin || 30;
          if (dur >= 60) {
            count60++;
            const sessionVal = parseFloat((p as any).valor60 || 100);
            valor60 += sessionVal;
          } else {
            count30++;
            const sessionVal = parseFloat((p as any).valor30 || 60);
            valor30 += sessionVal;
          }
        }
      });

      if (count30 > 0 || count60 > 0 || countDev > 0 || countAval > 0 || countPart > 0 || countDesmarqueApos18 > 0 || pacientesLista.length > 0) {
        terapeutaFechamentos.push({
          prof: p,
          count30,
          valor30,
          count60,
          valor60,
          countDev,
          valorDev,
          countAval,
          countPart,
          valorPart,
          countDesmarqueApos18,
          valorDesmarqueApos18Total,
          totalValor: valor30 + valor60 + valorDev + valorPart + valorDesmarqueApos18Total,
          totalSessoes: count30 + count60 + countDev + countAval + countPart + countDesmarqueApos18,
          pacientesLista
        });
      }
    });

    setTerapeutasCalculados(terapeutaFechamentos);
    setCalculated(true);
    setCalculating(false);
  };

  const handlePrintSynthetic = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalValor = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalValor, 0);
    const totalSessoes = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalSessoes, 0);

    const rows = terapeutasCalculados.map(tc => {
      const p = tc.prof;
      let bankInfo = '—';
      if (p.pagarComo === 'pix') {
        bankInfo = `<strong>Pix:</strong> ${p.pix || 'Não informado'}`;
      } else {
        bankInfo = `<strong>TED:</strong> ${p.banco || 'Não informado'} | <strong>Ag:</strong> ${p.agencia || '—'} | <strong>Cc:</strong> ${p.conta || '—'} (${p.contaTipo || 'PF'}${p.razaoSocial ? ` - ${p.razaoSocial}` : ''})`;
      }

      return `
        <tr>
          <td>${p.nome}</td>
          <td>${p.esp || '—'}</td>
          <td align="center">${tc.totalSessoes}</td>
          <td align="right">R$ ${tc.totalValor.toFixed(2)}</td>
          <td>${bankInfo}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Relatório Sintético de Fechamento - ${formatMonthLabel(selectedMonth)}</title>
          <style>
            body { font-family: sans-serif; color: #333; margin: 20px; font-size: 12px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .total-row { font-weight: bold; background-color: #fafafa; }
            @media print {
              button { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1>Relatório Sintético de Fechamento</h1>
            <button onclick="window.print()" style="padding: 6px 12px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Imprimir</button>
          </div>
          <h2>Competência: ${formatMonthLabel(selectedMonth)}</h2>
          <table>
            <thead>
              <tr>
                <th>Profissional</th>
                <th>Especialidade</th>
                <th style="text-align: center;">Atendimentos</th>
                <th style="text-align: right;">Valor a Pagar</th>
                <th>Dados Bancários</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="total-row">
                <td colspan="2">TOTAL</td>
                <td align="center">${totalSessoes}</td>
                <td align="right">R$ ${totalValor.toFixed(2)}</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrintAnalytic = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const sections = terapeutasCalculados.map(tc => {
      const p = tc.prof;
      let bankInfo = '—';
      if (p.pagarComo === 'pix') {
        bankInfo = `<strong>Pix:</strong> ${p.pix || 'Não informado'}`;
      } else {
        bankInfo = `<strong>TED:</strong> ${p.banco || 'Não informado'} | <strong>Ag:</strong> ${p.agencia || '—'} | <strong>Cc:</strong> ${p.conta || '—'} (${p.contaTipo || 'PF'}${p.razaoSocial ? ` - ${p.razaoSocial}` : ''})`;
      }

      const patientRows = tc.pacientesLista.map((pac: any) => `
        <tr>
          <td>${pac.nome}</td>
          <td align="center">${pac.atendidos}</td>
          <td align="center">${pac.faltas}</td>
          <td align="center">${pac.justificadas}</td>
          <td align="center" style="font-weight: bold;">${pac.total}</td>
        </tr>
      `).join('');

      return `
        <div class="prof-section" style="page-break-inside: avoid; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px;">
            <div>
              <h3 style="margin: 0; font-size: 14px;">${p.nome}</h3>
              <span style="font-size: 11px; color: #666;">${p.esp || 'Psicologia'}</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 13px; font-weight: bold; color: #4f46e5;">Valor a Pagar: R$ ${tc.totalValor.toFixed(2)}</span>
              <div style="font-size: 10px; color: #555; margin-top: 4px;">${bankInfo}</div>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: left;">Paciente</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; width: 100px;">Atendimentos</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; width: 100px;">Faltas</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; width: 100px;">Justificativas</th>
                <th style="border: 1px solid #e5e7eb; padding: 6px; text-align: center; width: 100px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${patientRows}
              <tr style="font-weight: bold; background-color: #f3f4f6;">
                <td style="border: 1px solid #e5e7eb; padding: 6px;">Total do Profissional</td>
                <td style="border: 1px solid #e5e7eb; padding: 6px;" align="center">${tc.pacientesLista.reduce((acc: number, p: any) => acc + p.atendidos, 0)}</td>
                <td style="border: 1px solid #e5e7eb; padding: 6px;" align="center">${tc.pacientesLista.reduce((acc: number, p: any) => acc + p.faltas, 0)}</td>
                <td style="border: 1px solid #e5e7eb; padding: 6px;" align="center">${tc.pacientesLista.reduce((acc: number, p: any) => acc + p.justificadas, 0)}</td>
                <td style="border: 1px solid #e5e7eb; padding: 6px;" align="center">${tc.pacientesLista.reduce((acc: number, p: any) => acc + p.total, 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Relatório Analítico de Fechamento - ${formatMonthLabel(selectedMonth)}</title>
          <style>
            body { font-family: sans-serif; color: #333; margin: 20px; font-size: 12px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 25px; }
            @media print {
              button { display: none; }
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h1>Relatório Analítico de Fechamento</h1>
            <button onclick="window.print()" style="padding: 6px 12px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Imprimir</button>
          </div>
          <h2>Competência: ${formatMonthLabel(selectedMonth)}</h2>
          ${sections}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Save Fechamento
  const handleConfirmFechamento = async () => {
    setSavingFechamento(true);
    const totalSessoes = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalSessoes, 0);
    const totalValor = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalValor, 0);
    const totalProfs = terapeutasCalculados.length;

    const payload = {
      competencia: selectedMonth,
      totalSessoes,
      totalValor,
      totalProfissionais: totalProfs,
      detalhes: {
        terapeutas: terapeutasCalculados.map(tc => ({
          profId: tc.prof.id,
          nome: tc.prof.nome,
          count30: tc.count30,
          valor30: tc.valor30,
          count60: tc.count60,
          valor60: tc.valor60,
          countDev: tc.countDev,
          valorDev: tc.valorDev,
          countAval: tc.countAval,
          countPart: tc.countPart,
          valorPart: tc.valorPart,
          countDesmarqueApos18: tc.countDesmarqueApos18,
          valorDesmarqueApos18Total: tc.valorDesmarqueApos18Total,
          totalValor: tc.totalValor,
          totalSessoes: tc.totalSessoes
        }))
      },
      confirmadoPor: 'Administrador',
      confirmadoEm: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('fechamentos_mensais')
        .upsert(mappers.fechamentoToDb(payload), { onConflict: 'competencia' });
      if (error) throw error;
      alert(`Sucesso! Fechamento de ${selectedMonth} gravado no banco de dados!`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gravar fechamento mensal.');
    } finally {
      setSavingFechamento(false);
    }
  };

  // Generate payments from calculations (Financeiro Import)
  const handleGenerateFromFechamento = async () => {
    setLoadingFin(true);
    
    let currentAgendamentos = agendamentos;
    try {
      const fetched = await loadAgendamentosMes(selectedMonth);
      if (fetched && fetched.length > 0) {
        // Merge fetched data with current local array for immediate calculation
        const map = new Map(agendamentos.map(a => [a.id, a]));
        fetched.forEach(a => map.set(a.id, a));
        currentAgendamentos = Array.from(map.values());
      }
    } catch(e) {
      console.error('[ClinicFlow Fechamento] Error pre-loading month:', e);
    }
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const primDay = `${selectedMonth}-01`;
    const ultDay = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Filter attended appointments and desmarques after 18:00
    const atendidos = currentAgendamentos.filter(a => {
      const isDateValid = a.dataISO >= primDay && a.dataISO <= ultDay;
      if (!isDateValid) return false;
      const isAtendido = getBaseStatus(a.status) === 'atendido';
      const isDesmarcado = getBaseStatus(a.status) === 'desmarcado' || a.status.toLowerCase().includes('desmarcado');
      const isDesmarcadoApos18 = isDesmarcado && a.hora >= '18:00';
      return isAtendido || isDesmarcadoApos18;
    });

    if (atendidos.length === 0) {
      alert('Nenhum atendimento marcado como "Atendido" ou desmarque após as 18:00 no período selecionado.');
      setLoadingFin(false);
      return;
    }

    const grupos: { [key: string]: any } = {};

    atendidos.forEach(a => {
      const prof = profissionais.find(p => p.id === a.profId);
      const profNome = prof ? prof.nome : `Prof #${a.profId}`;
      const profId = a.profId || null;

      // Group by: regular session vs devolution vs particular
      const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
      const isDev = a.obs?.toLowerCase().includes('devolutiva') || a.paciente.toLowerCase().includes('devolutiva');
      const isAval = a.obs?.toLowerCase().includes('avaliação') || a.obs?.toLowerCase().includes('aval');
      const isDesmarcado = getBaseStatus(a.status) === 'desmarcado' || a.status.toLowerCase().includes('desmarcado');
      const isDesmarcadoApos18 = isDesmarcado && a.hora >= '18:00';

      let tipo: 'sessao' | 'devolutiva' | 'avaliacao' | 'particular' = 'sessao';
      if (isParticular) {
        tipo = 'particular';
      } else if (isAval) {
        tipo = 'avaliacao';
      } else if (isDev) {
        tipo = 'devolutiva';
      }

      const key = `${profId}__${tipo}`;
      if (!grupos[key]) {
        grupos[key] = {
          profissionalId: profId,
          profissional: profNome,
          tipo,
          pacientes: new Set(),
          valor: 0
        };
      }
      grupos[key].pacientes.add(a.paciente);

      // Add to value
      if (tipo !== 'avaliacao' && prof) {
        if (isDesmarcadoApos18) {
          grupos[key].valor += parseFloat((prof as any).valorDesmarqueApos18 || 0);
        } else if (tipo === 'particular') {
          grupos[key].valor += parseFloat((prof as any).valorParticular || 0);
        } else if (tipo === 'devolutiva') {
          grupos[key].valor += prof.valorAval || 0;
        } else {
          const dur = a.durMin || 30;
          const defaultSessionVal = dur >= 60 
            ? parseFloat((prof as any).valor60 || 100) 
            : parseFloat((prof as any).valor30 || 60);
          grupos[key].valor += defaultSessionVal;
        }
      }
    });

    try {
      let novos = 0;
      for (const g of Object.values(grupos)) {
        const keyExist = finRegistros.find(r => 
          r.competencia === selectedMonth && 
          r.profissional === g.profissional && 
          r.tipo === g.tipo
        );

        const newId = keyExist ? keyExist.id : `fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const reg: PagamentoTerapeuta = {
          id: newId,
          profissionalId: g.profissionalId,
          profissional: g.profissional,
          competencia: selectedMonth,
          tipo: g.tipo,
          qtdPacientes: g.pacientes.size,
          valor: g.valor,
          status: keyExist ? keyExist.status : 'pendente',
          valorPago: keyExist ? keyExist.valorPago : 0,
          dataPagamento: keyExist ? keyExist.dataPagamento : '',
          nfUrl: keyExist ? keyExist.nfUrl : '',
          nfNome: keyExist ? keyExist.nfNome : '',
          obs: keyExist ? keyExist.obs : ''
        };

        const { error } = await supabase
          .from('pagamentos_terapeutas')
          .upsert(mappers.pagamentoToDb(reg), { onConflict: 'id' });
        if (error) throw error;
        novos++;
      }

      await loadFinanceiro();
      alert('Repasses gerados e importados com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao importar repasses do fechamento.');
    } finally {
      setLoadingFin(false);
    }
  };

  // Open Edit Modal for payout
  const openEditModal = (p: PagamentoTerapeuta) => {
    setEditingPayment(p);
    setModalStatus(p.status);
    setModalValorPago(p.valorPago || p.valor);
    setModalDataPagamento(p.dataPagamento || new Date().toISOString().split('T')[0]);
    setModalNfNome(p.nfNome || '');
    setModalNfUrl(p.nfUrl || '');
    setModalObs(p.obs || '');
  };

  // Save Edit Modal
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setSavingPayment(true);

    const updated: PagamentoTerapeuta = {
      ...editingPayment,
      status: modalStatus,
      valorPago: modalStatus === 'pago' ? modalValorPago : 0,
      dataPagamento: modalStatus === 'pago' ? modalDataPagamento : '',
      nfNome: modalNfNome,
      nfUrl: modalNfUrl,
      obs: modalObs
    };

    try {
      const { error } = await supabase
        .from('pagamentos_terapeutas')
        .update(mappers.pagamentoToDb(updated))
        .eq('id', editingPayment.id);
      if (error) throw error;
      
      setEditingPayment(null);
      await loadFinanceiro();
      alert('Status de pagamento atualizado!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar pagamento do terapeuta.');
    } finally {
      setSavingPayment(false);
    }
  };

  // Inline status toggle helper
  const handleToggleStatus = async (p: PagamentoTerapeuta, newStatus: 'pendente' | 'pago') => {
    const updated: PagamentoTerapeuta = {
      ...p,
      status: newStatus,
      valorPago: newStatus === 'pago' ? p.valor : 0,
      dataPagamento: newStatus === 'pago' ? new Date().toISOString().split('T')[0] : ''
    };

    try {
      const { error } = await supabase
        .from('pagamentos_terapeutas')
        .update(mappers.pagamentoToDb(updated))
        .eq('id', p.id);
      if (error) throw error;
      await loadFinanceiro();
    } catch (e) {
      console.error(e);
      alert('Erro ao alterar status.');
    }
  };

  // Financeiro list calculations
  const filteredFin = finRegistros.filter(r => {
    const matchesSearch = r.profissional.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMes = !finMesFilter || r.competencia === finMesFilter;
    const matchesStatus = !finStatusFilter || r.status === finStatusFilter;
    return matchesSearch && matchesMes && matchesStatus;
  });

  const totPendente = filteredFin.filter(r => r.status === 'pendente' && r.tipo !== 'avaliacao').reduce((acc, r) => acc + r.valor, 0);
  const totPago = filteredFin.filter(r => r.status === 'pago' && r.tipo !== 'avaliacao').reduce((acc, r) => acc + (r.valorPago || r.valor), 0);
  const totNF = filteredFin.filter(r => r.nfUrl || r.nfNome).length;

  // Month list populated from existing records
  const uniqueMonths = Array.from(new Set(finRegistros.map(r => r.competencia))).sort((a, b) => b.localeCompare(a));

  const formatMonthLabel = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase());
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans font-semibold">Gestão Financeira</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Fechamento & Repasses</h2>
          <p className="text-xs text-slate-400 mt-1">Calcule fechamentos mensais por terapeuta e gerencie recibos e pagamentos</p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-[#131622]/60 backdrop-blur-md border border-white/[0.06] rounded-xl px-4 py-2 text-white font-bold font-mono focus:outline-none transition-all focus:border-indigo-500/50"
          />
          {activeTab === 'calculo' && (
            <button
              onClick={handleCalculate}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 rounded-xl font-bold border border-white/[0.06] transition-all"
            >
              <Calculator size={13} />
              Calcular
            </button>
          )}
        </div>
      </div>

      {/* TABS BAR */}
      <div className="flex gap-2 border-b border-white/[0.04] pb-1">
        <button
          onClick={() => setActiveTab('calculo')}
          className={`pb-3 px-4 font-bold transition-all relative ${
            activeTab === 'calculo'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Fechamento Mensal
        </button>
        <button
          onClick={() => setActiveTab('financeiro')}
          className={`pb-3 px-4 font-bold transition-all relative ${
            activeTab === 'financeiro'
              ? 'text-white border-b-2 border-indigo-500'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Repasses / Pagamentos
        </button>
      </div>

      {/* CALCULATOR TAB */}
      {activeTab === 'calculo' && (
        <div className="space-y-6">
          {calculated ? (
            <div className="space-y-6 animate-fade-in">
              {/* CALCULATED KPIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl shadow-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Faturamento do Repasse</span>
                    <p className="text-2xl font-black text-white mt-1.5 font-mono">
                      R$ {terapeutasCalculados.reduce((acc, tc) => acc + tc.totalValor, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 rounded-xl">
                    <DollarSign size={20} />
                  </div>
                </div>

                <div className="p-5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl shadow-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Sessões</span>
                    <p className="text-2xl font-black text-white mt-1.5 font-mono">
                      {terapeutasCalculados.reduce((acc, tc) => acc + tc.totalSessoes, 0)}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-xl">
                    <Users size={20} />
                  </div>
                </div>

                <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl shadow-xl flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terapeutas Ativos</span>
                    <p className="text-2xl font-black text-white mt-1.5 font-mono">
                      {terapeutasCalculados.length}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-xl">
                    <Award size={20} />
                  </div>
                </div>
              </div>

              {/* ACTION TOOLBAR */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handlePrintSynthetic}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 rounded-xl font-bold border border-white/[0.06] transition-all active:scale-95 text-xs cursor-pointer"
                >
                  <FileText size={13} />
                  Emitir Sintético
                </button>
                <button
                  onClick={handlePrintAnalytic}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 rounded-xl font-bold border border-white/[0.06] transition-all active:scale-95 text-xs cursor-pointer"
                >
                  <Printer size={13} />
                  Emitir Analítico
                </button>
                <button
                  onClick={handleConfirmFechamento}
                  disabled={savingFechamento}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95 text-xs"
                >
                  {savingFechamento && <Loader size={12} className="animate-spin" />}
                  Confirmar Fechamento
                </button>
              </div>

              {/* DETAILS SECTION */}
              <div className="space-y-4">
                <div className="p-5 bg-[#131622]/50 border border-white/[0.04] rounded-2xl">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    Fechamento Detalhado por Terapeuta
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {terapeutasCalculados.map((tc, i) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedProfDetail(tc)}
                        className="p-5 bg-[#161a26]/40 border border-white/[0.04] rounded-xl flex flex-col justify-between space-y-4 hover:border-indigo-500/40 hover:bg-[#161a26]/70 transition-all cursor-pointer group"
                        title="Clique para ver o detalhamento de pacientes"
                      >
                        <div>
                          <div className="flex justify-between items-start border-b border-white/[0.04] pb-2.5 mb-3">
                            <div>
                              <span className="font-bold text-slate-200 text-sm block">{tc.prof.nome}</span>
                              <span className="text-[10px] text-slate-400 font-semibold">{tc.prof.esp || 'Terapeuta'}</span>
                            </div>
                            <span className="font-mono font-bold text-indigo-400 text-base">R$ {tc.totalValor.toFixed(2)}</span>
                          </div>

                          <div className="space-y-2 text-[11px]">
                            {tc.count30 > 0 && (
                              <div className="flex justify-between items-center text-slate-300">
                                <span>Sessões Regulares (30 min)</span>
                                <span className="font-mono font-semibold">{tc.count30}x <span className="text-slate-500">•</span> R$ {tc.valor30.toFixed(2)}</span>
                              </div>
                            )}
                            {tc.count60 > 0 && (
                              <div className="flex justify-between items-center text-slate-300">
                                <span>Sessões Regulares (60 min)</span>
                                <span className="font-mono font-semibold">{tc.count60}x <span className="text-slate-500">•</span> R$ {tc.valor60.toFixed(2)}</span>
                              </div>
                            )}
                            {tc.countPart > 0 && (
                              <div className="flex justify-between items-center text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  Consulta Particular
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">Particular</span>
                                </span>
                                <span className="font-mono font-semibold text-indigo-400">{tc.countPart}x <span className="text-slate-500">•</span> R$ {tc.valorPart.toFixed(2)}</span>
                              </div>
                            )}
                            {tc.countDev > 0 && (
                              <div className="flex justify-between items-center text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  Devolutiva Neuropsicológica
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Repassa</span>
                                </span>
                                <span className="font-mono font-semibold text-emerald-400">{tc.countDev}x <span className="text-slate-500">•</span> R$ {tc.valorDev.toFixed(2)}</span>
                              </div>
                            )}
                            {tc.countAval > 0 && (
                              <div className="flex justify-between items-center text-slate-400">
                                <span className="flex items-center gap-1.5">
                                  Avaliação Neuropsicológica
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-white/10 font-medium">Sem Repasse / Não paga</span>
                                </span>
                                <span className="font-mono font-bold text-slate-500">{tc.countAval}x <span className="text-slate-500">•</span> R$ 0,00</span>
                              </div>
                            )}
                            {tc.countDesmarqueApos18 > 0 && (
                              <div className="flex justify-between items-center text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  Desmarques pós 18h
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">Desmarque</span>
                                </span>
                                <span className="font-mono font-semibold text-amber-400">{tc.countDesmarqueApos18}x <span className="text-slate-500">•</span> R$ {tc.valorDesmarqueApos18Total.toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-white/[0.04]">
                          <span>Total de Sessões no Período:</span>
                          <span className="font-mono font-bold text-slate-400">{tc.totalSessoes}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center bg-[#131622]/20 border border-dashed border-white/[0.08] rounded-2xl text-slate-500 flex flex-col items-center justify-center gap-3">
              <Calculator size={40} className="text-indigo-400/30" />
              <div>
                <p className="font-bold text-slate-300 text-sm">Nenhum fechamento calculado</p>
                <p className="text-xs text-slate-400 mt-1">Selecione o mês desejado e clique no botão Calcular acima.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FINANCEIRO TAB */}
      {activeTab === 'financeiro' && (
        <div className="space-y-6">
          {/* STATS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registros Importados</span>
              <p className="text-xl font-black text-white mt-1.5 font-mono">{filteredFin.length}</p>
            </div>
            <div className="p-4 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">A Pagar (Pendente)</span>
              <p className="text-xl font-black text-amber-400 mt-1.5 font-mono">R$ {totPendente.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Repassado (Pago)</span>
              <p className="text-xl font-black text-emerald-400 mt-1.5 font-mono">R$ {totPago.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-[#131622]/50 border border-white/[0.04] rounded-2xl shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Notas Fiscais Recebidas</span>
              <p className="text-xl font-black text-indigo-400 mt-1.5 font-mono">{totNF}</p>
            </div>
          </div>

          {/* FILTERS & CSV TOOLBAR */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl items-center">
            <div className="flex items-center gap-3 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por profissional..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 text-xs"
              />
            </div>

            <div>
              <select
                value={finMesFilter}
                onChange={(e) => setFinMesFilter(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="">— Todas as Competências —</option>
                {uniqueMonths.map(m => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={finStatusFilter}
                onChange={(e) => setFinStatusFilter(e.target.value)}
                className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
              >
                <option value="">— Todos os Status —</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>

            <button
              onClick={handleGenerateFromFechamento}
              className="flex justify-center items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              <Download size={14} />
              Gerar do Fechamento
            </button>
          </div>

          {/* PAYMENTS TABLE */}
          <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                    <th className="p-4">Profissional</th>
                    <th className="p-4 text-center">Competência</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-center">Qtd. Pacientes</th>
                    <th className="p-4">Valor Repasse</th>
                    <th className="p-4">Nota Fiscal</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {loadingFin ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader size={16} className="animate-spin text-indigo-500 inline-block mr-2" />
                        Carregando registros de pagamentos...
                      </td>
                    </tr>
                  ) : filteredFin.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="p-4 font-semibold text-slate-200 group-hover:text-indigo-400 transition-all">{r.profissional}</td>
                      <td className="p-4 text-center font-mono text-slate-400">{formatMonthLabel(r.competencia)}</td>
                      <td className="p-4 text-slate-300 capitalize">{r.tipo}</td>
                      <td className="p-4 text-center font-mono text-slate-300">{r.qtdPacientes}</td>
                      <td className="p-4 font-mono font-bold text-slate-200">
                        {r.tipo === 'avaliacao' ? '—' : `R$ ${r.valor.toFixed(2)}`}
                      </td>
                      <td className="p-4">
                        {r.nfNome ? (
                          <span className="text-[10px] text-indigo-400 font-medium underline cursor-pointer" title={r.nfUrl}>{r.nfNome}</span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Ausente</span>
                        )}
                      </td>
                      <td className="p-4">
                        <select
                          value={r.status}
                          onChange={(e) => handleToggleStatus(r, e.target.value as any)}
                          className={`bg-[#161a26] border text-[9px] font-bold rounded-lg px-2.5 py-1 focus:outline-none ${
                            r.status === 'pago'
                              ? 'text-emerald-400 border-emerald-500/15 bg-emerald-500/5'
                              : 'text-amber-400 border-amber-500/15 bg-amber-500/5'
                          }`}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="pago">Pago</option>
                        </select>
                      </td>
                      <td className="p-4 text-center flex justify-center gap-2">
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                          title="Detalhar / Receber Recibo"
                        >
                          <Edit3 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredFin.length === 0 && !loadingFin && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[#555d74] font-medium">
                        Nenhum registro de repasse encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Detalhes do Repasse
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{editingPayment.profissional} — {formatMonthLabel(editingPayment.competencia)}</p>
              </div>
              <button type="button" onClick={() => setEditingPayment(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSavePayment} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status do Pagamento</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                {modalStatus === 'pago' && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Valor Pago (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={modalValorPago}
                      onChange={(e) => setModalValorPago(parseFloat(e.target.value))}
                      className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {modalStatus === 'pago' && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Data do Pagamento</label>
                  <input
                    type="date"
                    required
                    value={modalDataPagamento}
                    onChange={(e) => setModalDataPagamento(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Nota Fiscal (Nome)</label>
                  <input
                    type="text"
                    value={modalNfNome}
                    onChange={(e) => setModalNfNome(e.target.value)}
                    placeholder="Ex: NF-1203.pdf"
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">NF (URL/Link)</label>
                  <input
                    type="text"
                    value={modalNfUrl}
                    onChange={(e) => setModalNfUrl(e.target.value)}
                    placeholder="Ex: https://drive.google.com/..."
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações / Notas Internas</label>
                <textarea
                  rows={2}
                  value={modalObs}
                  onChange={(e) => setModalObs(e.target.value)}
                  placeholder="Instruções de Pix, recibos anexos..."
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none focus:outline-none text-xs"
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02] text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs"
                >
                  {savingPayment && <Loader size={12} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CALCULATING LOADER OVERLAY */}
      {calculating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131622] border border-white/[0.08] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-center max-w-sm">
            <Loader size={40} className="animate-spin text-indigo-500" />
            <div>
              <p className="font-bold text-slate-200 text-sm">Calculando Fechamento...</p>
              <p className="text-xs text-slate-400 mt-1">Carregando agendamentos do Supabase e processando repasses.</p>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL BY PATIENT — agrupado por duração/tipo */}
      {selectedProfDetail && (() => {
        const lista: any[] = selectedProfDetail.pacientesLista;

        // Helpers para cada grupo
        const grupo60   = lista.filter((p: any) => p.atendidos60   > 0);
        const grupo30   = lista.filter((p: any) => p.atendidos30   > 0);
        const grupoDev  = lista.filter((p: any) => p.atendidosDev  > 0);
        const grupoAval = lista.filter((p: any) => p.atendidosAval > 0);
        const grupoPart = lista.filter((p: any) => p.atendidosPart > 0);

        const totalAtend = lista.reduce((s: number, p: any) => s + p.atendidos, 0);
        const totalFalta = lista.reduce((s: number, p: any) => s + p.faltas, 0);
        const totalJust  = lista.reduce((s: number, p: any) => s + p.justificadas, 0);

        const GroupTable = ({
          label, color, patients, field
        }: { label: string; color: string; patients: any[]; field: string }) => {
          if (!patients.length) return null;
          const subtotal = patients.reduce((s: number, p: any) => s + p[field], 0);
          return (
            <div className="bg-[#131622]/50 border border-white/[0.04] rounded-xl overflow-hidden">
              <div className={`px-4 py-2 flex items-center gap-2 border-b border-white/[0.04] bg-white/[0.01]`}>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${color}`}>{label}</span>
                <span className={`ml-auto text-xs font-bold ${color}`}>{subtotal} sessões</span>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="text-slate-500 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04]">
                    <th className="p-3">Paciente</th>
                    <th className="p-3 text-center">Qtd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {patients.map((pac: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-3 font-semibold text-slate-200">{pac.nome}</td>
                      <td className={`p-3 text-center font-bold ${color}`}>{pac[field]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in text-xs">
              {/* Header */}
              <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Detalhamento por Duração de Atendimento
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {selectedProfDetail.prof.nome} — {((): string => {
                      const [y, m] = selectedMonth.split('-');
                      return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                    })()}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedProfDetail(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
              </div>

              {/* Resumo rápido */}
              <div className="px-5 py-3 border-b border-white/[0.04] bg-[#0d0f1a]/60 grid grid-cols-4 gap-3">
                {[
                  { label: '60 min', val: grupo60.reduce((s: number, p: any) => s + p.atendidos60, 0), color: 'text-sky-400' },
                  { label: '30 min', val: grupo30.reduce((s: number, p: any) => s + p.atendidos30, 0), color: 'text-violet-400' },
                  { label: 'Devolutivas', val: grupoDev.reduce((s: number, p: any) => s + p.atendidosDev, 0), color: 'text-amber-400' },
                  { label: 'Total', val: totalAtend, color: 'text-emerald-400' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex flex-col items-center bg-white/[0.02] rounded-lg py-2 border border-white/[0.04]">
                    <span className={`text-base font-black ${color}`}>{val}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wide mt-0.5">{label}</span>
                  </div>
                ))}
              </div>

              {/* Corpo com grupos */}
              <div className="p-5 overflow-y-auto flex-1 space-y-3">
                <GroupTable label="⏱ 60 Minutos"    color="text-sky-400"     patients={grupo60}   field="atendidos60" />
                <GroupTable label="⏱ 30 Minutos"    color="text-violet-400"  patients={grupo30}   field="atendidos30" />
                <GroupTable label="📋 Devolutivas"  color="text-amber-400"   patients={grupoDev}  field="atendidosDev" />
                <GroupTable label="🔬 Avaliações"   color="text-rose-400"    patients={grupoAval} field="atendidosAval" />
                <GroupTable label="💳 Particular"   color="text-emerald-400" patients={grupoPart} field="atendidosPart" />

                {/* Faltas e Justificativas */}
                {(totalFalta > 0 || totalJust > 0) && (
                  <div className="bg-[#131622]/50 border border-white/[0.04] rounded-xl overflow-hidden">
                    <div className="px-4 py-2 border-b border-white/[0.04] bg-white/[0.01]">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ausências</span>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04]">
                          <th className="p-3">Paciente</th>
                          <th className="p-3 text-center text-rose-400">Faltas</th>
                          <th className="p-3 text-center text-amber-400">Justificativas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.02]">
                        {lista.filter((p: any) => p.faltas > 0 || p.justificadas > 0).map((pac: any, idx: number) => (
                          <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                            <td className="p-3 font-semibold text-slate-200">{pac.nome}</td>
                            <td className="p-3 text-center text-rose-400 font-bold">{pac.faltas || '—'}</td>
                            <td className="p-3 text-center text-amber-400 font-bold">{pac.justificadas || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/[0.04] bg-[#131622]/40 flex justify-end">
                <button type="button" onClick={() => setSelectedProfDetail(null)}
                  className="px-4 py-2 bg-[#161a26] border border-white/[0.06] hover:bg-white/5 rounded-xl text-slate-300 font-bold transition-all text-xs">
                  Fechar Detalhes
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
