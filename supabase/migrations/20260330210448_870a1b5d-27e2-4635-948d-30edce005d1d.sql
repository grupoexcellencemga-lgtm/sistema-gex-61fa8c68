
CREATE OR REPLACE FUNCTION public.dashboard_metrics(_mes integer, _ano integer)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
  date_start date;
  date_end date;
  hoje date;
BEGIN
  date_start := make_date(_ano, _mes + 1, 1);
  date_end := (date_start + interval '1 month' - interval '1 day')::date;
  hoje := current_date;

  SELECT json_build_object(
    'total_alunos_mes', (SELECT count(*) FROM alunos WHERE created_at >= date_start AND created_at < date_start + interval '1 month'),
    'total_matriculas_mes', (SELECT count(*) FROM matriculas WHERE status = 'ativo' AND created_at >= date_start AND created_at < date_start + interval '1 month'),
    'receita_paga', (
      SELECT coalesce(sum(coalesce(valor_pago, valor)), 0)
      FROM pagamentos
      WHERE status = 'pago' AND data_pagamento >= date_start AND data_pagamento <= date_end
    ),
    'receitas_avulsas', (
      SELECT coalesce(sum(valor), 0)
      FROM receitas_avulsas
      WHERE data >= date_start AND data <= date_end
    ),
    'total_despesas', (
      SELECT coalesce(sum(valor), 0)
      FROM despesas
      WHERE data >= date_start AND data <= date_end
    ),
    'pagamentos_pendentes', (
      SELECT coalesce(sum(valor), 0)
      FROM pagamentos
      WHERE status = 'pendente' AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_pendentes_count', (
      SELECT count(*)
      FROM pagamentos
      WHERE status = 'pendente' AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_vencidos', (
      SELECT coalesce(sum(valor), 0)
      FROM pagamentos
      WHERE status = 'pendente' AND data_vencimento < hoje AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_vencidos_count', (
      SELECT count(*)
      FROM pagamentos
      WHERE status = 'pendente' AND data_vencimento < hoje AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'comissoes_pendentes', (
      SELECT coalesce(sum(valor_comissao), 0)
      FROM comissoes
      WHERE status = 'pendente' AND created_at >= date_start AND created_at < date_start + interval '1 month'
    ),
    'processos_ativos', (
      SELECT count(*)
      FROM processos_individuais
      WHERE status = 'ativo' AND created_at >= date_start AND created_at < date_start + interval '1 month'
    ),
    'eventos_mes', (
      SELECT count(*)
      FROM eventos
      WHERE data >= date_start AND data <= date_end
    ),
    'matriculas_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT p.nome as name, count(*) as alunos
        FROM matriculas m
        LEFT JOIN produtos p ON p.id = m.produto_id
        WHERE m.created_at >= date_start AND m.created_at < date_start + interval '1 month'
        GROUP BY p.nome
        ORDER BY count(*) DESC
      ) t
    ),
    'alunos_por_cidade', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(cidade, 'Outro') as name, count(*) as value
        FROM alunos
        WHERE created_at >= date_start AND created_at < date_start + interval '1 month'
        GROUP BY coalesce(cidade, 'Outro')
        ORDER BY count(*) DESC
      ) t
    ),
    'despesas_por_categoria', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT coalesce(c.nome, 'Sem categoria') as name, sum(d.valor) as value
        FROM despesas d
        LEFT JOIN categorias_despesas c ON c.id = d.categoria_id
        WHERE d.data >= date_start AND d.data <= date_end
        GROUP BY coalesce(c.nome, 'Sem categoria')
        ORDER BY sum(d.valor) DESC
      ) t
    ),
    'comissoes_por_vendedor', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT
          coalesce(cm.nome, 'Outro') as name,
          sum(CASE WHEN co.status = 'pago' THEN co.valor_pago ELSE 0 END) as pago,
          sum(CASE WHEN co.status != 'pago' THEN co.valor_comissao ELSE 0 END) as pendente
        FROM comissoes co
        LEFT JOIN comerciais cm ON cm.id = co.comercial_id
        WHERE co.data_pagamento >= date_start AND co.data_pagamento <= date_end
           OR co.created_at >= date_start AND co.created_at < date_start + interval '1 month'
        GROUP BY coalesce(cm.nome, 'Outro')
      ) t
    ),
    'metas_ativas', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT id, titulo, tipo, valor_meta, valor_atual, periodo_inicio, periodo_fim
        FROM metas
        WHERE periodo_inicio <= hoje AND periodo_fim >= hoje
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
