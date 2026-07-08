import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
} from "@dnd-kit/core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarDays, GripVertical } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";

const COLUNAS = [
  { id: "pendente", titulo: "Pendente" },
  { id: "concluida", titulo: "Concluída" },
  { id: "cancelada", titulo: "Cancelada" },
];

// Uma aba por fase do evento; cada atividade cai na aba da sua fase.
const FASES = [
  { id: "pre_evento", label: "Pré-evento" },
  { id: "dia_evento", label: "No dia" },
  { id: "pos_evento", label: "Pós-evento" },
];

const FASE_LABEL: Record<string, string> = {
  pre_evento: "Pré-evento",
  dia_evento: "Dia do evento",
  pos_evento: "Pós-evento",
};

const PRIORIDADE_CLASS: Record<string, string> = {
  urgente: "bg-red-100 text-red-700 border-red-200",
  alta: "bg-amber-100 text-amber-700 border-amber-200",
  media: "bg-blue-100 text-blue-700 border-blue-200",
  baixa: "bg-slate-100 text-slate-600 border-slate-200",
};

function TarefaCard({ tarefa, atrasada }: { tarefa: any; atrasada: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: tarefa.id });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={`p-3 space-y-1.5 cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-70 shadow-lg z-50 relative" : ""} ${atrasada ? "border-red-300 bg-red-50/50" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm font-medium leading-tight flex-1">
          {tarefa.titulo}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap pl-5">
        {tarefa.fase_evento && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {FASE_LABEL[tarefa.fase_evento] || tarefa.fase_evento}
          </Badge>
        )}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${PRIORIDADE_CLASS[tarefa.prioridade] || ""}`}
        >
          {tarefa.prioridade}
        </Badge>
        {tarefa.data_vencimento && (
          <span
            className={`text-[10px] flex items-center gap-0.5 ${atrasada ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
          >
            <CalendarDays className="h-3 w-3" />
            {formatDate(tarefa.data_vencimento)}
            {tarefa.hora ? ` ${String(tarefa.hora).slice(0, 5)}` : ""}
          </span>
        )}
        {atrasada && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            Atrasada
          </Badge>
        )}
      </div>
    </Card>
  );
}

function Coluna({ id, titulo, tarefas, hojeISO }: { id: string; titulo: string; tarefas: any[]; hojeISO: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 p-2 space-y-2 min-h-[140px] flex-1 ${isOver ? "ring-2 ring-primary/40 bg-primary/5" : ""}`}
    >
      <p className="text-xs font-semibold text-muted-foreground px-1">
        {titulo} ({tarefas.length})
      </p>
      {tarefas.map((t) => (
        <TarefaCard
          key={t.id}
          tarefa={t}
          atrasada={
            id === "pendente" &&
            !!t.data_vencimento &&
            t.data_vencimento < hojeISO
          }
        />
      ))}
    </div>
  );
}

// Funil (colunas por status) de uma fase.
function Funil({ tarefas, hojeISO }: { tarefas: any[]; hojeISO: string }) {
  if (tarefas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhuma atividade nesta fase.
      </p>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {COLUNAS.map((c) => (
        <Coluna
          key={c.id}
          id={c.id}
          titulo={c.titulo}
          hojeISO={hojeISO}
          tarefas={tarefas.filter((t) => t.status === c.id)}
        />
      ))}
    </div>
  );
}

export function ChecklistKanban({ eventoId, tarefas }: { eventoId: string; tarefas: any[] }) {
  const queryClient = useQueryClient();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const hojeISO = new Date(Date.now() - 3 * 3_600_000)
    .toISOString()
    .slice(0, 10);

  const moverMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("tarefas")
        .update({
          status,
          completed_at: status === "concluida" ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefas-evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const novoStatus = String(over.id);
    const tarefa = tarefas.find((t) => t.id === active.id);
    if (!tarefa || tarefa.status === novoStatus) return;
    if (!COLUNAS.some((c) => c.id === novoStatus)) return;
    moverMutation.mutate({ id: String(active.id), status: novoStatus });
  };

  const porFase = (fase: string) => tarefas.filter((t) => t.fase_evento === fase);
  const semFase = tarefas.filter(
    (t) => !FASES.some((f) => f.id === t.fase_evento),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Tabs defaultValue="pre_evento" className="w-full">
        <TabsList className="flex-wrap h-auto">
          {FASES.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {f.label} ({porFase(f.id).length})
            </TabsTrigger>
          ))}
          {semFase.length > 0 && (
            <TabsTrigger value="sem_fase">Outras ({semFase.length})</TabsTrigger>
          )}
        </TabsList>

        {FASES.map((f) => (
          <TabsContent key={f.id} value={f.id} className="mt-3">
            <Funil tarefas={porFase(f.id)} hojeISO={hojeISO} />
          </TabsContent>
        ))}
        {semFase.length > 0 && (
          <TabsContent value="sem_fase" className="mt-3">
            <Funil tarefas={semFase} hojeISO={hojeISO} />
          </TabsContent>
        )}
      </Tabs>
    </DndContext>
  );
}
