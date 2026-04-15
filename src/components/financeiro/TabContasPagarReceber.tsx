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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { MetricCard } from "@/components/MetricCard";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import { differenceInDays, format } from "date-fns";
import { CalendarIcon, Plus, AlertTriangle, Clock, TrendingUp, TrendingDown, Pencil, Trash2, Check, Download, Filter, Wallet, Eye } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { formatCurrency, formatDate } from "@/lib/formatters";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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

// Cálculo de urgência
const getUrgencia = (dataVencimento: string | null, status: string) => {
  if (!dataVencimento || status === "pago") return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento + "T12:00:00");
  const dias = differenceInDays(venc, hoje);

  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? "s" : ""}`, variant: "destructive" as const, dias };
  if (dias === 0) return { label: "Vence hoje!", variant: "destructive" as const, dias };
  if (dias === 1) return { label: "Vence amanhã", variant: "destructive" as const, dias };
  if (dias <= 3) return { label: `Vence em ${dias} dias`, variant: "destructive" as const, dias };
  if (dias <= 7) return { label: `Vence em ${dias} dias`, variant: "secondary" as const, dias };
  if (dias <= 30) return { label: `Vence em ${dias} dias`, variant: "outline" as const, dias };
  return { label: `Vence em ${dias} dias`, variant: "outline" as const, dias };
};

export const TabContasPagarReceber = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterOrigem, setFilterOrigem] = useState<string>("todos");
  const [filterSearch, setFilterSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showPagos, setShowPagos] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "pagar"; id: string; descricao: string } | null>(null);
  const [metricDialog, setMetricDialog] = useState<{ title: string; items: MetricDetailItem[] } | null>(null);

  // Fetch contas_a_pagar (manuais)
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

  // Fetch pagamentos de alunos
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

  // Fetch comissões
  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes-contas-ativas"],
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

  // Fetch processos individuais + pagamentos
  const { data: processosIndividuais = [] } = useQuery({
    queryKey: ["processos-ind-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("id, cliente_nome, valor_total, status, data_inicio, data_fim")
        .in("status", ["ativo", "aberto"]);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["pgtos-processo-contas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_processo").select("processo_id, valor").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch processos empresariais + pagamentos
  const { data: processosEmpresariais = [] } = useQuery({
    queryKey: ["processos-emp-contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais")
        .select("id, empresa_nome, valor_total, status, data_inicio, data_fim")
        .in("status", ["ativo", "aberto"]);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcessoEmp = [] } = useQuery({
    queryKey: ["pgtos-processo-emp-contas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_processo_empresarial").select("processo_id, valor").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // Fetch contas bancárias
  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const hoje = new Date().toISOString().split("T")[0];

  // Consolidar tudo em uma lista unificada
  const contasConsolidadas: ContaItem[] = useMemo(() => {
    const items: ContaItem[] = [];

    // Pagamentos de alunos (a receber)
    pagamentos.forEach((p: any) => {
      if (!showPagos && (p.status === "pago" || p.status === "cancelado")) return;
      const isVencido = p.status === "pendente" && p.data_vencimento && p.data_vencimento < hoje;
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

    // Comissões (a pagar)
    comissoes.forEach((c: any) => {
      if (!showPagos && c.status === "pago") return;
      items.push({
        id: `com-${c.id}`,
        tipo: "pagar",
        descricao: `Comissão — ${c.comerciais?.nome || "Vendedor"}`,
        valor: Number(c.valor_comissao),
        data_vencimento: null,
        data_pagamento: c.data_pagamento,
        status: c.status === "pago" ? "pago" : "pendente",
        categoria: "Comissão",
        origem: "Comissão",
        forma_pagamento: c.forma_pagamento,
      });
    });

    // Contas manuais a pagar
    contasManuais.forEach((m: any) => {
      if (!showPagos && m.status === "pago") return;
      const isVencido = m.status === "pendente" && m.data_vencimento && m.data_vencimento < hoje;
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

    // Processos individuais com saldo a receber
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

    // Processos empresariais com saldo a receber
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

    // Filter by selected month: use data_vencimento for pending, data_pagamento for paid
    const monthFiltered = items.filter(item => {
      const dateToCheck = item.status === "pago" ? item.data_pagamento : item.data_vencimento;
      if (!dateToCheck) return true; // Show items without dates
      return isInMonth(dateToCheck, mes, ano);
    });

    return monthFiltered.sort((a, b) => {
      // Vencidos primeiro, depois por data
      if (a.status === "vencido" && b.status !== "vencido") return -1;
      if (b.status === "vencido" && a.status !== "vencido") return 1;
      const da = a.data_vencimento || "9999";
      const db = b.data_vencimento || "9999";
      return da.localeCompare(db);
    });
  }, [pagamentos, comissoes, contasManuais, processosIndividuais, pagamentosProcesso, processosEmpresariais, pagamentosProcessoEmp, hoje, showPagos, mes, ano]);

  // Métricas (sempre sem pagos)
  const pendentes = contasConsolidadas.filter(c => c.status !== "pago");
  const totalAPagar = pendentes.filter(c => c.tipo === "pagar").reduce((s, c) => s + c.valor, 0);
  const totalAReceber = pendentes.filter(c => c.tipo === "receber").reduce((s, c) => s + c.valor, 0);
  const totalVencido = pendentes.filter(c => c.status === "vencido").reduce((s, c) => s + c.valor, 0);
  const saldoProjetado = totalAReceber - totalAPagar;

  // Vence esta semana (próximos 7 dias)
  const venceEstaSemana = useMemo(() => {
    const hojeDate = new Date();
    hojeDate.setHours(0, 0, 0, 0);
    return pendentes.filter(c => {
      if (!c.data_vencimento || c.status === "vencido") return false;
      const venc = new Date(c.data_vencimento + "T12:00:00");
      const dias = differenceInDays(venc, hojeDate);
      return dias >= 0 && dias <= 7;
    }).reduce((s, c) => s + c.valor, 0);
  }, [pendentes]);

  // Datas com vencimentos para o calendário
  const vencimentoDates = useMemo(() => {
    const map: Record<string, { pagar: number; receber: number; vencido: number }> = {};
    pendentes.filter(c => c.data_vencimento).forEach(c => {
      const key = c.data_vencimento!;
      if (!map[key]) map[key] = { pagar: 0, receber: 0, vencido: 0 };
      if (c.status === "vencido") map[key].vencido++;
      else if (c.tipo === "pagar") map[key].pagar++;
      else map[key].receber++;
    });
    return map;
  }, [pendentes]);

  // Resumo do dia selecionado
  const resumoDia = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = selectedDate.toISOString().split("T")[0];
    const doDia = contasConsolidadas.filter(c => c.data_vencimento === dateStr && c.status !== "pago");
    const pagar = doDia.filter(c => c.tipo === "pagar");
    const receber = doDia.filter(c => c.tipo === "receber");
    const vencidos = doDia.filter(c => c.status === "vencido");
    return {
      total: doDia.length,
      pagarQtd: pagar.length,
      pagarValor: pagar.reduce((s, c) => s + c.valor, 0),
      receberQtd: receber.length,
      receberValor: receber.reduce((s, c) => s + c.valor, 0),
      vencidosQtd: vencidos.length,
    };
  }, [selectedDate, contasConsolidadas]);

  // Origens disponíveis para filtro
  const origensDisponiveis = useMemo(() => {
    const set = new Set(contasConsolidadas.map(c => c.origem));
    return Array.from(set).sort();
  }, [contasConsolidadas]);

  // Filtros
  const filtered = useMemo(() => {
    let items = contasConsolidadas;
    if (filterTipo !== "todos") items = items.filter(c => c.tipo === filterTipo);
    if (filterStatus !== "todos") items = items.filter(c => c.status === filterStatus);
    if (filterOrigem !== "todos") items = items.filter(c => c.origem === filterOrigem);
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      items = items.filter(c => c.descricao.toLowerCase().includes(s) || c.categoria.toLowerCase().includes(s) || c.origem.toLowerCase().includes(s));
    }
    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split("T")[0];
      items = items.filter(c => c.data_vencimento === dateStr);
    }
    return items;
  }, [contasConsolidadas, filterTipo, filterStatus, filterOrigem, filterSearch, selectedDate]);

  const paged = paginate(filtered, page, 15);

  // CRUD contas manuais
  const saveMutation = useMutation({
    mutationFn: async (form: any) => {
      if (form.id) {
        const { error } = await supabase.from("contas_a_pagar").update(form).eq("id", form.id);
        if (error) throw error;
      } else {
        const { id, ...rest } = form;
        const { error } = await supabase.from("contas_a_pagar").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      setDialogOpen(false);
      setEditingConta(null);
      toast({ title: "Conta salva com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao salvar conta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_a_pagar").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      toast({ title: "Conta removida" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_a_pagar").update({ status: "pago", data_pagamento: hoje }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_a_pagar"] });
      toast({ title: "Conta marcada como paga!" });
    },
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
  });

  const openNew = () => {
    setForm({ id: "", descricao: "", valor: "", data_vencimento: "", categoria: "", fornecedor: "", forma_pagamento: "", conta_bancaria_id: "", observacoes: "", recorrente: false });
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
    });
    setEditingConta(conta);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.descricao || !form.valor || !form.data_vencimento) {
      toast({ title: "Preencha descrição, valor e data de vencimento", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      ...(form.id ? { id: form.id } : {}),
      descricao: form.descricao,
      valor: parseFloat(form.valor),
      data_vencimento: form.data_vencimento,
      categoria: form.categoria || null,
      fornecedor: form.fornecedor || null,
      forma_pagamento: form.forma_pagamento || null,
      conta_bancaria_id: form.conta_bancaria_id || null,
      observacoes: form.observacoes || null,
      recorrente: form.recorrente,
    });
  };

  // Exportar PDF
  const exportarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Contas a Pagar e Receber", 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    // Resumo
    doc.setFontSize(11);
    doc.text(`A Pagar: ${formatCurrency(totalAPagar)}`, 14, 38);
    doc.text(`A Receber: ${formatCurrency(totalAReceber)}`, 14, 45);
    doc.text(`Vencidos: ${formatCurrency(totalVencido)}`, 14, 52);
    doc.text(`Saldo Projetado: ${formatCurrency(saldoProjetado)}`, 14, 59);

    autoTable(doc, {
      startY: 68,
      head: [["Tipo", "Descrição", "Origem", "Categoria", "Vencimento", "Status", "Valor"]],
      body: filtered.map(c => [
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

  // Calendar modifiers
  const modifiers = useMemo(() => {
    const hasPagar: Date[] = [];
    const hasReceber: Date[] = [];
    const hasVencido: Date[] = [];
    Object.entries(vencimentoDates).forEach(([dateStr, counts]) => {
      const d = new Date(dateStr + "T12:00:00");
      if (counts.vencido > 0) hasVencido.push(d);
      if (counts.pagar > 0) hasPagar.push(d);
      if (counts.receber > 0) hasReceber.push(d);
    });
    return { hasPagar, hasReceber, hasVencido };
  }, [vencimentoDates]);

  const modifiersStyles = {
    hasPagar: { border: "2px solid hsl(var(--warning))", borderRadius: "6px" },
    hasReceber: { border: "2px solid hsl(var(--chart-2))", borderRadius: "6px" },
    hasVencido: { backgroundColor: "hsl(var(--destructive) / 0.15)", border: "2px solid hsl(var(--destructive))", borderRadius: "6px" },
  };

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="A Pagar" value={formatCurrency(totalAPagar)} icon={TrendingDown} variant="warning"
          onClick={() => {
            const items = pendentes.filter(c => c.tipo === "pagar").map(c => ({ nome: c.descricao, data: c.data_vencimento || "", valor: formatCurrency(c.valor) }));
            setMetricDialog({ title: "Contas a Pagar", items });
          }} />
        <MetricCard title="A Receber" value={formatCurrency(totalAReceber)} icon={TrendingUp} variant="success"
          onClick={() => {
            const items = pendentes.filter(c => c.tipo === "receber").map(c => ({ nome: c.descricao, data: c.data_vencimento || "", valor: formatCurrency(c.valor) }));
            setMetricDialog({ title: "Contas a Receber", items });
          }} />
        <MetricCard title="Vencidos" value={formatCurrency(totalVencido)} icon={AlertTriangle} variant="destructive"
          onClick={() => {
            const items = pendentes.filter(c => c.status === "vencido").map(c => ({ nome: c.descricao, data: c.data_vencimento || "", valor: formatCurrency(c.valor) }));
            setMetricDialog({ title: "Contas Vencidas", items });
          }} />
        <MetricCard title="Vence em 7 dias" value={formatCurrency(venceEstaSemana)} icon={Clock} variant="warning"
          onClick={() => {
            const hojeDate = new Date(); hojeDate.setHours(0, 0, 0, 0);
            const items = pendentes.filter(c => {
              if (!c.data_vencimento || c.status === "vencido") return false;
              const dias = differenceInDays(new Date(c.data_vencimento + "T12:00:00"), hojeDate);
              return dias >= 0 && dias <= 7;
            }).map(c => ({ nome: c.descricao, data: c.data_vencimento || "", valor: formatCurrency(c.valor) }));
            setMetricDialog({ title: "Vence em 7 dias", items });
          }} />
        <MetricCard
          title="Saldo Projetado"
          value={formatCurrency(saldoProjetado)}
          icon={Wallet}
          variant={saldoProjetado >= 0 ? "success" : "destructive"}
          onClick={() => {
            const items = pendentes.map(c => ({ nome: `${c.tipo === "pagar" ? "(-) " : "(+) "}${c.descricao}`, data: c.data_vencimento || "", valor: `${c.tipo === "pagar" ? "- " : "+ "}${formatCurrency(c.valor)}` }));
            setMetricDialog({ title: "Saldo Projetado — Detalhes", items });
          }}
        />
        <MetricCard title="Total Pendentes" value={pendentes.length} icon={Filter} variant="primary"
          onClick={() => {
            const items = pendentes.map(c => ({ nome: c.descricao, data: c.data_vencimento || "", valor: formatCurrency(c.valor) }));
            setMetricDialog({ title: "Todas as Pendentes", items });
          }} />
      </div>

      {/* Calendário + Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Calendário */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" /> Calendário de Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d === selectedDate ? undefined : d); setPage(1); }}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              locale={ptBR}
              className="pointer-events-auto"
            />
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded border-2 border-warning" /> A pagar</div>
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded border-2" style={{ borderColor: "hsl(var(--chart-2))" }} /> A receber</div>
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded bg-destructive/15 border-2 border-destructive" /> Vencido</div>
            </div>

            {/* Resumo do dia selecionado */}
            {resumoDia && selectedDate && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} — {resumoDia.total} conta{resumoDia.total !== 1 ? "s" : ""}
                </p>
                {resumoDia.pagarQtd > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{resumoDia.pagarQtd}x A pagar</span>
                    <span className="font-medium text-destructive">- {formatCurrency(resumoDia.pagarValor)}</span>
                  </div>
                )}
                {resumoDia.receberQtd > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{resumoDia.receberQtd}x A receber</span>
                    <span className="font-medium text-chart-2">+ {formatCurrency(resumoDia.receberValor)}</span>
                  </div>
                )}
                {resumoDia.vencidosQtd > 0 && (
                  <p className="text-xs text-destructive font-medium">{resumoDia.vencidosQtd} vencido{resumoDia.vencidosQtd > 1 ? "s" : ""}</p>
                )}
              </div>
            )}

            {selectedDate && (
              <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => setSelectedDate(undefined)}>
                Limpar filtro de data
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">Contas a Pagar e Receber</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportarPDF} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button size="sm" onClick={openNew} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Nova Conta
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Input placeholder="Buscar..." value={filterSearch} onChange={e => { setFilterSearch(e.target.value); setPage(1); }} className="w-40 h-8 text-sm" />
              <Select value={filterTipo} onValueChange={v => { setFilterTipo(v); setPage(1); }}>
                <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pagar">A Pagar</SelectItem>
                  <SelectItem value="receber">A Receber</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
                <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  {showPagos && <SelectItem value="pago">Pago</SelectItem>}
                </SelectContent>
              </Select>
              <Select value={filterOrigem} onValueChange={v => { setFilterOrigem(v); setPage(1); }}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Origem</SelectItem>
                  {origensDisponiveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 ml-auto">
                <Switch checked={showPagos} onCheckedChange={v => { setShowPagos(v); setPage(1); }} id="show-pagos" />
                <Label htmlFor="show-pagos" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> Pagos
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
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                )}
                {paged.map((item) => {
                  const urgencia = getUrgencia(item.data_vencimento, item.status);
                  return (
                    <TableRow key={item.id} className={item.status === "vencido" ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <Badge variant={item.tipo === "pagar" ? "destructive" : "default"} className="text-xs">
                          {item.tipo === "pagar" ? "Pagar" : "Receber"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{item.origem}</span>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(item.data_vencimento)}</TableCell>
                      <TableCell>
                        {urgencia && (
                          <Badge variant={urgencia.variant} className="text-[10px] whitespace-nowrap">
                            {urgencia.label}
                          </Badge>
                        )}
                        {item.status === "pago" && <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[item.status] || "secondary"} className="text-xs">
                          {item.status === "pago" ? "Pago" : item.status === "vencido" ? "Vencido" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-sm text-right font-semibold", item.tipo === "pagar" ? "text-destructive" : "text-chart-2")}>
                        {item.tipo === "pagar" ? "- " : "+ "}{formatCurrency(item.valor)}
                      </TableCell>
                      <TableCell>
                        {item.id.startsWith("manual-") && item.status !== "pago" && (
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Marcar como pago"
                              onClick={() => setConfirmAction({ type: "pagar", id: item.id.replace("manual-", ""), descricao: item.descricao })}>
                              <Check className="h-3.5 w-3.5 text-chart-2" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar"
                              onClick={() => {
                                const original = contasManuais.find((m: any) => m.id === item.id.replace("manual-", ""));
                                if (original) openEdit(original);
                              }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir"
                              onClick={() => setConfirmAction({ type: "delete", id: item.id.replace("manual-", ""), descricao: item.descricao })}>
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
            <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={15} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>

      {/* Dialog nova/editar conta */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingConta ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valor *</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <Label>Data de Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Aluguel, Contador..." />
              </div>
              <div>
                <Label>Fornecedor</Label>
                <Input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="permuta">Permuta</SelectItem>
                    <SelectItem value="recorrencia_cartao">Recorrência no Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Conta Bancária</Label>
                <Select value={form.conta_bancaria_id} onValueChange={v => setForm(f => ({ ...f, conta_bancaria_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : editingConta ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de ações */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "delete" ? "Excluir conta" : "Marcar como pago"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "delete"
                ? `Tem certeza que deseja excluir "${confirmAction?.descricao}"? Esta ação não pode ser desfeita.`
                : `Confirma o pagamento de "${confirmAction?.descricao}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (confirmAction?.type === "delete") {
                  deleteMutation.mutate(confirmAction.id);
                } else if (confirmAction?.type === "pagar") {
                  markPaidMutation.mutate(confirmAction.id);
                }
                setConfirmAction(null);
              }}
            >
              {confirmAction?.type === "delete" ? "Excluir" : "Confirmar Pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MetricDetailDialog
        open={!!metricDialog}
        onOpenChange={(open) => { if (!open) setMetricDialog(null); }}
        title={metricDialog?.title || ""}
        items={metricDialog?.items || []}
      />
    </div>
  );
};
