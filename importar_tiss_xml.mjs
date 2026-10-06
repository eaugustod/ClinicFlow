#!/usr/bin/env node
/**
 * ============================================================
 * ClinicFlow — Script de Importação de XML TISS para o Supabase
 * ============================================================
 * Uso:
 *   node importar_tiss_xml.mjs [caminho_do_arquivo.xml]
 *
 * Exemplo:
 *   node importar_tiss_xml.mjs TISS_2026_08_sessoes.xml
 * ============================================================
 */

import fs from 'fs';
import path from 'path';

// Configuração Supabase (obtida da integração padrão do ClinicFlow)
const SB_URL = process.env.VITE_SUPABASE_URL || 'https://ezkfnbrlqnruymhhfeei.supabase.co';
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2ZuYnJscW5ydXltaGhmZWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg1MzAsImV4cCI6MjA5MDgwNDUzMH0.llrWSk5Kz-UvTPWY5fpeO7QD-aFaobcvAP9FxH8PhB4';

const headers = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function sbFetch(endpoint, options = {}) {
  const url = `${SB_URL}/rest/v1/${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[Supabase Error ${res.status}] ${txt}`);
  }
  return res.json();
}

function parseTissXmlSimple(xmlStr) {
  const getTag = (str, tag) => {
    const m = str.match(new RegExp(`<(?:ans:)?${tag}>(.*?)</(?:ans:)?${tag}>`, 's'));
    return m ? m[1].trim() : '';
  };

  const numLote = getTag(xmlStr, 'numeroLote') || getTag(xmlStr, 'sequencialTransacao');
  const regAns = getTag(xmlStr, 'registroANS');
  const codPrestador = getTag(xmlStr, 'codigoPrestadorNaOperadora');
  const dataReg = getTag(xmlStr, 'dataRegistroTransacao');
  const padrao = getTag(xmlStr, 'Padrao') || getTag(xmlStr, 'versaoPadrao') || '4.01.00';

  const guiasBlocks = xmlStr.split(/<(?:ans:)?guiaSP-SADT>/i).slice(1).map(b => b.split(/<\/(?:ans:)?guiaSP-SADT>/i)[0]);

  let totalLote = 0;
  const monthCounts = {};

  const guias = guiasBlocks.map((gStr, i) => {
    const numGuiaPrestador = getTag(gStr, 'numeroGuiaPrestador');
    const numGuiaOperadora = getTag(gStr, 'numeroGuiaOperadora');
    const guiaPrincipal = getTag(gStr, 'guiaPrincipal') || numGuiaOperadora;
    const dataAut = getTag(gStr, 'dataAutorizacao');
    const senha = getTag(gStr, 'senha');
    const dataValidadeSenha = getTag(gStr, 'dataValidadeSenha');
    const carteira = getTag(gStr, 'numeroCarteira');
    const dataSolic = getTag(gStr, 'dataSolicitacao');
    const cnes = getTag(gStr, 'CNES');

    const solicitante = {
      codPrestador: getTag(gStr, 'codigoPrestadorNaOperadora'),
      nomeContratado: getTag(gStr, 'nomeContratadoSolicitante'),
      nomeProf: getTag(gStr, 'nomeProfissional'),
      conselho: getTag(gStr, 'conselhoProfissional'),
      numConselho: getTag(gStr, 'numeroConselhoProfissional'),
      uf: getTag(gStr, 'UF'),
      cbos: getTag(gStr, 'CBOS')
    };

    // Procedimentos
    const procsBlocks = gStr.split(/<(?:ans:)?procedimentoExecutado>/i).slice(1).map(p => p.split(/<\/(?:ans:)?procedimentoExecutado>/i)[0]);
    let firstDataExec = '';
    const procs = procsBlocks.map((pStr, pIdx) => {
      const dataExec = getTag(pStr, 'dataExecucao') || dataSolic || dataAut;
      if (!firstDataExec && dataExec) firstDataExec = dataExec;
      const cod = getTag(pStr, 'codigoProcedimento') || '50000470';
      const desc = getTag(pStr, 'descricaoProcedimento') || 'Sessão de psicoterapia';
      const qtd = parseFloat(getTag(pStr, 'quantidadeExecutada')) || 1;
      const vUnit = parseFloat(getTag(pStr, 'valorUnitario')) || 0;
      const vTot = parseFloat(getTag(pStr, 'valorTotal')) || (qtd * vUnit);

      return {
        seq: parseInt(getTag(pStr, 'sequencialItem'), 10) || (pIdx + 1),
        dataExec,
        codigo: cod,
        desc,
        qtd,
        valor: vUnit,
        total: vTot,
        equipe: {
          cpf: getTag(pStr, 'cpfContratado'),
          nome: getTag(pStr, 'nomeProf'),
          conselho: getTag(pStr, 'conselho'),
          numConselho: getTag(pStr, 'numeroConselhoProfissional'),
          uf: getTag(pStr, 'UF'),
          cbos: getTag(pStr, 'CBOS')
        }
      };
    });

    const valTotGeral = parseFloat(getTag(gStr, 'valorTotalGeral')) || parseFloat(getTag(gStr, 'valorProcedimentos')) || procs.reduce((a, b) => a + b.total, 0);
    totalLote += valTotGeral;

    const dtGuia = firstDataExec || dataSolic || dataAut || dataReg;
    if (dtGuia && dtGuia.length >= 7) {
      const ym = dtGuia.substring(0, 7);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    }

    return {
      numGuiaPrestador,
      numGuiaOperadora,
      guiaPrincipal,
      dataAut,
      senha,
      dataValidadeSenha,
      carteira,
      dtGuia,
      cnes,
      solicitante,
      procs,
      valTotGeral
    };
  });

  let maxCount = 0;
  let comp = '';
  for (const ym of Object.keys(monthCounts)) {
    if (monthCounts[ym] > maxCount) {
      maxCount = monthCounts[ym];
      comp = ym;
    }
  }

  return {
    numLote,
    regAns,
    codPrestador,
    dataReg,
    padrao,
    competencia: comp || (dataReg ? dataReg.substring(0, 7) : ''),
    qtdGuias: guias.length,
    valorTotal: parseFloat(totalLote.toFixed(2)),
    guias
  };
}

async function run() {
  const filePath = process.argv[2] || 'TISS_2026_08_sessoes.xml';
  console.log(`\n============================================================`);
  console.log(`  ClinicFlow — Importação de Lote TISS XML`);
  console.log(`============================================================`);
  console.log(`  Arquivo alvo: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  const xmlContent = fs.readFileSync(filePath, 'utf8');
  const parsed = parseTissXmlSimple(xmlContent);

  console.log(`✓ XML lido com sucesso!`);
  console.log(`  - Nº do Lote       : ${parsed.numLote}`);
  console.log(`  - Competência      : ${parsed.competencia}`);
  console.log(`  - Registro ANS     : ${parsed.regAns}`);
  console.log(`  - Cód. Prestador   : ${parsed.codPrestador}`);
  console.log(`  - Quantidade Guias : ${parsed.qtdGuias}`);
  console.log(`  - Valor Total      : R$ ${parsed.valorTotal.toFixed(2)}`);
  console.log(`------------------------------------------------------------`);

  try {
    console.log(`Conectando ao banco de dados Supabase...`);
    const planos = await sbFetch('planos_saude?select=id,nome,ans,cod_prestador');
    const pacientes = await sbFetch('pacientes?select=id,nome,carteirinha');
    const profissionais = await sbFetch('profissionais?select=id,nome,num');

    // Identificar plano pelo registro ANS ou pelo nome
    let plano = planos.find(p => p.ans && p.ans.trim() === parsed.regAns.trim());
    if (!plano) {
      plano = planos.find(p => p.cod_prestador && p.cod_prestador.trim() === parsed.codPrestador.trim());
    }
    if (!plano && parsed.regAns === '315478') {
      plano = planos.find(p => p.nome.toLowerCase().includes('bradesco'));
    }
    if (!plano) {
      plano = planos[0];
    }

    console.log(`✓ Plano associado: ${plano.nome} (ID: ${plano.id})`);

    // 1. Criar ou Atualizar Lote
    const existingLotes = await sbFetch(`lotes_tiss?num=eq.${parsed.numLote}&plano_id=eq.${plano.id}&select=id,num`);
    let loteId;

    if (existingLotes && existingLotes.length > 0) {
      loteId = existingLotes[0].id;
      console.log(`ℹ Lote #${parsed.numLote} já existe (ID: ${loteId}). Atualizando...`);
      await sbFetch(`lotes_tiss?id=eq.${loteId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          competencia: parsed.competencia,
          qtd: parsed.qtdGuias,
          valor: parsed.valorTotal,
          status: 'Enviado',
          obs: `Importado de ${path.basename(filePath)}`
        })
      });
    } else {
      console.log(`Criando novo lote #${parsed.numLote}...`);
      const inserted = await sbFetch('lotes_tiss', {
        method: 'POST',
        body: JSON.stringify({
          num: parsed.numLote,
          competencia: parsed.competencia,
          plano_id: plano.id,
          plano: plano.nome,
          qtd: parsed.qtdGuias,
          valor: parsed.valorTotal,
          status: 'Enviado',
          data_criacao: parsed.dataReg || new Date().toISOString().substring(0, 10),
          obs: `Importado de ${path.basename(filePath)}`,
          guia_ids: []
        })
      });
      loteId = inserted[0]?.id;
      console.log(`✓ Lote criado com ID: ${loteId}`);
    }

    // 2. Criar ou Atualizar Guias SADT
    console.log(`Importando ${parsed.guias.length} guias SP-SADT...`);
    const cleanNum = s => (s || '').replace(/\D/g, '');
    const guideIds = [];

    for (let idx = 0; idx < parsed.guias.length; idx++) {
      const g = parsed.guias[idx];
      const matchedPac = pacientes.find(p => {
        if (!p.carteirinha || p.carteirinha === '—') return false;
        const c1 = cleanNum(p.carteirinha);
        const c2 = cleanNum(g.carteira);
        return c1 && c2 && (c1 === c2 || c1.includes(c2) || c2.includes(c1));
      });

      const matchedProf = profissionais.find(p => {
        const cpf1 = cleanNum(p.cpf || '');
        const cpf2 = cleanNum(g.procs[0]?.equipe?.cpf || '');
        if (cpf1 && cpf2 && cpf1 === cpf2) return true;
        const nomeGuia = (g.procs[0]?.equipe?.nome || '').toLowerCase();
        return nomeGuia && p.nome.toLowerCase().includes(nomeGuia.split(' ')[0]);
      }) || profissionais[0];

      const guiaPayload = {
        num: g.numGuiaPrestador,
        pac: matchedPac ? matchedPac.nome : `Beneficiário (${g.carteira})`,
        pac_id: matchedPac ? matchedPac.id : null,
        plano_id: plano.id,
        plano: plano.nome,
        prof_id: matchedProf ? matchedProf.id : 1,
        valor: g.valTotGeral,
        status: 'Enviado',
        data: g.dtGuia,
        lote_id: loteId,
        lote_num: parsed.numLote,
        carteirinha: g.carteira,
        num_op: g.numGuiaOperadora || g.guiaPrincipal,
        codigo_procedimento: g.procs[0]?.codigo || '50000470',
        dados: {
          senha: g.senha,
          dataAut: g.dataAut,
          validade: g.dataValidadeSenha,
          guiaPrincipal: g.guiaPrincipal,
          numGuiaOperadora: g.numGuiaOperadora,
          cnes: g.cnes,
          codPrestador: parsed.codPrestador,
          registroAns: parsed.regAns,
          solicitante: g.solicitante,
          procs: g.procs.map(p => ({
            codigo: p.codigo,
            desc: p.desc,
            qtd: p.qtd,
            valor: p.valor,
            total: p.total
          }))
        }
      };

      const existingGuia = await sbFetch(`guias_sadt?num=eq.${g.numGuiaPrestador}&plano_id=eq.${plano.id}&select=id`);
      if (existingGuia && existingGuia.length > 0) {
        const idG = existingGuia[0].id;
        await sbFetch(`guias_sadt?id=eq.${idG}`, {
          method: 'PATCH',
          body: JSON.stringify(guiaPayload)
        });
        guideIds.push(idG);
      } else {
        const insG = await sbFetch('guias_sadt', {
          method: 'POST',
          body: JSON.stringify(guiaPayload)
        });
        if (insG[0]?.id) guideIds.push(insG[0].id);
      }
    }

    // 3. Atualizar guia_ids no lote
    await sbFetch(`lotes_tiss?id=eq.${loteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ guia_ids: guideIds })
    });

    console.log(`\n============================================================`);
    console.log(`🎉 IMPORTAÇÃO CONCLUÍDA COM SUCESSO!`);
    console.log(`============================================================`);
    console.log(`✓ Lote #${parsed.numLote} cadastrado/atualizado`);
    console.log(`✓ ${guideIds.length} guias SP-SADT vinculadas ao lote`);
    console.log(`✓ Valor total consolidado: R$ ${parsed.valorTotal.toFixed(2)}`);
    console.log(`✓ Os registros já estão disponíveis na tela de Lotes TISS e Guias SADT.`);
    console.log(`============================================================\n`);
  } catch (err) {
    console.error(`\n❌ Erro durante a importação para o Supabase:`, err.message);
    process.exit(1);
  }
}

run();
