import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DollarSign,
  Loader2,
  Pencil,
  Trash2,
  UserCheck,
  X,
  Plus,
  History,
  Receipt,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";
import { useFormasPagamento, getFormaPagamentoLabel } from "@/hooks/useFormasPagamento";
import { useEmpresa } from "@/contexts/EmpresaContext";

export const TabProfissionais = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const [expandedProf, setExpandedProf] = useState<string | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [showPgForm, setShowPgForm] = useState<string | null>(null);
  const [editingPgProf, setEditingPgProf] = useState<any | null>(null);

  const [pgForm, setPgForm] = useState({
    valor: "",
    data: new Date().toISOString().split("T")[0],
    forma: "",
    conta_id: "",
    obs: "",
  });

  const { data: formasPagamento = [] } = useFormasPagamento();

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["profissionais-financeiro", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("*")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: processos = [] } = useQuery({
    queryKey: ["processos-financeiro-prof", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["pagamentos_processo_financeiro_prof"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagamentosProf = [] } = useQuery({
    queryKey: ["pagamentos_profissional"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_profissional")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias_prof", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const formatCurrencyInput = (v: string): string => {
    let digits = v.replace(/\D/g, "");
    if (!digits) return "";
    digits = digits.padStart(3, "0");
    const intPart = digits.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
    const decPart = digits.slice(-2);
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${formatted},${decPart}`;
  };

  const formatNumberToInput = (value: number): string => {
    return formatCurrencyInput(String(Math.round(Math.max(value, 0) * 100)));
  };

  const parseCurrencyToNumber = (v: string): number => {
    const clean = v.replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const getOrCreateCategoriaPagamentoProfissional = async () => {
    const { data: catExist, error: catError } = await supabase
      .from("categorias_despesas")
      .select("id")
      .eq("nome", "Pagamento Profissional")
      .is("deleted_at", null)
      .maybeSingle();

    if (catError) throw catError;

    if (catExist?.id) {
      return catExist.id;
    }

    const newCatId = crypto.randomUUID();

    const { error } = await supabase.from("categorias_despesas").insert({
      id: newCatId,
      nome: "Pagamento Profissional",
      tipo: "geral",
      ativo: true,
    });

    if (error) throw error;

    return newCatId;
  };

  const resetPaymentForm = () => {
    setPgForm({
      valor: "",
      data: new Date().toISOString().split("T")[0],
      forma: "",
      conta_id: "",
      obs: "",
    });
    setEditingPgProf(null);
    setShowPgForm(null);
  };

  const invalidateFinanceiro = () => {
    queryClient.invalidateQueries({ queryKey: ["pagamentos_profissional"] });
    queryClient.invalidateQueries({ queryKey: ["despesas"] });
    queryClient.invalidateQueries({ queryKey: ["despesas-financeiro"] });
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias_prof"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
  };

  const pagarProfMutation = useMutation({
    mutationFn: async ({
      profissional_id,
      processo_id,
      profNome,
      clienteNome,
    }: {
      profissional_id: string;
      processo_id: string;
      profNome: string;
      clienteNome: string;
    }) => {
      const valor = parseCurrencyToNumber(pgForm.valor);

      if (valor <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }

      if (!pgForm.data) {
        throw new Error("Informe a data do pagamento.");
      }

      const categoriaId = await getOrCreateCategoriaPagamentoProfissional();

      const despesaId = crypto.randomUUID();

      const { error: despError } = await supabase.from("despesas").insert({
        id: despesaId,
        descricao: `Pagamento profissional: ${profNome} — Cliente: ${clienteNome}`,
        valor,
        data: pgForm.data,
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        observacoes: pgForm.obs.trim() || null,
        recorrente: false,
        categoria_id: categoriaId,
        empresa_id: empresaId,
      });

      if (despError) throw despError;

      const { error: pgError } = await supabase.from("pagamentos_profissional").insert({
        profissional_id,
        processo_id,
        valor,
        data: pgForm.data,
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        observacoes: pgForm.obs.trim() || null,
        despesa_id: despesaId,
      } as any);

      if (pgError) throw pgError;
    },
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Pagamento ao profissional registrado!" });
      resetPaymentForm();
    },
    onError: (err: any) =>
      toast({
        title: "Erro ao registrar pagamento",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      }),
  });

  const editPgProfMutation = useMutation({
    mutationFn: async ({
      pg,
      profNome,
      clienteNome,
    }: {
      pg: any;
      profNome: string;
      clienteNome: string;
    }) => {
      const valor = parseCurrencyToNumber(pgForm.valor);

      if (valor <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }

      if (!pgForm.data) {
        throw new Error("Informe a data do pagamento.");
      }

      const payload = {
        valor,
        data: pgForm.data,
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        observacoes: pgForm.obs.trim() || null,
      };

      const { error } = await supabase
        .from("pagamentos_profissional")
        .update(payload)
        .eq("id", pg.id);

      if (error) throw error;

      if (pg.despesa_id) {
        const { error: despError } = await supabase
          .from("despesas")
          .update({
            descricao: `Pagamento profissional: ${profNome} — Cliente: ${clienteNome}`,
            ...payload,
          })
          .eq("id", pg.despesa_id);

        if (despError) throw despError;
      }
    },
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Pagamento atualizado!" });
      resetPaymentForm();
    },
    onError: (err: any) =>
      toast({
        title: "Erro ao atualizar pagamento",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      }),
  });

  const deletePgProfMutation = useMutation({
    mutationFn: async (pg: any) => {
      if (pg.despesa_id) {
        const { error: despError } = await supabase
          .from("despesas")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", pg.despesa_id);

        if (despError) throw despError;
      }

      const { error } = await supabase
        .from("pagamentos_profissional")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", pg.id);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinanceiro();
      toast({ title: "Pagamento removido." });
    },
    onError: () =>
      toast({
        title: "Erro ao remover pagamento",
        variant: "destructive",
      }),
  });

  const getProcessosPorProf = (profId: string, profNome: string) => {
    return processos.filter((p: any) => p.profissional_id === profId || p.responsavel === profNome);
  };

  const getPagamentosProcesso = (processoId: string, somenteMes = false) => {
    return pagamentosProcesso.filter((pg: any) => {
      if (pg.processo_id !== processoId) return false;
      if (!somenteMes) return true;
      return isInMonth(pg.data, mes, ano);
    });
  };

  const getPagamentosProfissional = (profId: string, processoId?: string, somenteMes = false) => {
    return pagamentosProf.filter((pg: any) => {
      if (pg.profissional_id !== profId) return false;
      if (processoId && pg.processo_id !== processoId) return false;
      if (!somenteMes) return true;
      return isInMonth(pg.data, mes, ano);
    });
  };

  const getProfTotals = (profId: string, profNome: string) => {
    const procs = getProcessosPorProf(profId, profNome);

    let totalRecebidoMes = 0;
    let totalRecebidoGeral = 0;
    let totalProfissionalMes = 0;
    let totalProfissionalGeral = 0;
    let totalEmpresaMes = 0;
    let totalEmpresaGeral = 0;

    procs.forEach((p: any) => {
      const pctProf = Number(p.percentual_profissional || 50);
      const pctEmpresa = Number(p.percentual_empresa || 50);

      const pgtsMes = getPagamentosProcesso(p.id, true);
      const pgtsGeral = getPagamentosProcesso(p.id, false);

      const recebidoMes = pgtsMes.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
      const recebidoGeral = pgtsGeral.reduce((s: number, pg: any) => s + Number(pg.valor), 0);

      totalRecebidoMes += recebidoMes;
      totalRecebidoGeral += recebidoGeral;
      totalProfissionalMes += (recebidoMes * pctProf) / 100;
      totalProfissionalGeral += (recebidoGeral * pctProf) / 100;
      totalEmpresaMes += (recebidoMes * pctEmpresa) / 100;
      totalEmpresaGeral += (recebidoGeral * pctEmpresa) / 100;
    });

    const totalPagoMes = getPagamentosProfissional(profId, undefined, true).reduce(
      (s: number, pg: any) => s + Number(pg.valor),
      0
    );

    const totalPagoGeral = getPagamentosProfissional(profId, undefined, false).reduce(
      (s: number, pg: any) => s + Number(pg.valor),
      0
    );

    return {
      totalRecebidoMes,
      totalRecebidoGeral,
      totalProfissionalMes,
      totalProfissionalGeral,
      totalEmpresaMes,
      totalEmpresaGeral,
      totalPagoMes,
      totalPagoGeral,
      saldoDevedorGeral: totalProfissionalGeral - totalPagoGeral,
    };
  };

  const getClienteData = (processoId: string, profId: string) => {
    const processo = processos.find((p: any) => p.id === processoId);
    if (!processo) return null;

    const pctProf = Number(processo.percentual_profissional || 50);
    const pctEmpresa = Number(processo.percentual_empresa || 50);

    const pgtsMes = getPagamentosProcesso(processoId, true);
    const pgtsGeral = getPagamentosProcesso(processoId, false);

    const recebidoMes = pgtsMes.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
    const recebidoTotal = pgtsGeral.reduce((s: number, pg: any) => s + Number(pg.valor), 0);

    const parteProfMes = (recebidoMes * pctProf) / 100;
    const parteProfTotal = (recebidoTotal * pctProf) / 100;
    const parteEmpresaTotal = (recebidoTotal * pctEmpresa) / 100;

    const pgsProfClienteMes = getPagamentosProfissional(profId, processoId, true);
    const pgsProfCliente = getPagamentosProfissional(profId, processoId, false);

    const totalPagoProfMes = pgsProfClienteMes.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
    const totalPagoProf = pgsProfCliente.reduce((s: number, pg: any) => s + Number(pg.valor), 0);

    return {
      processo,
      pgtsMes,
      pgtsGeral,
      recebidoMes,
      recebidoTotal,
      parteProfMes,
      parteProfTotal,
      parteEmpresaTotal,
      pgsProfClienteMes,
      pgsProfCliente,
      totalPagoProfMes,
      totalPagoProf,
      saldoDevedor: parteProfTotal - totalPagoProf,
    };
  };

  const openNewPagamento = (proc: any, profId: string, saldoDevedor: number) => {
    setEditingPgProf(null);
    setPgForm({
      valor: saldoDevedor > 0 ? formatNumberToInput(saldoDevedor) : "",
      data: new Date().toISOString().split("T")[0],
      forma: "",
      conta_id: "",
      obs: "",
    });
    setExpandedCliente(proc.id);
    setShowPgForm(proc.id);
  };

  const openEditPagamento = (pg: any, procId: string) => {
    setEditingPgProf(pg);
    setPgForm({
      valor: formatNumberToInput(Number(pg.valor || 0)),
      data: pg.data || new Date().toISOString().split("T")[0],
      forma: pg.forma_pagamento || "",
      conta_id: pg.conta_bancaria_id || "",
      obs: pg.observacoes || "",
    });
    setShowPgForm(procId);
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profissionais.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum profissional cadastrado. Acesse a aba Profissionais no menu para cadastrar.
          </CardContent>
        </Card>
      ) : (
        profissionais.map((prof: any) => {
          const isExpanded = expandedProf === prof.id;
          const procs = getProcessosPorProf(prof.id, prof.nome);
          const totals = isExpanded ? getProfTotals(prof.id, prof.nome) : null;

          return (
            <Card key={prof.id} className="overflow-hidden">
              <button
                onClick={() => {
                  setExpandedProf(isExpanded ? null : prof.id);
                  setExpandedCliente(null);
                  setShowPgForm(null);
                  setEditingPgProf(null);
                }}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{prof.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {prof.especialidade || "Profissional"} · {procs.length} processo{procs.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && totals && (
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Recebido no mês</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(totals.totalRecebidoMes)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Total: {formatCurrency(totals.totalRecebidoGeral)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Parte Empresa no mês</p>
                      <p className="font-bold text-sm text-primary">{formatCurrency(totals.totalEmpresaMes)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Total: {formatCurrency(totals.totalEmpresaGeral)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Parte Prof. no mês</p>
                      <p className="font-bold text-sm text-orange-600">{formatCurrency(totals.totalProfissionalMes)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Total: {formatCurrency(totals.totalProfissionalGeral)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Pago ao Prof. no mês</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(totals.totalPagoMes)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Total: {formatCurrency(totals.totalPagoGeral)}
                      </p>
                    </div>

                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Saldo a pagar</p>
                      <p className={`font-bold text-sm ${totals.saldoDevedorGeral > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatCurrency(totals.saldoDevedorGeral)}
                      </p>
                    </div>
                  </div>

                  {procs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum processo vinculado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Processos / clientes
                      </p>

                      {procs.map((proc: any) => {
                        const isClienteExpanded = expandedCliente === proc.id;
                        const clienteData = getClienteData(proc.id, prof.id);

                        if (!clienteData) return null;

                        return (
                          <Card key={proc.id} className="border">
                            <button
                              onClick={() => {
                                setExpandedCliente(isClienteExpanded ? null : proc.id);
                                setShowPgForm(null);
                                setEditingPgProf(null);
                              }}
                              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">
                                    {proc.cliente_nome?.charAt(0)?.toUpperCase() || "?"}
                                  </span>
                                </div>

                                <div>
                                  <p className="font-medium text-sm">{proc.cliente_nome || "Cliente"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Processo: {formatCurrency(Number(proc.valor_total || 0))} · Recebido total: {formatCurrency(clienteData.recebidoTotal)} · Pago prof.: {formatCurrency(clienteData.totalPagoProf)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge variant={clienteData.saldoDevedor > 0 ? "destructive" : "default"}>
                                  {clienteData.saldoDevedor > 0 ? `Falta ${formatCurrency(clienteData.saldoDevedor)}` : "Pago"}
                                </Badge>

                                <Badge variant={proc.status === "aberto" ? "default" : proc.status === "finalizado" ? "secondary" : "destructive"}>
                                  {proc.status === "aberto"
                                    ? "Aberto"
                                    : proc.status === "finalizado"
                                      ? "Finalizado"
                                      : proc.status === "cancelado"
                                        ? "Cancelado"
                                        : proc.status}
                                </Badge>

                                <span className="text-xs text-muted-foreground">{isClienteExpanded ? "▲" : "▼"}</span>
                              </div>
                            </button>

                            {isClienteExpanded && (
                              <CardContent className="pt-0 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Recebido no mês</p>
                                    <p className="font-bold text-sm text-emerald-600">{formatCurrency(clienteData.recebidoMes)}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      Total: {formatCurrency(clienteData.recebidoTotal)}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">
                                      Parte Prof. ({clienteData.processo.percentual_profissional || 50}%)
                                    </p>
                                    <p className="font-bold text-sm text-orange-600">{formatCurrency(clienteData.parteProfTotal)}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      No mês: {formatCurrency(clienteData.parteProfMes)}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Parte Empresa</p>
                                    <p className="font-bold text-sm text-primary">{formatCurrency(clienteData.parteEmpresaTotal)}</p>
                                  </div>

                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Já pago ao Prof.</p>
                                    <p className="font-bold text-sm text-emerald-600">{formatCurrency(clienteData.totalPagoProf)}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      No mês: {formatCurrency(clienteData.totalPagoProfMes)}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Saldo a pagar</p>
                                    <p className={`font-bold text-sm ${clienteData.saldoDevedor > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                      {formatCurrency(clienteData.saldoDevedor)}
                                    </p>
                                  </div>
                                </div>

                                <div>
                                  {showPgForm === proc.id ? (
                                    <Card className="border-primary">
                                      <CardHeader className="pb-2">
                                        <div className="flex items-center justify-between">
                                          <CardTitle className="text-sm">
                                            {editingPgProf ? "Editar pagamento ao profissional" : "Registrar pagamento ao profissional"}
                                          </CardTitle>

                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={resetPaymentForm}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </CardHeader>

                                      <CardContent className="space-y-3">
                                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                          <div className="space-y-1">
                                            <Label className="text-xs">Valor (R$)</Label>
                                            <Input
                                              value={pgForm.valor}
                                              onChange={(e) =>
                                                setPgForm((f) => ({
                                                  ...f,
                                                  valor: formatCurrencyInput(e.target.value),
                                                }))
                                              }
                                              placeholder="0,00"
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <Label className="text-xs">Data</Label>
                                            <Input
                                              type="date"
                                              value={pgForm.data}
                                              onChange={(e) =>
                                                setPgForm((f) => ({
                                                  ...f,
                                                  data: e.target.value,
                                                }))
                                              }
                                            />
                                          </div>

                                          <div className="space-y-1">
                                            <Label className="text-xs">Forma</Label>
                                            <Select
                                              value={pgForm.forma}
                                              onValueChange={(v) =>
                                                setPgForm((f) => ({
                                                  ...f,
                                                  forma: v,
                                                }))
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {formasPagamento.length === 0 ? (
                                                  <SelectItem value="nenhuma_forma_pagamento" disabled>
                                                    Nenhuma forma cadastrada
                                                  </SelectItem>
                                                ) : (
                                                  formasPagamento.map((forma) => (
                                                    <SelectItem key={forma.id} value={forma.codigo}>
                                                      {forma.nome}
                                                    </SelectItem>
                                                  ))
                                                )}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-1">
                                            <Label className="text-xs">Conta</Label>
                                            <Select
                                              value={pgForm.conta_id}
                                              onValueChange={(v) =>
                                                setPgForm((f) => ({
                                                  ...f,
                                                  conta_id: v,
                                                }))
                                              }
                                            >
                                              <SelectTrigger>
                                                <SelectValue placeholder="Selecione" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {contas.map((c: any) => (
                                                  <SelectItem key={c.id} value={c.id}>
                                                    {c.nome}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="flex items-end">
                                            <Button
                                              size="sm"
                                              className="w-full"
                                              onClick={() => {
                                                if (editingPgProf) {
                                                  editPgProfMutation.mutate({
                                                    pg: editingPgProf,
                                                    profNome: prof.nome,
                                                    clienteNome: proc.cliente_nome,
                                                  });
                                                } else {
                                                  pagarProfMutation.mutate({
                                                    profissional_id: prof.id,
                                                    processo_id: proc.id,
                                                    profNome: prof.nome,
                                                    clienteNome: proc.cliente_nome,
                                                  });
                                                }
                                              }}
                                              disabled={pagarProfMutation.isPending || editPgProfMutation.isPending}
                                            >
                                              {pagarProfMutation.isPending || editPgProfMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                              ) : (
                                                <DollarSign className="h-4 w-4 mr-1" />
                                              )}
                                              {editingPgProf ? "Salvar" : "Pagar"}
                                            </Button>
                                          </div>
                                        </div>

                                        <div className="space-y-1">
                                          <Label className="text-xs">Observação</Label>
                                          <Input
                                            value={pgForm.obs}
                                            onChange={(e) =>
                                              setPgForm((f) => ({
                                                ...f,
                                                obs: e.target.value,
                                              }))
                                            }
                                            placeholder="Ex: parte 1, adiantamento, acerto final..."
                                          />
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openNewPagamento(proc, prof.id, clienteData.saldoDevedor)}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Registrar pagamento
                                    </Button>
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    <p className="text-xs font-medium text-muted-foreground">
                                      Histórico de pagamentos ao profissional
                                    </p>
                                  </div>

                                  {clienteData.pgsProfCliente.length === 0 ? (
                                    <div className="rounded-lg border p-4 text-sm text-muted-foreground text-center">
                                      Nenhum pagamento registrado para esse profissional neste processo.
                                    </div>
                                  ) : (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Forma</TableHead>
                                          <TableHead>Conta</TableHead>
                                          <TableHead>Observação</TableHead>
                                          <TableHead className="text-right">Valor</TableHead>
                                          <TableHead className="w-20" />
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {clienteData.pgsProfCliente.map((pg: any) => (
                                          <TableRow key={pg.id}>
                                            <TableCell className="text-sm">{formatDate(pg.data)}</TableCell>
                                            <TableCell className="text-sm">{getFormaPagamentoLabel(pg.forma_pagamento, formasPagamento)}</TableCell>
                                            <TableCell className="text-sm">{pg.contas_bancarias?.nome || "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{pg.observacoes || "—"}</TableCell>
                                            <TableCell className="text-sm text-right font-semibold text-destructive">
                                              {formatCurrency(Number(pg.valor))}
                                            </TableCell>
                                            <TableCell>
                                              <div className="flex gap-1">
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7"
                                                  onClick={() => openEditPagamento(pg, proc.id)}
                                                >
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>

                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-7 w-7 text-destructive"
                                                  onClick={() => {
                                                    if (confirm("Remover este pagamento e a despesa vinculada?")) {
                                                      deletePgProfMutation.mutate(pg);
                                                    }
                                                  }}
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  )}
                                </div>

                                {clienteData.pgtsGeral.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Receipt className="h-4 w-4 text-muted-foreground" />
                                      <p className="text-xs font-medium text-muted-foreground">
                                        Lançamentos recebidos do cliente
                                      </p>
                                    </div>

                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Tipo</TableHead>
                                          <TableHead>Forma</TableHead>
                                          <TableHead>Banco</TableHead>
                                          <TableHead className="text-right">Valor</TableHead>
                                          <TableHead className="text-right">Parte Prof.</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {clienteData.pgtsGeral.map((pg: any) => {
                                          const pctProf = Number(clienteData.processo.percentual_profissional || 50);

                                          return (
                                            <TableRow key={pg.id}>
                                              <TableCell className="text-sm">{formatDate(pg.data)}</TableCell>
                                              <TableCell className="text-sm">
                                                <Badge variant="outline">
                                                  {pg.tipo === "entrada" ? "Entrada" : "Pagamento"}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {getFormaPagamentoLabel(pg.forma_pagamento, formasPagamento)}
                                              </TableCell>
                                              <TableCell className="text-sm">
                                                {pg.contas_bancarias?.nome || "—"}
                                              </TableCell>
                                              <TableCell className="text-sm text-right">
                                                {formatCurrency(Number(pg.valor))}
                                              </TableCell>
                                              <TableCell className="text-sm text-right text-orange-600 font-medium">
                                                {formatCurrency((Number(pg.valor) * pctProf) / 100)}
                                              </TableCell>
                                            </TableRow>
                                          );
                                        })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};
