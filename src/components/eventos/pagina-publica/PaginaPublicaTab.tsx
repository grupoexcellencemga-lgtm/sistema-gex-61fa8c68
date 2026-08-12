import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink, Pencil, ImageOff } from "lucide-react";
import { PaginaPublicaEditor } from "./PaginaPublicaEditor";

export function PaginaPublicaTab({ evento }: { evento: any }) {
  const [editorAberto, setEditorAberto] = useState(false);

  const { data: eventoAtual } = useQuery({
    queryKey: ["evento-pagina-publica", evento.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("eventos")
        .select(
          "id, nome, data, local, status, pago, valor, limite_participantes, tipo, slug, pagina_publica_ativa, pagina_secoes, banner_url, link_pagamento"
        )
        .eq("id", evento.id)
        .single();
      if (error) throw error;
      return data;
    },
    initialData: {
      ...evento,
      pagina_secoes: evento.pagina_secoes ?? [],
    },
  });

  const linkPublico = eventoAtual?.slug
    ? `${window.location.origin}/e/${eventoAtual.slug}`
    : null;

  const totalSecoes: number = Array.isArray(eventoAtual?.pagina_secoes)
    ? eventoAtual.pagina_secoes.length
    : 0;

  return (
    <>
      <div className="space-y-4">
        {/* Status card */}
        <div className="rounded-xl border bg-muted/20 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Banner thumb */}
          <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden border bg-muted shrink-0 flex items-center justify-center">
            {eventoAtual?.banner_url ? (
              <img
                src={eventoAtual.banner_url}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageOff className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {eventoAtual?.pagina_publica_ativa ? (
                <Badge className="bg-green-600 text-white text-xs">Ao vivo</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Rascunho</Badge>
              )}
              {totalSecoes > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalSecoes} seção{totalSecoes !== 1 ? "ões" : ""}
                </Badge>
              )}
            </div>

            {linkPublico ? (
              <a
                href={linkPublico}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary flex items-center gap-1 hover:underline truncate"
              >
                <Globe className="h-3 w-3 shrink-0" />
                {linkPublico}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">
                Configure o slug para ter uma URL pública.
              </p>
            )}

            {totalSecoes === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma seção configurada ainda.
              </p>
            )}
          </div>
        </div>

        {/* Open editor */}
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => setEditorAberto(true)}
        >
          <Pencil className="h-4 w-4" />
          {totalSecoes === 0 ? "Criar página pública" : "Editar página pública"}
        </Button>

        {linkPublico && (
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Ver página ao vivo
            </a>
          </Button>
        )}
      </div>

      {editorAberto && (
        <PaginaPublicaEditor
          evento={eventoAtual}
          open={editorAberto}
          onClose={() => setEditorAberto(false)}
        />
      )}
    </>
  );
}
