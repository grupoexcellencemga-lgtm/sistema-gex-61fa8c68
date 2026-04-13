import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, Plus, Pencil, Trash2, Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";

const TIPOS_META = [
  { value: "receita", label: "Receita" },
  { value: "matriculas", label: "Matrículas" },
  { value: "leads", label: "Leads" },
  { value: "processos", label: "Processos" },
  { value: "financeira", label: "Financeira (Lucro)" },
  { value: "personalizada", label: "Personalizada" },
];

const TIPO_LABELS: Record<string, string> = Object.fromEntries(TIPOS_META.map(t => [t.value, t.label]));

interface MetaForm {
  titulo: string;
  tipo: string;
  valor_meta: string;
  valor_atual: string;
  periodo_inicio: string;
  periodo_fim: string;
  responsavel_tipo: string;
  responsavel_id: string;
  descricao: string;
}

const emptyForm: MetaForm = {
  titulo: "", tipo: "receita", valor_meta: "", valor_atual: "0",
  periodo_inicio: "", periodo_fim: "", responsavel_tipo: "todos",
  responsavel_id: "", descricao: "",
};

const Metas = () => {
  const queryClient = useQueryClient();
  useRealtimeSync("metas", [["metas"]]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<MetaForm>(emptyForm);

  const set = (key: keyof MetaForm, val: string) => setForm(f => ({ ...f, [key]: val }));

  const { data: metas = [], isLoading } = useQuery({
    queryKey: ["metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("metas").select("*").is("deleted_at", null).order("periodo_fim", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: comerciais = [] } = useQuery({
    queryKey: ["comerciais-metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-metas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profissionais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date().toISOString().split("T")[0];
  const metasAtivas = useMemo(() => metas.filter((m: any) => m.periodo_inicio <= hoje && m.periodo_fim >= hoje), [metas, hoje]);
  const metasEncerradas = useMemo(() => metas.filter((m: any) => m.periodo_fim < hoje), [metas, hoje]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Título obrigatório");
      if (!form.valor_meta || Number(form.valor_meta) <= 0) throw new Error("Valor da meta obrigatório");
      if (!form.periodo_inicio || !form.periodo_fim) throw new Error("Período obrigatório");

      const payload: any = {
        titulo: form.titulo,
        tipo: form.tipo,
        valor_meta: Number(form.valor_meta),
        valor_atual: form.tipo === "personalizada" ? Number(form.valor_atual || 0) : 0,
        periodo_inicio: form.periodo_inicio,
        periodo_fim: form.periodo_fim,
        descricao: form.descricao || null,
        responsavel_tipo: form.responsavel_tipo,
        responsavel_id: form.responsavel_id && form.responsavel_id !== "none" ? form.responsavel_id : null,
      };

      if (editing) {
        const { error } = await supabase.from("metas").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("metas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success(editing ? "Meta atualizada" : "Meta criada");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("metas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      toast.success("Meta excluída");
    },
  });

  const atualizarMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("atualizar_metas_ativas");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metas"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      toast.success("Metas atualizadas automaticamente");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const openEdit = (meta: any) => {
    setEditing(meta);
    setForm({
      titulo: meta.titulo,
      tipo: meta.tipo,
      valor_meta: String(meta.valor_meta),
      valor_atual: String(meta.valor_atual),
      periodo_inicio: meta.periodo_inicio,
      periodo_fim: meta.periodo_fim,
      responsavel_tipo: meta.responsavel_tipo || "todos",
      responsavel_id: meta.responsavel_id || "",
      descricao: meta.descricao || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const isMoneyType = (tipo: string) => tipo === "receita" || tipo === "financeira";

  const formatMetaValue = (val: number, tipo: string) =>
    isMoneyType(tipo) ? formatCurrency(val) : String(val);

  const getResponsavelName = (meta: any) => {
    if (meta.responsavel_tipo === "comercial" && meta.responsavel_id) {
      return comerciais.find((c: any) => c.id === meta.responsavel_id)?.nome || "—";
    }
    if (meta.responsavel_tipo === "profissional" && meta.responsavel_id) {
      return profissionais.find((p: any) => p.id === meta.responsavel_id)?.nome || "—";
    }
    return "Todos";
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Gestão de Metas" description="Acompanhe e gerencie as metas da equipe">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => atualizarMutation.mutate()} disabled={atualizarMutation.isPending}>
            {atualizarMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar Valores
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />Nova Meta
          </Button>
        </div>
      </PageHeader>

      {/* Metas Ativas */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : metasAtivas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Target className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Nenhuma meta ativa no período atual.</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>Criar primeira meta</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metasAtivas.map((meta: any) => {
            const pct = meta.valor_meta > 0 ? Math.min((Number(meta.valor_atual) / Number(meta.valor_meta)) * 100, 100) : 0;
            const atingida = pct >= 100;
            return (
              <Card key={meta.id} className={atingida ? "border-success/30 bg-success/5" : ""}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{meta.titulo}</h3>
                        <Badge variant="outline" className="text-[10px]">{TIPO_LABELS[meta.tipo] || meta.tipo}</Badge>
                        {atingida && <Badge className="bg-success text-success-foreground text-[10px]">Atingida!</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {meta.periodo_inicio} — {meta.periodo_fim} · {getResponsavelName(meta)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(meta)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(meta.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="font-medium">
                        {formatMetaValue(Number(meta.valor_atual), meta.tipo)} / {formatMetaValue(Number(meta.valor_meta), meta.tipo)}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2.5" />
                    <p className="text-xs text-muted-foreground text-right mt-1">{pct.toFixed(1)}%</p>
                  </div>
                  {meta.descricao && <p className="text-xs text-muted-foreground">{meta.descricao}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Metas Encerradas */}
      {metasEncerradas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Metas Encerradas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {metasEncerradas.map((meta: any) => {
                  const pct = meta.valor_meta > 0 ? (Number(meta.valor_atual) / Number(meta.valor_meta)) * 100 : 0;
                  const atingida = pct >= 100;
                  return (
                    <TableRow key={meta.id}>
                      <TableCell className="font-medium">{meta.titulo}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{TIPO_LABELS[meta.tipo] || meta.tipo}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{meta.periodo_inicio} — {meta.periodo_fim}</TableCell>
                      <TableCell className="text-sm">
                        {formatMetaValue(Number(meta.valor_atual), meta.tipo)} / {formatMetaValue(Number(meta.valor_meta), meta.tipo)} ({pct.toFixed(0)}%)
                      </TableCell>
                      <TableCell>
                        {atingida ? (
                          <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Atingida</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Não atingida</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(meta.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Meta" : "Nova Meta"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Título *</Label><Input value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Ex: Receita Q1 2026" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.tipo} onValueChange={v => set("tipo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_META.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da Meta *</Label>
                <Input type="number" value={form.valor_meta} onChange={e => set("valor_meta", e.target.value)} placeholder="0" />
              </div>
            </div>

            {form.tipo === "personalizada" && (
              <div>
                <Label>Valor Atual (manual)</Label>
                <Input type="number" value={form.valor_atual} onChange={e => set("valor_atual", e.target.value)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início *</Label><Input type="date" value={form.periodo_inicio} onChange={e => set("periodo_inicio", e.target.value)} /></div>
              <div><Label>Fim *</Label><Input type="date" value={form.periodo_fim} onChange={e => set("periodo_fim", e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Select value={form.responsavel_tipo} onValueChange={v => { set("responsavel_tipo", v); set("responsavel_id", ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="comercial">Vendedor</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.responsavel_tipo === "comercial" && (
                <div>
                  <Label>Vendedor</Label>
                  <Select value={form.responsavel_id} onValueChange={v => set("responsavel_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {comerciais.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.responsavel_tipo === "profissional" && (
                <div>
                  <Label>Profissional</Label>
                  <Select value={form.responsavel_id} onValueChange={v => set("responsavel_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {profissionais.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Descrição opcional" /></div>

            <Button className="w-full" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar Alterações" : "Criar Meta"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Metas;
