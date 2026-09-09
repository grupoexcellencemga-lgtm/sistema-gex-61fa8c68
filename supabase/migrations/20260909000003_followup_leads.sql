-- Contador de follow-ups enviados por lead (reset quando lead responde)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS followup_count integer DEFAULT 0;

-- Configuração de follow-up no agente
ALTER TABLE public.agentes_bot ADD COLUMN IF NOT EXISTS followup_ativo boolean DEFAULT false;
ALTER TABLE public.agentes_bot ADD COLUMN IF NOT EXISTS followup_intervalo_horas integer DEFAULT 24;
ALTER TABLE public.agentes_bot ADD COLUMN IF NOT EXISTS followup_max_tentativas integer DEFAULT 3;
ALTER TABLE public.agentes_bot ADD COLUMN IF NOT EXISTS followup_mensagens text[] DEFAULT ARRAY[
  'Oi! Tudo bem? Ainda posso te ajudar com informações sobre nossos cursos 😊',
  'Oi! Só passando para ver se ainda tem interesse. Qualquer dúvida, estou aqui!',
  'Olá! Última mensagem da minha parte — se quiser saber mais sobre nossos cursos no futuro, é só chamar. Até logo! 👋'
];
