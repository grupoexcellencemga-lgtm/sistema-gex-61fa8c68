-- Fix: recursão infinita nas RLS policies de user_empresa
-- Policies que consultavam user_empresa dentro de user_empresa causavam loop.
-- Solução: funções SECURITY DEFINER que bypassam RLS na sub-consulta.

drop policy if exists "user_empresa_master_write" on public.user_empresa;
drop policy if exists "user_empresa_admin_write"  on public.user_empresa;
drop policy if exists "empresas_master_write"     on public.empresas;

create or replace function public.current_user_is_admin_master()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_empresa
    where user_id = auth.uid() and papel = 'admin_master'
  );
$$;

create or replace function public.current_user_is_empresa_admin(p_empresa_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_empresa
    where user_id = auth.uid()
      and empresa_id = p_empresa_id
      and papel in ('admin', 'admin_master')
  );
$$;

create policy "user_empresa_master_write" on public.user_empresa
  for all using (public.current_user_is_admin_master());

create policy "user_empresa_admin_write" on public.user_empresa
  for all using (public.current_user_is_empresa_admin(empresa_id));

create policy "empresas_master_write" on public.empresas
  for all using (public.current_user_is_admin_master());
