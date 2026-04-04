
-- 1. Add comercial_id to profiles for linking users to vendedores
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS comercial_id uuid REFERENCES public.comerciais(id) ON DELETE SET NULL;

-- 2. Function to get user's linked comercial_id
CREATE OR REPLACE FUNCTION public.get_user_comercial_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT comercial_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- 3. Update can_access_by_responsavel to block comercial-only users from profissional data
CREATE OR REPLACE FUNCTION public.can_access_by_responsavel(_user_id uuid, _responsavel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin'::app_role)
    OR (
      public.get_user_profissional_nome(_user_id) IS NULL
      AND public.get_user_comercial_id(_user_id) IS NULL
    )
    OR (
      public.get_user_profissional_nome(_user_id) IS NOT NULL
      AND _responsavel IS NOT NULL
      AND lower(_responsavel) = lower(public.get_user_profissional_nome(_user_id))
    );
$$;

-- 4. Function for comercial-linked access
CREATE OR REPLACE FUNCTION public.can_access_by_comercial(_user_id uuid, _comercial_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR (
      public.get_user_profissional_nome(_user_id) IS NULL
      AND public.get_user_comercial_id(_user_id) IS NULL
    )
    OR (
      public.get_user_comercial_id(_user_id) IS NOT NULL
      AND _comercial_id IS NOT NULL
      AND _comercial_id = public.get_user_comercial_id(_user_id)
    );
$$;

-- 5. RLS for leads (vendedor via responsavel_id)
DROP POLICY IF EXISTS "Authenticated can view leads" ON public.leads;
CREATE POLICY "Filtered view leads" ON public.leads
FOR SELECT TO authenticated
USING (public.can_access_by_comercial(auth.uid(), responsavel_id));

DROP POLICY IF EXISTS "Authenticated can update leads" ON public.leads;
CREATE POLICY "Filtered update leads" ON public.leads
FOR UPDATE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), responsavel_id));

DROP POLICY IF EXISTS "Authenticated can delete leads" ON public.leads;
CREATE POLICY "Filtered delete leads" ON public.leads
FOR DELETE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), responsavel_id));

-- 6. RLS for matriculas (vendedor via comercial_id)
DROP POLICY IF EXISTS "Authenticated can view matriculas" ON public.matriculas;
CREATE POLICY "Filtered view matriculas" ON public.matriculas
FOR SELECT TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));

DROP POLICY IF EXISTS "Authenticated can update matriculas" ON public.matriculas;
CREATE POLICY "Filtered update matriculas" ON public.matriculas
FOR UPDATE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));

DROP POLICY IF EXISTS "Authenticated can delete matriculas" ON public.matriculas;
CREATE POLICY "Filtered delete matriculas" ON public.matriculas
FOR DELETE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));

-- 7. RLS for comissoes (vendedor via comercial_id)
DROP POLICY IF EXISTS "Authenticated can view comissoes" ON public.comissoes;
CREATE POLICY "Filtered view comissoes" ON public.comissoes
FOR SELECT TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));

DROP POLICY IF EXISTS "Authenticated can update comissoes" ON public.comissoes;
CREATE POLICY "Filtered update comissoes" ON public.comissoes
FOR UPDATE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));

DROP POLICY IF EXISTS "Authenticated can delete comissoes" ON public.comissoes;
CREATE POLICY "Filtered delete comissoes" ON public.comissoes
FOR DELETE TO authenticated
USING (public.can_access_by_comercial(auth.uid(), comercial_id));
