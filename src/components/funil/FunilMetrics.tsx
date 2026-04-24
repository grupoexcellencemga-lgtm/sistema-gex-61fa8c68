import { MetricCard } from "@/components/MetricCard";
import { Users, TrendingUp, Clock, UserX, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { LeadRow, ProdutoSelect } from "@/types";

interface Props {
  leads: LeadRow[];
  produtos: ProdutoSelect[];
}

import { calcularTaxaConversao, calcularTempoMedioConversao } from "./funilUtils";

export function FunilMetrics({ leads, produtos }: Props) {
  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const leadsMes = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalLeadsMes = leadsMes.length;

  const convertidos = leads.filter((l) => l.etapa === "matricula");
  const taxaConversao = calcularTaxaConversao(leads.length, convertidos.length);

  const temposConversao = convertidos
    .map((l) => {
      const created = new Date(l.created_at).getTime();
      const updated = new Date(l.updated_at).getTime();
      return Math.max(1, Math.round((updated - created) / (1000 * 60 * 60 * 24)));
    })
    .filter((d) => d > 0);
  const tempoMedio = calcularTempoMedioConversao(temposConversao);

  const perdidosMes = leadsMes.filter((l) => l.etapa === "perdido").length;

  const produtoMap = new Map(produtos.map((p) => [p.nome, Number(p.valor || 0)]));
  const valorPotencial = leads
    .filter((l) => l.etapa !== "perdido" && l.etapa !== "matricula" && l.produto_interesse)
    .reduce((sum, l) => sum + (produtoMap.get(l.produto_interesse!) || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <MetricCard title="Leads (mês)" value={String(totalLeadsMes)} icon={Users} variant="primary" />
      <MetricCard title="Conversão" value={`${taxaConversao}%`} icon={TrendingUp} variant="success" />
      <MetricCard title="Tempo Médio" value={tempoMedio > 0 ? `${tempoMedio}d` : "—"} icon={Clock} />
      <MetricCard title="Perdidos (mês)" value={String(perdidosMes)} icon={UserX} variant="destructive" />
      <MetricCard title="Pipeline" value={formatCurrency(valorPotencial)} icon={DollarSign} variant="warning" />
    </div>
  );
}
