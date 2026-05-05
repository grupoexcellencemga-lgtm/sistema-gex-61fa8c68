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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCurrency, formatDate } from "@/lib/formatters";
import { useFormasPagamento } from "@/hooks/useFormasPagamento";

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pago: "default",
  pendente: "secondary",
  vencido: "destructive",
  cancelado: "outline",
};

type ContaItem = {
  id: string;
  tipo: "pagar" | "receber";
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  categoria: string;
  origem: string;
  forma_pagamento: string | null;
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

  const [showPagos, setShowPagos] = useState(false);
  const [page, setPage] = useState(1);

  const [metricDialog, setMetricDialog] = useState<{
    title: string;
    items: MetricDetailItem[];
  } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: "delete";
    id: string;
    descricao: string;
  } | null>(null);

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingConta, setPayingConta] = useState<any>(null);

  const [payForm, setPayForm] = useState({
    data_pagamento: "",
    forma_pagamento: "",
    parcelas: "1",
    conta_bancaria_id: "",
  });

  const { data: formasPagamento = [] } = useFormasPagamento();

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
        .select("*, comerciais(nome)")
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
        .select("id, cliente_nome, valor_total, status, data_inicio, data_fim")
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
        .select("processo_id, valor")
        .is("deleted_at", null);

      if (error) throw error;
      return data;
    },
  });

  const { data: processosEmpresariais = [] } = useQuery({
    queryKey: ["processos-emp-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais")
        .select("id, empresa_nome, valor_total, status, data_inicio, data_fim")
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
        .select("processo_id, valor")
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

  const contasConsolidadas: ContaItem[] = useMemo(() => {
    const items: ContaItem[] = [];

    pagamentos.forEach((p: any) => {
      if (!showPagos && (p.status === "pago" || p.status === "cancelado")) return;

      const isVencido =
        p.status === "pendente" && p.data_vencimento && p.data_vencimento < hoje;

      items.push({
        id: `pgto-${p.id}`,
        tipo: "receber",
        descricao: `${p.alunos?.nome || "Aluno"} — ${p.produtos?.nome || "Produto"}`,
        valor: Number(p.valor),
        data_vencimento: p.data_vencimento,
        data_pagamento: p.data_pagamento,
        status: p.status === "pago" ? "pago" : isVencido ? "vencido" : "pendente",
        categoria: "Mensalidade",
        origem: "Aluno",
        forma_pagamento: p.forma_pagamento,
      });
    });

    comissoes.forEach((c: any) => {
      if (!showPagos && c.status === "pago") return;

      items.push({
        id: `com-${c.id}`,
        tipo: "pagar",
        descricao: `Comissão — ${c.comerciais?.nome || "Vendedor"}`,
        valor: Number(c.valor_comissao),
        data_vencimento: c.created_at ? c.created_at.substring(0, 10) : null,
        data_pagamento: c.data_pagamento,
        status: c.status === "pago" ? "pago" : "pendente",
        categoria: "Comissão",
        origem: "Comissão",
        forma_pagamento: c.forma_pagamento,
      });
    });

    contasManuais.forEach((m: any) => {
      if (!showPagos && m.status === "pago") return;

      const isVencido =
        m.status === "pendente" && m.data_vencimento && m.data_vencimento < hoje;

      items.push({
        id: `manual-${m.id}`,
        tipo: "pagar",
        descricao: m.descricao,
        valor: Number(m.valor),
        data_vencimento: m.data_vencimento,
        data_pagamento: m.data_pagamento,
        status: m.status === "pago" ? "pago" : isVencido ? "vencido" : "pendente",
        categoria: m.categoria || "Conta Manual",
        origem: "Manual",
        forma_pagamento: m.forma_pagamento,
      });
    });

    const pgtosProcMap: Record<string, number> = {};
    pagamentosProcesso.forEach((p: any) => {
      pgtosProcMap[p.processo_id] = (pgtosProcMap[p.processo_id] || 0) + Number(p.valor);
    });

    processosIndividuais.forEach((proc: any) => {
      const pago = pgtosProcMap[proc.id] || 0;
      const restante = Number(proc.valor_total) - pago;

      if (restante > 0) {
        items.push({
          id: `proc-ind-${proc.id}`,
          tipo: "receber",
          descricao: `Processo — ${proc.cliente_nome}`,
          valor: restante,
          data_vencimento: proc.data_fim,
          data_pagamento: null,
          status: "pendente",
          categoria: "Processo Individual",
          origem: "Proc. Individual",
          forma_pagamento: null,
        });
      }
    });

    const pgtosEmpMap: Record<string, number> = {};
    pagamentosProcessoEmp.forEach((p: any) => {
      pgtosEmpMap[p.processo_id] = (pgtosEmpMap[p.processo_id] || 0) + Number(p.valor);
    });

    processosEmpresariais.forEach((proc: any) => {
      const pago = pgtosEmpMap[proc.id] || 0;
      const restante = Number(proc.valor_total) - pago;

      if (restante > 0) {
        items.push({
          id: `proc-emp-${proc.id}`,
          tipo: "receber",
          descricao: `Empresarial — ${proc.empresa_nome}`,
          valor: restante,
          data_vencimento: proc.data_fim,
          data_pagamento: null,
          status: "pendente",
          categoria: "Processo Empresarial",
          origem: "Proc. Empresarial",
          forma_pagamento: null,
        });
      }
    });

    const monthFiltered = items.filter((item) => {
      const dateToCheck = item.status === "pago" ? item.data_pagamento : item.data_vencimento;

      if (!dateToCheck) return true;

      return isInMonth(dateToCheck, mes, ano);
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
  }, [contasConsolidadas, filterTipo, filterStatus, filterOrigem, filterSearch]);

  const paged = paginate(filtered, page, 15);

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (Array.isArray(formData)) {
        const { error } = await supabase.from("contas_a_pagar").insert(formData);
        if (error) throw error;
        return;
      }

      const { recorrencia_tipo, recorrencia_quantidade, ...payload } = formData;

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
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });

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
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("contas_a_pagar")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      toast({ title: "Conta removida" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({
      id,
      data_pagamento,
      forma_pagamento,
      parcelas,
      conta_bancaria_id,
    }: {
      id: string;
      data_pagamento: string;
      forma_pagamento: string;
      parcelas: number;
      conta_bancaria_id: string;
    }) => {
      const { data: conta, error: contaError } = await supabase
        .from("contas_a_pagar")
        .select("*")
        .eq("id", id)
        .single();

      if (contaError) throw contaError;

      if (!conta) throw new Error("Conta não encontrada.");
      if (conta.status === "pago") throw new Error("Essa conta já está marcada como paga.");
      if (!data_pagamento) throw new Error("Informe a data de pagamento.");
      if (!forma_pagamento) throw new Error("Informe a forma de pagamento.");
      if (!conta_bancaria_id) throw new Error("Informe a conta bancária usada para o pagamento.");

      const quantidadeParcelas = Math.max(1, parcelas || 1);
      const valorTotal = Number(conta.valor) || 0;
      const valorParcela = Math.round((valorTotal / quantidadeParcelas) * 100) / 100;

      const despesasParaInserir = Array.from({ length: quantidadeParcelas }).map(
        (_, index) => {
          const dataParcela = new Date(data_pagamento + "T12:00:00");
          dataParcela.setMonth(dataParcela.getMonth() + index);

          const dataDespesa = dataParcela.toISOString().split("T")[0];

          return {
            descricao:
              quantidadeParcelas > 1
                ? `Conta paga: ${conta.descricao} (${index + 1}/${quantidadeParcelas})`
                : `Conta paga: ${conta.descricao}`,
            valor: valorParcela,
            data: dataDespesa,
            conta_bancaria_id,
            fornecedor: conta.fornecedor || null,
            forma_pagamento,
            observacoes: [
              conta.observacoes || "",
              "Lançado automaticamente a partir de Contas a Pagar.",
              `Pagamento em ${quantidadeParcelas}x.`,
              `Data do pagamento: ${data_pagamento}.`,
            ]
              .filter(Boolean)
              .join("\n"),
            recorrente: false,
          };
        }
      );

      const { error: despesaError } = await supabase
        .from("despesas")
        .insert(despesasParaInserir);

      if (despesaError) throw despesaError;

      const { error: updateError } = await supabase
        .from("contas_a_pagar")
        .update({
          status: "pago",
          data_pagamento,
          forma_pagamento,
          conta_bancaria_id,
          observacoes: [
            conta.observacoes || "",
            `Pago em ${quantidadeParcelas}x.`,
            `Forma de pagamento: ${forma_pagamento}.`,
          ]
            .filter(Boolean)
            .join("\n"),
        })
        .eq("id", id);

      if (updateError) throw updateError;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["despesas_por_conta_detail"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["relatorios-data"] });

      setPayDialogOpen(false);
      setPayingConta(null);

      toast({ title: "Conta paga e lançada no banco!" });
    },

    onError: (err: any) =>
      toast({
        title: "Erro ao pagar conta",
        description: err?.message || "Não foi possível pagar a conta.",
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
    });

    setEditingConta(null);
    setDialogOpen(true);
  };

  const openEdit = (conta: any) => {
    setForm({
      id: conta.id,
      descricao: conta.descricao,
      valor: String(conta.valor),
      data_vencimento: conta.data_vencimento || "",
      categoria: conta.categoria || "",
      fornecedor: conta.fornecedor || "",
      forma_pagamento: conta.forma_pagamento || "",
      conta_bancaria_id: conta.conta_bancaria_id || "",
      observacoes: conta.observacoes || "",
      recorrente: conta.recorrente || false,
      recorrencia_tipo: "mensal",
      recorrencia_quantidade: "1",
    });

    setEditingConta(conta);
    setDialogOpen(true);
  };

  const openPayDialog = (conta: any) => {
    setPayingConta(conta);

    setPayForm({
      data_pagamento: hoje,
      forma_pagamento: conta.forma_pagamento || "",
      parcelas: "1",
      conta_bancaria_id: conta.conta_bancaria_id || "",
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
        c.status === "vencido" ? "Vencido" : c.status === "pago" ? "Pago" : "Pendente",
        `${c.tipo === "pagar" ? "- " : "+ "}${formatCurrency(c.valor)}`,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 37, 36] },
    });

    doc.save("contas-pagar-receber.pdf");
    toast({ title: "PDF exportado com sucesso!" });
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
                  <TableHead className="w-[90px]">Ações</TableHead>
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
                        {item.descricao}
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
                          variant={statusVariant[item.status] || "secondary"}
                          className="text-xs"
                        >
                          {item.status === "pago"
                            ? "Pago"
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
                        {item.id.startsWith("manual-") && item.status !== "pago" && (
                          <div className="flex gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Pagar conta"
                              onClick={() => {
                                const original = contasManuais.find(
                                  (m: any) => m.id === item.id.replace("manual-", "")
                                );

                                if (original) openPayDialog(original);
                              }}
                            >
                              <Check className="h-3.5 w-3.5 text-chart-2" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Editar"
                              onClick={() => {
                                const original = contasManuais.find(
                                  (m: any) => m.id === item.id.replace("manual-", "")
                                );

                                if (original) openEdit(original);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Excluir"
                              onClick={() =>
                                setConfirmAction({
                                  type: "delete",
                                  id: item.id.replace("manual-", ""),
                                  descricao: item.descricao,
                                })
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        )}
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
              {editingConta ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}
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
                <Input
                  value={form.categoria}
                  onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
                  placeholder="Ex: Aluguel, Contador..."
                />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pagar Conta</DialogTitle>
          </DialogHeader>

          {payingConta && (
            <div className="grid gap-4">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="font-semibold">{payingConta.descricao}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-semibold">
                      {formatCurrency(Number(payingConta.valor))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Vencimento</p>
                    <p className="font-semibold">
                      {formatDate(payingConta.data_vencimento)}
                    </p>
                  </div>
                </div>

                {(payingConta.categoria || payingConta.fornecedor) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Categoria</p>
                      <p className="font-medium">{payingConta.categoria || "—"}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{payingConta.fornecedor || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data de pagamento *</Label>
                  <Input
                    type="date"
                    value={payForm.data_pagamento}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, data_pagamento: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label>Quantas vezes pagou? *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={payForm.parcelas}
                    onChange={(e) =>
                      setPayForm((f) => ({ ...f, parcelas: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Como pagou? *</Label>
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
                  <Label>Qual conta pagou? *</Label>
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

              <Button
                onClick={() => {
                  if (!payingConta) return;

                  markPaidMutation.mutate({
                    id: payingConta.id,
                    data_pagamento: payForm.data_pagamento,
                    forma_pagamento: payForm.forma_pagamento,
                    parcelas: parseInt(payForm.parcelas) || 1,
                    conta_bancaria_id: payForm.conta_bancaria_id,
                  });
                }}
                disabled={markPaidMutation.isPending}
              >
                {markPaidMutation.isPending
                  ? "Registrando pagamento..."
                  : "Confirmar pagamento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>

            <AlertDialogDescription>
              Tem certeza que deseja excluir "{confirmAction?.descricao}"? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmAction) {
                  deleteMutation.mutate(confirmAction.id);
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