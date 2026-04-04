
CREATE OR REPLACE FUNCTION public.relatorios_data(_data_inicio date DEFAULT NULL::date, _data_fim date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  now_date date := current_date;
  interval_days int;
  prev_inicio date;
  prev_fim date;
BEGIN
  IF _data_inicio IS NULL THEN
    _data_inicio := date_trunc('month', now_date)::date;
  END IF;
  IF _data_fim IS NULL THEN
    _data_fim := (date_trunc('month', now_date) + interval '1 month' - interval '1 day')::date;
  END IF;

  -- Calculate previous period of same length
  interval_days := _data_fim - _data_inicio;
  prev_fim := _data_inicio - interval '1 day';
  prev_inicio := prev_fim - interval_days;

  SELECT json_build_object(
    -- Existing charts scoped to period
    'matriculas_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(p.nome, 'Outro') as name, count(*) as value
        FROM matriculas m LEFT JOIN produtos p ON p.id = m.produto_id
        WHERE m.deleted_at IS NULL AND m.created_at >= _data_inicio AND m.created_at < _data_fim + interval '1 day'
        GROUP BY coalesce(p.nome, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'alunos_por_cidade', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(cidade, 'Outro') as name, count(*) as value
        FROM alunos WHERE deleted_at IS NULL AND created_at >= _data_inicio AND created_at < _data_fim + interval '1 day'
        GROUP BY coalesce(cidade, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'crescimento_alunos', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.key), '[]'::json) FROM (
        SELECT to_char(date_trunc('month', s.m), 'YYYY-MM') as key,
          to_char(date_trunc('month', s.m), 'Mon') as mes,
          (SELECT count(*) FROM alunos WHERE deleted_at IS NULL AND created_at < date_trunc('month', s.m) + interval '1 month') as alunos
        FROM generate_series(date_trunc('month', _data_inicio::timestamp), date_trunc('month', _data_fim::timestamp), interval '1 month') s(m)
      ) t
    ),
    'fluxo_caixa', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.key), '[]'::json) FROM (
        SELECT to_char(date_trunc('month', s.m), 'YYYY-MM') as key,
          to_char(date_trunc('month', s.m), 'Mon') as mes,
          coalesce((SELECT sum(coalesce(p.valor_pago, p.valor)) FROM pagamentos p
            WHERE p.deleted_at IS NULL AND p.status = 'pago' AND p.data_pagamento >= date_trunc('month', s.m)::date
              AND p.data_pagamento < (date_trunc('month', s.m) + interval '1 month')::date), 0)
          + coalesce((SELECT sum(r.valor) FROM receitas_avulsas r
            WHERE r.data >= date_trunc('month', s.m)::date AND r.data < (date_trunc('month', s.m) + interval '1 month')::date), 0) as receita,
          coalesce((SELECT sum(d.valor) FROM despesas d
            WHERE d.deleted_at IS NULL AND d.data >= date_trunc('month', s.m)::date
              AND d.data < (date_trunc('month', s.m) + interval '1 month')::date), 0) as despesa
        FROM generate_series(date_trunc('month', _data_inicio::timestamp), date_trunc('month', _data_fim::timestamp), interval '1 month') s(m)
      ) t
    ),
    'receita_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(pr.nome, 'Outro') as name, sum(coalesce(p.valor_pago, p.valor)) as value
        FROM pagamentos p LEFT JOIN produtos pr ON pr.id = p.produto_id
        WHERE p.deleted_at IS NULL AND p.status = 'pago' AND p.data_pagamento >= _data_inicio AND p.data_pagamento <= _data_fim
        GROUP BY coalesce(pr.nome, 'Outro') ORDER BY sum(coalesce(p.valor_pago, p.valor)) DESC
      ) t
    ),
    'despesas_por_categoria', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(c.nome, 'Sem categoria') as name, sum(d.valor) as value
        FROM despesas d LEFT JOIN categorias_despesas c ON c.id = d.categoria_id
        WHERE d.deleted_at IS NULL AND d.data >= _data_inicio AND d.data <= _data_fim
        GROUP BY coalesce(c.nome, 'Sem categoria') ORDER BY sum(d.valor) DESC
      ) t
    ),
    'comissoes_por_vendedor', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(cm.nome, 'Outro') as name,
          sum(CASE WHEN co.status = 'pago' THEN co.valor_pago ELSE 0 END) as pago,
          sum(CASE WHEN co.status != 'pago' THEN co.valor_comissao ELSE 0 END) as pendente
        FROM comissoes co LEFT JOIN comerciais cm ON cm.id = co.comercial_id
        WHERE (cm.deleted_at IS NULL OR cm.id IS NULL)
          AND co.created_at >= _data_inicio AND co.created_at < _data_fim + interval '1 day'
        GROUP BY coalesce(cm.nome, 'Outro')
      ) t
    ),
    'processos_por_status', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT initcap(status) as name, count(*) as value
        FROM processos_individuais WHERE deleted_at IS NULL
          AND created_at >= _data_inicio AND created_at < _data_fim + interval '1 day'
        GROUP BY status
      ) t
    ),
    'leads_por_origem', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(origem, 'Sem origem') as name, count(*) as value
        FROM leads WHERE deleted_at IS NULL
          AND created_at >= _data_inicio AND created_at < _data_fim + interval '1 day'
        GROUP BY coalesce(origem, 'Sem origem') ORDER BY count(*) DESC
      ) t
    ),
    'leads_por_etapa', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.ord), '[]'::json) FROM (
        SELECT initcap(e.etapa) as name, count(l.id) as value, e.ord
        FROM (VALUES ('lead',1),('contato',2),('negociacao',3),('matricula',4)) e(etapa,ord)
        LEFT JOIN leads l ON l.etapa = e.etapa AND l.deleted_at IS NULL
          AND l.created_at >= _data_inicio AND l.created_at < _data_fim + interval '1 day'
        GROUP BY e.etapa, e.ord
      ) t
    ),

    -- ═══ COMPARATIVO (período atual vs anterior) ═══
    'comparativo', json_build_object(
      'receita_atual', (
        SELECT coalesce(sum(coalesce(valor_pago, valor)), 0) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pago' AND data_pagamento >= _data_inicio AND data_pagamento <= _data_fim
      ) + (
        SELECT coalesce(sum(valor), 0) FROM receitas_avulsas WHERE data >= _data_inicio AND data <= _data_fim
      ),
      'receita_anterior', (
        SELECT coalesce(sum(coalesce(valor_pago, valor)), 0) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pago' AND data_pagamento >= prev_inicio AND data_pagamento <= prev_fim
      ) + (
        SELECT coalesce(sum(valor), 0) FROM receitas_avulsas WHERE data >= prev_inicio AND data <= prev_fim
      ),
      'matriculas_atual', (
        SELECT count(*) FROM matriculas WHERE deleted_at IS NULL AND status = 'ativo'
          AND created_at >= _data_inicio AND created_at < _data_fim + interval '1 day'
      ),
      'matriculas_anterior', (
        SELECT count(*) FROM matriculas WHERE deleted_at IS NULL AND status = 'ativo'
          AND created_at >= prev_inicio AND created_at < prev_fim + interval '1 day'
      ),
      'leads_atual', (
        SELECT count(*) FROM leads WHERE deleted_at IS NULL
          AND created_at >= _data_inicio AND created_at < _data_fim + interval '1 day'
      ),
      'leads_anterior', (
        SELECT count(*) FROM leads WHERE deleted_at IS NULL
          AND created_at >= prev_inicio AND created_at < prev_fim + interval '1 day'
      ),
      'despesas_atual', (
        SELECT coalesce(sum(valor), 0) FROM despesas WHERE deleted_at IS NULL AND data >= _data_inicio AND data <= _data_fim
      ),
      'despesas_anterior', (
        SELECT coalesce(sum(valor), 0) FROM despesas WHERE deleted_at IS NULL AND data >= prev_inicio AND data <= prev_fim
      )
    ),

    -- ═══ DRE SIMPLIFICADO ═══
    'dre', json_build_object(
      'receita_pagamentos', (
        SELECT coalesce(sum(coalesce(valor_pago, valor)), 0) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pago' AND data_pagamento >= _data_inicio AND data_pagamento <= _data_fim
      ),
      'receita_avulsas', (
        SELECT coalesce(sum(valor), 0) FROM receitas_avulsas WHERE data >= _data_inicio AND data <= _data_fim
      ),
      'comissoes_pagas', (
        SELECT coalesce(sum(valor_pago), 0) FROM comissoes
        WHERE status = 'pago' AND data_pagamento >= _data_inicio AND data_pagamento <= _data_fim
      ),
      'despesas_operacionais', (
        SELECT coalesce(sum(valor), 0) FROM despesas
        WHERE deleted_at IS NULL AND evento_id IS NULL AND data >= _data_inicio AND data <= _data_fim
      ),
      'despesas_eventos', (
        SELECT coalesce(sum(valor), 0) FROM despesas
        WHERE deleted_at IS NULL AND evento_id IS NOT NULL AND data >= _data_inicio AND data <= _data_fim
      )
    ),

    -- ═══ INADIMPLÊNCIA ═══
    'inadimplencia', json_build_object(
      'total', (
        SELECT coalesce(sum(valor), 0) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pendente' AND data_vencimento < now_date
      ),
      'quantidade', (
        SELECT count(*) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pendente' AND data_vencimento < now_date
      ),
      'dias_atraso_medio', (
        SELECT coalesce(avg(now_date - data_vencimento), 0) FROM pagamentos
        WHERE deleted_at IS NULL AND status = 'pendente' AND data_vencimento < now_date
      ),
      'top_devedores', (
        SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
          SELECT a.nome, a.id as aluno_id, sum(p.valor) as total_devido, count(*) as parcelas_vencidas,
            max(now_date - p.data_vencimento) as max_dias_atraso
          FROM pagamentos p JOIN alunos a ON a.id = p.aluno_id
          WHERE p.deleted_at IS NULL AND p.status = 'pendente' AND p.data_vencimento < now_date AND a.deleted_at IS NULL
          GROUP BY a.id, a.nome ORDER BY sum(p.valor) DESC LIMIT 10
        ) t
      )
    )
  ) INTO result;

  RETURN result;
END;
$function$;
