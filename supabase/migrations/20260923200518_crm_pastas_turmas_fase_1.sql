create table public.funil_pastas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index funil_pastas_empresa_ordem_idx
  on public.funil_pastas (empresa_id, ordem)
  where deleted_at is null;

create unique index funil_pastas_empresa_nome_unique
  on public.funil_pastas (empresa_id, lower(trim(nome)))
  where deleted_at is null;

alter table public.funil_pastas enable row level security;

create policy "membros da empresa podem ver pastas"
  on public.funil_pastas for select to authenticated
  using (
    empresa_id in (
      select ue.empresa_id from public.user_empresa ue
      where ue.user_id = (select auth.uid())
    )
  );

create policy "gestor ou comercial pode criar pastas"
  on public.funil_pastas for insert to authenticated
  with check (
    empresa_id in (
      select ue.empresa_id from public.user_empresa ue
      where ue.user_id = (select auth.uid())
    )
    and (public.is_gestor((select auth.uid())) or public.has_role((select auth.uid()), 'comercial'::public.app_role))
  );

create policy "gestor ou comercial pode alterar pastas"
  on public.funil_pastas for update to authenticated
  using (
    empresa_id in (
      select ue.empresa_id from public.user_empresa ue
      where ue.user_id = (select auth.uid())
    )
    and (public.is_gestor((select auth.uid())) or public.has_role((select auth.uid()), 'comercial'::public.app_role))
  )
  with check (
    empresa_id in (
      select ue.empresa_id from public.user_empresa ue
      where ue.user_id = (select auth.uid())
    )
    and (public.is_gestor((select auth.uid())) or public.has_role((select auth.uid()), 'comercial'::public.app_role))
  );

create policy "gestor ou comercial pode excluir pastas"
  on public.funil_pastas for delete to authenticated
  using (
    empresa_id in (
      select ue.empresa_id from public.user_empresa ue
      where ue.user_id = (select auth.uid())
    )
    and (public.is_gestor((select auth.uid())) or public.has_role((select auth.uid()), 'comercial'::public.app_role))
  );

grant select, insert, update, delete on public.funil_pastas to authenticated;
grant all on public.funil_pastas to service_role;

create trigger update_funil_pastas_updated_at
  before update on public.funil_pastas
  for each row execute function public.update_updated_at_column();

alter table public.funil_quadros
  add column pasta_id uuid references public.funil_pastas(id) on delete set null,
  add column status_ciclo text not null default 'preparacao'
    check (status_ciclo in ('preparacao', 'recebendo_leads', 'encerrando', 'encerrado')),
  add column recebe_novos_leads boolean not null default false,
  add column favorito boolean not null default false,
  add column ordem_na_pasta integer not null default 0;

alter table public.funil_quadros
  add constraint funil_quadro_receptor_tem_pasta
  check (not recebe_novos_leads or pasta_id is not null),
  add constraint funil_quadro_receptor_status
  check (not recebe_novos_leads or status_ciclo = 'recebendo_leads');

create index funil_quadros_pasta_ordem_idx
  on public.funil_quadros (pasta_id, ordem_na_pasta)
  where deleted_at is null;

create index funil_quadros_favoritos_idx
  on public.funil_quadros (empresa_id, favorito)
  where deleted_at is null and favorito = true;

create unique index funil_quadros_um_receptor_por_pasta
  on public.funil_quadros (pasta_id)
  where recebe_novos_leads = true and deleted_at is null;

alter table public.fluxos_bot
  add column pasta_funil_id uuid references public.funil_pastas(id) on delete set null;

create index fluxos_bot_pasta_funil_idx
  on public.fluxos_bot (pasta_funil_id)
  where pasta_funil_id is not null;

create or replace function public.ativar_funil_recebedor(p_quadro_id uuid)
returns public.funil_quadros
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quadro public.funil_quadros;
begin
  select * into v_quadro
  from public.funil_quadros
  where id = p_quadro_id and deleted_at is null
  for update;

  if v_quadro.id is null then
    raise exception 'Funil não encontrado';
  end if;
  if v_quadro.pasta_id is null then
    raise exception 'Mova o funil para uma pasta antes de ativá-lo';
  end if;
  if v_quadro.fixo or v_quadro.canal is not null then
    raise exception 'Quadros de conversa não podem receber oportunidades';
  end if;

  perform 1
  from public.funil_quadros
  where pasta_id = v_quadro.pasta_id and deleted_at is null
  for update;

  update public.funil_quadros
  set recebe_novos_leads = false,
      status_ciclo = case when status_ciclo = 'recebendo_leads' then 'encerrando' else status_ciclo end
  where pasta_id = v_quadro.pasta_id
    and id <> v_quadro.id
    and deleted_at is null;

  update public.funil_quadros
  set recebe_novos_leads = true,
      status_ciclo = 'recebendo_leads'
  where id = v_quadro.id
  returning * into v_quadro;

  return v_quadro;
end;
$$;

revoke execute on function public.ativar_funil_recebedor(uuid) from public, anon;
grant execute on function public.ativar_funil_recebedor(uuid) to authenticated, service_role;

create or replace function public.garantir_oportunidade_funil_ativo(
  p_lead_id uuid,
  p_pasta_id uuid,
  p_empresa_id uuid
)
returns table (card_id uuid, quadro_id uuid, etapa_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_quadro_id uuid;
  v_etapa_id uuid;
  v_card_id uuid;
begin
  if not exists (
    select 1 from public.leads
    where id = p_lead_id and empresa_id = p_empresa_id and deleted_at is null
  ) then
    raise exception 'Lead não pertence à empresa informada';
  end if;

  select q.id into v_quadro_id
  from public.funil_quadros q
  join public.funil_pastas p on p.id = q.pasta_id
  where q.pasta_id = p_pasta_id
    and q.empresa_id = p_empresa_id
    and p.empresa_id = p_empresa_id
    and p.deleted_at is null
    and q.deleted_at is null
    and q.recebe_novos_leads = true
    and q.status_ciclo = 'recebendo_leads'
  limit 1;

  if v_quadro_id is null then
    raise exception 'Nenhuma turma está recebendo leads nesta pasta';
  end if;

  select e.id into v_etapa_id
  from public.funil_etapas e
  where e.quadro_id = v_quadro_id and e.empresa_id = p_empresa_id
  order by e.ordem, e.created_at
  limit 1;

  if v_etapa_id is null then
    raise exception 'O funil ativo não possui etapas';
  end if;

  insert into public.funil_cards (lead_id, quadro_id, etapa_id, empresa_id)
  values (p_lead_id, v_quadro_id, v_etapa_id, p_empresa_id)
  on conflict (lead_id, quadro_id) do update
    set atualizado_em = public.funil_cards.atualizado_em
  returning id into v_card_id;

  return query select v_card_id, v_quadro_id, v_etapa_id;
end;
$$;

revoke execute on function public.garantir_oportunidade_funil_ativo(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.garantir_oportunidade_funil_ativo(uuid, uuid, uuid) to service_role;
