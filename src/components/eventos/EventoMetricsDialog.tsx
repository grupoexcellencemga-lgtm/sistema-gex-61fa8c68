import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Users, DollarSign, TrendingUp, UserCheck, Receipt, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Participante {
  id: string;
  nome: string;
  tipo_participante: string | null;
  status_pagamento: string;
  valor: number | null;
  forma_pagamento: string | null;
  convidado_por: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  participantes: Participante[];
  evento: any;
}

const TIPO_COLORS: Record<string, string> = {
  comunidade: "hsl(var(--primary))",
  convidado: "hsl(var(--warning, 45 93% 47%))",
  divulgacao: "hsl(270 60% 50%)",
  indefinido: "hsl(var(--muted-foreground))",
};

const PAGAMENTO_COLORS: Record<string, string> = {
  pago: "hsl(var(--success, 142 71% 45%))",
  pendente: "hsl(var(--warning, 45 93% 47%))",
  isento: "hsl(var(--muted-foreground))",
};

const FORMA_COLORS = [
  "hsl(var(--primary))",
  "hsl(270 60% 50%)",
  "hsl(var(--success, 142 71% 45%))",
  "hsl(var(--warning, 45 93% 47%))",
  "hsl(var(--destructive))",
  "hsl(200 70% 50%)",
];

const FORMA_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  transferencia: "Transferência",
  boleto: "Boleto",
};

import { formatCurrency } from "@/lib/formatters";

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function EventoMetricsDialog({ open, onOpenChange, participantes, evento }: Props) {
  const total = participantes.length;
  const isComunidade = evento?.comunidade;
  const isPago = evento?.pago;

  // Fetch despesas do evento
  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas_evento_metrics", evento?.id],
    enabled: !!evento?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("evento_id", evento.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const totalDespesas = despesas.reduce((sum: number, d: any) => sum + (d.valor || 0), 0);

  // Tipo participante
  const comunidade = participantes.filter(p => p.tipo_participante === "comunidade").length;
  const convidados = participantes.filter(p => p.tipo_participante === "convidado").length;
  const divulgacao = participantes.filter(p => p.tipo_participante === "divulgacao").length;
  const indefinido = total - comunidade - convidados - divulgacao;

  const tipoData = [
    { name: "Comunidade", value: comunidade, color: TIPO_COLORS.comunidade },
    { name: "Convidado(a)", value: convidados, color: TIPO_COLORS.convidado },
    { name: "Divulgação", value: divulgacao, color: TIPO_COLORS.divulgacao },
    ...(indefinido > 0 ? [{ name: "Indefinido", value: indefinido, color: TIPO_COLORS.indefinido }] : []),
  ].filter(d => d.value > 0);

  // Pagamento
  const pagos = participantes.filter(p => p.status_pagamento === "pago").length;
  const pendentes = participantes.filter(p => p.status_pagamento === "pendente").length;
  const isentos = participantes.filter(p => p.status_pagamento === "isento").length;

  const pagamentoData = [
    { name: "Pago", value: pagos, color: PAGAMENTO_COLORS.pago },
    { name: "Pendente", value: pendentes, color: PAGAMENTO_COLORS.pendente },
    ...(isentos > 0 ? [{ name: "Isento", value: isentos, color: PAGAMENTO_COLORS.isento }] : []),
  ].filter(d => d.value > 0);

  // Forma de pagamento (apenas pagos)
  const formaMap: Record<string, number> = {};
  participantes.filter(p => p.status_pagamento === "pago" && p.forma_pagamento).forEach(p => {
    const key = p.forma_pagamento!;
    formaMap[key] = (formaMap[key] || 0) + 1;
  });
  const formaData = Object.entries(formaMap).map(([key, value], i) => ({
    name: FORMA_LABELS[key] || key,
    value,
    color: FORMA_COLORS[i % FORMA_COLORS.length],
  }));

  // Valores
  const totalArrecadado = participantes
    .filter(p => p.status_pagamento === "pago")
    .reduce((sum, p) => sum + (p.valor || 0), 0);
  const totalPendente = participantes
    .filter(p => p.status_pagamento === "pendente")
    .reduce((sum, p) => sum + (p.valor || 0), 0);
  const totalGeral = totalArrecadado + totalPendente;

  // Convidados por pessoa
  const convidadoPorMap: Record<string, number> = {};
  participantes.filter(p => p.convidado_por).forEach(p => {
    const key = p.convidado_por!;
    convidadoPorMap[key] = (convidadoPorMap[key] || 0) + 1;
  });
  const topConvidadores = Object.entries(convidadoPorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Métricas — {evento?.nome}
          </DialogTitle>
          <DialogDescription>Visão geral de participantes e financeiro do evento</DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum participante cadastrado.</p>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricMini icon={Users} label="Total" value={total} />
              <MetricMini icon={UserCheck} label="Pagos" value={pagos} />
              <MetricMini icon={DollarSign} label="Arrecadado" value={formatCurrency(totalArrecadado)} />
              <MetricMini icon={DollarSign} label="Pendente" value={formatCurrency(totalPendente)} />
              <MetricMini icon={Receipt} label="Despesas" value={formatCurrency(totalDespesas)} variant="destructive" />
              <MetricMini icon={TrendingUp} label="Lucro" value={formatCurrency(totalArrecadado - totalDespesas)} variant={totalArrecadado - totalDespesas >= 0 ? "success" : "destructive"} />
            </div>

            {/* Charts row */}
            <div className={`grid gap-4 ${isComunidade ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
              {isComunidade && tipoData.length > 0 && (
                <ChartCard title="Tipo de Participante">
                  <MiniPie data={tipoData} />
                </ChartCard>
              )}

              {pagamentoData.length > 0 && (
                <ChartCard title="Status de Pagamento">
                  <MiniPie data={pagamentoData} />
                </ChartCard>
              )}
            </div>

            {formaData.length > 0 && (
              <ChartCard title="Forma de Pagamento (pagos)">
                <MiniPie data={formaData} />
              </ChartCard>
            )}

            {/* Financial summary */}
            {isPago && (
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground">Resumo Financeiro</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total esperado</span>
                    <p className="font-bold text-card-foreground">{formatCurrency(totalGeral)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recebido</span>
                    <p className="font-bold text-success">{formatCurrency(totalArrecadado)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">A receber</span>
                    <p className="font-bold text-warning">{formatCurrency(totalPendente)}</p>
                  </div>
                </div>
                {totalGeral > 0 && (
                  <div className="mt-2">
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min((totalArrecadado / totalGeral) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((totalArrecadado / totalGeral) * 100).toFixed(0)}% arrecadado
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Despesas do evento */}
            {despesas.length > 0 && (
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Despesas do Evento
                </h4>
                <div className="space-y-1">
                  {despesas.map((d: any) => (
                    <div key={d.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-card-foreground">{d.descricao}</span>
                      <span className="font-semibold text-destructive">{formatCurrency(d.valor)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 flex items-center justify-between text-sm font-bold">
                    <span className="text-card-foreground">Total Despesas</span>
                    <span className="text-destructive">{formatCurrency(totalDespesas)}</span>
                  </div>
                </div>
                {totalArrecadado > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Resultado (Arrecadado - Despesas)</span>
                      <span className={`font-bold ${totalArrecadado - totalDespesas >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(totalArrecadado - totalDespesas)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top convidadores */}
            {isComunidade && topConvidadores.length > 0 && (
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground">Top Convidadores</h4>
                <div className="space-y-1">
                  {topConvidadores.map(([nome, count], i) => (
                    <div key={nome} className="flex items-center justify-between text-sm py-1">
                      <span className="text-card-foreground">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>
                        {nome}
                      </span>
                      <span className="font-semibold text-primary">{count} convidado(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Occupancy */}
            {evento?.limite_participantes && (
              <div className="rounded-lg border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold text-card-foreground">Ocupação</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min((total / evento.limite_participantes) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-card-foreground whitespace-nowrap">
                    {total}/{evento.limite_participantes} ({((total / evento.limite_participantes) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricMini({ icon: Icon, label, value, variant }: { icon: any; label: string; value: string | number; variant?: "success" | "destructive" }) {
  const valueColor = variant === "success" ? "text-emerald-600" : variant === "destructive" ? "text-destructive" : "text-card-foreground";
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <Icon className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h4 className="text-sm font-semibold text-card-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
}

function MiniPie({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} participante(s)`, name]}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            formatter={(value) => <span className="text-xs text-card-foreground">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
