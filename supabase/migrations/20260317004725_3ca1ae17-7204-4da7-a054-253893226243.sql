
ALTER TABLE public.eventos ADD COLUMN pago boolean NOT NULL DEFAULT false;
ALTER TABLE public.eventos ADD COLUMN valor numeric DEFAULT 0;

ALTER TABLE public.participantes_eventos ADD COLUMN valor numeric DEFAULT 0;
ALTER TABLE public.participantes_eventos ADD COLUMN status_pagamento text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.participantes_eventos ADD COLUMN forma_pagamento text;
ALTER TABLE public.participantes_eventos ADD COLUMN data_pagamento date;
