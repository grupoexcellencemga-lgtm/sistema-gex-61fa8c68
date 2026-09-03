create table if not exists fluxo_sessoes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  fluxo_id uuid not null references fluxos_bot(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  current_node_id text not null,
  status text not null default 'active' check (status in ('active', 'waiting', 'completed')),
  contexto jsonb not null default '{}',
  wait_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fluxo_sessoes_lead_idx on fluxo_sessoes(lead_id);
create index fluxo_sessoes_empresa_idx on fluxo_sessoes(empresa_id);
create index fluxo_sessoes_status_idx on fluxo_sessoes(lead_id, status);

alter table fluxo_sessoes enable row level security;

create policy "fluxo_sessoes_empresa_members"
  on fluxo_sessoes
  using (
    empresa_id in (
      select empresa_id from user_empresa where user_id = auth.uid()
    )
  );
