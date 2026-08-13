-- Isolamento multi-tenant: adiciona empresa_id em todas as tabelas de negócio.
-- GEx Educação: 480e60de-ccd4-4472-bea5-612dbd4661e0
-- GEx Consórcio: a8433f14-dac8-4d0f-9784-16b5b9f4a40c

DO $$
DECLARE
  gex_edu uuid := '480e60de-ccd4-4472-bea5-612dbd4661e0';
  gex_con uuid := 'a8433f14-dac8-4d0f-9784-16b5b9f4a40c';
BEGIN

-- ── BATCH 1: Entidades principais ───────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alunos' AND column_name='empresa_id') THEN
  ALTER TABLE public.alunos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.alunos SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.alunos ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_alunos_empresa ON public.alunos(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turmas' AND column_name='empresa_id') THEN
  ALTER TABLE public.turmas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.turmas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.turmas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_turmas_empresa ON public.turmas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='eventos' AND column_name='empresa_id') THEN
  ALTER TABLE public.eventos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.eventos SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.eventos ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_eventos_empresa ON public.eventos(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='empresa_id') THEN
  ALTER TABLE public.leads ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.leads SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.leads ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_leads_empresa ON public.leads(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='comerciais' AND column_name='empresa_id') THEN
  ALTER TABLE public.comerciais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.comerciais SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.comerciais ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_comerciais_empresa ON public.comerciais(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profissionais' AND column_name='empresa_id') THEN
  ALTER TABLE public.profissionais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.profissionais SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.profissionais ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_profissionais_empresa ON public.profissionais(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produtos' AND column_name='empresa_id') THEN
  ALTER TABLE public.produtos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.produtos SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.produtos ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='processos_individuais' AND column_name='empresa_id') THEN
  ALTER TABLE public.processos_individuais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.processos_individuais SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.processos_individuais ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_processos_ind_empresa ON public.processos_individuais(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='processos_empresariais' AND column_name='empresa_id') THEN
  ALTER TABLE public.processos_empresariais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.processos_empresariais SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.processos_empresariais ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_processos_emp_empresa ON public.processos_empresariais(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matriculas' AND column_name='empresa_id') THEN
  ALTER TABLE public.matriculas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.matriculas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.matriculas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_matriculas_empresa ON public.matriculas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='consorcios_leads' AND column_name='empresa_id') THEN
  ALTER TABLE public.consorcios_leads ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.consorcios_leads SET empresa_id = gex_con WHERE empresa_id IS NULL;
  ALTER TABLE public.consorcios_leads ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_consorcios_leads_empresa ON public.consorcios_leads(empresa_id);
END IF;

-- ── BATCH 2: Financeiro + Operações ─────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pagamentos' AND column_name='empresa_id') THEN
  ALTER TABLE public.pagamentos ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.pagamentos SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.pagamentos ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_pagamentos_empresa ON public.pagamentos(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='despesas' AND column_name='empresa_id') THEN
  ALTER TABLE public.despesas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.despesas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.despesas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_despesas_empresa ON public.despesas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas_bancarias' AND column_name='empresa_id') THEN
  ALTER TABLE public.contas_bancarias ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.contas_bancarias SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.contas_bancarias ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_contas_bancarias_empresa ON public.contas_bancarias(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas_a_pagar' AND column_name='empresa_id') THEN
  ALTER TABLE public.contas_a_pagar ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.contas_a_pagar SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.contas_a_pagar ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_contas_a_pagar_empresa ON public.contas_a_pagar(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receitas_avulsas' AND column_name='empresa_id') THEN
  ALTER TABLE public.receitas_avulsas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.receitas_avulsas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.receitas_avulsas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_receitas_avulsas_empresa ON public.receitas_avulsas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fechamentos_mensais' AND column_name='empresa_id') THEN
  ALTER TABLE public.fechamentos_mensais ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.fechamentos_mensais SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.fechamentos_mensais ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_fechamentos_mensais_empresa ON public.fechamentos_mensais(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categorias_despesas' AND column_name='empresa_id') THEN
  ALTER TABLE public.categorias_despesas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.categorias_despesas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.categorias_despesas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_categorias_despesas_empresa ON public.categorias_despesas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tarefas' AND column_name='empresa_id') THEN
  ALTER TABLE public.tarefas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.tarefas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.tarefas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_tarefas_empresa ON public.tarefas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='metas' AND column_name='empresa_id') THEN
  ALTER TABLE public.metas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.metas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.metas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_metas_empresa ON public.metas(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='funil_quadros' AND column_name='empresa_id') THEN
  ALTER TABLE public.funil_quadros ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.funil_quadros SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.funil_quadros ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_funil_quadros_empresa ON public.funil_quadros(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='divulgacao_quadros' AND column_name='empresa_id') THEN
  ALTER TABLE public.divulgacao_quadros ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.divulgacao_quadros SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.divulgacao_quadros ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_divulgacao_quadros_empresa ON public.divulgacao_quadros(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mindmaps' AND column_name='empresa_id') THEN
  ALTER TABLE public.mindmaps ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.mindmaps SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.mindmaps ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_mindmaps_empresa ON public.mindmaps(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='checklist_templates' AND column_name='empresa_id') THEN
  ALTER TABLE public.checklist_templates ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.checklist_templates SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.checklist_templates ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_checklist_templates_empresa ON public.checklist_templates(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_templates' AND column_name='empresa_id') THEN
  ALTER TABLE public.email_templates ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.email_templates SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.email_templates ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_email_templates_empresa ON public.email_templates(empresa_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='formas_pagamento' AND column_name='empresa_id') THEN
  ALTER TABLE public.formas_pagamento ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.formas_pagamento SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.formas_pagamento ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_formas_pagamento_empresa ON public.formas_pagamento(empresa_id);
END IF;

-- ── BATCH 3: Tabelas filho acessadas diretamente ────────────────────────────

-- encontros (acessado diretamente na Agenda e TurmaMetricasTab)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='encontros' AND column_name='empresa_id') THEN
  ALTER TABLE public.encontros ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.encontros e SET empresa_id = t.empresa_id FROM public.turmas t WHERE e.turma_id = t.id;
  UPDATE public.encontros SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.encontros ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_encontros_empresa ON public.encontros(empresa_id);
END IF;

-- funil_etapas (acessado diretamente no DashboardComercial e Funil)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='funil_etapas' AND column_name='empresa_id') THEN
  ALTER TABLE public.funil_etapas ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.funil_etapas fe SET empresa_id = fq.empresa_id FROM public.funil_quadros fq WHERE fe.quadro_id = fq.id;
  UPDATE public.funil_etapas SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  ALTER TABLE public.funil_etapas ALTER COLUMN empresa_id SET NOT NULL;
  CREATE INDEX idx_funil_etapas_empresa ON public.funil_etapas(empresa_id);
END IF;

-- notificacoes (NotificationBell filtra por empresa)
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificacoes' AND column_name='empresa_id') THEN
  ALTER TABLE public.notificacoes ADD COLUMN empresa_id uuid REFERENCES public.empresas(id);
  UPDATE public.notificacoes SET empresa_id = gex_edu WHERE empresa_id IS NULL;
  CREATE INDEX idx_notificacoes_empresa ON public.notificacoes(empresa_id);
END IF;

END $$;
