create table if not exists canais_crm (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('whatsapp', 'instagram')),
  nome text not null,
  identificador text not null,
  evolution_url text,
  evolution_token text,
  evolution_instancia text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table canais_crm enable row level security;

create policy "empresa members can manage canais_crm"
  on canais_crm for all
  using (
    empresa_id in (
      select empresa_id from empresa_usuarios where user_id = auth.uid()
    )
  );
