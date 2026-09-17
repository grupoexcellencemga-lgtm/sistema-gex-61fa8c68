-- ── Tipo de contato ──────────────────────────────────────────────────────────
-- O mesmo WhatsApp atende clientes, fornecedores e equipe, e o webhook
-- transforma todo mundo em lead. A fornecedora de salgados aparecia em
-- "Precisam de você", entraria no alerta de SLA e o bot tentaria vender para
-- ela. Só "lead" e "aluno" são clientes; os demais saem do painel, do alerta e
-- do bot. O padrão é "lead": quem decide que alguém não é cliente é uma pessoa.
alter table public.leads
  add column if not exists tipo_contato text not null default 'lead'
    check (tipo_contato in ('lead', 'aluno', 'fornecedor', 'parceiro', 'equipe', 'outro'));

-- ── Ficha do lead mantida pela IA ────────────────────────────────────────────
-- Resumo estruturado para a equipe não precisar reler a conversa inteira:
-- necessidade, dores, momento, perfil, objeções, próximo passo. É interna —
-- nunca vai para o cliente —, por isso é gerada mesmo com o agente de vendas
-- em modo sombra.
create table if not exists public.leads_ficha_ia (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  empresa_id uuid not null,
  ficha jsonb not null,
  -- Última mensagem que a ficha já considerou. Mensagem mais nova que isto
  -- significa ficha desatualizada.
  ate_mensagem_em timestamptz,
  modelo text,
  tokens_entrada integer,
  tokens_saida integer,
  atualizada_em timestamptz not null default now()
);

create index if not exists idx_leads_ficha_ia_empresa
  on public.leads_ficha_ia (empresa_id);

alter table public.leads_ficha_ia enable row level security;

-- Mesmo modelo de leads: quem é autenticado lê. Só a Edge Function (service
-- role) escreve — a ficha é da IA, não se edita pela tela.
create policy "autenticado select"
  on public.leads_ficha_ia for select to authenticated
  using (true);

-- ── Fila de leads com ficha a atualizar ──────────────────────────────────────
-- PostgREST não compara coluna de uma tabela com coluna de outra, então o
-- critério mora aqui. Recentes primeiro: é quem importa agora.
create or replace function public.leads_para_ficha(p_limite integer default 5)
returns table (lead_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select l.id
  from public.leads l
  left join public.leads_ficha_ia f on f.lead_id = l.id
  where l.deleted_at is null
    and l.tipo_contato in ('lead', 'aluno')
    and l.ultima_mensagem_em is not null
    -- Conversa assentada: não resumir no meio de uma troca de mensagens.
    and l.ultima_mensagem_em < now() - interval '10 minutes'
    and (
      f.lead_id is null
      or (
        l.ultima_mensagem_em > coalesce(f.ate_mensagem_em, '-infinity')
        -- No máximo uma atualização por hora por lead.
        and f.atualizada_em < now() - interval '1 hour'
      )
    )
    -- Um "oi" solto não precisa de ficha.
    and (select count(*) from public.mensagens_crm m where m.lead_id = l.id) >= 2
  order by l.ultima_mensagem_em desc
  limit p_limite;
$$;

-- Função de uso interno: sem isto, qualquer um com a chave pública poderia
-- chamá-la pelo PostgREST.
revoke execute on function public.leads_para_ficha(integer) from public, anon, authenticated;
grant execute on function public.leads_para_ficha(integer) to service_role;
