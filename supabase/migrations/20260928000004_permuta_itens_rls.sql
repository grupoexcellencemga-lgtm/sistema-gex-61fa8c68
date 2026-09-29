-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 / MIG 3 — RLS em permuta_itens
-- Mecanismo real do projeto: user_roles (app_role ENUM) + has_role() + get_user_role()
-- Padrão idêntico ao SELECT de pagamentos (20260330212329).
-- INSERT e UPDATE restritos a admin/financeiro (mais restrito que pagamentos).
-- DELETE não exposto — soft delete via deleted_at nas RPCs (Fase 2).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE permuta_itens ENABLE ROW LEVEL SECURITY;

-- SELECT: admin ou financeiro — mesmo padrão de pagamentos
CREATE POLICY "Admin ou financeiro view permuta_itens"
  ON permuta_itens
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.get_user_role(auth.uid()) = 'financeiro'
  );

-- INSERT: admin ou financeiro
CREATE POLICY "Admin ou financeiro insert permuta_itens"
  ON permuta_itens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.get_user_role(auth.uid()) = 'financeiro'
  );

-- UPDATE: admin ou financeiro — USING + WITH CHECK para prevenir reatribuição de empresa_id
CREATE POLICY "Admin ou financeiro update permuta_itens"
  ON permuta_itens
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.get_user_role(auth.uid()) = 'financeiro'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.get_user_role(auth.uid()) = 'financeiro'
  );
