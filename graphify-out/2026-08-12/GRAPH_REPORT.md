# Graph Report - ClinicFlow  (2026-08-12)

## Corpus Check
- 64 files · ~221,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 361 nodes · 798 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1ac939e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- types/index.ts
- clinicflow-import-fixes.js
- clinicflow-fixes.js
- compilerOptions
- compilerOptions
- Design System Master File
- LotesTiss.tsx
- devDependencies
- package.json
- security_patch.js
- Espera.tsx
- FinanceiroNfse.tsx
- Conecta.tsx
- Importador.tsx
- emitir-nfse-jundiai/index.ts
- React + TypeScript + Vite
- supabase_patch.js
- tsconfig.json
- dev-server.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 49 edges
2. `supabase` - 27 edges
3. `mappers` - 24 edges
4. `compilerOptions` - 17 edges
5. `compilerOptions` - 16 edges
6. `AppContextType` - 13 edges
7. `Paciente` - 11 edges
8. `norm()` - 11 edges
9. `bindEventosImportacao()` - 11 edges
10. `campo()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Espera()` --calls--> `useApp()`  [EXTRACTED]
  clinicflow-app/src/pages/Espera.tsx → clinicflow-app/src/context/AppContext.tsx
- `LotesTiss()` --calls--> `useApp()`  [EXTRACTED]
  clinicflow-app/src/pages/LotesTiss.tsx → clinicflow-app/src/context/AppContext.tsx
- `AgendaRecepcao()` --references--> `Paciente`  [EXTRACTED]
  clinicflow-app/src/pages/AgendaRecepcao.tsx → clinicflow-app/src/types/index.ts
- `GroupedPatient` --references--> `Agendamento`  [EXTRACTED]
  clinicflow-app/src/pages/AnaliseFechamento.tsx → clinicflow-app/src/types/index.ts
- `Espera()` --references--> `ListaEspera`  [EXTRACTED]
  clinicflow-app/src/pages/Espera.tsx → clinicflow-app/src/types/index.ts

## Import Cycles
- None detected.

## Communities (25 total, 3 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.08
Nodes (39): App(), Layout(), LayoutProps, ThemeItemProps, ThemeSelector(), useApp(), THEME_OPTIONS, ThemeContext (+31 more)

### Community 1 - "types/index.ts"
Cohesion: 0.14
Nodes (33): AppContext, AppContextType, AppProvider(), safeSaveCache(), GroupedPatient, Mensagem, FechamentoProps, parseBoldText() (+25 more)

### Community 2 - "clinicflow-import-fixes.js"
Cohesion: 0.14
Nodes (37): atualizarProgressoUI(), atualizarTituloImportacao(), avancarStep(), bindEventosImportacao(), campo(), CARD_MAP, cleanDoc(), cleanFone() (+29 more)

### Community 3 - "clinicflow-fixes.js"
Cohesion: 0.19
Nodes (27): atualizarQtdUsada(), bindEventos(), bindFiltrosGuias(), calcularTotalGuia(), carregarDashboardExtras(), carregarGuiasSADT(), coletarDadosAgendamento(), coletarDadosGuia() (+19 more)

### Community 4 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 6 - "Design System Master File"
Cohesion: 0.12
Nodes (16): Additional Forbidden Patterns, Anti-Patterns (Do NOT Use), Buttons, Cards, Color Palette, Component Specs, Design System Master File, Global Rules (+8 more)

### Community 7 - "LotesTiss.tsx"
Cohesion: 0.20
Nodes (14): IBGE_UF, LotesTiss(), normalizeCompetencia(), removeAccentsAndSpecial(), TISS_CONSELHOS, tissCodigoConselho(), tissCodigoUF(), tissHashMD5() (+6 more)

### Community 8 - "devDependencies"
Cohesion: 0.06
Nodes (33): autoprefixer, devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+25 more)

### Community 9 - "package.json"
Cohesion: 0.11
Nodes (18): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, name, private, scripts (+10 more)

### Community 10 - "security_patch.js"
Cohesion: 0.31
Nodes (8): _audit(), _getAttempts(), _getBcrypt(), _getSb(), _incrementAttempt(), _isBloqueado(), _minutosRestantes(), _verificarSenha()

### Community 11 - "Espera.tsx"
Cohesion: 0.33
Nodes (6): DIAS_OPCOES, ESPECIALIDADES_OPCOES, Espera(), HORARIOS_ESPECIFICOS_OPCOES, parsePreferencesFromText(), POSICOES_AGENDA_OPCOES

### Community 12 - "FinanceiroNfse.tsx"
Cohesion: 0.36
Nodes (5): defaultConfigFiscal, nfseJundiaiService, XmlParseResult, ConfiguracaoFiscalJundiai, NotaFiscalJundiai

### Community 13 - "Conecta.tsx"
Cohesion: 0.29
Nodes (6): Conecta(), ConectaProps, FechamentoConecta, Locatario, ReservaSala, SalaConecta

### Community 14 - "Importador.tsx"
Cohesion: 0.40
Nodes (4): FieldDefinition, Importador(), ImportadorProps, ImportSchema

### Community 16 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 17 - "supabase_patch.js"
Cohesion: 0.83
Nodes (3): getDb(), loadFromSupabase(), salvarConfigNoDB()

## Knowledge Gaps
- **109 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useApp()` connect `App.tsx` to `types/index.ts`, `Espera.tsx`, `FinanceiroNfse.tsx`, `LotesTiss.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07673469387755102 - nodes in this community are weakly interconnected._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14465408805031446 - nodes in this community are weakly interconnected._
- **Should `clinicflow-import-fixes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13940256045519203 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._