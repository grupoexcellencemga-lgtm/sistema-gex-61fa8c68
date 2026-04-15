import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { MonthFilter, getBrazilNow } from "@/components/MonthFilter";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Receipt, Building2, GraduationCap, Award, UserCheck, Wallet, ClipboardList, CalendarDays } from "lucide-react";
import { TabEntradas } from "@/components/financeiro/TabEntradas";
import { TabDespesas } from "@/components/financeiro/TabDespesas";
import { TabComissoes } from "@/components/financeiro/TabComissoes";
import { TabFechamento } from "@/components/financeiro/TabFechamento";
import { TabTurmas } from "@/components/financeiro/TabTurmas";
import { TabProfissionais } from "@/components/financeiro/TabProfissionais";
import { TabEmpresarial } from "@/components/financeiro/TabEmpresarial";
import { TabContasPagarReceber } from "@/components/financeiro/TabContasPagarReceber";
import { TabReembolsos } from "@/components/financeiro/TabReembolsos";
import { TabEventos } from "@/components/financeiro/TabEventos";

const Financeiro = () => {
  const brNow = getBrazilNow();
  const [mes, setMes] = useState(brNow.getMonth());
  const [ano, setAno] = useState(brNow.getFullYear());

  useRealtimeSync("pagamentos", [["entradas"], ["dashboard-metrics"]]);
  useRealtimeSync("despesas", [["despesas"], ["dashboard-metrics"]]);
  useRealtimeSync("comissoes", [["comissoes"]]);
  useRealtimeSync("contas_a_pagar", [["contas_a_pagar"]]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader title="Financeiro" description="Controle financeiro completo do Grupo Excellence" />
        <MonthFilter mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
      </div>

      <Tabs defaultValue="painel" className="space-y-6">
        <div className="w-full overflow-x-auto visible-scrollbar pb-1">
        <TabsList className="inline-flex w-max">
          <TabsTrigger value="painel" className="gap-1.5 shrink-0"><ClipboardList className="h-4 w-4" /> Painel</TabsTrigger>
          <TabsTrigger value="entradas" className="gap-1.5 shrink-0"><DollarSign className="h-4 w-4" /> Entradas</TabsTrigger>
          <TabsTrigger value="despesas" className="gap-1.5 shrink-0"><Receipt className="h-4 w-4" /> Despesas</TabsTrigger>
          <TabsTrigger value="empresarial" className="gap-1.5 shrink-0"><Building2 className="h-4 w-4" /> Empresarial</TabsTrigger>
          <TabsTrigger value="turmas" className="gap-1.5 shrink-0"><GraduationCap className="h-4 w-4" /> Turmas</TabsTrigger>
          <TabsTrigger value="eventos" className="gap-1.5 shrink-0"><CalendarDays className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="comissoes" className="gap-1.5 shrink-0"><Award className="h-4 w-4" /> Comissões</TabsTrigger>
          <TabsTrigger value="profissionais" className="gap-1.5 shrink-0"><UserCheck className="h-4 w-4" /> Profissionais</TabsTrigger>
          <TabsTrigger value="reembolsos" className="gap-1.5 shrink-0"><Wallet className="h-4 w-4" /> Reembolsos</TabsTrigger>
          <TabsTrigger value="contas" className="gap-1.5 shrink-0"><Building2 className="h-4 w-4" /> Contas</TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="painel"><TabContasPagarReceber mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="entradas"><TabEntradas mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="despesas"><TabDespesas mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="empresarial"><TabEmpresarial mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="turmas"><TabTurmas mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="eventos"><TabEventos mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="comissoes"><TabComissoes mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="profissionais"><TabProfissionais mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="reembolsos"><TabReembolsos mes={mes} ano={ano} /></TabsContent>
        <TabsContent value="contas"><TabFechamento /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Financeiro;
