import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, X, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Sessao = {
  id: string;
  lead_id: string;
  fluxo_id: string;
  current_node_id: string;
  status: "active" | "waiting" | "completed";
  wait_until: string | null;
  updated_at: string;
  leads: { nome: string; telefone: string } | null;
  fluxos_bot: { nome: string; fluxo_json: any } | null;
};

function getNodeLabel(fluxoJson: any, nodeId: string): string {
  if (!fluxoJson?.nodes) return nodeId;
  const node = fluxoJson.nodes.find((n: any) => n.id === nodeId);
  if (!node) return nodeId;
  const nodeLabels: Record<string, string> = {
    start: "Início",
    message: node.data?.text
      ? `Msg: ${String(node.data.text).substring(0, 35)}${String(node.data.text).length > 35 ? "…" : ""}`
      : "Mensagem",
    condition: `Condição: ${node.data?.value || "(sem valor)"}`,
    wait: `Espera ${node.data?.value ?? ""}${node.data?.unit ?? "s"}`,
    ai: "Resposta IA",
    assign: "Transferido p/ fila",
    end: "Fim",
  };
  return nodeLabels[node.type] ?? node.type;
}

export function FluxoSessoesPanel() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const { data: sessoes = [], isLoading, refetch, isFetching } = useQuery<Sessao[]>({
    queryKey: ["fluxo-sessoes-ativas", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxo_sessoes")
        .select(`
          id, lead_id, fluxo_id, current_node_id, status, wait_until, updated_at,
          leads(nome, telefone),
          fluxos_bot(nome, fluxo_json)
        `)
        .eq("empresa_id", empresaId!)
        .in("status", ["active", "waiting"])
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Sessao[];
    },
    enabled: !!empresaId,
    refetchInterval: 15_000,
  });

  const encerrar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fluxo_sessoes")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxo-sessoes-ativas", empresaId] });
      toast.success("Sessão encerrada");
    },
    onError: () => toast.error("Erro ao encerrar sessão"),
  });

  if (!isLoading && sessoes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-green-500" />
            Sessões de Fluxo Ativas
            {sessoes.length > 0 && (
              <Badge className="h-5 px-1.5 text-[10px]">{sessoes.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {sessoes.map((s) => {
              const nodeLabel = getNodeLabel(s.fluxos_bot?.fluxo_json, s.current_node_id);
              const isWaiting = s.status === "waiting";
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card text-sm"
                >
                  {/* Status dot */}
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      isWaiting ? "bg-yellow-400" : "bg-green-500 animate-pulse"
                    )}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {s.leads?.nome || s.leads?.telefone || "Desconhecido"}
                      </span>
                      {s.leads?.nome && s.leads.telefone && (
                        <span className="text-muted-foreground text-xs">{s.leads.telefone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <span className="truncate max-w-[120px]">{s.fluxos_bot?.nome}</span>
                      <span>·</span>
                      <span className="font-mono text-foreground/70">{nodeLabel}</span>
                      {isWaiting && s.wait_until && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                            <Clock className="h-3 w-3" />
                            até{" "}
                            {new Date(s.wait_until).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Time + Encerrar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(s.updated_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => encerrar.mutate(s.id)}
                      title="Encerrar sessão"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
