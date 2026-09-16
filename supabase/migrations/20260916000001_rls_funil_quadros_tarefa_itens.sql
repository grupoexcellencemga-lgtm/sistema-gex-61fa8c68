-- funil_quadros e tarefa_itens estavam sem RLS com GRANT total para anon:
-- qualquer um com a chave publicavel (que vai no bundle) lia e apagava essas
-- linhas sem login. As policies abaixo copiam as das tabelas irmas, entao nada
-- muda para quem ja esta autenticado.

-- funil_quadros: mesmo modelo de funil_etapas.
alter table public.funil_quadros enable row level security;

create policy "autenticado select"
  on public.funil_quadros for select to authenticated
  using (true);

create policy "gestor ou comercial insert"
  on public.funil_quadros for insert to authenticated
  with check (
    is_gestor((select auth.uid())) or has_role((select auth.uid()), 'comercial'::app_role)
  );

create policy "gestor ou comercial update"
  on public.funil_quadros for update to authenticated
  using (
    is_gestor((select auth.uid())) or has_role((select auth.uid()), 'comercial'::app_role)
  )
  with check (
    is_gestor((select auth.uid())) or has_role((select auth.uid()), 'comercial'::app_role)
  );

create policy "gestor ou comercial delete"
  on public.funil_quadros for delete to authenticated
  using (
    is_gestor((select auth.uid())) or has_role((select auth.uid()), 'comercial'::app_role)
  );

-- tarefa_itens: mesmo modelo da tabela pai (tarefas).
alter table public.tarefa_itens enable row level security;

create policy "autenticado tudo"
  on public.tarefa_itens for all to authenticated
  using (true)
  with check (true);
