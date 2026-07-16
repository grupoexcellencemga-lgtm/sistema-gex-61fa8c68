import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isInMonth } from "@/components/MonthFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MetricCard } from "@/components/MetricCard";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { addDays, addWeeks, addMonths, differenceInDays } from "date-fns";
import {
  Plus,
  AlertTriangle,
  Clock,
  TrendingUp,
  TrendingDown,
  Pencil,
  Trash2,
  Check,
  Download,
  Filter,
  Wallet,
  Eye,
  CalendarDays,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

const statusBadgeClass: Record<string, string> = {
  pago:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
  parcial:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0",
  pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0",
  vencido:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0",
  cancelado: "",
};

type ContaItem = {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: number;
  valor_original?: number;
  valor_pago?: number;
  saldo_restante?: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  categoria: string;
  origem: string;
  forma_pagamento: string | null;
  conta_bancaria_id?: string | null;
  origem_tipo?: "manual" | "aluno" | "comissao" | "reembolso" | "profissional" | "processo_individual" | "processo_empresarial";
  original_id?: string;
  fornecedor?: string | null;
  observacoes?: string | null;
};

type HistoricoMovimento = {
  id: string;
  data: string | null;
  valor: number;
  forma_pagamento?: string | null;
  conta_bancaria_id?: string | null;
  observacoes?: string | null;
};

const getUrgencia = (dataVencimento: string | null, status: string) => {
  if (!dataVencimento || status === "pago") return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const venc = new Date(dataVencimento + "T12:00:00");
  const dias = differenceInDays(venc, hoje);

  if (dias < 0) {
    return {
      label: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`,
      variant: "destructive" as const,
      dias,
    };
  }

  if (dias === 0) return { label: "Vence hoje!", variant: "destructive" as const, dias };
  if (dias === 1) return { label: "Vence amanhã", variant: "destructive" as const, dias };
  if (dias <= 3) return { label: `Vence em ${dias} dias`, variant: "destructive" as const, dias };
  if (dias <= 7) return { label: `Vence em ${dias} dias`, variant: "secondary" as const, dias };
  if (dias <= 30) return { label: `Vence em ${dias} dias`, variant: "outline" as const, dias };

  return { label: `Vence em ${dias} dias`, variant: "outline" as const, dias };
};

export const TabContasPagarReceber = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();

  const hoje = new Date().toISOString().split("T")[0];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);

  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterOrigem, setFilterOrigem] = useState<string>("todos");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");

  const [showPagos, setShowPagos] = useState(false);
  const [page, setPage] = useState(1);

  const [metricDialog, setMetricDialog] = useState<{
    title: string;
    items: MetricDetailItem[];
  } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: "delete";
    item: any;
    descricao: string;
  } | null>(null);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingConta, setPayingConta] = useState<any>(null);

  const [payForm, setPayForm] = useState({
    valor: "",
    data_pagamento: "",
    forma_pagamento: "",
    parcelas: "1",
    conta_bancaria_id: "",
    observacoes: "",
    tipo_baixa: "total",
  });

  const { data: formasPagamento = [] } = useFormasPagamento();

  const { data: movimentacoesContas = [] } = useQuery({
    queryKey: ["movimentacoes_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_contas" as any)
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: contasManuais = [] } = useQuery({
    queryKey: ["contas_a_pagar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_a_pagar")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, alunos(nome), produtos(nome)")
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("*, comerciais(nome), alunos(nome), produtos(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: processosIndividuais = [] } = useQuery({
    queryKey: ["processos-ind-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("id, cliente_nome, valor_total, status, data_inicio, data_fim, profissional_id, responsavel, percentual_profissional, conta_bancaria_id")
        .is("deleted_at", null)
        .in("status", ["ativo", "aberto"]);

      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["pgtos-processo-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo")
        .select("*")
        .is("deleted_at", null);

      if (error) throw error;
      return data;
    },
  });

  const { data: profissionais = [] } = useQuery({
    queryKey: ["profissionais-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome")
        .is("deleted_at", null);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: pagamentosProfissional = [] } = useQuery({
    queryKey: ["pagamentos-profissional-contas"] ,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_profissional")
        .select("*, profissionais(nome), processos_individuais(cliente_nome)")
        .is("deleted_at", null);

      if (error) throw error;
      return data || [];
    },
  });

  const { data: reembolsos = [] } = useQuery({
    queryKey: ["reembolsos-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reembolsos")
        .select("*")
        .is("deleted_at", null)
        .order("data_despesa", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const { data: processosEmpresariais = [] } = useQuery({
    queryKey: ["processos-emp-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais")
        .select("id, empresa_nome, valor_total, status, data_inicio, data_fim, conta_bancaria_id")
        .is("deleted_at", null)
        .in("status", ["ativo", "aberto"]);

      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcessoEmp = [] } = useQuery({
    queryKey: ["pgtos-processo-emp-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial")
        .select("*")
        .is("deleted_at", null);

      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const { data: categoriasEmpresa = [] } = useQuery({
    queryKey: ["categorias_despesas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_despesas")
        .select("id, nome, tipo, ativo")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });


  const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

  const getOrigemId = (conta: any) =>
    conta?.original_id ||
    String(conta?.id || "")
      .replace("manual-", "")
      .replace("pgto-", "")
      .replace("com-", "")
      .replace("reemb-", "")
      .replace("prof-", "")
      .replace("proc-ind-", "")
      .replace("proc-emp-", "");

  const getMovimentosByOrigem = (origemTipo?: string | null, origemId?: string | null) => {
    if (!origemTipo || !origemId) return [];

    return movimentacoesContas
      .filter((m: any) => m.conta_origem_tipo === origemTipo && m.conta_origem_id === origemId)
      .sort((a: any, b: any) => String(a.data || "").localeCompare(String(b.data || "")));
  };

  const getTotalMovimentado = (origemTipo?: string | null, origemId?: string | null) => {
    return roundMoney(
      getMovimentosByOrigem(origemTipo, origemId).reduce(
        (acc: number, item: any) => acc + Number(item.valor || 0),
        0
      )
    );
  };

  const getHistoricoMovimentos = (conta?: ContaItem | null): HistoricoMovimento[] => {
    if (!conta) return [];

    const origemTipo = conta.origem_tipo || "manual";
    const origemId = getOrigemId(conta);

    return getMovimentosByOrigem(origemTipo, origemId).map((item: any) => ({
      id: item.id,
      data: item.data,
      valor: Number(item.valor || 0),
      forma_pagamento: item.forma_pagamento,
      conta_bancaria_id: item.conta_bancaria_id || null,
      observacoes: item.observacoes,
    }));
  };

  const getStatusCalculado = (valorOriginal: number, valorPago: number, dataVencimento?: string | null) => {
    const saldo = Math.max(roundMoney(valorOriginal - valorPago), 0);

    if (saldo <= 0.009) return "pago";
    if (valorPago > 0) return "parcial";
    if (dataVencimento && dataVencimento < hoje) return "vencido";

    return "pendente";
  };

  const softDeleteDespesaCompativel = async ({
    valor,
    data,
    forma_pagamento,
    conta_bancaria_id,
    descricaoContains,
  }: {
    valor: number;
    data: string | null;
    forma_pagamento?: string | null;
    conta_bancaria_id?: string | null;
    descricaoContains?: string | null;
  }) => {
    if (!data) return;

    let query = supabase
      .from("despesas")
      .select("id, descricao")
      .is("deleted_at", null)
      .eq("data", data)
      .eq("valor", valor);

    if (forma_pagamento) {
      query = query.eq("forma_pagamento", forma_pagamento);
    }

    if (conta_bancaria_id) {
      query = query.eq("conta_bancaria_id", conta_bancaria_id);
    }

    const { data: despesasEncontradas, error } = await query.order("created_at", { ascending: false }).limit(10);
    if (error) throw error;

    const despesa = (despesasEncontradas || []).find((d: any) =>
      descricaoContains ? String(d.descricao || "").toLowerCase().includes(descricaoContains.toLowerCase()) : true
    );

    if (!despesa?.id) return;

    const { error: deleteError } = await supabase
      .from("despesas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", despesa.id);

    if (deleteError) throw deleteError;
  };

  const softDeletePagamentoProcessoCompativel = async ({
    table,
    processo_id,
    valor,
    data,
    forma_pagamento,
    conta_bancaria_id,
  }: {
    table: "pagamentos_processo" | "pagamentos_processo_empresarial";
    processo_id: string;
    valor: number;
    data: string | null;
    forma_pagamento?: string | null;
    conta_bancaria_id?: string | null;
  }) => {
    if (!data) return;

    let query = supabase
      .from(table)
      .select("id")
      .is("deleted_at", null)
      .eq("processo_id", processo_id)
      .eq("data", data)
      .eq("valor", valor);

    if (forma_pagamento) {
      query = query.eq("forma_pagamento", forma_pagamento);
    }

    if (conta_bancaria_id) {
      query = query.eq("conta_bancaria_id", conta_bancaria_id);
    }

    const { data: registros, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (error) throw error;

    const registro = registros?.[0];
    if (!registro?.id) return;

    const { error: deleteError } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", registro.id);

    if (deleteError) throw deleteError;
  };

  const contasConsolidadas: ContaItem[] = useMemo(() => {
    const items: ContaItem[] = [];

    pagamentos.forEach((p: any) => {
      const valorOriginal = Number(p.valor || 0);
      const valorMovimentado = getTotalMovimentado("aluno", p.id);
      const valorPago = Math.min(valorOriginal, valorMovimentado > 0 ? valorMovimentado : Number(p.valor_pago || 0));
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const status = p.status === "pago" && saldoRestante <= 0.009
        ? "pago"
        : getStatusCalculado(valorOriginal, valorPago, p.data_vencimento);

      if (!showPagos && status === "pago") return;

      items.push({
        id: `pgto-${p.id}`,
        tipo: "receber",
        descricao: `${p.alunos?.nome || "Aluno"} — ${p.produtos?.nome || "Produto"}`,
        valor: status === "pago" ? valorOriginal : saldoRestante,
        valor_original: valorOriginal,
        valor_pago: valorPago,
        saldo_restante: status === "pago" ? 0 : saldoRestante,
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        status,
        categoria: "Mensalidade",
        origem: "Aluno",
        forma_pagamento: p.forma_pagamento,
        conta_bancaria_id: p.conta_bancaria_id || null,
        origem_tipo: "aluno",
        original_id: p.id,
      });
    });

    comissoes.forEach((c: any) => {
      const valorOriginal = Number(c.valor_comissao || c.valor_pago || 0);
      const valorMovimentado = getTotalMovimentado("comissao", c.id);
      const valorPago = Math.min(valorOriginal, valorMovimentado > 0 ? valorMovimentado : Number(c.valor_pago || 0));
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const dataVencimento = c.data_pagamento || (c.created_at ? c.created_at.substring(0, 10) : hoje);
      const status = c.status === "pago" && saldoRestante <= 0.009
        ? "pago"
        : getStatusCalculado(valorOriginal, valorPago, dataVencimento);

      if (!showPagos && status === "pago") return;

      items.push({
        id: `com-${c.id}`,
        tipo: "pagar",
        descricao: `Comissão: ${c.comerciais?.nome || "Vendedor"}${c.alunos?.nome ? ` — Aluno: ${c.alunos.nome}` : ""}${c.produtos?.nome ? ` — ${c.produtos.nome}` : ""}`,
        valor: status === "pago" ? valorOriginal : saldoRestante,
        valor_original: valorOriginal,
        valor_pago: valorPago,
        saldo_restante: status === "pago" ? 0 : saldoRestante,
        data_vencimento: dataVencimento,
        data_pagamento: c.data_pagamento,
        status,
        categoria: "Comissão",
        origem: "Comissão",
        forma_pagamento: c.forma_pagamento,
        conta_bancaria_id: c.conta_bancaria_id || null,
        origem_tipo: "comissao",
        original_id: c.id,
        observacoes: c.observacoes || null,
      });
    });

    contasManuais.forEach((m: any) => {
      const valorOriginal = Number(m.valor || 0);
      const valorMovimentado = getTotalMovimentado("manual", m.id);
      const valorPago = Math.min(valorOriginal, valorMovimentado > 0 ? valorMovimentado : m.status === "pago" ? valorOriginal : 0);
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const status = m.status === "pago" && saldoRestante <= 0.009
        ? "pago"
        : getStatusCalculado(valorOriginal, valorPago, m.data_vencimento);

      if (!showPagos && status === "pago") return;

      items.push({
        id: `manual-${m.id}`,
        tipo: "pagar",
        descricao: m.descricao,
        valor: status === "pago" ? valorOriginal : saldoRestante,
        valor_original: valorOriginal,
        valor_pago: valorPago,
        saldo_restante: status === "pago" ? 0 : saldoRestante,
        data_vencimento: m.data_vencimento,
        data_pagamento: m.data_pagamento,
        status,
        categoria: m.categoria || "Conta Manual",
        origem: "Manual",
        forma_pagamento: m.forma_pagamento,
        conta_bancaria_id: m.conta_bancaria_id || null,
        origem_tipo: "manual",
        original_id: m.id,
        fornecedor: m.fornecedor || null,
        observacoes: m.observacoes || null,
      });
    });

    reembolsos.forEach((r: any) => {
      const valorOriginal = Number(r.valor || 0);
      const valorMovimentado = getTotalMovimentado("reembolso", r.id);
      const valorPago = Math.min(valorOriginal, valorMovimentado > 0 ? valorMovimentado : r.status === "pago" ? valorOriginal : 0);
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const dataVencimento = r.data_reembolso || r.data_despesa || hoje;
      const status = r.status === "pago" && saldoRestante <= 0.009
        ? "pago"
        : getStatusCalculado(valorOriginal, valorPago, dataVencimento);

      if (!showPagos && status === "pago") return;

      items.push({
        id: `reemb-${r.id}`,
        tipo: "pagar",
        descricao: `Reembolso: ${r.descricao}${r.pessoa_nome ? ` — ${r.pessoa_nome}` : ""}`,
        valor: status === "pago" ? valorOriginal : saldoRestante,
        valor_original: valorOriginal,
        valor_pago: valorPago,
        saldo_restante: status === "pago" ? 0 : saldoRestante,
        data_vencimento: dataVencimento,
        data_pagamento: r.data_reembolso,
        status,
        categoria: "Reembolso",
        origem: "Reembolso",
        forma_pagamento: r.forma_pagamento,
        conta_bancaria_id: r.conta_bancaria_id || null,
        origem_tipo: "reembolso",
        original_id: r.id,
        fornecedor: r.pessoa_nome || null,
        observacoes: r.observacoes || null,
      });
    });

    const pagamentosProfPorProcesso: Record<string, number> = {};
    pagamentosProfissional.forEach((p: any) => {
      pagamentosProfPorProcesso[p.processo_id] =
        (pagamentosProfPorProcesso[p.processo_id] || 0) + Number(p.valor || 0);
    });

    processosIndividuais.forEach((proc: any) => {
      if (proc.status === "cancelado") return;

      const profissionalId = proc.profissional_id;
      const profissional = profissionais.find((p: any) => p.id === profissionalId);
      const profissionalNome = profissional?.nome || proc.responsavel || "Profissional";
      const percentualProf = Number(proc.percentual_profissional ?? 50);
      const totalRecebido = pagamentosProcesso
        .filter((p: any) => p.processo_id === proc.id)
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const valorOriginal = roundMoney((totalRecebido * percentualProf) / 100);
      const valorPago = roundMoney(pagamentosProfPorProcesso[proc.id] || 0);
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);

      if (saldoRestante > 0.009 || (showPagos && valorOriginal > 0)) {
        const vencimento = proc.data_fim || proc.data_inicio || hoje;
        const status = getStatusCalculado(valorOriginal, valorPago, vencimento);

        if (!showPagos && status === "pago") return;

        items.push({
          id: `prof-${proc.id}-${profissionalId || "sem-prof"}`,
          tipo: "pagar",
          descricao: `Pagamento profissional: ${profissionalNome} — Cliente: ${proc.cliente_nome}`,
          valor: status === "pago" ? valorOriginal : saldoRestante,
          valor_original: valorOriginal,
          valor_pago: valorPago,
          saldo_restante: status === "pago" ? 0 : saldoRestante,
          data_vencimento: vencimento,
          data_pagamento: null,
          status,
          categoria: "Pagamento Profissional",
          origem: "Profissional",
          forma_pagamento: null,
          conta_bancaria_id: null,
          origem_tipo: "profissional",
          original_id: proc.id,
          fornecedor: profissionalNome,
          observacoes: `Total recebido do cliente: ${formatCurrency(totalRecebido)}. Parte do profissional (${percentualProf}%): ${formatCurrency(valorOriginal)}. Já pago: ${formatCurrency(valorPago)}.`,
        });
      }
    });

    const pgtosProcMap: Record<string, number> = {};
    pagamentosProcesso.forEach((p: any) => {
      pgtosProcMap[p.processo_id] = (pgtosProcMap[p.processo_id] || 0) + Number(p.valor);
    });

    processosIndividuais.forEach((proc: any) => {
      const valorPago = roundMoney(pgtosProcMap[proc.id] || 0);
      const valorOriginal = Number(proc.valor_total || 0);
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const status = getStatusCalculado(valorOriginal, valorPago, proc.data_fim);

      if (!showPagos && status === "pago") return;

      if (saldoRestante > 0 || (showPagos && valorOriginal > 0)) {
        items.push({
          id: `proc-ind-${proc.id}`,
          tipo: "receber",
          descricao: `Processo — ${proc.cliente_nome}`,
          valor: status === "pago" ? valorOriginal : saldoRestante,
          valor_original: valorOriginal,
          valor_pago: valorPago,
          saldo_restante: status === "pago" ? 0 : saldoRestante,
          data_vencimento: proc.data_fim,
          data_pagamento: null,
          status,
          categoria: "Processo Individual",
          origem: "Proc. Individual",
          forma_pagamento: null,
          conta_bancaria_id: proc.conta_bancaria_id || null,
          origem_tipo: "processo_individual",
          original_id: proc.id,
        });
      }
    });

    const pgtosEmpMap: Record<string, number> = {};
    pagamentosProcessoEmp.forEach((p: any) => {
      pgtosEmpMap[p.processo_id] = (pgtosEmpMap[p.processo_id] || 0) + Number(p.valor);
    });

    processosEmpresariais.forEach((proc: any) => {
      const valorPago = roundMoney(pgtosEmpMap[proc.id] || 0);
      const valorOriginal = Number(proc.valor_total || 0);
      const saldoRestante = Math.max(roundMoney(valorOriginal - valorPago), 0);
      const status = getStatusCalculado(valorOriginal, valorPago, proc.data_fim);

      if (!showPagos && status === "pago") return;

      if (saldoRestante > 0 || (showPagos && valorOriginal > 0)) {
        items.push({
          id: `proc-emp-${proc.id}`,
          tipo: "receber",
          descricao: `Empresarial — ${proc.empresa_nome}`,
          valor: status === "pago" ? valorOriginal : saldoRestante,
          valor_original: valorOriginal,
          valor_pago: valorPago,
          saldo_restante: status === "pago" ? 0 : saldoRestante,
          data_vencimento: proc.data_fim,
          data_pagamento: null,
          status,
          categoria: "Processo Empresarial",
          origem: "Proc. Empresarial",
          forma_pagamento: null,
          conta_bancaria_id: proc.conta_bancaria_id || null,
          origem_tipo: "processo_empresarial",
          original_id: proc.id,
        });
      }
    });

    const monthEnd = new Date(ano, mes + 1, 0).toISOString().split("T")[0];

    const monthFiltered = items.filter((item) => {
      const dateToCheck = item.status === "pago" ? item.data_pagamento : item.data_vencimento;

      if (!dateToCheck) return true;

      if (item.status === "pago") {
        return isInMonth(dateToCheck, mes, ano);
      }

      return dateToCheck <= monthEnd;
    });

    return monthFiltered.sort((a, b) => {
      if (a.status === "vencido" && b.status !== "vencido") return -1;
      if (b.status === "vencido" && a.status !== "vencido") return 1;

      const da = a.data_vencimento || "9999";
      const db = b.data_vencimento || "9999";

      return da.localeCompare(db);
    });
  }, [
    pagamentos,
    comissoes,
    contasManuais,
    processosIndividuais,
    pagamentosProcesso,
    processosEmpresariais,
    pagamentosProcessoEmp,
    profissionais,
    pagamentosProfissional,
    movimentacoesContas,
    reembolsos,
    hoje,
    showPagos,
    mes,
    ano,
  ]);

  const pendentes = contasConsolidadas.filter((c) => c.status !== "pago");
  const totalAPagar = pendentes
    .filter((c) => c.tipo === "pagar")
    .reduce((s, c) => s + c.valor, 0);
  const totalAReceber = pendentes
    .filter((c) => c.tipo === "receber")
    .reduce((s, c) => s + c.valor, 0);
  const totalVencido = pendentes
    .filter((c) => c.status === "vencido")
    .reduce((s, c) => s + c.valor, 0);
  const saldoProjetado = totalAReceber - totalAPagar;

  const venceEstaSemana = useMemo(() => {
    const hojeDate = new Date();
    hojeDate.setHours(0, 0, 0, 0);

    return pendentes
      .filter((c) => {
        if (!c.data_vencimento || c.status === "vencido") return false;

        const venc = new Date(c.data_vencimento + "T12:00:00");
        const dias = differenceInDays(venc, hojeDate);

        return dias >= 0 && dias <= 7;
      })
      .reduce((s, c) => s + c.valor, 0);
  }, [pendentes]);

  const origensDisponiveis = useMemo(() => {
    const set = new Set(contasConsolidadas.map((c) => c.origem));
    return Array.from(set).sort();
  }, [contasConsolidadas]);

  const filtered = useMemo(() => {
    let items = contasConsolidadas;

    if (filterTipo !== "todos") items = items.filter((c) => c.tipo === filterTipo);
    if (filterStatus !== "todos") items = items.filter((c) => c.status === filterStatus);
    if (filterOrigem !== "todos") items = items.filter((c) => c.origem === filterOrigem);

    if (filterDataInicio) {
      items = items.filter((c) => (c.data_vencimento || "").slice(0, 10) >= filterDataInicio);
    }

    if (filterDataFim) {
      items = items.filter((c) => (c.data_vencimento || "").slice(0, 10) <= filterDataFim);
    }

    if (filterSearch) {
      const s = filterSearch.toLowerCase();

      items = items.filter(
        (c) =>
          c.descricao.toLowerCase().includes(s) ||
          c.categoria.toLowerCase().includes(s) ||
          c.origem.toLowerCase().includes(s)
      );
    }


    return items;
  }, [contasConsolidadas, filterTipo, filterStatus, filterOrigem, filterDataInicio, filterDataFim, filterSearch]);

  const paged = paginate(filtered, page, 15);

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (Array.isArray(formData)) {
        const { error } = await supabase.from("contas_a_pagar").insert(formData);
        if (error) throw error;
        return;
      }

      const origemTipo = formData.origem_tipo || "manual";
      const originalId = formData.original_id || String(formData.id || "").replace("manual-", "");

      if (origemTipo && origemTipo !== "manual") {
        const valor = parseFloat(formData.valor) || 0;

        if (valor <= 0) {
          throw new Error("Informe um valor maior que zero.");
        }

        if (origemTipo === "aluno") {
          const { error } = await supabase
            .from("pagamentos")
            .update({
              valor,
              data_vencimento: formData.data_vencimento || null,
              forma_pagamento: formData.forma_pagamento || null,
              conta_bancaria_id: formData.conta_bancaria_id || null,
            })
            .eq("id", originalId);

          if (error) throw error;
          return;
        }

        if (origemTipo === "comissao") {
          const { error } = await supabase
            .from("comissoes")
            .update({
              valor_comissao: valor,
              data_pagamento: formData.data_vencimento || null,
              forma_pagamento: formData.forma_pagamento || null,
              conta_bancaria_id: formData.conta_bancaria_id || null,
              observacoes: formData.observacoes || null,
            } as any)
            .eq("id", originalId);

          if (error) throw error;
          return;
        }

        if (origemTipo === "reembolso") {
          const { error } = await supabase
            .from("reembolsos")
            .update({
              descricao: formData.descricao || null,
              valor,
              data_despesa: formData.data_vencimento || null,
              pessoa_nome: formData.fornecedor || null,
              forma_pagamento: formData.forma_pagamento || null,
              conta_bancaria_id: formData.conta_bancaria_id || null,
              observacoes: formData.observacoes || null,
            } as any)
            .eq("id", originalId);

          if (error) throw error;
          return;
        }

        if (origemTipo === "processo_individual") {
          const totalPago = pagamentosProcesso
            .filter((p: any) => p.processo_id === originalId)
            .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

          const { error } = await supabase
            .from("processos_individuais")
            .update({
              valor_total: totalPago + valor,
              data_fim: formData.data_vencimento || null,
            } as any)
            .eq("id", originalId);

          if (error) throw error;
          return;
        }

        if (origemTipo === "processo_empresarial") {
          const totalPago = pagamentosProcessoEmp
            .filter((p: any) => p.processo_id === originalId)
            .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

          const { error } = await supabase
            .from("processos_empresariais")
            .update({
              valor_total: totalPago + valor,
              data_fim: formData.data_vencimento || null,
            } as any)
            .eq("id", originalId);

          if (error) throw error;
          return;
        }

        if (origemTipo === "profissional") {
          const processo = processosIndividuais.find((p: any) => p.id === originalId);
          if (!processo) throw new Error("Processo do profissional não encontrado.");

          const totalRecebido = pagamentosProcesso
            .filter((p: any) => p.processo_id === originalId)
            .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

          const totalPagoProfissional = pagamentosProfissional
            .filter((p: any) => p.processo_id === originalId)
            .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

          if (totalRecebido <= 0) {
            throw new Error("Não existe valor recebido neste processo para recalcular a parte do profissional.");
          }

          const novoPercentualProfissional =
            Math.round(((totalPagoProfissional + valor) / totalRecebido) * 10000) / 100;

          const { error } = await supabase
            .from("processos_individuais")
            .update({
              percentual_profissional: novoPercentualProfissional,
              data_fim: formData.data_vencimento || null,
            } as any)
            .eq("id", originalId);

          if (error) throw error;
          return;
        }
      }

      const { recorrencia_tipo, recorrencia_quantidade, origem_tipo, original_id, tipo, ...payload } = formData;

      if (payload.id) {
        const { id, ...updatePayload } = payload;

        const { error } = await supabase
          .from("contas_a_pagar")
          .update(updatePayload)
          .eq("id", id);

        if (error) throw error;
      } else {
        const { id, ...insertPayload } = payload;

        const { error } = await supabase.from("contas_a_pagar").insert(insertPayload);

        if (error) throw error;
      }
    },

    onSuccess: () => {
      invalidateTudoContas();

      setDialogOpen(false);
      setEditingConta(null);

      toast({ title: "Conta salva com sucesso!" });
    },

    onError: (err: any) =>
      toast({
        title: "Erro ao salvar conta",
        description: err?.message || "Não foi possível salvar a conta.",
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: any) => {
      if (!item) throw new Error("Lançamento não encontrado.");

      const sourceType = item.origem_tipo || "manual";
      const originalId =
        item.original_id ||
        String(item.id || "")
          .replace("manual-", "")
          .replace("pgto-", "")
          .replace("com-", "")
          .replace("reemb-", "")
          .replace("prof-", "")
          .replace("proc-ind-", "")
          .replace("proc-emp-", "");

      const deletedAt = new Date().toISOString();

      if (sourceType === "manual") {
        const { error } = await supabase
          .from("contas_a_pagar")
          .update({ deleted_at: deletedAt })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "aluno") {
        const { error } = await supabase
          .from("pagamentos")
          .update({ deleted_at: deletedAt })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "comissao") {
        const comissao = comissoes.find((c: any) => c.id === originalId);

        if (comissao?.despesa_id) {
          const { error: despesaError } = await supabase
            .from("despesas")
            .update({ deleted_at: deletedAt })
            .eq("id", comissao.despesa_id);

          if (despesaError) throw despesaError;
        }

        const { error } = await supabase
          .from("comissoes")
          .update({ deleted_at: deletedAt })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "reembolso") {
        const reembolso = reembolsos.find((r: any) => r.id === originalId);

        if (reembolso?.despesa_id) {
          const { error: despesaError } = await supabase
            .from("despesas")
            .update({ deleted_at: deletedAt })
            .eq("id", reembolso.despesa_id);

          if (despesaError) throw despesaError;
        }

        const { error } = await supabase
          .from("reembolsos")
          .update({ deleted_at: deletedAt })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "processo_individual") {
        const totalPago = pagamentosProcesso
          .filter((p: any) => p.processo_id === originalId)
          .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

        const { error } = await supabase
          .from("processos_individuais")
          .update({
            valor_total: totalPago,
            observacoes: `Ajustado pelo Contas a Pagar e Receber para remover pendência em ${new Date().toLocaleDateString("pt-BR")}.`,
          } as any)
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "processo_empresarial") {
        const totalPago = pagamentosProcessoEmp
          .filter((p: any) => p.processo_id === originalId)
          .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

        const { error } = await supabase
          .from("processos_empresariais")
          .update({
            valor_total: totalPago,
            observacoes: `Ajustado pelo Contas a Pagar e Receber para remover pendência em ${new Date().toLocaleDateString("pt-BR")}.`,
          } as any)
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "profissional") {
        const totalRecebido = pagamentosProcesso
          .filter((p: any) => p.processo_id === originalId)
          .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

        const totalPagoProfissional = pagamentosProfissional
          .filter((p: any) => p.processo_id === originalId)
          .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

        const novoPercentual =
          totalRecebido > 0
            ? Math.round((totalPagoProfissional / totalRecebido) * 10000) / 100
            : 0;

        const { error } = await supabase
          .from("processos_individuais")
          .update({
            percentual_profissional: novoPercentual,
          } as any)
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      throw new Error("Não foi possível identificar a origem deste lançamento.");
    },

    onSuccess: () => {
      invalidateTudoContas();
      toast({ title: "Lançamento removido/ajustado na origem." });
    },

    onError: (err: any) =>
      toast({
        title: "Erro ao excluir lançamento",
        description: err?.message || "Não foi possível excluir este lançamento.",
        variant: "destructive",
      }),
  });

  const criarDespesaAutomatica = async ({
    descricao,
    valor,
    data,
    conta_bancaria_id,
    forma_pagamento,
    fornecedor,
    observacoes,
  }: {
    descricao: string;
    valor: number;
    data: string;
    conta_bancaria_id: string;
    forma_pagamento: string;
    fornecedor?: string | null;
    observacoes?: string | null;
  }) => {
    const despesaId = crypto.randomUUID();

    const { error } = await supabase.from("despesas").insert({
      id: despesaId,
      descricao,
      valor,
      data,
      conta_bancaria_id,
      forma_pagamento: forma_pagamento || null,
      fornecedor: fornecedor || null,
      observacoes: observacoes || null,
      recorrente: false,
    });

    if (error) throw error;

    return despesaId;
  };


  const getContaActionLabel = (conta: any) => {
    return conta?.tipo === "receber" ? "recebimento" : "pagamento";
  };

  const invalidateTudoContas = () => {
    queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
    queryClient.invalidateQueries({ queryKey: ["movimentacoes_contas"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos-contas"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
    queryClient.invalidateQueries({ queryKey: ["comissoes"] });
    queryClient.invalidateQueries({ queryKey: ["comissoes-contas"] });
    queryClient.invalidateQueries({ queryKey: ["reembolsos"] });
    queryClient.invalidateQueries({ queryKey: ["reembolsos-contas"] });
    queryClient.invalidateQueries({ queryKey: ["processos-ind-contas"] });
    queryClient.invalidateQueries({ queryKey: ["pgtos-processo-contas"] });
    queryClient.invalidateQueries({ queryKey: ["processos-emp-contas"] });
    queryClient.invalidateQueries({ queryKey: ["pgtos-processo-emp-contas"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos_profissional"] });
    queryClient.invalidateQueries({ queryKey: ["pagamentos-profissional-contas"] });
    queryClient.invalidateQueries({ queryKey: ["despesas"] });
    queryClient.invalidateQueries({ queryKey: ["despesas_por_conta_detail"] });
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
    queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });
  };

  const markPaidMutation = useMutation({
    mutationFn: async ({
      conta,
      data_pagamento,
      forma_pagamento,
      parcelas,
      conta_bancaria_id,
      valor_pago,
      observacoes,
    }: {
      conta: any;
      data_pagamento: string;
      forma_pagamento: string;
      parcelas: number;
      conta_bancaria_id: string;
      valor_pago: number;
      observacoes?: string;
    }) => {
      if (!conta) throw new Error("Conta não encontrada.");
      if (!data_pagamento) throw new Error("Informe a data de pagamento.");
      if (!forma_pagamento) throw new Error("Informe a forma de pagamento.");
      if (!conta_bancaria_id) throw new Error("Informe a conta bancária usada para o lançamento.");

      const sourceType = conta.origem_tipo || "manual";
      const originalId = getOrigemId(conta);
      const valorOriginal = Number(conta.valor_original ?? conta.valor ?? 0);
      const saldoAtual = Number(conta.saldo_restante ?? conta.valor ?? 0);
      const valorInformado = Number(valor_pago) > 0 ? roundMoney(Number(valor_pago)) : roundMoney(Number(conta.valor || 0));

      if (valorInformado <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }

      if (saldoAtual > 0 && valorInformado - saldoAtual > 0.009) {
        throw new Error("O valor informado é maior que o saldo restante.");
      }

      const observacaoExtra = observacoes?.trim() || null;
      const novoTotalMovimentado = roundMoney(getTotalMovimentado(sourceType, originalId) + valorInformado);
      const quitado = novoTotalMovimentado + 0.009 >= valorOriginal;

      const { error: movError } = await supabase.from("movimentacoes_contas" as any).insert({
        conta_origem_tipo: sourceType,
        conta_origem_id: originalId,
        tipo: conta.tipo,
        valor: valorInformado,
        data: data_pagamento,
        forma_pagamento,
        conta_bancaria_id,
        observacoes: observacaoExtra || `${conta.tipo === "receber" ? "Recebimento" : "Pagamento"} lançado pelo Contas a Pagar e Receber.`,
      });

      if (movError) throw movError;

      if (sourceType === "aluno") {
        const pagamento = pagamentos.find((item: any) => item.id === originalId);
        const novoValorPago = roundMoney(Number(pagamento?.valor_pago || 0) + valorInformado);
        const { error } = await supabase
          .from("pagamentos")
          .update({
            status: quitado ? "pago" : "pendente",
            data_pagamento,
            valor_pago: novoValorPago,
            forma_pagamento,
            conta_bancaria_id,
          })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "processo_individual") {
        const { error } = await supabase.from("pagamentos_processo").insert({
          processo_id: originalId,
          valor: valorInformado,
          data: data_pagamento,
          forma_pagamento,
          conta_bancaria_id,
          observacoes: observacaoExtra || `Recebimento lançado pelo Contas a Pagar e Receber.`,
        } as any);

        if (error) throw error;
        return;
      }

      if (sourceType === "processo_empresarial") {
        const { error } = await supabase.from("pagamentos_processo_empresarial").insert({
          processo_id: originalId,
          valor: valorInformado,
          data: data_pagamento,
          forma_pagamento,
          conta_bancaria_id,
          observacoes: observacaoExtra || `Recebimento lançado pelo Contas a Pagar e Receber.`,
        } as any);

        if (error) throw error;
        return;
      }

      if (sourceType === "profissional") {
        const processo = processosIndividuais.find((p: any) => p.id === originalId);
        if (!processo) throw new Error("Processo do profissional não encontrado.");

        const profissionalId = processo.profissional_id;
        const profissional = profissionais.find((p: any) => p.id === profissionalId);
        const profissionalNome = profissional?.nome || processo.responsavel || "Profissional";

        if (!profissionalId) {
          throw new Error("Esse processo não tem profissional vinculado.");
        }

        const despesaId = await criarDespesaAutomatica({
          descricao: `Pagamento profissional: ${profissionalNome} — Cliente: ${processo.cliente_nome}`,
          valor: valorInformado,
          data: data_pagamento,
          conta_bancaria_id,
          forma_pagamento,
          fornecedor: profissionalNome,
          observacoes: observacaoExtra || `Pagamento lançado pelo Contas a Pagar.`,
        });

        const { error } = await supabase.from("pagamentos_profissional").insert({
          profissional_id: profissionalId,
          processo_id: processo.id,
          valor: valorInformado,
          data: data_pagamento,
          forma_pagamento,
          conta_bancaria_id,
          observacoes: observacaoExtra || `Pagamento lançado pelo Contas a Pagar.`,
          despesa_id: despesaId,
        } as any);

        if (error) throw error;
        return;
      }

      if (sourceType === "manual") {
        const contaManual = contasManuais.find((m: any) => m.id === originalId);

        const quantidadeParcelas = Math.max(1, parcelas || 1);
        const valorParcela = roundMoney(valorInformado / quantidadeParcelas);

        const despesasParaInserir = Array.from({ length: quantidadeParcelas }).map((_, index) => {
          const dataParcela = new Date(data_pagamento + "T12:00:00");
          dataParcela.setMonth(dataParcela.getMonth() + index);
          const dataDespesa = dataParcela.toISOString().split("T")[0];
          const valorLinha = index === quantidadeParcelas - 1
            ? roundMoney(valorInformado - valorParcela * (quantidadeParcelas - 1))
            : valorParcela;

          return {
            descricao:
              quantidadeParcelas > 1
                ? `Pagamento de conta: ${conta.descricao} (${index + 1}/${quantidadeParcelas})`
                : `Pagamento de conta: ${conta.descricao}`,
            valor: valorLinha,
            data: dataDespesa,
            conta_bancaria_id,
            fornecedor: conta.fornecedor || null,
            forma_pagamento,
            observacoes: [
              contaManual?.observacoes || "",
              observacaoExtra || "",
              `Baixa ${quitado ? "final" : "parcial"} via Contas a Pagar e Receber.`,
            ]
              .filter(Boolean)
              .join("\r\n"),
            recorrente: false,
          };
        });

        const { error: despesaError } = await supabase.from("despesas").insert(despesasParaInserir);
        if (despesaError) throw despesaError;

        const { error: updateError } = await supabase
          .from("contas_a_pagar")
          .update({
            status: quitado ? "pago" : "pendente",
            data_pagamento: quitado ? data_pagamento : null,
            forma_pagamento,
            conta_bancaria_id,
            observacoes: [
              contaManual?.observacoes || "",
              observacaoExtra || "",
              `Total lançado até agora: ${formatCurrency(novoTotalMovimentado)} de ${formatCurrency(valorOriginal)}.`,
            ]
              .filter(Boolean)
              .join("\r\n"),
          })
          .eq("id", originalId);

        if (updateError) throw updateError;
        return;
      }

      if (sourceType === "comissao") {
        const comissao = comissoes.find((c: any) => c.id === originalId);
        if (!comissao) throw new Error("Comissão não encontrada.");

        const alunoNome = comissao.alunos?.nome || "Aluno";
        const comercialNome = comissao.comerciais?.nome || "Comercial";

        const despesaId = await criarDespesaAutomatica({
          descricao: `Comissão: ${comercialNome} — Matrícula ${alunoNome}`,
          valor: valorInformado,
          data: data_pagamento,
          conta_bancaria_id,
          forma_pagamento,
          fornecedor: comercialNome,
          observacoes: observacaoExtra || `Comissão lançada pelo Contas a Pagar.`,
        });

        const { error } = await supabase
          .from("comissoes")
          .update({
            valor_pago: novoTotalMovimentado,
            status: quitado ? "pago" : "pendente",
            data_pagamento,
            forma_pagamento,
            conta_bancaria_id,
            despesa_id: despesaId,
          })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      if (sourceType === "reembolso") {
        const reembolso = reembolsos.find((r: any) => r.id === originalId);
        if (!reembolso) throw new Error("Reembolso não encontrado.");

        const despesaId = await criarDespesaAutomatica({
          descricao: `Reembolso: ${reembolso.descricao} (${reembolso.pessoa_nome})`,
          valor: valorInformado,
          data: data_pagamento,
          conta_bancaria_id,
          forma_pagamento,
          fornecedor: reembolso.pessoa_nome || null,
          observacoes: observacaoExtra || `Reembolso lançado pelo Contas a Pagar.`,
        });

        const { error } = await supabase
          .from("reembolsos")
          .update({
            status: quitado ? "pago" : "pendente",
            data_reembolso: data_pagamento,
            forma_pagamento,
            conta_bancaria_id,
            despesa_id: despesaId,
          })
          .eq("id", originalId);

        if (error) throw error;
        return;
      }

      throw new Error("Este tipo de conta ainda não pode ser baixado por esta tela.");
    },

    onSuccess: () => {
      invalidateTudoContas();

      setPayDialogOpen(false);
      setPayingConta(null);

      toast({ title: "Lançamento registrado com sucesso!" });
    },

    onError: (err: any) =>
      toast({
        title: "Erro ao registrar lançamento",
        description: err?.message || "Não foi possível registrar o lançamento.",
        variant: "destructive",
      }),
  });

  const deleteMovimentacaoMutation = useMutation({
    mutationFn: async ({
      conta,
      movimentacao,
    }: {
      conta: any;
      movimentacao: HistoricoMovimento;
    }) => {
      if (!conta || !movimentacao?.id) {
        throw new Error("Movimentação não encontrada.");
      }

      const sourceType = conta.origem_tipo || "manual";
      const originalId = getOrigemId(conta);
      const valor = roundMoney(Number(movimentacao.valor || 0));
      const data = movimentacao.data;
      const forma_pagamento = movimentacao.forma_pagamento || null;
      const conta_bancaria_id = movimentacao.conta_bancaria_id || null;
      const deletedAt = new Date().toISOString();

      if (sourceType === "aluno") {
        const pagamento = pagamentos.find((p: any) => p.id === originalId);
        const novoValorPago = Math.max(roundMoney(Number(pagamento?.valor_pago || 0) - valor), 0);
        const valorOriginal = Number(pagamento?.valor || 0);
        const novoStatus = novoValorPago + 0.009 >= valorOriginal ? "pago" : "pendente";

        const { error } = await supabase
          .from("pagamentos")
          .update({
            valor_pago: novoValorPago,
            status: novoStatus,
            data_pagamento: novoValorPago > 0 ? pagamento?.data_pagamento || data : null,
          })
          .eq("id", originalId);

        if (error) throw error;
      }

      if (sourceType === "processo_individual") {
        await softDeletePagamentoProcessoCompativel({
          table: "pagamentos_processo",
          processo_id: originalId,
          valor,
          data,
          forma_pagamento,
          conta_bancaria_id,
        });
      }

      if (sourceType === "processo_empresarial") {
        await softDeletePagamentoProcessoCompativel({
          table: "pagamentos_processo_empresarial",
          processo_id: originalId,
          valor,
          data,
          forma_pagamento,
          conta_bancaria_id,
        });
      }

      if (sourceType === "manual") {
        const contaManual = contasManuais.find((m: any) => m.id === originalId);
        const novoTotalMovimentado = Math.max(roundMoney(getTotalMovimentado(sourceType, originalId) - valor), 0);
        const valorOriginal = Number(contaManual?.valor || conta.valor_original || conta.valor || 0);
        const quitado = novoTotalMovimentado + 0.009 >= valorOriginal;

        await softDeleteDespesaCompativel({
          valor,
          data,
          forma_pagamento,
          conta_bancaria_id,
          descricaoContains: contaManual?.descricao || conta.descricao,
        });

        const { error } = await supabase
          .from("contas_a_pagar")
          .update({
            status: quitado ? "pago" : "pendente",
            data_pagamento: quitado ? contaManual?.data_pagamento || data : null,
          })
          .eq("id", originalId);

        if (error) throw error;
      }

      if (sourceType === "comissao") {
        const comissao = comissoes.find((c: any) => c.id === originalId);
        const novoTotalMovimentado = Math.max(roundMoney(getTotalMovimentado(sourceType, originalId) - valor), 0);
        const valorOriginal = Number(comissao?.valor_comissao || conta.valor_original || conta.valor || 0);
        const quitado = novoTotalMovimentado + 0.009 >= valorOriginal;
        const comercialNome = comissao?.comerciais?.nome || conta.fornecedor || "";

        await softDeleteDespesaCompativel({
          valor,
          data,
          forma_pagamento,
          conta_bancaria_id,
          descricaoContains: comercialNome || "Comissão",
        });

        const { error } = await supabase
          .from("comissoes")
          .update({
            valor_pago: novoTotalMovimentado,
            status: quitado ? "pago" : "pendente",
            data_pagamento: novoTotalMovimentado > 0 ? comissao?.data_pagamento || data : null,
          })
          .eq("id", originalId);

        if (error) throw error;
      }

      if (sourceType === "reembolso") {
        const reembolso = reembolsos.find((r: any) => r.id === originalId);
        const novoTotalMovimentado = Math.max(roundMoney(getTotalMovimentado(sourceType, originalId) - valor), 0);
        const valorOriginal = Number(reembolso?.valor || conta.valor_original || conta.valor || 0);
        const quitado = novoTotalMovimentado + 0.009 >= valorOriginal;

        await softDeleteDespesaCompativel({
          valor,
          data,
          forma_pagamento,
          conta_bancaria_id,
          descricaoContains: reembolso?.descricao || conta.descricao,
        });

        const { error } = await supabase
          .from("reembolsos")
          .update({
            status: quitado ? "pago" : "pendente",
            data_reembolso: quitado ? reembolso?.data_reembolso || data : null,
          })
          .eq("id", originalId);

        if (error) throw error;
      }

      if (sourceType === "profissional") {
        let pgProfQuery = supabase
          .from("pagamentos_profissional")
          .select("id, despesa_id")
          .is("deleted_at", null)
          .eq("processo_id", originalId)
          .eq("valor", valor)
          .eq("data", data || "");

        if (conta_bancaria_id) {
          pgProfQuery = pgProfQuery.eq("conta_bancaria_id", conta_bancaria_id);
        }

        const { data: pagamentosEncontrados, error: findError } = await pgProfQuery
          .order("created_at", { ascending: false })
          .limit(1);

        if (findError) throw findError;

        const pagamentoProf = pagamentosEncontrados?.[0];

        if (pagamentoProf?.despesa_id) {
          const { error: despesaError } = await supabase
            .from("despesas")
            .update({ deleted_at: deletedAt })
            .eq("id", pagamentoProf.despesa_id);

          if (despesaError) throw despesaError;
        }

        if (pagamentoProf?.id) {
          const { error: pgError } = await supabase
            .from("pagamentos_profissional")
            .update({ deleted_at: deletedAt })
            .eq("id", pagamentoProf.id);

          if (pgError) throw pgError;
        }
      }

      const { error: movError } = await supabase
        .from("movimentacoes_contas" as any)
        .update({ deleted_at: deletedAt })
        .eq("id", movimentacao.id);

      if (movError) throw movError;
    },

    onSuccess: () => {
      invalidateTudoContas();
      toast({ title: "Baixa parcial excluída e saldo recalculado." });
    },

    onError: (err: any) =>
      toast({
        title: "Erro ao excluir baixa",
        description: err?.message || "Não foi possível excluir esta baixa parcial.",
        variant: "destructive",
      }),
  });


  const [form, setForm] = useState({
    id: "",
    descricao: "",
    valor: "",
    data_vencimento: "",
    categoria: "",
    fornecedor: "",
    forma_pagamento: "",
    conta_bancaria_id: "",
    observacoes: "",
    recorrente: false,
    recorrencia_tipo: "mensal",
    recorrencia_quantidade: "1",
    origem_tipo: "",
    original_id: "",
    tipo: "pagar",
  });

  const openNew = () => {
    setForm({
      id: "",
      descricao: "",
      valor: "",
      data_vencimento: "",
      categoria: "",
      fornecedor: "",
      forma_pagamento: "",
      conta_bancaria_id: "",
      observacoes: "",
      recorrente: false,
      recorrencia_tipo: "mensal",
      recorrencia_quantidade: "1",
      origem_tipo: "",
      original_id: "",
      tipo: "pagar",
    });

    setEditingConta(null);
    setDialogOpen(true);
  };

  const openEdit = (conta: any) => {
    const origemTipo = conta.origem_tipo || "manual";
    const originalId =
      conta.original_id ||
      String(conta.id || "")
        .replace("manual-", "")
        .replace("pgto-", "")
        .replace("com-", "")
        .replace("reemb-", "")
        .replace("proc-ind-", "")
        .replace("proc-emp-", "");

    setForm({
      id: conta.id || "",
      descricao: conta.descricao || "",
      valor: String(conta.valor ?? ""),
      data_vencimento: conta.data_vencimento || conta.data_fim || conta.data_despesa || "",
      categoria: conta.categoria || "",
      fornecedor: conta.fornecedor || "",
      forma_pagamento: conta.forma_pagamento || "",
      conta_bancaria_id: conta.conta_bancaria_id || "",
      observacoes: conta.observacoes || "",
      recorrente: false,
      recorrencia_tipo: "mensal",
      recorrencia_quantidade: "1",
      origem_tipo: origemTipo,
      original_id: originalId,
      tipo: conta.tipo || "pagar",
    });

    setEditingConta(conta);
    setDialogOpen(true);
  };

  const openPayDialog = (conta: any) => {
    const saldoRestante = Number(conta.saldo_restante ?? conta.valor ?? 0);

    setPayingConta(conta);

    setPayForm({
      valor: String(saldoRestante || conta.valor || ""),
      data_pagamento: hoje,
      forma_pagamento: conta.forma_pagamento || "",
      parcelas: "1",
      conta_bancaria_id: conta.conta_bancaria_id || "",
      observacoes: "",
      tipo_baixa: "total",
    });

    setPayDialogOpen(true);
  };

  const calcularDataRecorrencia = (dataBase: string, tipo: string, index: number) => {
    const data = new Date(dataBase + "T12:00:00");

    if (tipo === "diario") return addDays(data, index).toISOString().split("T")[0];
    if (tipo === "semanal") return addWeeks(data, index).toISOString().split("T")[0];
    if (tipo === "mensal") return addMonths(data, index).toISOString().split("T")[0];
    if (tipo === "trimestral") return addMonths(data, index * 3).toISOString().split("T")[0];
    if (tipo === "semestral") return addMonths(data, index * 6).toISOString().split("T")[0];
    if (tipo === "anual") return addMonths(data, index * 12).toISOString().split("T")[0];

    return dataBase;
  };

  const handleSave = () => {
    if (!form.descricao || !form.valor || !form.data_vencimento) {
      toast({
        title: "Preencha descrição, valor e data de vencimento",
        variant: "destructive",
      });
      return;
    }

    const quantidadeRepeticoes = Math.max(
      1,
      parseInt(form.recorrencia_quantidade) || 1
    );

    const baseConta = {
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      categoria: form.categoria || null,
      fornecedor: form.fornecedor || null,
      forma_pagamento: form.forma_pagamento || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      recorrente: form.recorrente,
    };

    if (form.id) {
      saveMutation.mutate({
        id: form.id,
        origem_tipo: form.origem_tipo,
        original_id: form.original_id,
        tipo: form.tipo,
        ...baseConta,
        data_vencimento: form.data_vencimento,
        observacoes: form.observacoes || null,
      });

      return;
    }

    if (form.recorrente) {
      const contasRecorrentes = Array.from({ length: quantidadeRepeticoes }).map(
        (_, index) => {
          const dataVencimento = calcularDataRecorrencia(
            form.data_vencimento,
            form.recorrencia_tipo,
            index
          );

          return {
            ...baseConta,
            descricao:
              quantidadeRepeticoes > 1
                ? `${form.descricao} (${index + 1}/${quantidadeRepeticoes})`
                : form.descricao,
            data_vencimento: dataVencimento,
            observacoes: form.observacoes
              ? `${form.observacoes}\n\nRecorrência: ${form.recorrencia_tipo}. Parcela ${index + 1}/${quantidadeRepeticoes}.`
              : `Recorrência: ${form.recorrencia_tipo}. Parcela ${index + 1}/${quantidadeRepeticoes}.`,
          };
        }
      );

      saveMutation.mutate(contasRecorrentes);
      return;
    }

    saveMutation.mutate({
      ...baseConta,
      data_vencimento: form.data_vencimento,
      observacoes: form.observacoes || null,
    });
  };

  const exportarPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Contas a Pagar e Receber", 14, 20);

    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    doc.setFontSize(11);
    doc.text(`A Pagar: ${formatCurrency(totalAPagar)}`, 14, 38);
    doc.text(`A Receber: ${formatCurrency(totalAReceber)}`, 14, 45);
    doc.text(`Vencidos: ${formatCurrency(totalVencido)}`, 14, 52);
    doc.text(`Saldo Projetado: ${formatCurrency(saldoProjetado)}`, 14, 59);

    autoTable(doc, {
      startY: 68,
      head: [["Tipo", "Descrição", "Origem", "Categoria", "Vencimento", "Status", "Valor"]],
      body: filtered.map((c) => [
        c.tipo === "pagar" ? "Pagar" : "Receber",
        c.descricao,
        c.origem,
        c.categoria,
        formatDate(c.data_vencimento),
        c.status === "vencido"
          ? "Vencido"
          : c.status === "pago"
            ? "Pago"
            : c.status === "parcial"
              ? "Parcial"
              : "Pendente",
        `${c.tipo === "pagar" ? "- " : "+ "}${formatCurrency(c.valor)}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
    });

    doc.save("contas-pagar-receber.pdf");
    toast({ title: "PDF exportado com sucesso!" });
  };

  const historicoPagamento = useMemo(() => {
    return getHistoricoMovimentos(payingConta);
  }, [payingConta, movimentacoesContas, pagamentosProfissional, pagamentosProcesso, pagamentosProcessoEmp, pagamentos]);

  const exportarExcel = () => {
    const escapeCsv = (value: any) => {
      const textValue = value === null || value === undefined ? "" : String(value);
      return `"${textValue.replace(/"/g, '""')}"`;
    };

    const resumo = [
      ["Relatório", "Contas a Pagar e Receber"],
      ["Filtro de vencimento", filterDataInicio || "Início", filterDataFim || "Fim"],
      ["Gerado em", new Date().toLocaleDateString("pt-BR")],
      ["A Pagar", formatCurrency(totalAPagar)],
      ["A Receber", formatCurrency(totalAReceber)],
      ["Vencidos", formatCurrency(totalVencido)],
      ["Saldo Projetado", formatCurrency(saldoProjetado)],
      [],
    ];

    const header = [
      "Tipo",
      "Descrição",
      "Origem",
      "Categoria",
      "Vencimento",
      "Pagamento",
      "Status",
      "Forma de pagamento",
      "Valor",
    ];

    const rows = filtered.map((c) => [
      c.tipo === "pagar" ? "Pagar" : "Receber",
      c.descricao,
      c.origem,
      c.categoria,
      formatDate(c.data_vencimento),
      formatDate(c.data_pagamento),
      c.status === "vencido" ? "Vencido" : c.status === "pago" ? "Pago" : "Pendente",
      c.forma_pagamento || "",
      `${c.tipo === "pagar" ? "- " : "+ "}${formatCurrency(c.valor)}`,
    ]);

    const csv = ["sep=;", ...resumo, header, ...rows]
      .map((row) => Array.isArray(row) ? row.map(escapeCsv).join(";") : row)
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "contas-pagar-receber.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: "Excel exportado com sucesso!" });
  };


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="A Pagar"
          value={formatCurrency(totalAPagar)}
          icon={TrendingDown}
          variant="warning"
          onClick={() => {
            const items = pendentes
              .filter((c) => c.tipo === "pagar")
              .map((c) => ({
                nome: c.descricao,
                data: c.data_vencimento || "",
                valor: formatCurrency(c.valor),
              }));

            setMetricDialog({ title: "Contas a Pagar", items });
          }}
        />

        <MetricCard
          title="A Receber"
          value={formatCurrency(totalAReceber)}
          icon={TrendingUp}
          variant="success"
          onClick={() => {
            const items = pendentes
              .filter((c) => c.tipo === "receber")
              .map((c) => ({
                nome: c.descricao,
                data: c.data_vencimento || "",
                valor: formatCurrency(c.valor),
              }));

            setMetricDialog({ title: "Contas a Receber", items });
          }}
        />

        <MetricCard
          title="Vencidos"
          value={formatCurrency(totalVencido)}
          icon={AlertTriangle}
          variant="destructive"
          onClick={() => {
            const items = pendentes
              .filter((c) => c.status === "vencido")
              .map((c) => ({
                nome: c.descricao,
                data: c.data_vencimento || "",
                valor: formatCurrency(c.valor),
              }));

            setMetricDialog({ title: "Contas Vencidas", items });
          }}
        />

        <MetricCard
          title="Vence em 7 dias"
          value={formatCurrency(venceEstaSemana)}
          icon={Clock}
          variant="warning"
          onClick={() => {
            const hojeDate = new Date();
            hojeDate.setHours(0, 0, 0, 0);

            const items = pendentes
              .filter((c) => {
                if (!c.data_vencimento || c.status === "vencido") return false;

                const dias = differenceInDays(
                  new Date(c.data_vencimento + "T12:00:00"),
                  hojeDate
                );

                return dias >= 0 && dias <= 7;
              })
              .map((c) => ({
                nome: c.descricao,
                data: c.data_vencimento || "",
                valor: formatCurrency(c.valor),
              }));

            setMetricDialog({ title: "Vence em 7 dias", items });
          }}
        />

        <MetricCard
          title="Saldo Projetado"
          value={formatCurrency(saldoProjetado)}
          icon={Wallet}
          variant={saldoProjetado >= 0 ? "success" : "destructive"}
          onClick={() => {
            const items = pendentes.map((c) => ({
              nome: `${c.tipo === "pagar" ? "(-) " : "(+) "}${c.descricao}`,
              data: c.data_vencimento || "",
              valor: `${c.tipo === "pagar" ? "- " : "+ "}${formatCurrency(c.valor)}`,
            }));

            setMetricDialog({ title: "Saldo Projetado — Detalhes", items });
          }}
        />

        <MetricCard
          title="Total Pendentes"
          value={pendentes.length}
          icon={Filter}
          variant="primary"
          onClick={() => {
            const items = pendentes.map((c) => ({
              nome: c.descricao,
              data: c.data_vencimento || "",
              valor: formatCurrency(c.valor),
            }));

            setMetricDialog({ title: "Todas as Pendentes", items });
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">
                Contas a Pagar e Receber
              </CardTitle>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportarExcel}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Excel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportarPDF}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  PDF
                </Button>

                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Nova Conta
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Input
                placeholder="Buscar..."
                value={filterSearch}
                onChange={(e) => {
                  setFilterSearch(e.target.value);
                  setPage(1);
                }}
                className="w-40 h-8 text-sm"
              />

              <Select
                value={filterTipo}
                onValueChange={(v) => {
                  setFilterTipo(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pagar">A Pagar</SelectItem>
                  <SelectItem value="receber">A Receber</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  {showPagos && <SelectItem value="pago">Pago</SelectItem>}
                </SelectContent>
              </Select>

              <Select
                value={filterOrigem}
                onValueChange={(v) => {
                  setFilterOrigem(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="todos">Origem</SelectItem>
                  {origensDisponiveis.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap items-end gap-2 rounded-md border bg-background px-2 py-1">
                <div className="flex items-center gap-1 pb-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Vencimento
                  </span>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => {
                      setFilterDataInicio(e.target.value);
                      setPage(1);
                    }}
                    className="w-36 h-8 text-sm"
                    title="Vencimento inicial"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => {
                      setFilterDataFim(e.target.value);
                      setPage(1);
                    }}
                    className="w-36 h-8 text-sm"
                    title="Vencimento final"
                  />
                </div>
              </div>

              {(filterDataInicio || filterDataFim) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterDataInicio("");
                    setFilterDataFim("");
                    setPage(1);
                  }}
                  className="h-8 px-2 text-xs"
                >
                  Limpar datas
                </Button>
              )}

              <div className="flex items-center gap-1.5 ml-auto">
                <Switch
                  checked={showPagos}
                  onCheckedChange={(v) => {
                    setShowPagos(v);
                    setPage(1);
                  }}
                  id="show-pagos"
                />

                <Label
                  htmlFor="show-pagos"
                  className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Pagos
                </Label>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Urgência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      Nenhum registro encontrado
                    </TableCell>
                  </TableRow>
                )}

                {paged.map((item) => {
                  const urgencia = getUrgencia(item.data_vencimento, item.status);

                  return (
                    <TableRow
                      key={item.id}
                      className={item.status === "vencido" ? "bg-destructive/5" : ""}
                    >
                      <TableCell>
                        <Badge
                          variant={item.tipo === "pagar" ? "destructive" : "default"}
                          className="text-xs"
                        >
                          {item.tipo === "pagar" ? "Pagar" : "Receber"}
                        </Badge>
                      </TableCell>

                      <TableCell
                        className="text-sm max-w-[180px] truncate"
                        title={item.descricao}
                      >
                        <div className="space-y-1">
                          <div>{item.descricao}</div>
                          {Number(item.valor_pago || 0) > 0 && (
                            <div className="text-[11px] text-muted-foreground">
                              {item.tipo === "pagar" ? "Pago" : "Recebido"}: {formatCurrency(Number(item.valor_pago || 0))}
                              {" • "}
                              Saldo: {formatCurrency(Number(item.saldo_restante ?? item.valor ?? 0))}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {item.origem}
                        </span>
                      </TableCell>

                      <TableCell className="text-sm">
                        {formatDate(item.data_vencimento)}
                      </TableCell>

                      <TableCell>
                        {urgencia && (
                          <Badge
                            variant={urgencia.variant}
                            className="text-[10px] whitespace-nowrap"
                          >
                            {urgencia.label}
                          </Badge>
                        )}

                        {item.status === "pago" && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusBadgeClass[item.status] ?? ""}`}
                        >
                          {item.status === "pago"
                            ? "Pago"
                            : item.status === "parcial"
                              ? "Parcial"
                              : item.status === "vencido"
                                ? "Vencido"
                                : "Pendente"}
                        </Badge>
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-sm text-right font-semibold",
                          item.tipo === "pagar" ? "text-destructive" : "text-chart-2"
                        )}
                      >
                        {item.tipo === "pagar" ? "- " : "+ "}
                        {formatCurrency(item.valor)}
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-0.5">
                          {item.status !== "pago" &&
                            [
                              "manual",
                              "comissao",
                              "reembolso",
                              "profissional",
                              "aluno",
                              "processo_individual",
                              "processo_empresarial",
                            ].includes(item.origem_tipo || "") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={item.tipo === "receber" ? "Receber" : "Pagar"}
                                onClick={() => openPayDialog(item)}
                              >
                                <Check className="h-3.5 w-3.5 text-chart-2" />
                              </Button>
                            )}

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Editar"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Excluir / remover da origem"
                            onClick={() =>
                              setConfirmAction({
                                type: "delete",
                                item,
                                descricao: item.descricao,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <PaginationControls
              currentPage={page}
              totalItems={filtered.length}
              pageSize={15}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          key={editingConta?.id || "nova-conta-a-pagar"}
          className="max-w-lg max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {editingConta ? "Editar lançamento" : "Nova Conta a Pagar"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <Label>Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>

              <div>
                <Label>Data de Vencimento *</Label>
                <Input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data_vencimento: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select
                  value={form.categoria}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, categoria: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>

                  <SelectContent>
                    {categoriasEmpresa.length === 0 ? (
                      <SelectItem value="nenhuma_categoria_empresa" disabled>
                        Nenhuma categoria de empresa cadastrada
                      </SelectItem>
                    ) : (
                      categoriasEmpresa.map((categoria: any) => (
                        <SelectItem key={categoria.id} value={categoria.nome}>
                          {categoria.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fornecedor</Label>
                <Input
                  value={form.fornecedor}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label>Conta recorrente</Label>
                  <p className="text-xs text-muted-foreground">
                    Ligue para criar várias contas automaticamente.
                  </p>
                </div>

                <Switch
                  checked={form.recorrente}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({
                      ...f,
                      recorrente: checked,
                      recorrencia_tipo: checked ? f.recorrencia_tipo || "mensal" : "mensal",
                      recorrencia_quantidade: checked
                        ? f.recorrencia_quantidade || "1"
                        : "1",
                    }))
                  }
                  disabled={!!editingConta}
                />
              </div>

              {form.recorrente && !editingConta && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Primeira data</Label>
                    <Input
                      type="date"
                      value={form.data_vencimento}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, data_vencimento: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>Repetir quantas vezes?</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.recorrencia_quantidade}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          recorrencia_quantidade: e.target.value,
                        }))
                      }
                      placeholder="Ex: 12"
                    />
                  </div>

                  <div>
                    <Label>Frequência</Label>
                    <Select
                      value={form.recorrencia_tipo}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, recorrencia_tipo: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                        <SelectItem value="trimestral">Trimestral</SelectItem>
                        <SelectItem value="semestral">Semestral</SelectItem>
                        <SelectItem value="anual">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingConta ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {payingConta?.tipo === "receber" ? "Registrar recebimento" : "Registrar pagamento"}
            </DialogTitle>
          </DialogHeader>

          {payingConta && (() => {
            const valorOriginal = Number(payingConta.valor_original ?? payingConta.valor ?? 0);
            const valorPagoAtual = Number(payingConta.valor_pago ?? 0);
            const saldoRestante = Number(payingConta.saldo_restante ?? payingConta.valor ?? 0);
            const valorDigitado = Number(payForm.valor || 0);
            const novoTotalPago = roundMoney(valorPagoAtual + (valorDigitado > 0 ? valorDigitado : 0));
            const novoSaldo = Math.max(roundMoney(valorOriginal - novoTotalPago), 0);
            const quitacaoTotal = payForm.tipo_baixa === "total" || novoSaldo <= 0.009;

            return (
              <div className="grid gap-5">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="font-semibold">{payingConta.descricao}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Origem: {payingConta.origem} • Categoria: {payingConta.categoria || "—"} • Vencimento: {formatDate(payingConta.data_vencimento)}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Valor total</p>
                      <p className="text-lg font-semibold">{formatCurrency(valorOriginal)}</p>
                    </div>

                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        {payingConta.tipo === "receber" ? "Já recebido" : "Já pago"}
                      </p>
                      <p className="text-lg font-semibold">{formatCurrency(valorPagoAtual)}</p>
                    </div>

                    <div className="rounded-md border bg-background p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo restante</p>
                      <p className="text-lg font-semibold">{formatCurrency(saldoRestante)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Tipo de lançamento</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={payForm.tipo_baixa === "total" ? "default" : "outline"}
                      onClick={() =>
                        setPayForm((f) => ({
                          ...f,
                          tipo_baixa: "total",
                          valor: String(saldoRestante || valorOriginal),
                        }))
                      }
                    >
                      {payingConta.tipo === "receber" ? "Receber tudo" : "Quitar tudo"}
                    </Button>

                    <Button
                      type="button"
                      variant={payForm.tipo_baixa === "parcial" ? "default" : "outline"}
                      onClick={() =>
                        setPayForm((f) => ({
                          ...f,
                          tipo_baixa: "parcial",
                          valor: f.tipo_baixa === "total" ? "" : f.valor,
                        }))
                      }
                    >
                      {payingConta.tipo === "receber" ? "Recebimento parcial" : "Pagamento parcial"}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {payForm.tipo_baixa === "total"
                      ? "O sistema vai lançar o saldo restante e quitar este item."
                      : "Use esta opção quando o pagamento/recebimento acontecer em partes. O saldo continuará aberto até quitar tudo."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>{payingConta?.tipo === "receber" ? "Valor recebido *" : "Valor pago *"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={String(saldoRestante || valorOriginal)}
                      value={payForm.valor}
                      onChange={(e) => setPayForm((f) => ({ ...f, valor: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label>{payingConta?.tipo === "receber" ? "Data do recebimento *" : "Data do pagamento *"}</Label>
                    <Input
                      type="date"
                      value={payForm.data_pagamento}
                      onChange={(e) =>
                        setPayForm((f) => ({ ...f, data_pagamento: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <Label>{payingConta?.tipo === "receber" ? "Parcelas lançadas" : "Quantas vezes pagou? *"}</Label>
                    <Input
                      type="number"
                      min="1"
                      value={payForm.parcelas}
                      onChange={(e) =>
                        setPayForm((f) => ({ ...f, parcelas: e.target.value }))
                      }
                      disabled={payingConta?.tipo === "receber" || payingConta?.origem_tipo !== "manual"}
                    />
                    {payingConta?.origem_tipo === "manual" && payingConta?.tipo === "pagar" && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Use parcelas quando a conta manual foi paga parcelada no cartão.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>{payingConta?.tipo === "receber" ? "Como recebeu? *" : "Como pagou? *"}</Label>
                    <Select
                      value={payForm.forma_pagamento}
                      onValueChange={(value) =>
                        setPayForm((f) => ({ ...f, forma_pagamento: value }))
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

                  <div>
                    <Label>{payingConta?.tipo === "receber" ? "Em qual conta entrou? *" : "De qual conta saiu? *"}</Label>
                    <Select
                      value={payForm.conta_bancaria_id}
                      onValueChange={(value) =>
                        setPayForm((f) => ({ ...f, conta_bancaria_id: value }))
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
                </div>

                <div>
                  <Label>Observações do lançamento</Label>
                  <Textarea
                    value={payForm.observacoes}
                    onChange={(e) => setPayForm((f) => ({ ...f, observacoes: e.target.value }))}
                    placeholder="Ex.: primeira parte, acordo com cliente, complemento, etc."
                  />
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Resumo após salvar</p>
                      <p className="text-xs text-muted-foreground">
                        Confira como ficará o saldo depois deste lançamento.
                      </p>
                    </div>

                    <Badge variant={quitacaoTotal ? "default" : "outline"}>
                      {quitacaoTotal ? (payingConta.tipo === "receber" ? "Recebido" : "Pago") : "Parcial"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Lançando agora</p>
                      <p className="font-semibold">{formatCurrency(valorDigitado || 0)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Total acumulado</p>
                      <p className="font-semibold">{formatCurrency(novoTotalPago)}</p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">Saldo após salvar</p>
                      <p className="font-semibold">{formatCurrency(novoSaldo)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Histórico de pagamentos / recebimentos</p>
                    <p className="text-xs text-muted-foreground">
                      Tudo o que já foi lançado para esta conta.
                    </p>
                  </div>

                  {historicoPagamento.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum lançamento anterior.</p>
                  ) : (
                    <div className="space-y-2">
                      {historicoPagamento.map((mov) => (
                        <div key={mov.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <div>
                              <p className="font-medium">{formatDate(mov.data)}</p>
                              <p className="text-xs text-muted-foreground">{mov.forma_pagamento || "Sem forma informada"}</p>
                            </div>

                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{formatCurrency(Number(mov.valor || 0))}</p>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Excluir esta baixa"
                                disabled={deleteMovimentacaoMutation.isPending}
                                onClick={() => {
                                  if (!payingConta) return;

                                  const confirmar = confirm(
                                    "Deseja excluir esta baixa parcial? O saldo da conta será recalculado automaticamente."
                                  );

                                  if (!confirmar) return;

                                  deleteMovimentacaoMutation.mutate({
                                    conta: payingConta,
                                    movimentacao: mov,
                                  });
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {mov.observacoes && (
                            <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">
                              {mov.observacoes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => {
                    if (!payingConta) return;

                    markPaidMutation.mutate({
                      conta: payingConta,
                      data_pagamento: payForm.data_pagamento,
                      forma_pagamento: payForm.forma_pagamento,
                      parcelas: parseInt(payForm.parcelas) || 1,
                      conta_bancaria_id: payForm.conta_bancaria_id,
                      valor_pago: Number(payForm.valor) || Number(payingConta.saldo_restante ?? payingConta.valor),
                      observacoes: payForm.observacoes,
                    });
                  }}
                  disabled={markPaidMutation.isPending}
                >
                  {markPaidMutation.isPending
                    ? "Registrando..."
                    : payingConta?.tipo === "receber"
                      ? "Salvar recebimento"
                      : "Salvar pagamento"}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>

            <AlertDialogDescription>
              Tem certeza que deseja excluir "{confirmAction?.descricao}"?
              Essa ação também atualiza a origem do lançamento para manter o financeiro sincronizado.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction) {
                  deleteMutation.mutate(confirmAction.item);
                }

                setConfirmAction(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MetricDetailDialog
        open={!!metricDialog}
        onOpenChange={(open) => {
          if (!open) setMetricDialog(null);
        }}
        title={metricDialog?.title || ""}
        items={metricDialog?.items || []}
      />
    </div>
  );
};