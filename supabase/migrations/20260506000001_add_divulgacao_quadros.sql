-- Cria a estrutura de Quadros de Divulgação
-- Rode este SQL no Supabase antes de trocar os arquivos do código.

create table if not exists public.divulgacao_quadros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer default 0,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.divulgacao_colunas
  add column if not exists quadro_id uuid null references public.divulgacao_quadros(id) on delete set null;

alter table public.divulgacoes
  add column if not exists quadro_id uuid null references public.divulgacao_quadros(id) on delete set null;

create index if not exists idx_divulgacao_quadros_deleted_ordem
  on public.divulgacao_quadros (deleted_at, ordem, created_at);

create index if not exists idx_divulgacao_colunas_quadro_id
  on public.divulgacao_colunas (quadro_id, ordem);

create index if not exists idx_divulgacoes_quadro_id
  on public.divulgacoes (quadro_id, coluna_id, ordem);

-- Garante um quadro inicial para tudo que já existe hoje.
insert into public.divulgacao_quadros (nome, ordem)
select 'Geral', 0
where not exists (
  select 1 from public.divulgacao_quadros where nome = 'Geral' and deleted_at is null
);

-- Vincula as colunas antigas ao quadro Geral.
update public.divulgacao_colunas
set quadro_id = (
  select id from public.divulgacao_quadros
  where nome = 'Geral' and deleted_at is null
  order by created_at asc
  limit 1
)
where quadro_id is null;

-- Vincula os cards antigos ao quadro da própria coluna.
update public.divulgacoes d
set quadro_id = c.quadro_id
from public.divulgacao_colunas c
where d.coluna_id = c.id
  and d.quadro_id is null
  and c.quadro_id is not null;

-- Caso exista algum card sem coluna, joga para o quadro Geral.
update public.divulgacoes
set quadro_id = (
  select id from public.divulgacao_quadros
  where nome = 'Geral' and deleted_at is null
  order by created_at asc
  limit 1
)
where quadro_id is null;
