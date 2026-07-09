import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { AREA_LABELS, type AreaEvento } from "@/lib/checklistEvento";

const AREAS: AreaEvento[] = ["comercial", "marketing", "operacao"];
const SEM_RESPONSAVEL = "__padrao__";

// Define quem recebe as tarefas de cada área quando um checklist é aplicado.
// Ex: tarefas de "Marketing" vão para a pessoa do marketing.
export function ChecklistAreaResponsaveisSection() {
  const queryClient = useQueryClient();

  const { data: pessoas = [] } = useQuery({
    queryKey: ["profiles-para-area"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .order("nome");
      return (data || []).filter((p: any) => p.nome);
    },
  });

  const { data: mapa = {}, isLoading } = useQuery({
    queryKey: ["checklist-area-responsaveis"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("checklist_area_responsaveis")
        .select("area, responsavel_id");
      const m: Record<string, string | null> = {};
      for (const r of data || []) m[r.area] = r.responsavel_id;
      return m;
    },
  });

  const salvar = useMutation({
    mutationFn: async ({ area, responsavelId }: { area: AreaEvento; responsavelId: string | null }) => {
      const { error } = await (supabase as any)
        .from("checklist_area_responsaveis")
        .upsert(
          { area, responsavel_id: responsavelId, updated_at: new Date().toISOString() },
          { onConflict: "area" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-area-responsaveis"] });
      toast.success("Responsável da área atualizado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Responsáveis por área
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quando você aplica um checklist a um evento ou turma, cada tarefa vai
          automaticamente para o responsável da sua área. Se uma área ficar sem
          responsável, as tarefas dela vão para quem aplicou o checklist.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          AREAS.map((area) => (
            <div key={area} className="flex items-center justify-between gap-4">
              <Label className="min-w-24">{AREA_LABELS[area]}</Label>
              <Select
                value={mapa[area] || SEM_RESPONSAVEL}
                onValueChange={(v) =>
                  salvar.mutate({ area, responsavelId: v === SEM_RESPONSAVEL ? null : v })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Quem aplicou (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_RESPONSAVEL}>
                    <span className="text-muted-foreground">Quem aplicou (padrão)</span>
                  </SelectItem>
                  {pessoas.map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
