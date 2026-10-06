/**
 * Parser especializado para arquivos XML TISS (Padrão ANS)
 * Suporta mensagens TISS com lote de guias SP-SADT (ex: TISS 3.x, 4.x)
 */

export interface ProcedimentoTissParsed {
  sequencialItem: number;
  dataExecucao: string;
  codigoTabela: string;
  codigoProcedimento: string;
  descricaoProcedimento: string;
  quantidadeExecutada: number;
  reducaoAcrescimo: number;
  valorUnitario: number;
  valorTotal: number;
  equipeSadt?: {
    grauPart?: string;
    cpfContratado?: string;
    nomeProf?: string;
    conselho?: string;
    numeroConselhoProfissional?: string;
    uf?: string;
    cbos?: string;
  };
}

export interface GuiaSadtParsed {
  numeroGuiaPrestador: string;
  numeroGuiaOperadora: string;
  guiaPrincipal: string;
  dataAutorizacao: string;
  senha: string;
  dataValidadeSenha: string;
  numeroCarteira: string;
  atendimentoRn?: string;
  tipoIdent?: string;
  dataSolicitacao?: string;
  caraterAtendimento?: string;
  cnes?: string;
  codigoPrestadorExecutante?: string;
  solicitante?: {
    codigoPrestador?: string;
    nomeContratado?: string;
    nomeProfissional?: string;
    conselhoProfissional?: string;
    numeroConselhoProfissional?: string;
    uf?: string;
    cbos?: string;
  };
  dadosAtendimento?: {
    tipoAtendimento?: string;
    indicacaoAcidente?: string;
    tipoConsulta?: string;
    regimeAtendimento?: string;
  };
  procedimentos: ProcedimentoTissParsed[];
  valorProcedimentos: number;
  valorTotalGeral: number;
  dataExecucaoPrincipal: string;
}

export interface ParsedTissLote {
  success: boolean;
  tipoTransacao: string;
  sequencialTransacao: string;
  dataRegistroTransacao: string;
  horaRegistroTransacao: string;
  codigoPrestadorNaOperadora: string;
  registroANS: string;
  padraoVersao: string;
  numeroLote: string;
  competencia: string; // formato YYYY-MM
  qtdGuias: number;
  valorTotal: number;
  guias: GuiaSadtParsed[];
  errors: string[];
  rawXml: string;
}

const getTagValue = (container: Element | Document, tagName: string): string => {
  // Procura com ou sem namespace 'ans:'
  const el = container.getElementsByTagName(`ans:${tagName}`)[0] || container.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() || '';
};

/**
 * Converte string XML TISS em estrutura de dados tipada ParsedTissLote
 */
export const parseXmlTiss = (xmlContent: string): ParsedTissLote => {
  const result: ParsedTissLote = {
    success: false,
    tipoTransacao: '',
    sequencialTransacao: '',
    dataRegistroTransacao: '',
    horaRegistroTransacao: '',
    codigoPrestadorNaOperadora: '',
    registroANS: '',
    padraoVersao: '',
    numeroLote: '',
    competencia: '',
    qtdGuias: 0,
    valorTotal: 0,
    guias: [],
    errors: [],
    rawXml: xmlContent
  };

  if (!xmlContent || typeof xmlContent !== 'string') {
    result.errors.push('Conteúdo do arquivo XML vazio ou inválido.');
    return result;
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      result.errors.push(`Erro de sintaxe no XML: ${parserError.textContent}`);
      return result;
    }

    // Cabeçalho e identificação
    result.tipoTransacao = getTagValue(xmlDoc, 'tipoTransacao') || 'ENVIO_LOTE_GUIAS';
    result.sequencialTransacao = getTagValue(xmlDoc, 'sequencialTransacao');
    result.dataRegistroTransacao = getTagValue(xmlDoc, 'dataRegistroTransacao');
    result.horaRegistroTransacao = getTagValue(xmlDoc, 'horaRegistroTransacao');
    result.codigoPrestadorNaOperadora = getTagValue(xmlDoc, 'codigoPrestadorNaOperadora');
    result.registroANS = getTagValue(xmlDoc, 'registroANS');
    result.padraoVersao = getTagValue(xmlDoc, 'Padrao') || getTagValue(xmlDoc, 'versaoPadrao') || '4.01.00';
    result.numeroLote = getTagValue(xmlDoc, 'numeroLote') || result.sequencialTransacao || '';

    // Encontrar nós de guias SP-SADT
    let guiasNodes = Array.from(xmlDoc.getElementsByTagName('ans:guiaSP-SADT'));
    if (guiasNodes.length === 0) {
      guiasNodes = Array.from(xmlDoc.getElementsByTagName('guiaSP-SADT'));
    }

    if (guiasNodes.length === 0) {
      result.errors.push('Nenhuma guia SP-SADT (<guiaSP-SADT>) foi encontrada no arquivo XML informado.');
      return result;
    }

    const monthCounts: Record<string, number> = {};
    let totalLote = 0;

    for (const gNode of guiasNodes) {
      const numGuiaPrestador = getTagValue(gNode, 'numeroGuiaPrestador');
      const numGuiaOperadora = getTagValue(gNode, 'numeroGuiaOperadora');
      const guiaPrincipal = getTagValue(gNode, 'guiaPrincipal') || numGuiaOperadora;
      const dataAutorizacao = getTagValue(gNode, 'dataAutorizacao');
      const senha = getTagValue(gNode, 'senha');
      const dataValidadeSenha = getTagValue(gNode, 'dataValidadeSenha');
      const numeroCarteira = getTagValue(gNode, 'numeroCarteira');
      const atendimentoRn = getTagValue(gNode, 'atendimentoRN');
      const tipoIdent = getTagValue(gNode, 'tipoIdent');
      const dataSolicitacao = getTagValue(gNode, 'dataSolicitacao');
      const caraterAtendimento = getTagValue(gNode, 'caraterAtendimento');
      const cnes = getTagValue(gNode, 'CNES');

      // Solicitante
      const solicitante = {
        codigoPrestador: getTagValue(gNode, 'codigoPrestadorNaOperadora'),
        nomeContratado: getTagValue(gNode, 'nomeContratadoSolicitante'),
        nomeProfissional: getTagValue(gNode, 'nomeProfissional'),
        conselhoProfissional: getTagValue(gNode, 'conselhoProfissional'),
        numeroConselhoProfissional: getTagValue(gNode, 'numeroConselhoProfissional'),
        uf: getTagValue(gNode, 'UF'),
        cbos: getTagValue(gNode, 'CBOS')
      };

      // Procedimentos executados
      let procNodes = Array.from(gNode.getElementsByTagName('ans:procedimentoExecutado'));
      if (procNodes.length === 0) {
        procNodes = Array.from(gNode.getElementsByTagName('procedimentoExecutado'));
      }

      const procedimentos: ProcedimentoTissParsed[] = [];
      let dataExecucaoPrincipal = '';

      for (let i = 0; i < procNodes.length; i++) {
        const pNode = procNodes[i];
        const dataExec = getTagValue(pNode, 'dataExecucao') || dataSolicitacao || dataAutorizacao;
        if (!dataExecucaoPrincipal && dataExec) {
          dataExecucaoPrincipal = dataExec;
        }

        const qtd = parseFloat(getTagValue(pNode, 'quantidadeExecutada')) || 1;
        const vUnit = parseFloat(getTagValue(pNode, 'valorUnitario')) || 0;
        const vTot = parseFloat(getTagValue(pNode, 'valorTotal')) || (qtd * vUnit);

        procedimentos.push({
          sequencialItem: parseInt(getTagValue(pNode, 'sequencialItem'), 10) || (i + 1),
          dataExecucao: dataExec,
          codigoTabela: getTagValue(pNode, 'codigoTabela') || '22',
          codigoProcedimento: getTagValue(pNode, 'codigoProcedimento') || '50000470',
          descricaoProcedimento: getTagValue(pNode, 'descricaoProcedimento') || 'Sessão de psicoterapia',
          quantidadeExecutada: qtd,
          reducaoAcrescimo: parseFloat(getTagValue(pNode, 'reducaoAcrescimo')) || 1,
          valorUnitario: vUnit,
          valorTotal: vTot,
          equipeSadt: {
            grauPart: getTagValue(pNode, 'grauPart'),
            cpfContratado: getTagValue(pNode, 'cpfContratado'),
            nomeProf: getTagValue(pNode, 'nomeProf'),
            conselho: getTagValue(pNode, 'conselho'),
            numeroConselhoProfissional: getTagValue(pNode, 'numeroConselhoProfissional'),
            uf: getTagValue(pNode, 'UF'),
            cbos: getTagValue(pNode, 'CBOS')
          }
        });
      }

      const valProcedimentos = parseFloat(getTagValue(gNode, 'valorProcedimentos')) ||
        procedimentos.reduce((sum, p) => sum + p.valorTotal, 0);
      const valTotalGeral = parseFloat(getTagValue(gNode, 'valorTotalGeral')) || valProcedimentos;

      totalLote += valTotalGeral;

      const dtRef = dataExecucaoPrincipal || dataSolicitacao || dataAutorizacao || result.dataRegistroTransacao;
      if (dtRef && dtRef.length >= 7) {
        const ym = dtRef.substring(0, 7);
        monthCounts[ym] = (monthCounts[ym] || 0) + 1;
      }

      result.guias.push({
        numeroGuiaPrestador: numGuiaPrestador,
        numeroGuiaOperadora: numGuiaOperadora,
        guiaPrincipal,
        dataAutorizacao,
        senha,
        dataValidadeSenha,
        numeroCarteira,
        atendimentoRn,
        tipoIdent,
        dataSolicitacao,
        caraterAtendimento,
        cnes,
        codigoPrestadorExecutante: getTagValue(gNode, 'codigoPrestadorNaOperadora'),
        solicitante,
        dadosAtendimento: {
          tipoAtendimento: getTagValue(gNode, 'tipoAtendimento'),
          indicacaoAcidente: getTagValue(gNode, 'indicacaoAcidente'),
          tipoConsulta: getTagValue(gNode, 'tipoConsulta'),
          regimeAtendimento: getTagValue(gNode, 'regimeAtendimento')
        },
        procedimentos,
        valorProcedimentos: parseFloat(valProcedimentos.toFixed(2)),
        valorTotalGeral: parseFloat(valTotalGeral.toFixed(2)),
        dataExecucaoPrincipal: dtRef
      });
    }

    // Determina competência mais frequente (ex: 2026-08)
    let maxCount = 0;
    let comp = '';
    for (const ym of Object.keys(monthCounts)) {
      if (monthCounts[ym] > maxCount) {
        maxCount = monthCounts[ym];
        comp = ym;
      }
    }
    result.competencia = comp || (result.dataRegistroTransacao ? result.dataRegistroTransacao.substring(0, 7) : '');
    result.qtdGuias = result.guias.length;
    result.valorTotal = parseFloat(totalLote.toFixed(2));
    result.success = true;

    return result;
  } catch (err: any) {
    result.errors.push(`Falha ao processar arquivo XML: ${err?.message || err}`);
    return result;
  }
};
