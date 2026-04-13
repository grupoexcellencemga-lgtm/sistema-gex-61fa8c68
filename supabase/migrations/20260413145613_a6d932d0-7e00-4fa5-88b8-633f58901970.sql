
-- ═══ PAGAMENTOS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view pagamentos" ON public.pagamentos;
CREATE POLICY "Authenticated can view pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (true);

-- ═══ DESPESAS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view despesas" ON public.despesas;
CREATE POLICY "Authenticated can view despesas" ON public.despesas FOR SELECT TO authenticated USING (true);

-- ═══ CONTAS_A_PAGAR: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view contas_a_pagar" ON public.contas_a_pagar;
CREATE POLICY "Authenticated can view contas_a_pagar" ON public.contas_a_pagar FOR SELECT TO authenticated USING (true);

-- ═══ FECHAMENTOS_MENSAIS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view fechamentos" ON public.fechamentos_mensais;
CREATE POLICY "Authenticated can view fechamentos" ON public.fechamentos_mensais FOR SELECT TO authenticated USING (true);

-- ═══ PAGAMENTOS_PROCESSO: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view pagamentos_processo" ON public.pagamentos_processo;
DROP POLICY IF EXISTS "Profissional view own pagamentos_processo" ON public.pagamentos_processo;
CREATE POLICY "Authenticated can view pagamentos_processo" ON public.pagamentos_processo FOR SELECT TO authenticated USING (true);

-- ═══ PAGAMENTOS_PROCESSO_EMPRESARIAL: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view pag_proc_emp" ON public.pagamentos_processo_empresarial;
DROP POLICY IF EXISTS "Profissional view own pag_proc_emp" ON public.pagamentos_processo_empresarial;
CREATE POLICY "Authenticated can view pag_proc_emp" ON public.pagamentos_processo_empresarial FOR SELECT TO authenticated USING (true);

-- ═══ PAGAMENTOS_PROFISSIONAL: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Admin or financeiro view pagamentos_profissional" ON public.pagamentos_profissional;
CREATE POLICY "Authenticated can view pagamentos_profissional" ON public.pagamentos_profissional FOR SELECT TO authenticated USING (true);

-- ═══ COMISSOES: remover bloqueio de profissional e abrir leitura ═══
DROP POLICY IF EXISTS "Block profissional from comissoes" ON public.comissoes;
DROP POLICY IF EXISTS "Filtered view comissoes" ON public.comissoes;
CREATE POLICY "Authenticated can view comissoes" ON public.comissoes FOR SELECT TO authenticated USING (true);

-- ═══ LEADS: remover bloqueio e abrir leitura ═══
DROP POLICY IF EXISTS "Block restricted from leads" ON public.leads;
DROP POLICY IF EXISTS "Filtered view leads" ON public.leads;
CREATE POLICY "Authenticated can view leads" ON public.leads FOR SELECT TO authenticated USING (true);

-- ═══ PROCESSOS_INDIVIDUAIS: remover bloqueio e abrir leitura ═══
DROP POLICY IF EXISTS "Block restricted from processos_ind" ON public.processos_individuais;
DROP POLICY IF EXISTS "Filtered view processos_individuais" ON public.processos_individuais;
CREATE POLICY "Authenticated can view processos_individuais" ON public.processos_individuais FOR SELECT TO authenticated USING (true);

-- ═══ PROCESSOS_EMPRESARIAIS: remover bloqueio e abrir leitura ═══
DROP POLICY IF EXISTS "Block restricted from processos_emp" ON public.processos_empresariais;
DROP POLICY IF EXISTS "Filtered view processos_empresariais" ON public.processos_empresariais;
CREATE POLICY "Authenticated can view processos_empresariais" ON public.processos_empresariais FOR SELECT TO authenticated USING (true);

-- ═══ EVENTOS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Filtered view eventos" ON public.eventos;
CREATE POLICY "Authenticated can view eventos" ON public.eventos FOR SELECT TO authenticated USING (true);

-- ═══ ENCONTROS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Filtered view encontros" ON public.encontros;
CREATE POLICY "Authenticated can view encontros" ON public.encontros FOR SELECT TO authenticated USING (true);

-- ═══ PRESENCAS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Filtered view presencas" ON public.presencas;
CREATE POLICY "Authenticated can view presencas" ON public.presencas FOR SELECT TO authenticated USING (true);

-- ═══ PARTICIPANTES_EVENTOS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Filtered view participantes_eventos" ON public.participantes_eventos;
CREATE POLICY "Authenticated can view participantes_eventos" ON public.participantes_eventos FOR SELECT TO authenticated USING (true);

-- ═══ ALUNOS: simplificar para todos autenticados ═══
DROP POLICY IF EXISTS "Admin view alunos" ON public.alunos;
DROP POLICY IF EXISTS "Comercial view alunos" ON public.alunos;
DROP POLICY IF EXISTS "Financeiro view alunos" ON public.alunos;
DROP POLICY IF EXISTS "Suporte view alunos" ON public.alunos;
DROP POLICY IF EXISTS "Unrestricted view alunos" ON public.alunos;
CREATE POLICY "Authenticated can view alunos" ON public.alunos FOR SELECT TO authenticated USING (true);

-- ═══ MATRICULAS: abrir leitura para todos ═══
DROP POLICY IF EXISTS "Filtered view matriculas" ON public.matriculas;
CREATE POLICY "Authenticated can view matriculas" ON public.matriculas FOR SELECT TO authenticated USING (true);
