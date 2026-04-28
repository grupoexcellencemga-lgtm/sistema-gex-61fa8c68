import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type FormaPagamento = {
  id: string;
  nome: string;
  codigo: string;
  tipo: string;
  ativo: boolean;
  abre_taxa: boolean;
  abre_parcelas: boolean;
  ordem: number | null;
  deleted_at?: string | null;
};

const tipoLabels: Record<string, string> = {
  normal: "Normal",
  gratuito: "Gratuito",
  credito: "Crédito",
  debito: "Débito",
  link: "Link",
  boleto: "Boleto",
  recorrencia: "Recorrência",
};

const normalizarCodigo = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function FormasPagamentoSection() {
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null);

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("normal");
  const [abreTaxa, setAbreTaxa] = useState(false);
  const [abreParcelas, setAbreParcelas] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState("");

  const { data: formas = [], isLoading } = useQuery({
    queryKey: ["formas_pagamento_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("*")
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      return (data || []) as FormaPagamento[];
    },
  });

  const resetForm = () => {
    setNome("");
    setCodigo("");
    setTipo("normal");
    setAbreTaxa(false);
    setAbreParcelas(false);
    setAtivo(true);
    setOrdem("");
    setEditingForma(null);
    setDialogOpen(false);
  };

  const openNew = () => {
    setEditingForma(null);
    setNome("");
    setCodigo("");
    setTipo("normal");
    setAbreTaxa(false);
    setAbreParcelas(false);
    setAtivo(true);
    setOrdem(String((formas?.length || 0) + 1));
    setDialogOpen(true);
  };

  const openEdit = (forma: FormaPagamento) => {
    setEditingForma(forma);
    setNome(forma.nome || "");
    setCodigo(forma.codigo || "");
    setTipo(forma.tipo || "normal");
    setAbreTaxa(!!forma.abre_taxa);
    setAbreParcelas(!!forma.abre_parcelas);
    setAtivo(forma.ativo !== false);
    setOrdem(forma.ordem != null ? String(forma.ordem) : "");
    setDialogOpen(true);
  };

  const handleNomeChange = (value: string) => {
    setNome(value);

    if (!editingForma && !codigo.trim()) {
      setCodigo(normalizarCodigo(value));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) {
        throw new Error("Informe o nome da forma de pagamento.");
      }

      const codigoFinal = normalizarCodigo(codigo || nome);

      if (!codigoFinal) {
        throw new Error("Informe um código válido.");
      }

      const payload = {
        nome: nome.trim(),
        codigo: codigoFinal,
        tipo,
        ativo,
        abre_taxa: abreTaxa,
        abre_parcelas: abreParcelas,
        ordem: ordem ? Number(ordem) : null,
        updated_at: new Date().toISOString(),
      };

      if (editingForma) {
        const { error } = await supabase
          .from("formas_pagamento")
          .update(payload)
          .eq("id", editingForma.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("formas_pagamento").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento_admin"] });
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });

      toast({
        title: editingForma
          ? "Forma de pagamento atualizada!"
          : "Forma de pagamento criada!",
      });

      resetForm();
    },
    onError: (err: any) =>
      toast({
        title: "Erro ao salvar forma de pagamento",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (forma: FormaPagamento) => {
      const confirmar = window.confirm(
        `Deseja remover "${forma.nome}"?\n\nEla será ocultada das próximas seleções, mas os registros antigos continuam preservados.`
      );

      if (!confirmar) return;

      const { error } = await supabase
        .from("formas_pagamento")
        .update({
          deleted_at: new Date().toISOString(),
          ativo: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", forma.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento_admin"] });
      queryClient.invalidateQueries({ queryKey: ["formas_pagamento"] });
      toast({ title: "Forma de pagamento removida." });
    },
    onError: () =>
      toast({
        title: "Erro ao remover forma de pagamento",
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
                Formas de Pagamento
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre as formas que aparecerão em matrículas, entradas,
                despesas, reembolsos, processos e eventos.
              </p>
            </div>

            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nova Forma
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Parcelas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ordem</TableHead>
                    <TableHead className="w-[100px] text-right">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {formas.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-6"
                      >
                        Nenhuma forma cadastrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    formas.map((forma) => (
                      <TableRow key={forma.id}>
                        <TableCell className="font-medium">
                          {forma.nome}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {forma.codigo}
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary">
                            {tipoLabels[forma.tipo] || forma.tipo}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          {forma.abre_taxa ? (
                            <Badge variant="outline">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Não
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          {forma.abre_parcelas ? (
                            <Badge variant="outline">Sim</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Não
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          {forma.ativo ? (
                            <Badge>Ativa</Badge>
                          ) : (
                            <Badge variant="outline">Inativa</Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {forma.ordem ?? "—"}
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(forma)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => deleteMutation.mutate(forma)}
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
              {editingForma ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={nome}
                onChange={(e) => handleNomeChange(e.target.value)}
                placeholder="Ex: PIX, Crédito, Cortesia..."
              />
            </div>

            <div>
              <Label>Código</Label>
              <Input
                value={codigo}
                onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
                placeholder="Ex: pix, credito, cortesia..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Esse código é o valor salvo no banco. Evite alterar códigos que
                já estão em uso.
              </p>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="gratuito">Gratuito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="recorrencia">Recorrência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Ordem</Label>
              <Input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                placeholder="Ex: 1"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Ativa</p>
                <p className="text-xs text-muted-foreground">
                  Aparece nos campos de pagamento.
                </p>
              </div>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Abrir taxas</p>
                <p className="text-xs text-muted-foreground">
                  Mostra cálculo de taxa quando selecionada.
                </p>
              </div>
              <Switch checked={abreTaxa} onCheckedChange={setAbreTaxa} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Abrir parcelas</p>
                <p className="text-xs text-muted-foreground">
                  Mostra seleção de parcelas quando selecionada.
                </p>
              </div>
              <Switch checked={abreParcelas} onCheckedChange={setAbreParcelas} />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (     
                <Check className="h-4 w-4 mr-1" />
              )}
              {editingForma ? "Salvar Alterações" : "Criar Forma"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}