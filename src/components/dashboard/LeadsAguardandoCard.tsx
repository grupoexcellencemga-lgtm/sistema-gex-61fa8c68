import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slaLabel, minutosAguardando, SLA_MINUTOS_PADRAO } from "@/components/funil/funilUtils";
import { MessageSquareWarning, ChevronRight } from "lucide-react";

const LIMITE_EXIBIDO = 8;

interface LeadAguardando {
  id: string;
  nome: string | null;
  telefone: string | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_direcao: string | null;
  ultima_mensagem_texto: string | null;
  sla_minutos: number | null;
}

export function LeadsAguardandoCard() {
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data: leads = [] } = useQuery<LeadAguardando[]>({
    queryKey: ["inicio-leads-aguardando", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("id, nome, telefone, ultima_mensagem_em, ultima_mensagem_direcao, ultima_mensagem_texto, sla_minutos")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .eq("ultima_mensagem_direcao", "entrada")
        .not("ultima_mensagem_em", "is", null)
        .order("ultima_mensagem_em", { ascending: true })
        .limit(60);
      return (data || []) as LeadAguardando[];
    },
    enabled: !!empresaId,
    // O rótulo é calculado sobre o relógio, então precisa reavaliar sozinho.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const atrasados = leads.filter((l) => {
    const min = minutosAguardando(l);
    return min !== null && min >= (l.sla_minutos ?? SLA_MINUTOS_PADRAO);
  });

  if (atrasados.length === 0) return null;

  const visiveis = atrasados.slice(0, LIMITE_EXIBIDO);
  const restantes = atrasados.length - visiveis.length;

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-destructive" />
          Precisam de você
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {atrasados.length} aguardando resposta
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {visiveis.map((lead) => {
          const sla = slaLabel(lead);
          return (
            <button
              key={lead.id}
              onClick={() => navigate("/funil")}
              className="w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {lead.nome || lead.telefone || "Sem nome"}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  {lead.ultima_mensagem_texto && (
                    <div className="text-xs text-muted-foreground truncate">
                      {lead.ultima_mensagem_texto}
                    </div>
                  )}
                </div>
                {sla && (
                  <div className={`text-sm shrink-0 whitespace-nowrap ${sla.color}`}>
                    {sla.text}
                  </div>
                )}
              </div>
            </button>
          );
        })}

        {restantes > 0 && (
          <button
            onClick={() => navigate("/funil")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            e mais {restantes} {restantes === 1 ? "lead" : "leads"} aguardando
          </button>
        )}
      </CardContent>
    </Card>
  );
}
