import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, GripVertical, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { AREA_LABELS, AREA_BADGE, type AreaEvento } from "@/lib/checklistEvento";

const COLUNAS = [
  { id: "pendente", titulo: "Pendente" },
  { id: "concluida", titulo: "Concluída" },
  { id: "cancelada", titulo: "Cancelada" },
];

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

// ── Edit Dialog ───────────────────────────────────────────────────────────────

function TarefaEditDialog({
  tarefa,
  profiles,
  onClose,
  invalidateKey,
}: {
  tarefa: any;
  profiles: any[];
  onClose: () => void;
  invalidateKey: string[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    titulo: tarefa.titulo || "",
    descricao: tarefa.descricao || "",
    data_vencimento: tarefa.data_vencimento || "",
    hora: tarefa.hora ? String(tarefa.hora).slice(0, 5) : "",
    prioridade: tarefa.prioridade || "media",
    area: tarefa.area || "",
    fase_evento: tarefa.fase_evento || "",
    status: tarefa.status || "pendente",
    responsavel_id: tarefa.responsavel_id || "",
  });

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        data_vencimento: form.data_vencimento || null,
        hora: form.hora || null,
        prioridade: form.prioridade || null,
        area: form.area || null,
        fase_evento: form.fase_evento || null,
        status: form.status,
        responsavel_id: form.responsavel_id || null,
        completed_at:
          form.status === "concluida" && tarefa.status !== "concluida"
            ? new Date().toISOString()
            : tarefa.status !== "concluida"
            ? null
            : tarefa.completed_at,
      };
      const { error } = await (supabase as any)
        .from("tarefas")
        .update(payload)
        .eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa atualizada");
      onClose();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("tarefas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", tarefa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      queryClient.invalidateQueries({ queryKey: ["tarefas"] });
      toast.success("Tarefa excluída");
      onClose();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input
                type="date"
                value={form.data_vencimento}
                onChange={(e) => set("data_vencimento", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <Input
                type="time"
                value={form.hora}
                onChange={(e) => set("hora", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => set("prioridade", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={form.area || "_none"} onValueChange={(v) => set("area", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhuma</SelectItem>
                  {(Object.keys(AREA_LABELS) as AreaEvento[]).map((a) => (
                    <SelectItem key={a} value={a}>{AREA_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Fase</Label>
              <Select value={form.fase_evento || "_none"} onValueChange={(v) => set("fase_evento", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhuma</SelectItem>
                  {FASES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Responsável</Label>
            <Select value={form.responsavel_id || "_none"} onValueChange={(v) => set("responsavel_id", v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {profiles.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="mr-auto"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {deleteMutation.isPending ? "Excluindo…" : "Excluir"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TarefaCard({
  tarefa,
  atrasada,
  onEdit,
}: {
  tarefa: any;
  atrasada: boolean;
  onEdit: (t: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: tarefa.id });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(tarefa)}
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
        {tarefa.area && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${AREA_BADGE[tarefa.area as AreaEvento] || ""}`}>
            {AREA_LABELS[tarefa.area as AreaEvento] || tarefa.area}
          </Badge>
        )}
        {tarefa.sessao_numero != null && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 border-indigo-200">
            Sessão {tarefa.sessao_numero}
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

// ── Column ────────────────────────────────────────────────────────────────────

function Coluna({
  id,
  titulo,
  tarefas,
  hojeISO,
  onEdit,
}: {
  id: string;
  titulo: string;
  tarefas: any[];
  hojeISO: string;
  onEdit: (t: any) => void;
}) {
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
          atrasada={id === "pendente" && !!t.data_vencimento && t.data_vencimento < hojeISO}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

// ── Funil ─────────────────────────────────────────────────────────────────────

function Funil({
  tarefas,
  hojeISO,
  onEdit,
}: {
  tarefas: any[];
  hojeISO: string;
  onEdit: (t: any) => void;
}) {
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
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function ChecklistKanban({
  eventoId,
  turmaId,
  tarefas: todasTarefas,
}: {
  eventoId?: string;
  turmaId?: string;
  tarefas: any[];
}) {
  const queryClient = useQueryClient();
  const invalidateKey = eventoId ? ["tarefas-evento", eventoId] : ["tarefas-turma", turmaId];
  const [areaFiltro, setAreaFiltro] = useState<AreaEvento | "todas">("todas");
  const [sessaoFiltro, setSessaoFiltro] = useState<number | "todas">("todas");
  const [editando, setEditando] = useState<any | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome");
      return data || [];
    },
  });

  const sessoesDisponiveis = Array.from(
    new Set(todasTarefas.filter((t) => t.sessao_numero != null).map((t) => t.sessao_numero as number)),
  ).sort((a, b) => a - b);

  const tarefasPorArea = areaFiltro === "todas" ? todasTarefas : todasTarefas.filter((t) => t.area === areaFiltro);
  const tarefas = sessaoFiltro === "todas" ? tarefasPorArea : tarefasPorArea.filter((t) => t.sessao_numero === sessaoFiltro);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

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
      queryClient.invalidateQueries({ queryKey: invalidateKey });
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
  const semFase = tarefas.filter((t) => !FASES.some((f) => f.id === t.fase_evento));

  return (
    <>
      {editando && (
        <TarefaEditDialog
          tarefa={editando}
          profiles={profiles}
          invalidateKey={invalidateKey}
          onClose={() => setEditando(null)}
        />
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-muted-foreground mr-1">Área:</span>
          <button
            onClick={() => setAreaFiltro("todas")}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${areaFiltro === "todas" ? "bg-secondary font-medium" : "opacity-60 hover:opacity-100"}`}
          >
            Todas ({todasTarefas.length})
          </button>
          {(Object.keys(AREA_LABELS) as AreaEvento[]).map((a) => {
            const qtd = todasTarefas.filter((t) => t.area === a).length;
            return (
              <button
                key={a}
                onClick={() => setAreaFiltro(a)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${areaFiltro === a ? AREA_BADGE[a] + " font-medium" : "opacity-60 hover:opacity-100"}`}
              >
                {AREA_LABELS[a]} ({qtd})
              </button>
            );
          })}
        </div>

        {sessoesDisponiveis.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            <span className="text-xs text-muted-foreground mr-1">Sessão:</span>
            <button
              onClick={() => setSessaoFiltro("todas")}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${sessaoFiltro === "todas" ? "bg-secondary font-medium" : "opacity-60 hover:opacity-100"}`}
            >
              Todas
            </button>
            {sessoesDisponiveis.map((n) => (
              <button
                key={n}
                onClick={() => setSessaoFiltro(n)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${sessaoFiltro === n ? "bg-indigo-100 text-indigo-700 border-indigo-200 font-medium" : "opacity-60 hover:opacity-100"}`}
              >
                Sessão {n}
              </button>
            ))}
          </div>
        )}

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
              <Funil tarefas={porFase(f.id)} hojeISO={hojeISO} onEdit={setEditando} />
            </TabsContent>
          ))}
          {semFase.length > 0 && (
            <TabsContent value="sem_fase" className="mt-3">
              <Funil tarefas={semFase} hojeISO={hojeISO} onEdit={setEditando} />
            </TabsContent>
          )}
        </Tabs>
      </DndContext>
    </>
  );
}
