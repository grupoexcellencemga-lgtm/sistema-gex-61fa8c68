
-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.fechar_mes_automatico(_mes integer DEFAULT NULL, _ano integer DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  conta RECORD;
  v_mes integer;
  v_ano integer;
  date_start date;
  date_end date;
  saldo numeric;
  saldo_base numeric;
  prev_fechamento RECORD;
  updated_count int := 0;
BEGIN
  -- Default: close the PREVIOUS month
  IF _mes IS NULL OR _ano IS NULL THEN
    v_mes := EXTRACT(MONTH FROM (now() - interval '1 day'))::int - 1; -- 0-indexed
    v_ano := EXTRACT(YEAR FROM (now() - interval '1 day'))::int;
    -- Adjust if we crossed year boundary
    IF EXTRACT(MONTH FROM (now() - interval '1 day'))::int = 1 THEN
      v_mes := 11; -- December, 0-indexed
      -- v_ano already correct from extraction
    ELSE
      v_mes := EXTRACT(MONTH FROM (now() - interval '1 day'))::int - 1;
    END IF;
    v_ano := EXTRACT(YEAR FROM (now() - interval '1 day'))::int;
  ELSE
    v_mes := _mes;
    v_ano := _ano;
  END IF;

  -- date range for the month (mes is 0-indexed like JS)
  date_start := make_date(v_ano, v_mes + 1, 1);
  date_end := (date_start + interval '1 month' - interval '1 day')::date;

  FOR conta IN
    SELECT id, saldo_inicial FROM contas_bancarias WHERE deleted_at IS NULL AND ativo = true
  LOOP
    -- Find previous fechamento for this account
    SELECT * INTO prev_fechamento
    FROM fechamentos_mensais
    WHERE conta_bancaria_id = conta.id
      AND (ano < v_ano OR (ano = v_ano AND mes < v_mes))
    ORDER BY ano DESC, mes DESC
    LIMIT 1;

    IF prev_fechamento IS NOT NULL THEN
      saldo_base := prev_fechamento.saldo_fechamento;
    ELSE
      saldo_base := conta.saldo_inicial;
    END IF;

    -- Calculate all movements up to end of this month (only movements AFTER previous fechamento)
    saldo := saldo_base;

    -- Entradas: pagamentos de alunos
    saldo := saldo + COALESCE((
      SELECT sum(valor) FROM pagamentos
      WHERE deleted_at IS NULL AND status = 'pago'
        AND conta_bancaria_id = conta.id
        AND data_pagamento >= date_start AND data_pagamento <= date_end
    ), 0);

    -- Entradas: receitas avulsas
    saldo := saldo + COALESCE((
      SELECT sum(valor) FROM receitas_avulsas
      WHERE conta_bancaria_id = conta.id
        AND data >= date_start AND data <= date_end
    ), 0);

    -- Entradas: pagamentos de processos individuais
    saldo := saldo + COALESCE((
      SELECT sum(pp.valor) FROM pagamentos_processo pp
      JOIN processos_individuais pi ON pi.id = pp.processo_id
      WHERE pp.deleted_at IS NULL
        AND pi.conta_bancaria_id = conta.id
        AND pp.data >= date_start AND pp.data <= date_end
    ), 0);

    -- Entradas: pagamentos de processos empresariais
    saldo := saldo + COALESCE((
      SELECT sum(pe.valor) FROM pagamentos_processo_empresarial pe
      JOIN processos_empresariais pr ON pr.id = pe.processo_id
      WHERE pe.deleted_at IS NULL
        AND pr.conta_bancaria_id = conta.id
        AND pe.data >= date_start AND pe.data <= date_end
    ), 0);

    -- Entradas: transferências recebidas
    saldo := saldo + COALESCE((
      SELECT sum(valor) FROM transferencias_entre_contas
      WHERE deleted_at IS NULL
        AND conta_destino_id = conta.id
        AND data >= date_start AND data <= date_end
    ), 0);

    -- Saídas: despesas
    saldo := saldo - COALESCE((
      SELECT sum(valor) FROM despesas
      WHERE deleted_at IS NULL
        AND conta_bancaria_id = conta.id
        AND data >= date_start AND data <= date_end
    ), 0);

    -- Saídas: pagamentos a profissionais
    saldo := saldo - COALESCE((
      SELECT sum(valor) FROM pagamentos_profissional
      WHERE deleted_at IS NULL
        AND conta_bancaria_id = conta.id
        AND data >= date_start AND data <= date_end
    ), 0);

    -- Saídas: comissões pagas
    saldo := saldo - COALESCE((
      SELECT sum(valor_pago) FROM comissoes
      WHERE deleted_at IS NULL AND status = 'pago'
        AND conta_bancaria_id = conta.id
        AND data_pagamento >= date_start AND data_pagamento <= date_end
    ), 0);

    -- Saídas: transferências enviadas
    saldo := saldo - COALESCE((
      SELECT sum(valor) FROM transferencias_entre_contas
      WHERE deleted_at IS NULL
        AND conta_origem_id = conta.id
        AND data >= date_start AND data <= date_end
    ), 0);

    -- Upsert fechamento
    INSERT INTO fechamentos_mensais (conta_bancaria_id, mes, ano, saldo_fechamento)
    VALUES (conta.id, v_mes, v_ano, saldo)
    ON CONFLICT (conta_bancaria_id, mes, ano)
    DO UPDATE SET saldo_fechamento = EXCLUDED.saldo_fechamento;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN json_build_object('fechadas', updated_count, 'mes', v_mes, 'ano', v_ano);
END;
$$;

-- Add unique constraint for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fechamentos_mensais_conta_mes_ano_key'
  ) THEN
    ALTER TABLE fechamentos_mensais ADD CONSTRAINT fechamentos_mensais_conta_mes_ano_key
    UNIQUE (conta_bancaria_id, mes, ano);
  END IF;
END $$;
