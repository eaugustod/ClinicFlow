/**
 * ClinicFlow — Supabase Integration Patch
 * =========================================
 * Adicione ao seu index.html:
 *
 * No <head>:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * Antes de </body>:
 *   <script src="supabase_patch.js"></script>
 */

(function () {
  'use strict';

  // ── Client ────────────────────────────────────────────────────────────────
  let _sb = null;

  function getDb() {
    if (_sb) return _sb;
    const url = localStorage.getItem('cf_supa_url');
    const key = localStorage.getItem('cf_supa_key');
    if (url && key && window.supabase) {
      _sb = window.supabase.createClient(url, key);
    }
    return _sb;
  }

  // ── Mapeamento JS ↔ Supabase ──────────────────────────────────────────────

  const map = {
    pacToDb: p => ({ nome:p.nome, nasc:p.nasc||null, cpf:p.cpf||null, tel:p.tel||null, email:p.email||null, end:p.end||null, plano_id:p.planoId||5, plano:p.plano||'Particular', carteirinha:p.carteirinha||null, sexo:p.sexo||null, status:p.status||'Ativo', obs:p.obs||null, ultima:p.ultima||null, est_civil:p.estCivil||null, profissao:p.profissao||null, titular:p.titular||null }),
    dbToPac: r => ({ id:r.id, nome:r.nome, nasc:r.nasc||'', cpf:r.cpf||'', tel:r.tel||'', email:r.email||'', end:r.end||'', planoId:r.plano_id||5, plano:r.plano||'Particular', carteirinha:r.carteirinha||'—', sexo:r.sexo||'', status:r.status||'Ativo', obs:r.obs||'', ultima:r.ultima||'', estCivil:r.est_civil||'', profissao:r.profissao||'', titular:r.titular||'' }),

    profToDb: p => ({ nome:p.nome, nome_agenda:p.nomeAgenda||null, esp:p.esp||null, conselho:p.conselho||null, num:p.num||null, uf:p.uf||'SP', cbo:p.cbo||null, tel:p.tel||null, email:p.email||null, cor:p.cor||'#4f8ef7', status:p.status||'Ativo', instagram:p.instagram||null, linkedin:p.linkedin||null, google_cal_id:p.googleCalendarId||null }),
    dbToProf: r => ({ id:r.id, nome:r.nome, nomeAgenda:r.nome_agenda||r.nome?.split(' ')[0]||'', esp:r.esp||'', conselho:r.conselho||'', num:r.num||'', uf:r.uf||'SP', cbo:r.cbo||'', tel:r.tel||'', email:r.email||'', cor:r.cor||'#4f8ef7', status:r.status||'Ativo', instagram:r.instagram||'', linkedin:r.linkedin||'', googleCalendarId:r.google_cal_id||'' }),

    planoToDb: p => ({ nome:p.nome, nome_guia:p.nomeGuia||null, cnpj:p.cnpj||null, ans:p.ans||null, tabela:p.tabela||'CBHPM', cod_prestador:p.codPrestador||null, nome_contratado:p.nomeContratado||null, cnes:p.cnes||null, num_guia_inicial:p.numGuiaInicial||1, usa_tiss:p.usaTiss!==false, aplica_todos:p.aplicaTodos!==false, tipo_id:p.tipoId||'Código', versao_tiss:p.versaoTiss||'4.02.00', tel:p.tel||null, email:p.email||null, obs:p.obs||null, status:p.status||'Ativo', pacientes:p.pacientes||0, juntar_guia:p.juntarGuia!==false, nome_plano_guia:p.nomePlanoGuia||null }),
    dbToPlano: r => ({ id:r.id, nome:r.nome, nomeGuia:r.nome_guia||'', cnpj:r.cnpj||'', ans:r.ans||'', tabela:r.tabela||'CBHPM', codPrestador:r.cod_prestador||'', nomeContratado:r.nome_contratado||'', cnes:r.cnes||'', numGuiaInicial:r.num_guia_inicial||1, usaTiss:r.usa_tiss!==false, aplicaTodos:r.aplica_todos!==false, tipoId:r.tipo_id||'Código', versaoTiss:r.versao_tiss||'4.02.00', tel:r.tel||'', email:r.email||'', obs:r.obs||'', status:r.status||'Ativo', pacientes:r.pacientes||0, juntarGuia:r.juntar_guia!==false, nomePlanoGuia:r.nome_plano_guia||'' }),

    procToDb: p => ({ codigo:p.codigo||null, desc:p.desc, desc_curta:p.descCurta||null, tipo:p.tipo||'Sessão', val_part:p.valPart||0, val_plano:p.valPlano||0, tabela:p.tabela||'TUSS', plano_id:p.planoId||0, status:p.status||'Ativo', obs:p.obs||null }),
    dbToProc: r => ({ id:r.id, codigo:r.codigo||'', desc:r.desc||'', descCurta:r.desc_curta||'', tipo:r.tipo||'Sessão', valPart:r.val_part||0, valPlano:r.val_plano||0, tabela:r.tabela||'TUSS', planoId:r.plano_id||0, status:r.status||'Ativo', obs:r.obs||'' }),

    apptToDb: a => ({ prof_id:a.profId, paciente:a.paciente, plano:a.plano||'Particular', plano_id:a.planoId||5, hora:a.hora, hora_fim:a.horaFim||null, dur_min:a.durMin||30, data_iso:a.dataISO||null, status:a.status||'agendado', obs:a.obs||null, modalidade:a.modalidade||'presencial', meet_link:a.meetLink||null, wa_sent:a.waSent||false, carteirinha:a.carteirinha||null, guia:a.guia||null }),
    dbToAppt: r => ({ id:r.id, profId:r.prof_id, paciente:r.paciente, plano:r.plano||'Particular', planoId:r.plano_id, hora:r.hora, horaFim:r.hora_fim||'', durMin:r.dur_min||30, dataISO:r.data_iso||'', status:r.status||'agendado', obs:r.obs||'', modalidade:r.modalidade||'presencial', meetLink:r.meet_link||'', waSent:r.wa_sent||false, carteirinha:r.carteirinha||'', guia:r.guia||null }),

    guiaToDb: g => ({ num:g.num, pac:g.pac, plano_id:g.planoId, plano:g.plano, prof_id:g.profId, valor:g.valor||0, status:g.status||'Pendente', data:g.data||null, lote_id:g.loteId||null, lote_num:g.loteNum||null, dados:g.dados||null, carteirinha:g.carteirinha||null, num_op:g.numOp||null, cid:g.cid||null }),
    dbToGuia: r => ({ id:r.id, num:r.num, pac:r.pac, planoId:r.plano_id, plano:r.plano, profId:r.prof_id, valor:r.valor||0, status:r.status||'Pendente', data:r.data||'', loteId:r.lote_id||null, loteNum:r.lote_num||null, dados:r.dados||{}, carteirinha:r.carteirinha||'', numOp:r.num_op||'', cid:r.cid||'' }),

    loteToDb: l => ({ num:l.num, competencia:l.competencia, plano_id:l.planoId, plano:l.plano, qtd:l.qtd||0, valor:l.valor||0, status:l.status||'Pendente', data_criacao:l.dataCriacao||null, data_envio:l.dataEnvio||null, obs:l.obs||null, guia_ids:l.guiaIds||[] }),
    dbToLote: r => ({ id:r.id, num:r.num, competencia:r.competencia, planoId:r.plano_id, plano:r.plano, qtd:r.qtd||0, valor:r.valor||0, status:r.status||'Pendente', dataCriacao:r.data_criacao||'', dataEnvio:r.data_envio||'', obs:r.obs||'', guiaIds:r.guia_ids||[], xml:'' }),

    senhaToDb: s => ({ plano_id:s.planoId, paciente:s.paciente, carteirinha:s.carteirinha||null, num_guia_op:s.numGuiaOp||null, num_senha:s.numSenha, data_aut:s.dataAut||null, validade:s.validade||null, qtd_autorizada:s.qtdAutorizada||10, qtd_usada:s.qtdUsada||0, cid:s.cid||null, obs:s.obs||null, status:s.status||'Ativa', procs:s.procs||null, ativa:s.ativa!==false }),
    dbToSenha: r => ({ id:r.id, planoId:r.plano_id, paciente:r.paciente, carteirinha:r.carteirinha||'', numGuiaOp:r.num_guia_op||'', numSenha:r.num_senha, dataAut:r.data_aut||'', validade:r.validade||'', qtdAutorizada:r.qtd_autorizada||10, qtdUsada:r.qtd_usada||0, cid:r.cid||'', obs:r.obs||'', status:r.status||'Ativa', procs:r.procs||[], ativa:r.ativa!==false }),

    esperaToDb: e => ({ nome:e.nome, tel:e.tel, email:e.email||null, nasc:e.nasc||null, end:e.end||null, plano:e.plano||null, carteirinha:e.carteirinha||null, obs:e.obs||null, dias:e.dias||[], periodos:e.periodos||[], procedimentos:e.procedimentos||[], status:e.status||'Aguardando', data_entrada:e.dataEntrada||null }),
    dbToEspera: r => ({ id:r.id, nome:r.nome, tel:r.tel||'', email:r.email||'', nasc:r.nasc||'', end:r.end||'', plano:r.plano||'', carteirinha:r.carteirinha||'', obs:r.obs||'', dias:r.dias||[], periodos:r.periodos||[], procedimentos:r.procedimentos||[], status:r.status||'Aguardando', dataEntrada:r.data_entrada||'' }),

    histToDb: h => ({ pac_id:h.pacId, tipo:h.tipo, titulo:h.titulo||null, conteudo:h.conteudo||null, prof_id:h.profId||null, data:h.data||null, status:h.status||null, fonte:h.fonte||null }),
    dbToHist: r => ({ id:r.id, pacId:r.pac_id, tipo:r.tipo, titulo:r.titulo||'', conteudo:r.conteudo||{}, profId:r.prof_id||null, data:r.data||'', status:r.status||'', fonte:r.fonte||'' }),
  };

  // ── Carregar todos os dados do Supabase ───────────────────────────────────

  async function loadFromSupabase() {
    const sb = getDb();
    if (!sb) return;
    showToast('Carregando dados do banco de dados...', 'success');
    try {
      const [pac, prof, pl, proc, ag, gu, lo, se, esp, hist, cfg] = await Promise.all([
        sb.from('pacientes').select('*').order('nome'),
        sb.from('profissionais').select('*').order('nome'),
        sb.from('planos_saude').select('*').order('nome'),
        sb.from('procedimentos').select('*').order('desc'),
        sb.from('agendamentos').select('*').order('data_iso,hora'),
        sb.from('guias_sadt').select('*').order('created_at', { ascending: false }),
        sb.from('lotes_tiss').select('*').order('created_at', { ascending: false }),
        sb.from('senhas_plano').select('*').order('created_at', { ascending: false }),
        sb.from('lista_espera').select('*').order('created_at', { ascending: false }),
        sb.from('historico').select('*').order('data', { ascending: false }),
        sb.from('config_clinica').select('*').limit(1),
      ]);

      const rep = (arr, data, fn) => { arr.length = 0; (data || []).forEach(r => arr.push(fn(r))); };
      rep(PACIENTES,    pac.data,  map.dbToPac);
      rep(PROFISSIONAIS,prof.data, map.dbToProf);
      rep(PLANOS,       pl.data,   map.dbToPlano);
      rep(PROCEDIMENTOS,proc.data, map.dbToProc);
      rep(APPOINTMENTS, ag.data,   map.dbToAppt);
      rep(GUIAS,        gu.data,   map.dbToGuia);
      rep(LOTES,        lo.data,   map.dbToLote);
      rep(SENHAS_PLANO, se.data,   map.dbToSenha);
      rep(LISTA_ESPERA, esp.data,  map.dbToEspera);
      rep(HISTORICO,    hist.data, map.dbToHist);

      if (cfg.data && cfg.data.length > 0) Object.assign(CLINICA, cfg.data[0].dados || {});

      // Atualiza IDs para evitar colisão
      const maxId = (arr) => arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1;
      nextPacId    = maxId(PACIENTES);
      nextPrfId    = maxId(PROFISSIONAIS);
      nextPlId     = maxId(PLANOS);
      nextProcId   = maxId(PROCEDIMENTOS);
      nextGuiaId   = maxId(GUIAS);
      nextLoteId   = maxId(LOTES);
      nextSenhaId  = maxId(SENHAS_PLANO);
      nextEsperaId = maxId(LISTA_ESPERA);
      nextHistId   = maxId(HISTORICO);
      activeProfFilters = new Set(PROFISSIONAIS.map(p => p.id));

      showToast('✓ Dados carregados com sucesso!', 'success');
    } catch (e) {
      showToast('Erro ao carregar dados: ' + e.message, 'error');
      console.error('[ClinicFlow Supabase]', e);
    }
  }

  // Helper para salvar config da clínica
  async function salvarConfigNoDB() {
    const sb = getDb();
    if (!sb) return;
    const { data } = await sb.from('config_clinica').select('id').limit(1);
    if (data && data.length > 0) await sb.from('config_clinica').update({ dados: CLINICA }).eq('id', data[0].id);
    else await sb.from('config_clinica').insert([{ dados: CLINICA }]);
  }

  // ── Override initApp ──────────────────────────────────────────────────────
  const _origInitApp = window.initApp;
  window.initApp = async function () {
    if (getDb()) await loadFromSupabase();
    _origInitApp && _origInitApp();
  };

  // ── Override salvarPaciente ───────────────────────────────────────────────
  window.salvarPaciente = async function () {
    const nome = document.getElementById('pac-nome').value.trim();
    if (!nome) { showToast('Informe o nome do paciente', 'error'); return; }
    const planoId = parseInt(document.getElementById('pac-plano').value) || 5;
    const planoObj = PLANOS.find(pl => pl.id === planoId);
    const dados = {
      nome, nasc: document.getElementById('pac-nasc').value, cpf: document.getElementById('pac-cpf').value,
      tel: document.getElementById('pac-tel').value, email: document.getElementById('pac-email').value,
      end: document.getElementById('pac-end').value, planoId, plano: planoObj ? planoObj.nome : 'Particular',
      carteirinha: document.getElementById('pac-carteirinha').value || '—',
      valCart: document.getElementById('pac-val-cart').value, titular: document.getElementById('pac-titular').value,
      sexo: document.getElementById('pac-sexo').value, estCivil: document.getElementById('pac-estcivil').value,
      profissao: document.getElementById('pac-profissao').value, obs: document.getElementById('pac-obs').value,
      status: document.getElementById('pac-status').value, ultima: new Date().toLocaleDateString('pt-BR'),
    };
    const sb = getDb();
    if (editingPacId !== null) {
      if (sb) await sb.from('pacientes').update(map.pacToDb(dados)).eq('id', editingPacId);
      Object.assign(PACIENTES.find(p => p.id === editingPacId), dados);
      showToast('Paciente atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('pacientes').insert([map.pacToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPacId++; }
      PACIENTES.push(dados);
      showToast('Paciente cadastrado!', 'success');
    }
    closeModal('modal-paciente'); renderPacientesTable(); populateSelects();
  };

  // ── Override salvarProfissional ───────────────────────────────────────────
  window.salvarProfissional = async function () {
    const nome = document.getElementById('prf-nome').value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    const dados = {
      nome, nomeAgenda: document.getElementById('prf-nome-agenda').value.trim() || nome.split(' ')[0],
      esp: document.getElementById('prf-esp').value, conselho: document.getElementById('prf-conselho').value,
      num: document.getElementById('prf-num-conselho').value, uf: document.getElementById('prf-uf').value,
      cbo: document.getElementById('prf-cbo').value, tel: document.getElementById('prf-tel').value,
      email: document.getElementById('prf-email').value, instagram: document.getElementById('prf-instagram').value,
      linkedin: document.getElementById('prf-linkedin').value,
      googleCalendarId: document.getElementById('prf-google-cal-id').value.trim(),
      cor: selectedColor || '#4f8ef7', status: document.getElementById('prf-status').value,
    };
    const sb = getDb();
    if (editingPrfId !== null) {
      if (sb) await sb.from('profissionais').update(map.profToDb(dados)).eq('id', editingPrfId);
      Object.assign(PROFISSIONAIS.find(p => p.id === editingPrfId), dados);
      showToast('Profissional atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('profissionais').insert([map.profToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPrfId++; }
      PROFISSIONAIS.push(dados);
      activeProfFilters.add(dados.id);
      showToast('Profissional cadastrado!', 'success');
    }
    closeModal('modal-profissional'); renderProfissionaisTable(); renderProfToday(); buildProfFilters(); populateSelects(); renderDayView();
  };

  // ── Override salvarPlano ──────────────────────────────────────────────────
  window.salvarPlano = async function () {
    const nome = document.getElementById('pl-nome').value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    const _gf = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const dados = {
      nome, nomeGuia: _gf('pl-nome-guia'), cnpj: _gf('pl-cnpj'), ans: _gf('pl-ans'),
      tabela: _gf('pl-tabela') || 'CBHPM', tel: _gf('pl-tel'), email: _gf('pl-email'),
      codPrestador: _gf('pl-cod-prestador'), nomeContratado: _gf('pl-nome-contratado'),
      cnes: _gf('pl-cnes'), numGuiaInicial: parseInt(_gf('pl-num-guia-inicial')) || 1,
      nomePlanoGuia: _gf('pl-nome-plano-guia'), obs: _gf('pl-obs'), status: _gf('pl-status') || 'Ativo',
      versaoTiss: _gf('pl-versao-tiss') || '4.02.00', tipoId: _gf('pl-tipo-id') || 'Código',
      usaTiss: _gf('pl-usa-tiss') === 'true', aplicaTodos: _gf('pl-aplica-todos') === 'true',
      juntarGuia: _gf('pl-juntar-guia') === 'true', pacientes: 0,
    };
    const sb = getDb();
    if (editingPlId !== null) {
      const pl = PLANOS.find(p => p.id === editingPlId);
      if (pl) { dados.pacientes = pl.pacientes; Object.assign(pl, dados); }
      if (sb) await sb.from('planos_saude').update(map.planoToDb(dados)).eq('id', editingPlId);
      showToast('Plano atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('planos_saude').insert([map.planoToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextPlId++; }
      PLANOS.push(dados);
      showToast('Plano cadastrado!', 'success');
    }
    closeModal('modal-plano'); renderPlanosGrid(); populateSelects(); renderProcedimentosTable();
  };

  // ── Override salvarProcedimento ───────────────────────────────────────────
  window.salvarProcedimento = async function () {
    const codigo = (document.getElementById('proc-codigo').value || '').trim();
    const desc = (document.getElementById('proc-desc').value || '').trim();
    if (!desc) { showToast('Informe a descrição', 'error'); return; }
    const planoId = parseInt(document.getElementById('proc-plano-id')?.value || '0') || 0;
    const dados = {
      codigo, desc, descCurta: document.getElementById('proc-desc-curta').value,
      tipo: document.getElementById('proc-tipo').value,
      valPart: parseBRL(document.getElementById('proc-val-part').value),
      valPlano: parseBRL(document.getElementById('proc-val-plano').value),
      tabela: document.getElementById('proc-tabela-ref').value, planoId,
      status: document.getElementById('proc-status').value, obs: document.getElementById('proc-obs').value,
    };
    const sb = getDb();
    if (editingProcId !== null) {
      if (sb) await sb.from('procedimentos').update(map.procToDb(dados)).eq('id', editingProcId);
      Object.assign(PROCEDIMENTOS.find(p => p.id === editingProcId), dados);
      showToast('Procedimento atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('procedimentos').insert([map.procToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextProcId++; }
      PROCEDIMENTOS.push(dados);
      if (codigo) TUSS_TABLE[codigo] = { desc, valor: dados.valPlano };
      showToast('Procedimento cadastrado!', 'success');
    }
    closeModal('modal-procedimento'); renderProcedimentosTable(); renderPlanosGrid();
  };

  // ── Override salvarAgendamento ────────────────────────────────────────────
  window.salvarAgendamento = async function () {
    const pac = (document.getElementById('ag-paciente').value || '').trim();
    if (!pac) { showToast('Informe o nome do paciente', 'error'); return; }
    const horaIni = document.getElementById('ag-hora-ini').value;
    const horaFim = document.getElementById('ag-hora-fim').value;
    const profId = parseInt(document.getElementById('ag-profissional').value);
    const planoId = parseInt(document.getElementById('ag-plano').value);
    const planoObj = PLANOS.find(p => p.id === planoId);
    const novoStatus = document.getElementById('ag-status').value;
    const dados = {
      profId, paciente: pac, plano: planoObj?.nome || 'Particular', planoId: planoId || 5,
      hora: horaIni, horaFim, durMin: calcDurMin(horaIni, horaFim),
      dataISO: document.getElementById('ag-data')?.value || '',
      status: novoStatus, obs: document.getElementById('ag-obs')?.value || '',
      modalidade: document.querySelector('input[name="ag-modalidade"]:checked')?.value || 'presencial',
      meetLink: document.getElementById('ag-meet-link')?.value || '',
      carteirinha: document.getElementById('ag-carteirinha')?.value || '',
      waSent: false, guia: null,
    };
    const sb = getDb();
    if (currentApptId) {
      const temSadt = document.getElementById('sadt-beneficiario')?.value;
      if (temSadt) {
        const tot = parseFloat((document.getElementById('sadt-total')?.textContent || '0').replace(/[R$\s]/g, '').replace(',', '.')) || 0;
        dados.guia = { autorizacao: document.getElementById('sadt-autorizacao')?.value || 'Pendente', total: tot };
      }
      if (sb) await sb.from('agendamentos').update(map.apptToDb(dados)).eq('id', currentApptId);
      const appt = APPOINTMENTS.find(a => a.id === currentApptId);
      if (appt) Object.assign(appt, dados);
      const msgs = { agendado:'Agendamento atualizado!', confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
      showToast(msgs[novoStatus] || 'Agendamento salvo!', ['desmarcado','cancelado'].includes(novoStatus) ? 'error' : 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('agendamentos').insert([map.apptToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = Math.max(...APPOINTMENTS.map(a => a.id), 0) + 1; }
      APPOINTMENTS.push(dados);
      showToast('Agendamento criado!', 'success');
    }
    closeModal('modal-agendamento'); renderDayView();
  };

  // ── Override updateStatus ─────────────────────────────────────────────────
  window.updateStatus = async function (id, status) {
    const appt = APPOINTMENTS.find(a => a.id === id);
    if (!appt) return;
    appt.status = status;
    const sb = getDb();
    if (sb) await sb.from('agendamentos').update({ status }).eq('id', id);
    if (status === 'atendido') try { registrarAtendimento(id); } catch (e) {}
    const msgs = { confirmado:'Consulta confirmada!', atendido:'Marcado como atendido!', desmarcado:'Consulta desmarcada.', cancelado:'Agendamento cancelado.' };
    showToast(msgs[status] || 'Status atualizado.', ['desmarcado','cancelado'].includes(status) ? 'error' : 'success');
    renderDayView();
  };

  // ── Override cancelarAgendamento ──────────────────────────────────────────
  window.cancelarAgendamento = async function () {
    if (!currentApptId) return;
    const appt = APPOINTMENTS.find(a => a.id === currentApptId);
    if (!appt) return;
    appt.status = 'cancelado';
    const sb = getDb();
    if (sb) await sb.from('agendamentos').update({ status: 'cancelado' }).eq('id', currentApptId);
    closeModal('modal-agendamento'); renderDayView();
    showToast('Agendamento cancelado.', 'error');
  };

  // ── Override salvarGuia ───────────────────────────────────────────────────
  window.salvarGuia = async function () {
    const pac = document.getElementById('g-pac')?.value.trim();
    const planoId = parseInt(document.getElementById('g-plano')?.value || '0');
    if (!pac) { showToast('Informe o beneficiário', 'error'); return; }
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    const plano = PLANOS.find(p => p.id === planoId);
    const profId = parseInt(document.getElementById('g-prof')?.value || '0');
    const procs = [];
    document.querySelectorAll('.sadt-proc-row').forEach(row => {
      const i = row.dataset.idx;
      const desc = document.getElementById('g-proc-desc-' + i)?.value || '';
      const val = parseBRL(document.getElementById('g-proc-val-' + i)?.value || '0');
      const qtd = parseInt(document.getElementById('g-proc-qtd-' + i)?.value || 1);
      if (desc) procs.push({ codigo: document.getElementById('g-proc-cod-' + i)?.value || '', desc, qtd, valor: val, total: val * qtd });
    });
    const total = procs.reduce((s, p) => s + p.total, 0);
    const dados = {
      pac, planoId, plano: plano?.nome || '—', profId, valor: total,
      carteirinha: document.getElementById('g-carteirinha')?.value || '',
      numOp: document.getElementById('g-num-op')?.value || '',
      cid: document.getElementById('g-cid')?.value || '',
      status: document.getElementById('g-status')?.value || 'Pendente',
      data: document.getElementById('g-data')?.value || '',
      dados: { procs }, loteId: null,
    };
    const sb = getDb();
    if (editingGuiaId !== null) {
      if (sb) await sb.from('guias_sadt').update(map.guiaToDb(dados)).eq('id', editingGuiaId);
      const g = GUIAS.find(x => x.id === editingGuiaId);
      if (g) { Object.assign(g, dados); g.num = document.getElementById('g-num').value; }
      showToast('Guia atualizada!', 'success');
    } else {
      dados.num = document.getElementById('g-num').value || ('G' + Date.now().toString().slice(-8));
      if (sb) {
        const { data, error } = await sb.from('guias_sadt').insert([map.guiaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextGuiaId++; }
      GUIAS.push(dados);
      showToast('Guia SADT criada!', 'success');
    }
    closeModal('modal-guia'); renderGuiasList();
  };

  // ── Override salvarLote ───────────────────────────────────────────────────
  window.salvarLote = async function () {
    const planoId = parseInt(document.getElementById('lote-plano')?.value || '0');
    const comp = document.getElementById('lote-competencia')?.value.trim();
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    const plano = PLANOS.find(p => p.id === planoId);
    const checkboxes = document.querySelectorAll('#lote-guias-disponiveis input[type=checkbox]:checked');
    const selectedIds = [...checkboxes].map(c => parseInt(c.dataset.guiaId));
    if (!selectedIds.length) { showToast('Selecione ao menos uma guia', 'error'); return; }
    if (selectedIds.length > 90) { showToast('Máximo de 90 guias por lote.', 'error'); return; }
    const total = [...checkboxes].reduce((s, c) => s + parseFloat(c.dataset.valor || 0), 0);
    const sb = getDb();
    if (editingLoteId !== null) {
      const l = LOTES.find(x => x.id === editingLoteId);
      if (l) { l.competencia = comp; l.planoId = planoId; l.plano = plano?.nome || '—'; l.qtd = selectedIds.length; l.valor = total; l.obs = document.getElementById('lote-obs')?.value || ''; }
      if (sb) await sb.from('lotes_tiss').update(map.loteToDb(l)).eq('id', editingLoteId);
      showToast('Lote atualizado!', 'success');
    } else {
      const ano = new Date().getFullYear();
      const num = String(ano) + String(nextLoteId).padStart(4, '0');
      const newLote = { id: nextLoteId++, num, competencia: comp, planoId, plano: plano?.nome || '—', qtd: selectedIds.length, valor: total, status: 'Pendente', dataCriacao: new Date().toISOString().slice(0, 10), dataEnvio: '', obs: document.getElementById('lote-obs')?.value || '', guiaIds: selectedIds, xml: '' };
      if (sb) {
        const { data, error } = await sb.from('lotes_tiss').insert([map.loteToDb(newLote)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        newLote.id = data.id;
      }
      LOTES.push(newLote);
      selectedIds.forEach(id => {
        const g = GUIAS.find(x => x.id === id);
        if (g) { g.loteId = newLote.id; g.loteNum = newLote.num; g.status = 'Enviado'; if (sb) sb.from('guias_sadt').update({ lote_id: newLote.id, lote_num: newLote.num, status: 'Enviado' }).eq('id', id); }
      });
      showToast('Lote ' + num + ' criado com ' + selectedIds.length + ' guias!', 'success');
    }
    closeModal('modal-lote'); renderLotesTable(); renderGuiasList();
  };

  // ── Override salvarSenha ──────────────────────────────────────────────────
  window.salvarSenha = async function () {
    const planoId = parseInt(document.getElementById('sen-plano')?.value || '0');
    const paciente = document.getElementById('sen-paciente')?.value.trim();
    const numSenha = document.getElementById('sen-num-senha')?.value.trim();
    if (!planoId) { showToast('Selecione o plano', 'error'); return; }
    if (!paciente) { showToast('Informe o paciente', 'error'); return; }
    if (!numSenha) { showToast('Informe a senha', 'error'); return; }
    const procs = [];
    document.querySelectorAll('.sen-proc-row').forEach(row => {
      const i = row.dataset.idx;
      const cod = document.getElementById('sen-proc-cod-' + i)?.value || '';
      const desc = document.getElementById('sen-proc-desc-' + i)?.value || '';
      if (cod || desc) procs.push({ codigo: cod, desc });
    });
    const dados = { planoId, paciente, carteirinha: document.getElementById('sen-carteirinha')?.value || '', numGuiaOp: document.getElementById('sen-num-guia-op')?.value || '', numSenha, dataAut: document.getElementById('sen-data-aut')?.value || '', validade: document.getElementById('sen-validade')?.value || '', qtdAutorizada: parseInt(document.getElementById('sen-qtd-aut')?.value || '10'), qtdUsada: 0, cid: document.getElementById('sen-cid')?.value || '', obs: document.getElementById('sen-obs')?.value || '', status: document.getElementById('sen-status')?.value || 'Ativa', procs, ativa: true };
    const sb = getDb();
    if (editingSenhaId !== null) {
      const s = SENHAS_PLANO.find(x => x.id === editingSenhaId);
      if (s) { dados.qtdUsada = s.qtdUsada; Object.assign(s, dados); }
      if (sb) await sb.from('senhas_plano').update(map.senhaToDb(dados)).eq('id', editingSenhaId);
      showToast('Autorização atualizada!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('senhas_plano').insert([map.senhaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextSenhaId++; }
      SENHAS_PLANO.push(dados);
      showToast('Autorização cadastrada!', 'success');
    }
    closeModal('modal-senha'); renderSenhas();
  };

  // ── Override salvarEspera ─────────────────────────────────────────────────
  window.salvarEspera = async function () {
    const nome = document.getElementById('esp-nome')?.value.trim();
    const tel = document.getElementById('esp-tel')?.value.trim();
    if (!nome) { showToast('Informe o nome', 'error'); return; }
    if (!tel) { showToast('Informe o telefone', 'error'); return; }
    const dados = { nome, tel, email: document.getElementById('esp-email')?.value || '', nasc: document.getElementById('esp-nasc')?.value || '', end: document.getElementById('esp-end')?.value || '', plano: document.getElementById('esp-plano')?.value || '', carteirinha: document.getElementById('esp-carteirinha')?.value || '', obs: document.getElementById('esp-obs')?.value || '', dias: [...document.querySelectorAll('.esp-dia:checked')].map(c => c.value), periodos: [...document.querySelectorAll('.esp-periodo:checked')].map(c => c.value), procedimentos: [...document.querySelectorAll('.esp-proc-chk:checked')].map(c => c.value), status: 'Aguardando', dataEntrada: new Date().toLocaleDateString('pt-BR') };
    const sb = getDb();
    if (editingEsperaId !== null) {
      Object.assign(LISTA_ESPERA.find(x => x.id === editingEsperaId), dados);
      if (sb) await sb.from('lista_espera').update(map.esperaToDb(dados)).eq('id', editingEsperaId);
      showToast('Atualizado!', 'success');
    } else {
      if (sb) {
        const { data, error } = await sb.from('lista_espera').insert([map.esperaToDb(dados)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        dados.id = data.id;
      } else { dados.id = nextEsperaId++; }
      LISTA_ESPERA.push(dados);
      showToast('Adicionado à lista de espera!', 'success');
    }
    closeModal('modal-espera'); renderEsperaTable();
  };

  // ── Override salvarEvolucao ───────────────────────────────────────────────
  window.salvarEvolucao = async function () {
    const titulo = document.getElementById('evo-titulo').value.trim();
    const texto = document.getElementById('evo-texto').value.trim();
    const profId = parseInt(document.getElementById('evo-prof').value || '0');
    const data = document.getElementById('evo-data').value;
    if (!texto) { showToast('Digite o texto da evolução', 'error'); return; }
    const editId = document.getElementById('evo-id-edit').value;
    const sb = getDb();
    if (editId) {
      const h = HISTORICO.find(x => x.id === parseInt(editId));
      if (h) { h.titulo = titulo || 'Evolução'; h.conteudo = { texto }; h.profId = profId; h.data = data; }
      if (sb) await sb.from('historico').update(map.histToDb(h)).eq('id', parseInt(editId));
      showToast('Evolução atualizada!', 'success');
    } else {
      const novoHist = { pacId: historicoAtualPacId, tipo: 'evolucao', titulo: titulo || 'Evolução', conteudo: { texto }, profId, data, fonte: 'Manual' };
      if (sb) {
        const { data: d, error } = await sb.from('historico').insert([map.histToDb(novoHist)]).select().single();
        if (error) { showToast('Erro: ' + error.message, 'error'); return; }
        novoHist.id = d.id;
      } else { novoHist.id = nextHistId++; }
      HISTORICO.push(novoHist);
      const p = PACIENTES.find(x => x.id === historicoAtualPacId);
      if (p) {
        const appt = APPOINTMENTS.find(a => a.paciente === p.nome && a.dataISO === data && a.status !== 'cancelado');
        if (appt && appt.status !== 'atendido') { appt.status = 'atendido'; if (sb) sb.from('agendamentos').update({ status: 'atendido' }).eq('id', appt.id); renderDayView(); }
      }
      showToast('Evolução registrada!', 'success');
    }
    closeModal('modal-evolucao'); histTab('evolucoes', document.getElementById('htab-evolucoes'));
  };

  // ── Override excluir functions ────────────────────────────────────────────
  window.excluirPaciente = async function (id) {
    if (!confirm('Excluir este paciente? Esta ação não pode ser desfeita.')) return;
    const sb = getDb(); if (sb) await sb.from('pacientes').delete().eq('id', id);
    const i = PACIENTES.findIndex(p => p.id === id); if (i > -1) PACIENTES.splice(i, 1);
    renderPacientesTable(); populateSelects(); showToast('Paciente excluído.', 'error');
  };
  window.excluirProfissional = async function (id) {
    if (!confirm('Excluir este profissional?')) return;
    const sb = getDb(); if (sb) await sb.from('profissionais').delete().eq('id', id);
    const i = PROFISSIONAIS.findIndex(p => p.id === id); if (i > -1) PROFISSIONAIS.splice(i, 1);
    renderProfissionaisTable(); buildProfFilters(); populateSelects(); renderDayView(); showToast('Excluído.', 'error');
  };
  window.excluirPlano = async function (id) {
    if (!confirm('Excluir este plano?')) return;
    const sb = getDb(); if (sb) await sb.from('planos_saude').delete().eq('id', id);
    const i = PLANOS.findIndex(p => p.id === id); if (i > -1) PLANOS.splice(i, 1);
    renderPlanosGrid(); populateSelects(); showToast('Excluído.', 'error');
  };
  window.excluirProcedimento = async function (id) {
    if (!confirm('Excluir este procedimento?')) return;
    const sb = getDb(); if (sb) await sb.from('procedimentos').delete().eq('id', id);
    const i = PROCEDIMENTOS.findIndex(p => p.id === id); if (i > -1) PROCEDIMENTOS.splice(i, 1);
    renderProcedimentosTable(); showToast('Excluído.', 'error');
  };
  window.excluirGuia = async function (id) {
    if (!confirm('Excluir esta guia?')) return;
    const sb = getDb(); if (sb) await sb.from('guias_sadt').delete().eq('id', id);
    const i = GUIAS.findIndex(g => g.id === id); if (i > -1) GUIAS.splice(i, 1);
    renderGuiasList(); showToast('Guia excluída.', 'error');
  };
  window.excluirLote = async function (id) {
    if (!confirm('Excluir este lote? As guias voltarão para pendente.')) return;
    const l = LOTES.find(x => x.id === id);
    if (l && l.guiaIds) l.guiaIds.forEach(gid => { const g = GUIAS.find(x => x.id === gid); if (g) { g.loteId = null; g.loteNum = null; g.status = 'Pendente'; const sb = getDb(); if (sb) sb.from('guias_sadt').update({ lote_id: null, lote_num: null, status: 'Pendente' }).eq('id', gid); } });
    const sb = getDb(); if (sb) await sb.from('lotes_tiss').delete().eq('id', id);
    const i = LOTES.findIndex(x => x.id === id); if (i > -1) LOTES.splice(i, 1);
    renderLotesTable(); renderGuiasList(); showToast('Lote excluído.', 'error');
  };
  window.excluirSenha = async function (id) {
    if (!confirm('Excluir esta autorização?')) return;
    const sb = getDb(); if (sb) await sb.from('senhas_plano').delete().eq('id', id);
    const i = SENHAS_PLANO.findIndex(s => s.id === id); if (i > -1) SENHAS_PLANO.splice(i, 1);
    renderSenhas(); showToast('Autorização excluída.', 'error');
  };
  window.excluirEspera = async function (id) {
    const e = LISTA_ESPERA.find(x => x.id === id);
    if (e?.status === 'Convertido') { showToast('Paciente já convertido — não pode ser excluído.', 'error'); return; }
    if (!confirm('Remover da lista de espera?')) return;
    const sb = getDb(); if (sb) await sb.from('lista_espera').delete().eq('id', id);
    const i = LISTA_ESPERA.findIndex(x => x.id === id); if (i > -1) LISTA_ESPERA.splice(i, 1);
    renderEsperaTable(); showToast('Removido da lista.', 'error');
  };
  window.excluirHistorico = async function (id) {
    if (!confirm('Excluir este registro?')) return;
    const sb = getDb(); if (sb) await sb.from('historico').delete().eq('id', id);
    const i = HISTORICO.findIndex(h => h.id === id); if (i > -1) HISTORICO.splice(i, 1);
    try { histTab(document.querySelector('.imp-tab.active')?.id?.replace('htab-', '') || 'linha', document.querySelector('.imp-tab.active')); } catch (e) {}
    showToast('Registro excluído.', 'error');
  };
  window.excluirAgendamento = async function (id) {
    if (!confirm('Excluir este agendamento permanentemente?')) return;
    const sb = getDb(); if (sb) await sb.from('agendamentos').delete().eq('id', id);
    const i = APPOINTMENTS.findIndex(a => a.id === id); if (i > -1) APPOINTMENTS.splice(i, 1);
    closeModal('modal-agendamento'); renderDayView(); showToast('Agendamento excluído.', 'error');
  };

  // ── Override salvarConfigClinica ──────────────────────────────────────────
  window.salvarConfigClinica = async function () {
    const nome = document.getElementById('cfg-nome-clinica')?.value.trim();
    if (!nome) { showToast('Informe o nome da clínica', 'error'); return; }
    CLINICA.nome         = nome;
    CLINICA.cnpj         = document.getElementById('cfg-cnpj')?.value.trim()         || CLINICA.cnpj;
    CLINICA.endereco     = document.getElementById('cfg-endereco')?.value.trim()      || CLINICA.endereco;
    CLINICA.telefone     = document.getElementById('cfg-tel')?.value.trim()           || CLINICA.telefone;
    CLINICA.email        = document.getElementById('cfg-email-clinica')?.value.trim() || CLINICA.email;
    CLINICA.codPrestador = document.getElementById('cfg-cod-prestador')?.value.trim() || CLINICA.codPrestador;
    CLINICA.cnes         = document.getElementById('cfg-cnes')?.value.trim()          || CLINICA.cnes;
    renderSidebarLogo();
    await salvarConfigNoDB();
    showToast('Configurações salvas com sucesso!', 'success');
  };

  // ── Botão "Testar conexão" Supabase: salva credenciais e carrega dados ────
  window.testarConexaoSupabase = async function () {
    const url = document.getElementById('cfg-supa-url')?.value.trim();
    const key = document.getElementById('cfg-supa-key')?.value.trim();
    if (!url || !key) { showToast('Preencha a URL e a chave anon', 'error'); return; }
    try {
      const testClient = window.supabase.createClient(url, key);
      // Testa com um select simples
      const { error } = await testClient.from('pacientes').select('count').limit(1);
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') throw error;
      // Sucesso: salva no localStorage e inicializa o cliente
      localStorage.setItem('cf_supa_url', url);
      localStorage.setItem('cf_supa_key', key);
      _sb = testClient;
      showToast('✓ Conexão bem-sucedida! Credenciais salvas permanentemente.', 'success');
      await loadFromSupabase();
      // Re-renderiza tudo
      ['renderPacientesTable','renderProfissionaisTable','renderPlanosGrid','renderProcedimentosTable','renderGuiasList','renderDayView','populateSelects'].forEach(fn => { try { window[fn](); } catch(e) {} });
    } catch (e) {
      showToast('Erro de conexão: ' + e.message, 'error');
    }
  };

  // ── Preenche campos Supabase da config page com valores do localStorage ───
  const _origInitConfigPage = window.initConfigPage;
  window.initConfigPage = function () {
    _origInitConfigPage && _origInitConfigPage();
    const urlEl = document.getElementById('cfg-supa-url');
    const keyEl = document.getElementById('cfg-supa-key');
    if (urlEl) urlEl.value = localStorage.getItem('cf_supa_url') || '';
    if (keyEl) keyEl.value = localStorage.getItem('cf_supa_key') || '';
  };

  // ── Substitui o onclick do botão "Testar conexão" do Supabase ────────────
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes('showToast') && btn.textContent.trim() === 'Testar conexão') {
        btn.removeAttribute('onclick');
        btn.addEventListener('click', window.testarConexaoSupabase);
      }
    });
  });

  // ── Auto-inicializa o cliente Supabase ao abrir o app ─────────────────────
  window.addEventListener('load', function () {
    const url = localStorage.getItem('cf_supa_url');
    const key = localStorage.getItem('cf_supa_key');
    if (url && key && window.supabase) {
      _sb = window.supabase.createClient(url, key);
      console.log('[ClinicFlow Supabase] Cliente inicializado automaticamente ✓');
    }
  });

  // Expõe funções utilitárias globalmente
  window.loadFromSupabase = loadFromSupabase;

  console.log('[ClinicFlow Supabase] Patch carregado ✓');
})();