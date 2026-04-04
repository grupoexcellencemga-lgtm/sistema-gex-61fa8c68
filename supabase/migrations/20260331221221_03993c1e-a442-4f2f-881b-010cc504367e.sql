
-- Change Wagner's role to admin
DELETE FROM public.user_roles WHERE user_id = 'cf67361b-7da8-4195-bd1e-941ec1b99a4b';
INSERT INTO public.user_roles (user_id, role) VALUES ('cf67361b-7da8-4195-bd1e-941ec1b99a4b', 'admin');

-- Clear profissional/comercial links so useDataFilter doesn't restrict
UPDATE public.profiles 
SET profissional_id = NULL, comercial_id = NULL, updated_at = now()
WHERE user_id = 'cf67361b-7da8-4195-bd1e-941ec1b99a4b';
