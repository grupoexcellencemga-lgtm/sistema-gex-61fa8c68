-- Módulo Consórcio — Fase 1: Pipeline + Leads
-- Executar no Supabase (dashboard > SQL Editor) antes de subir o código.

-- ─── Leads de Consórcio ───────────────────────────────────────────────────────

create table if not exists public.consorcios_leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text,
  email         text,
  cpf_cnpj      text,
  segmento      text not null default 'imoveis'
                  check (segmento in ('imoveis', 'veiculos', 'servicos')),
  valor_credito numeric(14, 2),
  prazo         integer,  -- prazo desejado em meses
  origem        text check (origem in ('whatsapp', 'facebook', 'indicacao', 'site', 'ligacao', 'outro')),
  indicado_por  text,
  etapa         text not null default 'novo_lead',
  responsavel_id uuid references public.comerciais(id) on delete set null,
  observacoes   text,
  cidade        text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── Interações / Histórico de Contato ────────────────────────────────────────

create table if not exists public.consorcios_interacoes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.consorcios_leads(id) on delete cascade,
  tipo       text not null check (tipo in ('ligacao', 'whatsapp', 'email', 'reuniao', 'visita', 'nota')),
  descricao  text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

create index if not exists idx_consorcios_leads_etapa
  on public.consorcios_leads (etapa) where deleted_at is null;

create index if not exists idx_consorcios_leads_responsavel
  on public.consorcios_leads (responsavel_id) where deleted_at is null;

create index if not exists idx_consorcios_leads_segmento
  on public.consorcios_leads (segmento) where deleted_at is null;

create index if not exists idx_consorcios_leads_created
  on public.consorcios_leads (created_at desc) where deleted_at is null;

create index if not exists idx_consorcios_interacoes_lead
  on public.consorcios_interacoes (lead_id, created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.consorcios_leads enable row level security;
alter table public.consorcios_interacoes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'consorcios_leads' and policyname = 'consorcios_leads_auth'
  ) then
    create policy "consorcios_leads_auth" on public.consorcios_leads
      for all using (auth.uid() is not null);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'consorcios_interacoes' and policyname = 'consorcios_interacoes_auth'
  ) then
    create policy "consorcios_interacoes_auth" on public.consorcios_interacoes
      for all using (auth.uid() is not null);
  end if;
end $$;
