-- Tabela de sessões de conversa do agente IA com leads
CREATE TABLE IF NOT EXISTS public.conversas_ia (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lead_id          uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  agente_id        uuid REFERENCES public.agentes_bot(id) ON DELETE SET NULL,
  protocolo_id     uuid REFERENCES public.protocolos_atendimento(id) ON DELETE SET NULL,

  -- Timing
  iniciado_em      timestamptz NOT NULL DEFAULT now(),
  finalizado_em    timestamptz,

  -- Resultado
  houve_handoff    boolean NOT NULL DEFAULT false,
  motivo_fim       text CHECK (motivo_fim IN ('handoff', 'sem_resposta', 'encerrado', 'erro')),
  total_mensagens  integer NOT NULL DEFAULT 0,
  total_iteracoes  integer NOT NULL DEFAULT 0,   -- tool_use iterations

  -- Snapshot de score
  score_inicial    integer,
  score_final      integer,

  -- Resumo gerado pela IA no handoff ou encerramento
  resumo           text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- Índices de acesso frequente
CREATE INDEX IF NOT EXISTS conversas_ia_lead_id_idx       ON public.conversas_ia (lead_id);
CREATE INDEX IF NOT EXISTS conversas_ia_empresa_id_idx    ON public.conversas_ia (empresa_id);
CREATE INDEX IF NOT EXISTS conversas_ia_iniciado_em_idx   ON public.conversas_ia (iniciado_em DESC);

-- RLS
ALTER TABLE public.conversas_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversas_ia: leitura por empresa"
  ON public.conversas_ia FOR SELECT
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.user_empresa WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "conversas_ia: escrita pelo service role"
  ON public.conversas_ia FOR ALL
  USING (true)
  WITH CHECK (true);
