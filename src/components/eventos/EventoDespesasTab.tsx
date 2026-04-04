import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "cheque", label: "Cheque" },
  { value: "permuta", label: "Permuta" },
  { value: "recorrencia_cartao", label: "Recorrência no Cartão" },
];

import { formatCurrencyNullable as formatCurrency, formatDate } from "@/lib/formatters";

interface DespesaForm {
  descricao: string;
  valor: string;
  data: string;
  fornecedor: string;
  forma_pagamento: string;
  observacoes: string;
}

const emptyForm: DespesaForm = {
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  fornecedor: "",
  forma_pagamento: "",
  observacoes: "",
};

interface Props {
  eventoId: string;
  eventoProdutoId?: string | null;
  eventoTurmaId?: string | null;
}

export function EventoDespesasTab({ eventoId, eventoProdutoId, eventoTurmaId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DespesaForm>(emptyForm);

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["despesas_evento", eventoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("evento_id", eventoId)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_despesas")
        .select("*")
        .eq("tipo", "despesa")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: contasBancarias = [] } = useQuery({
    queryKey: ["contas_bancarias_ativas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const [categoriaId, setCategoriaId] = useState<string>("");
  const [contaBancariaId, setContaBancariaId] = useState<string>("");

  const insertMutation = useMutation({
    mutationFn: async (d: DespesaForm) => {
      const { error } = await supabase.from("despesas").insert({
        descricao: d.descricao,
        valor: parseFloat(d.valor),
        data: d.data || new Date().toISOString().split("T")[0],
        fornecedor: d.fornecedor || null,
        forma_pagamento: d.forma_pagamento || null,
        observacoes: d.observacoes || null,
        evento_id: eventoId,
        categoria_id: categoriaId || null,
        conta_bancaria_id: contaBancariaId || null,
        produto_id: eventoProdutoId || null,
        turma_id: eventoTurmaId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas_evento", eventoId] });
      toast.success("Despesa adicionada");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, d }: { id: string; d: DespesaForm }) => {
      const { error } = await supabase.from("despesas").update({
        descricao: d.descricao,
        valor: parseFloat(d.valor),
        data: d.data || new Date().toISOString().split("T")[0],
        fornecedor: d.fornecedor || null,
        forma_pagamento: d.forma_pagamento || null,
        observacoes: d.observacoes || null,
        categoria_id: categoriaId || null,
        conta_bancaria_id: contaBancariaId || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas_evento", eventoId] });
      toast.success("Despesa atualizada");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas_evento", eventoId] });
      toast.success("Despesa excluída");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCategoriaId("");
    setContaBancariaId("");
    setDialogOpen(true);
  };

  const openEdit = (d: any) => {
    setForm({
      descricao: d.descricao || "",
      valor: String(d.valor),
      data: d.data || "",
      fornecedor: d.fornecedor || "",
      forma_pagamento: d.forma_pagamento || "",
      observacoes: d.observacoes || "",
    });
    setCategoriaId(d.categoria_id || "");
    setContaBancariaId(d.conta_bancaria_id || "");
    setEditingId(d.id);
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.descricao.trim()) { toast.error("Descrição é obrigatória"); return; }
    if (!form.valor || parseFloat(form.valor) <= 0) { toast.error("Valor é obrigatório"); return; }
    if (editingId) updateMutation.mutate({ id: editingId, d: form });
    else insertMutation.mutate(form);
  };

  const isSaving = insertMutation.isPending || updateMutation.isPending;
  const totalDespesas = despesas.reduce((sum: number, d: any) => sum + (d.valor || 0), 0);


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">{despesas.length} despesa(s)</span>
          <span className="text-sm text-muted-foreground">Total: {formatCurrency(totalDespesas)}</span>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar Despesa
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : despesas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma despesa cadastrada para este evento.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Forma Pgto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {despesas.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">{d.descricao}</TableCell>
                    <TableCell className="text-sm">{formatDate(d.data)}</TableCell>
                    <TableCell className="text-sm">{d.fornecedor || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {FORMAS_PAGAMENTO.find(f => f.value === d.forma_pagamento)?.label || d.forma_pagamento || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm text-destructive">
                      {formatCurrency(d.valor)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                          if (confirm("Excluir esta despesa?")) deleteMutation.mutate(d.id);
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={4} className="font-semibold text-sm">Total</TableCell>
                  <TableCell className="text-right font-bold text-sm text-destructive">{formatCurrency(totalDespesas)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Despesa" : "Nova Despesa do Evento"}</DialogTitle>
            <DialogDescription>Registre uma despesa vinculada a este evento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel do espaço" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(fp => (
                      <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={contaBancariaId} onValueChange={setContaBancariaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {contasBancarias.map((cb: any) => (
                    <SelectItem key={cb.id} value={cb.id}>{cb.nome} - {cb.banco}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observações adicionais" />
            </div>
            <Button className="w-full" onClick={save} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Adicionar Despesa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
