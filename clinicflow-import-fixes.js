// ============================================================
// clinicflow-import-fixes.js
// Correção completa do módulo de importação → Supabase
// Inclua APÓS o script principal e APÓS o clinicflow-fixes.js
// <script src="clinicflow-import-fixes.js"></script>
// ============================================================

(function () {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // 0. UTILITÁRIOS BASE
  // ──────────────────────────────────────────────────────────

  function sb() {
    if (window._supabase) return window._supabase;
    const url = localStorage.getItem('sb_url');
    const key = localStorage.getItem('sb_key');
    if (url && key && window.supabase?.createClient) {
      window._supabase = window.supabase.createClient(url, key);
      return window._supabase;
    }
    return null;
  }

  function toast(msg, tipo = 'success') {
    const cores = { success: '#16a34a', error: '#dc2626', info: '#2563eb', warn: '#d97706' };
    const el = document.createElement('div');
    el.innerHTML = msg;
    el.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:99999;
      background:${cores[tipo] || cores.info};color:#fff;
      padding:12px 20px;border-radius:8px;font-size:14px;
      box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:380px;
      line-height:1.5;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // Normaliza string para comparação
  function norm(s) {
    return (s || '').toString().trim().toLowerCase();
  }

  // Converte data de vários formatos para YYYY-MM-DD
  function parseDate(val) {
    if (!val) return null;
    const s = val.toString().trim();
    // DD/MM/AAAA ou DD/MM/AA
    if (/
^
\d{1,2}\/\d{1,2}\/\d{2,4}
$
/.test(s)) {
      const [d, m, a] = s.split('/');
      const ano = a.length === 2 ? '20' + a : a;
      return `${ano}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // YYYY-MM-DD já ok
    if (/
^
\d{4}-\d{2}-\d{2}
$
/.test(s)) return s;
    // DD-MM-YYYY
    if (/
^
\d{1,2}-\d{1,2}-\d{4}
$
/.test(s)) {
      const [d, m, a] = s.split('-');
      return `${a}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // Tenta Date nativo como último recurso
    try {
      const dt = new Date(s);
      if (!isNaN(dt)) return dt.toISOString().split('T')[0];
    } catch (_) {}
    return null;
  }

  // Converte hora para HH:MM
  function parseTime(val) {
    if (!val) return null;
    const s = val.toString().trim();
    if (/
^
\d{1,2}:\d{2}(:\d{2})?
$
/.test(s)) {
      const [h, m] = s.split(':');
      return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`;
    }
    return s || null;
  }

  // Limpa CPF/CNPJ
  function cleanDoc(val) {
    return (val || '').toString().replace(/\D/g, '');
  }

  // Limpa telefone
  function cleanFone(val) {
    return (val || '').toString().replace(/\D/g, '');
  }

  // Parseia valor monetário
  function parseMoney(val) {
    if (!val && val !== 0) return 0;
    const s = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }

  // Faz upsert em lotes de 50 para não sobrecarregar
  async function upsertLote(tabela, registros, conflito = null) {
    const client = sb();
    if (!client) throw new Error('Supabase não conectado');
    const TAMANHO = 50;
    let inseridos = 0;
    let erros = [];

    for (let i = 0; i < registros.length; i += TAMANHO) {
      const lote = registros.slice(i, i + TAMANHO);
      try {
        let query = client.from(tabela);
        if (conflito) {
          const { data, error } = await query
            .upsert(lote, { onConflict: conflito, ignoreDuplicates: false });
          if (error) {
            erros.push({ lote: i, error: error.message });
          } else {
            inseridos += lote.length;
          }
        } else {
          const { data, error } = await query.insert(lote);
          if (error) {
            // Tenta inserir um a um para identificar o registro problemático
            for (const reg of lote) {
              const { error: e2 } = await client.from(tabela).insert(reg);
              if (e2) erros.push({ registro: reg, error: e2.message });
              else inseridos++;
            }
          } else {
            inseridos += lote.length;
          }
        }
      } catch (e) {
        erros.push({ lote: i, error: e.message });
      }
    }

    return { inseridos, erros };
  }

  // ──────────────────────────────────────────────────────────
  // 1. PARSER CSV ROBUSTO
  // ──────────────────────────────────────────────────────────

  function parseCSV(texto) {
    const linhas = [];
    let campo = '';
    let linha = [];
    let dentroAspas = false;
    let i = 0;
    const t = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    while (i < t.length) {
      const c = t[i];
      if (c === '"') {
        if (dentroAspas && t[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroAspas = !dentroAspas;
        i++;
        continue;
      }
      if ((c === ',' || c === ';') && !dentroAspas) {
        linha.push(campo.trim());
        campo = '';
        i++;
        continue;
      }
      if (c === '\n' && !dentroAspas) {
        linha.push(campo.trim());
        if (linha.some(f => f !== '')) linhas.push(linha);
        linha = [];
        campo = '';
        i++;
        continue;
      }
      campo += c;
      i++;
    }
    if (campo || linha.length) {
      linha.push(campo.trim());
      if (linha.some(f => f !== '')) linhas.push(linha);
    }

    if (linhas.length < 2) return [];

    const cabecalho = linhas[0].map(h => h.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/\s+/g, '_')
    );

    return linhas.slice(1).map(linha => {
      const obj = {};
      cabecalho.forEach((col, idx) => {
        obj[col] = (linha[idx] || '').trim();
      });
      obj._raw = linha;
      return obj;
    });
  }

  // Lê arquivo e retorna texto
  function lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  // ──────────────────────────────────────────────────────────
  // 2. MAPEADORES — CSV linha → payload Supabase
  // ──────────────────────────────────────────────────────────

  // Helper: encontra valor por múltiplos nomes de coluna possíveis
  function campo(row, ...nomes) {
    for (const n of nomes) {
      const key = n.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
      if (row[key] !== undefined && row[key] !== '') return row[key];
      // Tenta busca parcial
      const encontrado = Object.keys(row).find(k =>
        k.includes(key) || key.includes(k)
      );
      if (encontrado && row[encontrado] !== '') return row[encontrado];
    }
    return '';
  }

  // ── 2a. PACIENTES
  function mapearPaciente(row) {
    const nome = campo(row, 'nome', 'paciente', 'nome_completo', 'name');
    if (!nome) return null;

    // Sexo
    const sexoRaw = norm(campo(row, 'sexo', 'genero', 'gender', 'sex'));
    let sexo = null;
    if (sexoRaw.includes('f') || sexoRaw.includes('fem')) sexo = 'Feminino';
    else if (sexoRaw.includes('m') || sexoRaw.includes('masc')) sexo = 'Masculino';
    else if (sexoRaw) sexo = 'Outro';

    // Status
    const statusRaw = norm(campo(row, 'status', 'ativo', 'active'));
    let status = 'Ativo';
    if (statusRaw === 'inativo' || statusRaw === '0' || statusRaw === 'false') {
      status = 'Inativo';
    }

    // Estado civil
    const ecRaw = norm(campo(row, 'estado_civil', 'estadocivil', 'civil'));
    let estadoCivil = null;
    if (ecRaw.includes('casad')) estadoCivil = 'Casado(a)';
    else if (ecRaw.includes('soltei')) estadoCivil = 'Solteiro(a)';
    else if (ecRaw.includes('divorc')) estadoCivil = 'Divorciado(a)';
    else if (ecRaw.includes('viuv')) estadoCivil = 'Viúvo(a)';

    return {
      nome: nome.trim(),
      data_nascimento: parseDate(campo(row,
        'data_nascimento','nascimento','data_nasc','dt_nasc','birthday','born')),
      cpf: cleanDoc(campo(row, 'cpf', 'documento', 'doc')),
      sexo,
      status,
      telefone: cleanFone(campo(row,
        'telefone','fone','phone','celular','whatsapp','tel')),
      email: campo(row, 'email', 'e_mail', 'email_address'),
      endereco: campo(row, 'endereco', 'endereço', 'address', 'logradouro'),
      plano_nome: campo(row,
        'plano','plano_saude','convenio','plano_de_saude','health_plan','plan'),
      carteirinha: campo(row,
        'carteirinha','num_carteirinha','carteira','card','matricula'),
      validade_carteirinha: parseDate(campo(row,
        'validade_carteirinha','validade','val_carteirinha')),
      titular_plano: campo(row, 'titular','titular_plano','holder'),
      estado_civil: estadoCivil,
      profissao: campo(row, 'profissao','profissão','ocupacao','job'),
      observacoes: campo(row, 'observacoes','observações','obs','notes'),
      ultima_consulta: parseDate(campo(row,
        'ultima_consulta','ultimo_atendimento','last_visit')),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2b. PROFISSIONAIS
  function mapearProfissional(row) {
    const nome = campo(row,
      'nome','profissional','nome_completo','name','terapeuta');
    if (!nome) return null;

    const statusRaw = norm(campo(row, 'status','ativo'));
    const status = (statusRaw === 'inativo' || statusRaw === '0') ? 'Inativo' : 'Ativo';

    // Tipo de conselho
    const conselhoRaw = (campo(row,
      'tipo_conselho','conselho','council') || '').toUpperCase();
    const conselhos = ['CRM','CRFa','CRP','CRO','CREFITO','CRN','COREN','CFF'];
    const tipoConselho = conselhos.find(c => conselhoRaw.includes(c)) || null;

    return {
      nome: nome.trim(),
      nome_agenda: campo(row, 'nome_agenda','nome_na_agenda','agenda_name') || nome.trim(),
      especialidade: campo(row, 'especialidade','specialty','area'),
      cbo: campo(row, 'cbo','cod_cbo','codigo_cbo'),
      tipo_conselho: tipoConselho,
      num_conselho: campo(row, 'num_conselho','numero_conselho','crm','crfa','crp','cro'),
      uf_conselho: (campo(row, 'uf_conselho','uf','estado') || '').toUpperCase().slice(0, 2),
      telefone: cleanFone(campo(row, 'telefone','fone','phone','celular')),
      email: campo(row, 'email','e_mail'),
      google_calendar_id: campo(row, 'google_calendar_id','calendar_id','gcal'),
      instagram: campo(row, 'instagram','insta'),
      linkedin: campo(row, 'linkedin'),
      cor_agenda: campo(row, 'cor_agenda','cor','color') || '#6366f1',
      data_inclusao: parseDate(campo(row,
        'data_inclusao','data_cadastro','created')) || new Date().toISOString().split('T')[0],
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2c. AGENDA / AGENDAMENTOS
  function mapearAgendamento(row) {
    const data = parseDate(campo(row, 'data','date','dt','data_consulta'));
    const paciente = campo(row, 'paciente','patient','nome_paciente','beneficiario');
    const profissional = campo(row,
      'profissional','terapeuta','medico','dentista','therapist','doctor','professional');
    if (!data || !paciente) return null;

    const horarioIni = parseTime(campo(row,
      'horario_inicio','hora_inicio','inicio','start','hora','horario'));
    const horarioFim = parseTime(campo(row,
      'horario_fim','hora_fim','fim','end','hora_termino'));

    // Duração em minutos
    const duracaoRaw = campo(row, 'duracao','duracao_min','duration','mins');
    const duracao = parseInt(duracaoRaw) || 60;

    // Status
    const stRaw = norm(campo(row, 'status','situacao'));
    let status = 'Agendado';
    if (stRaw.includes('confirma')) status = 'Confirmado';
    else if (stRaw.includes('atendid') || stRaw.includes('realiz')) status = 'Atendido';
    else if (stRaw.includes('cancel')) status = 'Cancelado';
    else if (stRaw.includes('desmarca') || stRaw.includes('falta')) status = 'Desmarcado';

    // Tipo atendimento
    const tipoRaw = norm(campo(row,
      'tipo_atendimento','tipo','type','modalidade_atend'));
    let tipo = 'Sessão terapêutica';
    if (tipoRaw.includes('avali') || tipoRaw.includes('anamn')) {
      tipo = 'Avaliação / Anamnese';
    } else if (tipoRaw.includes('retorno')) {
      tipo = 'Consulta de retorno';
    } else if (tipoRaw.includes('alta')) {
      tipo = 'Sessão de alta';
    }

    // Modalidade
    const modalRaw = norm(campo(row, 'modalidade','modality','local'));
    const modalidade = (modalRaw.includes('online') || modalRaw.includes('remoto'))
      ? 'Online' : 'Presencial';

    return {
      data,
      horario_inicio: horarioIni || '08:00',
      horario_fim: horarioFim,
      duracao,
      paciente: paciente.trim(),
      profissional: profissional ? profissional.trim() : '',
      plano: campo(row, 'plano','convenio','plan'),
      carteirinha: campo(row, 'carteirinha','carteira','card'),
      tipo_atendimento: tipo,
      modalidade,
      link_meet: campo(row, 'link_meet','meet','link','url'),
      status,
      observacoes: campo(row, 'observacoes','obs','notes','observações'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2d. EVOLUÇÕES
  function mapearEvolucao(row) {
    const data = parseDate(campo(row, 'data','date','dt','data_sessao'));
    const paciente = campo(row, 'paciente','patient','nome_paciente');
    if (!data || !paciente) return null;

    const presencaRaw = norm(campo(row,
      'presenca','presença','presence','compareceu','presente'));
    let presenca = 'Presente';
    if (presencaRaw.includes('ausente') || presencaRaw.includes('faltou') ||
        presencaRaw === 'f' || presencaRaw === 'não' || presencaRaw === 'nao') {
      presenca = 'Ausente';
    } else if (presencaRaw.includes('justif')) {
      presenca = 'Justificado';
    }

    return {
      data_sessao: data,
      paciente: paciente.trim(),
      profissional: campo(row,
        'profissional','terapeuta','therapist','doctor').trim(),
      horario_inicio: parseTime(campo(row,
        'horario_inicio','hora_inicio','inicio','start','hora')),
      horario_fim: parseTime(campo(row,
        'horario_fim','hora_fim','fim','end')),
      duracao_min: parseInt(campo(row,
        'duracao','duracao_min','duration','mins')) || null,
      presenca,
      titulo: campo(row, 'titulo','title','tipo','tipo_sessao') || 'Evolução',
      texto: campo(row, 'evolucao','evolução','texto','text','anotacao','anotações','notes'),
      convenio: campo(row, 'convenio','plano','convênio'),
      semana: campo(row, 'semana','week'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2e. PLANOS DE SAÚDE
  function mapearPlano(row) {
    const nome = campo(row, 'nome','plano','operadora','name');
    if (!nome) return null;

    const statusRaw = norm(campo(row, 'status','ativo'));
    const status = (statusRaw === 'inativo' || statusRaw === '0') ? 'Inativo' : 'Ativo';

    return {
      nome: nome.trim(),
      nome_guia_tiss: campo(row, 'nome_guia_tiss','nome_tiss','tiss_name') || nome.trim(),
      registro_ans: campo(row, 'registro_ans','ans','reg_ans','codigo_ans'),
      cnpj_operadora: cleanDoc(campo(row,
        'cnpj_operadora','cnpj','cnpj_plano')),
      status,
      telefone: cleanFone(campo(row, 'telefone','fone','phone')),
      email: campo(row, 'email','e_mail'),
      utilizar_tiss: true,
      versao_tiss: campo(row, 'versao_tiss','versao','version') || '4.02.00',
      observacoes: campo(row, 'observacoes','obs','notes','observações'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2f. TABELA DE PREÇOS / PROCEDIMENTOS
  function mapearProcedimento(row) {
    const codigo = campo(row, 'codigo_tuss','codigo','code','cod','tuss','cod_tuss');
    const descricao = campo(row, 'descricao','descrição','description','procedimento','desc');
    if (!codigo && !descricao) return null;

    const tipoRaw = norm(campo(row, 'tipo','type'));
    let tipo = 'Sessão';
    if (tipoRaw.includes('consul')) tipo = 'Consulta';
    else if (tipoRaw.includes('exam')) tipo = 'Exame';
    else if (tipoRaw.includes('cirurg')) tipo = 'Cirurgia';
    else if (tipoRaw && !tipoRaw.includes('sess')) tipo = 'Outro';

    const statusRaw = norm(campo(row, 'status','ativo'));
    const status = (statusRaw === 'inativo' || statusRaw === '0') ? 'Inativo' : 'Ativo';

    return {
      codigo_tuss: (codigo || '').trim(),
      descricao: (descricao || codigo || '').trim(),
      descricao_resumida: campo(row, 'descricao_resumida','desc_curta','short_desc'),
      tipo,
      valor_particular: parseMoney(campo(row,
        'valor_particular','valor_part','particular','preco_particular','price')),
      valor_plano_padrao: parseMoney(campo(row,
        'valor_plano_padrao','valor_plano','plano','preco_plano','plan_price')),
      tabela_referencia: campo(row,
        'tabela_referencia','tabela','table','ref') || 'TUSS',
      status,
      observacoes: campo(row, 'observacoes','obs','observações'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2g. GUIAS SADT
  function mapearGuiaSADT(row) {
    const paciente = campo(row, 'paciente','beneficiario','patient','nome_paciente');
    if (!paciente) return null;

    const statusRaw = norm(campo(row, 'status','situacao'));
    let status = 'Pendente';
    if (statusRaw.includes('enviado') || statusRaw.includes('sent')) status = 'Enviado';
    else if (statusRaw.includes('pago') || statusRaw.includes('paid')) status = 'Pago';
    else if (statusRaw.includes('glosa') || statusRaw.includes('denied')) status = 'Glosado';

    return {
      num_guia_prestador: campo(row,
        'num_guia_prestador','num_guia','numero_guia','guia_prestador','n_guia'),
      num_guia_operadora: campo(row,
        'num_guia_operadora','guia_operadora','guia_op'),
      data_autorizacao: parseDate(campo(row,
        'data_autorizacao','dt_autorizacao','data_auth','autorizado_em')),
      senha: campo(row, 'senha','num_senha','password','auth_code'),
      validade_senha: parseDate(campo(row,
        'validade_senha','validade','val_senha','expiry')),
      data_atendimento: parseDate(campo(row,
        'data_atendimento','data','dt_atend','date','data_consulta')),
      paciente: paciente.trim(),
      carteirinha: campo(row, 'carteirinha','carteira','card','num_carteira'),
      plano: campo(row, 'plano','convenio','operadora','plan'),
      profissional: campo(row,
        'profissional','terapeuta','medico','executante','therapist'),
      tipo_atendimento: campo(row,
        'tipo_atendimento','tipo','type') || 'Outras terapias-3',
      cid10: campo(row, 'cid10','cid','icd10','diagnostico'),
      valor_total: parseMoney(campo(row,
        'valor_total','total','value','valor')),
      observacao: campo(row, 'observacao','obs','observações','notes'),
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2h. SENHAS / AUTORIZAÇÕES
  function mapearSenha(row) {
    const paciente = campo(row, 'paciente','beneficiario','patient','nome_paciente');
    const senha = campo(row,
      'numero_senha','num_senha','senha','password','auth_code','autorizacao');
    if (!paciente || !senha) return null;

    const statusRaw = norm(campo(row, 'status','situacao','ativo'));
    let status = 'Ativa';
    if (statusRaw.includes('usad') || statusRaw === 'usado') status = 'Usada';
    else if (statusRaw.includes('vencid') || statusRaw.includes('expir')) status = 'Vencida';
    else if (statusRaw.includes('cancel')) status = 'Cancelada';

    return {
      plano: campo(row, 'plano','convenio','operadora','plan'),
      paciente: paciente.trim(),
      carteirinha: campo(row, 'carteirinha','carteira','card','num_carteira'),
      num_guia_operadora: campo(row,
        'num_guia_operadora','guia_operadora','guia_op','num_guia'),
      numero_senha: senha.trim(),
      data_autorizacao: parseDate(campo(row,
        'data_autorizacao','data_auth','autorizado_em','data_liberacao')),
      validade_senha: parseDate(campo(row,
        'validade_senha','validade','val_senha','expiry','vencimento')),
      qtd_autorizada: parseInt(campo(row,
        'qtd_autorizada','qtd_aut','quantidade_autorizada','sessoes_autorizadas',
        'qtd','quantidade')) || 0,
      qtd_usada: parseInt(campo(row,
        'qtd_usada','qtd_utilizada','sessoes_usadas','usadas')) || 0,
      codigo_tuss: campo(row,
        'codigo_tuss','codigo','code','cod_proc','cod_tuss'),
      descricao_proc: campo(row,
        'descricao_proc','descricao','procedimento','desc','description'),
      valor_unitario: parseMoney(campo(row,
        'valor_unitario','valor','value','preco','price')),
      cid10: campo(row, 'cid10','cid','icd10'),
      status,
      observacoes: campo(row, 'observacoes','obs','observações','notes'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ── 2i. ANAMNESE
  function mapearAnamnese(row) {
    const paciente = campo(row,
      'nome_completo','nome','paciente','patient','name');
    if (!paciente) return null;

    // Captura todos os campos não-padrão como extras
    const camposBase = ['nome','nome_completo','paciente','data','carimbo_de_data_hora',
      'timestamp','queixa','historia','antecedentes','medicamentos',
      'alergias','desenvolvimento','escolaridade','familiar','obs'];
    const extras = {};
    Object.keys(row).forEach(k => {
      if (k === '_raw') return;
      if (!camposBase.some(b => k.includes(b))) {
        extras[k] = row[k];
      }
    });

    return {
      paciente: paciente.trim(),
      data_preenchimento: parseDate(campo(row,
        'carimbo_de_data_hora','timestamp','data','date')) || new Date().toISOString(),
      queixa_principal: campo(row,
        'queixa_principal','queixa','motivo','chief_complaint'),
      historia_clinica: campo(row,
        'historia_clinica','historia','history','hma'),
      antecedentes: campo(row,
        'antecedentes','antecedentes_clinicos','past_history'),
      medicamentos: campo(row,
        'medicamentos','medicacoes','medication','remedios'),
      alergias: campo(row, 'alergias','alergias_e_reacoes','allergies'),
      desenvolvimento: campo(row,
        'desenvolvimento','desenvolvimento_neuropsicomotor','development'),
      escolaridade: campo(row, 'escolaridade','escola','education'),
      dados_familiares: campo(row,
        'dados_familiares','familia','family','hist_familiar'),
      observacoes: campo(row,
        'observacoes','obs','observações','notes','outras_informacoes'),
      campos_extras: extras,
      raw_csv_linha: row,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // ──────────────────────────────────────────────────────────
  // 3. ENGINE CENTRAL DE IMPORTAÇÃO
  // ──────────────────────────────────────────────────────────

  const CONFIG_IMPORTACAO = {
    pacientes: {
      label: 'Pacientes',
      tabela: 'pacientes',
      mapear: mapearPaciente,
      conflito: null,
      obrigatorios: ['nome'],
    },
    profissionais: {
      label: 'Profissionais',
      tabela: 'profissionais',
      mapear: mapearProfissional,
      conflito: null,
      obrigatorios: ['nome'],
    },
    agenda: {
      label: 'Agenda',
      tabela: 'agendamentos',
      mapear: mapearAgendamento,
      conflito: null,
      obrigatorios: ['data', 'paciente'],
    },
    anamnese: {
      label: 'Anamnese',
      tabela: 'anamneses',
      mapear: mapearAnamnese,
      conflito: null,
      obrigatorios: ['paciente'],
    },
    evolucoes: {
      label: 'Evoluções',
      tabela: 'evolucoes',
      mapear: mapearEvolucao,
      conflito: null,
      obrigatorios: ['data_sessao', 'paciente'],
    },
    planos: {
      label: 'Planos de Saúde',
      tabela: 'planos_saude',
      mapear: mapearPlano,
      conflito: null,
      obrigatorios: ['nome'],
    },
    procedimentos: {
      label: 'Tabela de Preços',
      tabela: 'procedimentos',
      mapear: mapearProcedimento,
      conflito: 'codigo_tuss',
      obrigatorios: [],
    },
    guias_sadt: {
      label: 'Guias SADT',
      tabela: 'guias_sadt',
      mapear: mapearGuiaSADT,
      conflito: null,
      obrigatorios: ['paciente'],
    },
    senhas: {
      label: 'Senhas / Autorizações',
      tabela: 'senhas_autorizacoes',
      mapear: mapearSenha,
      conflito: null,
      obrigatorios: ['paciente', 'numero_senha'],
    },
  };

  // Importa CSV de qualquer tipo
  async function importarCSV(tipo, textoCSV, callbacks = {}) {
    const cfg = CONFIG_IMPORTACAO[tipo];
    if (!cfg) throw new Error(`Tipo de importação desconhecido: ${tipo}`);

    const client = sb();
    if (!client) {
      toast('⚠️ Supabase não conectado. Configure nas Configurações.', 'error');
      return { sucesso: 0, erros: 1, avisos: 0, detalhes: [] };
    }

    callbacks.onInicio?.(`Processando ${cfg.label}...`);

    // Parse CSV
    const linhas = parseCSV(textoCSV);
    if (!linhas.length) {
      toast('Arquivo vazio ou sem dados válidos.', 'warn');
      return { sucesso: 0, erros: 1, avisos: 0, detalhes: [] };
    }

    // Mapeia registros
    const registros = [];
    const detalhes = [];
    let avisos = 0;

    linhas.forEach((row, idx) => {
      const payload = cfg.mapear(row);
      if (!payload) {
        detalhes.push({
          linha: idx + 2,
          status: 'erro',
          msg: 'Campos obrigatórios ausentes ou linha vazia',
          dados: row,
        });
        return;
      }

      // Valida obrigatórios
      const faltando = cfg.obrigatorios.filter(f => !payload[f]);
      if (faltando.length > 0) {
        detalhes.push({
          linha: idx + 2,
          status: 'erro',
          msg: `Campo(s) obrigatório(s) vazio(s): ${faltando.join(', ')}`,
          dados: row,
        });
        return;
      }

      // Avisos sobre campos opcionais importantes
      const avisosCampos = [];
      if (tipo === 'pacientes' && !payload.telefone) avisosCampos.push('sem telefone');
      if (tipo === 'pacientes' && !payload.plano_nome) avisosCampos.push('sem plano');
      if (tipo === 'agenda' && !payload.horario_inicio) avisosCampos.push('sem horário');
      if (tipo === 'senhas' && !payload.validade_senha) avisosCampos.push('sem validade');

      if (avisosCampos.length) {
        avisos++;
        detalhes.push({
          linha: idx + 2,
          status: 'aviso',
          msg: avisosCampos.join('; '),
          dados: payload,
        });
      } else {
        detalhes.push({
          linha: idx + 2,
          status: 'ok',
          msg: 'OK',
          dados: payload,
        });
      }

      registros.push(payload);
    });

    callbacks.onPreview?.(detalhes);

    if (registros.length === 0) {
      toast(`Nenhum registro válido para importar em ${cfg.label}.`, 'warn');
      return { sucesso: 0, erros: detalhes.length, avisos, detalhes };
    }

    callbacks.onSalvando?.(`Salvando ${registros.length} registros no Supabase...`);

    // Salva no Supabase
    const { inseridos, erros: errosSalvar } = await upsertLote(
      cfg.tabela, registros, cfg.conflito
    );

    // Registra log de importação
    try {
      await client.from('importacao_logs').insert({
        tipo: cfg.label,
        nome_arquivo: callbacks.nomeArquivo || 'importacao',
        total_linhas: linhas.length,
        sucesso: inseridos,
        avisos,
        erros: errosSalvar.length + (linhas.length - registros.length),
        detalhes: detalhes.slice(0, 100),
        created_at: new Date().toISOString(),
      });
    } catch (_) {
      // Log não é crítico
    }

    // Pós-processamento específico por tipo
    if (tipo === 'guias_sadt' && inseridos > 0) {
      await processarGuiasImportadas(registros);
    }

    const resultado = {
      sucesso: inseridos,
      erros: errosSalvar.length + (linhas.length - registros.length),
      avisos,
      detalhes,
    };

    callbacks.onFim?.(resultado);
    return resultado;
  }

  // Pós-processamento de guias: atualiza qtd_usada
  async function processarGuiasImportadas(guias) {
    for (const g of guias) {
      if (g.paciente && g.plano) {
        try {
          await window.CF_atualizarQtdUsada?.(g.paciente, g.carteirinha, g.plano, 1);
        } catch (_) {}
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // 4. INTERCEPTA OS BOTÕES DE IMPORTAÇÃO DO HTML
  // ──────────────────────────────────────────────────────────

  // Estado da importação atual
  let importacaoAtual = {
    tipo: null,
    step: 1,
    csvTexto: '',
    registros: [],
    detalhes: [],
    nomeArquivo: '',
  };

  // Detecta qual tipo está ativo pela UI
  function detectarTipoAtivo() {
    // Procura pelo card de importação ativo/selecionado
    const ativo = document.querySelector(
      '.import-card.active, .import-type.selected, [data-import].active, ' +
      '[data-import-type].active, .importacao-card.ativo'
    );
    if (ativo) {
      return ativo.dataset.import ||
             ativo.dataset.importType ||
             ativo.dataset.tipo;
    }

    // Fallback: lê do título da seção atual
    const titulo = document.querySelector(
      '.import-title, #importacao-titulo, [data-import-step] h2, h3.import-type'
    );
    if (titulo) {
      const txt = norm(titulo.textContent);
      for (const tipo of Object.keys(CONFIG_IMPORTACAO)) {
        if (txt.includes(norm(CONFIG_IMPORTACAO[tipo].label))) return tipo;
      }
    }

    return importacaoAtual.tipo || 'pacientes';
  }

  // Mapeamento de textos dos cards de importação para tipos
  const CARD_MAP = {
    'paciente': 'pacientes',
    'profissional': 'profissionais',
    'agenda': 'agenda',
    'anamnese': 'anamnese',
    'evolucao': 'evolucoes',
    'evoluç': 'evolucoes',
    'plano': 'planos',
    'tabela de preço': 'procedimentos',
    'preço': 'procedimentos',
    'guia': 'guias_sadt',
    'senha': 'senhas',
    'autorizaç': 'senhas',
  };

  function tipoDoTexto(txt) {
    const n = norm(txt);
    for (const [chave, tipo] of Object.entries(CARD_MAP)) {
      if (n.includes(chave)) return tipo;
    }
    return null;
  }

  // ── Processa arquivo CSV carregado
  async function processarArquivo(file, tipo) {
    if (!file) return;
    try {
      const texto = await lerArquivo(file);
      await executarImportacao(tipo, texto, file.name);
    } catch (e) {
      toast('Erro ao ler arquivo: ' + e.message, 'error');
    }
  }

  // ── Executa importação e atualiza UI
  async function executarImportacao(tipo, csvTexto, nomeArquivo = '') {
    const cfg = CONFIG_IMPORTACAO[tipo];
    if (!cfg) {
      toast(`Tipo não reconhecido: ${tipo}`, 'error');
      return;
    }

    // Atualiza estado
    importacaoAtual = { tipo, step: 2, csvTexto, registros: [], detalhes: [], nomeArquivo };

    // Feedback visual de processamento
    atualizarProgressoUI('Processando arquivo...', 'loading');

    const resultado = await importarCSV(tipo, csvTexto, {
      nomeArquivo,
      onInicio: (msg) => atualizarProgressoUI(msg, 'loading'),
      onPreview: (detalhes) => {
        importacaoAtual.detalhes = detalhes;
        renderizarPreview(detalhes);
      },
      onSalvando: (msg) => atualizarProgressoUI(msg, 'loading'),
      onFim: (res) => {
        atualizarProgressoUI(
          `✅ ${res.sucesso} importado(s) · ⚠️ ${res.avisos} aviso(s) · ❌ ${res.erros} erro(s)`,
          res.erros > 0 ? 'warn' : 'success'
        );
        mostrarResultadoFinal(res, cfg.label);
      },
    });

    return resultado;
  }

  function atualizarProgressoUI(msg, tipo = 'info') {
    // Atualiza qualquer elemento de status na UI
    const el = document.querySelector(
      '#import-status, .import-progress, [data-import-status], .importacao-status'
    );
    if (el) {
      el.textContent = msg;
      el.className = `import-status import-status--${tipo}`;
    }
    console.log(`[Import] ${msg}`);
  }

  function renderizarPreview(detalhes) {
    const tbody = document.querySelector(
      '#import-preview tbody, [data-import-preview] tbody, .preview-table tbody'
    );
    if (!tbody) return;

    const ok = detalhes.filter(d => d.status === 'ok').length;
    const avisos = detalhes.filter(d => d.status === 'aviso').length;
    const erros = detalhes.filter(d => d.status === 'erro').length;

    // Atualiza contadores
    document.querySelectorAll('[data-count="ok"]').forEach(el => el.textContent = ok);
    document.querySelectorAll('[data-count="avisos"]').forEach(el => el.textContent = avisos);
    document.querySelectorAll('[data-count="erros"]').forEach(el => el.textContent = erros);

    // Renderiza linhas
    tbody.innerHTML = detalhes.slice(0, 200).map(d => {
      const icone = { ok: '✓', aviso: '⚠', erro: '✗' }[d.status] || '?';
      const cor = { ok: '#16a34a', aviso: '#d97706', erro: '#dc2626' }[d.status];
      const nome = d.dados?.nome || d.dados?.paciente || d.dados?.profissional || `Linha ${d.linha}`;
      return `
        <tr>
          <td style="color:${cor};font-weight:600;padding:6px 8px;">${icone}</td>
          <td style="padding:6px 8px;">${d.linha}</td>
          <td style="padding:6px 8px;">${nome}</td>
          <td style="padding:6px 8px;">${d.msg}</td>
          <td style="padding:6px 8px;">
            <span style="background:${cor}22;color:${cor};border-radius:999px;
              font-size:11px;padding:2px 8px;font-weight:600;">${d.status}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function mostrarResultadoFinal(resultado, label) {
    // Atualiza counters de resultado se existirem no DOM
    const elSucesso = document.querySelector(
      '#import-result-sucesso, [data-result="sucesso"]'
    );
    const elErros = document.querySelector(
      '#import-result-erros, [data-result="erros"]'
    );
    if (elSucesso) elSucesso.textContent = resultado.sucesso;
    if (elErros) elErros.textContent = resultado.erros;

    // Toast
    if (resultado.sucesso > 0) {
      toast(
        `<strong>${label}</strong><br>` +
        `✅ ${resultado.sucesso} registro(s) importado(s)<br>` +
        (resultado.avisos ? `⚠️ ${resultado.avisos} aviso(s)<br>` : '') +
        (resultado.erros ? `❌ ${resultado.erros} erro(s)` : ''),
        resultado.erros > resultado.sucesso ? 'warn' : 'success'
      );
    } else {
      toast(
        `<strong>${label}</strong><br>❌ Nenhum registro importado.<br>` +
        `Verifique o formato do arquivo.`,
        'error'
      );
    }

    // Mostra seção de resultado final se existir
    const secResultado = document.querySelector(
      '[data-import-step="4"], .import-step-resultado, #step-resultado'
    );
    if (secResultado) {
      secResultado.style.display = 'block';
    }
  }

  // ──────────────────────────────────────────────────────────
  // 5. BINDING DE EVENTOS DO DOM
  // ──────────────────────────────────────────────────────────

  function bindEventosImportacao() {
    // ── 5a. Clique nos cards de tipo de importação
    document.addEventListener('click', function (e) {
      const card = e.target.closest(
        '[data-import], [data-import-type], .import-card, ' +
        '.import-type-card, [class*="import-card"]'
      );
      if (card) {
        const tipo = card.dataset.import ||
                     card.dataset.importType ||
                     card.dataset.tipo ||
                     tipoDoTexto(card.textContent);
        if (tipo && CONFIG_IMPORTACAO[tipo]) {
          importacaoAtual.tipo = tipo;
          document.querySelectorAll('[data-import], .import-card').forEach(c => {
            c.classList.remove('active', 'selected', 'ativo');
          });
          card.classList.add('active');
          atualizarTituloImportacao(tipo);
          console.log(`[Import] Tipo selecionado: ${tipo}`);
        }
      }

      // ── 5b. Botão "Confirmar importação"
      const btnConfirmar = e.target.closest(
        'button[data-action="confirmar-importacao"], ' +
        '#btn-confirmar-importacao, ' +
        '.btn-confirmar-import'
      );
      if (btnConfirmar) {
        const tipo = detectarTipoAtivo();
        const textarea = document.querySelector(
          '#import-csv-textarea, textarea[data-import-csv], .import-textarea'
        );
        const csvTexto = importacaoAtual.csvTexto || textarea?.value || '';
        if (csvTexto) {
          executarImportacao(tipo, csvTexto, importacaoAtual.nomeArquivo);
        } else {
          toast('Cole o CSV ou carregue um arquivo antes de importar.', 'warn');
        }
      }
    });

    // ── 5c. Texto "Confirmar importação" (fallback para botão sem data-action)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('confirmar importa') || txt === 'importar') {
        const tipo = detectarTipoAtivo();
        const textarea = document.querySelector(
          '#import-csv-textarea, textarea[data-import-csv], .import-textarea, ' +
          'textarea[placeholder*="CSV"], textarea[placeholder*="cole"]'
        );
        const fileInput = document.querySelector(
          'input[type="file"][data-import-file], ' +
          '#import-file-input, ' +
          '.import-file-input'
        );
        const csvTexto = importacaoAtual.csvTexto || textarea?.value || '';
        if (csvTexto) {
          executarImportacao(tipo, csvTexto, importacaoAtual.nomeArquivo);
        } else if (fileInput?.files?.[0]) {
          processarArquivo(fileInput.files[0], tipo);
        } else {
          toast('Cole o CSV ou carregue um arquivo antes de importar.', 'warn');
        }
      }
    });

    // ── 5d. Input de arquivo (file picker)
    document.addEventListener('change', function (e) {
      const input = e.target;
      if (input.type !== 'file') return;
      const file = input.files?.[0];
      if (!file) return;
      const tipo = detectarTipoAtivo() ||
                   tipoDoTexto(input.closest('section, .modal, .card')?.textContent || '');
      if (!tipo) {
        toast('Selecione o tipo de importação primeiro.', 'warn');
        return;
      }
      importacaoAtual.nomeArquivo = file.name;
      processarArquivo(file, tipo).then(() => {
        // Avança para o step 3 (preview) se houver steps
        avancarStep(3);
      });
    });

    // ── 5e. Drag and drop na zona de upload
    const dropZone = document.querySelector(
      '.import-dropzone, .dropzone, [data-dropzone], ' +
      '[class*="drop-area"], [class*="drag-area"]'
    );
    if (dropZone) {
      dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.style.borderColor = '#6366f1';
        dropZone.style.background = '#eef2ff';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
      });
      dropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        const file = e.dataTransfer.files?.[0];
        if (file) {
          importacaoAtual.nomeArquivo = file.name;
          const tipo = detectarTipoAtivo();
          await processarArquivo(file, tipo);
          avancarStep(3);
        }
      });
    }

    // ── 5f. Textarea de CSV colado
    document.addEventListener('input', function (e) {
      const ta = e.target;
      if (ta.tagName !== 'TEXTAREA') return;
      const isImportTA =
        ta.id?.includes('csv') ||
        ta.dataset.importCsv !== undefined ||
        ta.placeholder?.toLowerCase().includes('csv') ||
        ta.placeholder?.toLowerCase().includes('cole') ||
        ta.className?.includes('import');
      if (isImportTA && ta.value) {
        importacaoAtual.csvTexto = ta.value;
      }
    });

    // ── 5g. Botão "Avançar" (steps do wizard)
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('avançar') || txt.includes('avancar') || txt === 'próximo →') {
        const stepAtual = detectarStepAtual();
        if (stepAtual === 1) {
          // Carrega preview
          const textarea = document.querySelector(
            'textarea[placeholder*="CSV"], textarea[placeholder*="cole"], ' +
            '#import-csv-textarea, .import-textarea'
          );
          if (importacaoAtual.csvTexto || textarea?.value) {
            importacaoAtual.csvTexto = importacaoAtual.csvTexto || textarea.value;
            const tipo = detectarTipoAtivo();
            // Faz parse e preview sem salvar
            const linhas = parseCSV(importacaoAtual.csvTexto);
            const cfg = CONFIG_IMPORTACAO[tipo] || CONFIG_IMPORTACAO.pacientes;
            const detalhes = linhas.map((row, idx) => {
              const payload = cfg.mapear(row);
              if (!payload) return { linha: idx + 2, status: 'erro', msg: 'Linha inválida', dados: row };
              const faltando = cfg.obrigatorios.filter(f => !payload[f]);
              if (faltando.length > 0) {
                return { linha: idx + 2, status: 'erro', msg: `Faltam: ${faltando.join(', ')}`, dados: row };
              }
              return { linha: idx + 2, status: 'ok', msg: 'OK', dados: payload };
            });
            importacaoAtual.detalhes = detalhes;
            renderizarPreview(detalhes);
          }
          avancarStep(stepAtual + 1);
        } else if (stepAtual === 2) {
          avancarStep(3);
        }
      }
    });

    // ── 5h. Dados de exemplo
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const txt = btn.textContent.trim().toLowerCase();
      if (txt.includes('dados de exemplo') || txt.includes('usar exemplo')) {
        const tipo = detectarTipoAtivo() || 'pacientes';
        const textarea = document.querySelector(
          'textarea[placeholder*="CSV"], textarea[placeholder*="cole"], ' +
          '#import-csv-textarea, .import-textarea'
        );
        const exemplo = gerarExemplo(tipo);
        if (textarea) {
          textarea.value = exemplo;
          importacaoAtual.csvTexto = exemplo;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          toast(`Dados de exemplo de ${CONFIG_IMPORTACAO[tipo]?.label || tipo} carregados!`, 'info');
        }
      }
    });
  }

  function atualizarTituloImportacao(tipo) {
    const cfg = CONFIG_IMPORTACAO[tipo];
    if (!cfg) return;
    const titulo = document.querySelector(
      '.import-title, #importacao-titulo, [data-import-titulo]'
    );
    if (titulo) titulo.textContent = `Importar ${cfg.label}`;
    // Atualiza descrição de colunas esperadas
    const desc = document.querySelector(
      '.import-columns-desc, [data-import-colunas], #import-colunas'
    );
    if (desc) desc.textContent = `Colunas esperadas — ${cfg.label}`;
  }

  function detectarStepAtual() {
    const ativo = document.querySelector(
      '[data-import-step].active, [data-step].active, .import-step.active'
    );
    if (ativo) return parseInt(ativo.dataset.importStep || ativo.dataset.step) || 1;
    return 1;
  }

  function avancarStep(novoStep) {
    // Esconde todos os steps
    document.querySelectorAll(
      '[data-import-step], [data-step], .import-step'
    ).forEach(el => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    // Mostra o step alvo
    const alvo = document.querySelector(
      `[data-import-step="${novoStep}"], [data-step="${novoStep}"]`
    );
    if (alvo) {
      alvo.classList.add('active');
      alvo.style.display = '';
    }
  }

  // ──────────────────────────────────────────────────────────
  // 6. DADOS DE EXEMPLO POR TIPO
  // ──────────────────────────────────────────────────────────

  function gerarExemplo(tipo) {
    const exemplos = {
      pacientes: `nome,data_nascimento,cpf,sexo,telefone,email,plano,carteirinha,status
Maria Silva,15/03/1990,123.456.789-00,Feminino,(11)99999-0001,maria@email.com,Unimed,123456789,Ativo
João Santos,22/07/1985,987.654.321-00,Masculino,(11)99999-0002,joao@email.com,Bradesco,987654321,Ativo
Ana Costa,10/12/2001,456.789.123-00,Feminino,(11)99999-0003,,Particular,,Ativo`,

      profissionais: `nome,especialidade,tipo_conselho,num_conselho,uf_conselho,cbo,telefone,email,cor_agenda,status
Dra. Carla Mendes,Fonoaudióloga,CRFa,12345,SP,223105,(11)98888-0001,carla@clinica.com,#6366f1,Ativo
Dr. Ricardo Lima,Psicólogo,CRP,67890,SP,251510,(11)98888-0002,ricardo@clinica.com,#10b981,Ativo`,

      agenda: `data,horario_inicio,horario_fim,paciente,profissional,plano,tipo_atendimento,status
30/03/2026,08:00,09:00,Maria Silva,Dra. Carla Mendes,Unimed,Sessão terapêutica,Agendado
30/03/2026,09:00,10:00,João Santos,Dr. Ricardo Lima,Bradesco,Avaliação / Anamnese,Confirmado`,

      evolucoes: `data,horario_inicio,horario_fim,paciente,profissional,presenca,evolucao,convenio
29/03/2026,08:00,09:00,Maria Silva,Dra. Carla Mendes,Presente,Paciente evoluiu bem na sessão.,Unimed
28/03/2026,09:00,10:00,João Santos,Dr. Ricardo Lima,Ausente,Faltou sem justificativa.,Bradesco`,

      planos: `nome,registro_ans,cnpj_operadora,status,telefone,email
Unimed Paulistana,123456,60.840.055/0001-31,Ativo,(11)3000-0001,contato@unimed.com.br
Bradesco Saúde,336077,92.693.118/0001-60,Ativo,(11)3000-0002,contato@bradesco.com.br`,

      procedimentos: `codigo_tuss,descricao,tipo,valor_particular,valor_plano_padrao,tabela_referencia,status
22.01.012.01-3,Avaliação fonoaudiológica,Consulta,350.00,280.00

