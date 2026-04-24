
-- Drop the old restrictive comercial policy
DROP POLICY IF EXISTS "Comercial view linked alunos" ON public.alunos;

-- Create a new policy that allows comercial to view all alunos
CREATE POLICY "Comercial view alunos"
ON public.alunos
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'comercial');
