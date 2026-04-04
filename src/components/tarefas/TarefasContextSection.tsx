import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Circle, Clock, Calendar } from "lucide-react";
import { TarefaFormDialog } from "./TarefaFormDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusIcons: Record<string, any> = {
  pendente: Circle,
  em_andamento: Clock,
  concluida: CheckCircle2,
};

const prioridadeColors: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  alta: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  urgente: "bg-destructive/10 text-destructive",
};

interface Props {
  alunoId?: string;
  leadId?: string;
  processoId?: string;
}

export function TarefasContextSection({ alunoId, leadId, processoId }: Props) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarefa, setEditTarefa] = useState<any>(null);

  const filterCol = alunoId ? "aluno_id" : leadId ? "lead_id" : "processo_id";
  const filterVal = alunoId || leadId || processoId;

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas-context", filterCol, filterVal],
    queryFn: async () => {
      if (!filterVal) return [];
      const { data } = await supabase
        .from("tarefas")
        .select("*")
        .eq(filterCol, filterVal)
        .neq("status", "cancelada")
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      return data || [];
    },
    enabled: !!filterVal,
  });

  const toggleStatus = useMutation({
    mutationFn: async (tarefa: any) => {
      const newStatus = tarefa.status === "concluida" ? "pendente" : "concluida";
      const { error } = await supabase.from("tarefas").update({
        status: newStatus,
        completed_at: newStatus === "concluida" ? new Date().toISOString() : null,
      }).eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas-context"] }),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["tarefas-context"] });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Tarefas</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditTarefa(null); setFormOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Nova
        </Button>
      </div>

      {tarefas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma tarefa vinculada.</p>
      ) : (
        <div className="space-y-2">
          {tarefas.map((t: any) => {
            const Icon = statusIcons[t.status] || Circle;
            const isVencida = t.data_vencimento && new Date(t.data_vencimento + "T23:59:59") < new Date() && t.status !== "concluida";
            return (
              <div key={t.id} className={cn("flex items-start gap-2 p-2 rounded-md border text-sm", t.status === "concluida" && "opacity-60")}>
                <button onClick={() => toggleStatus.mutate(t)} className="mt-0.5 shrink-0">
                  <Icon className={cn("h-4 w-4", t.status === "concluida" ? "text-green-500" : "text-muted-foreground")} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm leading-tight", t.status === "concluida" && "line-through")}>{t.titulo}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className={cn("text-[10px] px-1 py-0", prioridadeColors[t.prioridade])}>{t.prioridade}</Badge>
                    {t.data_vencimento && (
                      <span className={cn("text-[11px] flex items-center gap-1 text-muted-foreground", isVencida && "text-destructive")}>
                        <Calendar className="h-3 w-3" />
                        {format(new Date(t.data_vencimento + "T12:00:00"), "dd/MM", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditTarefa(t); setFormOpen(true); }}>
                  <Clock className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <TarefaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tarefa={editTarefa}
        defaultAlunoId={alunoId}
        defaultLeadId={leadId}
        defaultProcessoId={processoId}
        onSaved={refetch}
      />
    </div>
  );
}
