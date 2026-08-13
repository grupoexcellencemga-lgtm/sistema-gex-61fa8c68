-- Multi-tenant: tabelas de Empresas e vínculo Usuário ↔ Empresa
-- Executar no Supabase SQL Editor.

-- ─── Empresas ─────────────────────────────────────────────────────────────────

create table if not exists public.empresas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  slug         text unique not null,
  logo_url     text,
  cor_primaria text not null default '#C8860A',
  modulos      text[] not null default '{}',
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Usuário ↔ Empresa ────────────────────────────────────────────────────────

create table if not exists public.user_empresa (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  papel      text not null default 'colaborador'
               check (papel in ('admin_master', 'admin', 'colaborador')),
  created_at timestamptz not null default now(),
  unique (user_id, empresa_id)
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

create index if not exists idx_user_empresa_user   on public.user_empresa (user_id);
create index if not exists idx_user_empresa_emp    on public.user_empresa (empresa_id);
create index if not exists idx_empresas_slug       on public.empresas (slug) where ativo = true;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.empresas     enable row level security;
alter table public.user_empresa enable row level security;

-- Qualquer usuário autenticado pode ler empresas ativas
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'empresas' and policyname = 'empresas_read'
  ) then
    create policy "empresas_read" on public.empresas
      for select using (auth.uid() is not null and ativo = true);
  end if;
end $$;

-- Usuário pode ler seu próprio vínculo
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_empresa' and policyname = 'user_empresa_self'
  ) then
    create policy "user_empresa_self" on public.user_empresa
      for select using (auth.uid() = user_id);
  end if;
end $$;

-- Admin master pode gerenciar tudo (insert/update/delete em user_empresa)
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_empresa' and policyname = 'user_empresa_master_write'
  ) then
    create policy "user_empresa_master_write" on public.user_empresa
      for all using (
        exists (
          select 1 from public.user_empresa ue2
          where ue2.user_id = auth.uid() and ue2.papel = 'admin_master'
        )
      );
  end if;
end $$;

-- Admin da empresa pode gerenciar user_empresa da sua empresa
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'user_empresa' and policyname = 'user_empresa_admin_write'
  ) then
    create policy "user_empresa_admin_write" on public.user_empresa
      for all using (
        exists (
          select 1 from public.user_empresa ue2
          where ue2.user_id = auth.uid()
            and ue2.empresa_id = user_empresa.empresa_id
            and ue2.papel = 'admin'
        )
      );
  end if;
end $$;

-- Admin master pode escrever em empresas
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'empresas' and policyname = 'empresas_master_write'
  ) then
    create policy "empresas_master_write" on public.empresas
      for all using (
        exists (
          select 1 from public.user_empresa ue
          where ue.user_id = auth.uid() and ue.papel = 'admin_master'
        )
      );
  end if;
end $$;

-- ─── Seed: 2 empresas iniciais ────────────────────────────────────────────────

insert into public.empresas (nome, slug, cor_primaria, modulos) values
(
  'GEx Educação',
  'gex',
  '#C8860A',
  '{inicio,dashboard,alunos,jornada,produtos,turmas,eventos,agenda,processo-individual,processo-empresarial,profissionais,vendedores,metas,financeiro,relatorios,usuarios,auditoria,configuracoes,aniversarios,mindmap,tarefas,divulgacao,funil}'
),
(
  'GEx Consórcio',
  'consorcio',
  '#1D4ED8',
  '{inicio,consorcios-pipeline,consorcios-leads,configuracoes}'
)
on conflict (slug) do nothing;
