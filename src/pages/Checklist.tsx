import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useChecklist } from "@/hooks/useChecklist";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChecklistItemFormDialog } from "@/components/checklist/ChecklistItemFormDialog";
import { ChecklistHistoryGrid } from "@/components/checklist/ChecklistHistoryGrid";
import { Plus, Loader2, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ChecklistItemRow } from "@/types";

const Checklist = () => {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [editItem, setEditItem] = useState<ChecklistItemRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filterUsuario, setFilterUsuario] = useState("todos");

  const {
    isLoading, diarias, esporadicas, todayMap, esporadicaStatusMap,
    historyByItem, historyDays, toggleDiaria, toggleEsporadica,
  } = useChecklist();

  useRealtimeSync("checklist_itens", [["checklist-itens-all"]]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      return data || [];
    },
  });

  const { data: todosItens = [], isLoading: loadingTodos, refetch: refetchTodos } = useQuery({
    queryKey: ["checklist-itens-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_itens")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ChecklistItemRow[];
    },
    enabled: isAdmin,
  });

  const filteredTodos = useMemo(() => {
    if (filterUsuario === "todos") return todosItens;
    return todosItens.filter((i) => i.usuario_id === filterUsuario);
  }, [todosItens, filterUsuario]);

  const nomeUsuario = (id: string) => profiles.find((p: any) => p.user_id === id)?.nome || "—";

  const handleDeactivate = async (item: ChecklistItemRow) => {
    const { error } = await supabase.from("checklist_itens").update({ ativo: !item.ativo }).eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    toast.success(item.ativo ? "Item desativado" : "Item reativado");
    refetchTodos();
    queryClient.invalidateQueries({ queryKey: ["checklist-itens"] });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("checklist_itens").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removido");
    refetchTodos();
  };

  const esporadicasPendentes = esporadicas.filter((i) => !esporadicaStatusMap.has(i.id));
  const esporadicasConcluidas = esporadicas.filter((i) => esporadicaStatusMap.has(i.id));

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Checklist" description="Suas atividades diárias e esporádicas" />
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Checklist" description="Suas atividades diárias e esporádicas" />

      <Tabs defaultValue="hoje" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          {isAdmin && <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>}
        </TabsList>

        {/* HOJE */}
        <TabsContent value="hoje" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Diárias de hoje</h3>
              {diarias.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item diário cadastrado</p>
              ) : diarias.map((item) => {
                const concluido = !!todayMap.get(item.id)?.concluido;
                return (
                  <label key={item.id} className="flex items-start gap-3 py-1.5 cursor-pointer">
                    <Checkbox
                      checked={concluido}
                      onCheckedChange={(v) => toggleDiaria.mutate({ itemId: item.id, concluido: !!v })}
                    />
                    <div className={cn(concluido && "line-through text-muted-foreground")}>
                      <p className="text-sm font-medium">{item.titulo}</p>
                      {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Esporádicas pendentes</h3>
              {esporadicasPendentes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma pendência</p>
              ) : esporadicasPendentes.map((item) => (
                <label key={item.id} className="flex items-start gap-3 py-1.5 cursor-pointer">
                  <Checkbox
                    checked={false}
                    onCheckedChange={(v) => toggleEsporadica.mutate({ itemId: item.id, concluido: !!v })}
                  />
                  <div>
                    <p className="text-sm font-medium">{item.titulo}</p>
                    {item.descricao && <p className="text-xs text-muted-foreground">{item.descricao}</p>}
                    {item.data_alvo && (
                      <Badge variant="outline" className="text-xs mt-1">
                        Prazo: {format(new Date(item.data_alvo + "T12:00:00"), "dd/MM/yyyy")}
                      </Badge>
                    )}
                  </div>
                </label>
              ))}
              {esporadicasConcluidas.length > 0 && (
                <div className="pt-2 border-t space-y-1.5">
                  {esporadicasConcluidas.map((item) => (
                    <label key={item.id} className="flex items-start gap-3 py-1 cursor-pointer opacity-60">
                      <Checkbox
                        checked={true}
                        onCheckedChange={(v) => toggleEsporadica.mutate({ itemId: item.id, concluido: !!v })}
                      />
                      <p className="text-sm line-through">{item.titulo}</p>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORICO */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Últimos {historyDays} dias</h3>
              {diarias.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item diário cadastrado</p>
              ) : diarias.map((item) => {
                const hist = historyByItem.get(item.id) || [];
                const concluidos = hist.filter((h) => h.concluido).length;
                return (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <p className="text-sm font-medium">{item.titulo}</p>
                    <div className="flex items-center gap-3">
                      <ChecklistHistoryGrid history={hist} days={historyDays} />
                      <span className="text-xs text-muted-foreground w-14 text-right">{concluidos}/{historyDays}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {esporadicasConcluidas.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Esporádicas concluídas</h3>
                {esporadicasConcluidas.map((item) => {
                  const exec = esporadicaStatusMap.get(item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span>{item.titulo}</span>
                      <span className="text-xs text-muted-foreground">
                        {exec?.concluido_em ? format(new Date(exec.concluido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GERENCIAR (admin) */}
        {isAdmin && (
          <TabsContent value="gerenciar" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Select value={filterUsuario} onValueChange={setFilterUsuario}>
                <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Usuário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os usuários</SelectItem>
                  {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={() => { setEditItem(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Novo Item
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {loadingTodos ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTodos.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum item encontrado</TableCell></TableRow>
                      ) : filteredTodos.map((item) => (
                        <TableRow key={item.id} className={cn(!item.ativo && "opacity-50")}>
                          <TableCell className="font-medium">{item.titulo}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{item.tipo === "diaria" ? "Diária" : "Esporádica"}</Badge></TableCell>
                          <TableCell className="text-sm">{nomeUsuario(item.usuario_id)}</TableCell>
                          <TableCell>
                            {item.ativo ? (
                              <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Ativo</span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Circle className="h-3.5 w-3.5" /> Inativo</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditItem(item); setFormOpen(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeactivate(item)}>
                                {item.ativo ? <Circle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <ChecklistItemFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editItem}
        onSaved={() => {
          refetchTodos();
          queryClient.invalidateQueries({ queryKey: ["checklist-itens"] });
        }}
      />
    </div>
  );
};

export default Checklist;
