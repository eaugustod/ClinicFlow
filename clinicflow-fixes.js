// ============================================================
// clinicflow-fixes.js — ClinicFlow Bug Fixes
// Inclua este arquivo no final do <body>, após o script principal
// <script src="clinicflow-fixes.js"></script>
// ============================================================

(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // 0. UTILITÁRIOS
  // ──────────────────────────────────────────────────────────

  function getSupabase() {
    // Tenta pegar o cliente Supabase já inicializado no app principal.
    // O app principal deve expor: window._supabase = supabaseClient
    // Se não expõe, criamos aqui com as credenciais salvas no localStorage.
    if (window._supabase) return window._supabase;
    const url = localStorage.getItem('sb_url');
    const key = localStorage.getItem('sb_key');
    if (!url || !key) return null;
    if (window.supabase && window.supabase.createClient) {
      window._supabase = window.supabase.createClient(url, key);
      return window._supabase;
    }
    return null;
  }

  function sb() {
    const client = getSupabase();
    if (!client) {
      console.warn('[ClinicFlow] Supabase não conectado.');
    }
    return client;
  }

  // Formata data ISO → DD/MM/AAAA
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso + (iso.includes('T') ? '' : 'T00:00:00'));
    return d.toLocaleDateString('pt-BR');
  }

  // Formata valor → R$ x.xxx,xx
  function fmtMoney(v) {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Retorna data de hoje em formato YYYY-MM-DD
  function today() {
    return new Date().toISOString().split('T')[0];
  }

  // Mostra notificação temporária
  function toast(msg, tipo = 'success') {
    const cores = { success: '#16a34a', error: '#dc2626', info: '#2563eb' };
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:99999;
      background:${cores[tipo] || cores.info};color:#fff;
      padding:12px 20px;border-radius:8px;font-size:14px;
      box-shadow:0 4px 12px rgba(0,0,0,.25);
      animation:fadeInUp .3s ease;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ──────────────────────────────────────────────────────────
  // 1. DASHBOARD — Guias Pendentes e Profissionais Hoje
  // ──────────────────────────────────────────────────────────

  async function carregarDashboardExtras() {
    const client = sb();
    if (!client) return;

    // --- 1a. Guias pendentes ---
    try {
      const { data: guias, error } = await client
        .from('guias_sadt')
        .select('id, paciente, plano, valor_total, status, data_atendimento')
        .eq('status', 'Pendente')
        .order('data_atendimento', { ascending: false });

      if (error) throw error;

      // Procura o container de guias pendentes pelo título
      const secoes = document.querySelectorAll('.dashboard-section, .card, [data-section]');
      let containerGuias = null;

      // Estratégia: procura elemento com texto "Guias pendentes"
      document.querySelectorAll('*').forEach(el => {
        if (
          el.children.length === 0 &&
          el.textContent.trim().toLowerCase() === 'guias pendentes'
        ) {
          containerGuias = el.closest('.card, section, div[class*="card"], div[class*="section"]');
        }
      });

      // Fallback: procura por id ou class
      if (!containerGuias) {
        containerGuias =
          document.getElementById('dashboard-guias-pendentes') ||
          document.querySelector('[data-widget="guias-pendentes"]');
      }

      if (containerGuias) {
        renderGuiasPendentes(containerGuias, guias || []);
      } else {
        // Cria widget flutuante se não encontrar o container
        renderGuiasPendentesWidget(guias || []);
      }
    } catch (e) {
      console.error('[Dashboard] Erro ao carregar guias pendentes:', e);
    }

    // --- 1b. Profissionais hoje ---
    try {
      const { data: agendamentos, error: errAg } = await client
        .from('agendamentos')
        .select(`
          id,
          profissional,
          horario_inicio,
          horario_fim,
          status,
          paciente
        `)
        .eq('data', today());

      if (errAg) throw errAg;

      // Agrupa por profissional
      const profMap = {};
      (agendamentos || []).forEach(ag => {
        if (!profMap[ag.profissional]) {
          profMap[ag.profissional] = { consultas: 0, confirmados: 0 };
        }
        profMap[ag.profissional].consultas++;
        if (ag.status === 'Confirmado' || ag.status === 'Atendido') {
          profMap[ag.profissional].confirmados++;
        }
      });

      // Busca profissionais ativos para cruzar cores/especialidades
      const { data: profissionais } = await client
        .from('profissionais')
        .select('nome, especialidade, cor_agenda')
        .eq('status', 'Ativo');

      const profObj = {};
      (profissionais || []).forEach(p => { profObj[p.nome] = p; });

      // Renderiza
      let containerProf = document.getElementById('dashboard-profissionais-hoje') ||
        document.querySelector('[data-widget="profissionais-hoje"]');

      if (!containerProf) {
        // Tenta encontrar pelo título
        document.querySelectorAll('*').forEach(el => {
          if (
            el.children.length === 0 &&
            el.textContent.trim().toLowerCase() === 'profissionais hoje'
          ) {
            containerProf = el.closest('.card, section, div[class*="card"], div[class*="section"]');
          }
        });
      }

      if (containerProf) {
        renderProfissionaisHoje(containerProf, profMap, profObj);
      } else {
        renderProfissionaisHojeWidget(profMap, profObj);
      }
    } catch (e) {
      console.error('[Dashboard] Erro ao carregar profissionais hoje:', e);
    }
  }

  function renderGuiasPendentes(container, guias) {
    // Remove tabela anterior se existir
    const velha = container.querySelector('.fix-guias-table');
    if (velha) velha.remove();

    const total = guias.reduce((s, g) => s + (parseFloat(g.valor_total) || 0), 0);

    const wrapper = document.createElement('div');
    wrapper.className = 'fix-guias-table';
    wrapper.style.cssText = 'margin-top:8px;overflow-x:auto;';

    if (guias.length === 0) {
      wrapper.innerHTML = '<p style="color:#6b7280;font-size:13px;padding:8px 0">Nenhuma guia pendente.</p>';
    } else {
      let html = `
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
          ${guias.length} guia(s) · Total: <strong>${fmtMoney(total)}</strong>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Paciente</th>
              <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e7eb;">Plano</th>
              <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e7eb;">Valor</th>
              <th style="padding:6px 8px;text-align:center;border-bottom:1px solid #e5e7eb;">Data</th>
            </tr>
          </thead>
          <tbody>
      `;
      guias.slice(0, 10).forEach(g => {
        html += `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:5px 8px;">${g.paciente || '—'}</td>
            <td style="padding:5px 8px;">${g.plano || '—'}</td>
            <td style="padding:5px 8px;text-align:right;">${fmtMoney(g.valor_total)}</td>
            <td style="padding:5px 8px;text-align:center;">${fmtDate(g.data_atendimento)}</td>
          </tr>
        `;
      });
      if (guias.length > 10) {
        html += `<tr><td colspan="4" style="padding:5px 8px;color:#6b7280;font-size:12px;">
          + ${guias.length - 10} guia(s) não exibida(s)</td></tr>`;
      }
      html += '</tbody></table>';
      wrapper.innerHTML = html;
    }

    container.appendChild(wrapper);
  }

  function renderGuiasPendentesWidget(guias) {
    // Widget independente inserido no dashboard
    const dash = document.querySelector('#dashboard, [data-page="dashboard"], .dashboard-content, main');
    if (!dash) return;

    const existing = document.getElementById('fix-widget-guias');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'fix-widget-guias';
    card.style.cssText = `
      background:#fff;border-radius:12px;padding:16px 20px;
      box-shadow:0 1px 4px rgba(0,0,0,.08);margin:16px 0;
    `;
    card.innerHTML = `<h3 style="font-size:15px;font-weight:600;margin:0 0 8px;color:#111827;">
      Guias pendentes <span style="background:#fef3c7;color:#92400e;border-radius:999px;
      font-size:12px;padding:2px 8px;margin-left:6px;">${guias.length}</span></h3>`;
    renderGuiasPendentes(card, guias);
    dash.prepend(card);
  }

  function renderProfissionaisHoje(container, profMap, profObj) {
    const velha = container.querySelector('.fix-prof-table');
    if (velha) velha.remove();

    const wrapper = document.createElement('div');
    wrapper.className = 'fix-prof-table';
    wrapper.style.cssText = 'margin-top:8px;';

    const nomes = Object.keys(profMap);
    if (nomes.length === 0) {
      wrapper.innerHTML = '<p style="color:#6b7280;font-size:13px;padding:8px 0">Nenhum profissional com agenda hoje.</p>';
    } else {
      let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
      nomes.forEach(nome => {
        const dados = profMap[nome];
        const prof = profObj[nome] || {};
        const cor = prof.cor_agenda || '#6366f1';
        html += `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;
                      background:#f9fafb;border-radius:8px;border-left:3px solid ${cor};">
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:600;color:#111827;">${nome}</div>
              <div style="font-size:11px;color:#6b7280;">${prof.especialidade || ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:13px;font-weight:600;color:#111827;">${dados.consultas} consulta(s)</div>
              <div style="font-size:11px;color:#16a34a;">${dados.confirmados} confirmado(s)</div>
            </div>
          </div>
        `;
      });
      html += '</div>';
      wrapper.innerHTML = html;
    }
    container.appendChild(wrapper);
  }

  function renderProfissionaisHojeWidget(profMap, profObj) {
    const dash = document.querySelector('#dashboard, [data-page="dashboard"], .dashboard-content, main');
    if (!dash) return;

    const existing = document.getElementById('fix-widget-prof');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'fix-widget-prof';
    card.style.cssText = `
      background:#fff;border-radius:12px;padding:16px 20px;
      box-shadow:0 1px 4px rgba(0,0,0,.08);margin:16px 0;
    `;
    const nomes = Object.keys(profMap);
    card.innerHTML = `<h3 style="font-size:15px;font-weight:600;margin:0 0 8px;color:#111827;">
      Profissionais hoje <span style="background:#dbeafe;color:#1d4ed8;border-radius:999px;
      font-size:12px;padding:2px 8px;margin-left:6px;">${nomes.length}</span></h3>`;
    renderProfissionaisHoje(card, profMap, profObj);
    dash.prepend(card);
  }

  // ──────────────────────────────────────────────────────────
  // 2. AGENDAMENTO — Preencher Guia SADT automaticamente
  // ──────────────────────────────────────────────────────────

  async function preencherGuiaAutomatico() {
    const client = sb();
    if (!client) { toast('Supabase não conectado.', 'error'); return; }

    // Lê campos do formulário de agendamento
    const pacienteEl = document.querySelector(
      '#agendamento-paciente, [data-field="paciente"], select[name="paciente"]'
    );
    const carteirinhaEl = document.querySelector(
      '#agendamento-carteirinha, [data-field="carteirinha"], input[name="carteirinha"]'
    );
    const planoEl = document.querySelector(
      '#agendamento-plano, [data-field="plano"], select[name="plano"]'
    );
    const dataEl = document.querySelector(
      '#agendamento-data, [data-field="data"], input[name="data"][type="date"], input[type="date"]'
    );

    const nomePaciente = pacienteEl ? (pacienteEl.value || pacienteEl.options?.[pacienteEl.selectedIndex]?.text) : '';
    const carteirinha = carteirinhaEl ? carteirinhaEl.value : '';
    const dataAtend = dataEl ? dataEl.value : today();

    if (!nomePaciente) {
      toast('Selecione um paciente antes de preencher a guia.', 'error');
      return;
    }

    try {
      // Busca autorização válida na tabela de senhas/autorizações
      let query = client
        .from('senhas_autorizacoes')
        .select('*')
        .eq('status', 'Ativa')
        .lte('data_autorizacao', dataAtend)
        .gte('validade_senha', dataAtend)
        .order('data_autorizacao', { ascending: false });

      // Filtra por nome do paciente (campo pode variar — ajuste conforme seu schema)
      if (nomePaciente) query = query.ilike('paciente', `%${nomePaciente}%`);
      if (carteirinha) query = query.eq('carteirinha', carteirinha);

      const { data: auths, error } = await query.limit(5);
      if (error) throw error;

      if (!auths || auths.length === 0) {
        toast('Nenhuma autorização válida encontrada para este paciente.', 'info');
        return;
      }

      // Usa a primeira autorização encontrada
      const auth = auths[0];
      preencherCamposGuia(auth, dataAtend);
      toast('Dados da guia preenchidos automaticamente!', 'success');
    } catch (e) {
      console.error('[Guia] Erro ao buscar autorização:', e);
      toast('Erro ao buscar autorização: ' + e.message, 'error');
    }
  }

  function preencherCamposGuia(auth, dataAtend) {
    // Mapeamento de campos da guia SADT → dados da autorização
    // Ajuste os seletores conforme os ids/names reais do seu HTML

    const campos = {
      // Nº Guia Principal (campo 3)
      '#guia-num-principal, [data-guia="3"], input[placeholder*="Guia Principal"]':
        auth.num_guia_operadora || auth.numero_guia || '',

      // Data de autorização (campo 4)
      '#guia-dt-autorizacao, [data-guia="4"], input[placeholder*="Autorização"]':
        auth.data_autorizacao ? auth.data_autorizacao.split('T')[0] : '',

      // Senha (campo 5)
      '#guia-senha, [data-guia="5"], input[placeholder*="Senha"]':
        auth.numero_senha || auth.num_senha || '',

      // Validade da senha (campo 6)
      '#guia-validade-senha, [data-guia="6"], input[placeholder*="Validade"]':
        auth.validade_senha ? auth.validade_senha.split('T')[0] : '',

      // Nº guia atribuída pela operadora (campo 7)
      '#guia-num-operadora, [data-guia="7"], input[placeholder*="Operadora"]':
        auth.num_guia_operadora || '',
    };

    Object.entries(campos).forEach(([selector, valor]) => {
      try {
        const el = document.querySelector(selector);
        if (el && valor !== undefined && valor !== null) {
          el.value = valor;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } catch (_) {}
    });

    // Preenche procedimentos (campos 25/40 — código, descrição, valor)
    preencherProcedimentosGuia(auth);
  }

  function preencherProcedimentosGuia(auth) {
    // Tenta ler os procedimentos autorizados (pode ser array JSON ou string)
    let procs = [];
    try {
      if (Array.isArray(auth.procedimentos)) {
        procs = auth.procedimentos;
      } else if (typeof auth.procedimentos === 'string' && auth.procedimentos.startsWith('[')) {
        procs = JSON.parse(auth.procedimentos);
      } else if (auth.codigo_tuss || auth.codigo_proc) {
        // Procedimento único
        procs = [{
          codigo: auth.codigo_tuss || auth.codigo_proc || '',
          descricao: auth.descricao || auth.procedimento || '',
          quantidade: auth.qtd_autorizada || 1,
          valor: auth.valor_unitario || 0,
        }];
      }
    } catch (_) {}

    if (procs.length === 0) return;

    // Tenta preencher na tabela de procedimentos solicitados (campos 24-28)
    // e na tabela de procedimentos realizados (campos 36-46)
    procs.forEach((proc, idx) => {
      const i = idx + 1;

      // Procedimentos SOLICITADOS
      preencherCampoProc(`[data-proc-sol-cod="${i}"], .proc-sol-row:nth-child(${i}) .cod-proc`, proc.codigo);
      preencherCampoProc(`[data-proc-sol-desc="${i}"], .proc-sol-row:nth-child(${i}) .desc-proc`, proc.descricao);
      preencherCampoProc(`[data-proc-sol-qt="${i}"], .proc-sol-row:nth-child(${i}) .qt-solic`, proc.quantidade);

      // Procedimentos REALIZADOS
      preencherCampoProc(`[data-proc-real-cod="${i}"], .proc-real-row:nth-child(${i}) .cod-proc`, proc.codigo);
      preencherCampoProc(`[data-proc-real-desc="${i}"], .proc-real-row:nth-child(${i}) .desc-proc`, proc.descricao);
      preencherCampoProc(`[data-proc-real-qt="${i}"], .proc-real-row:nth-child(${i}) .qtd-real`, proc.quantidade);
      preencherCampoProc(`[data-proc-real-vl="${i}"], .proc-real-row:nth-child(${i}) .vl-unit`, proc.valor);
    });
  }

  function preencherCampoProc(selector, valor) {
    try {
      const el = document.querySelector(selector);
      if (el && valor !== undefined && valor !== null && valor !== '') {
        el.value = valor;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (_) {}
  }

  // ──────────────────────────────────────────────────────────
  // 3. AGENDAMENTO — Salvar no Supabase
  // ──────────────────────────────────────────────────────────

  async function salvarAgendamento(dadosForm) {
    const client = sb();
    if (!client) { toast('Supabase não conectado.', 'error'); return false; }

    try {
      const payload = {
        profissional: dadosForm.profissional || '',
        data: dadosForm.data || today(),
        horario_inicio: dadosForm.horario_inicio || '',
        horario_fim: dadosForm.horario_fim || '',
        duracao: dadosForm.duracao || 60,
        modalidade: dadosForm.modalidade || 'Presencial',
        link_meet: dadosForm.link_meet || null,
        paciente: dadosForm.paciente || '',
        plano: dadosForm.plano || '',
        carteirinha: dadosForm.carteirinha || '',
        tipo_atendimento: dadosForm.tipo_atendimento || '',
        status: dadosForm.status || 'Agendado',
        observacoes: dadosForm.observacoes || '',
        updated_at: new Date().toISOString(),
      };

      let result;
      if (dadosForm.id) {
        // Update
        result = await client
          .from('agendamentos')
          .update(payload)
          .eq('id', dadosForm.id)
          .select()
          .single();
      } else {
        // Insert
        payload.created_at = new Date().toISOString();
        result = await client
          .from('agendamentos')
          .insert(payload)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Se veio guia SADT junto, salva também
      if (dadosForm.guia && Object.keys(dadosForm.guia).length > 0) {
        const guiaPayload = {
          ...dadosForm.guia,
          agendamento_id: result.data.id,
          paciente: dadosForm.paciente,
          plano: dadosForm.plano,
          data_atendimento: dadosForm.data,
          profissional: dadosForm.profissional,
          status: dadosForm.guia.status || 'Pendente',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        const { error: guiaErr } = await client.from('guias_sadt').insert(guiaPayload);
        if (guiaErr) console.error('[Guia] Erro ao salvar guia:', guiaErr);
        else {
          // Atualiza qtd_usada na autorização correspondente
          await atualizarQtdUsada(dadosForm.paciente, dadosForm.carteirinha, dadosForm.plano);
        }
      }

      toast('Agendamento salvo com sucesso!', 'success');
      return result.data;
    } catch (e) {
      console.error('[Agendamento] Erro ao salvar:', e);
      toast('Erro ao salvar agendamento: ' + e.message, 'error');
      return false;
    }
  }

  // ──────────────────────────────────────────────────────────
  // 4. SENHAS/AUTORIZAÇÕES — Controle de qtd_usada
  // ──────────────────────────────────────────────────────────

  async function atualizarQtdUsada(paciente, carteirinha, plano, delta = 1) {
    const client = sb();
    if (!client) return;

    try {
      // Busca autorização ativa
      let query = client
        .from('senhas_autorizacoes')
        .select('id, qtd_usada, qtd_autorizada, status')
        .eq('status', 'Ativa')
        .gte('validade_senha', today());

      if (paciente) query = query.ilike('paciente', `%${paciente}%`);
      if (carteirinha) query = query.eq('carteirinha', carteirinha);
      if (plano) query = query.ilike('plano', `%${plano}%`);

      const { data: auths, error } = await query.order('data_autorizacao', { ascending: false }).limit(1);
      if (error || !auths || auths.length === 0) return;

      const auth = auths[0];
      const novaQtd = Math.max(0, (parseInt(auth.qtd_usada) || 0) + delta);
      const novoStatus = novaQtd >= (parseInt(auth.qtd_autorizada) || 0) ? 'Usada' : 'Ativa';

      const { error: updErr } = await client
        .from('senhas_autorizacoes')
        .update({
          qtd_usada: novaQtd,
          status: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auth.id);

      if (updErr) console.error('[Auth] Erro ao atualizar qtd_usada:', updErr);
      else console.log(`[Auth] qtd_usada atualizada para ${novaQtd} (status: ${novoStatus})`);
    } catch (e) {
      console.error('[Auth] Erro ao atualizar autorização:', e);
    }
  }

  // Expõe para uso externo (importação, etc.)
  window.CF_atualizarQtdUsada = atualizarQtdUsada;

  // ──────────────────────────────────────────────────────────
  // 5. GUIAS SADT — Carregar lista do Supabase
  // ──────────────────────────────────────────────────────────

  async function carregarGuiasSADT(filtros = {}) {
    const client = sb();
    if (!client) return;

    try {
      let query = client
        .from('guias_sadt')
        .select(`
          id, num_guia_prestador, data_atendimento, paciente,
          carteirinha, plano, num_guia_operadora, profissional,
          tipo_atendimento, cid10, status, valor_total,
          procedimentos, created_at
        `)
        .order('data_atendimento', { ascending: false });

      if (filtros.status && filtros.status !== 'Todos') {
        query = query.eq('status', filtros.status);
      }
      if (filtros.plano && filtros.plano !== 'Todos') {
        query = query.ilike('plano', `%${filtros.plano}%`);
      }
      if (filtros.dataInicio) query = query.gte('data_atendimento', filtros.dataInicio);
      if (filtros.dataFim) query = query.lte('data_atendimento', filtros.dataFim);

      const { data: guias, error } = await query;
      if (error) throw error;

      renderTabelaGuiasSADT(guias || []);
    } catch (e) {
      console.error('[GuiasSADT] Erro ao carregar:', e);
      toast('Erro ao carregar guias: ' + e.message, 'error');
    }
  }

  function renderTabelaGuiasSADT(guias) {
    // Procura a tabela de guias SADT na tela
    const tabelaContainer = document.getElementById('guias-sadt-table-container') ||
      document.querySelector('[data-table="guias-sadt"]') ||
      encontrarContainerGuiasSADT();

    if (!tabelaContainer) {
      console.warn('[GuiasSADT] Container da tabela não encontrado.');
      return;
    }

    // Badge contador
    const badge = document.querySelector('[data-badge="guias-sadt"], #badge-guias-sadt');
    if (badge) badge.textContent = guias.length;

    if (guias.length === 0) {
      tabelaContainer.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:24px;color:#6b7280;font-size:13px;">
          Nenhuma guia encontrada.
        </td></tr>`;
      return;
    }

    const statusCores = {
      Pendente: '#fef3c7;color:#92400e',
      Enviado: '#dbeafe;color:#1d4ed8',
      Pago: '#d1fae5;color:#065f46',
      Glosado: '#fee2e2;color:#991b1b',
    };

    tabelaContainer.innerHTML = guias.map(g => {
      const corStatus = statusCores[g.status] || '#f3f4f6;color:#374151';
      return `
        <tr data-id="${g.id}" style="border-bottom:1px solid #f3f4f6;cursor:pointer;"
            onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
          <td style="padding:10px 12px;font-size:13px;">${g.num_guia_prestador || '—'}</td>
          <td style="padding:10px 12px;font-size:13px;">${fmtDate(g.data_atendimento)}</td>
          <td style="padding:10px 12px;font-size:13px;">${g.paciente || '—'}</td>
          <td style="padding:10px 12px;font-size:13px;">${g.plano || '—'}</td>
          <td style="padding:10px 12px;font-size:13px;">${g.profissional || '—'}</td>
          <td style="padding:10px 12px;font-size:13px;text-align:right;">${fmtMoney(g.valor_total)}</td>
          <td style="padding:10px 12px;">
            <span style="background:${corStatus};border-radius:999px;font-size:11px;padding:3px 10px;font-weight:600;">
              ${g.status || '—'}
            </span>
          </td>
          <td style="padding:10px 12px;text-align:center;">
            <button onclick="CF_editarGuia('${g.id}')"
              style="font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;
                     background:#fff;cursor:pointer;margin-right:4px;">Editar</button>
            <button onclick="CF_imprimirGuia('${g.id}')"
              style="font-size:12px;padding:4px 10px;border-radius:6px;border:1px solid #d1d5db;
                     background:#fff;cursor:pointer;">Imprimir</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function encontrarContainerGuiasSADT() {
    // Estratégia: acha tbody dentro da seção de guias SADT
    const secoes = document.querySelectorAll('section, [data-page], [data-section]');
    for (const sec of secoes) {
      const titulo = sec.querySelector('h1,h2,h3,h4');
      if (titulo && titulo.textContent.toLowerCase().includes('guias sadt')) {
        return sec.querySelector('tbody') || sec.querySelector('table');
      }
    }
    // Fallback: procura tabela com cabeçalho que contém "Nº guia"
    const ths = document.querySelectorAll('th');
    for (const th of ths) {
      if (th.textContent.toLowerCase().includes('nº guia') ||
          th.textContent.toLowerCase().includes('guia')) {
        return th.closest('table')?.querySelector('tbody') ||
               th.closest('table');
      }
    }
    return null;
  }

  // Expõe funções globais para os botões inline
  window.CF_editarGuia = function (id) {
    console.log('[GuiasSADT] Editar guia:', id);
    // Implemente abertura do modal de edição aqui
    toast('Funcionalidade de edição em desenvolvimento.', 'info');
  };

  window.CF_imprimirGuia = function (id) {
    console.log('[GuiasSADT] Imprimir guia:', id);
    toast('Abrindo impressão...', 'info');
    // Chame a função de impressão existente no app
    if (typeof window.imprimirGuia === 'function') window.imprimirGuia(id);
  };

  // ──────────────────────────────────────────────────────────
  // 6. IMPORTAÇÃO — Atualiza qtd_usada ao importar evoluções/agendamentos
  // ──────────────────────────────────────────────────────────

  // Hook para quando o app importa agendamentos/evoluções
  // Chame window.CF_onImportarAgendamento(registro) em cada linha importada

  window.CF_onImportarAgendamento = async function (registro) {
    if (!registro || !registro.paciente) return;
    await atualizarQtdUsada(
      registro.paciente,
      registro.carteirinha || '',
      registro.plano || '',
      1 // delta +1 por sessão importada
    );
  };

  // ──────────────────────────────────────────────────────────
  // 7. INTERCEPTAÇÃO DE EVENTOS — Liga correções aos eventos do app
  // ──────────────────────────────────────────────────────────

  function bindEventos() {
    // ── 7a. Botão "Preencher guia →" no modal de agendamento
    document.addEventListener('click', async function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;

      const txt = btn.textContent.trim().toLowerCase();

      // Botão preencher guia
      if (txt.includes('preencher guia') || txt.includes('preencher guia →')) {
        e.preventDefault();
        await preencherGuiaAutomatico();
        return;
      }

      // Botão salvar agendamento
      if (
        txt === 'salvar agendamento' ||
        (txt.includes('salvar') && btn.closest('#modal-agendamento, [data-modal="agendamento"]'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        const dados = coletarDadosAgendamento();
        if (dados) {
          const resultado = await salvarAgendamento(dados);
          if (resultado) {
            // Fecha modal se existir
            const modal = btn.closest('[role="dialog"], .modal, #modal-agendamento');
            if (modal) {
              modal.style.display = 'none';
              modal.classList.remove('open', 'active', 'show');
            }
            // Recarrega dashboard se estiver na aba correta
            setTimeout(() => {
              carregarDashboardExtras();
            }, 500);
          }
        }
        return;
      }
    });

    // ── 7b. Navegação para aba Guias SADT — carrega dados
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const el = node;
          // Detecta quando a seção de guias SADT fica visível
          if (
            (el.id && el.id.toLowerCase().includes('guias')) ||
            (el.dataset && el.dataset.page === 'guias-sadt') ||
            (el.textContent && el.textContent.includes('Guias SADT') && el.querySelector('table'))
          ) {
            setTimeout(() => carregarGuiasSADT(), 200);
          }
          // Detecta quando o dashboard fica visível
          if (
            (el.id && el.id.toLowerCase().includes('dashboard')) ||
            (el.dataset && el.dataset.page === 'dashboard')
          ) {
            setTimeout(() => carregarDashboardExtras(), 200);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // ── 7c. Cliques no menu lateral (navegação SPA)
    document.addEventListener('click', function (e) {
      const link = e.target.closest('a, [data-nav], [data-page-link], nav li, .sidebar-item');
      if (!link) return;

      const texto = link.textContent.trim().toLowerCase();
      const target = link.dataset.nav || link.dataset.page || link.href || '';

      if (texto.includes('dashboard') || target.includes('dashboard')) {
        setTimeout(() => carregarDashboardExtras(), 400);
      }
      if (texto.includes('guias sadt') || target.includes('guias-sadt')) {
        setTimeout(() => carregarGuiasSADT(), 400);
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // 8. COLETA DE DADOS DO FORMULÁRIO DE AGENDAMENTO
  // ──────────────────────────────────────────────────────────

  function coletarDadosAgendamento() {
    // Seletores genéricos — ajuste conforme os ids reais do seu HTML
    const get = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.value || el.value || '';
      return el.value || '';
    };

    const getSelectText = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return '';
      if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '';
      return el.value || '';
    };

    // Coleta dados básicos
    const dados = {
      profissional: getSelectText('#ag-profissional, [name="profissional"]'),
      data: get('#ag-data, [name="data"][type="date"], input[type="date"]'),
      horario_inicio: get('#ag-horario-inicio, [name="horario_inicio"]'),
      horario_fim: get('#ag-horario-fim, [name="horario_fim"]'),
      duracao: get('#ag-duracao, [name="duracao"]') || '60',
      modalidade: get('#ag-modalidade, [name="modalidade"]') || 'Presencial',
      link_meet: get('#ag-link-meet, [name="link_meet"]'),
      paciente: getSelectText('#ag-paciente, [name="paciente"]'),
      plano: getSelectText('#ag-plano, [name="plano"]'),
      carteirinha: get('#ag-carteirinha, [name="carteirinha"]'),
      tipo_atendimento: get('#ag-tipo-atendimento, [name="tipo_atendimento"]') ||
        getSelectText('#ag-tipo-atendimento, [name="tipo_atendimento"]'),
      status: get('#ag-status, [name="status"]') || 'Agendado',
      observacoes: get('#ag-observacoes, [name="observacoes"], textarea[name="observacoes"]'),
    };

    // ID para update
    const idEl = document.querySelector('#ag-id, [name="agendamento_id"], [data-ag-id]');
    if (idEl) dados.id = idEl.value || idEl.dataset.agId;

    // Coleta dados da guia SADT se o formulário estiver visível
    const guiaSection = document.querySelector(
      '#guia-sadt-form, [data-section="guia-sadt"], .guia-sadt-form'
    );
    if (guiaSection && guiaSection.offsetParent !== null) {
      dados.guia = coletarDadosGuia();
    }

    return dados;
  }

  function coletarDadosGuia() {
    const get = (sel) => {
      try { return document.querySelector(sel)?.value || ''; } catch (_) { return ''; }
    };

    return {
      num_guia_prestador: get('[data-guia="2"], #guia-num-prestador'),
      num_guia_principal: get('[data-guia="3"], #guia-num-principal'),
      data_autorizacao: get('[data-guia="4"], #guia-dt-autorizacao'),
      senha: get('[data-guia="5"], #guia-senha'),
      validade_senha: get('[data-guia="6"], #guia-validade-senha'),
      num_guia_operadora: get('[data-guia="7"], #guia-num-operadora'),
      reg_ans: get('[data-guia="1"], #guia-reg-ans'),
      carater_atendimento: get('[data-guia="21"]'),
      data_solicitacao: get('[data-guia="22"]'),
      indicacao_clinica: get('[data-guia="23"]'),
      tipo_atendimento_guia: get('[data-guia="32"]'),
      indicacao_acidente: get('[data-guia="33"]'),
      tipo_consulta: get('[data-guia="34"]'),
      motivo_encerramento: get('[data-guia="35"]'),
      observacao: get('[data-guia="58"], #guia-observacao'),
      // Valor total calculado
      valor_total: calcularTotalGuia(),
    };
  }

  function calcularTotalGuia() {
    // Soma os valores unitários × quantidades dos procedimentos realizados
    let total = 0;
    document.querySelectorAll('.proc-real-row, [data-proc-row]').forEach(row => {
      const qty = parseFloat(row.querySelector('[class*="qtd"], [name*="qtd"]')?.value) || 0;
      const vl = parseFloat(row.querySelector('[class*="vl-unit"], [name*="valor"]')?.value) || 0;
      total += qty * vl;
    });
    return total;
  }

  // ──────────────────────────────────────────────────────────
  // 9. FILTROS DAS GUIAS SADT — sincroniza selects com queries
  // ──────────────────────────────────────────────────────────

  function bindFiltrosGuias() {
    const selStatus = document.querySelector(
      'select[data-filter="status-guia"], #filtro-status-guia'
    );
    const selPlano = document.querySelector(
      'select[data-filter="plano-guia"], #filtro-plano-guia'
    );

    if (selStatus) {
      selStatus.addEventListener('change', () => {
        carregarGuiasSADT({ status: selStatus.value, plano: selPlano?.value || '' });
      });
    }
    if (selPlano) {
      selPlano.addEventListener('change', () => {
        carregarGuiasSADT({ status: selStatus?.value || '', plano: selPlano.value });
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // 10. VERIFICAÇÃO NA INCLUSÃO DE NOVA AUTORIZAÇÃO/SENHA
  // ──────────────────────────────────────────────────────────

  async function salvarAutorizacao(dados) {
    const client = sb();
    if (!client) { toast('Supabase não conectado.', 'error'); return false; }

    try {
      // Verifica duplicata (mesmo paciente + carteirinha + plano + senha)
      const { data: existente } = await client
        .from('senhas_autorizacoes')
        .select('id')
        .ilike('paciente', `%${dados.paciente}%`)
        .eq('numero_senha', dados.numero_senha)
        .limit(1);

      if (existente && existente.length > 0) {
        const confirmar = confirm(
          `Já existe uma autorização com nº de senha "${dados.numero_senha}" para este paciente. Deseja salvar assim mesmo?`
        );
        if (!confirmar) return false;
      }

      const payload = {
        ...dados,
        qtd_usada: dados.qtd_usada || 0,
        status: dados.status || 'Ativa',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('senhas_autorizacoes')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      toast('Autorização salva com sucesso!', 'success');
      return data;
    } catch (e) {
      console.error('[Auth] Erro ao salvar:', e);
      toast('Erro ao salvar autorização: ' + e.message, 'error');
      return false;
    }
  }

  window.CF_salvarAutorizacao = salvarAutorizacao;

  // ──────────────────────────────────────────────────────────
  // 11. INICIALIZAÇÃO
  // ──────────────────────────────────────────────────────────

  function init() {
    bindEventos();
    bindFiltrosGuias();

    // Aguarda um tick para o app principal inicializar
    setTimeout(() => {
      // Detecta página ativa e carrega dados correspondentes
      const url = window.location.hash || '';
      const paginaAtiva = document.querySelector(
        '[data-page].active, [data-section].active, .page.active, .section.active'
      );
      const nomePagina = (paginaAtiva?.dataset?.page || url).toLowerCase();

      if (nomePagina.includes('dashboard') || nomePagina === '' || nomePagina === '#') {
        carregarDashboardExtras();
      }
      if (nomePagina.includes('guias')) {
        carregarGuiasSADT();
      }
    }, 800);

    console.log('[ClinicFlow Fixes] Módulo de correções carregado ✓');
  }

  // Aguarda DOM pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ──────────────────────────────────────────────────────────
  // EXPÕE API PÚBLICA
  // ──────────────────────────────────────────────────────────
  window.ClinicFlowFixes = {
    carregarDashboard: carregarDashboardExtras,
    carregarGuiasSADT,
    salvarAgendamento,
    preencherGuiaAutomatico,
    atualizarQtdUsada,
    salvarAutorizacao,
  };

})();