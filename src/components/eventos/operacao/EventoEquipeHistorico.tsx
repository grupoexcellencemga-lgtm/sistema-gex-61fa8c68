import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, History } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  planejado: "Planejado",
  em_preparacao: "Em preparação",
  pronto: "Pronto",
  em_execucao: "Em execução",
  pos_evento: "Pós-evento",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

export const statusEventoLabel = (s: string | null) =>
  (s && STATUS_LABEL[s]) || s || "Planejado";

// Equipe: quem tem tarefas neste evento e o andamento de cada um.
export function EventoEquipeTab({ tarefas, profiles }: { tarefas: any[]; profiles: any[] }) {
  const porResponsavel = new Map<string, { nome: string; total: number; concluidas: number }>();
  tarefas.forEach((t) => {
    const nome =
      profiles.find((p: any) => p.user_id === t.responsavel_id)?.nome ||
      "Sem responsável";
    const atual = porResponsavel.get(nome) || { nome, total: 0, concluidas: 0 };
    atual.total += 1;
    if (t.status === "concluida") atual.concluidas += 1;
    porResponsavel.set(nome, atual);
  });
  const equipe = Array.from(porResponsavel.values()).sort(
    (a, b) => b.total - a.total,
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        {equipe.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
            <Users className="h-4 w-4" /> Nenhuma tarefa atribuída neste evento
            ainda.
          </p>
        )}
        {equipe.map((m) => (
          <div
            key={m.nome}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <span className="text-sm font-medium">{m.nome}</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-28 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${m.total > 0 ? (m.concluidas / m.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-14 text-right">
                {m.concluidas}/{m.total} feitas
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Histórico: timeline de mudanças de status do evento.
export function EventoHistoricoTab({ eventoId }: { eventoId: string }) {
  const { data: historico = [] } = useQuery({
    queryKey: ["evento-status-history", eventoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("evento_status_history")
        .select("*")
        .eq("evento_id", eventoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {historico.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6 flex items-center justify-center gap-2">
            <History className="h-4 w-4" /> Nenhuma mudança de status registrada.
          </p>
        )}
        {historico.map((h: any) => (
          <div key={h.id} className="flex items-start gap-3 text-sm">
            <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p>
                {h.status_anterior ? (
                  <>
                    <Badge variant="outline" className="text-xs mr-1">
                      {statusEventoLabel(h.status_anterior)}
                    </Badge>
                    →
                  </>
                ) : null}{" "}
                <Badge className="text-xs ml-1">
                  {statusEventoLabel(h.status_novo)}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(h.created_at).toLocaleString("pt-BR")}
                {h.alterado_por ? ` · por ${h.alterado_por}` : ""}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
