import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Users, CalendarDays, Percent, DollarSign, Receipt, TrendingUp, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useEmpresa } from "@/contexts/EmpresaContext";

const getValorPago = (p: any) => {
  const pago = p.valor_pago !== null && p.valor_pago !== undefined ? Number(p.valor_pago) : 0;
  const original = p.valor !== null && p.valor !== undefined ? Number(p.valor) : 0;
  return pago > 0 ? pago : original;
};


const FREQ_COLORS = {
  frequente: "hsl(142 71% 45%)",
  irregular: "hsl(45 93% 47%)",
  baixa: "hsl(0 72% 51%)",
};

export function TurmaMetricasTab({ turma }: { turma: any }) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { data: matriculas = [], isLoading: l1 } = useQuery({
    queryKey: ["turma-met-matriculas", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, aluno_id, produto_id")
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
      const { data, error } = await supabase.from("encontros").select("id").eq("turma_id", turma.id).eq("empresa_id", empresaId!);
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

  const { data: pagamentos = [], isLoading: l4 } = useQuery({
    queryKey: ["turma-met-pagamentos", turma.id, matriculaIds.join(","), empresaId],
    enabled: matriculaIds.length > 0 && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("matricula_id, valor, valor_pago")
        .eq("empresa_id", empresaId!)
        .eq("status", "pago")
        .is("deleted_at", null)
        .in("matricula_id", matriculaIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });

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

  const m = useMemo(() => {
    const totalAlunos = alunoIds.length;
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

    const totalEntradas = pagamentos.reduce((s: number, p: any) => s + getValorPago(p), 0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    const liquido = totalEntradas - totalDespesas;

    const freqData = [
      { name: "Frequente (≥75%)", value: frequente, color: FREQ_COLORS.frequente },
      { name: "Irregular (50-74%)", value: irregular, color: FREQ_COLORS.irregular },
      { name: "Baixa (<50%)", value: baixa, color: FREQ_COLORS.baixa },
    ].filter((d) => d.value > 0);

    return { totalAlunos, totalEncontros, freqMedia, totalEntradas, totalDespesas, liquido, freqData };
  }, [alunoIds, encontros, presencas, pagamentos, despesas]);

  if (l1 || l2 || l3 || l4 || l5) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricMini icon={Users} label="Alunos" value={m.totalAlunos} />
        <MetricMini icon={CalendarDays} label="Encontros" value={m.totalEncontros} />
        <MetricMini icon={Percent} label="Freq. média" value={`${m.freqMedia}%`} />
        <MetricMini icon={DollarSign} label="Entradas" value={formatCurrency(m.totalEntradas)} variant="success" />
        <MetricMini icon={Receipt} label="Despesas" value={formatCurrency(m.totalDespesas)} variant="destructive" />
        <MetricMini
          icon={TrendingUp}
          label="Líquido"
          value={formatCurrency(m.liquido)}
          variant={m.liquido >= 0 ? "success" : "destructive"}
        />
      </div>

      {m.totalEncontros === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Cadastre encontros na aba <span className="font-medium">Controle de Presença</span> para ver a distribuição de frequência.
        </div>
      ) : m.freqData.length > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="text-sm font-semibold mb-2">Alunos por faixa de frequência</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={m.freqData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  labelLine={false}
                  label={({ percent }: any) => (percent >= 0.05 ? `${(percent * 100).toFixed(0)}%` : "")}
                >
                  {m.freqData.map((entry, i) => (
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

      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold">Resumo Financeiro</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Entradas</span>
            <p className="font-bold text-emerald-600">{formatCurrency(m.totalEntradas)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Despesas</span>
            <p className="font-bold text-destructive">{formatCurrency(m.totalDespesas)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Líquido</span>
            <p className={`font-bold ${m.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(m.liquido)}
            </p>
          </div>
        </div>
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

function MetricMini({
  icon: Icon,
  label,
  value,
  variant,
}: {
  icon: any;
  label: string;
  value: string | number;
  variant?: "success" | "destructive";
}) {
  const color =
    variant === "success" ? "text-emerald-600" : variant === "destructive" ? "text-destructive" : "text-card-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
