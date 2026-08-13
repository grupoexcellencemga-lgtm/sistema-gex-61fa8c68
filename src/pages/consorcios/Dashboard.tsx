import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Briefcase, BarChart3, ShoppingCart, DollarSign, Maximize2 } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────

function getLast6Months() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        .replace(".", "").toUpperCase(),
    };
  });
}

function monthKey(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ── chart card ───────────────────────────────────────────────────────────────

function ChartCard({
  title, description, data, footer, isCurrency = false,
}: {
  title: string;
  description?: string;
  data: { label: string; value: number }[];
  footer?: string;
  isCurrency?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <Maximize2 className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number) => [isCurrency ? fmtBRL(v) : v, title]}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="value" fill="#7C6AE8" radius={[3, 3, 0, 0]}>
              <LabelList
                dataKey="value"
                position="top"
                style={{ fontSize: 10, fill: "#7C6AE8", fontWeight: 600 }}
                formatter={(v: number) => (v === 0 ? "0" : isCurrency ? fmtBRL(v) : v)}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {footer && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm font-semibold">{footer}</p>
            <p className="text-xs text-muted-foreground">{title.toLowerCase().replace("por produção", "").trim()}s agrupados por mês</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  title, value, icon: Icon, variant,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  variant: "purple" | "gold";
}) {
  const bg = variant === "purple"
    ? "bg-gradient-to-br from-violet-500 to-purple-600"
    : "bg-gradient-to-br from-amber-400 to-yellow-500";

  return (
    <div className={`${bg} rounded-xl p-5 text-white relative overflow-hidden`}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium opacity-90">{title}</p>
        <button className="opacity-70 hover:opacity-100">
          <span className="text-lg leading-none">···</span>
        </button>
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
      <Icon className="absolute bottom-4 right-4 h-10 w-10 opacity-20" />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

const ConsorcioDashboard = () => {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const months = useMemo(() => getLast6Months(), []);

  const { data: leads = [] } = useQuery({
    queryKey: ["consorcios-dashboard-leads", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_leads")
        .select("id, etapa, valor_credito, created_at")
        .eq("empresa_id", empresaId!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!empresaId,
  });

  const leadIds = useMemo(() => leads.map((l: any) => l.id), [leads]);

  const { data: interacoes = [] } = useQuery({
    queryKey: ["consorcios-dashboard-interacoes", empresaId, leadIds.length],
    queryFn: async () => {
      if (!leadIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("consorcios_interacoes")
        .select("id, tipo, created_at, lead_id")
        .in("lead_id", leadIds);
      if (error) throw error;
      return data as any[];
    },
    enabled: leadIds.length > 0,
  });

  // ── metrics ──
  const negociosAtivos = leads.filter((l: any) => !["perdido", "contrato_fechado"].includes(l.etapa)).length;
  const emAprovacao    = leads.filter((l: any) => l.etapa === "proposta_enviada").reduce((s: number, l: any) => s + (l.valor_credito ?? 0), 0);
  const emConclusao    = leads.filter((l: any) => l.etapa === "reuniao_agendada").reduce((s: number, l: any) => s + (l.valor_credito ?? 0), 0);
  const totalVendido   = leads.filter((l: any) => l.etapa === "contrato_fechado").reduce((s: number, l: any) => s + (l.valor_credito ?? 0), 0);

  // ── chart data ──
  const byMonth = (filterFn: (l: any) => boolean) =>
    months.map(m => ({
      label: m.label,
      value: leads.filter((l: any) => filterFn(l) && monthKey(l.created_at) === m.key).length,
    }));

  const sumByMonth = (filterFn: (l: any) => boolean) =>
    months.map(m => ({
      label: m.label,
      value: leads
        .filter((l: any) => filterFn(l) && monthKey(l.created_at) === m.key)
        .reduce((s: number, l: any) => s + (l.valor_credito ?? 0), 0),
    }));

  const interacoesByMonth = (tipo: string) =>
    months.map(m => ({
      label: m.label,
      value: interacoes.filter((i: any) => i.tipo === tipo && monthKey(i.created_at) === m.key).length,
    }));

  const oportunidades = byMonth(() => true);
  const agendamentos  = byMonth((l) => l.etapa === "reuniao_agendada");
  const reunioes      = interacoesByMonth("reuniao");
  const propostas     = byMonth((l) => ["proposta_enviada", "contrato_fechado"].includes(l.etapa));
  const aprovacoes    = byMonth((l) => l.etapa === "contrato_fechado");
  const vendas        = sumByMonth((l) => l.etapa === "contrato_fechado");

  const totalReunioes    = reunioes.reduce((s, d) => s + d.value, 0);
  const totalPropostas   = propostas.reduce((s, d) => s + d.value, 0);
  const totalAprovacoes  = aprovacoes.reduce((s, d) => s + d.value, 0);
  const totalVendasChart = vendas.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Consórcio" description="Visão geral de negócios, interações e vendas" />

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Negócios Ativos"      value={String(negociosAtivos)}  icon={Briefcase}   variant="purple" />
        <MetricCard title="Em Aprovação"          value={fmtBRL(emAprovacao)}     icon={BarChart3}   variant="gold"   />
        <MetricCard title="Vendas Em Conclusão"   value={fmtBRL(emConclusao)}     icon={ShoppingCart} variant="purple" />
        <MetricCard title="Total Vendido"         value={fmtBRL(totalVendido)}    icon={DollarSign}  variant="gold"   />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Oportunidades por Mês"
          description="Novos leads cadastrados por mês"
          data={oportunidades}
          footer={`Total de ${leads.length} Oportunidades`}
        />
        <ChartCard
          title="Agendamentos por Mês"
          description="Leads com reunião agendada por mês"
          data={agendamentos}
          footer={`Total de ${agendamentos.reduce((s, d) => s + d.value, 0)} Agendamentos`}
        />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Reuniões por Mês"
          description="Interações do tipo reunião registradas"
          data={reunioes}
          footer={`Total de ${totalReunioes} Reuniões`}
        />
        <ChartCard
          title="Propostas por Mês"
          description="Leads com proposta enviada ou fechada"
          data={propostas}
          footer={`Total de ${totalPropostas} Propostas`}
        />
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Aprovações por Mês"
          description="Contratos fechados por mês"
          data={aprovacoes}
          footer={`Total de ${totalAprovacoes} Aprovações`}
        />
        <ChartCard
          title="Vendas por Mês"
          description="Soma de crédito dos contratos fechados"
          data={vendas}
          footer={`Total em vendas: ${fmtBRL(totalVendasChart)}`}
          isCurrency
        />
      </div>
    </div>
  );
};

export default ConsorcioDashboard;
