import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";

type Categoria = {
  id: string;
  nome: string;
  tipo: string;
  ativo?: boolean;
  deleted_at?: string | null;
};

const tipoLabels: Record<string, string> = {
  geral: "Geral",
  despesa: "Antiga: Despesa",
  receita: "Antiga: Receita",
  empresa: "Antiga: Empresa",
  profissional: "Antiga: Profissional",
};

export function CategoriasSection() {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [nome, setNome] = useState("");

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias_despesas", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_despesas")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as Categoria[];
    },
    enabled: !!empresaId,
  });

  const resetForm = () => {
    setNome("");
    setEditingCategoria(null);
    setDialogOpen(false);
  };

  const openNew = () => {
    setEditingCategoria(null);
    setNome("");
    setDialogOpen(true);
  };

  const openEdit = (categoria: Categoria) => {
    setEditingCategoria(categoria);
    setNome(categoria.nome || "");
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) {
        throw new Error("Informe o nome da categoria.");
      }

      const nomeTratado = nome.trim();

      const { data: categoriaExistente, error: categoriaExistenteError } =
        await supabase
          .from("categorias_despesas")
          .select("id, nome")
          .is("deleted_at", null)
          .ilike("nome", nomeTratado)
          .maybeSingle();

      if (categoriaExistenteError) throw categoriaExistenteError;

      if (
        categoriaExistente &&
        (!editingCategoria || categoriaExistente.id !== editingCategoria.id)
      ) {
        throw new Error("Já existe uma categoria com esse nome.");
      }

      const payload = {
        nome: nomeTratado,
        tipo: "geral",
        ativo: true,
        updated_at: new Date().toISOString(),
      };

      if (editingCategoria) {
        const { error } = await supabase
          .from("categorias_despesas")
          .update(payload)
          .eq("id", editingCategoria.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("categorias_despesas").insert({
          ...payload,
          empresa_id: empresaId,
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas"] });
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas_receita"] });
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas_empresa"] });

      toast({
        title: editingCategoria
          ? "Categoria atualizada com sucesso!"
          : "Categoria criada com sucesso!",
      });

      resetForm();
    },
    onError: (err: any) =>
      toast({
        title: "Erro ao salvar categoria",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (categoria: Categoria) => {
      const confirmar = window.confirm(
        `Deseja excluir a categoria "${categoria.nome}"?\n\nEla será ocultada das próximas seleções, mas os lançamentos antigos continuam preservados.`
      );

      if (!confirmar) return;

      const { error } = await supabase
        .from("categorias_despesas")
        .update({
          deleted_at: new Date().toISOString(),
          ativo: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", categoria.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas"] });
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas_receita"] });
      queryClient.invalidateQueries({ queryKey: ["categorias_despesas_empresa"] });

      toast({ title: "Categoria removida." });
    },
    onError: () =>
      toast({
        title: "Erro ao remover categoria",
        variant: "destructive",
      }),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Categorias Financeiras
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre as categorias em um único lugar. Elas serão usadas em
                contas a pagar, despesas e receitas.
              </p>
            </div>

            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Categoria
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {categorias.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-5"
                      >
                        Nenhuma categoria cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    categorias.map((categoria) => (
                      <TableRow key={categoria.id}>
                        <TableCell className="font-medium">
                          {categoria.nome}
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary">
                            {tipoLabels[categoria.tipo] || "Geral"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(categoria)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(categoria)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategoria ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da categoria</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Aluguel, Tráfego Pago, Coffee Break..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Essa categoria ficará disponível para contas a pagar, despesas e receitas.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {editingCategoria ? "Salvar Alterações" : "Criar Categoria"}
              </Button>

              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}