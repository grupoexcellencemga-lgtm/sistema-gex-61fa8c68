import { useState, useMemo } from "react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Loader2, UserCheck, Building2, DollarSign, TrendingUp, Download, Ban, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PaginationControls, paginate } from "@/components/Pagination";
import { useDataFilter } from "@/hooks/useDataFilter";
import { DetalhesProcessoDialog } from "@/components/processos/ProcessoDetailSheet";
import { parseCurrencyToNumber, formatCurrencyInput, formatCurrency, formatDate, formatCPF, formatPhone, statusMap, periodoLabels, getDateRange } from "@/components/processos/processosUtils";
import { ProcessoFormDialog, emptyProcessoIndForm, type ProcessoIndForm } from "@/components/processos/ProcessoFormDialog";
import { ProcessoTable } from "@/components/processos/ProcessoTable";
import { ProcessoFilters } from "@/components/processos/ProcessoFilters";

const ProcessoIndividual = () => {
  const queryClient = useQueryClient();
  useRealtimeSync("processos_individuais", [["processos_individuais"], ["dashboard-metrics"]]);
  useRealtimeSync("pagamentos_processo", [["pagamentos_processo"], ["processos_individuais"]]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterResponsavel, setFilterResponsavel] = useState("todos");
  const [page, setPage] = useState(1);
  const [tipoPagamento, setTipoPagamento] = useState<"entrada" | "total">("total");
  const [detalhesProcesso, setDetalhesProcesso] = useState<any>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelProcesso, setCancelProcesso] = useState<any>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [metricPeriodo, setMetricPeriodo] = useState("mes_atual");
  const [form, setForm] = useState<ProcessoIndForm>(emptyProcessoIndForm);

  const resetForm = () => { setForm({ ...emptyProcessoIndForm, data_inicio: new Date().toISOString().split("T")[0] }); setEditing(null); setTipoPagamento("total"); };
  const { filterByResponsavel } = useDataFilter();

  // ── Queries ──
  const { data: processosRaw = [], isLoading } = useQuery({ queryKey: ["processos_individuais"], queryFn: async () => { const { data, error } = await supabase.from("processos_individuais").select("*").is("deleted_at", null).order("created_at", { ascending: false }); if (error) throw error; return data; } });
  const processos = filterByResponsavel(processosRaw);
  const { data: alunos = [] } = useQuery({ queryKey: ["alunos-select"], queryFn: async () => { const { data } = await supabase.from("alunos").select("id, nome, cpf, telefone, email, data_nascimento").is("deleted_at", null).order("nome"); return data || []; } });
  const { data: profissionais = [] } = useQuery({ queryKey: ["profissionais-select"], queryFn: async () => { const { data } = await supabase.from("profissionais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome"); return data || []; } });
  const { data: comerciais = [] } = useQuery({ queryKey: ["comerciais-select"], queryFn: async () => { const { data } = await supabase.from("comerciais").select("id, nome").eq("ativo", true).is("deleted_at", null).order("nome"); return data || []; } });
  const { data: contas = [] } = useQuery({ queryKey: ["contas-select"], queryFn: async () => { const { data } = await supabase.from("contas_bancarias").select("id, nome, banco").is("deleted_at", null).eq("ativo", true).order("nome"); return data || []; } });
  const { data: todosPagamentos = [] } = useQuery({ queryKey: ["pagamentos_processo_all"], queryFn: async () => { const { data, error } = await supabase.from("pagamentos_processo").select("processo_id, valor, data, tipo, observacoes, taxa_cartao").is("deleted_at", null); if (error) throw error; return data || []; } });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const valorEntrada = Number(payload.valor_entrada || 0);
      const parcelas = Number(payload.parcelas || 1);
      const isCartao = payload.forma_pagamento === "cartao_credito" || payload.forma_pagamento === "cartao";
      const { taxa_cartao, ...processoPayload } = payload;
      const taxaCartao = isCartao ? (Number(taxa_cartao) || 0) : 0;
      const observacaoEntrada = isCartao && parcelas > 1 ? `Entrada registrada no cadastro do processo — ${parcelas}x no cartão` : "Entrada registrada no cadastro do processo";
      if (editing) {
        const { error } = await supabase.from("processos_individuais").update(processoPayload).eq("id", editing.id);
        if (error) throw error;
        const { data: lancamentosExistentes } = await supabase.from("pagamentos_processo").select("id, tipo, observacoes").eq("processo_id", editing.id).is("deleted_at", null);
        const entradaAutomatica = (lancamentosExistentes || []).find((l: any) => l.tipo === "entrada" && (l.observacoes || "").startsWith("Entrada registrada no cadastro do processo"));
        const temEntradaManual = (lancamentosExistentes || []).some((l: any) => l.tipo === "entrada" && !(l.observacoes || "").startsWith("Entrada registrada no cadastro do processo"));
        const payloadEntrada = { valor: valorEntrada, data: payload.data_inicio || new Date().toISOString().split("T")[0], forma_pagamento: payload.forma_pagamento || null, observacoes: observacaoEntrada, conta_bancaria_id: payload.conta_bancaria_id || null, taxa_cartao: taxaCartao > 0 ? taxaCartao : null };
        if (valorEntrada > 0) { if (entradaAutomatica) { await supabase.from("pagamentos_processo").update(payloadEntrada).eq("id", entradaAutomatica.id); } else if (!temEntradaManual) { await supabase.from("pagamentos_processo").insert({ processo_id: editing.id, tipo: "entrada", ...payloadEntrada }); } }
        else if (entradaAutomatica) { await supabase.from("pagamentos_processo").update({ deleted_at: new Date().toISOString() }).eq("id", entradaAutomatica.id); }
      } else {
        const { data, error } = await supabase.from("processos_individuais").insert(processoPayload).select("id").single();
        if (error) throw error;
        if (valorEntrada > 0) { await supabase.from("pagamentos_processo").insert({ processo_id: data.id, tipo: "entrada", valor: valorEntrada, data: payload.data_inicio || new Date().toISOString().split("T")[0], forma_pagamento: payload.forma_pagamento || null, observacoes: observacaoEntrada, conta_bancaria_id: payload.conta_bancaria_id || null, taxa_cartao: taxaCartao > 0 ? taxaCartao : null }); }
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["processos_individuais"] }); queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_all"] }); queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_financeiro"] }); queryClient.invalidateQueries({ queryKey: ["processos_individuais_financeiro"] }); queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] }); toast({ title: editing ? "Processo atualizado" : "Processo cadastrado" }); setDialogOpen(false); resetForm(); },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const sessaoMutation = useMutation({ mutationFn: async ({ id, sessoes_realizadas }: { id: string; sessoes_realizadas: number }) => { const { error } = await supabase.from("processos_individuais").update({ sessoes_realizadas }).eq("id", id); if (error) throw error; }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["processos_individuais"] }), onError: () => toast({ title: "Erro ao atualizar sessão", variant: "destructive" }) });
  const finalizarMutation = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.from("processos_individuais").update({ status: "finalizado", data_finalizacao: new Date().toISOString().split("T")[0] }).eq("id", id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["processos_individuais"] }); toast({ title: "Processo finalizado" }); }, onError: () => toast({ title: "Erro ao finalizar", variant: "destructive" }) });
  const deleteMutationProcesso = useMutation({ mutationFn: async (id: string) => { await supabase.from("pagamentos_processo").update({ deleted_at: new Date().toISOString() }).eq("processo_id", id); const { error } = await supabase.from("processos_individuais").update({ deleted_at: new Date().toISOString() }).eq("id", id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["processos_individuais"] }); queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_all"] }); toast({ title: "Processo excluído" }); }, onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }) });
  const cancelarMutation = useMutation({ mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => { const { error } = await supabase.from("processos_individuais").update({ status: "cancelado", motivo_cancelamento: motivo, data_finalizacao: new Date().toISOString().split("T")[0] }).eq("id", id); if (error) throw error; }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["processos_individuais"] }); toast({ title: "Processo cancelado" }); setCancelDialogOpen(false); setCancelProcesso(null); setMotivoCancelamento(""); }, onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }) });

  // ── Handlers ──
  const handleSave = () => {
    if (!form.cliente_nome.trim() || !form.responsavel.trim()) { toast({ title: "Preencha nome do cliente e responsável", variant: "destructive" }); return; }
    const valorTotal = parseCurrencyToNumber(form.valor_total);
    const valorEntradaFinal = tipoPagamento === "total" ? valorTotal : (parseCurrencyToNumber(form.valor_entrada) || 0);
    saveMutation.mutate({ cliente_nome: form.cliente_nome.trim(), cliente_email: form.cliente_email.trim() || null, cliente_telefone: form.cliente_telefone.trim() || null, cpf: form.cpf.replace(/\D/g, "") || null, data_nascimento: form.data_nascimento || null, aluno_id: form.aluno_id || null, responsavel: form.responsavel.trim(), percentual_empresa: form.percentual_empresa, percentual_profissional: form.percentual_profissional, valor_total: valorTotal, valor_entrada: valorEntradaFinal, parcelas: Number(form.parcelas) || 1, sessoes: Number(form.sessoes) || 1, status: form.status, conta_bancaria_id: form.conta_bancaria_id || null, forma_pagamento: form.forma_pagamento || null, observacoes: form.observacoes.trim() || null, data_inicio: form.data_inicio || null, comercial_id: form.comercial_id || null, percentual_comissao: Number(form.percentual_comissao) || 5, taxa_cartao: (form.forma_pagamento === "cartao_credito" || form.forma_pagamento === "cartao") ? (parseFloat(form.taxa_cartao) || 0) : 0 });
  };

  const openEdit = (p: any) => {
    setEditing(p);
    const entradaAutomatica = todosPagamentos.find((pg: any) => pg.processo_id === p.id && pg.tipo === "entrada" && (pg.observacoes || "").startsWith("Entrada registrada no cadastro do processo"));
    setForm({ cliente_nome: p.cliente_nome, cliente_email: p.cliente_email || "", cliente_telefone: p.cliente_telefone ? formatPhone(p.cliente_telefone) : "", cpf: p.cpf ? formatCPF(p.cpf) : "", data_nascimento: p.data_nascimento || "", aluno_id: p.aluno_id || "", responsavel: p.responsavel, percentual_empresa: p.percentual_empresa, percentual_profissional: p.percentual_profissional, valor_total: p.valor_total ? formatCurrencyInput(String(Math.round(Number(p.valor_total) * 100))) : "", valor_entrada: p.valor_entrada ? formatCurrencyInput(String(Math.round(Number(p.valor_entrada) * 100))) : "", parcelas: String(p.parcelas), sessoes: String(p.sessoes || 1), status: p.status, conta_bancaria_id: p.conta_bancaria_id || "", forma_pagamento: p.forma_pagamento || "", observacoes: p.observacoes || "", data_inicio: p.data_inicio || "", comercial_id: p.comercial_id || "", percentual_comissao: String(p.percentual_comissao ?? 5), taxa_cartao: entradaAutomatica?.taxa_cartao ? String(entradaAutomatica.taxa_cartao) : "" });
    setTipoPagamento(Number(p.valor_entrada || 0) > 0 && Number(p.valor_entrada || 0) < Number(p.valor_total || 0) ? "entrada" : "total");
    setDialogOpen(true);
  };

  // ── Derived data ──
  const responsaveis = useMemo(() => Array.from(new Set(processos.map((p: any) => p.responsavel))).sort(), [processos]);
  const filtered = processos.filter((p: any) => { const s = search.toLowerCase(); return (p.cliente_nome.toLowerCase().includes(s) || p.responsavel.toLowerCase().includes(s)) && (filterStatus === "todos" || p.status === filterStatus) && (filterResponsavel === "todos" || p.responsavel === filterResponsavel); });
  const pageSize = 10;
  const paginatedItems = paginate(filtered, page, pageSize);
  const abertos = processos.filter((p: any) => p.status === "aberto");
  const dateRange = getDateRange(metricPeriodo);
  const pagamentosFiltered = useMemo(() => !dateRange ? todosPagamentos : todosPagamentos.filter((pg: any) => pg.data >= dateRange.start && pg.data <= dateRange.end), [todosPagamentos, metricPeriodo]);
  const pagamentosPorProcesso = useMemo(() => { const m: Record<string, number> = {}; pagamentosFiltered.forEach((pg: any) => { m[pg.processo_id] = (m[pg.processo_id] || 0) + Number(pg.valor || 0); }); return m; }, [pagamentosFiltered]);
  const pagamentosTotalPorProcesso = useMemo(() => { const m: Record<string, number> = {}; todosPagamentos.forEach((pg: any) => { m[pg.processo_id] = (m[pg.processo_id] || 0) + Number(pg.valor || 0); }); return m; }, [todosPagamentos]);
  const totalEntrada = abertos.reduce((s: number, p: any) => s + (pagamentosPorProcesso[p.id] || 0), 0);
  const totalEmpresa = abertos.reduce((s: number, p: any) => s + ((pagamentosPorProcesso[p.id] || 0) * Number(p.percentual_empresa || 0)) / 100, 0);
  const totalAEntrar = abertos.reduce((s: number, p: any) => s + Math.max(0, Number(p.valor_total || 0) - (pagamentosTotalPorProcesso[p.id] || 0)), 0);
  const valorNumerico = parseCurrencyToNumber(form.valor_total);

  const handleExportCSV = () => {
    const header = ["Cliente", "CPF", "Responsável", "Divisão", "Valor Total", "Total Recebido", "Restante", "Sessões Realizadas", "Sessões Total", "Status", "Início", "Finalização"];
    const rows = filtered.map((p: any) => { const recebido = pagamentosTotalPorProcesso[p.id] || 0; return [p.cliente_nome, p.cpf ? formatCPF(p.cpf) : "", p.responsavel, `${p.percentual_empresa}% / ${p.percentual_profissional}%`, Number(p.valor_total || 0).toFixed(2).replace(".", ","), recebido.toFixed(2).replace(".", ","), Math.max(0, Number(p.valor_total || 0) - recebido).toFixed(2).replace(".", ","), p.sessoes_realizadas || 0, p.sessoes || 1, statusMap[p.status]?.label || p.status, p.data_inicio ? formatDate(p.data_inicio) : "", p.data_finalizacao ? formatDate(p.data_finalizacao) : ""].join(";"); });
    const csv = "\uFEFF" + [header.join(";"), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `processos_individuais_${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Processo Individual" description="Gestão de processos individuais com divisão de receita" />

      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Métricas de Entradas</h3>
          <Select value={metricPeriodo} onValueChange={setMetricPeriodo}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes_atual">Mês Atual</SelectItem><SelectItem value="mes_passado">Mês Passado</SelectItem>
              <SelectItem value="trimestre">Últimos 3 Meses</SelectItem><SelectItem value="semestre">Últimos 6 Meses</SelectItem>
              <SelectItem value="ano_atual">Ano Atual</SelectItem><SelectItem value="todos">Todo Período</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Processos Abertos" value={abertos.length} icon={UserCheck} />
          <MetricCard title={`Recebido (${periodoLabels[metricPeriodo]})`} value={formatCurrency(totalEntrada)} icon={DollarSign} />
          <MetricCard title={`Empresa (${periodoLabels[metricPeriodo]})`} value={formatCurrency(totalEmpresa)} icon={Building2} />
          <MetricCard title="Valor que Irá Entrar" value={formatCurrency(totalAEntrar)} icon={TrendingUp} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <ProcessoFilters search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} filterStatus={filterStatus} onFilterStatusChange={(v) => { setFilterStatus(v); setPage(1); }} filterResponsavel={filterResponsavel} onFilterResponsavelChange={(v) => { setFilterResponsavel(v); setPage(1); }} responsaveis={responsaveis} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> Exportar</Button>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo Processo</Button>
        </div>
      </div>

      <ProcessoFormDialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }} form={form} setForm={setForm} onSubmit={handleSave} isPending={saveMutation.isPending} isEditing={!!editing} tipoPagamento={tipoPagamento} setTipoPagamento={setTipoPagamento} alunos={alunos} profissionais={profissionais} comerciais={comerciais} contas={contas} valorNumerico={valorNumerico} />

      <ProcessoTable processos={paginatedItems} pagamentosTotalPorProcesso={pagamentosTotalPorProcesso} onSelect={setDetalhesProcesso} onEdit={openEdit} onDelete={(id) => deleteMutationProcesso.mutate(id)} onFinalize={(id) => finalizarMutation.mutate(id)} onCancel={(p) => { setCancelProcesso(p); setCancelDialogOpen(true); }} onSessao={(id, v) => sessaoMutation.mutate({ id, sessoes_realizadas: v })} contas={contas} />

      <PaginationControls currentPage={page} totalItems={filtered.length} pageSize={pageSize} onPageChange={setPage} />

      {detalhesProcesso && <DetalhesProcessoDialog processo={detalhesProcesso} onClose={() => setDetalhesProcesso(null)} />}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(o) => { setCancelDialogOpen(o); if (!o) { setCancelProcesso(null); setMotivoCancelamento(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cancelar Processo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Tem certeza que deseja cancelar o processo de <strong>{cancelProcesso?.cliente_nome}</strong>?</p>
            <div className="space-y-2"><Label>Motivo do Cancelamento</Label><Textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} placeholder="Descreva o motivo do cancelamento..." rows={3} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCancelDialogOpen(false); setCancelProcesso(null); setMotivoCancelamento(""); }}>Voltar</Button>
              <Button variant="destructive" disabled={cancelarMutation.isPending} onClick={() => { if (cancelProcesso) cancelarMutation.mutate({ id: cancelProcesso.id, motivo: motivoCancelamento }); }}>
                {cancelarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}Confirmar Cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessoIndividual;
