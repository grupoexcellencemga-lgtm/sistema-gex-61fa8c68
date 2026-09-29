-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 4.7.1 — Permuta aceita valor R$ 0,00
--
-- Motivação: acordos sem valor monetário (divulgação, patrocínio, serviço
-- simbólico) devem poder ser registrados com valor zero. O zero não altera
-- quitadoPermuta, saldo financeiro nem caixa.
--
-- Mudanças:
--   1. permuta_itens.valor: CHECK (valor > 0) → CHECK (valor >= 0)
--   2. registrar_permuta v4.7.1:
--      • rejeita p_valor < 0 (negativo explícito)
--      • item.valor: rejeita < 0 (era <= 0); mensagem "Valor não pode ser negativo."
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Constraint em permuta_itens ───────────────────────────────────────────

ALTER TABLE permuta_itens
  DROP CONSTRAINT IF EXISTS permuta_itens_valor_check;

ALTER TABLE permuta_itens
  ADD CONSTRAINT permuta_itens_valor_check CHECK (valor >= 0);

-- ── 2. registrar_permuta v4.7.1 ──────────────────────────────────────────────

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

  -- 2b. Valor total não pode ser negativo (zero é permitido)
  IF p_valor < 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Valor não pode ser negativo.',
      HINT    = 'valor_negativo',
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

    -- Aceita zero; rejeita apenas negativo
    IF (v_item->>'valor') IS NULL OR (v_item->>'valor')::numeric < 0 THEN
      RAISE EXCEPTION USING
        MESSAGE = format('Valor não pode ser negativo (item %s).', v_item_idx),
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
  SELECT r.saldo_disponivel
  INTO v_saldo_disp
  FROM resumo_financeiro_matricula(p_matricula_id) r;

  -- 9. Validar saldo suficiente (zero sempre passa se saldo >= 0)
  IF p_valor > v_saldo_disp THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Saldo disponível insuficiente.',
      HINT    = 'saldo_insuficiente',
      DETAIL  = jsonb_build_object('disponivel', v_saldo_disp, 'solicitado', p_valor)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 10. Inserir pagamento pai
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

GRANT EXECUTE ON FUNCTION registrar_permuta(UUID, NUMERIC, JSONB, UUID, TEXT)
  TO authenticated;
