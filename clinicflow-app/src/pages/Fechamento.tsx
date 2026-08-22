import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, Users, Award, Printer, Check, ShieldAlert, ArrowUpRight, CheckCircle2, AlertTriangle, FileText, Download, Edit3, Loader, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';
import { financeiroFluxoCaixaService } from '../services/financeiroFluxoCaixaService';
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
  const [isManualDiscountOpen, setIsManualDiscountOpen] = useState(false);
  const [manualTipo, setManualTipo] = useState<'desconto_mes_anterior' | 'adicional_mes_anterior'>('desconto_mes_anterior');
  const [manualProfId, setManualProfId] = useState('');
  const [manualComp, setManualComp] = useState(new Date().toISOString().substring(0, 7));
  const [manualValor, setManualValor] = useState('');
  const [manualObs, setManualObs] = useState('');
  const [savingManualDiscount, setSavingManualDiscount] = useState(false);

  const handleSaveManualDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualProfId || !manualComp || !manualValor) return;
    setSavingManualDiscount(true);

    const prof = profissionais.find(p => String(p.id) === String(manualProfId));
    const val = parseFloat(manualValor);
    const isDesconto = manualTipo === 'desconto_mes_anterior';
    const finalVal = isDesconto ? -Math.abs(val) : Math.abs(val);

    const reg: PagamentoTerapeuta = {
      id: `ajuste_manual_${Date.now()}`,
      profissionalId: Number(manualProfId),
      profissional: prof ? prof.nome : 'Terapeuta',
      competencia: manualComp,
      tipo: manualTipo,
      qtdPacientes: 0,
      valor: finalVal,
      status: 'pago',
      valorPago: finalVal,
      dataPagamento: new Date().toISOString().split('T')[0],
      nfUrl: '',
      nfNome: '',
      obs: manualObs || (isDesconto ? 'Ajuste / Desconto manual de repasse' : 'Ajuste / Adicional manual de repasse')
    };

    try {
      const { error } = await supabase
        .from('pagamentos_terapeutas')
        .upsert(mappers.pagamentoToDb(reg), { onConflict: 'id' });
      if (error) throw error;

      setIsManualDiscountOpen(false);
      setManualValor('');
      setManualObs('');
      await loadFinanceiro();
      alert('Ajuste cadastrado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar ajuste manual.');
    } finally {
      setSavingManualDiscount(false);
    }
  };

  // Load financeiro records
  const loadFinanceiro = async () => {
    setLoadingFin(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_terapeutas')
        .select('*')
        .order('competencia', { ascending: false });
      if (error) throw error;
      const list = (data || []).map(mappers.dbToPagamento);
      setFinRegistros(list);
      return list;
    } catch (e) {
      console.error('[ClinicFlow Fechamento] Error loading payments:', e);
      return [];
    } finally {
      setLoadingFin(false);
    }
  };

  useEffect(() => {
    loadFinanceiro();
  }, []);

  const getPrevMonth = (ym: string): string => {
    if (!ym || !ym.includes('-')) return '';
    const [yearStr, monthStr] = ym.split('-');
    let year = parseInt(yearStr);
    let month = parseInt(monthStr);
    if (month === 1) {
      year -= 1;
      month = 12;
    } else {
      month -= 1;
    }
    return `${year}-${String(month).padStart(2, '0')}`;
  };

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
    
    const currentFin = await loadFinanceiro();
    
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
        const tipoLower = a.tipo?.toLowerCase() || '';
        const obsLower = a.obs?.toLowerCase() || '';
        const pacLower = a.paciente?.toLowerCase() || '';

        const isDev = tipoLower.includes('devolutiva') || obsLower.includes('devolutiva') || pacLower.includes('devolutiva');
        const isAval = tipoLower.includes('avaliacao') || tipoLower.includes('avaliac') || tipoLower.includes('continua') || obsLower.includes('avaliação') || obsLower.includes('aval');

        if (isAtendido) {
          if (isParticular) {
            pacientesMap[pacNome].atendidosPart++;
          } else if (isDev) {
            pacientesMap[pacNome].atendidosDev++;
          } else if (isAval) {
            pacientesMap[pacNome].atendidosAval++;
          } else {
            const dur = a.durMin || 30;
            if (dur >= 45) {
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
        const tipoLower = a.tipo?.toLowerCase() || '';
        const obsLower = a.obs?.toLowerCase() || '';
        const pacLower = a.paciente?.toLowerCase() || '';

        const isDev = tipoLower.includes('devolutiva') || obsLower.includes('devolutiva') || pacLower.includes('devolutiva');
        const isAval = tipoLower.includes('avaliacao') || tipoLower.includes('avaliac') || tipoLower.includes('continua') || obsLower.includes('avaliação') || obsLower.includes('aval');

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
          if (dur >= 45) {
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

      const totalBruto = valor30 + valor60 + valorDev + valorPart + valorDesmarqueApos18Total;

      let valorDescontoMesAnterior = 0;
      let obsDescontoMesAnterior = '';
      let valorAdicionalMesAnterior = 0;
      let obsAdicionalMesAnterior = '';
      const prevMonth = getPrevMonth(selectedMonth);

      if (prevMonth) {
        const prevFinProf = currentFin.filter(
          r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === prevMonth
        );
        if (prevFinProf.length > 0) {
          const prevDevido = prevFinProf.reduce((acc, r) => {
            if (r.tipo === 'avaliacao') return acc;
            if (r.tipo === 'desconto_mes_anterior') return acc - Math.abs(r.valor);
            if (r.tipo === 'adicional_mes_anterior') return acc + Math.abs(r.valor);
            return acc + r.valor;
          }, 0);
          const prevPago = prevFinProf.filter(r => r.status === 'pago').reduce((acc, r) => acc + (r.valorPago || r.valor), 0);

          if (prevPago > prevDevido) {
            valorDescontoMesAnterior = prevPago - prevDevido;
            obsDescontoMesAnterior = `Excedente de R$ ${valorDescontoMesAnterior.toFixed(2)} pago a maior em ${formatMonthLabel(prevMonth)}`;
          } else if (prevPago < prevDevido && prevFinProf.some(r => r.status === 'pago')) {
            valorAdicionalMesAnterior = prevDevido - prevPago;
            obsAdicionalMesAnterior = `Valor faltante de R$ ${valorAdicionalMesAnterior.toFixed(2)} pago a menor em ${formatMonthLabel(prevMonth)}`;
          }
        }

        const regDescontoAtual = currentFin.find(
          r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === selectedMonth && r.tipo === 'desconto_mes_anterior'
        );
        if (regDescontoAtual) {
          valorDescontoMesAnterior = Math.abs(regDescontoAtual.valor);
          if (regDescontoAtual.obs) obsDescontoMesAnterior = regDescontoAtual.obs;
        }

        const regAdicionalAtual = currentFin.find(
          r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === selectedMonth && r.tipo === 'adicional_mes_anterior'
        );
        if (regAdicionalAtual) {
          valorAdicionalMesAnterior = Math.abs(regAdicionalAtual.valor);
          if (regAdicionalAtual.obs) obsAdicionalMesAnterior = regAdicionalAtual.obs;
        }
      }

      const totalValor = Math.max(0, totalBruto - valorDescontoMesAnterior + valorAdicionalMesAnterior);

      if (count30 > 0 || count60 > 0 || countDev > 0 || countAval > 0 || countPart > 0 || countDesmarqueApos18 > 0 || valorDescontoMesAnterior > 0 || valorAdicionalMesAnterior > 0 || pacientesLista.length > 0) {
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
          valorDescontoMesAnterior,
          obsDescontoMesAnterior,
          valorAdicionalMesAnterior,
          obsAdicionalMesAnterior,
          totalBruto,
          totalValor,
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
  // Helper to sync calculated repasses (including sessions & discounts/additions) to database
  const syncRepassesFromCalculations = async (month: string, currentTerapeutasCalculados: any[], currentAgendamentsList: any[]) => {
    const [year, monthNum] = month.split('-').map(Number);
    const primDay = `${month}-01`;
    const ultDay = new Date(year, monthNum, 0).toISOString().split('T')[0];

    const atendidos = currentAgendamentsList.filter(a => {
      const isDateValid = a.dataISO >= primDay && a.dataISO <= ultDay;
      if (!isDateValid) return false;
      const isAtendido = getBaseStatus(a.status) === 'atendido';
      const isDesmarcado = getBaseStatus(a.status) === 'desmarcado' || a.status.toLowerCase().includes('desmarcado');
      const isDesmarcadoApos18 = isDesmarcado && a.hora >= '18:00';
      return isAtendido || isDesmarcadoApos18;
    });

    const grupos: { [key: string]: any } = {};

    atendidos.forEach(a => {
      const prof = profissionais.find(p => p.id === a.profId);
      const profNome = prof ? prof.nome : `Prof #${a.profId}`;
      const profId = a.profId || null;

      const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
      const tipoLower = a.tipo?.toLowerCase() || '';
      const obsLower = a.obs?.toLowerCase() || '';

      const isDev = tipoLower.includes('devolutiva') || obsLower.includes('devolutiva');
      const isAval = tipoLower.includes('avaliacao') || tipoLower.includes('avaliac') || tipoLower.includes('continua') || obsLower.includes('avaliação') || obsLower.includes('aval');
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

      if (tipo !== 'avaliacao' && prof) {
        if (isDesmarcadoApos18) {
          grupos[key].valor += parseFloat((prof as any).valorDesmarqueApos18 || 0);
        } else if (tipo === 'particular') {
          grupos[key].valor += parseFloat((prof as any).valorParticular || 0);
        } else if (tipo === 'devolutiva') {
          grupos[key].valor += prof.valorAval || 0;
        } else {
          const dur = a.durMin || 30;
          const defaultSessionVal = dur >= 45 
            ? parseFloat((prof as any).valor60 || 100) 
            : parseFloat((prof as any).valor30 || 60);
          grupos[key].valor += defaultSessionVal;
        }
      }
    });

    const { data: currentDbRecords } = await supabase
      .from('pagamentos_terapeutas')
      .select('*')
      .eq('competencia', month);
    
    const existingFin = (currentDbRecords || []).map(mappers.dbToPagamento);
    const recordsToUpsert: PagamentoTerapeuta[] = [];

    // 1. Group records from appointments
    for (const g of Object.values(grupos)) {
      const keyExist = existingFin.find(r => 
        r.competencia === month && 
        (r.profissionalId === g.profissionalId || r.profissional === g.profissional) && 
        r.tipo === g.tipo
      );

      const newId = keyExist ? keyExist.id : `fin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      recordsToUpsert.push({
        id: newId,
        profissionalId: g.profissionalId,
        profissional: g.profissional,
        competencia: month,
        tipo: g.tipo,
        qtdPacientes: g.pacientes.size,
        valor: g.valor,
        status: keyExist ? keyExist.status : 'pendente',
        valorPago: keyExist ? keyExist.valorPago : 0,
        dataPagamento: keyExist ? keyExist.dataPagamento : '',
        nfUrl: keyExist ? keyExist.nfUrl : '',
        nfNome: keyExist ? keyExist.nfNome : '',
        obs: keyExist ? keyExist.obs : ''
      });
    }

    // 2. Discount / Addition records from calculations
    for (const tc of currentTerapeutasCalculados) {
      const profId = tc.prof.id;
      const profNome = tc.prof.nome;

      if (tc.valorDescontoMesAnterior > 0) {
        const keyExist = existingFin.find(r => 
          r.competencia === month && 
          (r.profissionalId === profId || r.profissional === profNome) && 
          r.tipo === 'desconto_mes_anterior'
        );

        const valDesconto = -Math.abs(tc.valorDescontoMesAnterior);
        const newId = keyExist ? keyExist.id : `fin_desc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        recordsToUpsert.push({
          id: newId,
          profissionalId: profId,
          profissional: profNome,
          competencia: month,
          tipo: 'desconto_mes_anterior',
          qtdPacientes: 0,
          valor: valDesconto,
          status: keyExist ? keyExist.status : 'pendente',
          valorPago: keyExist ? (keyExist.status === 'pago' ? keyExist.valorPago || valDesconto : 0) : 0,
          dataPagamento: keyExist ? keyExist.dataPagamento : '',
          nfUrl: keyExist ? keyExist.nfUrl : '',
          nfNome: keyExist ? keyExist.nfNome : '',
          obs: keyExist && keyExist.obs ? keyExist.obs : (tc.obsDescontoMesAnterior || 'Pago a maior no mês anterior (Desconto)')
        });
      }

      if (tc.valorAdicionalMesAnterior > 0) {
        const keyExist = existingFin.find(r => 
          r.competencia === month && 
          (r.profissionalId === profId || r.profissional === profNome) && 
          r.tipo === 'adicional_mes_anterior'
        );

        const valAdicional = Math.abs(tc.valorAdicionalMesAnterior);
        const newId = keyExist ? keyExist.id : `fin_adic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        recordsToUpsert.push({
          id: newId,
          profissionalId: profId,
          profissional: profNome,
          competencia: month,
          tipo: 'adicional_mes_anterior',
          qtdPacientes: 0,
          valor: valAdicional,
          status: keyExist ? keyExist.status : 'pendente',
          valorPago: keyExist ? (keyExist.status === 'pago' ? keyExist.valorPago || valAdicional : 0) : 0,
          dataPagamento: keyExist ? keyExist.dataPagamento : '',
          nfUrl: keyExist ? keyExist.nfUrl : '',
          nfNome: keyExist ? keyExist.nfNome : '',
          obs: keyExist && keyExist.obs ? keyExist.obs : (tc.obsAdicionalMesAnterior || 'Pago a menor no mês anterior (Adicional)')
        });
      }
    }

    for (const reg of recordsToUpsert) {
      const { error } = await supabase
        .from('pagamentos_terapeutas')
        .upsert(mappers.pagamentoToDb(reg), { onConflict: 'id' });
      if (error) throw error;
    }
  };

  // Save Fechamento
  const handleConfirmFechamento = async () => {
    setSavingFechamento(true);
    const totalSessoes = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalSessoes, 0);
    const totalValor = terapeutasCalculados.reduce((acc, tc) => acc + tc.totalValor, 0);
    const totalProfs = terapeutasCalculados.length;

    let currentAgendamentos = agendamentos;
    try {
      const fetched = await loadAgendamentosMes(selectedMonth);
      if (fetched && fetched.length > 0) {
        const map = new Map(agendamentos.map(a => [a.id, a]));
        fetched.forEach(a => map.set(a.id, a));
        currentAgendamentos = Array.from(map.values());
      }
    } catch (e) {
      console.error('[ClinicFlow Fechamento] Error loading month for confirmation:', e);
    }

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
          valorDescontoMesAnterior: tc.valorDescontoMesAnterior,
          obsDescontoMesAnterior: tc.obsDescontoMesAnterior,
          valorAdicionalMesAnterior: tc.valorAdicionalMesAnterior,
          obsAdicionalMesAnterior: tc.obsAdicionalMesAnterior,
          totalBruto: tc.totalBruto,
          totalValor: tc.totalValor,
          totalSessoes: tc.totalSessoes
        }))
      },
      confirmadoPor: 'Administrador',
      confirmadoEm: new Date().toISOString()
    };

    try {
      const dbPayload = mappers.fechamentoToDb(payload);
      
      // 1. Try standard upsert
      let { error } = await supabase
        .from('fechamentos_mensais')
        .upsert(dbPayload, { onConflict: 'competencia' });

      // 2. Fallback if upsert fails due to constraint or merge preference
      if (error) {
        console.warn('[Fechamento] Upsert falhou, tentando fallback por competência:', error.message);
        
        const { data: existing } = await supabase
          .from('fechamentos_mensais')
          .select('id')
          .eq('competencia', selectedMonth)
          .maybeSingle();

        if (existing) {
          const { error: updateErr } = await supabase
            .from('fechamentos_mensais')
            .update(dbPayload)
            .eq('competencia', selectedMonth);
          error = updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from('fechamentos_mensais')
            .insert([dbPayload]);
          error = insertErr;
        }
      }

      if (error) throw error;

      // Automatically sync each professional's repasse to Contas a Pagar
      try {
        for (const tc of terapeutasCalculados) {
          if (tc.totalValor > 0) {
            await financeiroFluxoCaixaService.salvarContaPagar({
              id: `pag_fech_${selectedMonth}_${tc.prof.id}`,
              fornecedorNome: tc.prof.nome,
              profId: tc.prof.id,
              descricao: `Repasse Profissional (${formatMonthLabel(selectedMonth)}) - ${tc.totalSessoes} atendimentos`,
              valor: tc.totalValor,
              dataVencimento: new Date(Date.now() + 86400000 * 5).toISOString().substring(0, 10),
              status: 'Pendente',
              formaPagamento: 'PIX',
              categoriaId: 'cat_desp_1',
              categoriaNome: 'Repasse a Médicos e Psicólogos'
            });
          }
        }
      } catch (syncErr) {
        console.warn('[Fechamento] Erro ao sincronizar contas a pagar:', syncErr);
      }

      // Sync repasses to pagamentos_terapeutas (including discounts/adicionais)
      try {
        await syncRepassesFromCalculations(selectedMonth, terapeutasCalculados, currentAgendamentos);
        await loadFinanceiro();
      } catch (syncRepErr) {
        console.warn('[Fechamento] Erro ao sincronizar repasses de terapeutas:', syncRepErr);
      }

      alert(`Sucesso! Fechamento de ${selectedMonth} gravado no banco de dados, repasses atualizados e adicionados em Contas a Pagar!`);
    } catch (e: any) {
      console.error('[Fechamento] Erro ao gravar fechamento mensal:', e);
      if (e?.status === 403 || e?.code === '42501' || String(e?.message).includes('403')) {
        alert('Permissão negada (Erro 403) no Supabase na tabela "fechamentos_mensais".\n\nPor favor, execute o script SQL "fix_fechamentos_mensais_permissions.sql" no Supabase SQL Editor para liberar o acesso.');
      } else {
        alert(`Erro ao gravar fechamento mensal: ${e?.message || 'Falha na comunicação com o banco de dados.'}`);
      }
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
        const map = new Map(agendamentos.map(a => [a.id, a]));
        fetched.forEach(a => map.set(a.id, a));
        currentAgendamentos = Array.from(map.values());
      }
    } catch(e) {
      console.error('[ClinicFlow Fechamento] Error pre-loading month:', e);
    }
    
    try {
      const currentFin = await loadFinanceiro();
      
      const [year, month] = selectedMonth.split('-').map(Number);
      const primDay = `${selectedMonth}-01`;
      const ultDay = new Date(year, month, 0).toISOString().split('T')[0];
      
      const atendidos = currentAgendamentos.filter(a => 
        getBaseStatus(a.status) === 'atendido' && 
        a.dataISO >= primDay && 
        a.dataISO <= ultDay
      );
      const todosAgendamentos = currentAgendamentos.filter(a => 
        a.dataISO >= primDay && 
        a.dataISO <= ultDay
      );

      const list: any[] = [];
      profissionais.forEach(p => {
        const profAppts = atendidos.filter(a => a.profId === p.id);
        const profApptsAll = todosAgendamentos.filter(a => a.profId === p.id);
        if (profApptsAll.length === 0) return;

        let count30 = 0, valor30 = 0, count60 = 0, valor60 = 0, countDev = 0, valorDev = 0, countAval = 0, countPart = 0, valorPart = 0;
        profAppts.forEach(a => {
          const isParticular = a.plano?.toLowerCase() === 'particular' || a.planoId === 5;
          const tipoLower = a.tipo?.toLowerCase() || '';
          const obsLower = a.obs?.toLowerCase() || '';

          const isDev = tipoLower.includes('devolutiva') || obsLower.includes('devolutiva');
          const isAval = tipoLower.includes('avaliacao') || tipoLower.includes('avaliac') || tipoLower.includes('continua') || obsLower.includes('avaliação') || obsLower.includes('aval');

          if (isParticular) {
            countPart++;
            valorPart += parseFloat((p as any).valorParticular || 0);
          } else if (isAval) {
            countAval++;
          } else if (isDev) {
            countDev++;
            valorDev += p.valorAval || 0;
          } else {
            const dur = a.durMin || 30;
            if (dur >= 45) {
              count60++;
              valor60 += parseFloat((p as any).valor60 || 100);
            } else {
              count30++;
              valor30 += parseFloat((p as any).valor30 || 60);
            }
          }
        });

        const profDesmarquesApos18 = profApptsAll.filter(a => {
          const isDesmarcado = getBaseStatus(a.status) === 'desmarcado' || a.status.toLowerCase().includes('desmarcado');
          return isDesmarcado && a.hora >= '18:00';
        });
        const countDesmarqueApos18 = profDesmarquesApos18.length;
        const valorDesmarqueApos18Total = countDesmarqueApos18 * parseFloat((p as any).valorDesmarqueApos18 || 0);

        const totalBruto = valor30 + valor60 + valorDev + valorPart + valorDesmarqueApos18Total;

        let valorDescontoMesAnterior = 0;
        let obsDescontoMesAnterior = '';
        let valorAdicionalMesAnterior = 0;
        let obsAdicionalMesAnterior = '';
        const prevMonth = getPrevMonth(selectedMonth);

        if (prevMonth) {
          const prevFinProf = currentFin.filter(
            r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === prevMonth
          );
          if (prevFinProf.length > 0) {
            const prevDevido = prevFinProf.reduce((acc, r) => {
              if (r.tipo === 'avaliacao') return acc;
              if (r.tipo === 'desconto_mes_anterior') return acc - Math.abs(r.valor);
              if (r.tipo === 'adicional_mes_anterior') return acc + Math.abs(r.valor);
              return acc + r.valor;
            }, 0);
            const prevPago = prevFinProf.filter(r => r.status === 'pago').reduce((acc, r) => acc + (r.valorPago || r.valor), 0);

            if (prevPago > prevDevido) {
              valorDescontoMesAnterior = prevPago - prevDevido;
              obsDescontoMesAnterior = `Excedente de R$ ${valorDescontoMesAnterior.toFixed(2)} pago a maior em ${formatMonthLabel(prevMonth)}`;
            } else if (prevPago < prevDevido && prevFinProf.some(r => r.status === 'pago')) {
              valorAdicionalMesAnterior = prevDevido - prevPago;
              obsAdicionalMesAnterior = `Valor faltante de R$ ${valorAdicionalMesAnterior.toFixed(2)} pago a menor em ${formatMonthLabel(prevMonth)}`;
            }
          }

          const regDescontoAtual = currentFin.find(
            r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === selectedMonth && r.tipo === 'desconto_mes_anterior'
          );
          if (regDescontoAtual) {
            valorDescontoMesAnterior = Math.abs(regDescontoAtual.valor);
            if (regDescontoAtual.obs) obsDescontoMesAnterior = regDescontoAtual.obs;
          }

          const regAdicionalAtual = currentFin.find(
            r => (r.profissionalId === p.id || r.profissional === p.nome) && r.competencia === selectedMonth && r.tipo === 'adicional_mes_anterior'
          );
          if (regAdicionalAtual) {
            valorAdicionalMesAnterior = Math.abs(regAdicionalAtual.valor);
            if (regAdicionalAtual.obs) obsAdicionalMesAnterior = regAdicionalAtual.obs;
          }
        }

        const totalValor = Math.max(0, totalBruto - valorDescontoMesAnterior + valorAdicionalMesAnterior);

        list.push({
          prof: p,
          count30, valor30, count60, valor60, countDev, valorDev, countAval, countPart, valorPart,
          countDesmarqueApos18, valorDesmarqueApos18Total,
          valorDescontoMesAnterior, obsDescontoMesAnterior,
          valorAdicionalMesAnterior, obsAdicionalMesAnterior,
          totalBruto, totalValor,
          totalSessoes: count30 + count60 + countDev + countAval + countPart + countDesmarqueApos18,
          pacientesLista: []
        });
      });

      await syncRepassesFromCalculations(selectedMonth, list, currentAgendamentos);
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
    setModalValorPago(p.valorPago ? Math.abs(p.valorPago) : Math.abs(p.valor));
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

    let finalValorPago = modalValorPago;
    if (modalStatus === 'pago') {
      finalValorPago = editingPayment.valor < 0 ? -Math.abs(modalValorPago) : Math.abs(modalValorPago);
    } else {
      finalValorPago = 0;
    }

    const updated: PagamentoTerapeuta = {
      ...editingPayment,
      status: modalStatus,
      valorPago: finalValorPago,
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

  const formatTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'sessao': return 'Sessão Regular';
      case 'devolutiva': return 'Devolutiva Neuropsicológica';
      case 'avaliacao': return 'Avaliação Neuropsicológica';
      case 'particular': return 'Consulta Particular';
      case 'desconto_mes_anterior': return 'Pago a Maior (Desconto)';
      case 'adicional_mes_anterior': return 'Pago a Menor (Adicional)';
      case 'ajuste': return 'Ajuste Manual';
      default: return tipo;
    }
  };

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col gap-4 animate-fade-in text-xs overflow-hidden">
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 shrink-0">
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
      </div>

      {/* SCROLLABLE MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-6 pr-1">
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
                            {tc.valorDescontoMesAnterior > 0 && (
                              <div className="flex justify-between items-center text-rose-300 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20 mt-2">
                                <span className="flex items-center gap-1.5 text-xs font-semibold">
                                  🔻 Pago a Maior no Mês Anterior (Desconto)
                                </span>
                                <span className="font-mono font-bold text-rose-400">
                                  - R$ {tc.valorDescontoMesAnterior.toFixed(2)}
                                </span>
                              </div>
                            )}
                            {tc.valorAdicionalMesAnterior > 0 && (
                              <div className="flex justify-between items-center text-emerald-300 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 mt-2">
                                <span className="flex items-center gap-1.5 text-xs font-semibold">
                                  🔺 Pago a Menor no Mês Anterior (Adicional)
                                </span>
                                <span className="font-mono font-bold text-emerald-400">
                                  + R$ {tc.valorAdicionalMesAnterior.toFixed(2)}
                                </span>
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
                      <td className="p-4 text-slate-300">{formatTipoLabel(r.tipo)}</td>
                      <td className="p-4 text-center font-mono text-slate-300">{r.qtdPacientes}</td>
                      <td className="p-4 font-mono font-bold">
                        {r.tipo === 'avaliacao' ? (
                          <span className="text-slate-500">—</span>
                        ) : r.valor < 0 ? (
                          <span className="text-rose-400">- R$ {Math.abs(r.valor).toFixed(2)}</span>
                        ) : r.tipo === 'adicional_mes_anterior' ? (
                          <span className="text-emerald-400">+ R$ {r.valor.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-200">R$ {r.valor.toFixed(2)}</span>
                        )}
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
      </div>

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

              {modalStatus === 'pago' && modalValorPago > editingPayment.valor && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs leading-relaxed">
                  💡 <strong>Pagamento a Maior Detectado!</strong>
                  <p className="text-[11px] mt-0.5 opacity-90">
                    Foi pago <strong>R$ {(modalValorPago - editingPayment.valor).toFixed(2)}</strong> a mais do que o valor do fechamento (R$ {editingPayment.valor.toFixed(2)}). Esse valor excedente será abatido automaticamente como desconto no próximo mês.
                  </p>
                </div>
              )}

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

      {/* MANUAL DISCOUNT MODAL */}
      {isManualDiscountOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Cadastrar Ajuste / Desconto Manual
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Lançar valor pago a maior ou abatimento no repasse</p>
              </div>
              <button type="button" onClick={() => setIsManualDiscountOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleSaveManualDiscount} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-xs">Tipo de Ajuste</label>
                  <select
                    value={manualTipo}
                    onChange={(e) => setManualTipo(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  >
                    <option value="desconto_mes_anterior">🔻 Desconto (Pago a Maior)</option>
                    <option value="adicional_mes_anterior">🔺 Adicional (Pago a Menor)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-xs">Profissional / Terapeuta</label>
                  <select
                    required
                    value={manualProfId}
                    onChange={(e) => setManualProfId(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  >
                    <option value="">Selecione o Terapeuta</option>
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-xs">Competência</label>
                  <input
                    type="month"
                    required
                    value={manualComp}
                    onChange={(e) => setManualComp(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1 text-xs">Valor Desconto (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 300.00"
                    value={manualValor}
                    onChange={(e) => setManualValor(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none font-mono text-xs text-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1 text-xs">Observação / Motivo</label>
                <textarea
                  rows={2}
                  required
                  value={manualObs}
                  onChange={(e) => setManualObs(e.target.value)}
                  placeholder="Ex: Abatimento de pagamento efetuado a maior no mês anterior"
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none focus:outline-none text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsManualDiscountOpen(false)}
                  className="flex-1 py-2 bg-[#161a26] text-slate-400 hover:text-white rounded-lg text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManualDiscount}
                  className="flex-1 py-2 bg-gradient-to-r from-rose-500 to-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  {savingManualDiscount && <Loader size={12} className="animate-spin" />}
                  Salvar Desconto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
