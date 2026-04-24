
-- Add new columns to metas table
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS responsavel_tipo TEXT DEFAULT 'todos';
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS responsavel_id UUID;

-- Create RPC to auto-update valor_atual for all active metas
CREATE OR REPLACE FUNCTION public.atualizar_metas_ativas()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  meta RECORD;
  novo_valor numeric;
  updated_count int := 0;
BEGIN
  FOR meta IN
    SELECT id, tipo, periodo_inicio, periodo_fim, responsavel_tipo, responsavel_id
    FROM metas
    WHERE periodo_inicio <= current_date AND periodo_fim >= current_date
  LOOP
    novo_valor := NULL;

    IF meta.tipo = 'receita' THEN
      SELECT coalesce(sum(coalesce(valor_pago, valor)), 0) INTO novo_valor
      FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pago'
        AND data_pagamento >= meta.periodo_inicio AND data_pagamento <= meta.periodo_fim;

    ELSIF meta.tipo = 'matriculas' THEN
      SELECT count(*) INTO novo_valor
      FROM matriculas
      WHERE deleted_at IS NULL AND status = 'ativo'
        AND created_at >= meta.periodo_inicio AND created_at < meta.periodo_fim + interval '1 day';

    ELSIF meta.tipo = 'leads' THEN
      IF meta.responsavel_tipo = 'comercial' AND meta.responsavel_id IS NOT NULL THEN
        SELECT count(*) INTO novo_valor
        FROM leads
        WHERE deleted_at IS NULL
          AND responsavel_id = meta.responsavel_id
          AND created_at >= meta.periodo_inicio AND created_at < meta.periodo_fim + interval '1 day';
      ELSE
        SELECT count(*) INTO novo_valor
        FROM leads
        WHERE deleted_at IS NULL
          AND created_at >= meta.periodo_inicio AND created_at < meta.periodo_fim + interval '1 day';
      END IF;

    ELSIF meta.tipo = 'processos' THEN
      SELECT count(*) INTO novo_valor
      FROM processos_individuais
      WHERE deleted_at IS NULL AND status = 'ativo'
        AND created_at >= meta.periodo_inicio AND created_at < meta.periodo_fim + interval '1 day';

    ELSIF meta.tipo = 'financeira' THEN
      -- Net revenue: receita - despesas
      SELECT
        coalesce((SELECT sum(coalesce(valor_pago, valor)) FROM pagamentos WHERE deleted_at IS NULL AND status = 'pago' AND data_pagamento >= meta.periodo_inicio AND data_pagamento <= meta.periodo_fim), 0)
        + coalesce((SELECT sum(valor) FROM receitas_avulsas WHERE data >= meta.periodo_inicio AND data <= meta.periodo_fim), 0)
        - coalesce((SELECT sum(valor) FROM despesas WHERE deleted_at IS NULL AND data >= meta.periodo_inicio AND data <= meta.periodo_fim), 0)
      INTO novo_valor;
    END IF;

    IF novo_valor IS NOT NULL THEN
      UPDATE metas SET valor_atual = novo_valor, updated_at = now() WHERE id = meta.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object('updated', updated_count);
END;
$$;
