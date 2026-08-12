import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { PaginaPreview } from "@/components/eventos/pagina-publica/PaginaPreview";
import type { Secao } from "@/components/eventos/pagina-publica/types";

const EventoPublico = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: evento, isLoading, error } = useQuery({
    queryKey: ["evento-publico", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select(
          "id, nome, descricao, data, local, pago, valor, limite_participantes, tipo, status, banner_url, pagina_secoes, link_pagamento, pagina_publica_ativa"
        )
        .eq("slug", slug)
        .eq("pagina_publica_ativa", true)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const handleInscrever = () => navigate(`/inscricao/${evento.id}`);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !evento) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-4">
        <div className="space-y-2">
          <p className="text-xl font-semibold">Evento não encontrado</p>
          <p className="text-muted-foreground text-sm">
            Este link pode ter expirado ou o evento não está disponível.
          </p>
        </div>
      </div>
    );
  }

  const secoes: Secao[] = Array.isArray(evento.pagina_secoes)
    ? evento.pagina_secoes
    : [];

  return <PaginaPreview evento={evento} secoes={secoes} onInscrever={handleInscrever} />;
};

export default EventoPublico;
