-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 — RPCs de permuta
-- Schema: idempotency_key, idempotency_payload_hash, observacao em pagamentos
-- RPCs  : registrar_permuta, confirmar_entrega_item_permuta,
--          cancelar_item_permuta, cancelar_permuta
-- Segurança: SECURITY INVOKER, role check inline, empresa_id vem da matricula
-- Lock order global: matriculas FOR UPDATE → pagamentos FOR UPDATE
--                    → permuta_itens FOR UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Colunas adicionais em pagamentos ──────────────────────────────────────

ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS idempotency_key          UUID,
  ADD COLUMN IF NOT EXISTS idempotency_payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS observacao               TEXT;

-- Índice único parcial: apenas chaves não-nulas
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_idempotency_key
  ON pagamentos (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 2. registrar_permuta ─────────────────────────────────────────────────────

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
  v_valor_final  NUMERIC;
  v_pag_id       UUID;
  v_item         JSONB;
  v_item_idx     INT     := 0;
  v_soma_itens   NUMERIC := 0;
  v_quitado_din  NUMERIC;
  v_quitado_perm NUMERIC;
  v_pend_perm    NUMERIC;
  v_saldo_fin    NUMERIC;
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

  -- 3. Payload hash: inclui matricula_id + valor + itens ordenados
  --    Sem cast a numeric para não falhar antes da validação individual.
  SELECT md5(
    p_matricula_id::text || '|' ||
    p_valor::text        || '|' ||
    COALESCE(string_agg(
      concat(
        COALESCE(elem->>'tipo', ''),        '|',
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
  SELECT m.valor_final, m.empresa_id, m.aluno_id
  INTO v_valor_final, v_empresa_id, v_aluno_id
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

  -- 8. Calcular saldo_disponivel (sob o lock da matricula)
  -- quitado_dinheiro: pagamentos monetários com status='pago'
  SELECT COALESCE(SUM(
    CASE WHEN p2.taxa_absorvida_por = 'empresa' AND p2.valor_pago IS NOT NULL
         THEN p2.valor
         ELSE COALESCE(p2.valor_pago, p2.valor)
    END
  ), 0) INTO v_quitado_din
  FROM pagamentos p2
  WHERE p2.matricula_id = p_matricula_id
    AND p2.deleted_at  IS NULL
    AND p2.status       = 'pago'
    AND (p2.forma_pagamento IS NULL OR p2.forma_pagamento <> 'permuta');

  -- quitado_permuta: itens entregues de permutas desta matrícula
  SELECT COALESCE(SUM(pi.valor), 0) INTO v_quitado_perm
  FROM pagamentos p3
  JOIN permuta_itens pi ON pi.pagamento_id = p3.id AND pi.deleted_at IS NULL
  WHERE p3.matricula_id = p_matricula_id
    AND p3.deleted_at  IS NULL
    AND pi.status       = 'entregue';

  -- pendente_permuta: itens acordados (comprometidos mas não entregues)
  SELECT COALESCE(SUM(pi.valor), 0) INTO v_pend_perm
  FROM pagamentos p4
  JOIN permuta_itens pi ON pi.pagamento_id = p4.id AND pi.deleted_at IS NULL
  WHERE p4.matricula_id = p_matricula_id
    AND p4.deleted_at  IS NULL
    AND pi.status       = 'acordado';

  v_saldo_fin  := GREATEST(0, v_valor_final - v_quitado_din - v_quitado_perm);
  v_saldo_disp := GREATEST(0, v_saldo_fin   - v_pend_perm);

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
    -- Re-ler e comparar fingerprint.
    SELECT p.id, p.matricula_id, p.valor, p.status, p.idempotency_payload_hash
    INTO v_existing
    FROM pagamentos p
    WHERE p.idempotency_key = p_idempotency_key AND p.deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE; -- Inesperado: re-raise original
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

-- ── 3. confirmar_entrega_item_permuta ────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirmar_entrega_item_permuta(
  p_permuta_item_id UUID,
  p_data_entrega    DATE DEFAULT CURRENT_DATE,
  p_observacao      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_pagamento_id UUID;
  v_item         RECORD;
  v_novo_status  TEXT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Snapshot do pagamento_id sem lock (apenas para saber qual pagamento bloquear)
  SELECT pagamento_id INTO v_pagamento_id
  FROM permuta_itens
  WHERE id = p_permuta_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item de permuta não encontrado.',
      HINT    = 'item_nao_encontrado',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 3. Lock no pagamento primeiro (ordem: pagamentos → permuta_itens)
  PERFORM id FROM pagamentos WHERE id = v_pagamento_id AND deleted_at IS NULL FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento pai não encontrado.',
      HINT    = 'pagamento_nao_encontrado',
      DETAIL  = jsonb_build_object('pagamento_id', v_pagamento_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 4. Lock + revalidação do item
  SELECT id, status INTO v_item
  FROM permuta_itens
  WHERE id = p_permuta_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item de permuta não encontrado.',
      HINT    = 'item_nao_encontrado',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 5. Idempotente: já entregue
  IF v_item.status = 'entregue' THEN
    SELECT calcular_status_permuta(v_pagamento_id) INTO v_novo_status;
    RETURN jsonb_build_object(
      'item_id',               p_permuta_item_id,
      'pagamento_id',          v_pagamento_id,
      'novo_status_pagamento', v_novo_status,
      'idempotente',           true
    );
  END IF;

  -- 6. Bloqueado: cancelado não pode ser entregue
  IF v_item.status = 'cancelado' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item já cancelado: não é possível confirmar entrega.',
      HINT    = 'item_cancelado',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 7. Atualizar item
  UPDATE permuta_itens SET
    status       = 'entregue',
    data_entrega = p_data_entrega,
    observacao   = COALESCE(p_observacao, observacao),
    updated_by   = v_uid,
    updated_at   = now()
  WHERE id = p_permuta_item_id;

  -- 8. Recalcular e sincronizar status do pagamento
  SELECT calcular_status_permuta(v_pagamento_id) INTO v_novo_status;

  UPDATE pagamentos SET
    status     = v_novo_status,
    updated_by = v_uid,
    updated_at = now()
  WHERE id = v_pagamento_id;

  RETURN jsonb_build_object(
    'item_id',               p_permuta_item_id,
    'pagamento_id',          v_pagamento_id,
    'novo_status_pagamento', v_novo_status,
    'idempotente',           false
  );
END;
$$;

-- ── 4. cancelar_item_permuta ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancelar_item_permuta(
  p_permuta_item_id    UUID,
  p_motivo_cancelamento TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_pagamento_id UUID;
  v_item         RECORD;
  v_novo_status  TEXT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Motivo obrigatório
  IF p_motivo_cancelamento IS NULL OR length(trim(p_motivo_cancelamento)) = 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Motivo de cancelamento é obrigatório.',
      HINT    = 'motivo_obrigatorio',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Snapshot do pagamento_id sem lock
  SELECT pagamento_id INTO v_pagamento_id
  FROM permuta_itens
  WHERE id = p_permuta_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item de permuta não encontrado.',
      HINT    = 'item_nao_encontrado',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 4. Lock no pagamento primeiro
  PERFORM id FROM pagamentos WHERE id = v_pagamento_id AND deleted_at IS NULL FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento pai não encontrado.',
      HINT    = 'pagamento_nao_encontrado',
      DETAIL  = jsonb_build_object('pagamento_id', v_pagamento_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 5. Lock + revalidação do item
  SELECT id, status INTO v_item
  FROM permuta_itens
  WHERE id = p_permuta_item_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item de permuta não encontrado.',
      HINT    = 'item_nao_encontrado',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 6. Idempotente: já cancelado
  IF v_item.status = 'cancelado' THEN
    SELECT calcular_status_permuta(v_pagamento_id) INTO v_novo_status;
    RETURN jsonb_build_object(
      'item_id',               p_permuta_item_id,
      'pagamento_id',          v_pagamento_id,
      'novo_status_pagamento', v_novo_status,
      'idempotente',           true
    );
  END IF;

  -- 7. Bloqueado: entregue não pode ser cancelado
  IF v_item.status = 'entregue' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item já entregue: não é possível cancelar.',
      HINT    = 'item_entregue',
      DETAIL  = jsonb_build_object('item_id', p_permuta_item_id)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 8. Cancelar item
  UPDATE permuta_itens SET
    status              = 'cancelado',
    data_cancelamento   = CURRENT_DATE,
    motivo_cancelamento = p_motivo_cancelamento,
    updated_by          = v_uid,
    updated_at          = now()
  WHERE id = p_permuta_item_id;

  -- 9. Recalcular e sincronizar status do pagamento
  SELECT calcular_status_permuta(v_pagamento_id) INTO v_novo_status;

  UPDATE pagamentos SET
    status     = v_novo_status,
    updated_by = v_uid,
    updated_at = now()
  WHERE id = v_pagamento_id;

  RETURN jsonb_build_object(
    'item_id',               p_permuta_item_id,
    'pagamento_id',          v_pagamento_id,
    'novo_status_pagamento', v_novo_status,
    'idempotente',           false
  );
END;
$$;

-- ── 5. cancelar_permuta ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancelar_permuta(
  p_pagamento_id        UUID,
  p_motivo_cancelamento TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid               UUID := auth.uid();
  v_pagamento         RECORD;
  v_itens_cancelados  INT  := 0;
  v_itens_entregues   INT  := 0;
  v_novo_status       TEXT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Motivo obrigatório
  IF p_motivo_cancelamento IS NULL OR length(trim(p_motivo_cancelamento)) = 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Motivo de cancelamento é obrigatório.',
      HINT    = 'motivo_obrigatorio',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Lock no pagamento (primeira posição na ordem global)
  SELECT id, forma_pagamento, status
  INTO v_pagamento
  FROM pagamentos
  WHERE id = p_pagamento_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento não encontrado.',
      HINT    = 'pagamento_nao_encontrado',
      DETAIL  = jsonb_build_object('pagamento_id', p_pagamento_id)::text,
      ERRCODE = 'P0001';
  END IF;

  IF v_pagamento.forma_pagamento <> 'permuta' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento não é do tipo permuta.',
      HINT    = 'pagamento_nao_permuta',
      DETAIL  = jsonb_build_object('forma_pagamento', v_pagamento.forma_pagamento)::text,
      ERRCODE = 'P0001';
  END IF;

  -- 4. Cancelar itens 'acordado' (lock implícito pelo UPDATE; ordem mantida pois
  --    já seguramos pagamentos → agora permuta_itens)
  UPDATE permuta_itens SET
    status              = 'cancelado',
    data_cancelamento   = CURRENT_DATE,
    motivo_cancelamento = p_motivo_cancelamento,
    updated_by          = v_uid,
    updated_at          = now()
  WHERE pagamento_id = p_pagamento_id
    AND deleted_at  IS NULL
    AND status       = 'acordado';

  GET DIAGNOSTICS v_itens_cancelados = ROW_COUNT;

  -- 5. Contar itens entregues preservados (não cancelamos entregues)
  SELECT COUNT(*) INTO v_itens_entregues
  FROM permuta_itens
  WHERE pagamento_id = p_pagamento_id
    AND deleted_at  IS NULL
    AND status       = 'entregue';

  -- 6. Recalcular e sincronizar status do pagamento
  SELECT calcular_status_permuta(p_pagamento_id) INTO v_novo_status;

  UPDATE pagamentos SET
    status     = v_novo_status,
    updated_by = v_uid,
    updated_at = now()
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object(
    'pagamento_id',                p_pagamento_id,
    'itens_cancelados',            v_itens_cancelados,
    'itens_entregues_preservados', v_itens_entregues,
    'novo_status_pagamento',       v_novo_status
  );
END;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────────
-- SECURITY INVOKER: as RPCs rodam com os privilégios do chamador.
-- O check de papel está inline; não é necessário GRANT especial além do
-- acesso que authenticated já tem via RLS nas tabelas subjacentes.

GRANT EXECUTE ON FUNCTION registrar_permuta(UUID, NUMERIC, JSONB, UUID, TEXT)
  TO authenticated;

GRANT EXECUTE ON FUNCTION confirmar_entrega_item_permuta(UUID, DATE, TEXT)
  TO authenticated;

GRANT EXECUTE ON FUNCTION cancelar_item_permuta(UUID, TEXT)
  TO authenticated;

GRANT EXECUTE ON FUNCTION cancelar_permuta(UUID, TEXT)
  TO authenticated;
