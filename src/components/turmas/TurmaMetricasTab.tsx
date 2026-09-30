import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  Users, CalendarDays, Percent, DollarSign, Receipt, TrendingUp,
  Loader2, Shuffle, Clock, CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { PermutaItem } from "@/lib/alunoFinanceiro";
import { agregarMetricasTurma } from "@/lib/turmaMetricas";

const FREQ_COLORS = {
  frequente: "hsl(142 71% 45%)",
  irregular: "hsl(45 93% 47%)",
  baixa: "hsl(0 72% 51%)",
};

export function TurmaMetricasTab({ turma }: { turma: any }) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  // ── Matrículas (com valor_final para cálculo correto) ──────────────────
  const { data: matriculas = [], isLoading: l1 } = useQuery({
    queryKey: ["turma-met-matriculas-v2", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, aluno_id, valor_final")
        .eq("turma_id", turma.id)
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: encontros = [], isLoading: l2 } = useQuery({
    queryKey: ["turma-met-encontros", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encontros")
        .select("id")
        .eq("turma_id", turma.id)
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: presencas = [], isLoading: l3 } = useQuery({
    queryKey: ["turma-met-presencas", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("presencas")
        .select("aluno_id, encontro_id, status")
        .eq("turma_id", turma.id);
      if (error) throw error;
      return data || [];
    },
  });

  const alunoIds = useMemo(
    () => [...new Set(matriculas.map((m: any) => m.aluno_id).filter(Boolean))],
    [matriculas]
  );

  const matriculaIds = useMemo(
    () => matriculas.map((m: any) => m.id).filter(Boolean),
    [matriculas]
  );

  // ── Pagamentos (TODOS os statuses — resumirMatriculaV2 filtra internamente) ──
  const { data: pagamentos = [], isLoading: l4 } = useQuery({
    queryKey: ["turma-met-pagamentos-v2", turma.id, matriculaIds.join(","), empresaId],
    enabled: matriculaIds.length > 0 && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("id, matricula_id, valor, valor_pago, forma_pagamento, taxa_absorvida_por, taxa_valor, gera_caixa, status, deleted_at")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .in("matricula_id", matriculaIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Permuta itens (só para pagamentos com forma_pagamento = "permuta") ──
  const permutaPagIds = useMemo(
    () => (pagamentos as any[]).filter((p) => p.forma_pagamento === "permuta").map((p) => p.id).filter(Boolean),
    [pagamentos]
  );

  const { data: permutaItens = [] } = useQuery<PermutaItem[]>({
    queryKey: ["turma-met-permuta-itens", turma.id, permutaPagIds.join(",")],
    enabled: permutaPagIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permuta_itens")
        .select("id, pagamento_id, valor, status, deleted_at")
        .in("pagamento_id", permutaPagIds as string[])
        .is("deleted_at", null);
      if (error) throw error;
      return (data || []) as PermutaItem[];
    },
  });

  const itensPorPagamento = useMemo(() => {
    const map: Record<string, PermutaItem[]> = {};
    permutaItens.forEach((item) => {
      const pid = item.pagamento_id ?? "";
      if (!map[pid]) map[pid] = [];
      map[pid].push(item);
    });
    return map;
  }, [permutaItens]);

  const { data: despesas = [], isLoading: l5 } = useQuery({
    queryKey: ["turma-met-despesas", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("id, descricao, valor, data")
        .eq("turma_id", turma.id)
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  // ── Cálculos ────────────────────────────────────────────────────────────
  const { operacional, financeiro } = useMemo(() => {
    const totalAlunos   = alunoIds.length;
    const totalEncontros = encontros.length;

    const freqDoAluno = (alunoId: string) => {
      if (totalEncontros === 0) return 0;
      const presentes = encontros.filter((e: any) => {
        const p = presencas.find((x: any) => x.aluno_id === alunoId && x.encontro_id === e.id);
        return p?.status === "presente" || p?.status === "justificado";
      }).length;
      return Math.round((presentes / totalEncontros) * 100);
    };

    let frequente = 0, irregular = 0, baixa = 0, somaFreq = 0;
    alunoIds.forEach((id) => {
      const f = freqDoAluno(id as string);
      somaFreq += f;
      if (f >= 75) frequente++;
      else if (f >= 50) irregular++;
      else baixa++;
    });
    const freqMedia = totalAlunos > 0 ? Math.round(somaFreq / totalAlunos) : 0;

    const freqData = [
      { name: "Frequente (≥75%)", value: frequente, color: FREQ_COLORS.frequente },
      { name: "Irregular (50-74%)", value: irregular, color: FREQ_COLORS.irregular },
      { name: "Baixa (<50%)",      value: baixa,      color: FREQ_COLORS.baixa },
    ].filter((d) => d.value > 0);

    const fin = agregarMetricasTurma({
      matriculas: matriculas as { id: string; valor_final?: number | string | null }[],
      pagamentos: pagamentos as any[],
      itensPorPagamento,
      despesas: despesas as { valor?: number | string | null }[],
    });

    return { operacional: { totalAlunos, totalEncontros, freqMedia, freqData }, financeiro: fin };
  }, [alunoIds, encontros, presencas, matriculas, pagamentos, itensPorPagamento, despesas]);

  if (l1 || l2 || l3 || l4 || l5) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { totalAlunos, totalEncontros, freqMedia, freqData } = operacional;
  const fin = financeiro;

  return (
    <div className="space-y-6">

      {/* ── Métricas da Turma (operacional) ──────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Métricas da Turma
        </p>
        <div className="grid grid-cols-3 gap-3">
          <MetricMini icon={Users}       label="Alunos"      value={totalAlunos} />
          <MetricMini icon={CalendarDays} label="Encontros"  value={totalEncontros} />
          <MetricMini icon={Percent}      label="Freq. média" value={`${freqMedia}%`} />
        </div>
      </div>

      {/* ── Financeiro ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Financeiro
        </p>

        {/* Linha 1: Contratado · Recebido · Permutas · Total Quitado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <MetricMini icon={DollarSign}    label="Contratado"    value={formatCurrency(fin.contratado)} />
          <MetricMini icon={DollarSign}    label="Recebido"      value={formatCurrency(fin.quitadoDinheiro)}   variant="success" />
          <MetricMini icon={Shuffle}       label="Permutas"      value={formatCurrency(fin.quitadoPermuta)}    variant="purple" />
          <MetricMini icon={CheckCircle2}  label="Total Quitado" value={formatCurrency(fin.totalQuitado)} />
        </div>

        {/* Linha 2: A Receber · Despesas · Líquido */}
        <div className="grid grid-cols-3 gap-3">
          <MetricMini icon={Clock}       label="A Receber"    value={formatCurrency(fin.saldoFinanceiro)}  variant="warning" />
          <MetricMini icon={Receipt}     label="Despesas"     value={formatCurrency(fin.totalDespesas)}    variant="destructive" />
          <MetricMini
            icon={TrendingUp}
            label="Líquido"
            value={formatCurrency(fin.liquidoCaixa)}
            variant={fin.liquidoCaixa >= 0 ? "success" : "destructive"}
          />
        </div>

        {/* Permuta acordada — indicador secundário */}
        {fin.permutaPendente > 0 && (
          <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800 px-3 py-2 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium text-purple-700 dark:text-purple-300">
                Permuta acordada (não entregue)
              </span>
              <span className="text-muted-foreground text-xs ml-2">
                não reduz saldo enquanto pendente
              </span>
            </div>
            <span className="font-semibold text-purple-700 dark:text-purple-300 shrink-0">
              {formatCurrency(fin.permutaPendente)}
            </span>
          </div>
        )}
      </div>

      {/* ── Gráfico de frequência ─────────────────────────────────────── */}
      {totalEncontros === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Cadastre encontros na aba{" "}
          <span className="font-medium">Controle de Presença</span> para ver a distribuição de frequência.
        </div>
      ) : freqData.length > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-2">Alunos por faixa de frequência</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={freqData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={({ percent }: any) => (percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : "")}
                >
                  {freqData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} aluno(s)`, name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* ── Resumo Financeiro ─────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold">Resumo Financeiro</h4>

        <div className="space-y-2 text-sm">
          <ResumoRow label="Contratado"             value={fin.contratado} />
          <ResumoRow label="Recebido em dinheiro"   value={fin.quitadoDinheiro}   color="text-emerald-600" />
          <ResumoRow label="Permutas entregues"     value={fin.quitadoPermuta}    color="text-purple-600" />
          {fin.quitadoNaoMonetario > 0 && (
            <ResumoRow
              label="Outros (probono / não monetário)"
              value={fin.quitadoNaoMonetario}
              color="text-muted-foreground"
            />
          )}
          <ResumoRow label="Total quitado" value={fin.totalQuitado} bold />

          <div className="border-t pt-2 space-y-2">
            <ResumoRow label="A receber"                  value={fin.saldoFinanceiro} color="text-orange-600" />
            {fin.permutaPendente > 0 && (
              <ResumoRow
                label="Permuta acordada (não entregue)"
                value={fin.permutaPendente}
                color="text-purple-500"
                small
              />
            )}
          </div>

          <div className="border-t pt-2 space-y-2">
            <ResumoRow label="Despesas"         value={fin.totalDespesas}  color="text-destructive" />
            <ResumoRow
              label="Líquido de caixa"
              value={fin.liquidoCaixa}
              color={fin.liquidoCaixa >= 0 ? "text-emerald-600" : "text-destructive"}
              bold
            />
          </div>
        </div>

        {/* Detalhamento das despesas */}
        {despesas.length > 0 && (
          <div className="border-t pt-3 space-y-1">
            <p className="text-xs text-muted-foreground font-medium mb-2">Detalhamento das despesas</p>
            {despesas.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground text-xs shrink-0">{formatDate(d.data)}</span>
                  <span className="truncate">{d.descricao || "—"}</span>
                </div>
                <span className="font-medium text-destructive shrink-0 ml-3">
                  {formatCurrency(Number(d.valor || 0))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponentes ────────────────────────────────────────────────────────

type MetricVariant = "success" | "destructive" | "purple" | "warning";

function MetricMini({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: any;
  label: string;
  value: string | number;
  variant?: MetricVariant;
}) {
  const color =
    variant === "success"     ? "text-emerald-600" :
    variant === "destructive" ? "text-destructive" :
    variant === "purple"      ? "text-purple-600"  :
    variant === "warning"     ? "text-orange-600"  :
    "text-card-foreground";

  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      <p className={`text-base font-bold leading-tight mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function ResumoRow({
  label,
  value,
  color = "text-card-foreground",
  bold = false,
  small = false,
}: {
  label: string;
  value: number;
  color?: string;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${small ? "text-xs" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${color}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
