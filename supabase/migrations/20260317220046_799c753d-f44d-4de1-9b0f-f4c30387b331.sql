
-- Add profissional_id to profiles for linking users to profissionais
ALTER TABLE public.profiles ADD COLUMN profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL;

-- Allow admins to update any profile (for linking profissional)
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Security definer function to get linked profissional name for a user
CREATE OR REPLACE FUNCTION public.get_user_profissional_nome(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.nome 
  FROM public.profissionais p
  JOIN public.profiles pr ON pr.profissional_id = p.id
  WHERE pr.user_id = _user_id
  LIMIT 1;
$$;

-- Helper function: check if user is admin, unrestricted, or record matches
CREATE OR REPLACE FUNCTION public.can_access_by_responsavel(_user_id uuid, _responsavel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.has_role(_user_id, 'admin'::app_role)
    OR public.get_user_profissional_nome(_user_id) IS NULL
    OR (
      _responsavel IS NOT NULL 
      AND lower(_responsavel) = lower(public.get_user_profissional_nome(_user_id))
    );
$$;

-- ========== processos_individuais ==========
DROP POLICY IF EXISTS "Authenticated can view processos_individuais" ON public.processos_individuais;
CREATE POLICY "Filtered view processos_individuais" ON public.processos_individuais
FOR SELECT TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can update processos_individuais" ON public.processos_individuais;
CREATE POLICY "Filtered update processos_individuais" ON public.processos_individuais
FOR UPDATE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can delete processos_individuais" ON public.processos_individuais;
CREATE POLICY "Filtered delete processos_individuais" ON public.processos_individuais
FOR DELETE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

-- ========== processos_empresariais ==========
DROP POLICY IF EXISTS "Authenticated can view processos_empresariais" ON public.processos_empresariais;
CREATE POLICY "Filtered view processos_empresariais" ON public.processos_empresariais
FOR SELECT TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can update processos_empresariais" ON public.processos_empresariais;
CREATE POLICY "Filtered update processos_empresariais" ON public.processos_empresariais
FOR UPDATE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can delete processos_empresariais" ON public.processos_empresariais;
CREATE POLICY "Filtered delete processos_empresariais" ON public.processos_empresariais
FOR DELETE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

-- ========== turmas ==========
DROP POLICY IF EXISTS "Authenticated can view turmas" ON public.turmas;
CREATE POLICY "Filtered view turmas" ON public.turmas
FOR SELECT TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can update turmas" ON public.turmas;
CREATE POLICY "Filtered update turmas" ON public.turmas
FOR UPDATE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can delete turmas" ON public.turmas;
CREATE POLICY "Filtered delete turmas" ON public.turmas
FOR DELETE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

-- ========== eventos ==========
DROP POLICY IF EXISTS "Authenticated can view eventos" ON public.eventos;
CREATE POLICY "Filtered view eventos" ON public.eventos
FOR SELECT TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can update eventos" ON public.eventos;
CREATE POLICY "Filtered update eventos" ON public.eventos
FOR UPDATE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can delete eventos" ON public.eventos;
CREATE POLICY "Filtered delete eventos" ON public.eventos
FOR DELETE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

-- ========== produtos ==========
DROP POLICY IF EXISTS "Authenticated can view produtos" ON public.produtos;
CREATE POLICY "Filtered view produtos" ON public.produtos
FOR SELECT TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can update produtos" ON public.produtos;
CREATE POLICY "Filtered update produtos" ON public.produtos
FOR UPDATE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

DROP POLICY IF EXISTS "Authenticated can delete produtos" ON public.produtos;
CREATE POLICY "Filtered delete produtos" ON public.produtos
FOR DELETE TO authenticated
USING (public.can_access_by_responsavel(auth.uid(), responsavel));

-- ========== participantes_eventos (indirect via evento) ==========
DROP POLICY IF EXISTS "Authenticated can view participantes_eventos" ON public.participantes_eventos;
CREATE POLICY "Filtered view participantes_eventos" ON public.participantes_eventos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.get_user_profissional_nome(auth.uid()) IS NULL
  OR evento_id IN (
    SELECT id FROM public.eventos 
    WHERE lower(responsavel) = lower(public.get_user_profissional_nome(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated can update participantes_eventos" ON public.participantes_eventos;
CREATE POLICY "Filtered update participantes_eventos" ON public.participantes_eventos
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.get_user_profissional_nome(auth.uid()) IS NULL
  OR evento_id IN (
    SELECT id FROM public.eventos 
    WHERE lower(responsavel) = lower(public.get_user_profissional_nome(auth.uid()))
  )
);

DROP POLICY IF EXISTS "Authenticated can delete participantes_eventos" ON public.participantes_eventos;
CREATE POLICY "Filtered delete participantes_eventos" ON public.participantes_eventos
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.get_user_profissional_nome(auth.uid()) IS NULL
  OR evento_id IN (
    SELECT id FROM public.eventos 
    WHERE lower(responsavel) = lower(public.get_user_profissional_nome(auth.uid()))
  )
);
