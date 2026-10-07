import { GuiaSadt, LoteTiss, PlanoSaude, Profissional, Paciente, SenhaPlano } from '../types';
import { supabase } from './supabase';
import { mappers } from './mappers';

interface PrintContext {
  planos: PlanoSaude[];
  profissionais: Profissional[];
  pacientes: Paciente[];
  senhas?: SenhaPlano[];
  clinicaConfig?: any;
}

const normalizeName = (s?: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const formattedDate = (iso?: string) => {
  if (!iso) return '';
  const clean = iso.split('T')[0].trim();
  if (clean.includes('-')) {
    return clean.split('-').reverse().join('/');
  }
  return clean;
};

/**
 * Garante que todos os pacientes das guias a serem impressas tenham seus dados e assinaturas
 * carregados diretamente do banco, contornando qualquer limitação de paginação em memória.
 */
const resolvePacientesForGuias = async (
  guias: GuiaSadt[],
  existingPacientes: Paciente[]
): Promise<Paciente[]> => {
  const pacientesMap = new Map<string, Paciente>();

  for (const p of existingPacientes) {
    if (p.id) pacientesMap.set(`id:${p.id}`, p);
    if (p.nome) pacientesMap.set(`name:${normalizeName(p.nome)}`, p);
    if (p.carteirinha && p.carteirinha !== '—') {
      pacientesMap.set(`card:${p.carteirinha.replace(/\D/g, '')}`, p);
    }
  }

  // Verifica guias cujo paciente está ausente ou sem assinatura carregada
  const missingGuias = guias.filter(g => {
    let p = g.pacId ? pacientesMap.get(`id:${g.pacId}`) : undefined;
    if (!p && g.carteirinha && g.carteirinha !== '—') {
      p = pacientesMap.get(`card:${g.carteirinha.replace(/\D/g, '')}`);
    }
    if (!p && g.pac) {
      p = pacientesMap.get(`name:${normalizeName(g.pac)}`);
    }
    return !p || !p.assinatura;
  });

  if (missingGuias.length === 0) {
    return existingPacientes;
  }

  try {
    // 1. Busca por ID
    const missingIds = Array.from(new Set(missingGuias.map(g => g.pacId).filter((id): id is number => !!id)));
    if (missingIds.length > 0) {
      const { data: dbPacsById } = await supabase
        .from('pacientes')
        .select('*')
        .in('id', missingIds);
      if (dbPacsById) {
        for (const row of dbPacsById) {
          const pac = mappers.dbToPac(row);
          pacientesMap.set(`id:${pac.id}`, pac);
          if (pac.nome) pacientesMap.set(`name:${normalizeName(pac.nome)}`, pac);
          if (pac.carteirinha && pac.carteirinha !== '—') {
            pacientesMap.set(`card:${pac.carteirinha.replace(/\D/g, '')}`, pac);
          }
        }
      }
    }

    // 2. Busca por Nome
    const stillMissingNames = Array.from(new Set(
      missingGuias
        .filter(g => {
          const p = (g.pacId && pacientesMap.get(`id:${g.pacId}`)) ||
                    (g.carteirinha && pacientesMap.get(`card:${g.carteirinha.replace(/\D/g, '')}`)) ||
                    (g.pac && pacientesMap.get(`name:${normalizeName(g.pac)}`));
          return !p || !p.assinatura;
        })
        .map(g => g.pac.trim())
        .filter(Boolean)
    ));

    for (const name of stillMissingNames) {
      const { data: dbPacsByName } = await supabase
        .from('pacientes')
        .select('*')
        .ilike('nome', name)
        .limit(5);
      if (dbPacsByName && dbPacsByName.length > 0) {
        for (const row of dbPacsByName) {
          const pac = mappers.dbToPac(row);
          pacientesMap.set(`id:${pac.id}`, pac);
          if (pac.nome) pacientesMap.set(`name:${normalizeName(pac.nome)}`, pac);
          if (pac.carteirinha && pac.carteirinha !== '—') {
            pacientesMap.set(`card:${pac.carteirinha.replace(/\D/g, '')}`, pac);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[tissPrintService] Aviso ao carregar assinaturas adicionais de pacientes:', err);
  }

  const allResolved = [...existingPacientes];
  const existingIdSet = new Set(existingPacientes.map(p => p.id));
  for (const pac of pacientesMap.values()) {
    if (!existingIdSet.has(pac.id)) {
      allResolved.push(pac);
      existingIdSet.add(pac.id);
    } else {
      const idx = allResolved.findIndex(p => p.id === pac.id);
      if (idx !== -1 && !allResolved[idx].assinatura && pac.assinatura) {
        allResolved[idx] = pac;
      }
    }
  }

  return allResolved;
};

const buildGuiaInnerHtml = (
  g: GuiaSadt,
  ctx: PrintContext,
  guiaIndex: number,
  totalGuias: number
): string => {
  const { planos, profissionais, pacientes, senhas = [] } = ctx;

  const plano = planos.find(p => p.id === g.planoId);
  const prof = profissionais.find(p => p.id === g.profId);

  // Encontra paciente por ID, carteirinha ou nome normalizado
  const pacCleanCard = g.carteirinha && g.carteirinha !== '—' ? g.carteirinha.replace(/\D/g, '') : '';
  const pacCleanNome = normalizeName(g.pac);

  const pacInfo = pacientes.find(p => {
    if (g.pacId && (p.id === g.pacId || String(p.id) === String(g.pacId))) return true;
    if (pacCleanCard && p.carteirinha && p.carteirinha !== '—') {
      const pCard = p.carteirinha.replace(/\D/g, '');
      if (pCard === pacCleanCard || (pCard.length > 6 && (pCard.includes(pacCleanCard) || pacCleanCard.includes(pCard)))) {
        return true;
      }
    }
    if (pacCleanNome && p.nome) {
      const pNome = normalizeName(p.nome);
      if (pNome === pacCleanNome) return true;
      if (pNome.length > 5 && (pNome.startsWith(pacCleanNome) || pacCleanNome.startsWith(pNome))) return true;
    }
    return false;
  });

  // Busca objeto de senha correspondente no contexto
  const senhaObj = senhas.find(s =>
    (g.dados?.senha && s.numSenha === g.dados.senha) ||
    (g.numOp && (s.numGuiaOp === g.numOp || s.numSenha === g.numOp)) ||
    (normalizeName(s.paciente) === pacCleanNome && (s.carteirinha === g.carteirinha || !g.carteirinha))
  );

  const valSenha = g.dados?.senha || g.dados?.numSenha || senhaObj?.numSenha || '';
  const valDtValSenha = g.dados?.dtValSenha || g.dados?.validade || senhaObj?.validade || '';
  const valGuiaOp = g.numOp || g.dados?.numGuiaOp || g.dados?.numGuiaPrincipal || senhaObj?.numGuiaOp || '';
  const valGuiaPrincipal = g.dados?.numGuiaPrincipal || valGuiaOp || '';

  // Dados do Profissional Solicitante (Campos 15 a 19)
  const valProfSolicitante = g.dados?.profSolicitante || senhaObj?.profSolicitante || prof?.nome || 'CASSIA MARIA CARVALHO ABRANTES DO AMARAL';
  const valProfSolicitanteConselho = g.dados?.profSolicitanteConselho || senhaObj?.profSolicitanteConselho || prof?.conselho || 'CRM';
  const valProfSolicitanteNumConselho = g.dados?.profSolicitanteNumConselho || senhaObj?.profSolicitanteNumConselho || prof?.num || '73765';
  const valProfSolicitanteUf = g.dados?.profSolicitanteUf || senhaObj?.profSolicitanteUf || prof?.uf || 'SP';
  const valProfSolicitanteCbo = g.dados?.profSolicitanteCbo || senhaObj?.profSolicitanteCbo || prof?.cbo || '225125';

  const listProcs = g.dados?.procs && g.dados.procs.length > 0
    ? g.dados.procs
    : [{ codigo: g.codigoProcedimento || '50000470', desc: 'SESSAO DE PSICOTERAPIA INDIVIDUAL POR PSICOLOGO', qtd: 1, valor: g.valor, total: g.valor }];

  const isAmil = (plano?.nome || '').toLowerCase().includes('amil');
  const isVivest = (plano?.nome || '').toLowerCase().includes('vivest');

  let logoHtml: string;
  if (plano?.logo) {
    logoHtml = `<img src="${plano.logo}" style="max-height:36px;max-width:150px;object-fit:contain;display:block">`;
  } else if (isAmil) {
    logoHtml = `<div style="display:flex;align-items:center;gap:6px;">
      <div style="font-family:Arial,sans-serif;font-size:24pt;font-weight:900;color:#002b80;letter-spacing:-1px;line-height:1;">amil</div>
    </div>`;
  } else if (isVivest) {
    logoHtml = `<div style="display:flex;align-items:center;gap:4px;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#005a9c"><path d="M12 2L2 22h20L12 2z"/></svg>
      <span style="font-family:Arial,sans-serif;font-size:18pt;font-weight:800;color:#005a9c;">vivest</span>
    </div>`;
  } else {
    logoHtml = `<div style="font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;color:#1e293b;">${plano?.nome || 'Padrão TISS'}</div>`;
  }

  // Linhas de Itens Assistenciais Solicitados (Campos 24-28)
  const reqRowsArr = [];
  for (let i = 0; i < 5; i++) {
    const p = listProcs[i];
    if (p) {
      reqRowsArr.push(`
        <tr>
          <td style="text-align:center;">${(p as any).tabela || '22'}</td>
          <td style="text-align:center;font-family:monospace;font-weight:bold;">${p.codigo || ''}</td>
          <td style="text-align:left;font-weight:bold;padding-left:4px;">${p.desc || ''}</td>
          <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
          <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
        </tr>
      `);
    } else {
      reqRowsArr.push(`
        <tr>
          <td>&nbsp;</td><td></td><td></td><td></td><td></td>
        </tr>
      `);
    }
  }

  // Linhas de Execução / Procedimentos Realizados (Campos 36-47)
  const execRowsArr = [];
  for (let i = 0; i < 5; i++) {
    const p = listProcs[i];
    if (p) {
      execRowsArr.push(`
        <tr>
          <td style="text-align:center;">${formattedDate(g.data)}</td>
          <td style="text-align:center;"></td>
          <td style="text-align:center;"></td>
          <td style="text-align:center;">${(p as any).tabela || '22'}</td>
          <td style="text-align:center;font-family:monospace;font-weight:bold;">${p.codigo || ''}</td>
          <td style="text-align:left;font-weight:bold;padding-left:4px;">${p.desc || ''}</td>
          <td style="text-align:center;font-weight:bold;">${p.qtd ? p.qtd.toFixed(1) : '1.0'}</td>
          <td style="text-align:center;"></td>
          <td style="text-align:center;">C</td>
          <td style="text-align:center;"></td>
          <td style="text-align:right;padding-right:2px;">${p.valor ? p.valor.toFixed(2).replace('.', ',') : '0,00'}</td>
          <td style="text-align:right;font-weight:bold;padding-right:2px;">${(p.total || p.valor || g.valor).toFixed(2).replace('.', ',')}</td>
        </tr>
      `);
    } else {
      execRowsArr.push(`
        <tr>
          <td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
      `);
    }
  }

  const nowStr = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const footerRight = isAmil
    ? `Impresso em ${nowStr} &nbsp;&nbsp; Página: ${guiaIndex} de ${totalGuias} &nbsp;&nbsp; Tiss - v4.02.00`
    : `@2026 Fácil Informática - FacPlan Novo WebPlan - Versão 1.6.9.1-556352`;

  // Identificação do profissional Maria Cecilia Benessuti Donato
  const mariaCecilia = profissionais.find(p =>
    p.nome.toLowerCase().includes('maria cecilia') ||
    p.nome.toLowerCase().includes('benessuti')
  );

  // Assinatura do Beneficiário (anexada no cadastro do paciente ou diretamente na guia)
  const pacAssinatura = pacInfo?.assinatura || g.dados?.pacAssinatura || g.dados?.assinatura || '';

  // Assinatura do Profissional: fixa Maria Cecilia Benessuti Donato, com fallback para o profissional executante
  const profAssinatura = mariaCecilia?.assinatura || prof?.assinatura || '';

  // Data formatada da sessão para o campo 56
  const dataSessao = formattedDate(g.data) || '__/__/____';

  // Gera pequenas variações orgânicas/humanizadas para cada guia e impressão (escala ±6%, rotação ±1.7°, posição ±4px)
  const getHumanJitter = () => {
    const scale = Number((0.94 + Math.random() * 0.12).toFixed(3)); // Variação de tamanho (94% a 106%)
    const rotate = Number(((Math.random() - 0.5) * 3.4).toFixed(2)); // Leve inclinação manual (-1.7° a +1.7°)
    const offsetX = Number(((Math.random() - 0.5) * 8).toFixed(1));  // Deslocamento horizontal (-4px a +4px)
    const offsetY = Number(((Math.random() - 0.5) * 4).toFixed(1));  // Deslocamento vertical (-2px a +2px)
    return { scale, rotate, offsetX, offsetY };
  };

  const j57 = getHumanJitter();
  const j67 = getHumanJitter();
  const j68 = getHumanJitter();

  // HTML da assinatura no Campo 57 (mantém a linha com a assinatura sobreposta de forma humanizada)
  const assinaturaGridItem1 = `
    <span style="position:relative;display:inline-flex;align-items:center;justify-content:center;min-width:140px;height:24px;">
      <span style="color:#000;letter-spacing:-1px;user-select:none;">_________________________________________</span>
      ${pacAssinatura ? `
        <img src="${pacAssinatura}" 
             style="position:absolute;bottom:1px;left:50%;transform:translateX(calc(-50% + ${j57.offsetX}px)) translateY(${j57.offsetY}px) rotate(${j57.rotate}deg) scale(${j57.scale});transform-origin:center bottom;max-height:24px;max-width:180px;object-fit:contain;pointer-events:none;" 
             alt="Assinatura Beneficiário" />
      ` : ''}
    </span>
  `;

  // HTML da assinatura no Campo 67 (Assinatura Beneficiário ou Responsável com variação humanizada)
  const assinaturaCampo67 = pacAssinatura
    ? `<div style="height:34px;display:flex;align-items:flex-end;justify-content:center;overflow:visible;">
         <img src="${pacAssinatura}" 
              style="transform:translate(${j67.offsetX}px, ${j67.offsetY}px) rotate(${j67.rotate}deg) scale(${j67.scale});transform-origin:center bottom;max-height:34px;max-width:250px;object-fit:contain;" 
              alt="Assinatura Beneficiário" />
       </div>`
    : '';

  // HTML da assinatura no Campo 68 (Assinatura do Contratado com variação humanizada)
  const assinaturaCampo68 = profAssinatura
    ? `<div style="height:34px;display:flex;align-items:flex-end;justify-content:center;overflow:visible;">
         <img src="${profAssinatura}" 
              style="transform:translate(${j68.offsetX}px, ${j68.offsetY}px) rotate(${j68.rotate}deg) scale(${j68.scale});transform-origin:center bottom;max-height:34px;max-width:250px;object-fit:contain;" 
              alt="Assinatura Profissional" />
       </div>`
    : '';

  return `
    <div class="guia-box">
      <!-- HEADER -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:3px;">
        <tr>
          <td style="width: 25%; vertical-align: middle;">${logoHtml}</td>
          <td style="width: 50%; text-align: center; vertical-align: middle;">
            <div style="font-size: 9.5pt; font-weight: bold; text-transform: uppercase; line-height: 1.1;">
              GUIA DE SERVIÇO PROFISSIONAL / SERVIÇO AUXILIAR DE<br>DIAGNÓSTICO E TERAPIA (SP/SADT)
            </div>
          </td>
          <td style="width: 25%; text-align: right; vertical-align: top;">
            <div style="font-size: 6.5pt; font-weight: bold;">2 - Nº Guia no Prestador</div>
            <div style="font-size: 11pt; font-weight: bold; font-family: monospace;">${g.num}</div>
          </td>
        </tr>
      </table>

      <!-- CAMPOS 1 A 7 -->
      <table class="tiss-tbl">
        <tr>
          <td style="width: 14%;"><span class="lbl">1 - Registro ANS</span><span class="val">${plano?.ans || '315478'}</span></td>
          <td style="width: 36%;"><span class="lbl">3 – Número da Guia Principal</span><span class="val">${valGuiaPrincipal}</span></td>
          <td style="width: 12.5%;"><span class="lbl">4 - Data Autorização</span><span class="val">${formattedDate(g.dados?.dtAut || g.data)}</span></td>
          <td style="width: 12.5%;"><span class="lbl">5 - Senha</span><span class="val">${valSenha}</span></td>
          <td style="width: 12.5%;"><span class="lbl">6 - Validade Senha</span><span class="val">${formattedDate(valDtValSenha)}</span></td>
          <td style="width: 12.5%;"><span class="lbl">7 - Nº Guia Operadora</span><span class="val">${valGuiaOp}</span></td>
        </tr>
      </table>

      <!-- DADOS DO BENEFICIÁRIO -->
      <div class="sec-title">Dados do Beneficiário</div>
      <table class="tiss-tbl">
        <tr>
          <td style="width: 22%;"><span class="lbl">8 - Número da Carteira</span><span class="val">${g.carteirinha || pacInfo?.carteirinha || ''}</span></td>
          <td style="width: 15%;"><span class="lbl">9 - Validade Carteira</span><span class="val">${formattedDate((pacInfo as any)?.valCarteirinha || '31/12/2199')}</span></td>
          <td style="width: 38%;"><span class="lbl">10 - Nome</span><span class="val">${g.pac}</span></td>
          <td style="width: 15%;"><span class="lbl">89 - Nome Social</span><span class="val">${(pacInfo as any)?.nomeSocial || ''}</span></td>
          <td style="width: 10%;"><span class="lbl">12 - Atendimento RN</span><span class="val">${g.dados?.atendRN || 'Não'}</span></td>
        </tr>
      </table>

      <!-- DADOS DO SOLICITANTE -->
      <div class="sec-title">Dados do Solicitante</div>
      <table class="tiss-tbl">
        <tr>
          <td style="width: 20%;"><span class="lbl">13 - Código na Operadora</span><span class="val">${plano?.codPrestador || '405161'}</span></td>
          <td style="width: 80%;" colspan="7"><span class="lbl">14 - Nome do Contratado</span><span class="val">${plano?.nomeContratado || 'MARIA CECILIA B D S PSICOLOGIA LTDA'}</span></td>
        </tr>
        <tr>
          <td style="width: 38%;" colspan="2"><span class="lbl">15 - Nome do Profissional Solicitante</span><span class="val">${valProfSolicitante}</span></td>
          <td style="width: 12%;"><span class="lbl">16 - Conselho</span><span class="val">${valProfSolicitanteConselho}</span></td>
          <td style="width: 14%;"><span class="lbl">17 - Nº Conselho</span><span class="val">${valProfSolicitanteNumConselho}</span></td>
          <td style="width: 6%;"><span class="lbl">18 - UF</span><span class="val">${valProfSolicitanteUf}</span></td>
          <td style="width: 12%;"><span class="lbl">19 - Código CBO</span><span class="val">${valProfSolicitanteCbo}</span></td>
          <td style="width: 18%;"><span class="lbl">20 - Assinatura Profissional Solicitante</span><span class="val"></span></td>
        </tr>
      </table>

      <!-- DADOS DA SOLICITAÇÃO / PROCEDIMENTOS SOLICITADOS -->
      <div class="sec-title">Dados da Solicitação / Procedimentos ou Itens Assistenciais Solicitados</div>
      <table class="tiss-tbl">
        <tr>
          <td style="width: 25%;"><span class="lbl">21 - Caráter do Atendimento</span><span class="val">${g.dados?.caraterAtend || 'Eletivo'}</span></td>
          <td style="width: 25%;"><span class="lbl">22 - Data da Solicitação</span><span class="val">${formattedDate(g.data)}</span></td>
          <td style="width: 25%;"><span class="lbl">23 - Indicação Clínica</span><span class="val">${g.cid || 'f41'}</span></td>
          <td style="width: 25%;"><span class="lbl">90 - Indicador Cobertura Especial</span><span class="val"></span></td>
        </tr>
      </table>

      <table class="tiss-tbl">
        <thead>
          <tr>
            <th class="th-hdr" style="width: 6%;">24-Tabela</th>
            <th class="th-hdr" style="width: 14%;">25-Código Procedimento</th>
            <th class="th-hdr" style="width: 64%;">26 - Descrição</th>
            <th class="th-hdr" style="width: 8%;">27-Qtde.Solic.</th>
            <th class="th-hdr" style="width: 8%;">28-Qtde.Aut.</th>
          </tr>
        </thead>
        <tbody>
          ${reqRowsArr.join('')}
        </tbody>
      </table>

      <!-- DADOS DO CONTRATADO EXECUTANTE -->
      <div class="sec-title">Dados do Contratado Executante</div>
      <table class="tiss-tbl">
        <tr>
          <td style="width: 20%;"><span class="lbl">29 - Código na Operadora</span><span class="val">${plano?.codPrestador || '405161'}</span></td>
          <td style="width: 60%;"><span class="lbl">30 - Nome do Contratado</span><span class="val">${plano?.nomeContratado || 'MARIA CECILIA B D S PSICOLOGIA LTDA'}</span></td>
          <td style="width: 20%;"><span class="lbl">31 - Código CNES</span><span class="val">${plano?.cnes || '0620904'}</span></td>
        </tr>
      </table>

      <!-- DADOS DO ATENDIMENTO -->
      <div class="sec-title">Dados do Atendimento</div>
      <table class="tiss-tbl">
        <tr>
          <td style="width: 18%;"><span class="lbl">32 - Tipo de Atendimento</span><span class="val">${g.dados?.tipoAtendimento || '(3) TERAPIA'}</span></td>
          <td style="width: 24%;"><span class="lbl">33 - Indicação de Acidente</span><span class="val">${g.dados?.indicacaoAcidente || '(2) OUTROS'}</span></td>
          <td style="width: 20%;"><span class="lbl">34 - Tipo de Consulta</span><span class="val">${g.dados?.tipoConsulta || '(1) PRIMEIRA CONSULTA'}</span></td>
          <td style="width: 18%;"><span class="lbl">35 - Motivo Encerramento</span><span class="val"></span></td>
          <td style="width: 10%;"><span class="lbl">91 - Regime</span><span class="val">(1) Ambulatorial</span></td>
          <td style="width: 10%;"><span class="lbl">92 - Saúde Ocup.</span><span class="val"></span></td>
        </tr>
      </table>

      <!-- DADOS DA EXECUÇÃO / PROCEDIMENTOS E EXAMES REALIZADOS -->
      <div class="sec-title">Dados da Execução / Procedimentos e Exames Realizados</div>
      <table class="tiss-tbl">
        <thead>
          <tr>
            <th class="th-hdr" style="width: 9%;">36-Data</th>
            <th class="th-hdr" style="width: 6%;">37-Hora Ini</th>
            <th class="th-hdr" style="width: 6%;">38-Hora Fim</th>
            <th class="th-hdr" style="width: 5%;">39-Tab</th>
            <th class="th-hdr" style="width: 11%;">40-Código</th>
            <th class="th-hdr" style="width: 35%;">41-Descrição</th>
            <th class="th-hdr" style="width: 5%;">42-Qtde</th>
            <th class="th-hdr" style="width: 4%;">43-Via</th>
            <th class="th-hdr" style="width: 4%;">44-Tec</th>
            <th class="th-hdr" style="width: 4%;">45-Fator</th>
            <th class="th-hdr" style="width: 5.5%;">46-Valor Unit</th>
            <th class="th-hdr" style="width: 5.5%;">47-Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${execRowsArr.join('')}
        </tbody>
      </table>

      <!-- IDENTIFICAÇÃO DO PROFISSIONAL EXECUTANTE -->
      <div class="sec-title">Identificação do(s) Profissional(is) Executante(s)</div>
      <table class="tiss-tbl">
        <thead>
          <tr>
            <th class="th-hdr" style="width: 5%;">48-Seq</th>
            <th class="th-hdr" style="width: 6%;">49-Grau</th>
            <th class="th-hdr" style="width: 15%;">50-CPF / Código Operadora</th>
            <th class="th-hdr" style="width: 40%;">51-Nome do Profissional</th>
            <th class="th-hdr" style="width: 10%;">52-Conselho</th>
            <th class="th-hdr" style="width: 12%;">53-Número Conselho</th>
            <th class="th-hdr" style="width: 4%;">54-UF</th>
            <th class="th-hdr" style="width: 8%;">55-CBO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center;">1</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;">${(prof as any)?.cpf || (mariaCecilia as any)?.cpf || '27700196869'}</td>
            <td style="font-weight:bold;">${prof?.nome || mariaCecilia?.nome || 'MARIA CECILIA BENESSUTI DONATO'}</td>
            <td style="text-align:center;">${prof?.conselho || mariaCecilia?.conselho || 'CRP'}</td>
            <td style="text-align:center;">${prof?.num || mariaCecilia?.num || '71849'}</td>
            <td style="text-align:center;">${prof?.uf || mariaCecilia?.uf || 'SP'}</td>
            <td style="text-align:center;">${prof?.cbo || mariaCecilia?.cbo || '251510'}</td>
          </tr>
          <tr><td style="text-align:center;">2</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <!-- PROCEDIMENTOS EM SÉRIE (CAMPO 56 E 57) -->
      <table class="tiss-tbl">
        <tr>
          <td style="background:#fff; padding:1px 3px;">
            <span class="lbl">56-Data de Realização de Procedimentos em Série &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 57-Assinatura do Beneficiário ou Responsável</span>
            <div class="serial-grid">
              <div class="serial-item">
                <span style="font-weight:bold;">1 - ${dataSessao}</span>
                ${assinaturaGridItem1}
              </div>
              <div class="serial-item"><span>3 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>2 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>4 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>5 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>7 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>6 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>8 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>9 - __/__/____</span><span>_________________________________________</span></div>
              <div class="serial-item"><span>10 - __/__/____</span><span>________________________________________</span></div>
            </div>
          </td>
        </tr>
      </table>

      <!-- OBSERVAÇÃO / JUSTIFICATIVA -->
      <table class="tiss-tbl">
        <tr>
          <td style="padding: 2px 3px;">
            <span class="lbl">58 - Observação / Justificativa</span>
            <span class="val" style="font-size: 6pt; font-family: monospace; font-weight: normal;">
              Senha FacPlan ( ${valSenha || '—'} ) - Validade: ( ${formattedDate(valDtValSenha) || '—'} ) - LIBERAÇÃO REG. SERVIÇO : G.'${valGuiaOp || g.num}' PRES: '${g.num}' TELEFONE DO LOCAL DE ATENDIMENTO: 11 - 4586-8755
            </span>
          </td>
        </tr>
      </table>

      <!-- TOTAIS -->
      <table class="tiss-tbl">
        <tr>
          <td><span class="lbl">59 - Total Procedimentos</span><span class="val">R$ ${g.valor.toFixed(2).replace('.', ',')}</span></td>
          <td><span class="lbl">60 - Total Taxas/Aluguéis</span><span class="val">R$ 0,00</span></td>
          <td><span class="lbl">61 - Total Materiais</span><span class="val">R$ 0,00</span></td>
          <td><span class="lbl">62 - Total OPME</span><span class="val">R$ 0,00</span></td>
          <td><span class="lbl">63 - Total Medicamentos</span><span class="val">R$ 0,00</span></td>
          <td><span class="lbl">64 - Total Gases</span><span class="val">R$ 0,00</span></td>
          <td style="background:#f0f0f0;"><span class="lbl">65 - Total Geral</span><span class="val">R$ ${g.valor.toFixed(2).replace('.', ',')}</span></td>
        </tr>
      </table>

      <!-- ASSINATURAS FINAIS (CAMPOS 66, 67, 68) -->
      <table class="tiss-tbl" style="margin-bottom: 2px;">
        <tr style="height: 48px; vertical-align: top;">
          <td style="width: 33%;"><span class="lbl">66 - Assinatura Responsável Autorização</span></td>
          <td style="width: 34%; position: relative;">
            <span class="lbl">67 - Assinatura Beneficiário ou Responsável</span>
            ${assinaturaCampo67}
          </td>
          <td style="width: 33%; position: relative;">
            <span class="lbl">68 - Assinatura do Contratado</span>
            ${assinaturaCampo68}
          </td>
        </tr>
      </table>

      <!-- FOOTER -->
      <div class="footer-line">
        <div>Guia SP/SADT &nbsp; | &nbsp; ${g.num}</div>
        <div>${footerRight}</div>
      </div>
    </div>
  `;
};

const getCommonCss = () => `
  @page {
    size: A4 portrait;
    margin: 4mm 6mm;
  }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6.5pt;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .print-toolbar {
    position: sticky;
    top: 0;
    z-index: 1000;
    background: #1e293b;
    color: #fff;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    font-family: sans-serif;
  }
  .print-btn {
    background: #4f46e5;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.2s;
  }
  .print-btn:hover {
    background: #4338ca;
  }
  .close-btn {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #475569;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 12px;
    cursor: pointer;
  }
  .close-btn:hover {
    color: #fff;
    border-color: #cbd5e1;
  }
  .guia-page-wrapper {
    page-break-after: always;
    break-after: page;
    padding: 6px 4px;
  }
  .guia-page-wrapper:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .guia-box {
    width: 100%;
    max-width: 200mm;
    margin: 0 auto;
  }
  .sec-title {
    background-color: #d9d9d9;
    font-weight: bold;
    font-size: 6.5pt;
    padding: 2px 4px;
    border: 1px solid #000;
    border-bottom: none;
    text-transform: uppercase;
    letter-spacing: 0.2px;
  }
  table.tiss-tbl {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 2px;
  }
  table.tiss-tbl td, table.tiss-tbl th {
    border: 1px solid #000;
    padding: 1.5px 3px;
    vertical-align: top;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lbl {
    font-size: 5.5pt;
    font-weight: bold;
    color: #111;
    display: block;
    line-height: 1;
    margin-bottom: 1px;
  }
  .val {
    font-size: 7.5pt;
    font-weight: bold;
    color: #000;
    line-height: 1.1;
    min-height: 9px;
    display: block;
  }
  th.th-hdr {
    background: #e6e6e6;
    font-size: 5.5pt;
    font-weight: bold;
    text-align: center;
    border: 1px solid #000;
    padding: 2px 1px;
  }
  .serial-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px 12px;
    font-size: 5.5pt;
    padding: 2px;
  }
  .serial-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
  }
  .footer-line {
    display: flex;
    justify-content: space-between;
    font-size: 5.5pt;
    color: #333;
    margin-top: 3px;
    padding-top: 2px;
    border-top: 1px solid #000;
  }
  @media print {
    .print-toolbar {
      display: none !important;
    }
    body {
      padding: 0;
    }
    .guia-page-wrapper {
      padding: 0;
      page-break-after: always;
      break-after: page;
    }
    .guia-page-wrapper:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
`;

export const tissPrintService = {
  /**
   * Imprime uma Guia SADT individual
   */
  imprimirGuiaIndividual: async (guia: GuiaSadt, ctx: PrintContext) => {
    // Abre aba imediatamente para contornar bloqueio de popups durante o await
    let win: Window | null = null;
    try {
      win = window.open('', '_blank');
      if (win && win.document) {
        win.document.write('<!DOCTYPE html><html><head><title>Carregando Guia SADT...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569;"><p>Carregando guia e assinaturas para impress\u00e3o...</p></body></html>');
      }
    } catch (e) {}

    const resolvedPacientes = await resolvePacientesForGuias([guia], ctx.pacientes || []);
    const enrichedCtx = { ...ctx, pacientes: resolvedPacientes };
    const guiaHtml = buildGuiaInnerHtml(guia, enrichedCtx, 1, 1);

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Guia SADT - ${guia.num}</title>
        <style>${getCommonCss()}</style>
      </head>
      <body>
        <div class="print-toolbar">
          <div>
            <strong style="font-size:14px;">Guia SADT #${guia.num}</strong>
            <span style="font-size:12px;color:#94a3b8;margin-left:8px;">${guia.pac} - ${guia.plano}</span>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="print-btn" onclick="window.print()">
              🖨️ Imprimir / Salvar PDF
            </button>
            <button class="close-btn" onclick="window.close()">Fechar</button>
          </div>
        </div>

        <div class="guia-page-wrapper">
          ${guiaHtml}
        </div>

        <script>
          window.addEventListener('load', () => {
            setTimeout(() => {
              try { window.print(); } catch(e) {}
            }, 600);
          });
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      const fallbackWin = window.open(url, '_blank', 'width=1000,height=850');
      if (!fallbackWin) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `guia_sadt_${guia.num}.html`;
        a.click();
      }
    }
  },

  /**
   * Imprime todas as Guias pertencentes a um Lote TISS em um único documento PDF (uma por página A4)
   */
  imprimirLoteGuias: async (lote: LoteTiss, guiasDoLote: GuiaSadt[], ctx: PrintContext) => {
    if (!guiasDoLote || guiasDoLote.length === 0) {
      alert(`Nenhuma guia vinculada ao Lote ${lote.num} para impressão.`);
      return;
    }

    // Abre aba imediatamente para contornar bloqueio de popups durante o await
    let win: Window | null = null;
    try {
      win = window.open('', '_blank');
      if (win && win.document) {
        win.document.write('<!DOCTYPE html><html><head><title>Carregando Lote TISS...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#475569;"><p>Carregando guias e assinaturas do lote...</p></body></html>');
      }
    } catch (e) {}

    const resolvedPacientes = await resolvePacientesForGuias(guiasDoLote, ctx.pacientes || []);
    const enrichedCtx = { ...ctx, pacientes: resolvedPacientes };

    const totalGuias = guiasDoLote.length;
    const guiasHtmlArr = guiasDoLote.map((g, idx) => `
      <div class="guia-page-wrapper">
        ${buildGuiaInnerHtml(g, enrichedCtx, idx + 1, totalGuias)}
      </div>
    `).join('');

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Lote TISS ${lote.num} - ${guiasDoLote.length} Guias SADT</title>
        <style>${getCommonCss()}</style>
      </head>
      <body>
        <div class="print-toolbar">
          <div>
            <strong style="font-size:14px;">Lote TISS #${lote.num}</strong>
            <span style="font-size:12px;color:#94a3b8;margin-left:8px;">${lote.plano} &bull; ${guiasDoLote.length} guias &bull; R$ ${lote.valor.toFixed(2).replace('.', ',')}</span>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="print-btn" onclick="window.print()">
              🖨️ Imprimir Todas as Guias (${guiasDoLote.length}) / Salvar PDF
            </button>
            <button class="close-btn" onclick="window.close()">Fechar</button>
          </div>
        </div>

        ${guiasHtmlArr}

        <script>
          window.addEventListener('load', () => {
            setTimeout(() => {
              try { window.print(); } catch(e) {}
            }, 800);
          });
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    if (win && !win.closed) {
      win.location.href = url;
    } else {
      const fallbackWin = window.open(url, '_blank', 'width=1000,height=850');
      if (!fallbackWin) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `lote_${lote.num}_guias.html`;
        a.click();
      }
    }
  }
};
