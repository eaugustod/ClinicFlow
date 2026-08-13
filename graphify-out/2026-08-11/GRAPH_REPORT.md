# Graph Report - ClinicFlow  (2026-08-11)

## Corpus Check
- 63 files · ~214,767 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 359 nodes · 779 edges · 35 communities (22 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bc5f8b28`
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
- dependencies
- FinanceiroNfse.tsx
- Conecta.tsx
- Importador.tsx
- emitir-nfse-jundiai/index.ts
- React + TypeScript + Vite
- supabase_patch.js
- tsconfig.json
- eslint
- @eslint/js
- eslint-plugin-react-refresh
- globals
- tailwindcss
- @tailwindcss/postcss
- typescript
- typescript-eslint
- vite
- @vitejs/plugin-react
- dev-server.sh

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 47 edges
2. `supabase` - 26 edges
3. `mappers` - 23 edges
4. `compilerOptions` - 17 edges
5. `compilerOptions` - 16 edges
6. `AppContextType` - 13 edges
7. `norm()` - 11 edges
8. `bindEventosImportacao()` - 11 edges
9. `campo()` - 10 edges
10. `Paciente` - 9 edges

## Surprising Connections (you probably didn't know these)
- `LotesTiss()` --calls--> `useApp()`  [EXTRACTED]
  clinicflow-app/src/pages/LotesTiss.tsx → clinicflow-app/src/context/AppContext.tsx
- `GroupedPatient` --references--> `Agendamento`  [EXTRACTED]
  clinicflow-app/src/pages/AnaliseFechamento.tsx → clinicflow-app/src/types/index.ts
- `Espera()` --references--> `ListaEspera`  [EXTRACTED]
  clinicflow-app/src/pages/Espera.tsx → clinicflow-app/src/types/index.ts
- `XmlParseResult` --references--> `NotaFiscalJundiai`  [EXTRACTED]
  clinicflow-app/src/services/xmlNfseParser.ts → clinicflow-app/src/types/index.ts
- `App()` --calls--> `useApp()`  [EXTRACTED]
  clinicflow-app/src/App.tsx → clinicflow-app/src/context/AppContext.tsx

## Import Cycles
- None detected.

## Communities (35 total, 13 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.07
Nodes (44): App(), Layout(), LayoutProps, ThemeItemProps, ThemeSelector(), useApp(), THEME_OPTIONS, ThemeContext (+36 more)

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
Cohesion: 0.15
Nodes (13): autoprefixer, devDependencies, autoprefixer, eslint-plugin-react-hooks, postcss, @types/node, @types/react, @types/react-dom (+5 more)

### Community 9 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, lint, preview, type (+1 more)

### Community 10 - "security_patch.js"
Cohesion: 0.31
Nodes (8): _audit(), _getAttempts(), _getBcrypt(), _getSb(), _incrementAttempt(), _isBloqueado(), _minutosRestantes(), _verificarSenha()

### Community 11 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react, react, react-dom, @supabase/supabase-js, lucide-react, react, react-dom (+1 more)

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
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useApp()` connect `App.tsx` to `types/index.ts`, `FinanceiroNfse.tsx`, `LotesTiss.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `package.json`, `eslint`, `@eslint/js`, `eslint-plugin-react-refresh`, `globals`, `tailwindcss`, `@tailwindcss/postcss`, `typescript`, `typescript-eslint`, `vite`, `@vitejs/plugin-react`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06623376623376623 - nodes in this community are weakly interconnected._
- **Should `types/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14296081277213352 - nodes in this community are weakly interconnected._
- **Should `clinicflow-import-fixes.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13940256045519203 - nodes in this community are weakly interconnected._