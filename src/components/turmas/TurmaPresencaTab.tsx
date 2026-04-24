import { useState } from "react";
import { formatDate } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, Check, X, AlertTriangle, CheckCheck, MessageCircle, Trophy, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  turma: any;
}

type PresencaStatus = "presente" | "ausente" | "justificado";

const statusIcon = (s: PresencaStatus) => {
  if (s === "presente") return <Check className="h-4 w-4 text-emerald-600" />;
  if (s === "justificado") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <X className="h-4 w-4 text-destructive" />;
};

const nextStatus = (current: PresencaStatus): PresencaStatus => {
  if (current === "ausente") return "presente";
  if (current === "presente") return "justificado";
  return "ausente";
};

const frequencyBadge = (pct: number) => {
  if (pct >= 75) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">🟢 Frequente ({pct}%)</Badge>;
  if (pct >= 50) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">🟡 Irregular ({pct}%)</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">🔴 Baixa presença ({pct}%)</Badge>;
};

export function TurmaPresencaTab({ turma }: Props) {
  const queryClient = useQueryClient();
  const [addEncontroOpen, setAddEncontroOpen] = useState(false);
  const [newEncontro, setNewEncontro] = useState({ data: "", descricao: "" });
  const [obsDialog, setObsDialog] = useState<{ presencaId: string; obs: string } | null>(null);

  // Fetch encontros
  const { data: encontros = [], isLoading: loadingEncontros } = useQuery({
    queryKey: ["encontros", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encontros")
        .select("*")
        .eq("turma_id", turma.id)
        .order("sessao_numero");
      if (error) throw error;
      return data;
    },
  });

  // Fetch alunos matriculados nesta turma
  const { data: alunosMatriculados = [] } = useQuery({
    queryKey: ["alunos-turma", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("aluno_id, alunos(id, nome, telefone)")
        .eq("turma_id", turma.id);
      if (error) throw error;
      return data?.map((m: any) => m.alunos).filter(Boolean) || [];
    },
  });

  // Fetch presencas
  const { data: presencas = [] } = useQuery({
    queryKey: ["presencas", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presencas")
        .select("*")
        .eq("turma_id", turma.id);
      if (error) throw error;
      return data;
    },
  });

  // Add encontro
  const addEncontroMut = useMutation({
    mutationFn: async () => {
      const nextNum = encontros.length + 1;
      const { error } = await supabase.from("encontros").insert({
        turma_id: turma.id,
        sessao_numero: nextNum,
        data: newEncontro.data || null,
        descricao: newEncontro.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      toast.success("Encontro adicionado");
      setAddEncontroOpen(false);
      setNewEncontro({ data: "", descricao: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete encontro
  const deleteEncontroMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("encontros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      queryClient.invalidateQueries({ queryKey: ["presencas", turma.id] });
      toast.success("Encontro removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle presença (upsert)
  const togglePresenca = useMutation({
    mutationFn: async ({ alunoId, encontroId, currentStatus }: { alunoId: string; encontroId: string; currentStatus: PresencaStatus }) => {
      const newSt = nextStatus(currentStatus);
      const existing = presencas.find((p: any) => p.aluno_id === alunoId && p.encontro_id === encontroId);
      if (existing) {
        const { error } = await supabase.from("presencas").update({ status: newSt }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("presencas").insert({
          aluno_id: alunoId,
          turma_id: turma.id,
          encontro_id: encontroId,
          status: newSt,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["presencas", turma.id] }),
  });

  // Mark all present for a session
  const markAllPresent = useMutation({
    mutationFn: async (encontroId: string) => {
      const inserts = alunosMatriculados
        .filter((a: any) => !presencas.find((p: any) => p.aluno_id === a.id && p.encontro_id === encontroId))
        .map((a: any) => ({
          aluno_id: a.id,
          turma_id: turma.id,
          encontro_id: encontroId,
          status: "presente",
        }));

      const updates = presencas
        .filter((p: any) => p.encontro_id === encontroId && p.status !== "presente")
        .map((p: any) => p.id);

      if (inserts.length > 0) {
        const { error } = await supabase.from("presencas").insert(inserts);
        if (error) throw error;
      }
      if (updates.length > 0) {
        for (const id of updates) {
          const { error } = await supabase.from("presencas").update({ status: "presente" }).eq("id", id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presencas", turma.id] });
      toast.success("Todos marcados como presente");
    },
  });

  // Save observation
  const saveObs = useMutation({
    mutationFn: async ({ id, obs }: { id: string; obs: string }) => {
      const { error } = await supabase.from("presencas").update({ observacoes: obs }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presencas", turma.id] });
      toast.success("Observação salva");
      setObsDialog(null);
    },
  });

  const getPresenca = (alunoId: string, encontroId: string): PresencaStatus => {
    const p = presencas.find((p: any) => p.aluno_id === alunoId && p.encontro_id === encontroId);
    return (p?.status as PresencaStatus) || "ausente";
  };

  const getPresencaRecord = (alunoId: string, encontroId: string) => {
    return presencas.find((p: any) => p.aluno_id === alunoId && p.encontro_id === encontroId);
  };

  const calcFrequency = (alunoId: string) => {
    if (encontros.length === 0) return 0;
    const present = encontros.filter((e: any) => {
      const s = getPresenca(alunoId, e.id);
      return s === "presente" || s === "justificado";
    }).length;
    return Math.round((present / encontros.length) * 100);
  };

  // Alerts
  const getAlerts = () => {
    const alerts: { aluno: string; telefone?: string; message: string; type: "danger" | "warning" | "success" }[] = [];
    alunosMatriculados.forEach((a: any) => {
      const pct = calcFrequency(a.id);
      // Check consecutive absences
      let consecutiveAbsences = 0;
      for (let i = encontros.length - 1; i >= 0; i--) {
        if (getPresenca(a.id, encontros[i].id) === "ausente") consecutiveAbsences++;
        else break;
      }
      if (consecutiveAbsences >= 2) {
        alerts.push({ aluno: a.nome, telefone: a.telefone, message: `Faltou ${consecutiveAbsences} sessões seguidas`, type: "danger" });
      } else if (pct < 50 && encontros.length > 0) {
        alerts.push({ aluno: a.nome, telefone: a.telefone, message: `Baixa frequência (${pct}%)`, type: "warning" });
      } else if (pct >= 90 && encontros.length >= 2) {
        alerts.push({ aluno: a.nome, message: `Altamente engajado (${pct}%)`, type: "success" });
      }
    });
    return alerts;
  };

  // Ranking
  const ranking = alunosMatriculados
    .map((a: any) => ({ ...a, pct: calcFrequency(a.id) }))
    .sort((a: any, b: any) => b.pct - a.pct);

  const alerts = getAlerts();
  const avgFrequency = alunosMatriculados.length > 0
    ? Math.round(alunosMatriculados.reduce((sum: number, a: any) => sum + calcFrequency(a.id), 0) / alunosMatriculados.length)
    : 0;

  // formatDate imported from @/lib/formatters at top

  const whatsappLink = (phone: string | null) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/55${clean}`;
  };

  if (loadingEncontros) return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{alunosMatriculados.length}</div>
            <div className="text-xs text-muted-foreground">Alunos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{encontros.length}</div>
            <div className="text-xs text-muted-foreground">Encontros</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{avgFrequency}%</div>
            <div className="text-xs text-muted-foreground">Frequência Média</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{alerts.filter(a => a.type === "danger").length}</div>
            <div className="text-xs text-muted-foreground">Alertas Críticos</div>
          </CardContent>
        </Card>
      </div>

      {/* Encontros + Presença Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Controle de Presença</CardTitle>
          <Button size="sm" onClick={() => setAddEncontroOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Novo Encontro
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {encontros.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum encontro cadastrado. Adicione o primeiro encontro.</p>
          ) : alunosMatriculados.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Nenhum aluno matriculado nesta turma.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Aluno</TableHead>
                    {encontros.map((e: any) => (
                      <TableHead key={e.id} className="text-center min-w-[80px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-medium">S{e.sessao_numero}</span>
                          {e.data && <span className="text-[10px] text-muted-foreground">{formatDate(e.data)}</span>}
                          <div className="flex gap-0.5">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => markAllPresent.mutate(e.id)}>
                                    <CheckCheck className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Marcar todos presente</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { if (confirm("Excluir encontro?")) deleteEncontroMut.mutate(e.id); }}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[120px]">Frequência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((aluno: any) => (
                    <TableRow key={aluno.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {aluno.nome}
                          {aluno.telefone && (
                            <a href={whatsappLink(aluno.telefone) || "#"} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="h-3.5 w-3.5 text-emerald-600 hover:text-emerald-700" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      {encontros.map((e: any) => {
                        const status = getPresenca(aluno.id, e.id);
                        const record = getPresencaRecord(aluno.id, e.id);
                        return (
                          <TableCell key={e.id} className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => togglePresenca.mutate({ alunoId: aluno.id, encontroId: e.id, currentStatus: status })}
                              >
                                {statusIcon(status)}
                              </Button>
                              {record && (
                                <button
                                  className="text-[10px] text-muted-foreground hover:text-foreground"
                                  onClick={() => setObsDialog({ presencaId: record.id, obs: record.observacoes || "" })}
                                >
                                  {record.observacoes ? "📝" : "…"}
                                </button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">{frequencyBadge(aluno.pct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🔔 Alertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-sm ${
                alert.type === "danger" ? "bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800" :
                alert.type === "warning" ? "bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" :
                "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
              }`}>
                <div>
                  <span className="font-medium">{alert.aluno}</span>
                  <span className="ml-2 text-muted-foreground">{alert.message}</span>
                </div>
                {alert.type === "danger" && alert.telefone && (
                  <a href={whatsappLink(alert.telefone) || "#"} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="text-xs">
                      <MessageCircle className="h-3 w-3 mr-1" />Chamar
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" />Ranking de Engajamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {ranking.slice(0, 5).map((a: any, i: number) => (
                <div key={a.id} className="flex items-center justify-between p-2 rounded text-sm hover:bg-muted/50">
                  <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`} {a.nome}</span>
                  {frequencyBadge(a.pct)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Encontro Dialog */}
      <Dialog open={addEncontroOpen} onOpenChange={setAddEncontroOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Encontro (Sessão {encontros.length + 1})</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Data do encontro</Label><Input type="date" value={newEncontro.data} onChange={e => setNewEncontro(p => ({ ...p, data: e.target.value }))} /></div>
            <div><Label>Descrição (opcional)</Label><Input value={newEncontro.descricao} onChange={e => setNewEncontro(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Módulo 1 - Introdução" /></div>
            <Button className="w-full" onClick={() => addEncontroMut.mutate()} disabled={addEncontroMut.isPending}>
              {addEncontroMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Adicionar Encontro
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Observation Dialog */}
      <Dialog open={!!obsDialog} onOpenChange={() => setObsDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Observação</DialogTitle></DialogHeader>
          <Textarea
            value={obsDialog?.obs || ""}
            onChange={e => setObsDialog(prev => prev ? { ...prev, obs: e.target.value } : null)}
            placeholder="Registrar observação..."
            rows={3}
          />
          <Button onClick={() => obsDialog && saveObs.mutate({ id: obsDialog.presencaId, obs: obsDialog.obs })} disabled={saveObs.isPending}>
            {saveObs.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
