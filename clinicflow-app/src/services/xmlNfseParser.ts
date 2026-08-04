import { NotaFiscalJundiai } from '../types';

export interface XmlParseResult {
  success: boolean;
  notas: Partial<NotaFiscalJundiai>[];
  errors: string[];
}

/**
 * Parser especializado para arquivos XML de NFS-e (Prefeitura de Jundiaí / GissOnline / ABRASF)
 * Suporta formatos:
 * - ABRASF 2.04 / 2.01 (<CompNfse>, <Nfse>, <InfNfse>)
 * - Lote de Consulta (<ConsultarNfseResposta>, <ListaNfse>)
 * - NFS-e Nacional RFB (<NFSe>, <infNFSe>)
 */
export const parseXmlNfseJundiai = (xmlContent: string): XmlParseResult => {
  const result: XmlParseResult = {
    success: false,
    notas: [],
    errors: []
  };

  if (!xmlContent || typeof xmlContent !== 'string') {
    result.errors.push('Conteúdo do arquivo XML vazio ou inválido.');
    return result;
  }

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Verifica erros de sintaxe do DOMParser
    const parserError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      result.errors.push(`Erro na estrutura do XML: ${parserError.textContent}`);
      return result;
    }

    // Busca nós de notas no documento (ABRASF ou Nacional)
    let nfseNodes = Array.from(xmlDoc.getElementsByTagName('CompNfse'));
    if (nfseNodes.length === 0) {
      nfseNodes = Array.from(xmlDoc.getElementsByTagName('Nfse'));
    }
    if (nfseNodes.length === 0) {
      nfseNodes = Array.from(xmlDoc.getElementsByTagName('NFSe'));
    }
    if (nfseNodes.length === 0) {
      // Se não encontrou contêiner externo, tenta por InfNfse
      nfseNodes = Array.from(xmlDoc.getElementsByTagName('InfNfse'));
    }
    if (nfseNodes.length === 0) {
      nfseNodes = Array.from(xmlDoc.getElementsByTagName('infNFSe'));
    }

    // Caso o XML seja uma nota única sem nós de lista
    if (nfseNodes.length === 0 && (xmlDoc.getElementsByTagName('Numero')[0] || xmlDoc.getElementsByTagName('nNFSe')[0])) {
      nfseNodes = [xmlDoc.documentElement];
    }

    if (nfseNodes.length === 0) {
      result.errors.push('Nenhuma estrutura de NFS-e (ABRASF/Nacional) identificada no arquivo XML.');
      return result;
    }

    const parsedNotas: Partial<NotaFiscalJundiai>[] = [];

    for (let i = 0; i < nfseNodes.length; i++) {
      const node = nfseNodes[i];

      // Helper para buscar o primeiro valor da tag por nome
      const getTagValue = (tagName: string, parent: Element | Document = node): string => {
        const els = parent.getElementsByTagName(tagName);
        if (els && els.length > 0 && els[0].textContent) {
          return els[0].textContent.trim();
        }
        return '';
      };

      // 1. Identificação da Nota
      const numeroNota = getTagValue('Numero') || getTagValue('nNFSe') || getTagValue('numero') || `XML-${Date.now()}-${i + 1}`;
      const codigoVerificacao = getTagValue('CodigoVerificacao') || getTagValue('cVerif') || getTagValue('codigo_verificacao') || 'XML-IMPORTADO';
      const numeroRps = getTagValue('IdentificacaoRps') ? getTagValue('Numero', node.getElementsByTagName('IdentificacaoRps')[0]) : (getTagValue('nRPS') || `RPS-${numeroNota}`);
      const serieRps = getTagValue('Serie') || getTagValue('serieRPS') || '1';

      // 2. Datas
      const dataEmissaoRaw = getTagValue('DataEmissao') || getTagValue('dhEmi') || getTagValue('data_emissao') || new Date().toISOString();
      let dataEmissaoFormatted = new Date().toISOString();
      try {
        const d = new Date(dataEmissaoRaw);
        if (!isNaN(d.getTime())) {
          dataEmissaoFormatted = d.toISOString();
        }
      } catch (_) {}

      // 3. Tomador (Cliente / Paciente)
      let tomadorNome = '';
      let tomadorCpfCnpj = '';
      let tomadorEmail = '';
      let tomadorEndereco = '';

      // ABRASF TomadorServico
      const tomadorNode = node.getElementsByTagName('TomadorServico')[0] || node.getElementsByTagName('Tomador')[0] || node.getElementsByTagName('tomador')[0];
      if (tomadorNode) {
        tomadorNome = getTagValue('RazaoSocial', tomadorNode) || getTagValue('Nome', tomadorNode) || getTagValue('xNome', tomadorNode);
        tomadorCpfCnpj = getTagValue('Cpf', tomadorNode) || getTagValue('Cnpj', tomadorNode) || getTagValue('CPF', tomadorNode) || getTagValue('CNPJ', tomadorNode);
        tomadorEmail = getTagValue('Email', tomadorNode) || getTagValue('email', tomadorNode);

        const endNode = tomadorNode.getElementsByTagName('Endereco')[0];
        if (endNode) {
          const logr = getTagValue('Endereco', endNode) || getTagValue('Logradouro', endNode) || getTagValue('xLgr', endNode);
          const num = getTagValue('Numero', endNode) || getTagValue('nro', endNode);
          const comp = getTagValue('Complemento', endNode) || getTagValue('xBairro', endNode);
          const cid = getTagValue('Cidade', endNode) || getTagValue('xMun', endNode) || 'Jundiaí';
          const uf = getTagValue('Uf', endNode) || getTagValue('UF', endNode) || 'SP';
          tomadorEndereco = [logr, num, comp, cid, uf].filter(Boolean).join(', ');
        }
      }

      if (!tomadorNome) {
        tomadorNome = getTagValue('xNome') || getTagValue('RazaoSocial') || 'Tomador Não Informado';
      }
      if (!tomadorCpfCnpj) {
        tomadorCpfCnpj = getTagValue('CPF') || getTagValue('CNPJ') || getTagValue('CpfCnpj') || '000.000.000-00';
      }

      // 4. Valores e Serviço
      const valorServicoStr = getTagValue('ValorServicos') || getTagValue('vServ') || getTagValue('valor_servico') || '0.00';
      const valorServico = parseFloat(valorServicoStr.replace(',', '.')) || 0;

      const aliquotaIssStr = getTagValue('Aliquota') || getTagValue('pAliq') || getTagValue('aliquota') || '2.0';
      const aliquotaIss = parseFloat(aliquotaIssStr.replace(',', '.')) || 2.0;

      const valorIssStr = getTagValue('ValorIss') || getTagValue('vISS') || '0.00';
      const valorIss = parseFloat(valorIssStr.replace(',', '.')) || (valorServico * (aliquotaIss / 100));

      const descricaoServico = getTagValue('Discriminacao') || getTagValue('xDiscServ') || getTagValue('descricao') || 'Prestação de Serviços de Saúde / Psicologia - Prefeitura de Jundiaí';
      const codigoServico = getTagValue('ItemListaServico') || getTagValue('cServ') || '04.01';

      // 5. Reforma Tributária (IBS / CBS) se presente no XML
      const cstIbsCbs = getTagValue('CST') || '01';
      const cClassTribIbsCbs = getTagValue('cClassTrib') || '040100';
      const valorIbsStr = getTagValue('vIBS') || '0.00';
      const valorCbsStr = getTagValue('vCBS') || '0.00';

      const notaParsed: Partial<NotaFiscalJundiai> = {
        id: `nfse-xml-${numeroNota}-${Date.now()}`,
        numeroNota,
        codigoVerificacao,
        numeroRps: String(numeroRps),
        serieRps,
        dataEmissao: dataEmissaoFormatted,
        status: 'Aprovada',
        tomadorNome,
        tomadorCpfCnpj,
        tomadorEmail,
        tomadorEndereco,
        descricaoServico,
        servicoCodigo: codigoServico,
        valorServico,
        aliquotaIss,
        valorIss,
        cstIbsCbs,
        cClassTribIbsCbs,
        valorIbs: parseFloat(valorIbsStr) || (valorServico * (0.10 / 100)),
        valorCbs: parseFloat(valorCbsStr) || (valorServico * (0.90 / 100)),
        xmlResposta: xmlContent
      };

      parsedNotas.push(notaParsed);
    }

    result.success = parsedNotas.length > 0;
    result.notas = parsedNotas;
  } catch (err: any) {
    result.errors.push(`Erro durante o processamento do XML: ${err.message || String(err)}`);
  }

  return result;
};
