/**
 * ClinicFlow — Security Patch
 * ===========================
 * Arquivo de segurança não-destrutivo que sobrescreve funções via override.
 * Carregado APÓS supabase_patch.js (ver index.html).
 *
 * Inclui:
 *  1. Sanitização HTML (escHtml) — prevenção XSS
 *  2. Content Security Policy (CSP) — injetada via <meta>
 *  3. Rate Limiting no login — máx 5 tentativas / 5 minutos
 *  4. Override de doLogin — com suporte a bcrypt + migração incremental
 *  5. Override de doLogout — limpa dados sensíveis da memória RAM
 *  6. Override de _upsertUsuarioSupabase — salva senhas com hash
 *  7. Log de auditoria — registra logins e ações no Supabase
 *
 * Versão: 1.0.0 | 2026-06-20
 */

(function () {
  'use strict';

  // ── Utilidade: acessa bcryptjs (UMD global) ──────────────────────────────
  // O bcryptjs expõe via window.dcodeIO.bcrypt no build UMD para browser
  function _getBcrypt() {
    if (typeof window.dcodeIO !== 'undefined' && window.dcodeIO.bcrypt) {
      return window.dcodeIO.bcrypt;
    }
    if (typeof window.bcrypt !== 'undefined') {
      return window.bcrypt;
    }
    return null;
  }

  // ── Utilitário: acessa o cliente Supabase ────────────────────────────────
  function _getSb() {
    return window._cfGetDb ? window._cfGetDb() : null;
  }

  // =========================================================================
  // 1. SANITIZAÇÃO HTML — Prevenção de XSS
  // =========================================================================
  window.escHtml = function (str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  };

  // =========================================================================
  // 2. CONTENT SECURITY POLICY
  //    A CSP via <meta> tem limitações (não suporta frame-ancestors, é aplicada
  //    APÓS o carregamento inicial). Em produção, o nginx.conf envia os headers
  //    HTTP corretos com o domínio customizado do Supabase.
  //
  //    Aqui aplicamos uma CSP de "melhor esforço" via <meta> para ajudar em
  //    ambientes sem nginx (ex: desenvolvimento local):
  //    - Se a URL do Supabase JÁ estiver no localStorage → CSP restritiva
  //    - Se ainda NÃO estiver (1ª config, novo browser) → CSP permissiva para
  //      não bloquear a tela de configuração
  // =========================================================================
  (function injectCSP() {
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) return;

    // Lê URL do Supabase salva no localStorage (pode ser domínio customizado)
    const supaUrl = localStorage.getItem('cf_supa_url') || '';
    let supaOrigin = '';
    let supaWss    = '';

    if (supaUrl) {
      try {
        const parsed = new URL(supaUrl);
        supaOrigin = parsed.origin;          // ex: https://supabase.erpclinicflow.cloud
        supaWss    = 'wss://' + parsed.hostname; // ex: wss://supabase.erpclinicflow.cloud
      } catch (_) {}
    }

    // Estratégia de connect-src:
    //  - Com URL configurada → restringe ao domínio específico do Supabase
    //  - Sem URL (1ª vez / browser novo) → permite https://* para não bloquear config
    const connectSrc = supaOrigin
      ? [
          "'self'",
          'https://*.supabase.co', 'wss://*.supabase.co',  // Supabase cloud padrão
          'https://cdn.jsdelivr.net',                        // jsdelivr (source maps)
          supaOrigin, supaWss                                // domínio customizado
        ].filter(Boolean).join(' ')
      : "'self' https: wss:";  // Permissivo: Supabase ainda não configurado

    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src https://fonts.gstatic.com data:",
      'connect-src ' + connectSrc,
      "img-src 'self' data: blob: https:",
      "base-uri 'self'"
      // frame-ancestors: ignorado em <meta> — aplicado pelo nginx.conf via header HTTP
    ].join('; ');

    document.head.prepend(meta);

    if (supaOrigin) {
      console.log('[CF Security] CSP aplicada (restritiva). Supabase:', supaOrigin);
    } else {
      console.log('[CF Security] CSP aplicada (permissiva — Supabase ainda não configurado).');
      console.log('[CF Security] Após configurar o Supabase, recarregue a página para ativar CSP restritiva.');
    }
  })();

  // =========================================================================
  // 3. RATE LIMITING — Proteção contra brute force
  // =========================================================================
  const _CF_MAX_TENTATIVAS = 5;
  const _CF_LOCKOUT_MS     = 5 * 60 * 1000; // 5 minutos
  const _loginAttempts     = {};

  function _getAttempts(email) {
    const now = Date.now();
    if (!_loginAttempts[email]) {
      _loginAttempts[email] = { count: 0, resetAt: now + _CF_LOCKOUT_MS };
    }
    const att = _loginAttempts[email];
    // Reseta contador se o período expirou
    if (now > att.resetAt) {
      att.count  = 0;
      att.resetAt = now + _CF_LOCKOUT_MS;
    }
    return att;
  }

  function _incrementAttempt(email) {
    const att = _getAttempts(email);
    att.count++;
    return att;
  }

  function _resetAttempts(email) {
    delete _loginAttempts[email];
  }

  function _isBloqueado(email) {
    const att = _getAttempts(email);
    return att.count >= _CF_MAX_TENTATIVAS;
  }

  function _minutosRestantes(email) {
    const att = _getAttempts(email);
    return Math.max(1, Math.ceil((att.resetAt - Date.now()) / 60000));
  }

  // =========================================================================
  // 4. VERIFICAÇÃO DE SENHA COM BCRYPT + MIGRAÇÃO INCREMENTAL
  //    Detecta se a senha armazenada é um hash bcrypt ($2b$ / $2a$)
  //    ou texto puro. Se for texto puro e o login for bem-sucedido,
  //    migra automaticamente para hash naquele mesmo login.
  // =========================================================================
  async function _verificarSenha(usuario, senhaInput, sb) {
    const senhaArmazenada = (usuario.senha || '').trim();
    const bcryptLib       = _getBcrypt();

    // Detecta hash bcrypt pela assinatura do campo
    const ehHash = senhaArmazenada.startsWith('$2b$') || senhaArmazenada.startsWith('$2a$');

    if (ehHash && bcryptLib) {
      // Senha já está hasheada — verificar com bcrypt
      try {
        return await bcryptLib.compare(senhaInput, senhaArmazenada);
      } catch (e) {
        console.error('[CF Security] Erro ao verificar bcrypt:', e.message);
        return false;
      }
    }

    // Senha em texto puro — comparação direta
    if (!senhaArmazenada || senhaArmazenada !== senhaInput) return false;

    // ── Migração automática: gera hash e salva no banco ───────────────────
    if (bcryptLib && sb) {
      try {
        const novoHash = await bcryptLib.hash(senhaInput, 12);
        await sb.from('usuarios')
          .update({ senha: novoHash, ultimo_acesso: new Date().toISOString() })
          .eq('id', usuario.id);
        console.log('[CF Security] ✓ Senha migrada para hash — usuário ID:', usuario.id);
      } catch (e) {
        // Falha na migração não bloqueia o login
        console.warn('[CF Security] Falha na migração de hash (não crítico):', e.message);
      }
    }
    return true;
  }

  // =========================================================================
  // 5. AUDIT LOG — Registra ações no Supabase
  // =========================================================================
  async function _audit(operacao, tabela, registroId, dadosAntes, dadosDepois) {
    try {
      const sb = _getSb();
      if (!sb) return;
      const usuario = window.currentUser || window.CURRENT_USER;
      await sb.from('audit_log').insert([{
        operacao,
        tabela,
        registro_id:   registroId ? String(registroId) : null,
        usuario_id:    usuario?.id    ? String(usuario.id)    : null,
        usuario_email: usuario?.email || null,
        dados_antes:   dadosAntes  || null,
        dados_depois:  dadosDepois || null,
        created_at:    new Date().toISOString()
      }]);
    } catch (e) {
      // Nunca bloqueia a operação principal se o audit falhar
    }
  }

  // =========================================================================
  // 6. OVERRIDE: doLogin — com Supabase Auth + rate limiting + audit
  // =========================================================================
  window.doLogin = async function () {
    const emailInput = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
    const senhaInput = (document.getElementById('login-pass')?.value  || '');
    const errEl      = document.getElementById('login-error');
    const btnEl      = document.getElementById('btn-login');

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }

    // Validação básica
    if (!emailInput || !senhaInput) {
      if (errEl) { errEl.textContent = '⚠ Preencha o e-mail e a senha.'; errEl.style.display = 'block'; }
      return;
    }

    // ── Verificação de rate limit ────────────────────────────────────────
    if (_isBloqueado(emailInput)) {
      const mins = _minutosRestantes(emailInput);
      if (errEl) {
        errEl.textContent = '⛔ Muitas tentativas incorretas. Aguarde ' + mins + ' minuto(s) e tente novamente.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Verificando...'; }

    const cfgUrl = localStorage.getItem('cf_supa_url') || '';
    const cfgKey = localStorage.getItem('cf_supa_key') || '';

    // ── Autenticação via Supabase ──────────────────────────────────────────
    if (cfgUrl && cfgKey && window.supabase) {
      try {
        const _sbLogin = window.__cfSb
          || (window._cfGetOrCreateClient
              ? window._cfGetOrCreateClient(cfgUrl, cfgKey)
              : window.supabase.createClient(cfgUrl, cfgKey));

        // 1. Autenticação nativa no Supabase Auth
        const { data: authData, error: authError } = await _sbLogin.auth.signInWithPassword({
          email: emailInput,
          password: senhaInput
        });

        if (authError) {
          _incrementAttempt(emailInput);
          const att = _getAttempts(emailInput);
          const restantes = Math.max(0, _CF_MAX_TENTATIVAS - att.count);
          if (errEl) {
            errEl.textContent = restantes > 0
              ? '✗ Credenciais inválidas. ' + restantes + ' tentativa(s) restante(s).'
              : '⛔ Conta bloqueada por ' + _minutosRestantes(emailInput) + ' minuto(s) por excesso de tentativas.';
            errEl.style.display = 'block';
          }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
          return;
        }

        // 2. Login autenticado com sucesso -> busca perfil do usuário na tabela usuarios
        const { data: rows, error: dbError } = await _sbLogin
          .from('usuarios')
          .select('*')
          .eq('email', emailInput)
          .limit(1);

        if (dbError) throw dbError;

        const usuario = rows && rows[0];

        if (!usuario) {
          if (errEl) { errEl.textContent = '✗ Perfil de usuário não encontrado no sistema. Contate o administrador.'; errEl.style.display = 'block'; }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
          await _sbLogin.auth.signOut();
          return;
        }

        if ((usuario.status || 'Ativo') !== 'Ativo') {
          if (errEl) { errEl.textContent = '✗ Usuário inativo. Contate o administrador.'; errEl.style.display = 'block'; }
          if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
          await _sbLogin.auth.signOut();
          return;
        }

        // ── Login bem-sucedido ─────────────────────────────────────────────
        _resetAttempts(emailInput);

        // Atualiza ultimo_acesso (silencioso)
        try {
          await _sbLogin.from('usuarios')
            .update({ ultimo_acesso: new Date().toISOString(), tentativas_login: 0 })
            .eq('id', usuario.id);
        } catch (_) {}

        // Registra login no audit log
        _audit('LOGIN', 'usuarios', usuario.id, null, { email: emailInput, perfil: usuario.perfil });

        // Normaliza perfil
        const _perfilRaw = (usuario.perfil || '').toLowerCase().trim();
        const _roleNorm  = _perfilRaw === 'admin' || _perfilRaw === 'administrador' ? 'admin'
                         : _perfilRaw === 'recepcao' || _perfilRaw === 'recepção'   ? 'recepcao'
                         : _perfilRaw === 'prof'     || _perfilRaw === 'profissional' ? 'prof'
                         : _perfilRaw || 'recepcao';

        _finalizarLogin({
          nome:     usuario.nome     || emailInput,
          role:     _roleNorm,
          initials: (usuario.nome || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
          foto:     usuario.foto     || '',
          id:       usuario.id,
          perfilId: usuario.perfil_id || usuario.perfilId || null,
        });
        return;

      } catch (err) {
        console.error('[CF Security] Erro Supabase login:', err);
        if (errEl) { errEl.textContent = '✗ Erro ao conectar ao servidor. Verifique a conexão.'; errEl.style.display = 'block'; }
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
        return;
      }
    }

    // ── Fallback: sem Supabase — apenas usuário admin local ───────────────
    const usuarioLocal = (typeof USUARIOS !== 'undefined' ? USUARIOS : [])
      .find(u => u.email && u.email.toLowerCase() === emailInput && u.perfil === 'admin');

    if (usuarioLocal) {
      const senhaLocal = (usuarioLocal.senha || '').trim();
      if (!senhaLocal || senhaLocal !== senhaInput) {
        _incrementAttempt(emailInput);
        if (errEl) { errEl.textContent = '✗ Senha incorreta.'; errEl.style.display = 'block'; }
        if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
        return;
      }
      _resetAttempts(emailInput);
      _finalizarLogin({
        nome:     usuarioLocal.nome || 'Administrador',
        role:     'admin',
        initials: (usuarioLocal.nome || 'AD').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
        foto:     usuarioLocal.foto || '',
        id:       usuarioLocal.id,
      });
      window.showToast && showToast('⚠ Supabase não configurado. Configure em Configurações > Supabase.', 'warning');
      return;
    }

    if (errEl) { errEl.textContent = '✗ Acesso negado. Configure o Supabase ou use as credenciais de administrador.'; errEl.style.display = 'block'; }
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Entrar'; }
  };

  // =========================================================================
  // 7. OVERRIDE: doLogout — limpa dados sensíveis da memória RAM e desloga do Supabase
  // =========================================================================
  const _origDoLogout = window.doLogout;
  window.doLogout = async function () {
    // Registra logout no audit log (antes de limpar currentUser)
    _audit('LOGOUT', 'usuarios', window.currentUser?.id, null, { email: window.currentUser?.nome });

    // Desconecta do Supabase Auth
    try {
      const sb = _getSb();
      if (sb) await sb.auth.signOut();
    } catch (_) {}

    // Zera todos os arrays com dados sensíveis da clínica
    const _sensíveis = [
      'PACIENTES', 'PROFISSIONAIS', 'HISTORICO', 'APPOINTMENTS',
      'GUIAS', 'LOTES', 'SENHAS_PLANO', 'LISTA_ESPERA',
      'PLANOS', 'PROCEDIMENTOS', 'BLOQUEIOS', 'LISTA_ESPERA'
    ];
    _sensíveis.forEach(function (name) {
      if (typeof window[name] !== 'undefined' && Array.isArray(window[name])) {
        window[name].length = 0;
      }
    });

    // Limpa usuário da memória
    window.currentUser  = null;
    window.CURRENT_USER = null;

    // Chama o logout original (esconde UI, restaura menu, etc.)
    if (_origDoLogout) _origDoLogout.apply(this, arguments);
  };

  // =========================================================================
  // 7.1. AUTO-LOGIN — Recupera sessão ativa no Supabase ao recarregar a página
  // =========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
      const sb = _getSb();
      if (!sb) return;
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (session && session.user) {
          console.log('[CF Security] Sessão ativa encontrada para:', session.user.email);
          const { data: rows } = await sb.from('usuarios')
            .select('*')
            .eq('email', session.user.email)
            .limit(1);
          const usuario = rows && rows[0];
          if (usuario && usuario.status === 'Ativo') {
            const _perfilRaw = (usuario.perfil || '').toLowerCase().trim();
            const _roleNorm  = _perfilRaw === 'admin' || _perfilRaw === 'administrador' ? 'admin'
                             : _perfilRaw === 'recepcao' || _perfilRaw === 'recepção'   ? 'recepcao'
                             : _perfilRaw === 'prof'     || _perfilRaw === 'profissional' ? 'prof'
                             : _perfilRaw || 'recepcao';
            _finalizarLogin({
              nome:     usuario.nome     || session.user.email,
              role:     _roleNorm,
              initials: (usuario.nome || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(),
              foto:     usuario.foto     || '',
              id:       usuario.id,
              perfilId: usuario.perfil_id || usuario.perfilId || null,
            });
            // Recarrega do banco de dados do Supabase
            if (typeof window.loadFromSupabase === 'function') {
              window.loadFromSupabase();
            }
          }
        }
      } catch (e) {
        console.warn('[CF Security] Erro ao restaurar sessão:', e.message);
      }
    }, 1200);
  });

  // =========================================================================
  // 8. OVERRIDE: _upsertUsuarioSupabase — salva senha com hash para novos usuários
  //    Quando bcryptjs estiver disponível, a senha é hasheada antes de ir ao banco.
  //    Se bcryptjs não estiver carregado, comportamento original é mantido.
  // =========================================================================
  const _origUpsert = window._upsertUsuarioSupabase;
  window._upsertUsuarioSupabase = async function (u) {
    const bcryptLib = _getBcrypt();

    if (bcryptLib && u.senha) {
      const senhaArmazenada = (u.senha || '').trim();
      const jaEhHash = senhaArmazenada.startsWith('$2b$') || senhaArmazenada.startsWith('$2a$');

      if (!jaEhHash && senhaArmazenada.length > 0) {
        try {
          const novoHash = await bcryptLib.hash(senhaArmazenada, 12);
          // Cria cópia para não modificar o objeto original em memória
          u = Object.assign({}, u, { senha: novoHash });
          console.log('[CF Security] ✓ Senha hasheada para novo usuário:', u.email);
        } catch (e) {
          console.warn('[CF Security] Falha ao hashear nova senha:', e.message);
          // Continua com senha original se hash falhar
        }
      }
    }

    // Chama a função original com a senha (possivelmente hasheada)
    if (_origUpsert) return _origUpsert.call(this, u);
  };

  // =========================================================================
  // 9. MÁSCARAS E VALIDAÇÕES GLOBAIS (CPF/CNPJ)
  // =========================================================================
  window.maskCNPJ = function (el) {
    let v = el.value.replace(/\D/g, '').slice(0, 14);
    if (v.length > 12) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
    else if (v.length > 8) v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
    else if (v.length > 5) v = v.replace(/(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,3})/, '$1.$2');
    el.value = v;
  };

  window.validarCPF = function (cpf) {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
  };

  window.validarCNPJ = function (cnpj) {
    cnpj = String(cnpj || '').replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    return true;
  };

  // =========================================================================
  // Inicialização concluída
  // =========================================================================
  console.log('[CF Security] Patch de segurança carregado ✓ (v1.0.0)');
  console.log('[CF Security] bcryptjs disponível:', !!_getBcrypt());

})();
