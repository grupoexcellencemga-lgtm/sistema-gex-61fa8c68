import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { PageHeader } from "@/components/PageHeader";
import { MonthFilter, getBrazilNow } from "@/components/MonthFilter";
import { usePermissions } from "@/hooks/usePermissions";
import { DashboardAdmin } from "@/components/dashboard/DashboardAdmin";
import { DashboardComercial } from "@/components/dashboard/DashboardComercial";
import { DashboardFinanceiro } from "@/components/dashboard/DashboardFinanceiro";
import { DashboardProfissional } from "@/components/dashboard/DashboardProfissional";
import { DashboardSuporte } from "@/components/dashboard/DashboardSuporte";
import { Loader2 } from "lucide-react";

const roleDescriptions: Record<string, string> = {
  admin: "Visão geral da operação do Grupo Excellence",
  comercial: "Suas vendas, leads e comissões",
  financeiro: "Fluxo de caixa, receitas e despesas",
  profissional: "Seus processos, sessões e turmas",
  suporte: "Alunos, aniversários e eventos",
};

const Dashboard = () => {
  const brNow = getBrazilNow();
  const [mes, setMes] = useState(brNow.getMonth());
  const [ano, setAno] = useState(brNow.getFullYear());
  const { userRole, isReady } = usePermissions();
  const role = userRole || "admin";
  const description = roleDescriptions[role] || roleDescriptions.admin;

  if (!isReady) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <PageHeader title="Dashboard" description={description} />
          <MonthFilter mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader title="Dashboard" description={description} />
        <MonthFilter mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
      </div>
      {role === "comercial" && <DashboardComercial mes={mes} ano={ano} />}
      {role === "financeiro" && <DashboardFinanceiro mes={mes} ano={ano} />}
      {role === "profissional" && <DashboardProfissional mes={mes} ano={ano} />}
      {role === "suporte" && <DashboardSuporte mes={mes} ano={ano} />}
      {(role === "admin" || !["comercial", "financeiro", "profissional", "suporte"].includes(role)) && (
        <DashboardAdmin mes={mes} ano={ano} />
      )}
    </div>
  );
};

export default Dashboard;
