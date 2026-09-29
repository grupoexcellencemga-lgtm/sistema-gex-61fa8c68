-- ─────────────────────────────────────────────────────────────────────────────
-- Gestão de permutas — editar e excluir item/permuta
-- RPCs: editar_item_permuta, excluir_item_permuta,
--        editar_permuta, excluir_permuta
-- Lock order global: pagamentos FOR UPDATE → permuta_itens FOR UPDATE
-- Segurança: SECURITY INVOKER, role check inline, search_path fixo
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. editar_item_permuta ────────────────────────────────────────────────────
-- Edita tipo, descrição, valor, data_acordada e observação de um item não-cancelado.
-- Após a edição, recalcula pagamentos.valor (soma itens ativos) e pagamentos.status.

CREATE OR REPLACE FUNCTION editar_item_permuta(
  p_item_id       UUID,
  p_tipo          TEXT,
  p_descricao     TEXT,
  p_valor         NUMERIC(10,2),
  p_data_acordada DATE    DEFAULT NULL,
  p_observacao    TEXT    DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_pag_id      UUID;
  v_novo_valor  NUMERIC;
  v_novo_status TEXT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Validações de entrada
  IF p_tipo IS NULL OR p_tipo NOT IN ('servico', 'produto', 'outro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Tipo inválido.',
      HINT    = 'item_tipo_invalido',
      ERRCODE = 'P0001';
  END IF;

  IF p_descricao IS NULL OR length(trim(p_descricao)) < 3 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Descrição precisa ter ao menos 3 caracteres.',
      HINT    = 'item_descricao_curta',
      ERRCODE = 'P0001';
  END IF;

  IF p_valor < 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Valor não pode ser negativo.',
      HINT    = 'item_valor_invalido',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Busca pagamento_id (leitura antes do lock)
  SELECT pagamento_id INTO v_pag_id
  FROM permuta_itens
  WHERE id = p_item_id
    AND deleted_at IS NULL
    AND status <> 'cancelado';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item não encontrado ou já cancelado.',
      HINT    = 'item_nao_encontrado',
      ERRCODE = 'P0001';
  END IF;

  -- 4. Lock: pagamento → item (ordem global)
  PERFORM id FROM pagamentos WHERE id = v_pag_id FOR UPDATE;
  PERFORM id FROM permuta_itens WHERE id = p_item_id FOR UPDATE;

  -- 5. Atualiza item
  UPDATE permuta_itens
  SET
    tipo          = p_tipo,
    descricao     = trim(p_descricao),
    valor         = p_valor,
    data_acordada = COALESCE(p_data_acordada, data_acordada),
    observacao    = p_observacao,
    updated_by    = v_uid
  WHERE id = p_item_id;

  -- 6. Recalcula pagamentos.valor = soma dos itens ativos
  SELECT COALESCE(SUM(valor), 0)
  INTO v_novo_valor
  FROM permuta_itens
  WHERE pagamento_id = v_pag_id
    AND status <> 'cancelado'
    AND deleted_at IS NULL;

  -- 7. Recalcula pagamentos.status canonicamente
  v_novo_status := calcular_status_permuta(v_pag_id);

  UPDATE pagamentos
  SET valor = v_novo_valor, status = v_novo_status, updated_by = v_uid
  WHERE id = v_pag_id;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_item_permuta(UUID, TEXT, TEXT, NUMERIC, DATE, TEXT)
  TO authenticated;


-- ── 2. excluir_item_permuta ───────────────────────────────────────────────────
-- Cancela (soft-delete via status='cancelado') qualquer item não-cancelado,
-- incluindo entregues (estorno: quitadoPermuta diminui).
-- Recalcula pagamentos.valor e pagamentos.status após a operação.

CREATE OR REPLACE FUNCTION excluir_item_permuta(
  p_item_id UUID,
  p_motivo  TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_pag_id      UUID;
  v_novo_valor  NUMERIC;
  v_novo_status TEXT;
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Motivo obrigatório
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Motivo é obrigatório.',
      HINT    = 'motivo_obrigatorio',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Busca pagamento_id
  SELECT pagamento_id INTO v_pag_id
  FROM permuta_itens
  WHERE id = p_item_id
    AND deleted_at IS NULL
    AND status <> 'cancelado';

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Item não encontrado ou já cancelado.',
      HINT    = 'item_nao_encontrado',
      ERRCODE = 'P0001';
  END IF;

  -- 4. Lock: pagamento → item
  PERFORM id FROM pagamentos WHERE id = v_pag_id FOR UPDATE;
  PERFORM id FROM permuta_itens WHERE id = p_item_id FOR UPDATE;

  -- 5. Cancela item
  UPDATE permuta_itens
  SET
    status              = 'cancelado',
    data_cancelamento   = CURRENT_DATE,
    motivo_cancelamento = trim(p_motivo),
    updated_by          = v_uid
  WHERE id = p_item_id;

  -- 6. Recalcula pagamentos.valor
  SELECT COALESCE(SUM(valor), 0)
  INTO v_novo_valor
  FROM permuta_itens
  WHERE pagamento_id = v_pag_id
    AND status <> 'cancelado'
    AND deleted_at IS NULL;

  -- 7. Recalcula pagamentos.status
  v_novo_status := calcular_status_permuta(v_pag_id);

  UPDATE pagamentos
  SET valor = v_novo_valor, status = v_novo_status, updated_by = v_uid
  WHERE id = v_pag_id;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_item_permuta(UUID, TEXT)
  TO authenticated;


-- ── 3. editar_permuta ─────────────────────────────────────────────────────────
-- Edita apenas a observação do pagamento pai da permuta.
-- Sem impacto financeiro; não recalcula valor nem status.

CREATE OR REPLACE FUNCTION editar_permuta(
  p_pagamento_id UUID,
  p_observacao   TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Lock do pagamento
  PERFORM id FROM pagamentos
  WHERE id = p_pagamento_id
    AND forma_pagamento = 'permuta'
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento de permuta não encontrado.',
      HINT    = 'pagamento_nao_encontrado',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Atualiza observação
  UPDATE pagamentos
  SET observacao = p_observacao, updated_by = v_uid
  WHERE id = p_pagamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION editar_permuta(UUID, TEXT)
  TO authenticated;


-- ── 4. excluir_permuta ────────────────────────────────────────────────────────
-- Cancela TODOS os itens não-cancelados da permuta, incluindo entregues (estorno
-- completo). Define pagamentos.status = 'cancelado' e valor = 0.
-- Diferença de cancelar_permuta: inclui itens entregues no cancelamento.

CREATE OR REPLACE FUNCTION excluir_permuta(
  p_pagamento_id UUID,
  p_motivo       TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  -- 1. Role
  IF NOT (public.has_role(v_uid, 'admin') OR public.get_user_role(v_uid) = 'financeiro') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Papel admin ou financeiro necessário.',
      HINT    = 'permissao_negada',
      ERRCODE = 'P0001';
  END IF;

  -- 2. Motivo obrigatório
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Motivo é obrigatório.',
      HINT    = 'motivo_obrigatorio',
      ERRCODE = 'P0001';
  END IF;

  -- 3. Lock do pagamento
  PERFORM id FROM pagamentos
  WHERE id = p_pagamento_id
    AND forma_pagamento = 'permuta'
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Pagamento de permuta não encontrado.',
      HINT    = 'pagamento_nao_encontrado',
      ERRCODE = 'P0001';
  END IF;

  -- 4. Cancela TODOS os itens não-cancelados (acordado E entregue)
  UPDATE permuta_itens
  SET
    status              = 'cancelado',
    data_cancelamento   = CURRENT_DATE,
    motivo_cancelamento = trim(p_motivo),
    updated_by          = v_uid
  WHERE pagamento_id = p_pagamento_id
    AND status <> 'cancelado'
    AND deleted_at IS NULL;

  -- 5. Marca pagamento como cancelado; zera valor (todos itens cancelados)
  UPDATE pagamentos
  SET status = 'cancelado', valor = 0, updated_by = v_uid
  WHERE id = p_pagamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION excluir_permuta(UUID, TEXT)
  TO authenticated;
