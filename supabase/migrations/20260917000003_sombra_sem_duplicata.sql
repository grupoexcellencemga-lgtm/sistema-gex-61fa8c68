-- A checagem "já avaliei esta mensagem?" feita em código não basta: uma rodada
-- do processar-bot leva ~70s e o cron dispara a cada 2 min, então duas
-- execuções se sobrepõem e ambas passam pela checagem antes de qualquer uma
-- gravar. Sem isto, cada mensagem gera resposta duplicada na revisão e cobra
-- API duas vezes.

-- Limpa as duplicatas que a corrida já produziu, mantendo a primeira.
delete from public.respostas_sombra s
using public.respostas_sombra outra
where s.mensagem_entrada_id = outra.mensagem_entrada_id
  and s.mensagem_entrada_id is not null
  and s.created_at > outra.created_at;

create unique index if not exists uniq_respostas_sombra_mensagem
  on public.respostas_sombra (mensagem_entrada_id)
  where mensagem_entrada_id is not null;
