-- Tela de revisão do modo sombra.

-- Custo real de cada avaliação, somado sobre todas as voltas do laço de
-- ferramentas. Sem isto o custo do modo sombra seria só estimativa.
alter table public.respostas_sombra
  add column if not exists tokens_entrada integer,
  add column if not exists tokens_saida integer;

-- mensagens_crm não tinha índice por lead, só pela PK e por protocolo. A caixa
-- de entrada, o processar-bot e o webhook filtram por lead_id ordenando por
-- data — com varredura completa. Com ~800 mensagens novas por semana isso vira
-- gargalo rápido. Beneficia também a view abaixo.
create index if not exists idx_mensagens_crm_lead_data
  on public.mensagens_crm (lead_id, created_at);

-- Uma linha por resposta que a IA daria, ao lado do que o humano respondeu de
-- fato: a primeira mensagem de saída do lead depois da mensagem avaliada.
-- security_invoker para as policies das tabelas de origem valerem para quem
-- consulta — sem isso a view rodaria com os privilégios do dono e ignoraria
-- RLS.
create or replace view public.v_respostas_sombra_revisao
with (security_invoker = true) as
select
  s.id,
  s.empresa_id,
  s.lead_id,
  s.agente_id,
  s.mensagem_entrada,
  s.resposta_ia,
  s.ferramentas,
  s.modelo,
  s.tokens_entrada,
  s.tokens_saida,
  s.created_at,
  s.avaliacao,
  s.avaliacao_nota,
  s.avaliado_em,
  s.avaliado_por,
  l.nome as lead_nome,
  a.nome as agente_nome,
  e.created_at as entrada_em,
  h.conteudo as resposta_humana,
  h.created_at as resposta_humana_em
from public.respostas_sombra s
left join public.leads l on l.id = s.lead_id
left join public.agentes_bot a on a.id = s.agente_id
left join public.mensagens_crm e on e.id = s.mensagem_entrada_id
left join lateral (
  select m.conteudo, m.created_at
  from public.mensagens_crm m
  where m.lead_id = s.lead_id
    and m.direcao = 'saida'
    and m.created_at > coalesce(e.created_at, s.created_at)
  order by m.created_at
  limit 1
) h on true;

grant select on public.v_respostas_sombra_revisao to authenticated;
