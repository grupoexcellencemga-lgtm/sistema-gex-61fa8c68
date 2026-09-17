-- Marca quando o lead ja gerou alerta de SLA, para o aviso nao repetir a cada
-- rodada do cron enquanto ninguem responde.
alter table public.leads
  add column if not exists sla_alertado_em timestamptz;

-- O verificar-sla filtra por direcao + tempo de espera e ignora quem ja foi
-- alertado; sem indice isso vira varredura completa a cada 15 minutos.
create index if not exists idx_leads_sla_pendente
  on public.leads (empresa_id, ultima_mensagem_em)
  where deleted_at is null and ultima_mensagem_direcao = 'entrada';
