create table if not exists chaves_pix (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  descricao   text not null,
  chave       text not null,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

alter table chaves_pix enable row level security;

create policy "empresa_select" on chaves_pix
  for select using (empresa_id = (select empresa_id from perfis where id = auth.uid() limit 1));

create policy "empresa_insert" on chaves_pix
  for insert with check (empresa_id = (select empresa_id from perfis where id = auth.uid() limit 1));

create policy "empresa_update" on chaves_pix
  for update using (empresa_id = (select empresa_id from perfis where id = auth.uid() limit 1));

create policy "empresa_delete" on chaves_pix
  for delete using (empresa_id = (select empresa_id from perfis where id = auth.uid() limit 1));
