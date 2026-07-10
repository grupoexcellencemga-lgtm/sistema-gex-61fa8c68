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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Loader2, Check, X, AlertTriangle, CheckCheck, MessageCircle, Trophy, Trash2, Pencil, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { recalcularPrazosDaTurma } from "@/lib/checklistEvento";

// Formatos reais de turma. Só "semanal" pede o número de sessões; os demais
// já sabem quantas são (dias seguidos a partir da data de início).
type FormatoTurma = "1dia" | "2dias" | "3dias" | "semanal" | "quinzenal" | "personalizado";
const FORMATOS: { value: FormatoTurma; label: string }[] = [
  { value: "1dia", label: "1 dia" },
  { value: "2dias", label: "2 dias seguidos" },
  { value: "3dias", label: "3 dias seguidos" },
  { value: "semanal", label: "1x por semana" },
  { value: "quinzenal", label: "Quinzenal (a cada 2 semanas)" },
  { value: "personalizado", label: "Personalizado (escolher as datas)" },
];

// Formatos com cadência fixa geram por intervalo em dias; os demais têm
// contagem fixa (dias seguidos) ou datas escolhidas na mão (personalizado).
function intervaloDias(formato: FormatoTurma): number | null {
  if (formato === "semanal") return 7;
  if (formato === "quinzenal") return 14;
  return null;
}
const PEDE_NUMERO_SESSOES = (f: FormatoTurma) => f === "semanal" || f === "quinzenal";

// Soma dias a uma data "YYYY-MM-DD" com matemática pura em UTC (imune a fuso).
function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Calcula APENAS as sessões novas a acrescentar (aditivo, nunca recria as que
// já existem). Para "1x semana", continua a cadência a partir da última sessão
// já cadastrada — assim datas ajustadas na mão (feriado) não são perdidas.
function novasSessoes(
  formato: FormatoTurma,
  dataInicio: string,
  nSessoes: number,
  encontros: any[],
  datasCustom: string[] = [],
): { sessao_numero: number; data: string }[] {
  const existentes = encontros.length;
  const datasExistentes = encontros
    .map((e) => e.data as string | null)
    .filter((d): d is string => !!d)
    .sort();

  // Personalizado: usa exatamente as datas escolhidas, ignorando as que já existem.
  if (formato === "personalizado") {
    const jaTem = new Set(datasExistentes);
    const limpas = Array.from(new Set(datasCustom.filter(Boolean)))
      .filter((d) => !jaTem.has(d))
      .sort();
    return limpas.map((data, idx) => ({ sessao_numero: existentes + idx + 1, data }));
  }

  if (!dataInicio) return [];
  const ultimaData = datasExistentes[datasExistentes.length - 1] || null;
  const intervalo = intervaloDias(formato); // 7, 14 ou null (dias seguidos)

  const total =
    intervalo ? Math.max(0, Math.floor(nSessoes || 0)) :
    formato === "3dias" ? 3 :
    formato === "2dias" ? 2 : 1;

  const novas: { sessao_numero: number; data: string }[] = [];
  for (let i = existentes; i < total; i++) {
    let data: string;
    if (intervalo) {
      // Continua a cadência a partir da última sessão já cadastrada (preserva
      // datas ajustadas na mão); se não houver, conta a partir do início.
      data = ultimaData
        ? addDaysISO(ultimaData, intervalo * (i - existentes + 1))
        : addDaysISO(dataInicio, intervalo * i);
    } else {
      data = addDaysISO(dataInicio, i); // dias seguidos
    }
    novas.push({ sessao_numero: i + 1, data });
  }
  return novas;
}

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

// Data da sessão editável no lugar — reagenda sem apagar as presenças já
// marcadas (diferente de excluir e recriar o encontro).
function EncontroDataEditavel({ data, onSave }: { data: string | null; onSave: (novaData: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(data || "");

  if (editando) {
    return (
      <input
        type="date"
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          setEditando(false);
          if (valor && valor !== data) onSave(valor);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setValor(data || ""); setEditando(false); }
        }}
        className="text-[10px] w-[86px] border rounded px-0.5"
      />
    );
  }

  return (
    <button
      className="text-[10px] text-muted-foreground hover:text-foreground hover:underline flex items-center gap-0.5"
      title="Clique para mudar a data (feriado, imprevisto...)"
      onClick={() => { setValor(data || ""); setEditando(true); }}
    >
      {data ? formatDate(data) : "sem data"}
      <Pencil className="h-2.5 w-2.5" />
    </button>
  );
}

export function TurmaPresencaTab({ turma }: Props) {
  const queryClient = useQueryClient();
  const [addEncontroOpen, setAddEncontroOpen] = useState(false);
  const [newEncontro, setNewEncontro] = useState({ data: "", descricao: "" });
  const [obsDialog, setObsDialog] = useState<{ presencaId: string; obs: string } | null>(null);
  const [gerarOpen, setGerarOpen] = useState(false);
  const [gerarForm, setGerarForm] = useState<{ formato: FormatoTurma; data: string; nSessoes: number; datasCustom: string[] }>({
    formato: "semanal",
    data: turma.data_inicio || "",
    nSessoes: 8,
    datasCustom: [""],
  });

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
        .eq("turma_id", turma.id)
        .is("deleted_at", null);

      if (error) throw error;

      const alunosMap = new Map<string, any>();

      (data || []).forEach((matricula: any) => {
        const aluno = matricula.alunos;
        if (aluno?.id && !alunosMap.has(aluno.id)) {
          alunosMap.set(aluno.id, aluno);
        }
      });

      return Array.from(alunosMap.values()).sort((a: any, b: any) =>
        String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR")
      );
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

  // Recalcula os prazos do checklist da turma após qualquer mudança de data
  // de sessão (nova, editada ou removida) — silencioso, sem travar a ação.
  const recalcularChecklistDaTurma = async () => {
    try {
      const r = await recalcularPrazosDaTurma(turma.id);
      queryClient.invalidateQueries({ queryKey: ["tarefas-turma", turma.id] });
      if (r.atualizadas || r.criadas) {
        toast.info(`Checklist: ${r.atualizadas} prazo(s) reajustado(s), ${r.criadas} tarefa(s) nova(s).`);
      }
    } catch { /* checklist é conveniência — não trava o controle de presença */ }
  };

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
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      toast.success("Encontro adicionado");
      setAddEncontroOpen(false);
      setNewEncontro({ data: "", descricao: "" });
      await recalcularChecklistDaTurma();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Gera as sessões automaticamente pelo formato da turma. Aditivo: só cria as
  // que faltam, atualiza data_fim (e data_inicio se estava vazia) e re-alimenta
  // o checklist para as sessões novas.
  const gerarSessoesMut = useMutation({
    mutationFn: async () => {
      const novas = novasSessoes(gerarForm.formato, gerarForm.data, gerarForm.nSessoes, encontros, gerarForm.datasCustom);
      if (novas.length === 0) throw new Error("Nenhuma sessão nova para gerar.");

      const rows = novas.map((n) => ({
        turma_id: turma.id,
        sessao_numero: n.sessao_numero,
        data: n.data,
      }));
      const { error } = await supabase.from("encontros").insert(rows);
      if (error) throw error;

      const todas = [
        ...encontros.map((e: any) => e.data).filter(Boolean),
        ...novas.map((n) => n.data),
      ].sort();
      const patch: any = { data_fim: todas[todas.length - 1] };
      if (!turma.data_inicio) patch.data_inicio = todas[0];
      await supabase.from("turmas").update(patch).eq("id", turma.id);

      return novas.length;
    },
    onSuccess: async (qtd: number) => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      queryClient.invalidateQueries({ queryKey: ["turmas"] });
      toast.success(`${qtd} sessão(ões) gerada(s)`);
      setGerarOpen(false);
      await recalcularChecklistDaTurma();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edita a data de um encontro já existente — preserva as presenças já
  // marcadas (diferente de excluir e recriar, que apagaria tudo).
  const updateEncontroDataMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: string }) => {
      const { error } = await supabase.from("encontros").update({ data }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      toast.success("Data do encontro atualizada");
      await recalcularChecklistDaTurma();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete encontro
  const deleteEncontroMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("encontros").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["encontros", turma.id] });
      queryClient.invalidateQueries({ queryKey: ["presencas", turma.id] });
      toast.success("Encontro removido");
      await recalcularChecklistDaTurma();
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

  const previewNovas = novasSessoes(gerarForm.formato, gerarForm.data, gerarForm.nSessoes, encontros, gerarForm.datasCustom);

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
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setGerarForm((p) => ({ ...p, data: turma.data_inicio || p.data })); setGerarOpen(true); }}>
              <CalendarPlus className="h-4 w-4 mr-1" />Gerar sessões
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddEncontroOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Novo Encontro
            </Button>
          </div>
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
                          <EncontroDataEditavel
                            data={e.data}
                            onSave={(novaData) => updateEncontroDataMut.mutate({ id: e.id, data: novaData })}
                          />
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

      {/* Gerar Sessões Dialog */}
      <Dialog open={gerarOpen} onOpenChange={setGerarOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar sessões automaticamente</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Formato da turma</Label>
              <Select value={gerarForm.formato} onValueChange={(v) => setGerarForm((p) => ({ ...p, formato: v as FormatoTurma }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {gerarForm.formato === "personalizado" ? (
              <div>
                <Label>Datas das sessões</Label>
                <div className="space-y-2 mt-1">
                  {gerarForm.datasCustom.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="date"
                        value={d}
                        onChange={(e) =>
                          setGerarForm((p) => {
                            const datasCustom = [...p.datasCustom];
                            datasCustom[i] = e.target.value;
                            return { ...p, datasCustom };
                          })
                        }
                      />
                      {gerarForm.datasCustom.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setGerarForm((p) => ({ ...p, datasCustom: p.datasCustom.filter((_, j) => j !== i) }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setGerarForm((p) => ({ ...p, datasCustom: [...p.datasCustom, ""] }))}
                  >
                    <Plus className="h-4 w-4 mr-1" />Adicionar data
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label>Data da 1ª sessão</Label>
                  <Input type="date" value={gerarForm.data} onChange={(e) => setGerarForm((p) => ({ ...p, data: e.target.value }))} />
                </div>
                {PEDE_NUMERO_SESSOES(gerarForm.formato) && (
                  <div>
                    <Label>Número de sessões</Label>
                    <Input type="number" min={1} value={gerarForm.nSessoes} onChange={(e) => setGerarForm((p) => ({ ...p, nSessoes: Number(e.target.value) }))} />
                  </div>
                )}
              </>
            )}

            {encontros.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Esta turma já tem {encontros.length} sessão(ões). Serão adicionadas apenas as que faltam.
              </p>
            )}

            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs font-medium mb-2">
                {previewNovas.length > 0
                  ? `${previewNovas.length} sessão(ões) nova(s):`
                  : "Nenhuma sessão nova a criar com esses valores."}
              </div>
              {previewNovas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {previewNovas.map((n) => (
                    <Badge key={n.sessao_numero} variant="outline" className="text-[11px]">
                      S{n.sessao_numero} · {formatDate(n.data)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => gerarSessoesMut.mutate()}
              disabled={gerarSessoesMut.isPending || previewNovas.length === 0}
            >
              {gerarSessoesMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar {previewNovas.length > 0 ? previewNovas.length : ""} sessão(ões)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
