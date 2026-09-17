-- O processar-bot registrava o início da sessão em conversas_ia antes de
-- desviar para o modo sombra, e o desvio pula a finalização. Cada avaliação
-- virava uma conversa "abandonada" no Analytics. O código já não registra fora
-- do modo ativo; isto apaga as 53 geradas nos testes de 2026-09-17.
--
-- A tabela estava vazia antes desses testes e o único agente ligado no período
-- estava em modo sombra, então nenhuma destas linhas é conversa real com
-- cliente. O filtro é restrito a esse agente, a esse intervalo e a sessões
-- nunca finalizadas.
delete from public.conversas_ia
where agente_id = '74e22514-8a29-44d4-b05b-781faaaae23e'
  and finalizado_em is null
  and created_at >= '2026-09-17 12:30:00+00'
  and created_at <  '2026-09-17 13:30:00+00';
