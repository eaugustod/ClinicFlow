import React, { useState, useEffect } from 'react';
import { Search, Plus, Layers, Download, CheckCircle2, AlertTriangle, ExternalLink, Edit3, FileText, Loader, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { LoteTiss, GuiaSadt } from '../types';
import { supabase } from '../services/supabase';
import { mappers } from '../services/mappers';

const TISS_CONSELHOS: { [key: string]: string } = {
  'CRESS': '01', 'COREN': '02', 'CRF': '03', 'CREFONO': '04', 'CREFITO': '05',
  'CRM': '06', 'CRN': '07', 'CRO': '08', 'CRP': '09', 'OUTRO': '10',
  'CRBio': '11', 'CRBM': '12', 'CREF': '13', 'CRMV': '14', 'CRTR': '15',
};

const IBGE_UF: { [key: string]: string } = {
  'RO': '11', 'AC': '12', 'AM': '13', 'RR': '14', 'PA': '15', 'AP': '16', 'TO': '17',
  'MA': '21', 'PI': '22', 'CE': '23', 'RN': '24', 'PB': '25', 'PE': '26', 'AL': '27',
  'SE': '28', 'BA': '29', 'MG': '31', 'ES': '32', 'RJ': '33', 'SP': '35',
  'PR': '41', 'SC': '42', 'RS': '43', 'MS': '50', 'MT': '51', 'GO': '52', 'DF': '53',
};

const tissCodigoConselho = (sigla?: string) => {
  if (!sigla) return '09';
  const s = sigla.toUpperCase().trim();
  if (TISS_CONSELHOS[s]) return TISS_CONSELHOS[s];
  for (const key of Object.keys(TISS_CONSELHOS)) {
    if (s.includes(key) || key.includes(s)) return TISS_CONSELHOS[key];
  }
  return '10';
};

const tissCodigoUF = (uf?: string) => {
  if (!uf) return '35';
  const s = uf.toUpperCase().trim();
  if (/^\d{2}$/.test(s)) return s;
  return IBGE_UF[s] || '35';
};

const normalizeCompetencia = (comp: string): string => {
  if (!comp) return '';
  comp = comp.trim();
  if (/^\d{4}-\d{2}$/.test(comp)) {
    return comp;
  }
  const parts = comp.split('/');
  if (parts.length === 2) {
    const monthStr = parts[0].toLowerCase();
    const year = parts[1];
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const monthIndex = months.indexOf(monthStr);
    if (monthIndex !== -1) {
      const monthNum = String(monthIndex + 1).padStart(2, '0');
      return `${year}-${monthNum}`;
    }
  }
  return comp;
};

const tissHashMD5 = async (xmlSemHash: string) => {
  const canonical = xmlSemHash
    .replace(/\r\n/g, '\n')
    .replace(/\n\s+</g, '<')
    .replace(/>\s+</g, '><')
    .replace(/\n+/g, '')
    .trim();

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonical);
    const hashBuf = await crypto.subtle.digest('SHA-1', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 0;
    for (let i = 0; i < canonical.length; i++) {
      h = Math.imul(31, h) + canonical.charCodeAt(i) | 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0').repeat(5).slice(0, 40);
  }
};

const removeAccentsAndSpecial = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim();
};

export const LotesTiss: React.FC = () => {
  const { lotes, guias, lazyLoadGuias, planos, profissionais, clinicaConfig, refreshAll } = useApp();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [competenciaFilter, setCompetenciaFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal closed/new States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State for closing new Lote
  const [planoId, setPlanoId] = useState<number>(planos[0]?.id || 5);
  const [competencia, setCompetencia] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [obs, setObs] = useState('');

  // Editing Lote States
  const [editingLote, setEditingLote] = useState<LoteTiss | null>(null);
  const [editingPlanoId, setEditingPlanoId] = useState<number>(0);
  const [editingCompetencia, setEditingCompetencia] = useState('');
  const [editingObs, setEditingObs] = useState('');
  const [editingStatus, setEditingStatus] = useState<'Pendente' | 'Gerado' | 'Enviado' | 'Faturado' | 'Glosado'>('Pendente');
  const [selectedGuiasIds, setSelectedGuiasIds] = useState<Set<number>>(new Set());
  const [availableGuias, setAvailableGuias] = useState<GuiaSadt[]>([]);

  useEffect(() => {
    lazyLoadGuias();
  }, []);

  // Update available guias when editing a lote or changing health insurance
  useEffect(() => {
    if (!editingLote) return;
    // Find all guias that belong to this lote
    const loteGuias = guias.filter(g => g.loteId === editingLote.id && g.planoId === editingPlanoId);
    // Find all pending guias for the selected plan
    const pendingGuias = guias.filter(g => g.planoId === editingPlanoId && g.status === 'Pendente' && !g.loteId);

    setAvailableGuias([...loteGuias, ...pendingGuias]);
  }, [editingPlanoId, editingLote, guias]);

  const filteredLotes = lotes.filter(l => {
    const matchesSearch = l.num.includes(searchQuery) || l.plano.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompetencia = !competenciaFilter || normalizeCompetencia(l.competencia) === competenciaFilter;
    const matchesStatus = !statusFilter || l.status === statusFilter;
    return matchesSearch && matchesCompetencia && matchesStatus;
  });

  const openAddModal = () => {
    setPlanoId(planos[0]?.id || 5);
    setCompetencia(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    setObs('');
    setIsModalOpen(true);
  };

  const openEditModal = (l: LoteTiss) => {
    setEditingLote(l);
    setEditingPlanoId(l.planoId);
    setEditingCompetencia(normalizeCompetencia(l.competencia));
    setEditingObs(l.obs || '');
    setEditingStatus(l.status);

    const loteGuias = guias.filter(g => g.loteId === l.id);
    setSelectedGuiasIds(new Set(loteGuias.map(g => g.id)));
  };

  const handleSaveEditLote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLote) return;
    setSubmitting(true);

    const plano = planos.find(pl => pl.id === Number(editingPlanoId));
    if (!plano) {
      alert('Plano não encontrado.');
      setSubmitting(false);
      return;
    }

    const selectedIds = Array.from(selectedGuiasIds);
    const selectedGuides = guias.filter(g => selectedIds.includes(g.id));
    const totalVal = selectedGuides.reduce((acc, g) => acc + g.valor, 0);

    const updatedLote = {
      num: editingLote.num,
      competencia: editingCompetencia,
      planoId: Number(editingPlanoId),
      plano: plano.nome,
      qtd: selectedIds.length,
      valor: totalVal,
      status: editingStatus,
      dataCriacao: editingLote.dataCriacao,
      obs: editingObs,
      guiaIds: selectedIds
    };

    try {
      // 1. Update Lote in Supabase
      const { error } = await supabase
        .from('lotes_tiss')
        .update(mappers.loteToDb(updatedLote))
        .eq('id', editingLote.id);

      if (error) throw error;

      // 2. Dissociate guides that were deselected
      const previouslyAssociated = guias.filter(g => g.loteId === editingLote.id);
      const deselected = previouslyAssociated.filter(g => !selectedIds.includes(g.id));
      await Promise.all(
        deselected.map(g =>
          supabase
            .from('guias_sadt')
            .update({ status: 'Pendente', lote_id: null, lote_num: null })
            .eq('id', g.id)
        )
      );

      // 3. Associate newly selected guides
      const newlySelected = selectedGuides.filter(g => g.loteId !== editingLote.id);
      const guideStatusForLote = editingStatus === 'Pendente' ? 'Pendente' : 'Enviado';
      await Promise.all(
        newlySelected.map(g =>
          supabase
            .from('guias_sadt')
            .update({ status: guideStatusForLote, lote_id: editingLote.id, lote_num: editingLote.num })
            .eq('id', g.id)
        )
      );

      setEditingLote(null);
      await refreshAll();
      alert('Lote atualizado com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar lote TISS.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadXmlForEditing = async () => {
    if (!editingLote) return;
    const plano = planos.find(p => p.id === editingPlanoId);
    if (!plano) {
      alert('Plano do lote não encontrado.');
      return;
    }

    const selectedIds = Array.from(selectedGuiasIds);
    const selectedGuides = guias.filter(g => selectedIds.includes(g.id));
    if (!selectedGuides.length) {
      alert('Nenhuma guia selecionada para gerar XML.');
      return;
    }

    const xmlSemHash = buildXmlString(editingLote.num, plano, selectedGuides);
    const hash = await tissHashMD5(xmlSemHash);
    const xmlFinal = xmlSemHash.replace(
      '<ans:epilogo><ans:hash></ans:hash></ans:epilogo>',
      `<ans:epilogo><ans:hash>${hash}</ans:hash></ans:epilogo>`
    );

    const blob = new Blob([xmlFinal], { type: 'application/xml;charset=ISO-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote_${editingLote.num}_TISS_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildXmlString = (loteNum: string, plano: any, loteGuias: GuiaSadt[]) => {
    const dataGeracaoISO = new Date().toISOString().slice(0, 10);
    const n = new Date();
    const horaGeracao = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') + ':' + String(n.getSeconds()).padStart(2, '0');

    const codPrestador = plano.codPrestador || clinicaConfig.codPrestador || '100000019260';
    const nomePrestador = plano.nomeContratado || clinicaConfig.nome || 'KOSMOS ESPACO TERAPEUTICO';
    const cnes = plano.cnes || clinicaConfig.cnes || '620904';
    const registroANS = plano.ans || '';
    const versaoTiss = plano.versaoTiss || '4.02.00';

    const esc = (s: any) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const xmlGuias = loteGuias.map((g) => {
      const dataGuia = g.data;
      const senha = esc(g.dados?.senha || g.numOp || '');
      const dataAut = g.dados?.dataAut || g.data;
      const valSenha = g.dados?.validade || '';
      const carteira = esc(g.carteirinha || '');
      const guiaPrest = esc(g.num);
      const guiaOp = esc(g.numOp || g.num);
      const procs = g.dados?.procs && g.dados.procs.length > 0
        ? g.dados.procs
        : [{ codigo: '50000470', desc: 'Sessao de Terapia', qtd: 1, valor: g.valor, total: g.valor }];

      // Calculate dataValidadeSenha as the last day of the month of dataAut
      let dataValidadeSenha = '';
      if (dataAut && dataAut.includes('-')) {
        const parts = dataAut.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const lastDayDate = new Date(y, m, 0);
          const lastDay = String(lastDayDate.getDate()).padStart(2, '0');
          const lastMonth = String(lastDayDate.getMonth() + 1).padStart(2, '0');
          const lastYear = lastDayDate.getFullYear();
          dataValidadeSenha = `${lastYear}-${lastMonth}-${lastDay}`;
        }
      }
      if (!dataValidadeSenha) {
        dataValidadeSenha = valSenha || dataAut;
      }

      // Find professional executante
      const prof = profissionais.find(p => p.id === g.profId);
      const profNome = prof?.nome || 'Maria Cecilia Benessuti Donato';
      const profConselhoSigla = prof?.conselho || 'CRP';
      const profCodigoConselho = tissCodigoConselho(profConselhoSigla);
      const profNumConselho = prof?.num || '71849';
      const profUFSigla = prof?.uf || 'SP';
      const profCodigoUF = tissCodigoUF(profUFSigla);
      const profCBO = prof?.cbo || '251510';
      const profCPF = (prof as any)?.cpf || '27700196869';

      const xmlProcs = procs.map((p, i) => {
        const val = Number(p.valor || g.valor).toFixed(2);
        const tot = Number(p.total || ((p.valor || g.valor) * (p.qtd || 1))).toFixed(2);
        return `<ans:procedimentoExecutado>` +
          `<ans:sequencialItem>${i + 1}</ans:sequencialItem>` +
          `<ans:dataExecucao>${dataGuia}</ans:dataExecucao>` +
          `<ans:horaInicial>08:00:00</ans:horaInicial>` +
          `<ans:horaFinal>09:00:00</ans:horaFinal>` +
          `<ans:procedimento>` +
          `<ans:codigoTabela>${(p.codigo || '50000470') === '50000470' ? '22' : '98'}</ans:codigoTabela>` +
          `<ans:codigoProcedimento>${esc(p.codigo || '50000470')}</ans:codigoProcedimento>` +
          `<ans:descricaoProcedimento>${esc(removeAccentsAndSpecial(p.desc || 'Sessao de Terapia'))}</ans:descricaoProcedimento>` +
          `</ans:procedimento>` +
          `<ans:quantidadeExecutada>${p.qtd || 1}</ans:quantidadeExecutada>` +
          `<ans:reducaoAcrescimo>1.0000</ans:reducaoAcrescimo>` +
          `<ans:valorUnitario>${val}</ans:valorUnitario>` +
          `<ans:valorTotal>${tot}</ans:valorTotal>` +
          `<ans:equipeSadt>` +
          `<ans:grauPart>12</ans:grauPart>` +
          `<ans:codProfissional>` +
          `<ans:cpfContratado>27700196869</ans:cpfContratado>` +
          `</ans:codProfissional>` +
          `<ans:nomeProf>Maria Cecilia Benessuti Donato</ans:nomeProf>` +
          `<ans:conselho>09</ans:conselho>` +
          `<ans:numeroConselhoProfissional>71849</ans:numeroConselhoProfissional>` +
          `<ans:UF>35</ans:UF>` +
          `<ans:CBOS>251510</ans:CBOS>` +
          `</ans:equipeSadt>` +
          `</ans:procedimentoExecutado>`;
      }).join('');

      const totalProc = Number(g.valor).toFixed(2);

      return `<ans:guiaSP-SADT>` +
        `<ans:cabecalhoGuia>` +
        `<ans:registroANS>${registroANS}</ans:registroANS>` +
        `<ans:numeroGuiaPrestador>${guiaPrest}</ans:numeroGuiaPrestador>` +
        `<ans:guiaPrincipal>${guiaOp}</ans:guiaPrincipal>` +
        `</ans:cabecalhoGuia>` +
        `<ans:dadosAutorizacao>` +
        `<ans:numeroGuiaOperadora>${guiaOp}</ans:numeroGuiaOperadora>` +
        `<ans:dataAutorizacao>${dataAut}</ans:dataAutorizacao>` +
        `<ans:senha>${senha}</ans:senha>` +
        `<ans:dataValidadeSenha>${dataValidadeSenha}</ans:dataValidadeSenha>` +
        `</ans:dadosAutorizacao>` +
        `<ans:dadosBeneficiario>` +
        `<ans:numeroCarteira>${carteira}</ans:numeroCarteira>` +
        `<ans:atendimentoRN>N</ans:atendimentoRN>` +
        `<ans:tipoIdent>01</ans:tipoIdent>` +
        `</ans:dadosBeneficiario>` +
        `<ans:dadosSolicitante>` +
        `<ans:contratadoSolicitante>` +
        `<ans:codigoPrestadorNaOperadora>${codPrestador}</ans:codigoPrestadorNaOperadora>` +
        `</ans:contratadoSolicitante>` +
        `<ans:nomeContratadoSolicitante>${esc(nomePrestador)}</ans:nomeContratadoSolicitante>` +
        `<ans:profissionalSolicitante>` +
        `<ans:nomeProfissional>Maria Cecilia Benessuti Donato</ans:nomeProfissional>` +
        `<ans:conselhoProfissional>09</ans:conselhoProfissional>` +
        `<ans:numeroConselhoProfissional>71849</ans:numeroConselhoProfissional>` +
        `<ans:UF>35</ans:UF>` +
        `<ans:CBOS>251510</ans:CBOS>` +
        `</ans:profissionalSolicitante>` +
        `</ans:dadosSolicitante>` +
        `<ans:dadosSolicitacao>` +
        `<ans:dataSolicitacao>${dataGuia}</ans:dataSolicitacao>` +
        `<ans:caraterAtendimento>1</ans:caraterAtendimento>` +
        `</ans:dadosSolicitacao>` +
        `<ans:dadosExecutante>` +
        `<ans:contratadoExecutante>` +
        `<ans:codigoPrestadorNaOperadora>${codPrestador}</ans:codigoPrestadorNaOperadora>` +
        `</ans:contratadoExecutante>` +
        `<ans:CNES>${cnes}</ans:CNES>` +
        `</ans:dadosExecutante>` +
        `<ans:dadosAtendimento>` +
        `<ans:tipoAtendimento>03</ans:tipoAtendimento>` +
        `<ans:indicacaoAcidente>9</ans:indicacaoAcidente>` +
        `<ans:tipoConsulta>4</ans:tipoConsulta>` +
        `<ans:regimeAtendimento>01</ans:regimeAtendimento>` +
        `</ans:dadosAtendimento>` +
        `<ans:procedimentosExecutados>` +
        xmlProcs +
        `</ans:procedimentosExecutados>` +
        `<ans:valorTotal>` +
        `<ans:valorProcedimentos>${totalProc}</ans:valorProcedimentos>` +
        `<ans:valorTaxasAlugueis>0.00</ans:valorTaxasAlugueis>` +
        `<ans:valorMateriais>0.00</ans:valorMateriais>` +
        `<ans:valorMedicamentos>0.00</ans:valorMedicamentos>` +
        `<ans:valorGasesMedicinais>0.00</ans:valorGasesMedicinais>` +
        `<ans:valorTotalGeral>${totalProc}</ans:valorTotalGeral>` +
        `</ans:valorTotal>` +
        `</ans:guiaSP-SADT>`;
    }).join('');

    return `<?xml version="1.0" encoding="ISO-8859-1"?>\n` +
      `<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">` +
      `<ans:cabecalho>` +
      `<ans:identificacaoTransacao>` +
      `<ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>` +
      `<ans:sequencialTransacao>${esc(loteNum)}</ans:sequencialTransacao>` +
      `<ans:dataRegistroTransacao>${dataGeracaoISO}</ans:dataRegistroTransacao>` +
      `<ans:horaRegistroTransacao>${horaGeracao}</ans:horaRegistroTransacao>` +
      `</ans:identificacaoTransacao>` +
      `<ans:origem>` +
      `<ans:identificacaoPrestador>` +
      `<ans:codigoPrestadorNaOperadora>${codPrestador}</ans:codigoPrestadorNaOperadora>` +
      `</ans:identificacaoPrestador>` +
      `</ans:origem>` +
      `<ans:destino>` +
      `<ans:registroANS>${registroANS}</ans:registroANS>` +
      `</ans:destino>` +
      `<ans:Padrao>${versaoTiss}</ans:Padrao>` +
      `</ans:cabecalho>` +
      `<ans:prestadorParaOperadora>` +
      `<ans:loteGuias>` +
      `<ans:numeroLote>${esc(loteNum)}</ans:numeroLote>` +
      `<ans:guiasTISS>${xmlGuias}</ans:guiasTISS>` +
      `</ans:loteGuias>` +
      `</ans:prestadorParaOperadora>` +
      `<ans:epilogo><ans:hash></ans:hash></ans:epilogo>` +
      `</ans:mensagemTISS>`;
  };

  const handleCreateLote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const plano = planos.find(pl => pl.id === Number(planoId));
    if (!plano) {
      alert('Plano não encontrado.');
      setSubmitting(false);
      return;
    }

    // Find all pendente guides for this plan
    const pendingGuides = guias.filter(g => g.planoId === Number(planoId) && g.status === 'Pendente');

    if (pendingGuides.length === 0) {
      alert('Nenhuma guia pendente encontrada para este convênio.');
      setSubmitting(false);
      return;
    }

    // Chunk the pending guides into groups of max 90
    const chunks: GuiaSadt[][] = [];
    for (let i = 0; i < pendingGuides.length; i += 90) {
      chunks.push(pendingGuides.slice(i, i + 90));
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`; // YYYYMMDD
    const currentYearMonth = `${year}-${month}`; // YYYY-MM

    let baseSeq = 1;
    try {
      const { data: existingLotes, error: existingLotesError } = await supabase
        .from('lotes_tiss')
        .select('num')
        .like('num', `${dateStr}%`);
      if (!existingLotesError && existingLotes) {
        let maxSeq = 0;
        for (const lote of existingLotes) {
          if (lote.num && lote.num.length === dateStr.length + 2) {
            const seqPart = parseInt(lote.num.slice(dateStr.length), 10);
            if (!isNaN(seqPart) && seqPart > maxSeq) {
              maxSeq = seqPart;
            }
          }
        }
        baseSeq = maxSeq + 1;
      }
    } catch (err) {
      console.error('Erro ao buscar sequencial de lotes:', err);
    }

    const getSeqStr = (seq: number) => String(seq).padStart(2, '0');

    try {
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];
        const seqNum = baseSeq + idx;
        const lotNum = `${dateStr}${getSeqStr(seqNum)}`;
        const totalVal = chunk.reduce((acc, g) => acc + g.valor, 0);
        const guideIds = chunk.map(g => g.id);

        const newLote: Partial<LoteTiss> = {
          num: lotNum,
          competencia,
          planoId: Number(planoId),
          plano: plano.nome,
          qtd: chunk.length,
          valor: totalVal,
          status: 'Pendente',
          dataCriacao: new Date().toISOString().split('T')[0],
          obs,
          guiaIds: guideIds
        };

        // 1. Insert Lote
        const { data, error } = await supabase
          .from('lotes_tiss')
          .insert([mappers.loteToDb(newLote)])
          .select()
          .single();

        if (error) throw error;

        // 2. Update status of the guides included in the batch to 'Enviado' and set their lote_id
        const batchId = data.id;
        const { error: guiasError } = await supabase
          .from('guias_sadt')
          .update({ status: 'Enviado', lote_id: batchId, lote_num: lotNum })
          .in('id', guideIds);

        if (guiasError) throw guiasError;
      }

      setIsModalOpen(false);
      await refreshAll();
      alert(`${chunks.length} lote(s) criado(s) com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar lote TISS.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLote = async (lote: LoteTiss) => {
    if (!confirm(`Deseja realmente excluir o lote ${lote.num}? As guias associadas voltarão a ficar com status Pendente.`)) {
      return;
    }
    setSubmitting(true);
    try {
      // 1. Dissociate all guides in this lote
      const { error: guiasError } = await supabase
        .from('guias_sadt')
        .update({ status: 'Pendente', lote_id: null, lote_num: null })
        .eq('lote_id', lote.id);
      if (guiasError) throw guiasError;

      // 2. Delete the lote
      const { error: loteError } = await supabase
        .from('lotes_tiss')
        .delete()
        .eq('id', lote.id);
      if (loteError) throw loteError;

      await refreshAll();
      alert('Lote excluído com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir o lote TISS.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadXml = async (lote: LoteTiss) => {
    const plano = planos.find(p => p.id === lote.planoId);
    if (!plano) {
      alert('Plano do lote não encontrado.');
      return;
    }

    // Retrieve all guias inside this batch
    const loteGuias = guias.filter(g => g.loteId === lote.id);
    if (!loteGuias.length) {
      alert('Nenhuma guia associada a este lote encontrada.');
      return;
    }

    const xmlSemHash = buildXmlString(lote.num, plano, loteGuias);
    const hash = await tissHashMD5(xmlSemHash);
    const xmlFinal = xmlSemHash.replace(
      '<ans:epilogo><ans:hash></ans:hash></ans:epilogo>',
      `<ans:epilogo><ans:hash>${hash}</ans:hash></ans:epilogo>`
    );

    const blob = new Blob([xmlFinal], { type: 'application/xml;charset=ISO-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote_${lote.num}_TISS_${new Date().toISOString().slice(0, 10)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalLotesEnviados = lotes.filter(l => l.status === 'Enviado').length;
  const guiasNoFiltro = filteredLotes.reduce((acc, l) => acc + (l.qtd || 0), 0);
  const valorFiltrado = filteredLotes.reduce((acc, l) => acc + (l.valor || 0), 0);
  const pendentes = filteredLotes.filter(l => l.status === 'Pendente').length;
  const enviados = filteredLotes.filter(l => l.status === 'Enviado').length;
  const faturados = filteredLotes.filter(l => l.status === 'Faturado').length;

  const stats = [
    { label: 'Lotes Enviados (Total)', val: totalLotesEnviados, color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10' },
    { label: 'Guias no Filtro', val: guiasNoFiltro, color: 'text-sky-400 bg-sky-500/5 border-sky-500/10' },
    { label: 'Valor Filtrado', val: `R$ ${valorFiltrado.toFixed(2)}`, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' },
    { label: 'Pendentes (Filtro)', val: pendentes, color: 'text-amber-400 bg-amber-500/5 border-amber-500/10' },
    { label: 'Enviados (Filtro)', val: enviados, color: 'text-blue-400 bg-blue-500/5 border-blue-500/10' },
    { label: 'Faturados (Filtro)', val: faturados, color: 'text-rose-400 bg-rose-500/5 border-rose-500/10' },
  ];

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-sans font-semibold">TISS XML Faturamento</span>
          <h2 className="text-2xl font-black tracking-wide text-white mt-0.5">Lotes TISS</h2>
          <p className="text-xs text-slate-400 mt-1">Gere e gerencie lotes consolidados de guias SADT no padrão XML da ANS</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Plus size={16} />
          Fechar Novo Lote
        </button>
      </div>

      {/* INDICATORS SECTION */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 animate-fade-in">
        {stats.map((s, idx) => (
          <div key={idx} className={`p-4 rounded-xl border ${s.color} backdrop-blur-md shadow-lg`}>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-black mt-1 text-white">{s.val}</p>
          </div>
        ))}
      </div>

      {/* FILTERS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#131622]/40 backdrop-blur-md border border-white/[0.04] rounded-2xl">
        <div className="flex items-center gap-3 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input
            type="text"
            placeholder="Buscar lote por número ou plano..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-1">
          <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">Competência:</span>
          <input
            type="month"
            value={competenciaFilter}
            onChange={(e) => setCompetenciaFilter(e.target.value)}
            className="flex-1 bg-transparent border-0 text-slate-200 focus:outline-none text-xs"
          />
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
          >
            <option value="">— Todos os Status —</option>
            <option value="Pendente">Pendente</option>
            <option value="Gerado">Gerado</option>
            <option value="Enviado">Enviado</option>
            <option value="Faturado">Faturado</option>
            <option value="Glosado">Glosado</option>
          </select>
        </div>
      </div>

      {/* Lotes Table */}
      <div className="bg-[#131622]/50 backdrop-blur-md border border-white/[0.04] rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-white/[0.04] bg-white/[0.01]">
                <th className="p-4">Nº Lote</th>
                <th className="p-4">Convênio</th>
                <th className="p-4 text-center">Competência</th>
                <th className="p-4 text-center">Qtd. Guias</th>
                <th className="p-4">Valor Total</th>
                <th className="p-4">Criado em</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredLotes.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="p-4 font-mono font-bold text-slate-200">{l.num}</td>
                  <td className="p-4 font-semibold text-slate-200 group-hover:text-indigo-400 transition-all">{l.plano}</td>
                  <td className="p-4 text-center font-mono text-slate-300">{l.competencia}</td>
                  <td className="p-4 text-center font-bold text-slate-300">{l.qtd}</td>
                  <td className="p-4 font-mono text-slate-200 font-bold">R$ {l.valor.toFixed(2)}</td>
                  <td className="p-4 font-mono text-slate-400">{l.dataCriacao.split('-').reverse().join('/')}</td>
                  <td className="p-4">
                    <select
                      value={l.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value as any;
                        try {
                          const { error } = await supabase
                            .from('lotes_tiss')
                            .update({ status: newStatus })
                            .eq('id', l.id);
                          if (error) throw error;
                          await refreshAll();
                        } catch (err) {
                          console.error(err);
                          alert('Erro ao atualizar status do lote.');
                        }
                      }}
                      className={`bg-[#161a26] border text-[9px] font-bold rounded-lg px-2.5 py-1 focus:outline-none ${l.status === 'Faturado'
                        ? 'text-emerald-400 border-emerald-500/15 bg-emerald-500/5'
                        : l.status === 'Enviado'
                          ? 'text-blue-400 border-blue-500/15 bg-blue-500/5'
                          : l.status === 'Glosado'
                            ? 'text-rose-400 border-rose-500/15 bg-rose-500/5'
                            : l.status === 'Gerado'
                              ? 'text-purple-400 border-purple-500/15 bg-purple-500/5'
                              : 'text-amber-400 border-amber-500/15 bg-amber-500/5'
                        }`}
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Gerado">Gerado</option>
                      <option value="Enviado">Enviado</option>
                      <option value="Faturado">Faturado</option>
                      <option value="Glosado">Glosado</option>
                    </select>
                  </td>
                  <td className="p-4 text-center flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEditModal(l)}
                      className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] rounded-lg text-slate-300 transition-all"
                      title="Editar Lote"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={() => handleDownloadXml(l)}
                      className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-[#4f8ef7]/15 hover:text-[#4f8ef7] hover:border-[#4f8ef7]/20 rounded-lg text-slate-300 transition-all"
                      title="Baixar XML TISS"
                    >
                      <Download size={11} />
                    </button>
                    <button
                      onClick={() => handleDeleteLote(l)}
                      className="p-1.5 bg-white/[0.02] border border-white/[0.04] hover:bg-rose-500/15 hover:text-rose-500 hover:border-rose-500/20 rounded-lg text-slate-300 transition-all"
                      title="Excluir Lote"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#555d74] font-medium">
                    Nenhum lote TISS fechado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Close New Lote Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Gerar Novo Lote TISS
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleCreateLote} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Convênio / Plano</label>
                <select
                  value={planoId}
                  onChange={(e) => setPlanoId(Number(e.target.value))}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                >
                  {planos.filter(p => p.usaTiss).map(pl => (
                    <option key={pl.id} value={pl.id}>{pl.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Competência de Faturamento</label>
                <input
                  type="month"
                  required
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações Internas (Opcional)</label>
                <textarea
                  rows={2}
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="Ex: Lote enviado via portal de faturamento."
                />
              </div>

              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-start gap-2.5 text-[10px] text-amber-400">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Aviso:</strong> O sistema buscará todas as guias deste convênio com status "Pendente" para agrupá-las e gerar o lote.
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold rounded-xl"
                >
                  {submitting ? 'Consolidando...' : 'Consolidar e Gerar Lote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0f111a] border border-white/[0.08] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-8 animate-fade-in">
            <div className="p-5 border-b border-white/[0.04] flex justify-between items-center bg-[#131622]/40">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Editar Lote #{editingLote.num}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">{editingCompetencia} — {editingLote.plano}</p>
              </div>
              <button type="button" onClick={() => setEditingLote(null)} className="text-slate-400 hover:text-white text-lg font-bold">&times;</button>
            </div>
            <form onSubmit={handleSaveEditLote} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plano de Saúde *</label>
                  <select
                    value={editingPlanoId}
                    onChange={(e) => setEditingPlanoId(Number(e.target.value))}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    {planos.filter(pl => pl.status === 'Ativo').map(pl => (
                      <option key={pl.id} value={pl.id}>{pl.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Competência (mês/ano) *</label>
                  <input
                    type="month"
                    required
                    value={editingCompetencia}
                    onChange={(e) => setEditingCompetencia(e.target.value)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Status do Lote *</label>
                  <select
                    value={editingStatus}
                    onChange={(e) => setEditingStatus(e.target.value as any)}
                    className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Gerado">Gerado</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Faturado">Faturado</option>
                    <option value="Glosado">Glosado</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block pt-2 border-t border-white/[0.02]">
                GUIAS DISPONÍVEIS PARA ESTE LOTE
              </div>

              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#131622]/20">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/[0.04] text-slate-400 text-[9px] uppercase tracking-wider font-bold">
                        <th className="p-3 w-8">
                          <input
                            type="checkbox"
                            checked={availableGuias.length > 0 && selectedGuiasIds.size === availableGuias.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGuiasIds(new Set(availableGuias.map(g => g.id)));
                              } else {
                                setSelectedGuiasIds(new Set());
                              }
                            }}
                            className="rounded bg-[#161a26] border-white/[0.06] text-indigo-600"
                          />
                        </th>
                        <th className="p-3">Paciente / Guia</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02] text-slate-300">
                      {availableGuias.map((g) => {
                        const isChecked = selectedGuiasIds.has(g.id);
                        return (
                          <tr key={g.id} className="hover:bg-white/[0.01]">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedGuiasIds);
                                  if (e.target.checked) {
                                    next.add(g.id);
                                  } else {
                                    next.delete(g.id);
                                  }
                                  setSelectedGuiasIds(next);
                                }}
                                className="rounded bg-[#161a26] border-white/[0.06] text-indigo-600"
                              />
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-white block">{g.pac}</span>
                              <span className="text-[10px] text-slate-400 font-mono">#{g.num}</span>
                            </td>
                            <td className="p-3 font-mono text-slate-400">{g.data.split('-').reverse().slice(0, 2).join('/')}</td>
                            <td className="p-3 font-mono font-bold">R$ {g.valor.toFixed(2)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${g.loteId === editingLote.id
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                }`}>
                                {g.loteId === editingLote.id ? 'No Lote' : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {availableGuias.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            Nenhuma guia disponível para este convênio.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Progress and Warnings */}
              {availableGuias.length > 0 && (
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400">{selectedGuiasIds.size} guias selecionadas (Limite recomendado: 90)</span>
                    <span className="text-indigo-400">
                      R$ {Array.from(selectedGuiasIds).reduce((acc, id) => acc + (guias.find(g => g.id === id)?.valor || 0), 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-[#161a26] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${selectedGuiasIds.size > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min((selectedGuiasIds.size / 90) * 100, 100)}%` }}
                    />
                  </div>
                  {selectedGuiasIds.size > 90 && (
                    <p className="text-[10px] text-rose-400 font-medium">
                      ⚠️ Acima de 90 guias. Recomendamos limitar o lote a 90 guias para evitar recusas na operadora.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Observações Internas</label>
                <textarea
                  rows={3}
                  value={editingObs}
                  onChange={(e) => setEditingObs(e.target.value)}
                  className="w-full bg-[#161a26] border border-white/[0.06] rounded-lg px-3 py-2 text-white resize-none"
                  placeholder="Observações sobre o lote..."
                />
              </div>

              <div className="pt-4 border-t border-white/[0.04] flex justify-between items-center">
                <button
                  type="button"
                  onClick={handleDownloadXmlForEditing}
                  disabled={selectedGuiasIds.size === 0}
                  className="px-4 py-2 bg-[#161a26] hover:bg-[#1f2433] text-slate-300 border border-white/[0.06] rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Download size={13} />
                  Gerar XML
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLote(null)}
                    className="px-4 py-2 border border-white/[0.06] rounded-xl text-slate-300 font-bold hover:bg-white/[0.02]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader size={12} className="animate-spin" />}
                    Salvar Lote
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

};
