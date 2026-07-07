# Schema — Operação de Eventos (Fase 1)

> Migração `fase1_checklist_eventos` aplicada em 06/07/2026 no projeto Supabase `nsxigkgfvbzhpxrpwvhw`.

## Colunas novas em tabelas existentes

### `tarefas`
| Coluna | Tipo | Descrição |
|---|---|---|
| `evento_id` | uuid FK → eventos, nullable | Vincula a tarefa a um evento (checklist) |
| `origem_tarefa` | text, default `'manual'` | `manual` \| `template` — `tarefas.tipo` já existia com outro sentido (lembrete/reuniao/outro) |
| `fase_evento` | text, nullable | `pre_evento` \| `dia_evento` \| `pos_evento` (copiado do item do template) |

### `eventos`
| Coluna | Tipo | Descrição |
|---|---|---|
| `status` | text, default `'planejado'` | planejado \| em_preparacao \| pronto \| em_execucao \| pos_evento \| finalizado \| cancelado |
| `checklist_template_id` | uuid, nullable | Template aplicado. **É a trava anti-duplicação**: o UPDATE condicional (`where checklist_template_id is null`) impede aplicar duas vezes |
| `checklist_template_versao` | integer, nullable | Versão do template no momento da aplicação (protege eventos antigos de edições futuras) |

## Tabelas novas

### `checklist_templates` — modelos de checklist por tipo de evento
`id, nome, tipo_evento (mesmos valores de eventos.tipo: palestra/workshop/jantar/caminhada...), versao (default 1), ativo, deleted_at, created_at`
RLS: leitura autenticada; escrita somente `admin`.

### `checklist_template_items` — tarefas do modelo
`id, template_id FK, nome_tarefa, fase (pre_evento|dia_evento|pos_evento), offset_valor, offset_unidade (minutos|horas|dias), prioridade, obrigatoria, deleted_at`
RLS: leitura autenticada; escrita somente `admin`.

### `evento_status_history` — timeline de status do evento
`id, evento_id FK, status_anterior, status_novo, alterado_por (nome), created_at`
RLS: leitura autenticada; insert gestor(admin/financeiro)+comercial.

### `evento_materiais` — checklist de itens físicos
`id, evento_id FK, nome, quantidade, separado (bool), deleted_at, created_at`
RLS: leitura autenticada; escrita gestor+comercial. Soft delete.

## Lógica central (`src/lib/checklistEvento.ts`)

- `calcularPrazoTarefa(dataEvento, fase, offsetValor, offsetUnidade)` — prazo = data do evento − offset (pré/dia) ou + offset (pós). Âncora 09:00 em America/Sao_Paulo (-03:00, sem horário de verão desde 2019). Offsets em `dias` não geram hora; `horas`/`minutos` geram. Testes em `src/test/checklistEvento.test.ts`.
- `aplicarChecklistNoEvento(evento, responsavelId)` — idempotente via trava em `eventos.checklist_template_id`; escolhe o template ativo de maior versão para `eventos.tipo`; tarefas nascem `status=pendente`, `origem_tarefa=template`, `responsavel_id` = usuário que criou/aplicou.

## Onde vive na UI

- **Evento → aba Operação** (`EventoDetailSheet.tsx`): Resumo (status do evento + cards + alerta de atraso + botão manual "Aplicar checklist" — backfill dos eventos pré-existentes), Checklist (Kanban @dnd-kit: pendente/concluída/cancelada), Equipe, Materiais, Notificações (placeholder Fase 2), Histórico.
- **Configurações → Checklists de Eventos** (`ChecklistTemplatesSection.tsx`): CRUD admin de modelos. Editar modelo já usado incrementa `versao` (eventos antigos não mudam).
- **Criação de evento** (`Eventos.tsx`): aplica o template automaticamente se existir modelo ativo para o tipo.

## Decisões tomadas (registro)

- Eventos recorrentes (Fase 1.5): **adiado** (conforme recomendação do documento).
- Backfill (decisão 8): **botão manual** "Aplicar checklist" no painel Operação.
- Kanban de Tarefas: **já usava @dnd-kit** (com TouchSensor/mobile) — regra 7 já estava atendida; o documento estava desatualizado nesse ponto.
