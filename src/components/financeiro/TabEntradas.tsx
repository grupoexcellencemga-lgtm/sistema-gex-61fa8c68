import { useState, useEffect } from "react";
import { AvulsaFormDialog } from "./AvulsaFormDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isInMonth } from "@/components/MonthFilter";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/utils";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricDetailDialog, MetricDetailItem } from "@/components/MetricDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Clock, AlertTriangle, Loader2, Plus, Building2, Pencil, Trash2, GraduationCap, Download, UserPlus, CalendarDays, Receipt } from "lucide-react";
import { gerarReciboPagamento } from "@/lib/pdfUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";
import { statusVariant, formatDate, formatCurrency } from "./financeiroUtils";
import { useFormasPagamento, getFormaPagamentoLabel, isFormaCredito } from "@/hooks/useFormasPagamento";

export const TabEntradas = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const { data: formasPagamento = [] } = useFormasPagamento();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({
    aluno: "",
    produto: "",
    valor: "",
    forma: "",
    banco: "",
    vencimento: "",
    dataPgto: "",
    status: "",
  });

  const setFilter = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const [avulsaDialogOpen, setAvulsaDialogOpen] = useState(false);
  const [editingAvulsa, setEditingAvulsa] = useState<any>(null);

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ["pagamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, alunos(nome), produtos(nome), contas_bancarias(nome), matriculas(turma_id, turmas(nome))")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: receitasAvulsas = [], isLoading: isLoadingAvulsas } = useQuery({
    queryKey: ["receitas_avulsas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas_avulsas")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });

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

  const { data: categoriasReceita = [] } = useQuery({
    queryKey: ["categorias_despesas_receita"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_despesas")
        .select("*")
        .eq("tipo", "receita")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  // Participantes de eventos (pagos)
  const { data: participantesEventos = [] } = useQuery({
    queryKey: ["participantes_eventos_entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participantes_eventos")
        .select("id, nome, valor, data_pagamento, status_pagamento, forma_pagamento, conta_bancaria_id, evento_id, eventos(nome, data, produto_id, turma_id), contas_bancarias(nome)")
        .eq("status_pagamento", "pago")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Processos individuais + lançamentos
  const { data: processosIndividuais = [] } = useQuery({
    queryKey: ["processos_individuais_entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("id, cliente_nome, responsavel, percentual_empresa, percentual_profissional, valor_total, status, conta_bancaria_id, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["pagamentos_processo_entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Processos empresariais + lançamentos
  const { data: processosEmpresariais = [] } = useQuery({
    queryKey: ["processos_empresariais_entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais")
        .select("id, empresa_nome, responsavel, percentual_empresa, percentual_profissional, valor_total, status, conta_bancaria_id, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcessoEmpresarial = [] } = useQuery({
    queryKey: ["pagamentos_processo_empresarial_entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const saveAvulsa = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        descricao: form.descricao,
        valor: Number(form.valor),
        data: form.data,
        categoria: form.categoria || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        forma_pagamento: form.forma_pagamento || null,
        observacoes: form.observacoes || null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("receitas_avulsas")
          .update(payload)
          .eq("id", form.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("receitas_avulsas")
          .insert(payload);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas_avulsas"] });
      queryClient.invalidateQueries({ queryKey: ["receitas_avulsas_por_conta"] });
      setAvulsaDialogOpen(false);
      setEditingAvulsa(null);
      toast({ title: "Entrada avulsa salva com sucesso" });
    },
    onError: () =>
      toast({
        title: "Erro ao salvar entrada",
        variant: "destructive",
      }),
  });

  const deleteAvulsa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("receitas_avulsas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receitas_avulsas"] });
      queryClient.invalidateQueries({ queryKey: ["receitas_avulsas_por_conta"] });
      toast({ title: "Entrada avulsa excluída" });
    },
  });

  // ── Edit pagamento aluno ──
  const [editingPagamento, setEditingPagamento] = useState<any>(null);
  const [editPagamentoOpen, setEditPagamentoOpen] = useState(false);

  const savePagamento = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase
        .from("pagamentos")
        .update({
          data_pagamento: form.data_pagamento || null,
          data_vencimento: form.data_vencimento || null,
          valor: Number(form.valor),
          forma_pagamento: form.forma_pagamento || null,
          conta_bancaria_id: form.conta_bancaria_id || null,
          status: form.status,
        })
        .eq("id", form.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos"] });
      setEditPagamentoOpen(false);
      setEditingPagamento(null);
      toast({ title: "Pagamento atualizado" });
    },
    onError: () =>
      toast({
        title: "Erro ao atualizar",
        variant: "destructive",
      }),
  });

  // ── Edit pagamento processo ──
  const [editingProcPag, setEditingProcPag] = useState<any>(null);
  const [editProcPagOpen, setEditProcPagOpen] = useState(false);

  const saveProcPag = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase
        .from("pagamentos_processo")
        .update({
          data: form.data,
          valor: Number(form.valor),
          forma_pagamento: form.forma_pagamento || null,
          conta_bancaria_id: form.conta_bancaria_id || null,
        })
        .eq("id", form.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_entradas"] });
      setEditProcPagOpen(false);
      setEditingProcPag(null);
      toast({ title: "Lançamento atualizado" });
    },
    onError: () =>
      toast({
        title: "Erro ao atualizar",
        variant: "destructive",
      }),
  });

  // ── Edit participante evento ──
  const [editingEvtPag, setEditingEvtPag] = useState<any>(null);
  const [editEvtPagOpen, setEditEvtPagOpen] = useState(false);

  const saveEvtPag = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase
        .from("participantes_eventos")
        .update({
          data_pagamento: form.data_pagamento || null,
          valor: Number(form.valor),
          forma_pagamento: form.forma_pagamento || null,
          conta_bancaria_id: form.conta_bancaria_id || null,
        })
        .eq("id", form.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participantes_eventos_entradas"] });
      setEditEvtPagOpen(false);
      setEditingEvtPag(null);
      toast({ title: "Entrada de evento atualizada" });
    },
    onError: () =>
      toast({
        title: "Erro ao atualizar",
        variant: "destructive",
      }),
  });

  const handleAvulsaSubmit = (form: any) => {
    saveAvulsa.mutate(form);
  };

  const renderFormaPagamentoOptions = () => (
    <>
      <option value="">Selecione</option>
      {formasPagamento.map((forma) => (
        <option key={forma.id} value={forma.codigo}>
          {forma.nome}
        </option>
      ))}
    </>
  );

  const inMonth = (d: string | null | undefined) => isInMonth(d, mes, ano);

  const filtered = pagamentos
    .filter((p: any) => inMonth(p.data_pagamento) || inMonth(p.data_vencimento))
    .filter((p: any) => {
      const match = (val: string, filter: string) =>
        !filter.trim() || val.toLowerCase().includes(filter.toLowerCase());

      return (
        match(p.alunos?.nome || "", filters.aluno) &&
        match(p.produtos?.nome || "", filters.produto) &&
        match(formatCurrency(Number(p.valor)), filters.valor) &&
        match(getFormaPagamentoLabel(p.forma_pagamento, formasPagamento), filters.forma) &&
        match((p as any).contas_bancarias?.nome || "", filters.banco) &&
        match(formatDate(p.data_vencimento), filters.vencimento) &&
        match(formatDate(p.data_pagamento), filters.dataPgto) &&
        match(p.status || "", filters.status)
      );
    });

  const pagMes = pagamentos.filter((p: any) => inMonth(p.data_pagamento) || inMonth(p.data_vencimento));
  const receitasAvulsasMes = receitasAvulsas.filter((r: any) => inMonth(r.data));
  const participantesEventosMes = participantesEventos.filter((p: any) => inMonth(p.data_pagamento) || inMonth((p as any).eventos?.data));
  const pagamentosProcessoMes = pagamentosProcesso.filter((p: any) => inMonth(p.data));
  const pagamentosProcessoEmpresarialMes = pagamentosProcessoEmpresarial.filter((p: any) => inMonth(p.data));

  const totalPago = pagMes
    .filter((p: any) => p.status === "pago")
    .reduce((s: number, p: any) => s + Number(p.valor), 0);

  const totalAvulsas = receitasAvulsasMes.reduce((s: number, r: any) => s + Number(r.valor), 0);

  const totalPendente = pagMes
    .filter((p: any) => p.status === "pendente")
    .reduce((s: number, p: any) => s + Number(p.valor), 0);

  const hojeCalc = new Date().toISOString().split("T")[0];

  const totalVencido = pagMes
    .filter((p: any) => p.status === "pendente" && p.data_vencimento && p.data_vencimento < hojeCalc)
    .reduce((s: number, p: any) => s + Number(p.valor), 0);

  const totalProcessos = pagamentosProcessoMes.reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalProcessosEmpresariais = pagamentosProcessoEmpresarialMes.reduce((s: number, p: any) => s + Number(p.valor), 0);
  const totalEventos = participantesEventosMes.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

  const totalGeral =
    pagMes.reduce((s: number, p: any) => s + Number(p.valor), 0) +
    totalAvulsas +
    totalProcessos +
    totalProcessosEmpresariais +
    totalEventos;

  // Map processo_id -> processo info
  const processoMap: Record<string, any> = {};
  processosIndividuais.forEach((p: any) => {
    processoMap[p.id] = p;
  });

  const receitaMap: Record<string, number> = {};
  pagMes
    .filter((p: any) => p.status === "pago")
    .forEach((p: any) => {
      const nome = p.produtos?.nome || "Sem produto";
      receitaMap[nome] = (receitaMap[nome] || 0) + Number(p.valor);
    });

  if (totalAvulsas > 0) receitaMap["Entradas Avulsas"] = totalAvulsas;
  if (totalProcessos > 0) receitaMap["Processos Individuais"] = totalProcessos;
  if (totalEventos > 0) receitaMap["Eventos"] = totalEventos;

  const receitaProduto = Object.entries(receitaMap)
    .map(([produto, receita]) => ({ produto, receita }))
    .sort((a, b) => b.receita - a.receita);

  const hoje = new Date().toISOString().split("T")[0];
  const pgtosPendentesDetail = pagMes.filter((p: any) => p.status === "pendente");
  const pgtosVencidosDetail = pagMes.filter((p: any) => p.status === "pendente" && p.data_vencimento && p.data_vencimento < hoje);

  const [activeDialog, setActiveDialog] = useState<string | null>(null);

  const dialogItems: Record<string, { title: string; items: MetricDetailItem[] }> = {
    recebido: {
      title: "Recebido (Alunos)",
      items: pagMes
        .filter((p: any) => p.status === "pago")
        .map((p: any) => ({
          nome: p.alunos?.nome || "—",
          data: p.data_pagamento || "",
          valor: formatCurrency(Number(p.valor)),
        })),
    },
    avulsas: {
      title: "Entradas Avulsas",
      items: receitasAvulsasMes.map((r: any) => ({
        nome: r.descricao,
        data: r.data,
        valor: formatCurrency(Number(r.valor)),
      })),
    },
    processos: {
      title: "Proc. Individuais",
      items: pagamentosProcessoMes.map((p: any) => {
        const proc = processoMap[p.processo_id];

        return {
          nome: proc?.cliente_nome || "—",
          data: p.data,
          valor: formatCurrency(Number(p.valor)),
        };
      }),
    },
    empresariais: {
      title: "Proc. Empresariais",
      items: pagamentosProcessoEmpresarialMes.map((p: any) => ({
        nome: "Processo Empresarial",
        data: p.data,
        valor: formatCurrency(Number(p.valor)),
      })),
    },
    eventos: {
      title: "Eventos",
      items: participantesEventosMes.map((p: any) => ({
        nome: p.nome,
        data: p.data_pagamento || (p as any).eventos?.data || "",
        valor: formatCurrency(Number(p.valor || 0)),
      })),
    },
    total: {
      title: "Total Geral",
      items: [
        ...pagMes.map((p: any) => ({
          nome: `Aluno: ${p.alunos?.nome || "—"}`,
          data: p.data_pagamento || p.data_vencimento || "",
          valor: formatCurrency(Number(p.valor)),
        })),
        ...receitasAvulsasMes.map((r: any) => ({
          nome: `Avulsa: ${r.descricao}`,
          data: r.data,
          valor: formatCurrency(Number(r.valor)),
        })),
        ...pagamentosProcessoMes.map((p: any) => ({
          nome: `Processo: ${processoMap[p.processo_id]?.cliente_nome || "—"}`,
          data: p.data,
          valor: formatCurrency(Number(p.valor)),
        })),
        ...participantesEventosMes.map((p: any) => ({
          nome: `Evento: ${p.nome}`,
          data: p.data_pagamento || "",
          valor: formatCurrency(Number(p.valor || 0)),
        })),
      ],
    },
    pendentes: {
      title: "Pagamentos Pendentes",
      items: pgtosPendentesDetail.map((p: any) => ({
        nome: p.alunos?.nome || "—",
        data: p.data_vencimento || "",
        valor: formatCurrency(Number(p.valor)),
      })),
    },
    vencidos: {
      title: "Pagamentos Vencidos",
      items: pgtosVencidosDetail.map((p: any) => ({
        nome: p.alunos?.nome || "—",
        data: p.data_vencimento || "",
        valor: formatCurrency(Number(p.valor)),
      })),
    },
  };

  const currentDialog = activeDialog ? dialogItems[activeDialog] : null;

  return (
    <div className="space-y-6">
      <MetricDetailDialog
        open={!!activeDialog}
        onOpenChange={(o) => {
          if (!o) setActiveDialog(null);
        }}
        title={currentDialog?.title || ""}
        items={currentDialog?.items || []}
      />

      {/* Edit Pagamento Aluno Dialog */}
      <Dialog
        open={editPagamentoOpen}
        onOpenChange={(o) => {
          setEditPagamentoOpen(o);
          if (!o) setEditingPagamento(null);
        }}
      >
        <DialogContent className="max-w-md" key={editingPagamento?.id || "new-pag"}>
          <DialogHeader>
            <DialogTitle>Editar Pagamento</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const f: any = Object.fromEntries(fd.entries());
              f.id = editingPagamento?.id;
              savePagamento.mutate(f);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input name="valor" type="number" step="0.01" required defaultValue={editingPagamento?.valor || ""} />
              </div>

              <div>
                <Label>Status</Label>
                <select
                  name="status"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingPagamento?.status || "pendente"}
                >
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <div>
                <Label>Vencimento</Label>
                <Input name="data_vencimento" type="date" defaultValue={editingPagamento?.data_vencimento || ""} />
              </div>

              <div>
                <Label>Data Pgto</Label>
                <Input name="data_pagamento" type="date" defaultValue={editingPagamento?.data_pagamento || ""} />
              </div>

              <div>
                <Label>Forma</Label>
                <select
                  name="forma_pagamento"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingPagamento?.forma_pagamento || ""}
                >
                  {renderFormaPagamentoOptions()}
                </select>
              </div>

              <div>
                <Label>Banco</Label>
                <select
                  name="conta_bancaria_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingPagamento?.conta_bancaria_id || ""}
                >
                  <option value="">Selecione</option>
                  {contas.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={savePagamento.isPending}>
              {savePagamento.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Processo Pagamento Dialog */}
      <Dialog
        open={editProcPagOpen}
        onOpenChange={(o) => {
          setEditProcPagOpen(o);
          if (!o) setEditingProcPag(null);
        }}
      >
        <DialogContent className="max-w-md" key={editingProcPag?.id || "new-proc"}>
          <DialogHeader>
            <DialogTitle>Editar Lançamento</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const f: any = Object.fromEntries(fd.entries());
              f.id = editingProcPag?.id;
              saveProcPag.mutate(f);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input name="data" type="date" required defaultValue={editingProcPag?.data || ""} />
              </div>

              <div>
                <Label>Valor (R$)</Label>
                <Input name="valor" type="number" step="0.01" required defaultValue={editingProcPag?.valor || ""} />
              </div>

              <div>
                <Label>Forma</Label>
                <select
                  name="forma_pagamento"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingProcPag?.forma_pagamento || ""}
                >
                  {renderFormaPagamentoOptions()}
                </select>
              </div>

              <div>
                <Label>Banco</Label>
                <select
                  name="conta_bancaria_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingProcPag?.conta_bancaria_id || ""}
                >
                  <option value="">Selecione</option>
                  {contas.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saveProcPag.isPending}>
              {saveProcPag.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Evento Pagamento Dialog */}
      <Dialog
        open={editEvtPagOpen}
        onOpenChange={(o) => {
          setEditEvtPagOpen(o);
          if (!o) setEditingEvtPag(null);
        }}
      >
        <DialogContent className="max-w-md" key={editingEvtPag?.id || "new-evt"}>
          <DialogHeader>
            <DialogTitle>Editar Entrada de Evento</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const f: any = Object.fromEntries(fd.entries());
              f.id = editingEvtPag?.id;
              saveEvtPag.mutate(f);
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Pgto</Label>
                <Input name="data_pagamento" type="date" required defaultValue={editingEvtPag?.data_pagamento || ""} />
              </div>

              <div>
                <Label>Valor (R$)</Label>
                <Input name="valor" type="number" step="0.01" required defaultValue={editingEvtPag?.valor || ""} />
              </div>

              <div>
                <Label>Forma</Label>
                <select
                  name="forma_pagamento"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingEvtPag?.forma_pagamento || ""}
                >
                  {renderFormaPagamentoOptions()}
                </select>
              </div>

              <div>
                <Label>Banco</Label>
                <select
                  name="conta_bancaria_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={editingEvtPag?.conta_bancaria_id || ""}
                >
                  <option value="">Selecione</option>
                  {contas.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saveEvtPag.isPending}>
              {saveEvtPag.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-4">
        <MetricCard title="Recebido (Alunos)" value={formatCurrency(totalPago)} icon={DollarSign} variant="primary" onClick={() => setActiveDialog("recebido")} />
        <MetricCard title="Entradas Avulsas" value={formatCurrency(totalAvulsas)} icon={Building2} variant="success" onClick={() => setActiveDialog("avulsas")} />
        <MetricCard title="Proc. Individuais" value={formatCurrency(totalProcessos)} icon={UserPlus} variant="success" onClick={() => setActiveDialog("processos")} />
        <MetricCard title="Proc. Empresariais" value={formatCurrency(totalProcessosEmpresariais)} icon={Building2} variant="success" onClick={() => setActiveDialog("empresariais")} />
        <MetricCard title="Eventos" value={formatCurrency(totalEventos)} icon={CalendarDays} variant="success" onClick={() => setActiveDialog("eventos")} />
        <MetricCard title="Total Geral" value={formatCurrency(totalGeral)} icon={TrendingUp} variant="success" onClick={() => setActiveDialog("total")} />
        <MetricCard title="Pgtos Pendentes" value={formatCurrency(totalPendente)} icon={Clock} variant="warning" onClick={() => setActiveDialog("pendentes")} />
        <MetricCard title="Pgtos Vencidos" value={formatCurrency(totalVencido)} icon={AlertTriangle} variant="destructive" onClick={() => setActiveDialog("vencidos")} />
      </div>

      {receitaProduto.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Receita por Produto</CardTitle>
          </CardHeader>

          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={receitaProduto} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="produto" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: "8px", fontSize: "13px", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Entradas Avulsas da Empresa */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Entradas Avulsas da Empresa
            </CardTitle>

            <Dialog
              open={avulsaDialogOpen}
              onOpenChange={(o) => {
                setAvulsaDialogOpen(o);
                if (!o) setEditingAvulsa(null);
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingAvulsa(null);
                    setAvulsaDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Nova Entrada
                </Button>
              </DialogTrigger>

              <AvulsaFormDialog
                editingAvulsa={editingAvulsa}
                contas={contas}
                categoriasReceita={categoriasReceita}
                onSave={handleAvulsaSubmit}
                isSaving={saveAvulsa.isPending}
              />
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoadingAvulsas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {receitasAvulsasMes.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{formatDate(r.data)}</TableCell>
                    <TableCell className="font-medium text-sm">{r.descricao}</TableCell>
                    <TableCell className="text-sm">{r.categoria ? <Badge variant="outline">{r.categoria}</Badge> : "—"}</TableCell>
                    <TableCell className="text-sm">{(r as any).contas_bancarias?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{getFormaPagamentoLabel(r.forma_pagamento, formasPagamento)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-emerald-600">{formatCurrency(Number(r.valor))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingAvulsa(r);
                            setAvulsaDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteAvulsa.mutate(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {receitasAvulsasMes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nenhuma entrada avulsa neste mês
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Entradas de Processos Individuais */}
      {pagamentosProcessoMes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Entradas de Processos Individuais
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Parte Empresa</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pagamentosProcessoMes.map((p: any) => {
                  const processo = processoMap[p.processo_id];
                  const pctEmpresa = processo ? Number(processo.percentual_empresa || 50) : 50;

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{formatDate(p.data)}</TableCell>
                      <TableCell className="font-medium text-sm">{processo?.cliente_nome || "—"}</TableCell>
                      <TableCell className="text-sm">{processo?.responsavel || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{p.tipo === "entrada" ? "Entrada" : "Pagamento"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{getFormaPagamentoLabel(p.forma_pagamento, formasPagamento)}</TableCell>
                      <TableCell className="text-sm">{(p as any).contas_bancarias?.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-right font-semibold text-emerald-600">{formatCurrency(Number(p.valor))}</TableCell>
                      <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency((Number(p.valor) * pctEmpresa) / 100)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingProcPag(p);
                            setEditProcPagOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Entradas de Eventos */}
      {participantesEventosMes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Entradas de Eventos
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead>Participante</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {participantesEventosMes.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{formatDate(p.data_pagamento || (p as any).eventos?.data)}</TableCell>
                    <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                    <TableCell className="text-sm">{(p as any).eventos?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{getFormaPagamentoLabel(p.forma_pagamento, formasPagamento)}</TableCell>
                    <TableCell className="text-sm">{(p as any).contas_bancarias?.nome || "—"}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-emerald-600">{formatCurrency(Number(p.valor || 0))}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingEvtPag(p);
                          setEditEvtPagOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4" /> Pagamentos de Alunos
            </CardTitle>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCSV(
                  filtered.map((p: any) => ({
                    aluno: p.alunos?.nome || "",
                    produto: p.produtos?.nome || "",
                    valor: Number(p.valor).toFixed(2),
                    forma: getFormaPagamentoLabel(p.forma_pagamento, formasPagamento),
                    vencimento: formatDate(p.data_vencimento),
                    status: p.status,
                  })),
                  "pagamentos",
                  [
                    { key: "aluno", label: "Aluno" },
                    { key: "produto", label: "Produto" },
                    { key: "valor", label: "Valor" },
                    { key: "forma", label: "Forma" },
                    { key: "vencimento", label: "Vencimento" },
                    { key: "status", label: "Status" },
                  ]
                )
              }
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>

                <TableRow>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.aluno} onChange={(e) => setFilter("aluno", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.produto} onChange={(e) => setFilter("produto", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.valor} onChange={(e) => setFilter("valor", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1" />
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.forma} onChange={(e) => setFilter("forma", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.banco} onChange={(e) => setFilter("banco", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.vencimento} onChange={(e) => setFilter("vencimento", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.dataPgto} onChange={(e) => setFilter("dataPgto", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1">
                    <Input placeholder="Filtrar..." value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="h-7 text-xs" />
                  </TableHead>
                  <TableHead className="py-1" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {paginate(filtered, page, 20).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.alunos?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div>{p.produtos?.nome || "—"}</div>
                      {(p as any).matriculas?.turmas?.nome && (
                        <div className="text-xs text-muted-foreground">{(p as any).matriculas.turmas.nome}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatCurrency(Number(p.valor))}</TableCell>
                    <TableCell className="text-sm">
                      {isFormaCredito(p.forma_pagamento) && p.parcelas_cartao
                        ? `1/1 (${p.parcelas_cartao}x no crédito)`
                        : `${p.parcela_atual || 1}/${p.parcelas || 1}`}
                    </TableCell>
                    <TableCell className="text-sm">{getFormaPagamentoLabel(p.forma_pagamento, formasPagamento)}</TableCell>
                    <TableCell className="text-sm">{(p as any).contas_bancarias?.nome || "—"}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.data_vencimento)}</TableCell>
                    <TableCell className="text-sm">{formatDate(p.data_pagamento)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] || "outline"}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.status === "pago" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Gerar Recibo"
                            onClick={() =>
                              gerarReciboPagamento({
                                alunoNome: p.alunos?.nome || "—",
                                alunoCpf: undefined,
                                produtoNome: p.produtos?.nome || "—",
                                valor: Number(p.valor),
                                dataPagamento: p.data_pagamento ? new Date(p.data_pagamento + "T12:00").toLocaleDateString("pt-BR") : undefined,
                                formaPagamento: getFormaPagamentoLabel(p.forma_pagamento, formasPagamento),
                                parcela: p.parcelas > 1 ? `${p.parcela_atual}/${p.parcelas}` : undefined,
                                reciboId: p.id,
                              })
                            }
                          >
                            <Receipt className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingPagamento(p);
                            setEditPagamentoOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
};
