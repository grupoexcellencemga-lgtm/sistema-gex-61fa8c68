import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isInMonth } from "@/components/MonthFilter";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TrendingDown, Loader2, Plus, Receipt, Wallet, Pencil, Trash2, Camera } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { ModalScannerNota } from "./ModalScannerNota";
import { DadosNota } from "@/services/scannerNota";

// Default blank form state
const blankForm = {
  descricao: "",
  valor: "",
  data: new Date().toISOString().split("T")[0],
  categoria_id: "",
  conta_bancaria_id: "",
  produto_id: "",
  turma_id: "",
  fornecedor: "",
  forma_pagamento: "",
  recorrente: "false",
  observacoes: "",
};

export const TabDespesas = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Record<string, string>>({
    data: "", descricao: "", categoria: "", turma: "", fornecedor: "", banco: "", forma: "", valor: "", produto: "", observacoes: "",
  });
  const setFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<any>(null);
  const [formProdutoId, setFormProdutoId] = useState("");
  const [modalScannerAberto, setModalScannerAberto] = useState(false);
  const [formValues, setFormValues] = useState<typeof blankForm>(blankForm);
  const setFormField = (key: string, value: string) => setFormValues((f) => ({ ...f, [key]: value }));

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ["despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, categorias_despesas(nome), contas_bancarias(nome), turmas(nome), produtos(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_despesas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_despesas").select("*").eq("tipo", "despesa").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("id, nome, produto_id").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const turmasFiltradas = formProdutoId
    ? turmas.filter((t: any) => t.produto_id === formProdutoId)
    : [];

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const saveDespesa = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        descricao: form.descricao,
        valor: Number(form.valor),
        data: form.data,
        categoria_id: form.categoria_id || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        turma_id: form.turma_id || null,
        produto_id: form.produto_id || null,
        fornecedor: form.fornecedor || null,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
        recorrente: form.recorrente === "true",
      };
      if (form.id) {
        const { error } = await supabase.from("despesas").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("despesas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      setDialogOpen(false);
      setEditingDespesa(null);
      toast({ title: "Despesa salva com sucesso" });
    },
    onError: () => toast({ title: "Erro ao salvar despesa", variant: "destructive" }),
  });

  const deleteDespesa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Despesa excluída" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form: any = { ...formValues };
    if (editingDespesa) form.id = editingDespesa.id;
    saveDespesa.mutate(form);
  };

  const handleDadosExtraidos = (dados: DadosNota) => {
    // Convert DD/MM/AAAA → AAAA-MM-DD for the date input
    let dataFormatada = new Date().toISOString().split("T")[0];
    if (dados.data) {
      const parts = dados.data.split("/");
      if (parts.length === 3) {
        dataFormatada = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    setFormValues({
      descricao: dados.descricao || dados.fornecedor || "",
      valor: dados.valor || "",
      data: dataFormatada,
      categoria_id: "",
      conta_bancaria_id: "",
      produto_id: "",
      turma_id: "",
      fornecedor: dados.fornecedor || "",
      forma_pagamento: dados.forma_pagamento || "",
      recorrente: "false",
      observacoes: dados.itens ? `Itens: ${dados.itens}` : "",
    });
    setFormProdutoId("");
    setEditingDespesa(null);
    setDialogOpen(true);
  };

  const inMonth = (d: string | null | undefined) => isInMonth(d, mes, ano);

  const despesasMes = despesas.filter((d: any) => inMonth(d.data));
  const filtered = despesasMes.filter((d: any) => {
    const matchField = (val: string, filter: string) => !filter.trim() || val.toLowerCase().includes(filter.toLowerCase());
    return (
      matchField(formatDate(d.data), filters.data) &&
      matchField(d.descricao || "", filters.descricao) &&
      matchField((d as any).categorias_despesas?.nome || "Sem categoria", filters.categoria) &&
      matchField((d as any).turmas?.nome || "Empresa", filters.turma) &&
      matchField(d.fornecedor || "", filters.fornecedor) &&
      matchField((d as any).contas_bancarias?.nome || "", filters.banco) &&
      matchField(d.forma_pagamento || "", filters.forma) &&
      matchField(formatCurrency(Number(d.valor)), filters.valor) &&
      matchField((d as any).produtos?.nome || "", filters.produto) &&
      matchField(d.observacoes || "", filters.observacoes)
    );
  });

  const totalDespesas = despesasMes.reduce((s: number, d: any) => s + Number(d.valor), 0);
  const despesasPorCategoria: Record<string, number> = {};
  despesasMes.forEach((d: any) => {
    const cat = (d as any).categorias_despesas?.nome || "Sem categoria";
    despesasPorCategoria[cat] = (despesasPorCategoria[cat] || 0) + Number(d.valor);
  });
  const chartData = Object.entries(despesasPorCategoria).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);

  const openEdit = (d: any) => {
    setEditingDespesa(d);
    setFormProdutoId(d.produto_id || "");
    setFormValues({
      descricao: d.descricao || "",
      valor: d.valor ? String(d.valor) : "",
      data: d.data || new Date().toISOString().split("T")[0],
      categoria_id: d.categoria_id || "",
      conta_bancaria_id: d.conta_bancaria_id || "",
      produto_id: d.produto_id || "",
      turma_id: d.turma_id || "",
      fornecedor: d.fornecedor || "",
      forma_pagamento: d.forma_pagamento || "",
      recorrente: d.recorrente ? "true" : "false",
      observacoes: d.observacoes || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingDespesa(null);
    setFormProdutoId("");
    setFormValues(blankForm);
    setDialogOpen(true);
  };

  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const despDialogItems: Record<string, { title: string; items: MetricDetailItem[] }> = {
    total: {
      title: "Total Despesas",
      items: despesasMes.map((d: any) => ({ nome: d.descricao, data: d.data, valor: formatCurrency(Number(d.valor)) })),
    },
    categorias: {
      title: "Despesas por Categoria",
      items: Object.entries(despesasPorCategoria).map(([cat, valor]) => ({ nome: cat, data: "—", valor: formatCurrency(valor) })),
    },
    lancamentos: {
      title: "Lançamentos do Mês",
      items: despesasMes.map((d: any) => ({ nome: d.descricao, data: d.data, valor: formatCurrency(Number(d.valor)) })),
    },
  };
  const currentDespDialog = activeDialog ? despDialogItems[activeDialog] : null;

  return (
    <div className="space-y-6">
      <MetricDetailDialog
        open={!!activeDialog}
        onOpenChange={(o) => { if (!o) setActiveDialog(null); }}
        title={currentDespDialog?.title || ""}
        items={currentDespDialog?.items || []}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Total Despesas" value={formatCurrency(totalDespesas)} icon={TrendingDown} variant="destructive" onClick={() => setActiveDialog("total")} />
        <MetricCard title="Categorias" value={String(Object.keys(despesasPorCategoria).length)} icon={Receipt} variant="warning" onClick={() => setActiveDialog("categorias")} />
        <MetricCard title="Lançamentos" value={String(despesasMes.length)} icon={Wallet} variant="primary" onClick={() => setActiveDialog("lancamentos")} />
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: "8px", fontSize: "13px", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="valor" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold">Todas as Despesas</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setModalScannerAberto(true)} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Escanear Nota
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingDespesa(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Despesa</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingDespesa ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Label>Descrição *</Label>
                        <Input required value={formValues.descricao} onChange={(e) => setFormField("descricao", e.target.value)} />
                      </div>
                      <div>
                        <Label>Valor (R$) *</Label>
                        <Input type="number" step="0.01" required value={formValues.valor} onChange={(e) => setFormField("valor", e.target.value)} />
                      </div>
                      <div>
                        <Label>Data *</Label>
                        <Input type="date" required value={formValues.data} onChange={(e) => setFormField("data", e.target.value)} />
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.categoria_id} onChange={(e) => setFormField("categoria_id", e.target.value)}>
                          <option value="">Selecione</option>
                          {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Conta Bancária</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.conta_bancaria_id} onChange={(e) => setFormField("conta_bancaria_id", e.target.value)}>
                          <option value="">Selecione</option>
                          {contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Produto</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.produto_id} onChange={(e) => { setFormProdutoId(e.target.value); setFormField("produto_id", e.target.value); setFormField("turma_id", ""); }}>
                          <option value="">Nenhum</option>
                          {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Turma</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.turma_id} onChange={(e) => setFormField("turma_id", e.target.value)} disabled={!formProdutoId}>
                          <option value="">{formProdutoId ? "Selecione a turma" : "Selecione um produto primeiro"}</option>
                          {turmasFiltradas.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Fornecedor</Label>
                        <Input value={formValues.fornecedor} onChange={(e) => setFormField("fornecedor", e.target.value)} />
                      </div>
                      <div>
                        <Label>Forma de Pagamento</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.forma_pagamento} onChange={(e) => setFormField("forma_pagamento", e.target.value)}>
                          <option value="">Selecione</option>
                          <option value="pix">PIX</option>
                          <option value="boleto">Boleto</option>
                          <option value="cartao">Cartão</option>
                          <option value="transferencia">Transferência</option>
                          <option value="dinheiro">Dinheiro</option>
                          <option value="debito_automatico">Débito Automático</option>
                          <option value="cheque">Cheque</option>
                          <option value="permuta">Permuta</option>
                          <option value="recorrencia_cartao">Recorrência no Cartão</option>
                        </select>
                      </div>
                      <div>
                        <Label>Recorrente?</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formValues.recorrente} onChange={(e) => setFormField("recorrente", e.target.value)}>
                          <option value="false">Não</option>
                          <option value="true">Sim</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <Label>Observações</Label>
                        <Textarea rows={2} value={formValues.observacoes} onChange={(e) => setFormField("observacoes", e.target.value)} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={saveDespesa.isPending}>
                      {saveDespesa.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {editingDespesa ? "Salvar Alterações" : "Registrar Despesa"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.data} onChange={(e) => setFilter("data", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.descricao} onChange={(e) => setFilter("descricao", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.categoria} onChange={(e) => setFilter("categoria", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.produto} onChange={(e) => setFilter("produto", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.turma} onChange={(e) => setFilter("turma", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.fornecedor} onChange={(e) => setFilter("fornecedor", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.banco} onChange={(e) => setFilter("banco", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.forma} onChange={(e) => setFilter("forma", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.valor} onChange={(e) => setFilter("valor", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead className="p-1"><Input placeholder="Filtrar..." value={filters.observacoes} onChange={(e) => setFilter("observacoes", e.target.value)} className="h-7 text-xs" /></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{formatDate(d.data)}</TableCell>
                    <TableCell className="font-medium text-sm">{d.descricao}</TableCell>
                    <TableCell className="text-sm">
                      {(d as any).categorias_despesas?.nome ? (
                        <Badge variant="outline">{(d as any).categorias_despesas.nome}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{(d as any).produtos?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{(d as any).turmas?.nome || "Empresa"}</TableCell>
                    <TableCell className="text-sm">{d.fornecedor || "—"}</TableCell>
                    <TableCell className="text-sm">{(d as any).contas_bancarias?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{d.forma_pagamento || "—"}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-destructive">{formatCurrency(Number(d.valor))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={d.observacoes || ""}>{d.observacoes || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDespesa.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma despesa encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ModalScannerNota
        aberto={modalScannerAberto}
        onFechar={() => setModalScannerAberto(false)}
        onDadosExtraidos={handleDadosExtraidos}
      />
    </div>
  );
};
