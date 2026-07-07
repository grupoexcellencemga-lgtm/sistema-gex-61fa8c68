import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export function EventoMateriaisTab({ eventoId }: { eventoId: string }) {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState("");
  const [novaQtd, setNovaQtd] = useState("1");

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ["evento-materiais", eventoId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("evento_materiais")
        .select("*")
        .eq("evento_id", eventoId)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["evento-materiais", eventoId] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("evento_materiais").insert({
        evento_id: eventoId,
        nome: novoNome.trim(),
        quantidade: parseInt(novaQtd) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setNovoNome("");
      setNovaQtd("1");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, separado }: { id: string; separado: boolean }) => {
      const { error } = await (supabase as any)
        .from("evento_materiais")
        .update({ separado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // Soft delete, seguindo o padrão do sistema (regra 1)
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("evento_materiais")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const separados = materiais.filter((m: any) => m.separado).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Package className="h-4 w-4" />
          {materiais.length === 0
            ? "Nenhum material cadastrado"
            : `${separados}/${materiais.length} itens separados`}
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Ex: Caixa de som, crachás, banner..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && novoNome.trim()) addMutation.mutate();
          }}
        />
        <Input
          type="number"
          min="1"
          className="w-20"
          value={novaQtd}
          onChange={(e) => setNovaQtd(e.target.value)}
          title="Quantidade"
        />
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!novoNome.trim() || addMutation.isPending}
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-2 space-y-1">
            {materiais.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Adicione os itens físicos do evento para controlar a separação.
              </p>
            )}
            {materiais.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={!!m.separado}
                  onCheckedChange={(v) =>
                    toggleMutation.mutate({ id: m.id, separado: !!v })
                  }
                />
                <span
                  className={`text-sm flex-1 ${m.separado ? "line-through text-muted-foreground" : ""}`}
                >
                  {m.nome}
                  {m.quantidade > 1 && (
                    <span className="text-xs text-muted-foreground ml-1.5">
                      × {m.quantidade}
                    </span>
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeMutation.mutate(m.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
