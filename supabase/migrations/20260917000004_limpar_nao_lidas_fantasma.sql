-- O atendimento acontece pelo WhatsApp do notebook, não pelo CRM. O webhook
-- registrava a mensagem enviada mas não zerava o contador, então conversas já
-- respondidas seguiam marcadas como não lidas para sempre -- eram 153 em 29
-- leads. A correção no webhook impede novos casos; isto limpa o acumulado.
--
-- Critério: se a ÚLTIMA mensagem da conversa foi nossa, não há nada pendente
-- de leitura. Leads aguardando resposta (última mensagem de entrada) não são
-- tocados.
update public.leads
set mensagens_nao_lidas = 0,
    tem_mensagem_nova = false
where deleted_at is null
  and ultima_mensagem_direcao = 'saida'
  and (mensagens_nao_lidas > 0 or tem_mensagem_nova = true);
