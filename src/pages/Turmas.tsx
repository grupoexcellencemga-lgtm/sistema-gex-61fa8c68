import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Loader2, Trash2, ArrowLeft, ClipboardCheck, CheckCircle2, RotateCcw, Users, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useProfissionais } from "@/hooks/useProfissionais";
import { useDataFilter } from "@/hooks/useDataFilter";
import { TurmaPresencaTab } from "@/components/turmas/TurmaPresencaTab";
import { TurmaAlunosTab } from "@/components/turmas/TurmaAlunosTab";
import { TurmaFinanceiroTab } from "@/components/turmas/TurmaFinanceiroTab";
import { formatDate } from "@/lib/formatters";

interface TurmaForm {
  nome: string;
  cidade: string;
  modalidade: string;
  data_inicio: string;
  data_fim: string;
  responsavel: string;
  produto_id: string;
}

const emptyForm: TurmaForm = { nome: "", cidade: "", modalidade: "", data_inicio: "", data_fim: "", responsavel: "", produto_id: "" };

const Turmas = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const turmaIdFromUrl = searchParams.get("turma");
  const activeTurmaTab = searchParams.get("tab") || "alunos";

  const setTurmaUrl = (turmaId: string, tab = "presenca") => {
    const next = new URLSearchParams(searchParams);
    next.set("turma", turmaId);
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  };

  const clearTurmaUrl = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("turma");
    next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const handleTurmaTabChange = (tab: string) => {
    if (!selectedTurma?.id) return;
    const next = new URLSearchParams(searchParams);
    next.set("turma", selectedTurma.id);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const { data: profissionais = [] } = useProfissionais();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TurmaForm>(emptyForm);
  const [filters, setFilters] = useState<Record<string, string>>({ turma: "", produto: "", cidade: "", modalidade: "", periodo: "", responsavel: "" });
  const [statusFilter, setStatusFilter] = useState<string>("ativa");
  const [selectedTurma, setSelectedTurma] = useState<any | null>(null);

  const { filterByResponsavel } = useDataFilter();

  const { data: turmasRaw = [], isLoading } = useQuery({
    queryKey: ["turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("*, produtos(nome)").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const turmas = filterByResponsavel(turmasRaw);

  useEffect(() => {
    if (!turmaIdFromUrl) return;
    if (!turmas.length) return;

    const turmaDaUrl = turmas.find((t: any) => t.id === turmaIdFromUrl);
    if (!turmaDaUrl) return;

    setSelectedTurma((atual: any) => {
      if (atual?.id === turmaDaUrl.id) return atual;
      return turmaDaUrl;
    });
  }, [turmaIdFromUrl, turmas]);

  const openTurmaDetail = (turma: any) => {
    setSelectedTurma(turma);
    setTurmaUrl(turma.id, activeTurmaTab);
  };

  const closeTurmaDetail = () => {
    setSelectedTurma(null);
    clearTurmaUrl();
  };

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: matriculaCounts = [] } = useQuery({
    queryKey: ["matricula-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("turma_id, aluno_id")
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const countByTurma = (turmaId: string) => {
    const alunosUnicos = new Set(
      matriculaCounts
        .filter((m: any) => m.turma_id === turmaId && m.aluno_id)
        .map((m: any) => m.aluno_id)
    );

    return alunosUnicos.size;
  };

  const insertMutation = useMutation({
    mutationFn: async (data: TurmaForm) => {
      const { error } = await supabase.from("turmas").insert({
        nome: data.nome, cidade: data.cidade, modalidade: data.modalidade.toLowerCase(),
        data_inicio: data.data_inicio || null, data_fim: data.data_fim || null,
        responsavel: data.responsavel || null, produto_id: data.produto_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["turmas"] }); toast.success("Turma cadastrada"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TurmaForm }) => {
      const { error } = await supabase.from("turmas").update({
        nome: data.nome, cidade: data.cidade, modalidade: data.modalidade.toLowerCase(),
        data_inicio: data.data_inicio || null, data_fim: data.data_fim || null,
        responsavel: data.responsavel || null, produto_id: data.produto_id || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["turmas"] }); toast.success("Turma atualizada"); setDialogOpen(false); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("turmas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["turmas"] }); toast.success("Turma excluída"); },
    onError: (err: any) => toast.error("Erro ao excluir: " + err.message),
  });

  const finalizeMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("turmas").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
      if (vars.status === "finalizada") {
        toast.success("Turma finalizada");
        setSelectedTurma((prev: any) => prev ? { ...prev, status: "finalizada" } : null);
      } else {
        toast.success("Turma reativada");
        setSelectedTurma((prev: any) => prev ? { ...prev, status: "ativa" } : null);
      }
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setForm({
      nome: t.nome, cidade: t.cidade, modalidade: t.modalidade,
      data_inicio: t.data_inicio || "", data_fim: t.data_fim || "",
      responsavel: t.responsavel || "", produto_id: t.produto_id || "",
    });
    setEditingId(t.id); setDialogOpen(true);
  };

  const save = () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.cidade) { toast.error("Cidade é obrigatória"); return; }
    if (!form.modalidade) { toast.error("Modalidade é obrigatória"); return; }
    if (editingId) updateMutation.mutate({ id: editingId, data: form });
    else insertMutation.mutate(form);
  };

  const u = (field: keyof TurmaForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const isSaving = insertMutation.isPending || updateMutation.isPending;

  

  // Detail view for a turma
  if (selectedTurma) {
    const isFinalizada = selectedTurma.status === "finalizada";
    return (
      <div>
        <PageHeader title={selectedTurma.nome} description={`${selectedTurma.produtos?.nome || ""} • ${selectedTurma.cidade} • ${selectedTurma.modalidade}`}>
          <div className="flex gap-2">
            {isFinalizada ? (
              <Button variant="outline" onClick={() => finalizeMutation.mutate({ id: selectedTurma.id, status: "ativa" })} disabled={finalizeMutation.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" />Reativar Turma
              </Button>
            ) : (
              <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => {
                if (confirm("Deseja finalizar esta turma?")) finalizeMutation.mutate({ id: selectedTurma.id, status: "finalizada" });
              }} disabled={finalizeMutation.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" />Finalizar Turma
              </Button>
            )}
            <Button variant="outline" onClick={closeTurmaDetail}>
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
          </div>
        </PageHeader>
        {isFinalizada && (
          <Badge variant="secondary" className="mb-4 bg-green-100 text-green-800">Turma Finalizada</Badge>
        )}
        <Tabs value={activeTurmaTab} onValueChange={handleTurmaTabChange} className="mt-4">
          <TabsList>
            <TabsTrigger value="alunos"><Users className="h-4 w-4 mr-1" />Alunos</TabsTrigger>
            <TabsTrigger value="presenca"><ClipboardCheck className="h-4 w-4 mr-1" />Controle de Presença</TabsTrigger>
            <TabsTrigger value="financeiro"><DollarSign className="h-4 w-4 mr-1" />Financeiro</TabsTrigger>
          </TabsList>
          <TabsContent value="alunos">
            <TurmaAlunosTab turma={selectedTurma} />
          </TabsContent>
          <TabsContent value="presenca">
            <TurmaPresencaTab turma={selectedTurma} />
          </TabsContent>
          <TabsContent value="financeiro">
            <TurmaFinanceiroTab turma={selectedTurma} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Turmas" description="Gerencie as turmas dos produtos">
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nova Turma</Button>
      </PageHeader>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Editar Turma" : "Cadastrar Nova Turma"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="col-span-2"><Label>Nome da turma</Label><Input value={form.nome} onChange={(e) => u("nome", e.target.value)} placeholder="Ex: OPEX Turma 22" /></div>
            <div><Label>Produto</Label>
              <Select value={form.produto_id} onValueChange={(v) => u("produto_id", v)}>
                <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                <SelectContent>{produtos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => u("cidade", e.target.value)} placeholder="Ex: Maringá" /></div>
            <div><Label>Modalidade</Label>
              <Select value={form.modalidade} onValueChange={(v) => u("modalidade", v)}>
                <SelectTrigger><SelectValue placeholder="Modalidade" /></SelectTrigger>
                <SelectContent><SelectItem value="presencial">Presencial</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Responsável</Label>
              <Select value={form.responsavel} onValueChange={(v) => u("responsavel", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar profissional..." /></SelectTrigger>
                <SelectContent>{profissionais.map((p: any) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data de início</Label><Input type="date" value={form.data_inicio} onChange={(e) => u("data_inicio", e.target.value)} /></div>
            <div><Label>Data de término</Label><Input type="date" value={form.data_fim} onChange={(e) => u("data_fim", e.target.value)} /></div>
            <div className="col-span-2">
              <Button className="w-full" onClick={save} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Salvar Alterações" : "Cadastrar Turma"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex gap-2 mb-4">
        <Button variant={statusFilter === "ativa" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("ativa")}>Ativas</Button>
        <Button variant={statusFilter === "finalizada" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("finalizada")}>Finalizadas</Button>
        <Button variant={statusFilter === "todas" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("todas")}>Todas</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Turma</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Alunos</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
                <TableRow>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.turma} onChange={(e) => setFilters(prev => ({ ...prev, turma: e.target.value }))} /></TableHead>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.produto} onChange={(e) => setFilters(prev => ({ ...prev, produto: e.target.value }))} /></TableHead>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.cidade} onChange={(e) => setFilters(prev => ({ ...prev, cidade: e.target.value }))} /></TableHead>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.modalidade} onChange={(e) => setFilters(prev => ({ ...prev, modalidade: e.target.value }))} /></TableHead>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.periodo} onChange={(e) => setFilters(prev => ({ ...prev, periodo: e.target.value }))} /></TableHead>
                  <TableHead className="py-1"><Input placeholder="Filtrar..." className="h-7 text-xs" value={filters.responsavel} onChange={(e) => setFilters(prev => ({ ...prev, responsavel: e.target.value }))} /></TableHead>
                  <TableHead />
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {turmas.filter((t: any) => {
                  if (statusFilter !== "todas" && (t.status || "ativa") !== statusFilter) return false;
                  const m = (val: string, f: string) => !f.trim() || val.toLowerCase().includes(f.toLowerCase());
                  return (
                    m(t.nome || "", filters.turma) &&
                    m(t.produtos?.nome || "", filters.produto) &&
                    m(t.cidade || "", filters.cidade) &&
                    m(t.modalidade || "", filters.modalidade) &&
                    m(`${formatDate(t.data_inicio)} ${formatDate(t.data_fim)}`, filters.periodo) &&
                    m(t.responsavel || "", filters.responsavel)
                  );
                }).map((t: any) => (
                  <TableRow key={t.id} className={`transition-snappy hover:bg-secondary/50 cursor-pointer ${(t.status || "ativa") === "finalizada" ? "opacity-60" : ""}`} onClick={() => openTurmaDetail(t)}>
                    <TableCell className="font-medium text-sm">
                      {t.nome}
                      {(t.status || "ativa") === "finalizada" && <Badge variant="secondary" className="ml-2 text-xs">Finalizada</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{t.produtos?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{t.cidade}</TableCell>
                    <TableCell><Badge variant={t.modalidade === "online" ? "secondary" : "outline"}>{t.modalidade}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(t.data_inicio)} – {formatDate(t.data_fim)}</TableCell>
                    <TableCell className="text-sm">{t.responsavel}</TableCell>
                    <TableCell className="text-sm">{countByTurma(t.id)}</TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir esta turma?")) deleteMutation.mutate(t.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {turmas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma turma cadastrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Turmas;
