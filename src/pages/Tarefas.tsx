import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmpresa } from "@/contexts/EmpresaContext";
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
  AlertTriangle, Search, ChevronDown, ChevronRight, Pencil, Trash2, Square, CheckSquare
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

// Cor por área (bolinha discreta no lugar dos badges repetidos).
const AREA_DOT: Record<string, string> = {
  comercial: "#378ADD",
  marketing: "#7F77DD",
  operacao: "#1D9E75",
};

// Grupos por prazo da Lista. depois/semData/concluidas começam recolhidos.
const GRUPOS_PRAZO: { key: string; label: string; danger?: boolean; muted?: boolean }[] = [
  { key: "atrasadas", label: "Atrasadas", danger: true },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "depois", label: "Mais tarde" },
  { key: "semData", label: "Sem data" },
  { key: "concluidas", label: "Concluídas", muted: true },
];

// Identifica de qual evento/turma (curso) a tarefa veio, para agrupar por origem.
function origemDaTarefa(t: any): { key: string; label: string } {
  if (t.turma_id) {
    const curso = t.turmas?.produtos?.nome as string | undefined;
    const turmaNome = (t.turmas?.nome as string) || "Turma";
    return { key: `t-${t.turma_id}`, label: curso ? `${curso} · ${turmaNome}` : turmaNome };
  }
  if (t.evento_id) return { key: `e-${t.evento_id}`, label: (t.eventos?.nome as string) || "Evento" };
  return { key: "avulsas", label: "Avulsas" };
}

const Tarefas = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarefa, setEditTarefa] = useState<any>(null);
  const [section, setSection] = useState<"geral" | "individual">("geral");
  const [view, setView] = useState<"kanban" | "lista" | "calendario">("lista");
  const [colapsados, setColapsados] = useState<Record<string, boolean>>({
    depois: true,
    semData: true,
    concluidas: true,
  });
  const [filterOrigem, setFilterOrigem] = useState<string>("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterPrioridade, setFilterPrioridade] = useState("todos");
  const [search, setSearch] = useState("");
  const [calMonth, setCalMonth] = useState(new Date());
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const { data: tarefas = [], isLoading, refetch } = useQuery({
    queryKey: ["tarefas", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select("*, turmas(nome, data_fim, produtos(nome)), eventos(nome, data), tarefa_itens(id, titulo, concluido, ordem)")
        .eq("empresa_id", empresaId!)
        .neq("status", "cancelada")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
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

  const toggleSubItemMutation = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await (supabase as any).from("tarefa_itens").update({ concluido }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetch(),
  });

  // First day of the current month — events/turmas that ended before this are hidden
  const inicioMesAtual = format(startOfMonth(new Date()), "yyyy-MM-dd");

  // Tasks for the current section, excluding tasks from finished events/turmas
  const activeTasks = useMemo(() => {
    const porSecao = (() => {
      if (section === "geral") return tarefas.filter((t: any) => (t.escopo ?? "geral") === "geral");
      if (isAdmin) return tarefas.filter((t: any) => (t.escopo ?? "geral") === "individual");
      return tarefas.filter((t: any) => (t.escopo ?? "geral") === "individual" && (t.responsavel_id === user?.id || t.created_by === user?.id));
    })();
    return porSecao.filter((t: any) => {
      if (t.turma_id && t.turmas?.data_fim && t.turmas.data_fim < inicioMesAtual) return false;
      if (t.evento_id && t.eventos?.data && t.eventos.data < inicioMesAtual) return false;
      return true;
    });
  }, [section, tarefas, isAdmin, user?.id, inicioMesAtual]);

  const filtered = useMemo(() => {
    return activeTasks.filter((t: any) => {
      if (filterResponsavel !== "todos" && t.responsavel_id !== filterResponsavel) return false;
      if (filterTipo !== "todos" && t.tipo !== filterTipo) return false;
      if (filterPrioridade !== "todos" && t.prioridade !== filterPrioridade) return false;
      if (filterOrigem !== "todos" && origemDaTarefa(t).key !== filterOrigem) return false;
      if (search && !t.titulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activeTasks, filterResponsavel, filterTipo, filterPrioridade, filterOrigem, search]);

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

  // Agrupa as tarefas por prazo para a Lista (Atrasadas / Hoje / Esta semana / …).
  const gruposPrazo = useMemo(() => {
    const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
    const d7 = (() => {
      const [y, m, dd] = hojeISO.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, dd + 7)).toISOString().slice(0, 10);
    })();
    const g: Record<string, any[]> = { atrasadas: [], hoje: [], semana: [], depois: [], semData: [], concluidas: [] };
    for (const t of sortedFiltered) {
      if (t.status === "concluida") { g.concluidas.push(t); continue; }
      const dv = t.data_vencimento as string | null;
      if (!dv) g.semData.push(t);
      else if (dv < hojeISO) g.atrasadas.push(t);
      else if (dv === hojeISO) g.hoje.push(t);
      else if (dv <= d7) g.semana.push(t);
      else g.depois.push(t);
    }
    return { g, hojeISO };
  }, [sortedFiltered]);

  // Abas de evento/turma: uma por origem que tem tarefa (com contagem de pendentes).
  const origens = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const t of activeTasks) {
      if (t.status === "concluida") continue;
      const o = origemDaTarefa(t);
      if (!map.has(o.key)) map.set(o.key, { key: o.key, label: o.label, count: 0 });
      map.get(o.key)!.count++;
    }
    return [...map.values()].sort((a, b) =>
      a.key === "avulsas" ? 1 : b.key === "avulsas" ? -1 : a.label.localeCompare(b.label, "pt-BR"),
    );
  }, [activeTasks]);

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
      {(section === "geral" || isAdmin) && (
        <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
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

  const handleSectionChange = (s: "geral" | "individual") => {
    setSection(s);
    setFilterResponsavel("todos");
    setFilterOrigem("todos");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <PageHeader title="Tarefas" description="Gestão de tarefas e agenda da equipe" />
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => handleSectionChange("geral")}
              className={cn(
                "px-4 py-1.5 text-sm rounded-full border transition-colors",
                section === "geral" ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              Geral
            </button>
            <button
              onClick={() => handleSectionChange("individual")}
              className={cn(
                "px-4 py-1.5 text-sm rounded-full border transition-colors",
                section === "individual" ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              Individual
            </button>
          </div>
        </div>
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

        {origens.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setFilterOrigem("todos")}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap transition-colors",
                filterOrigem === "todos" ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              Todos
            </button>
            {origens.map((o) => (
              <button
                key={o.key}
                onClick={() => setFilterOrigem(o.key)}
                title={o.label}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 max-w-[240px] px-3 py-1.5 rounded-full border text-xs transition-colors",
                  filterOrigem === o.key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <span className="truncate">{o.label}</span>
                <span className="opacity-70 shrink-0">({o.count})</span>
              </button>
            ))}
          </div>
        )}

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
          {sortedFiltered.length === 0 ? (
            <Card><CardContent className="text-center text-muted-foreground py-10 text-sm">Nenhuma tarefa encontrada</CardContent></Card>
          ) : (
            <div className="space-y-2.5">
              {GRUPOS_PRAZO.map((grp) => {
                const itens = gruposPrazo.g[grp.key] || [];
                if (itens.length === 0) return null;
                const aberto = !colapsados[grp.key];
                return (
                  <div key={grp.key} className={cn("rounded-lg border overflow-hidden", grp.danger && "border-red-200 dark:border-red-900")}>
                    <button
                      onClick={() => setColapsados((p) => ({ ...p, [grp.key]: !p[grp.key] }))}
                      className={cn("w-full flex items-center justify-between px-3 py-2 text-left", grp.danger ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/40")}
                    >
                      <span className={cn("text-sm font-medium flex items-center gap-1.5 min-w-0", grp.danger && "text-destructive", grp.muted && "text-muted-foreground")}>
                        {grp.danger && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{grp.label}</span>
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        {itens.length}
                        {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    {aberto && (
                      <div className="bg-card">
                        {itens.map((t: any) => {
                          const resp = profiles.find((p: any) => p.user_id === t.responsavel_id);
                          const atrasada = t.data_vencimento && t.data_vencimento < gruposPrazo.hojeISO && t.status !== "concluida";
                          const concluida = t.status === "concluida";
                          const subItens: any[] = (t.tarefa_itens || []).slice().sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0));
                          const subTotal = subItens.length;
                          const subDone = subItens.filter((i: any) => i.concluido).length;
                          const isExpanded = !!expandedTasks[t.id];
                          return (
                            <div key={t.id}>
                              <div className="flex items-center gap-2.5 px-3 py-2 border-t text-sm">
                                <button
                                  onClick={() => updateStatusMutation.mutate({ id: t.id, status: concluida ? "pendente" : "concluida" })}
                                  title={concluida ? "Reabrir" : "Concluir"}
                                  className="shrink-0"
                                >
                                  {concluida ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                                </button>
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: AREA_DOT[t.area] || "hsl(var(--muted-foreground))" }} title={t.area || ""} />
                                <button
                                  onClick={() => {
                                    if (subTotal > 0) setExpandedTasks(p => ({ ...p, [t.id]: !p[t.id] }));
                                  }}
                                  className={cn("flex-1 min-w-0 text-left", subTotal > 0 ? "cursor-pointer" : "cursor-default")}
                                >
                                  <div className={cn("truncate", concluida && "line-through text-muted-foreground")}>{t.titulo}</div>
                                  {filterOrigem === "todos" && (t.turma_id || t.evento_id) && (
                                    <div className="text-[11px] text-muted-foreground truncate">{origemDaTarefa(t).label}</div>
                                  )}
                                </button>
                                {subTotal > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setExpandedTasks(p => ({ ...p, [t.id]: !p[t.id] })); }}
                                    className={cn("text-[11px] whitespace-nowrap shrink-0 flex items-center gap-0.5 hover:text-foreground transition-colors", subDone === subTotal ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}
                                    title={isExpanded ? "Recolher sub-tarefas" : "Ver sub-tarefas"}
                                  >
                                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    {subDone}/{subTotal}
                                  </button>
                                )}
                                <span className={cn("text-xs whitespace-nowrap shrink-0", atrasada ? "text-destructive font-medium" : "text-muted-foreground")}>
                                  {t.data_vencimento ? format(new Date(t.data_vencimento + "T12:00:00"), "dd/MM") : "—"}
                                </span>
                                <span className="text-xs text-muted-foreground w-14 truncate hidden sm:block">{resp?.nome?.split(" ")[0] || "—"}</span>
                                <button onClick={() => { setEditTarefa(t); setFormOpen(true); }} className="shrink-0 text-muted-foreground/60 hover:text-foreground" title="Editar">
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => deleteMutation.mutate(t.id)} className="shrink-0 text-muted-foreground/60 hover:text-destructive" title="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {isExpanded && subTotal > 0 && (
                                <div className="border-t border-dashed bg-muted/20 pl-10 pr-3 py-1.5 space-y-0.5 border-l-2 border-l-muted ml-3">
                                  {subItens.map((item: any) => (
                                    <div key={item.id} className="flex items-center gap-2 py-0.5 ml-3">
                                      <button
                                        onClick={() => toggleSubItemMutation.mutate({ id: item.id, concluido: !item.concluido })}
                                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                      >
                                        {item.concluido
                                          ? <CheckSquare className="h-3.5 w-3.5 text-green-500" />
                                          : <Square className="h-3.5 w-3.5" />}
                                      </button>
                                      <span className={cn("text-xs", item.concluido && "line-through text-muted-foreground")}>{item.titulo}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
        defaultEscopo={section}
        onSaved={refetch}
      />
    </div>
  );
};

export default Tarefas;
