
-- Inserir atividades de matrícula para cada matrícula existente
INSERT INTO public.atividades (tipo, descricao, aluno_id, created_at)
SELECT 
  'matricula',
  'Matrícula criada — ' || COALESCE(p.nome, 'Produto não definido') || 
  CASE WHEN t.nome IS NOT NULL THEN ' · Turma: ' || t.nome ELSE '' END ||
  CASE WHEN m.valor_final IS NOT NULL AND m.valor_final > 0 THEN ' · R$ ' || TRIM(TO_CHAR(m.valor_final, '999G999D00')) ELSE '' END,
  m.aluno_id,
  m.created_at
FROM public.matriculas m
LEFT JOIN public.produtos p ON p.id = m.produto_id
LEFT JOIN public.turmas t ON t.id = m.turma_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.atividades a 
  WHERE a.aluno_id = m.aluno_id 
  AND a.tipo = 'matricula' 
  AND a.created_at = m.created_at
);

-- Inserir atividades de pagamento confirmado
INSERT INTO public.atividades (tipo, descricao, aluno_id, created_at)
SELECT 
  'pagamento',
  'Pagamento confirmado — R$ ' || TRIM(TO_CHAR(COALESCE(pg.valor_pago, pg.valor), '999G999D00')) ||
  CASE WHEN pr.nome IS NOT NULL THEN ' · ' || pr.nome ELSE '' END ||
  CASE WHEN pg.parcela_atual IS NOT NULL AND pg.parcelas IS NOT NULL AND pg.parcelas > 1 
    THEN ' · Parcela ' || pg.parcela_atual || '/' || pg.parcelas 
    ELSE '' END,
  pg.aluno_id,
  COALESCE(pg.data_pagamento::timestamp with time zone, pg.created_at)
FROM public.pagamentos pg
LEFT JOIN public.produtos pr ON pr.id = pg.produto_id
WHERE pg.status = 'pago'
AND NOT EXISTS (
  SELECT 1 FROM public.atividades a 
  WHERE a.aluno_id = pg.aluno_id 
  AND a.tipo = 'pagamento' 
  AND a.created_at = COALESCE(pg.data_pagamento::timestamp with time zone, pg.created_at)
);
