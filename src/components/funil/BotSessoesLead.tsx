import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronDown, ChevronUp, Handshake, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Sessao = {
  id: string;
  agente_id: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  houve_handoff: boolean;
  motivo_fim: string | null;
  total_mensagens: number;
  total_iteracoes: number;
  score_inicial: number | null;
  score_final: number | null;
  resumo: string | null;
  agentes_bot: { nome: string } | null;
};

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDur(ini: string, fim: string | null) {
  if (!fim) return null;
  const s = Math.round((new Date(fim).getTime() - new Date(ini).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}min`;
}

function ScoreDelta({ ini, fim }: { ini: number | null; fim: number | null }) {
  if (ini == null || fim == null) return null;
  const delta = fim - ini;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium",
      delta > 0 ? "text-green-600 dark:text-green-400" : delta < 0 ? "text-red-500" : "text-muted-foreground"
    )}>
      <Icon className="h-3 w-3" />
      {ini}→{fim}
    </span>
  );
}

type Props = { leadId: string };

export function BotSessoesLead({ leadId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sessoes = [], isLoading } = useQuery<Sessao[]>({
    queryKey: ["bot-sessoes-lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversas_ia")
        .select("id, agente_id, iniciado_em, finalizado_em, houve_handoff, motivo_fim, total_mensagens, total_iteracoes, score_inicial, score_final, resumo, agentes_bot(nome)")
        .eq("lead_id", leadId)
        .is("deleted_at", null)
        .order("iniciado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Sessao[];
    },
    enabled: !!leadId,
  });

  if (isLoading || sessoes.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-2">
      <button
        type="button"
        className="w-full flex items-center justify-between text-sm font-semibold hover:text-primary transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" />
          Sessões do Bot IA
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{sessoes.length}</Badge>
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {sessoes.map((s) => {
            const dur = fmtDur(s.iniciado_em, s.finalizado_em);
            const isOpen = expandedId === s.id;
            return (
              <div key={s.id} className="rounded-lg border bg-muted/30 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-start gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(isOpen ? null : s.id)}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium">{fmtDt(s.iniciado_em)}</span>
                      {s.agentes_bot?.nome && (
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0">{s.agentes_bot.nome}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{s.total_mensagens} msgs · {s.total_iteracoes} itr{dur ? ` · ${dur}` : ""}</span>
                      {s.houve_handoff && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          <Handshake className="h-3 w-3" />handoff
                        </span>
                      )}
                      <ScoreDelta ini={s.score_inicial} fim={s.score_final} />
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                </button>

                {isOpen && s.resumo && (
                  <div className="px-3 pb-3 pt-0">
                    <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">
                      <span className="font-medium text-foreground">Resumo: </span>
                      {s.resumo}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
