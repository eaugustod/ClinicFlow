#!/bin/bash
# ============================================================
# ClinicFlow — Servidor de Desenvolvimento Local
# Uso: bash dev-server.sh
# ============================================================
# Serve os arquivos do ClinicFlow em http://localhost:8080
# com hot-reload via polling (recarregue o browser manualmente
# após edições).
# ============================================================

PORT=8080
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║        ClinicFlow — Dev Server Local           ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║  Endereço : http://localhost:${PORT}              ║"
echo "║  Pasta    : ${DIR}"
echo "║  Parar    : Ctrl+C                             ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "  ⚡ Conectado ao Supabase de PRODUÇÃO"
echo "  ⚡ Credenciais lidas do localStorage do browser"
echo ""
echo "  CHECKLIST DE TESTES:"
echo "  [ ] 1. Login normal funciona"
echo "  [ ] 2. Rate limit: 5x senha errada → mensagem de bloqueio"
echo "  [ ] 3. Logout: window.PACIENTES.length === 0 no console"
echo "  [ ] 4. Console mostra: [CF Security] Patch carregado ✓"
echo "  [ ] 5. Console mostra: [CF Security] bcryptjs disponível: true"
echo "  [ ] 6. Após login, verificar no Supabase se senha virou hash (\$2b\$)"
echo ""

cd "$DIR"
python3 -m http.server $PORT --bind 127.0.0.1
