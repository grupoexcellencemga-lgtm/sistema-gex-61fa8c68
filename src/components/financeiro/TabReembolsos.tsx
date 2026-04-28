import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, Check, Pencil, Trash2, Wallet, DollarSign, Clock, AlertTriangle, Paperclip, Download, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { isInMonth } from "@/components/MonthFilter";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  pago: "default",
  pendente: "secondary",
};

export const TabReembolsos = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pagarDialogOpen, setPagarDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [payingItem, setPayingItem] = useState<any>(null);
  const [filterPessoa, setFilterPessoa] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    pessoa_nome: "", pessoa_tipo: "profissional", pessoa_id: "",
    descricao: "", valor: "", data_despesa: new Date().toISOString().split("T")[0],
    observacoes: "",
  });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string>("");

  const [payForm, setPayForm] = useState({
    conta_bancaria_id: "", forma_pagamento: "", data_reembolso: new Date().toISOString().split("T")[0],
  });

  const { data: reembolsos = [], isLoading } = useQuery({
    queryKey: ["reembolsos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reembolsos")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profissionais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: comerciais = [] } = useQuery({
    queryKey: ["comerciais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
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

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_despesas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_despesas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento = [], isLoading: loadingFormasPagamento } = useFormasPagamento();

  const pessoas = [
    ...profissionais.map(p => ({ ...p, tipo: "profissional" })),
    ...comerciais.map(c => ({ ...c, tipo: "comercial" })),
  ];

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingItem) {
        const { error } = await supabase.from("reembolsos").update(data).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reembolsos").insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reembolsos"] });
      setDialogOpen(false);
      setEditingItem(null);
      toast({ title: editingItem ? "Reembolso atualizado" : "Reembolso registrado" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, data, reembolso }: { id: string; data: any; reembolso: any }) => {
      // Create a despesa linked to this reembolso
      const despesaId = crypto.randomUUID();
      const { error: despErr } = await supabase.from("despesas").insert({
        id: despesaId,
        descricao: `Reembolso: ${reembolso.descricao} (${reembolso.pessoa_nome})`,
        valor: Number(reembolso.valor),
        data: data.data_reembolso,
        conta_bancaria_id: data.conta_bancaria_id,
        forma_pagamento: data.forma_pagamento || null,
        fornecedor: reembolso.pessoa_nome,
        observacoes: `Reembolso pago a ${reembolso.pessoa_nome}`,
      });
      if (despErr) throw despErr;

      const { error } = await supabase.from("reembolsos").update({
        ...data,
        status: "pago",
        despesa_id: despesaId,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reembolsos"] });
      setPagarDialogOpen(false);
      setPayingItem(null);
      toast({ title: "Reembolso pago com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao pagar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reembolso: any) => {
      // Se tinha despesa vinculada (estava pago), excluir a despesa primeiro
      if (reembolso.despesa_id) {
        const { error: despErr } = await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", reembolso.despesa_id);
        if (despErr) throw despErr;
      }
      const { error } = await supabase.from("reembolsos").update({ deleted_at: new Date().toISOString() }).eq("id", reembolso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reembolsos"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Reembolso removido e despesa estornada" });
    },
  });

  const handleSave = async () => {
    if (!form.pessoa_nome || !form.descricao || !form.valor) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    let comprovante_url: string | null = editingItem?.comprovante_url || null;
    if (arquivo) {
      setUploading(true);
      const ext = arquivo.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprovantes_reembolsos").upload(path, arquivo);
      if (upErr) {
        toast({ title: "Erro ao enviar arquivo", variant: "destructive" });
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("comprovantes_reembolsos").getPublicUrl(path);
      comprovante_url = urlData.publicUrl;
      setUploading(false);
    }
    const selected = pessoas.find(p => p.id === form.pessoa_id);
    saveMutation.mutate({
      pessoa_nome: selected?.nome || form.pessoa_nome,
      pessoa_tipo: selected?.tipo || form.pessoa_tipo,
      pessoa_id: form.pessoa_id || null,
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_despesa: form.data_despesa,
      observacoes: form.observacoes || null,
      comprovante_url,
      categoria_id: categoriaId || null,
    });
  };

  const handlePay = () => {
    if (!payForm.conta_bancaria_id) {
      toast({ title: "Selecione a conta bancária", variant: "destructive" });
      return;
    }
    payMutation.mutate({
      id: payingItem.id,
      reembolso: payingItem,
      data: {
        conta_bancaria_id: payForm.conta_bancaria_id,
        forma_pagamento: payForm.forma_pagamento || null,
        data_reembolso: payForm.data_reembolso,
      },
    });
  };

  const openNew = () => {
    setEditingItem(null);
    setArquivo(null);
    setForm({ pessoa_nome: "", pessoa_tipo: "profissional", pessoa_id: "", descricao: "", valor: "", data_despesa: new Date().toISOString().split("T")[0], observacoes: "" });
    setCategoriaId("");
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingItem(r);
    setArquivo(null);
    setForm({
      pessoa_nome: r.pessoa_nome, pessoa_tipo: r.pessoa_tipo, pessoa_id: r.pessoa_id || "",
      descricao: r.descricao, valor: String(r.valor), data_despesa: r.data_despesa, observacoes: r.observacoes || "",
    });
    setCategoriaId(r.categoria_id || "");
    setDialogOpen(true);
  };

  const openPay = (r: any) => {
    setPayingItem(r);
    setPayForm({ conta_bancaria_id: "", forma_pagamento: "", data_reembolso: new Date().toISOString().split("T")[0] });
    setPagarDialogOpen(true);
  };

  // Filter by month
  const reembolsosMes = reembolsos.filter((r: any) => isInMonth(r.data_despesa, mes, ano));

  // Saldo por pessoa
  const saldoPorPessoa: Record<string, { nome: string; tipo: string; pendente: number; pago: number }> = {};
  reembolsosMes.forEach((r: any) => {
    const key = r.pessoa_id || r.pessoa_nome;
    if (!saldoPorPessoa[key]) saldoPorPessoa[key] = { nome: r.pessoa_nome, tipo: r.pessoa_tipo, pendente: 0, pago: 0 };
    if (r.status === "pendente") saldoPorPessoa[key].pendente += Number(r.valor);
    else saldoPorPessoa[key].pago += Number(r.valor);
  });
  const saldoList = Object.values(saldoPorPessoa).filter(s => s.pendente > 0 || s.pago > 0).sort((a, b) => b.pendente - a.pendente);

  const totalPendente = reembolsosMes.filter((r: any) => r.status === "pendente").reduce((s: number, r: any) => s + Number(r.valor), 0);
  const totalPago = reembolsosMes.filter((r: any) => r.status === "pago").reduce((s: number, r: any) => s + Number(r.valor), 0);

  // Filter
  const filtered = reembolsosMes.filter((r: any) => {
    if (filterPessoa && !r.pessoa_nome.toLowerCase().includes(filterPessoa.toLowerCase())) return false;
    if (filterStatus !== "todos" && r.status !== filterStatus) return false;
    return true;
  });

  const pageSize = 15;
  const paginated = paginate(filtered, page, pageSize);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pendente</p>
              <p className="text-lg font-bold text-destructive">{formatCurrency(totalPendente)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Reembolsado</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalPago)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><Clock className="h-5 w-5 text-muted-foreground" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Itens Pendentes</p>
              <p className="text-lg font-bold">{reembolsos.filter((r: any) => r.status === "pendente").length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Saldo por pessoa */}
      {saldoList.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Saldo Devedor por Pessoa</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {saldoList.map(s => (
                <div key={s.nome} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium text-sm">{s.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.tipo === "comercial" ? "Vendedor" : "Profissional"}</p>
                  </div>
                  <div className="text-right">
                    {s.pendente > 0 && <p className="text-sm font-semibold text-destructive">{formatCurrency(s.pendente)}</p>}
                    {s.pago > 0 && <p className="text-xs text-muted-foreground">Pago: {formatCurrency(s.pago)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros + botão */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">Buscar pessoa</Label>
          <Input placeholder="Nome..." value={filterPessoa} onChange={e => setFilterPessoa(e.target.value)} />
        </div>
        <div className="w-40">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Reembolso</Button>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Data Despesa</TableHead>
                <TableHead>Data Reembolso</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum reembolso registrado</TableCell></TableRow>
              ) : paginated.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-sm">{r.pessoa_nome}</span>
                      <span className="block text-xs text-muted-foreground capitalize">{r.pessoa_tipo === "comercial" ? "Vendedor" : "Profissional"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    <div className="flex items-center gap-1">
                      {r.descricao}
                      {r.comprovante_url && (
                        <a href={r.comprovante_url} target="_blank" rel="noopener noreferrer" title="Ver comprovante">
                          <Paperclip className="h-3.5 w-3.5 text-primary inline" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(Number(r.valor))}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.data_despesa)}</TableCell>
                  <TableCell className="text-sm">{formatDate(r.data_reembolso)}</TableCell>
                  <TableCell className="text-sm">{r.contas_bancarias?.nome || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] || "secondary"}>
                      {r.status === "pago" ? "Pago" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {r.status === "pendente" && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => openPay(r)} title="Pagar reembolso">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Remover este reembolso?")) deleteMutation.mutate(r); }} title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Dialog: Novo/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Reembolso" : "Novo Reembolso"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pessoa *</Label>
              <Select value={form.pessoa_id} onValueChange={v => {
                const p = pessoas.find(x => x.id === v);
                setForm(f => ({ ...f, pessoa_id: v, pessoa_nome: p?.nome || "", pessoa_tipo: p?.tipo || "profissional" }));
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione quem adiantou..." /></SelectTrigger>
                <SelectContent>
                  {pessoas.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} <span className="text-muted-foreground ml-1">({p.tipo === "comercial" ? "Vendedor" : "Profissional"})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Almoço equipe dia 20/03" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data da Despesa</Label>
                <Input type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria..." /></SelectTrigger>
                <SelectContent>
                  {categorias.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Detalhes adicionais..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div>
              <Label>Nota / Comprovante</Label>
              {editingItem?.comprovante_url && !arquivo && (
                <div className="flex items-center gap-2 mb-2 p-2 rounded-lg border bg-muted/50">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <a href={editingItem.comprovante_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate flex-1">
                    Arquivo anexado
                  </a>
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingItem({ ...editingItem, comprovante_url: null }); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={e => setArquivo(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG (opcional)</p>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saveMutation.isPending || uploading}>
              {(saveMutation.isPending || uploading) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {editingItem ? "Salvar Alterações" : "Registrar Reembolso"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Pagar */}
      <Dialog open={pagarDialogOpen} onOpenChange={setPagarDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pagar Reembolso</DialogTitle></DialogHeader>
          {payingItem && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm"><strong>{payingItem.pessoa_nome}</strong></p>
                <p className="text-sm text-muted-foreground">{payingItem.descricao}</p>
                <p className="text-lg font-bold text-primary mt-1">{formatCurrency(Number(payingItem.valor))}</p>
              </div>
              <div>
                <Label>Conta Bancária *</Label>
                <Select value={payForm.conta_bancaria_id} onValueChange={v => setPayForm(f => ({ ...f, conta_bancaria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Forma de Pagamento</Label>
                  <Select value={payForm.forma_pagamento} onValueChange={v => setPayForm(f => ({ ...f, forma_pagamento: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {loadingFormasPagamento ? (
                        <SelectItem value="carregando_formas_pagamento" disabled>
                          Carregando formas...
                        </SelectItem>
                      ) : formasPagamento.length === 0 ? (
                        <SelectItem value="nenhuma_forma_pagamento" disabled>
                          Nenhuma forma cadastrada
                        </SelectItem>
                      ) : (
                        formasPagamento.map((forma) => (
                          <SelectItem key={forma.id} value={forma.codigo}>
                            {forma.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data do Reembolso</Label>
                  <Input type="date" value={payForm.data_reembolso} onChange={e => setPayForm(f => ({ ...f, data_reembolso: e.target.value }))} />
                </div>
              </div>
              <Button className="w-full" onClick={handlePay} disabled={payMutation.isPending}>
                {payMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
