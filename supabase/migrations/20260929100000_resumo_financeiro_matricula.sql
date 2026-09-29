-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4.7 — Função canônica resumo_financeiro_matricula
--
-- Fonte única de verdade SQL para os 9 conceitos financeiros por matrícula.
-- Semântica espelha exatamente resumirMatriculaV2() em src/lib/alunoFinanceiro.ts.
--
-- Conceitos canônicos:
--   valor_contratado      = matriculas.valor_final
--   quitado_dinheiro      = pagamentos monetários pagos (valorPagoAluno)
--   quitado_permuta       = itens de permuta entregues
--   quitado_nao_monetario = probono pago (quita obrigação sem gerar caixa)
--   total_quitado         = din + perm + nao_mon
--   permuta_pendente      = itens de permuta acordados (não entregues)
--   saldo_financeiro      = GREATEST(0, contratado - total_quitado)
--   saldo_disponivel      = GREATEST(0, saldo_financeiro - permuta_pendente)
--   caixa                 = pagamentos monetários com gera_caixa IS NOT FALSE
--
-- Regra valorPagoAluno (espelho do TypeScript):
--   taxa_absorvida_por='empresa' AND valor_pago IS NOT NULL → usar valor (bruto)
--   caso contrário → COALESCE(valor_pago, valor)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Função canônica ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION resumo_financeiro_matricula(p_matricula_id UUID)
RETURNS TABLE (
  matricula_id          UUID,
  empresa_id            UUID,
  valor_contratado      NUMERIC,
  quitado_dinheiro      NUMERIC,
  quitado_permuta       NUMERIC,
  quitado_nao_monetario NUMERIC,
  total_quitado         NUMERIC,
  permuta_pendente      NUMERIC,
  saldo_financeiro      NUMERIC,
  saldo_disponivel      NUMERIC,
  caixa                 NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
    -- Matrícula base (0 linhas se não encontrada → função retorna 0 linhas)
    mat AS (
      SELECT m.id, m.empresa_id, COALESCE(m.valor_final, 0) AS valor_final
      FROM   matriculas m
      WHERE  m.id = p_matricula_id
        AND  m.deleted_at IS NULL
    ),
    -- Todos os pagamentos ativos desta matrícula (não deletados, não cancelados)
    pags AS (
      SELECT p.*
      FROM   pagamentos p
      WHERE  p.matricula_id = p_matricula_id
        AND  p.deleted_at   IS NULL
        AND  p.status       <> 'cancelado'
    ),
    -- Pagamentos monetários pagos (PIX, cartão, boleto, dinheiro, link, crédito…)
    -- valorPagoAluno: taxa absorvida pela empresa → aluno pagou o bruto integralmente
    din AS (
      SELECT
        COALESCE(SUM(
          CASE WHEN p.taxa_absorvida_por = 'empresa' AND p.valor_pago IS NOT NULL
               THEN p.valor
               ELSE COALESCE(p.valor_pago, p.valor)
          END
        ), 0) AS total,
        -- caixa: somente registros onde gera_caixa IS NOT FALSE
        COALESCE(SUM(
          CASE WHEN p.gera_caixa IS NOT FALSE
               THEN CASE WHEN p.taxa_absorvida_por = 'empresa' AND p.valor_pago IS NOT NULL
                         THEN p.valor
                         ELSE COALESCE(p.valor_pago, p.valor)
                    END
               ELSE 0
          END
        ), 0) AS caixa
      FROM pags p
      WHERE p.status = 'pago'
        AND (p.forma_pagamento IS NULL
             OR p.forma_pagamento NOT IN ('permuta', 'probono'))
    ),
    -- Probono: quita a obrigação sem gerar caixa
    nao_mon AS (
      SELECT COALESCE(SUM(
        CASE WHEN p.taxa_absorvida_por = 'empresa' AND p.valor_pago IS NOT NULL
             THEN p.valor
             ELSE COALESCE(p.valor_pago, p.valor)
        END
      ), 0) AS total
      FROM pags p
      WHERE p.status = 'pago'
        AND p.forma_pagamento = 'probono'
    ),
    -- Itens de permuta: entregues quitam; acordados comprometem saldo
    perm AS (
      SELECT
        COALESCE(SUM(pi.valor) FILTER (WHERE pi.status = 'entregue'), 0) AS quitado,
        COALESCE(SUM(pi.valor) FILTER (WHERE pi.status = 'acordado'),  0) AS pendente
      FROM pags p
      JOIN permuta_itens pi
        ON  pi.pagamento_id = p.id
        AND pi.deleted_at   IS NULL
      WHERE p.forma_pagamento = 'permuta'
    )
  SELECT
    mat.id                  AS matricula_id,
    mat.empresa_id,
    mat.valor_final         AS valor_contratado,
    din.total               AS quitado_dinheiro,
    perm.quitado            AS quitado_permuta,
    nao_mon.total           AS quitado_nao_monetario,
    din.total + perm.quitado + nao_mon.total        AS total_quitado,
    perm.pendente           AS permuta_pendente,
    GREATEST(0, mat.valor_final
               - (din.total + perm.quitado + nao_mon.total))
                            AS saldo_financeiro,
    GREATEST(0,
      GREATEST(0, mat.valor_final
                 - (din.total + perm.quitado + nao_mon.total))
      - perm.pendente)      AS saldo_disponivel,
    din.caixa               AS caixa
  FROM mat, din, perm, nao_mon
$$;

GRANT EXECUTE ON FUNCTION resumo_financeiro_matricula(UUID) TO authenticated;

-- ── 2. registrar_permuta refatorada ─────────────────────────────────────────
--
-- Substituição dos 3 SELECTs inline de saldo (quitado_din, quitado_perm,
-- pend_perm + 2 cálculos manuais) por uma única chamada à função canônica.
--
-- O lock FOR UPDATE na matrícula é PRESERVADO; ele serializa chamadas
-- concorrentes e garante que a leitura do saldo seja consistente.
-- A função canônica é STABLE (só lê), portanto pode ser chamada com segurança
-- dentro de uma transação que já bloqueou a linha.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION registrar_permuta(
  p_matricula_id    UUID,
  p_valor           NUMERIC(10,2),
  p_itens           JSONB,
  p_idempotency_key UUID,
  p_observacao      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID    := auth.uid();
  v_empresa_id   UUID;
  v_aluno_id     UUID;
  v_pag_id       UUID;
  v_item         JSONB;
  v_item_idx     INT     := 0;
  v_soma_itens   NUMERIC := 0;
  v_saldo_disp   NUMERIC;
  v_hash         TEXT;
  v_existing     RECORD;
  v_n_itens      INT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Itens não vazios
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Lista de itens não pode estar vazia.',
      HINT    = 'itens_vazios',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Payload hash: matricula_id + valor + itens ordenados
  SELECT md5(
    p_matricula_id::text || '|' ||
    p_valor::text        || '|' ||
    COALESCE(string_agg(
      concat(
        COALESCE(elem->>'tipo', ''),           '|',
        COALESCE(trim(elem->>'descricao'), ''), '|',
        COALESCE(elem->>'valor', '')
      ),
      ';'
      ORDER BY
        COALESCE(elem->>'tipo', ''),
        COALESCE(trim(elem->>'descricao'), ''),
        COALESCE(elem->>'valor', '')
    ), '')
  ) INTO v_hash
  FROM jsonb_array_elements(p_itens) AS elem;

  -- 4. Idempotência: checagem antes de qualquer lock
  SELECT p.id, p.matricula_id, p.valor, p.status, p.idempotency_payload_hash
  INTO v_existing
  FROM pagamentos p
  WHERE p.idempotency_key = p_idempotency_key AND p.deleted_at IS NULL
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.idempotency_payload_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING
        MESSAGE = 'Idempotency key já utilizada com payload diferente.',
        HINT    = 'idempotency_conflict',
        DETAIL  = jsonb_build_object(
                    'idempotency_key',        p_idempotency_key,
                    'matricula_id_existente', v_existing.matricula_id,
                    'matricula_id_novo',      p_matricula_id,
                    'valor_existente',        v_existing.valor,
                    'valor_novo',             p_valor
                  )::text,
        ERRCODE = 'P0001';
    END IF;
    -- Mesmo payload: retorno idempotente
    SELECT COUNT(*) INTO v_n_itens
    FROM permuta_itens
    WHERE pagamento_id = v_existing.id AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'pagamento_id',  v_existing.id,
      'valor',         v_existing.valor,
      'status',        v_existing.status,
      'itens_criados', v_n_itens,
      'idempotente',   true
    );
  END IF;

  -- 5. Validação individual de cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_idx := v_item_idx + 1;

    IF (v_item->>'tipo') IS NULL OR (v_item->>'tipo') NOT IN ('servico', 'produto', 'outro') THEN
      RAISE EXCEPTION USING
        MESSAGE = format('Tipo inválido no item %s.', v_item_idx),
        HINT    = 'item_tipo_invalido',
        DETAIL  = jsonb_build_object('indice', v_item_idx, 'tipo', v_item->>'tipo')::text,
        ERRCODE = 'P0001';
    END IF;

    IF (v_item->>'descricao') IS NULL OR length(trim(v_item->>'descricao')) < 3 THEN
      RAISE EXCEPTION USING
        MESSAGE = format('Descrição do item %s precisa ter ao menos 3 caracteres.', v_item_idx),
        HINT    = 'item_descricao_curta',
        DETAIL  = jsonb_build_object('indice', v_item_idx)::text,
        ERRCODE = 'P0001';
    END IF;

    IF (v_item->>'valor') IS NULL OR (v_item->>'valor')::numeric <= 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = format('Valor do item %s deve ser maior que zero.', v_item_idx),
        HINT    = 'item_valor_invalido',
        DETAIL  = jsonb_build_object('indice', v_item_idx, 'valor', v_item->>'valor')::text,
        ERRCODE = 'P0001';
    END IF;

    v_soma_itens := v_soma_itens + (v_item->>'valor')::numeric;
  END LOOP;

  -- 6. Soma dos itens deve bater (comparação em centavos)
  IF round(v_soma_itens * 100) <> round(p_valor * 100) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Soma dos itens não corresponde ao valor da permuta.',
      HINT    = 'soma_divergente',
      DETAIL  = jsonb_build_object('soma_itens', v_soma_itens, 'valor', p_valor)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 7. Lock na matrícula (serializa registrar_permuta concorrentes para o mesmo aluno)
  SELECT m.empresa_id, m.aluno_id
  INTO v_empresa_id, v_aluno_id
  FROM matriculas m
  WHERE m.id = p_matricula_id AND m.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Matrícula não encontrada ou inativa.',
      HINT    = 'matricula_nao_encontrada',
      DETAIL  = jsonb_build_object('matricula_id', p_matricula_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 8. Calcular saldo via função canônica (sob o lock da matrícula)
  --    Substitui os 3 SELECTs inline das versões anteriores.
  --    A função canônica inclui probono em total_quitado, corrigindo divergência
  --    que existia quando probono tinha valor > 0.
  SELECT r.saldo_disponivel
  INTO v_saldo_disp
  FROM resumo_financeiro_matricula(p_matricula_id) r;

  -- 9. Validar saldo suficiente
  IF p_valor > v_saldo_disp THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Saldo disponível insuficiente.',
      HINT    = 'saldo_insuficiente',
      DETAIL  = jsonb_build_object('disponivel', v_saldo_disp, 'solicitado', p_valor)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 10. Inserir pagamento pai (empresa_id e aluno_id vêm da matrícula)
  INSERT INTO pagamentos (
    matricula_id, aluno_id, empresa_id,
    valor, forma_pagamento, gera_caixa, status,
    idempotency_key, idempotency_payload_hash, observacao,
    created_by, updated_by
  ) VALUES (
    p_matricula_id, v_aluno_id, v_empresa_id,
    p_valor, 'permuta', false, 'pendente_permuta',
    p_idempotency_key, v_hash, p_observacao,
    v_uid, v_uid
  )
  RETURNING id INTO v_pag_id;

  -- 11. Inserir itens
  v_item_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_idx := v_item_idx + 1;
    INSERT INTO permuta_itens (
      pagamento_id, empresa_id, tipo, descricao, valor, status,
      data_acordada, observacao, created_by, updated_by
    ) VALUES (
      v_pag_id,
      v_empresa_id,
      v_item->>'tipo',
      trim(v_item->>'descricao'),
      (v_item->>'valor')::numeric,
      'acordado',
      COALESCE((v_item->>'data_acordada')::date, CURRENT_DATE),
      v_item->>'observacao',
      v_uid,
      v_uid
    );
  END LOOP;

  RETURN jsonb_build_object(
    'pagamento_id',  v_pag_id,
    'valor',         p_valor,
    'status',        'pendente_permuta',
    'itens_criados', v_item_idx,
    'idempotente',   false
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Corrida concorrente: outra chamada com a mesma chave venceu o INSERT.
    SELECT p.id, p.matricula_id, p.valor, p.status, p.idempotency_payload_hash
    INTO v_existing
    FROM pagamentos p
    WHERE p.idempotency_key = p_idempotency_key AND p.deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    IF v_existing.idempotency_payload_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING
        MESSAGE = 'Idempotency key já utilizada com payload diferente.',
        HINT    = 'idempotency_conflict',
        DETAIL  = jsonb_build_object('idempotency_key', p_idempotency_key)::text,
        ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_n_itens
    FROM permuta_itens
    WHERE pagamento_id = v_existing.id AND deleted_at IS NULL;

    RETURN jsonb_build_object(
      'pagamento_id',  v_existing.id,
      'valor',         v_existing.valor,
      'status',        v_existing.status,
      'itens_criados', v_n_itens,
      'idempotente',   true
    );
END;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION registrar_permuta(UUID, NUMERIC, JSONB, UUID, TEXT)
  TO authenticated;
