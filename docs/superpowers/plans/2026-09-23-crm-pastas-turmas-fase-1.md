# CRM por Produto e Turma — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizar os funis comerciais em pastas de produto, controlar qual turma recebe novos leads e criar automaticamente a oportunidade na turma ativa quando um fluxo associado começar.

**Architecture:** A camada de dados recebe `funil_pastas`, metadados de ciclo em `funil_quadros` e `pasta_funil_id` em `fluxos_bot`. A ativação exclusiva e a criação idempotente da oportunidade ficam em funções transacionais do Postgres; a interface React apenas apresenta e dispara essas operações. Funis antigos permanecem com `pasta_id = null` e aparecem em `Sem pasta`.

**Tech Stack:** React 18, TypeScript, TanStack Query, shadcn/ui, Vitest, Supabase Postgres/RLS e Supabase Edge Functions.

---

### Task 1: Regras puras de organização

**Files:**
- Create: `src/components/funil/funilFolders.ts`
- Test: `src/test/funilFolders.test.ts`

- [ ] Escrever testes que cubram busca por pasta e funil, favoritos, `Sem pasta`, ordem e seleção segura do primeiro funil visível.
- [ ] Executar `npm test -- --run src/test/funilFolders.test.ts` e confirmar falha por módulo ausente.
- [ ] Implementar os tipos `FunilPasta`, `FunilQuadroOrganizado`, `StatusCiclo` e as funções `buildFunnelNavigation` e `pickAvailableBoard`.
- [ ] Reexecutar o teste e confirmar aprovação.

### Task 2: Esquema, RLS e operações atômicas

**Files:**
- Create: `supabase/migrations/20260923000002_crm_pastas_turmas_fase_1.sql`

- [ ] Criar `funil_pastas` com `empresa_id`, nome, ordem, timestamps e exclusão lógica; habilitar RLS e políticas por vínculo em `user_empresa`.
- [ ] Adicionar a `funil_quadros` as colunas `pasta_id`, `status_ciclo`, `recebe_novos_leads`, `favorito` e `ordem_na_pasta`, com checks e índices.
- [ ] Adicionar `pasta_funil_id` a `fluxos_bot`.
- [ ] Criar índice único parcial que permita somente um quadro receptor por pasta.
- [ ] Criar RPC invoker `ativar_funil_recebedor(p_quadro_id)` que valida empresa/pasta, bloqueia os quadros da pasta, coloca o receptor anterior em `encerrando` e ativa o escolhido.
- [ ] Criar RPC invoker `garantir_oportunidade_funil_ativo(p_lead_id, p_pasta_id, p_empresa_id)` que resolve o quadro ativo e sua primeira etapa e usa `ON CONFLICT (lead_id, quadro_id)` para não duplicar o card.
- [ ] Aplicar a migração no Supabase, testar as duas RPCs dentro de transações revertidas e executar advisors de segurança e desempenho.

### Task 3: Barra lateral por produto e turma

**Files:**
- Create: `src/components/funil/FunilSidebar.tsx`
- Modify: `src/pages/Funil.tsx`
- Test: `src/test/FunilSidebar.test.tsx`

- [ ] Escrever teste de interface para pastas recolhíveis, busca, favoritos, `Sem pasta` e indicadores de estado.
- [ ] Implementar `FunilSidebar` com busca, atalhos favoritos, criação/renomeação de pasta e menus de funil.
- [ ] Adicionar queries e mutations de pastas em `Funil.tsx`, incluindo mover, favoritar, alterar estado e ativar como receptor.
- [ ] Fazer a criação de funil aceitar pasta e iniciar como `preparacao`; manter importação e etapas padrão atuais.
- [ ] Substituir a lista plana pela nova barra lateral sem alterar as áreas Conversas e Agentes.
- [ ] Executar os testes focados e revisar navegação por teclado e rótulos acessíveis.

### Task 4: Associação entre fluxo e produto

**Files:**
- Modify: `src/components/configuracoes/FluxoEditor.tsx`
- Test: `src/test/FluxoEditorFolder.test.tsx`

- [ ] Escrever teste que carrega, altera e salva `pasta_funil_id`.
- [ ] Consultar pastas da empresa no editor, mostrar o seletor `Produto do CRM` e preservar `null` para fluxos sem automação comercial.
- [ ] Incluir `pasta_funil_id` no carregamento e no payload de salvar.
- [ ] Executar o teste focado e o typecheck via build.

### Task 5: Roteamento ao iniciar um fluxo

**Files:**
- Modify: `supabase/functions/executar-fluxo/index.ts`
- Modify: `src/lib/whatsappFlowRuntime.ts`
- Test: `src/test/whatsappFlowRuntime.test.ts`

- [ ] Escrever teste para decidir quando uma oportunidade deve ser garantida: somente no início real de uma sessão associada a pasta.
- [ ] Incluir `pasta_funil_id` nas consultas de `fluxos_bot`.
- [ ] Depois de criar uma sessão nova, chamar `garantir_oportunidade_funil_ativo`; falha de roteamento deve ser registrada sem duplicar nem interromper a resposta do WhatsApp.
- [ ] Confirmar que retomadas da mesma sessão não criam outro card e que novo fluxo em turma nova cria outra oportunidade.
- [ ] Rodar os testes do runtime e checagem Deno da função.

### Task 6: Tipos, regressão e publicação

**Files:**
- Modify: `src/integrations/supabase/types.ts`
- Modify: `docs/superpowers/plans/2026-09-23-crm-pastas-turmas-fase-1.md`

- [ ] Gerar os tipos TypeScript a partir do projeto e atualizar o arquivo local.
- [ ] Executar `npm test -- --run`, `npm run build` e `npx eslint` somente nos arquivos alterados.
- [ ] Validar no banco: funis antigos em `Sem pasta`, exclusividade do receptor e criação idempotente do card.
- [ ] Fazer teste visual local em Oportunidades e no editor de fluxo.
- [ ] Marcar os itens concluídos, revisar o diff e criar commits pequenos por unidade funcional.
- [ ] Publicar a Edge Function, enviar a branch/commit para o GitHub, fazer deploy na Vercel e validar a URL de produção.

## Self-review

- Cobertura da especificação: pastas, busca, favoritos, `Sem pasta`, estados, receptor exclusivo, associação e roteamento estão cobertos; regras comerciais, alertas e handoff permanecem nas fases 2–4 aprovadas.
- Compatibilidade: nenhuma linha existente é movida; novos campos têm defaults seguros e associação é opcional.
- Segurança: a tabela nova usa RLS por empresa; RPCs são `SECURITY INVOKER`; a Edge Function usa service role já existente.
- Idempotência: o índice existente `(lead_id, quadro_id)` é reutilizado com conflito tratado.
