import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useProfissionais } from "@/hooks/useProfissionais";

interface ProdutoForm {
  nome: string;
  tipo: string;
  responsavel: string;
  duracao: string;
  descricao: string;
  valor: string;
  parcelas_cartao: string;
  valor_parcela: string;
}

const emptyForm: ProdutoForm = { nome: "", tipo: "", responsavel: "", duracao: "", descricao: "", valor: "", parcelas_cartao: "12", valor_parcela: "" };

const tipoBadge: Record<string, "default" | "secondary" | "outline"> = {
  curso: "default",
  comunidade: "secondary",
  evento: "outline",
};
import { formatCurrency } from "@/lib/formatters";

const Produtos = () => {
  const { data: profissionais = [] } = useProfissionais();
  const queryClient = useQueryClient();
  useRealtimeSync("produtos", [["produtos"]]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProdutoForm>(emptyForm);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (data: ProdutoForm) => {
      const { error } = await supabase.from("produtos").insert({
        nome: data.nome,
        tipo: data.tipo.toLowerCase(),
        responsavel: data.responsavel || null,
        duracao: data.duracao || null,
        descricao: data.descricao || null,
        valor: data.valor ? Number(data.valor) : 0,
        parcelas_cartao: data.parcelas_cartao ? Number(data.parcelas_cartao) : 12,
        valor_parcela: data.valor_parcela ? Number(data.valor_parcela) : 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto cadastrado"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProdutoForm }) => {
      const { error } = await supabase.from("produtos").update({
        nome: data.nome,
        tipo: data.tipo.toLowerCase(),
        responsavel: data.responsavel || null,
        duracao: data.duracao || null,
        descricao: data.descricao || null,
        valor: data.valor ? Number(data.valor) : 0,
        parcelas_cartao: data.parcelas_cartao ? Number(data.parcelas_cartao) : 12,
        valor_parcela: data.valor_parcela ? Number(data.valor_parcela) : 0,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto atualizado"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("produtos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto excluído"); },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (p: any) => {
    setForm({ nome: p.nome, tipo: p.tipo, responsavel: p.responsavel || "", duracao: p.duracao || "", descricao: p.descricao || "", valor: p.valor ? String(p.valor) : "", parcelas_cartao: (p as any).parcelas_cartao ? String((p as any).parcelas_cartao) : "12", valor_parcela: (p as any).valor_parcela ? String((p as any).valor_parcela) : "" });
    setEditingId(p.id); setDialogOpen(true);
  };

  const save = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.tipo) { toast.error("Tipo é obrigatório"); return; }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else insertMutation.mutate(form);
  };

  const u = (field: keyof ProdutoForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isSaving = insertMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <PageHeader title="Produtos" description="Gerencie os produtos do Grupo Excellence">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
      </PageHeader>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Editar Produto" : "Cadastrar Novo Produto"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 mt-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => u("nome", e.target.value)} placeholder="Nome do produto" /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => u("descricao", e.target.value)} placeholder="Descreva o produto" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => u("tipo", v)}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent><SelectItem value="curso">Curso</SelectItem><SelectItem value="comunidade">Comunidade</SelectItem><SelectItem value="evento">Evento</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Duração</Label><Input value={form.duracao} onChange={(e) => u("duracao", e.target.value)} placeholder="Ex: 6 meses" /></div>
              <div><Label>Valor à vista (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => u("valor", e.target.value)} placeholder="0,00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Parcelas no cartão</Label><Input type="number" value={form.parcelas_cartao} onChange={(e) => u("parcelas_cartao", e.target.value)} placeholder="12" /></div>
              <div><Label>Valor da parcela (R$)</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => u("valor_parcela", e.target.value)} placeholder="Ex: 99.70" /></div>
            </div>
            <div><Label>Responsável</Label>
              <Select value={form.responsavel} onValueChange={(v) => u("responsavel", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar profissional..." /></SelectTrigger>
                <SelectContent>
                  {profissionais.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={save} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Salvar Alterações" : "Cadastrar Produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => (
                  <TableRow key={p.id} className="transition-snappy hover:bg-secondary/50">
                    <TableCell>
                      <div><p className="font-medium text-sm">{p.nome}</p><p className="text-xs text-muted-foreground">{p.descricao}</p></div>
                    </TableCell>
                    <TableCell><Badge variant={tipoBadge[p.tipo] || "outline"}>{p.tipo}</Badge></TableCell>
                    <TableCell className="text-sm">
                      <p className="font-semibold">{formatCurrency(Number((p as any).valor || 0))} à vista</p>
                      {(p as any).valor_parcela > 0 && (
                        <p className="text-xs text-muted-foreground">{(p as any).parcelas_cartao || 12}x de {formatCurrency(Number((p as any).valor_parcela))} no cartão</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{p.responsavel}</TableCell>
                    <TableCell className="text-sm">{p.duracao}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir este produto?")) deleteMutation.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {produtos.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Produtos;
