import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TarefaFormDialog } from "@/components/tarefas/TarefaFormDialog";
import { TarefaCard } from "@/components/tarefas/TarefaCard";
import { TarefaKanbanColumn } from "@/components/tarefas/TarefaKanbanColumn";
import {
  Plus, Loader2, Kanban, List, CalendarDays, CheckCircle2, Circle, Clock,
  AlertTriangle, Search
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";

const statusColumns = [
  { key: "pendente", label: "Pendente", icon: Circle, color: "text-muted-foreground" },
  { key: "em_andamento", label: "Em Andamento", icon: Clock, color: "text-blue-500" },
  { key: "concluida", label: "Concluída", icon: CheckCircle2, color: "text-green-500" },
];

const prioridadeOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };

const Tarefas = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarefa, setEditTarefa] = useState<any>(null);
  const [view, setView] = useState<"kanban" | "lista" | "calendario">("kanban");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterPrioridade, setFilterPrioridade] = useState("todos");
  const [search, setSearch] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());

  const { data: tarefas = [], isLoading, refetch } = useQuery({
    queryKey: ["tarefas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select("*")
        .neq("status", "cancelada")
        .order("created_at", { ascending: false });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas").update({ status: "cancelada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetch(); toast.success("Tarefa removida"); },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tarefas").update({
        status,
        completed_at: status === "concluida" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  const filtered = useMemo(() => {
    return tarefas.filter((t: any) => {
      if (filterResponsavel !== "todos" && t.responsavel_id !== filterResponsavel) return false;
      if (filterTipo !== "todos" && t.tipo !== filterTipo) return false;
      if (filterPrioridade !== "todos" && t.prioridade !== filterPrioridade) return false;
      if (search && !t.titulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tarefas, filterResponsavel, filterTipo, filterPrioridade, search]);

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const pa = prioridadeOrder[a.prioridade as keyof typeof prioridadeOrder] ?? 4;
      const pb = prioridadeOrder[b.prioridade as keyof typeof prioridadeOrder] ?? 4;
      if (pa !== pb) return pa - pb;
      if (a.data_vencimento && b.data_vencimento) return a.data_vencimento.localeCompare(b.data_vencimento);
      if (a.data_vencimento) return -1;
      if (b.data_vencimento) return 1;
      return 0;
    });
  }, [filtered]);

  const tipoLabels: Record<string, string> = { follow_up: "Follow-up", cobranca: "Cobrança", lembrete: "Lembrete", reuniao: "Reunião", outro: "Outro" };
  const prioridadeColors: Record<string, string> = {
    baixa: "bg-muted text-muted-foreground",
    media: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    alta: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    urgente: "bg-destructive/10 text-destructive",
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const tarefaId = active.id as string;
    const newStatus = over.id as string;
    const tarefa = tarefas.find((t: any) => t.id === tarefaId);
    if (tarefa && tarefa.status !== newStatus) {
      updateStatusMutation.mutate({ id: tarefaId, status: newStatus });
    }
  };

  // Calendar helpers
  const calStart = startOfMonth(calMonth);
  const calEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const startPad = getDay(calStart); // 0=Sun

  const renderFilters = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 w-48" />
      </div>
      <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
        <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterTipo} onValueChange={setFilterTipo}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          {Object.entries(tipoLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
        <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todas</SelectItem>
          <SelectItem value="urgente">Urgente</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="media">Média</SelectItem>
          <SelectItem value="baixa">Baixa</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Tarefas" description="Gestão de tarefas e agenda da equipe" />
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader title="Tarefas" description="Gestão de tarefas e agenda da equipe" />
        <Button onClick={() => { setEditTarefa(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Tarefa
        </Button>
      </div>

      <Tabs value={view} onValueChange={v => setView(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="kanban" className="gap-1.5"><Kanban className="h-4 w-4" /> Kanban</TabsTrigger>
            <TabsTrigger value="lista" className="gap-1.5"><List className="h-4 w-4" /> Lista</TabsTrigger>
            <TabsTrigger value="calendario" className="gap-1.5"><CalendarDays className="h-4 w-4" /> Calendário</TabsTrigger>
          </TabsList>
          {renderFilters()}
        </div>

        {/* KANBAN VIEW */}
        <TabsContent value="kanban">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {statusColumns.map(col => (
                <TarefaKanbanColumn
                  key={col.key}
                  columnKey={col.key}
                  label={col.label}
                  icon={col.icon}
                  color={col.color}
                  tarefas={sortedFiltered.filter((t: any) => t.status === col.key)}
                  onEdit={(t) => { setEditTarefa(t); setFormOpen(true); }}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  profiles={profiles}
                />
              ))}
            </div>
          </DndContext>
        </TabsContent>

        {/* LIST VIEW */}
        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFiltered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada</TableCell></TableRow>
                  ) : sortedFiltered.map((t: any) => {
                    const resp = profiles.find((p: any) => p.user_id === t.responsavel_id);
                    const isVencida = t.data_vencimento && new Date(t.data_vencimento + "T23:59:59") < new Date() && t.status !== "concluida";
                    return (
                      <TableRow key={t.id} className={cn(t.status === "concluida" && "opacity-60")}>
                        <TableCell className="font-medium">{t.titulo}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{tipoLabels[t.tipo] || t.tipo}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className={cn("text-xs", prioridadeColors[t.prioridade])}>{t.prioridade}</Badge></TableCell>
                        <TableCell>
                          <Select value={t.status} onValueChange={v => updateStatusMutation.mutate({ id: t.id, status: v })}>
                            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="em_andamento">Em Andamento</SelectItem>
                              <SelectItem value="concluida">Concluída</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm">{resp?.nome?.split(" ")[0] || "—"}</TableCell>
                        <TableCell className={cn("text-sm", isVencida && "text-destructive font-medium")}>
                          {t.data_vencimento ? format(new Date(t.data_vencimento + "T12:00:00"), "dd/MM/yyyy") : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTarefa(t); setFormOpen(true); }}>
                              <Clock className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendario">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" onClick={() => setCalMonth(m => subMonths(m, 1))}>← Anterior</Button>
                <h3 className="font-semibold">{format(calMonth, "MMMM yyyy", { locale: ptBR })}</h3>
                <Button variant="outline" size="sm" onClick={() => setCalMonth(m => addMonths(m, 1))}>Próximo →</Button>
              </div>
              <div className="grid grid-cols-7 gap-px">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="text-xs font-medium text-muted-foreground text-center py-2">{d}</div>
                ))}
                {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
                {calDays.map(day => {
                  const dayStr = format(day, "yyyy-MM-dd");
                  const dayTasks = sortedFiltered.filter((t: any) => t.data_vencimento === dayStr);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={dayStr} className={cn("min-h-[80px] border rounded-md p-1", isToday && "bg-primary/5 border-primary/30")}>
                      <span className={cn("text-xs font-medium", isToday && "text-primary")}>{format(day, "d")}</span>
                      <div className="space-y-0.5 mt-1">
                        {dayTasks.slice(0, 3).map((t: any) => (
                          <div
                            key={t.id}
                            className={cn(
                              "text-[10px] leading-tight px-1 py-0.5 rounded truncate cursor-pointer",
                              t.status === "concluida" ? "bg-green-500/10 text-green-700 dark:text-green-300 line-through" :
                              t.prioridade === "urgente" ? "bg-destructive/10 text-destructive" :
                              t.prioridade === "alta" ? "bg-orange-500/10 text-orange-700 dark:text-orange-300" :
                              "bg-primary/10 text-primary"
                            )}
                            onClick={() => { setEditTarefa(t); setFormOpen(true); }}
                          >
                            {t.titulo}
                          </div>
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} mais</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TarefaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tarefa={editTarefa}
        onSaved={refetch}
      />
    </div>
  );
};

export default Tarefas;
