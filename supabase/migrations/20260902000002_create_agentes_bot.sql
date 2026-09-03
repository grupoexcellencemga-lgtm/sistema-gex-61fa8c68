-- Tabela de agentes IA/BOT para atendimento automático via WhatsApp
create table if not exists agentes_bot (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  instrucao text not null default '',
  modelo text not null default 'claude-haiku-4-5-20251001',
  ativo boolean not null default true,
  ativo_24h boolean not null default false,
  horario_inicio time not null default '08:00',
  horario_fim time not null default '18:00',
  dias_semana int[] not null default '{1,2,3,4,5}',
  tempo_espera_minutos int not null default 5,
  canais_ids uuid[] not null default '{}',
  max_mensagens_contexto int not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agentes_bot enable row level security;

create policy "agentes_bot_empresa_members"
  on agentes_bot
  using (
    empresa_id in (
      select empresa_id from user_empresa where user_id = auth.uid()
    )
  );

create index agentes_bot_empresa_idx on agentes_bot(empresa_id);
