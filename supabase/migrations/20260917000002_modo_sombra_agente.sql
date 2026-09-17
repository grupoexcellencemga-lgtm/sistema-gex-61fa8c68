-- Escada de confiança do agente de IA. O dono quer um time comercial de IA mas
-- teme que não chegue no nível de um humano -- e hoje não há como saber sem
-- soltar em cima de cliente real. Os modos permitem medir antes de arriscar:
--
--   sombra   → escreve a resposta e NÃO envia. Risco zero. É o padrão.
--   teste    → envia de verdade, só para SLA_ALERTA_WHATSAPP (número do dono).
--   copiloto → deixa a resposta pronta para o humano enviar com um clique.
--   ativo    → comportamento original, fala com o cliente.
alter table public.agentes_bot
  add column if not exists modo text not null default 'sombra'
    check (modo in ('sombra', 'teste', 'copiloto', 'ativo'));

-- O que o agente teria respondido, para comparar depois com o que o humano
-- respondeu de fato.
create table if not exists public.respostas_sombra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  lead_id uuid not null,
  agente_id uuid,
  mensagem_entrada_id uuid,
  mensagem_entrada text,
  resposta_ia text not null,
  -- Ferramentas que o agente teria chamado. Em modo sombra elas são
  -- registradas, nunca executadas: mover_etapa e criar_tarefa alterariam
  -- dados reais e quebrariam a promessa de risco zero.
  ferramentas jsonb not null default '[]'::jsonb,
  modelo text,
  created_at timestamptz not null default now(),
  -- Preenchido na revisão pelo humano.
  avaliacao text check (avaliacao in ('boa', 'ruim')),
  avaliacao_nota text,
  avaliado_em timestamptz,
  avaliado_por uuid
);

create index if not exists idx_respostas_sombra_revisao
  on public.respostas_sombra (empresa_id, created_at desc)
  where avaliacao is null;

create index if not exists idx_respostas_sombra_lead
  on public.respostas_sombra (lead_id, created_at desc);

alter table public.respostas_sombra enable row level security;

create policy "autenticado le"
  on public.respostas_sombra for select to authenticated
  using (true);

create policy "autenticado avalia"
  on public.respostas_sombra for update to authenticated
  using (true) with check (true);
