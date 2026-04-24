
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial', 'financeiro', 'suporte');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PRODUTOS
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('curso', 'comunidade', 'evento')),
  responsavel TEXT,
  duracao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert produtos" ON public.produtos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update produtos" ON public.produtos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete produtos" ON public.produtos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TURMAS
CREATE TABLE public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  modalidade TEXT NOT NULL CHECK (modalidade IN ('presencial', 'online')),
  data_inicio DATE,
  data_fim DATE,
  responsavel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view turmas" ON public.turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert turmas" ON public.turmas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update turmas" ON public.turmas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete turmas" ON public.turmas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_turmas_updated_at BEFORE UPDATE ON public.turmas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ALUNOS
CREATE TABLE public.alunos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  data_nascimento DATE,
  sexo TEXT CHECK (sexo IN ('masculino', 'feminino', 'outro')),
  cidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view alunos" ON public.alunos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert alunos" ON public.alunos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update alunos" ON public.alunos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete alunos" ON public.alunos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_alunos_updated_at BEFORE UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATRICULAS
CREATE TABLE public.matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  turma_id UUID REFERENCES public.turmas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo', 'pendente', 'cancelado', 'finalizado')),
  data_inicio DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view matriculas" ON public.matriculas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert matriculas" ON public.matriculas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update matriculas" ON public.matriculas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete matriculas" ON public.matriculas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_matriculas_updated_at BEFORE UPDATE ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAGAMENTOS
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  valor DECIMAL(10,2) NOT NULL,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('cartao', 'boleto', 'pix', 'dinheiro')),
  parcelas INTEGER DEFAULT 1,
  parcela_atual INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'vencido', 'cancelado')),
  data_vencimento DATE,
  data_pagamento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pagamentos" ON public.pagamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pagamentos" ON public.pagamentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete pagamentos" ON public.pagamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_pagamentos_updated_at BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EVENTOS
CREATE TABLE public.eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT CHECK (tipo IN ('workshop', 'palestra', 'caminhada', 'jantar', 'encontro')),
  data DATE,
  local TEXT,
  responsavel TEXT,
  limite_participantes INTEGER,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view eventos" ON public.eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert eventos" ON public.eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update eventos" ON public.eventos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete eventos" ON public.eventos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_eventos_updated_at BEFORE UPDATE ON public.eventos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INSCRICOES EVENTOS
CREATE TABLE public.inscricoes_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  aluno_id UUID NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (evento_id, aluno_id)
);
ALTER TABLE public.inscricoes_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view inscricoes" ON public.inscricoes_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert inscricoes" ON public.inscricoes_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete inscricoes" ON public.inscricoes_eventos FOR DELETE TO authenticated USING (true);

-- LEADS (Funil Comercial)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cidade TEXT,
  produto_interesse TEXT,
  origem TEXT CHECK (origem IN ('site', 'indicacao', 'instagram', 'facebook', 'evento', 'outro')),
  etapa TEXT NOT NULL DEFAULT 'lead' CHECK (etapa IN ('lead', 'contato', 'negociacao', 'matricula', 'perdido')),
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view leads" ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leads" ON public.leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete leads" ON public.leads FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ATIVIDADES (Timeline)
CREATE TABLE public.atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('contato', 'observacao', 'pagamento', 'matricula', 'alerta', 'sistema')),
  descricao TEXT NOT NULL,
  autor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view atividades" ON public.atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert atividades" ON public.atividades FOR INSERT TO authenticated WITH CHECK (true);

-- METAS (OKRs)
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('alunos', 'receita', 'retencao', 'leads', 'eventos')),
  valor_meta DECIMAL(10,2) NOT NULL,
  valor_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view metas" ON public.metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert metas" ON public.metas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update metas" ON public.metas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete metas" ON public.metas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_metas_updated_at BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
