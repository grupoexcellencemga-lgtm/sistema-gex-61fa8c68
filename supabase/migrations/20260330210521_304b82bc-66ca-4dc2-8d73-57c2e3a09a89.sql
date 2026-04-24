
CREATE OR REPLACE FUNCTION public.relatorios_data(_data_inicio date DEFAULT NULL, _data_fim date DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
  now_date date := current_date;
  six_months_ago text;
BEGIN
  -- Default to last 6 months if no dates provided
  IF _data_inicio IS NULL THEN
    _data_inicio := (date_trunc('month', now_date) - interval '5 months')::date;
  END IF;
  IF _data_fim IS NULL THEN
    _data_fim := (date_trunc('month', now_date) + interval '1 month' - interval '1 day')::date;
  END IF;

  six_months_ago := to_char((date_trunc('month', now_date) - interval '5 months')::date, 'YYYY-MM');

  SELECT json_build_object(
    'matriculas_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(p.nome, 'Outro') as name, count(*) as value
        FROM matriculas m LEFT JOIN produtos p ON p.id = m.produto_id
        GROUP BY coalesce(p.nome, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'alunos_por_cidade', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(cidade, 'Outro') as name, count(*) as value
        FROM alunos GROUP BY coalesce(cidade, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'crescimento_alunos', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.key), '[]'::json)
      FROM (
        SELECT
          to_char(date_trunc('month', s.m), 'YYYY-MM') as key,
          to_char(date_trunc('month', s.m), 'Mon') as mes,
          (SELECT count(*) FROM alunos WHERE created_at < date_trunc('month', s.m) + interval '1 month') as alunos
        FROM generate_series(
          date_trunc('month', now_date) - interval '5 months',
          date_trunc('month', now_date),
          interval '1 month'
        ) s(m)
      ) t
    ),
    'fluxo_caixa', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.key), '[]'::json)
      FROM (
        SELECT
          to_char(date_trunc('month', s.m), 'YYYY-MM') as key,
          to_char(date_trunc('month', s.m), 'Mon') as mes,
          coalesce((
            SELECT sum(coalesce(p.valor_pago, p.valor))
            FROM pagamentos p
            WHERE p.status = 'pago' AND p.data_pagamento >= date_trunc('month', s.m)::date
              AND p.data_pagamento < (date_trunc('month', s.m) + interval '1 month')::date
          ), 0) + coalesce((
            SELECT sum(r.valor)
            FROM receitas_avulsas r
            WHERE r.data >= date_trunc('month', s.m)::date
              AND r.data < (date_trunc('month', s.m) + interval '1 month')::date
          ), 0) as receita,
          coalesce((
            SELECT sum(d.valor)
            FROM despesas d
            WHERE d.data >= date_trunc('month', s.m)::date
              AND d.data < (date_trunc('month', s.m) + interval '1 month')::date
          ), 0) as despesa
        FROM generate_series(
          date_trunc('month', now_date) - interval '5 months',
          date_trunc('month', now_date),
          interval '1 month'
        ) s(m)
      ) t
    ),
    'receita_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(pr.nome, 'Outro') as name, sum(coalesce(p.valor_pago, p.valor)) as value
        FROM pagamentos p LEFT JOIN produtos pr ON pr.id = p.produto_id
        WHERE p.status = 'pago'
        GROUP BY coalesce(pr.nome, 'Outro') ORDER BY sum(coalesce(p.valor_pago, p.valor)) DESC
      ) t
    ),
    'despesas_por_categoria', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(c.nome, 'Sem categoria') as name, sum(d.valor) as value
        FROM despesas d LEFT JOIN categorias_despesas c ON c.id = d.categoria_id
        GROUP BY coalesce(c.nome, 'Sem categoria') ORDER BY sum(d.valor) DESC
      ) t
    ),
    'comissoes_por_vendedor', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          coalesce(cm.nome, 'Outro') as name,
          sum(CASE WHEN co.status = 'pago' THEN co.valor_pago ELSE 0 END) as pago,
          sum(CASE WHEN co.status != 'pago' THEN co.valor_comissao ELSE 0 END) as pendente
        FROM comissoes co LEFT JOIN comerciais cm ON cm.id = co.comercial_id
        GROUP BY coalesce(cm.nome, 'Outro')
      ) t
    ),
    'processos_por_status', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT initcap(status) as name, count(*) as value
        FROM processos_individuais GROUP BY status
      ) t
    ),
    'leads_por_origem', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(origem, 'Sem origem') as name, count(*) as value
        FROM leads GROUP BY coalesce(origem, 'Sem origem') ORDER BY count(*) DESC
      ) t
    ),
    'leads_por_etapa', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.ord), '[]'::json)
      FROM (
        SELECT initcap(e.etapa) as name, count(l.id) as value, e.ord
        FROM (VALUES ('lead',1),('contato',2),('negociacao',3),('matricula',4)) e(etapa,ord)
        LEFT JOIN leads l ON l.etapa = e.etapa
        GROUP BY e.etapa, e.ord
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
