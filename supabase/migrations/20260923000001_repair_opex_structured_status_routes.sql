-- Repara o nó de condição da IA de confirmação do fluxo OPEX.
-- A migração só atua quando encontra a assinatura esperada e a condição ainda
-- não possui nenhuma saída, para não sobrescrever edições posteriores.
DO $$
DECLARE
  target_flow_id uuid;
  current_flow jsonb;
  updated_nodes jsonb;
  updated_edges jsonb;
BEGIN
  SELECT f.id, f.fluxo_json
    INTO target_flow_id, current_flow
  FROM fluxos_bot f
  WHERE upper(coalesce(f.palavra_chave, '')) = 'OPEX'
    AND f.ativo = true
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(f.fluxo_json->'nodes') n
      WHERE n->>'id' = 'n133'
        AND n->>'type' = 'condition'
        AND n->'data'->>'sourceType' = 'node_output'
        AND n->'data'->>'sourceNodeId' = 'n127'
        AND n->'data'->>'sourceField' = 'status'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(f.fluxo_json->'edges') e
      WHERE e->>'source' = 'n133'
    )
  ORDER BY f.updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF target_flow_id IS NULL THEN
    RAISE NOTICE 'Fluxo OPEX já corrigido ou assinatura esperada não encontrada.';
    RETURN;
  END IF;

  SELECT jsonb_agg(
    CASE
      WHEN n->>'id' = 'n133' THEN
        jsonb_set(
          n,
          '{data}',
          (n->'data') || jsonb_build_object(
            'opcoes', jsonb_build_array(
              jsonb_build_object('id', 'status_comprovante_recebido', 'label', 'COMPROVANTE_RECEBIDO', 'palavras', 'COMPROVANTE_RECEBIDO'),
              jsonb_build_object('id', 'status_aguardando_comprovante', 'label', 'AGUARDANDO_COMPROVANTE', 'palavras', 'AGUARDANDO_COMPROVANTE'),
              jsonb_build_object('id', 'status_comprovante_ilegivel', 'label', 'COMPROVANTE_ILEGIVEL', 'palavras', 'COMPROVANTE_ILEGIVEL'),
              jsonb_build_object('id', 'status_problema_pagamento', 'label', 'PROBLEMA_PAGAMENTO', 'palavras', 'PROBLEMA_PAGAMENTO'),
              jsonb_build_object('id', 'status_atendimento_humano', 'label', 'ATENDIMENTO_HUMANO', 'palavras', 'ATENDIMENTO_HUMANO'),
              jsonb_build_object('id', 'status_desistencia', 'label', 'DESISTENCIA', 'palavras', 'DESISTENCIA'),
              jsonb_build_object('id', 'status_alterar_forma_pagamento', 'label', 'ALTERAR_FORMA_PAGAMENTO', 'palavras', 'ALTERAR_FORMA_PAGAMENTO')
            )
          )
        )
      ELSE n
    END
  )
  INTO updated_nodes
  FROM jsonb_array_elements(current_flow->'nodes') n;

  updated_nodes := updated_nodes || jsonb_build_array(
    jsonb_build_object(
      'id', 'n134',
      'type', 'wait',
      'position', jsonb_build_object('x', -2220, 'y', 4050),
      'data', jsonb_build_object('mode', 'input', 'unit', 's', 'label', 'Aguardar resposta sobre o pagamento', 'value', 30)
    ),
    jsonb_build_object(
      'id', 'n135',
      'type', 'assign',
      'position', jsonb_build_object('x', -1740, 'y', 4050),
      'data', jsonb_build_object('label', 'Encaminhar para conclusão humana', 'action', 'queue')
    ),
    jsonb_build_object(
      'id', 'n136',
      'type', 'end',
      'position', jsonb_build_object('x', -1390, 'y', 4050),
      'data', jsonb_build_object('label', 'Encerrar atendimento')
    )
  );

  updated_edges := (current_flow->'edges') || jsonb_build_array(
    jsonb_build_object('id', 'repair-n133-received', 'source', 'n133', 'sourceHandle', 'status_comprovante_recebido', 'target', 'n135'),
    jsonb_build_object('id', 'repair-n133-awaiting', 'source', 'n133', 'sourceHandle', 'status_aguardando_comprovante', 'target', 'n134'),
    jsonb_build_object('id', 'repair-n133-illegible', 'source', 'n133', 'sourceHandle', 'status_comprovante_ilegivel', 'target', 'n134'),
    jsonb_build_object('id', 'repair-n133-problem', 'source', 'n133', 'sourceHandle', 'status_problema_pagamento', 'target', 'n134'),
    jsonb_build_object('id', 'repair-n133-human', 'source', 'n133', 'sourceHandle', 'status_atendimento_humano', 'target', 'n135'),
    jsonb_build_object('id', 'repair-n133-desistance', 'source', 'n133', 'sourceHandle', 'status_desistencia', 'target', 'n136'),
    jsonb_build_object('id', 'repair-n133-change-payment', 'source', 'n133', 'sourceHandle', 'status_alterar_forma_pagamento', 'target', 'n126'),
    jsonb_build_object('id', 'repair-n134-loop', 'source', 'n134', 'target', 'n127')
  );

  UPDATE fluxos_bot
  SET fluxo_json = jsonb_set(
    jsonb_set(current_flow, '{nodes}', updated_nodes),
    '{edges}',
    updated_edges
  )
  WHERE id = target_flow_id;
END $$;
