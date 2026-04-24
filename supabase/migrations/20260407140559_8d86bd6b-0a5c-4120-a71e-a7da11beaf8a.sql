
-- Drop the old SELECT policy that restricts to owner only
DROP POLICY "Users can view own mindmaps" ON public.mindmaps;

-- Create new SELECT policy allowing all authenticated users to view all mindmaps
CREATE POLICY "Authenticated can view all mindmaps"
ON public.mindmaps
FOR SELECT
TO authenticated
USING (true);
