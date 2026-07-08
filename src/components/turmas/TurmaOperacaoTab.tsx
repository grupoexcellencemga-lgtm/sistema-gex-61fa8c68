import { useState, useEffect } from "react";
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
import { LayoutDashboard, ListChecks, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  definirChecklistDaTurma,
  removerChecklistDaTurma,
} from "@/lib/checklistEvento";
import { ChecklistKanban } from "@/components/eventos/operacao/ChecklistKanban";

// Painel operacional da turma: mesmo checklist usado em Eventos, mas as
// tarefas se referem a datas da turma (início/primeira/última sessão).
export function TurmaOperacaoTab({ turma }: { turma: any }) {
  const queryClient = useQueryClient();
  const [templateEscolhido, setTemplateEscolhido] = useState<string>("");

  const { data: turmaAtual } = useQuery({
    queryKey: ["turma-operacao", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("*").eq("id", turma.id).single();
      if (error) throw error;
      return data as any;
    },
    initialData: turma,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: ["tarefas-turma", turma.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select("*, encontros(sessao_numero)")
        .eq("turma_id", turma.id)
        .order("data_vencimento", { ascending: true, nullsFirst: false });
      if (error) throw error;
      // Achata a sessão pro Kanban filtrar sem precisar saber do join.
      return (data || []).map((t: any) => ({ ...t, sessao_numero: t.encontros?.sessao_numero ?? null }));
    },
  });

  const { data: modelos = [] } = useQuery({
    queryKey: ["checklist-modelos-ativos"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checklist_templates")
        .select("id, nome, tipo_evento, checklist_template_items(id, deleted_at)")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      return (data || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        tipo_evento: t.tipo_evento,
        itens: (t.checklist_template_items || []).filter((i: any) => !i.deleted_at).length,
      }));
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["tarefas-turma", turma.id] });
    queryClient.invalidateQueries({ queryKey: ["turma-operacao", turma.id] });
    queryClient.invalidateQueries({ queryKey: ["turmas"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
  };

  useEffect(() => {
    if (templateEscolhido || modelos.length === 0) return;
    setTemplateEscolhido(turmaAtual.checklist_template_id || modelos[0].id);
  }, [modelos, turmaAtual.checklist_template_id, templateEscolhido]);

  const definirMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão expirada");
      if (!templateEscolhido) throw new Error("Escolha um checklist na lista.");
      return definirChecklistDaTurma(
        { id: turmaAtual.id, nome: turmaAtual.nome, data_inicio: turmaAtual.data_inicio, data_fim: turmaAtual.data_fim },
        templateEscolhido,
        auth.user.id,
      );
    },
    onSuccess: (r) => {
      invalidateAll();
      toast.success(`Checklist "${r.templateNome}" aplicado — ${r.tarefasCriadas} tarefa(s).`);
      if (r.itensSemSessao > 0) {
        toast.warning(
          `${r.itensSemSessao} tarefa(s) do tipo "cada sessão" foram puladas — esta turma ainda não tem sessões cadastradas. Cadastre os encontros e aplique de novo.`,
        );
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const removerMutation = useMutation({
    mutationFn: () => removerChecklistDaTurma(turma.id),
    onSuccess: (n) => {
      invalidateAll();
      toast.success(`Checklist removido — ${n} tarefa(s) apagada(s).`);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const hojeISO = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const pendentes = tarefas.filter((t: any) => t.status === "pendente");
  const concluidas = tarefas.filter((t: any) => t.status === "concluida");
  const atrasadas = pendentes.filter((t: any) => t.data_vencimento && t.data_vencimento < hojeISO);
  const temChecklist = !!turmaAtual.checklist_template_id;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="resumo" className="w-full">
        <TabsList>
          <TabsTrigger value="resumo" className="gap-1"><LayoutDashboard className="h-4 w-4" /> Resumo</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1"><ListChecks className="h-4 w-4" /> Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4">
          <div className="flex items-center justify-end flex-wrap gap-2">
            {temChecklist && (
              <span className="text-xs text-muted-foreground">
                Atual:{" "}
                <strong className="text-foreground">
                  {modelos.find((m: any) => m.id === turmaAtual.checklist_template_id)?.nome || "—"}
                </strong>
              </span>
            )}
            <Select value={templateEscolhido} onValueChange={setTemplateEscolhido}>
              <SelectTrigger className="h-9 w-60">
                <SelectValue placeholder="Escolha um checklist" />
              </SelectTrigger>
              <SelectContent>
                {modelos.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum modelo. Crie em Configurações → Modelos de Checklist.
                  </div>
                ) : (
                  modelos.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome} · {m.tipo_evento} ({m.itens})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={() => definirMutation.mutate()}
              disabled={!templateEscolhido || definirMutation.isPending}
              className="gap-2"
            >
              {definirMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {temChecklist ? "Trocar por este" : "Aplicar"}
            </Button>
            {temChecklist && (
              <Button
                variant="outline"
                className="text-destructive"
                disabled={removerMutation.isPending}
                onClick={() => {
                  if (confirm("Remover o checklist? As tarefas geradas por ele serão apagadas.")) {
                    removerMutation.mutate();
                  }
                }}
              >
                Remover
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
                : "Sem tarefas ainda. Escolha e aplique um checklist acima."}
            </p>
          )}
        </TabsContent>

        <TabsContent value="checklist">
          <ChecklistKanban turmaId={turma.id} tarefas={tarefas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
