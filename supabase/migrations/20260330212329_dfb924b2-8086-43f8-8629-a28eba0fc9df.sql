
-- 1. Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- 2. Soft delete columns
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.matriculas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.pagamentos ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.processos_individuais ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.processos_empresariais ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.comerciais ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 3. Financial tables: restrict SELECT to admin + financeiro
DROP POLICY IF EXISTS "Authenticated can view pagamentos" ON public.pagamentos;
CREATE POLICY "Admin or financeiro view pagamentos" ON public.pagamentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view despesas" ON public.despesas;
CREATE POLICY "Admin or financeiro view despesas" ON public.despesas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view receitas_avulsas" ON public.receitas_avulsas;
CREATE POLICY "Admin or financeiro view receitas_avulsas" ON public.receitas_avulsas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "Admin or financeiro view contas_a_pagar" ON public.contas_a_pagar FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view fechamentos" ON public.fechamentos_mensais;
CREATE POLICY "Admin or financeiro view fechamentos" ON public.fechamentos_mensais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view pagamentos_profissional" ON public.pagamentos_profissional;
CREATE POLICY "Admin or financeiro view pagamentos_profissional" ON public.pagamentos_profissional FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

DROP POLICY IF EXISTS "Authenticated can view transferencias" ON public.transferencias_entre_contas;
CREATE POLICY "Admin or financeiro view transferencias" ON public.transferencias_entre_contas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');

-- pagamentos_processo: admin + financeiro + profissional (own processos)
DROP POLICY IF EXISTS "Authenticated can view pagamentos_processo" ON public.pagamentos_processo;
CREATE POLICY "Admin or financeiro view pagamentos_processo" ON public.pagamentos_processo FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');
CREATE POLICY "Profissional view own pagamentos_processo" ON public.pagamentos_processo FOR SELECT TO authenticated
  USING (
    public.get_user_profissional_nome(auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.processos_individuais pi
      WHERE pi.id = pagamentos_processo.processo_id
      AND lower(pi.responsavel) = lower(public.get_user_profissional_nome(auth.uid()))
    )
  );

-- pagamentos_processo_empresarial: admin + financeiro + profissional (own)
DROP POLICY IF EXISTS "Authenticated can view pagamentos_processo_empresarial" ON public.pagamentos_processo_empresarial;
CREATE POLICY "Admin or financeiro view pag_proc_emp" ON public.pagamentos_processo_empresarial FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.get_user_role(auth.uid()) = 'financeiro');
CREATE POLICY "Profissional view own pag_proc_emp" ON public.pagamentos_processo_empresarial FOR SELECT TO authenticated
  USING (
    public.get_user_profissional_nome(auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.processos_empresariais pe
      WHERE pe.id = pagamentos_processo_empresarial.processo_id
      AND lower(pe.responsavel) = lower(public.get_user_profissional_nome(auth.uid()))
    )
  );

-- 4. Alunos: restructure SELECT
DROP POLICY IF EXISTS "Authenticated can view alunos" ON public.alunos;
CREATE POLICY "Admin view alunos" ON public.alunos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Financeiro view alunos" ON public.alunos FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'financeiro');
CREATE POLICY "Suporte view alunos" ON public.alunos FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'suporte');
CREATE POLICY "Comercial view linked alunos" ON public.alunos FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'comercial'
    AND EXISTS (
      SELECT 1 FROM public.comissoes c
      WHERE c.aluno_id = alunos.id
      AND c.comercial_id = public.get_user_comercial_id(auth.uid())
    )
  );
CREATE POLICY "Unrestricted view alunos" ON public.alunos FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IS NULL);

-- 5. RESTRICTIVE policies to block specific roles
CREATE POLICY "Block restricted from leads" ON public.leads AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR coalesce(public.get_user_role(auth.uid()), '') NOT IN ('financeiro', 'profissional')
);

CREATE POLICY "Block restricted from processos_ind" ON public.processos_individuais AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR coalesce(public.get_user_role(auth.uid()), '') NOT IN ('financeiro', 'comercial')
);

CREATE POLICY "Block restricted from processos_emp" ON public.processos_empresariais AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR coalesce(public.get_user_role(auth.uid()), '') NOT IN ('financeiro', 'comercial')
);

CREATE POLICY "Block profissional from comissoes" ON public.comissoes AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR coalesce(public.get_user_role(auth.uid()), '') != 'profissional'
);

-- 6. Update dashboard_metrics to filter deleted records
CREATE OR REPLACE FUNCTION public.dashboard_metrics(_mes integer, _ano integer)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
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
    'total_alunos_mes', (SELECT count(*) FROM alunos WHERE deleted_at IS NULL AND created_at >= date_start AND created_at < date_start + interval '1 month'),
    'total_matriculas_mes', (SELECT count(*) FROM matriculas WHERE deleted_at IS NULL AND status = 'ativo' AND created_at >= date_start AND created_at < date_start + interval '1 month'),
    'receita_paga', (
      SELECT coalesce(sum(coalesce(valor_pago, valor)), 0) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pago' AND data_pagamento >= date_start AND data_pagamento <= date_end
    ),
    'receitas_avulsas', (
      SELECT coalesce(sum(valor), 0) FROM receitas_avulsas WHERE data >= date_start AND data <= date_end
    ),
    'total_despesas', (
      SELECT coalesce(sum(valor), 0) FROM despesas WHERE deleted_at IS NULL AND data >= date_start AND data <= date_end
    ),
    'pagamentos_pendentes', (
      SELECT coalesce(sum(valor), 0) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pendente' AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_pendentes_count', (
      SELECT count(*) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pendente' AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_vencidos', (
      SELECT coalesce(sum(valor), 0) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pendente' AND data_vencimento < hoje AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'pagamentos_vencidos_count', (
      SELECT count(*) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pendente' AND data_vencimento < hoje AND (
        (data_pagamento >= date_start AND data_pagamento <= date_end) OR
        (data_vencimento >= date_start AND data_vencimento <= date_end)
      )
    ),
    'comissoes_pendentes', (
      SELECT coalesce(sum(valor_comissao), 0) FROM comissoes
      WHERE status = 'pendente' AND created_at >= date_start AND created_at < date_start + interval '1 month'
    ),
    'processos_ativos', (
      SELECT count(*) FROM processos_individuais
      WHERE deleted_at IS NULL AND status = 'ativo' AND created_at >= date_start AND created_at < date_start + interval '1 month'
    ),
    'eventos_mes', (SELECT count(*) FROM eventos WHERE data >= date_start AND data <= date_end),
    'matriculas_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT p.nome as name, count(*) as alunos FROM matriculas m LEFT JOIN produtos p ON p.id = m.produto_id
        WHERE m.deleted_at IS NULL AND m.created_at >= date_start AND m.created_at < date_start + interval '1 month'
        GROUP BY p.nome ORDER BY count(*) DESC
      ) t
    ),
    'alunos_por_cidade', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(cidade, 'Outro') as name, count(*) as value FROM alunos
        WHERE deleted_at IS NULL AND created_at >= date_start AND created_at < date_start + interval '1 month'
        GROUP BY coalesce(cidade, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'despesas_por_categoria', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(c.nome, 'Sem categoria') as name, sum(d.valor) as value
        FROM despesas d LEFT JOIN categorias_despesas c ON c.id = d.categoria_id
        WHERE d.deleted_at IS NULL AND d.data >= date_start AND d.data <= date_end
        GROUP BY coalesce(c.nome, 'Sem categoria') ORDER BY sum(d.valor) DESC
      ) t
    ),
    'comissoes_por_vendedor', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(cm.nome, 'Outro') as name,
          sum(CASE WHEN co.status = 'pago' THEN co.valor_pago ELSE 0 END) as pago,
          sum(CASE WHEN co.status != 'pago' THEN co.valor_comissao ELSE 0 END) as pendente
        FROM comissoes co LEFT JOIN comerciais cm ON cm.id = co.comercial_id
        WHERE (cm.deleted_at IS NULL OR cm.id IS NULL) AND (
          co.data_pagamento >= date_start AND co.data_pagamento <= date_end
          OR co.created_at >= date_start AND co.created_at < date_start + interval '1 month'
        )
        GROUP BY coalesce(cm.nome, 'Outro')
      ) t
    ),
    'metas_ativas', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT id, titulo, tipo, valor_meta, valor_atual, periodo_inicio, periodo_fim
        FROM metas WHERE periodo_inicio <= hoje AND periodo_fim >= hoje
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;

-- 7. Update relatorios_data to filter deleted records
CREATE OR REPLACE FUNCTION public.relatorios_data(_data_inicio date DEFAULT NULL::date, _data_fim date DEFAULT NULL::date)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
  now_date date := current_date;
BEGIN
  IF _data_inicio IS NULL THEN
    _data_inicio := (date_trunc('month', now_date) - interval '5 months')::date;
  END IF;
  IF _data_fim IS NULL THEN
    _data_fim := (date_trunc('month', now_date) + interval '1 month' - interval '1 day')::date;
  END IF;

  SELECT json_build_object(
    'matriculas_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(p.nome, 'Outro') as name, count(*) as value
        FROM matriculas m LEFT JOIN produtos p ON p.id = m.produto_id
        WHERE m.deleted_at IS NULL
        GROUP BY coalesce(p.nome, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'alunos_por_cidade', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(cidade, 'Outro') as name, count(*) as value
        FROM alunos WHERE deleted_at IS NULL
        GROUP BY coalesce(cidade, 'Outro') ORDER BY count(*) DESC
      ) t
    ),
    'crescimento_alunos', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.key), '[]'::json) FROM (
        SELECT to_char(date_trunc('month', s.m), 'YYYY-MM') as key,
          to_char(date_trunc('month', s.m), 'Mon') as mes,
          (SELECT count(*) FROM alunos WHERE deleted_at IS NULL AND created_at < date_trunc('month', s.m) + interval '1 month') as alunos
        FROM generate_series(date_trunc('month', now_date) - interval '5 months', date_trunc('month', now_date), interval '1 month') s(m)
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
        FROM generate_series(date_trunc('month', now_date) - interval '5 months', date_trunc('month', now_date), interval '1 month') s(m)
      ) t
    ),
    'receita_por_produto', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(pr.nome, 'Outro') as name, sum(coalesce(p.valor_pago, p.valor)) as value
        FROM pagamentos p LEFT JOIN produtos pr ON pr.id = p.produto_id
        WHERE p.deleted_at IS NULL AND p.status = 'pago'
        GROUP BY coalesce(pr.nome, 'Outro') ORDER BY sum(coalesce(p.valor_pago, p.valor)) DESC
      ) t
    ),
    'despesas_por_categoria', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(c.nome, 'Sem categoria') as name, sum(d.valor) as value
        FROM despesas d LEFT JOIN categorias_despesas c ON c.id = d.categoria_id
        WHERE d.deleted_at IS NULL
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
        GROUP BY coalesce(cm.nome, 'Outro')
      ) t
    ),
    'processos_por_status', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT initcap(status) as name, count(*) as value
        FROM processos_individuais WHERE deleted_at IS NULL GROUP BY status
      ) t
    ),
    'leads_por_origem', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT coalesce(origem, 'Sem origem') as name, count(*) as value
        FROM leads WHERE deleted_at IS NULL
        GROUP BY coalesce(origem, 'Sem origem') ORDER BY count(*) DESC
      ) t
    ),
    'leads_por_etapa', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.ord), '[]'::json) FROM (
        SELECT initcap(e.etapa) as name, count(l.id) as value, e.ord
        FROM (VALUES ('lead',1),('contato',2),('negociacao',3),('matricula',4)) e(etapa,ord)
        LEFT JOIN leads l ON l.etapa = e.etapa AND l.deleted_at IS NULL
        GROUP BY e.etapa, e.ord
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$function$;
