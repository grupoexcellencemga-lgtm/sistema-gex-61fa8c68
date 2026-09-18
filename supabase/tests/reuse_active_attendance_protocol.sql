BEGIN;
SELECT set_config('request.jwt.claim.sub', '7cd522ff-6a44-4baf-b948-c36280bf3958', true);
SET LOCAL ROLE authenticated;
DO $test$
DECLARE p public.protocolos_atendimento%rowtype; r json; r2 json; before_count bigint; after_count bigint;
BEGIN
 SELECT * INTO p FROM public.protocolos_atendimento
 WHERE status='ativo' AND empresa_id='480e60de-ccd4-4472-bea5-612dbd4661e0' ORDER BY id LIMIT 1;
 IF p.id IS NULL THEN RAISE EXCEPTION 'Fixture ativo ausente'; END IF;
 SELECT count(*) INTO before_count FROM public.protocolos_atendimento WHERE lead_id=p.lead_id;
 r := public.criar_protocolo(p.empresa_id,p.lead_id,'7cd522ff-6a44-4baf-b948-c36280bf3958');
 r2 := public.criar_protocolo(p.empresa_id,p.lead_id,'7cd522ff-6a44-4baf-b948-c36280bf3958');
 SELECT count(*) INTO after_count FROM public.protocolos_atendimento WHERE lead_id=p.lead_id;
 IF (r->>'id')::uuid <> p.id OR (r2->>'id')::uuid <> p.id OR before_count<>after_count THEN
 RAISE EXCEPTION 'Assumir/reatribuir duplicou protocolo'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.protocolos_atendimento WHERE id=p.id AND status='ativo' AND iniciado_em=p.iniciado_em AND finalizado_em IS NULL AND atendente_id='7cd522ff-6a44-4baf-b948-c36280bf3958') THEN
 RAISE EXCEPTION 'Estado ou abertura do protocolo alterados'; END IF;
 PERFORM public.finalizar_protocolo(p.lead_id);
 r := public.criar_protocolo(p.empresa_id,p.lead_id,'7cd522ff-6a44-4baf-b948-c36280bf3958');
 IF (r->>'id')::uuid = p.id THEN RAISE EXCEPTION 'Novo ciclo não criou protocolo'; END IF;
 IF (SELECT count(*) FROM public.protocolos_atendimento WHERE lead_id=p.lead_id AND status='ativo')<>1 THEN RAISE EXCEPTION 'Mais de um ativo'; END IF;
 BEGIN
   PERFORM public.criar_protocolo('00000000-0000-0000-0000-000000000000',p.lead_id,'7cd522ff-6a44-4baf-b948-c36280bf3958');
   RAISE EXCEPTION 'Empresa inválida aceita';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$test$;
ROLLBACK;
