import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Package,
  Bell,
  History,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { aplicarChecklistNoEvento } from "@/lib/checklistEvento";
import { ChecklistKanban } from "./operacao/ChecklistKanban";
import { EventoMateriaisTab } from "./operacao/EventoMateriaisTab";
import {
  EventoEquipeTab,
  EventoHistoricoTab,
  statusEventoLabel,
} from "./operacao/EventoEquipeHistorico";

const STATUS_EVENTO = [
  "planejado",
  "em_preparacao",
  "pronto",
  "em_execucao",
  "pos_evento",
  "finalizado",
  "cancelado",
];

// Painel operacional do evento (Fase 1): resumo, checklist kanban,
// equipe, materiais, notificações (Fase 2) e histórico de status.
export function EventoDetailSheet({
  evento,
  currentUserName,
}: {
  evento: any;
  currentUserName: string | null;
}) {
  const queryClient = useQueryClient();

  // Busca o evento fresco: os campos de checklist/status mudam dentro do painel.
  const { data: eventoAtual } = useQuery({
    queryKey: ["evento-operacao", evento.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("*")
        .eq("id", evento.id)
        .single();
      if (error) throw error;
      return data as any;
    },
    initialData: evento,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas-evento", evento.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select("*")
        .eq("evento_id", evento.id)
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas-evento", evento.id] });
    queryClient.invalidateQueries({ queryKey: ["evento-operacao", evento.id] });
    queryClient.invalidateQueries({ queryKey: ["eventos"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
  };

  const aplicarMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada");
      return aplicarChecklistNoEvento(
        {
          id: eventoAtual.id,
          nome: eventoAtual.nome,
          tipo: eventoAtual.tipo,
          data: eventoAtual.data,
        },
        auth.user.id,
      );
    },
    onSuccess: (r) => {
      invalidateAll();
      if (r.aplicado) {
        toast.success(
          `Checklist "${r.templateNome}" aplicado — ${r.tarefasCriadas} tarefa(s) criada(s)`,
        );
      } else if (r.motivo === "sem_template") {
        toast.info(
          `Nenhum modelo ativo para o tipo "${eventoAtual.tipo}". Crie em Configurações → Modelos de Checklist.`,
        );
      } else if (r.motivo === "ja_aplicado") {
        toast.info("Este evento já tem checklist aplicado.");
      } else if (r.motivo === "sem_data") {
        toast.error("Defina a data do evento antes de aplicar o checklist.");
      } else {
        toast.error("Evento sem tipo definido — edite o evento e defina o tipo.");
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async (novoStatus: string) => {
      const anterior = eventoAtual.status || "planejado";
      const { error } = await supabase
        .from("eventos")
        .update({ status: novoStatus } as any)
        .eq("id", evento.id);
      if (error) throw error;
      await (supabase as any).from("evento_status_history").insert({
        evento_id: evento.id,
        status_anterior: anterior,
        status_novo: novoStatus,
        alterado_por: currentUserName,
      });
    },
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({
        queryKey: ["evento-status-history", evento.id],
      });
      toast.success("Status do evento atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const pendentes = tarefas.filter((t: any) => t.status === "pendente");
  const concluidas = tarefas.filter((t: any) => t.status === "concluida");
  const atrasadas = pendentes.filter(
    (t: any) => t.data_vencimento && t.data_vencimento < hojeISO,
  );
  const temChecklist = !!eventoAtual.checklist_template_id;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumo" className="gap-1"><LayoutDashboard className="h-4 w-4" /> Resumo</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1"><ListChecks className="h-4 w-4" /> Checklist</TabsTrigger>
          <TabsTrigger value="equipe" className="gap-1"><Users className="h-4 w-4" /> Equipe</TabsTrigger>
          <TabsTrigger value="materiais" className="gap-1"><Package className="h-4 w-4" /> Materiais</TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-1"><Bell className="h-4 w-4" /> Notificações</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1"><History className="h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status do evento:</span>
              <Select
                value={eventoAtual.status || "planejado"}
                onValueChange={(v) => statusMutation.mutate(v)}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_EVENTO.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusEventoLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!temChecklist && (
              <Button
                onClick={() => aplicarMutation.mutate()}
                disabled={aplicarMutation.isPending}
                className="gap-2"
              >
                {aplicarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Aplicar checklist do tipo "{eventoAtual.tipo || "—"}"
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{tarefas.length}</p><p className="text-xs text-muted-foreground">Tarefas</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-amber-600">{pendentes.length}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{concluidas.length}</p><p className="text-xs text-muted-foreground">Concluídas</p></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{atrasadas.length}</p><p className="text-xs text-muted-foreground">Atrasadas</p></CardContent></Card>
          </div>

          {atrasadas.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span>
                <strong>{atrasadas.length} tarefa(s) atrasada(s):</strong>{" "}
                {atrasadas.slice(0, 3).map((t: any) => t.titulo).join(", ")}
                {atrasadas.length > 3 ? "…" : ""}
              </span>
            </div>
          )}

          {tarefas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {temChecklist
                ? "Checklist aplicado, mas sem tarefas — o modelo estava vazio."
                : "Sem tarefas ainda. Aplique o checklist do tipo do evento ou crie tarefas na tela Tarefas vinculando este evento."}
            </p>
          )}
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistKanban eventoId={evento.id} tarefas={tarefas} />
        </TabsContent>

        <TabsContent value="equipe">
          <EventoEquipeTab tarefas={tarefas} profiles={profiles} />
        </TabsContent>

        <TabsContent value="materiais">
          <EventoMateriaisTab eventoId={evento.id} />
        </TabsContent>

        <TabsContent value="notificacoes">
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <Bell className="h-5 w-5 mx-auto mb-2" />
              O histórico de notificações será ativado na Fase 2 (alertas por
              nível de urgência e WhatsApp).
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <EventoHistoricoTab eventoId={evento.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
