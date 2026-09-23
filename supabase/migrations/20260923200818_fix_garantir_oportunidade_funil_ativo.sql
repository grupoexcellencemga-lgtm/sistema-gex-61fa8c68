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
#variable_conflict use_column
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
