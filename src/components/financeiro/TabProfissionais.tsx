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
import { DollarSign, Loader2, Pencil, Trash2, UserCheck, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";

export const TabProfissionais = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const [expandedProf, setExpandedProf] = useState<string | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [pgForm, setPgForm] = useState({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });
  const [showPgForm, setShowPgForm] = useState<string | null>(null); // processo_id
  const [editingPgProf, setEditingPgProf] = useState<any | null>(null); // pagamento being edited

  const { data: profissionais = [], isLoading } = useQuery({
    queryKey: ["profissionais-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profissionais").select("*").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: processos = [] } = useQuery({
    queryKey: ["processos-financeiro-prof"],
    queryFn: async () => {
      const { data, error } = await supabase.from("processos_individuais").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcesso = [] } = useQuery({
    queryKey: ["pagamentos_processo_financeiro_prof"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_processo").select("*, contas_bancarias(nome)").is("deleted_at", null).order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProf = [] } = useQuery({
    queryKey: ["pagamentos_profissional"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos_profissional").select("*, contas_bancarias(nome)").is("deleted_at", null).order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias_prof"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const pagarProfMutation = useMutation({
    mutationFn: async ({ profissional_id, processo_id, profNome, clienteNome }: { profissional_id: string; processo_id: string; profNome: string; clienteNome: string }) => {
      const valor = parseCurrencyToNumber(pgForm.valor);
      if (valor <= 0) throw new Error("Valor inválido");

      // 1. Find or create "Pagamento Profissional" category
      let categoriaId: string | null = null;
      const { data: catExist } = await supabase.from("categorias_despesas").select("id").eq("nome", "Pagamento Profissional").maybeSingle();
      if (catExist) {
        categoriaId = catExist.id;
      } else {
        const newCatId = crypto.randomUUID();
        await supabase.from("categorias_despesas").insert({ id: newCatId, nome: "Pagamento Profissional", tipo: "profissional" });
        categoriaId = newCatId;
      }

      // 2. Create despesa
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
      });
      if (despError) throw despError;

      // 2. Create pagamento_profissional record
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
      queryClient.invalidateQueries({ queryKey: ["pagamentos_profissional"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      toast({ title: "Pagamento ao profissional registrado e despesa criada!" });
      setPgForm({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });
      setShowPgForm(null);
    },
    onError: () => toast({ title: "Erro ao registrar pagamento", variant: "destructive" }),
  });

  const deletePgProfMutation = useMutation({
    mutationFn: async (pg: any) => {
      if (pg.despesa_id) {
        await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", pg.despesa_id);
      }
      const { error } = await supabase.from("pagamentos_profissional").update({ deleted_at: new Date().toISOString() }).eq("id", pg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos_profissional"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      toast({ title: "Pagamento removido" });
    },
  });

  const editPgProfMutation = useMutation({
    mutationFn: async ({ pg, profNome, clienteNome }: { pg: any; profNome: string; clienteNome: string }) => {
      const valor = parseCurrencyToNumber(pgForm.valor);
      if (valor <= 0) throw new Error("Valor inválido");

      // Update pagamento_profissional
      const { error } = await supabase.from("pagamentos_profissional").update({
        valor,
        data: pgForm.data,
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        observacoes: pgForm.obs.trim() || null,
      }).eq("id", pg.id);
      if (error) throw error;

      // Update linked despesa if exists
      if (pg.despesa_id) {
        await supabase.from("despesas").update({
          descricao: `Pagamento profissional: ${profNome} — Cliente: ${clienteNome}`,
          valor,
          data: pgForm.data,
          forma_pagamento: pgForm.forma || null,
          conta_bancaria_id: pgForm.conta_id || null,
          observacoes: pgForm.obs.trim() || null,
        }).eq("id", pg.despesa_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos_profissional"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      toast({ title: "Pagamento atualizado!" });
      setEditingPgProf(null);
      setPgForm({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });
      setShowPgForm(null);
    },
    onError: () => toast({ title: "Erro ao atualizar pagamento", variant: "destructive" }),
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

  const parseCurrencyToNumber = (v: string): number => {
    const clean = v.replace(/[^\d,]/g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  const pgProcMes = pagamentosProcesso.filter((pg: any) => isInMonth(pg.data, mes, ano));
  const pgProfMes = pagamentosProf.filter((pg: any) => isInMonth(pg.data, mes, ano));

  const getProcessosPorProf = (profId: string, profNome: string) => {
    return processos.filter((p: any) => p.profissional_id === profId || p.responsavel === profNome);
  };

  const getProfTotals = (profId: string, profNome: string) => {
    const procs = getProcessosPorProf(profId, profNome);
    const procIds = new Set(procs.map((p: any) => p.id));
    const pagamentos = pgProcMes.filter((pg: any) => procIds.has(pg.processo_id));
    const totalRecebido = pagamentos.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
    const totalJaPago = pgProfMes.filter((pg: any) => pg.profissional_id === profId).reduce((s: number, pg: any) => s + Number(pg.valor), 0);

    const totalProfissional = procs.reduce((s: number, p: any) => {
      const pgtsProcesso = pagamentos.filter((pg: any) => pg.processo_id === p.id);
      const recebidoProcesso = pgtsProcesso.reduce((sum: number, pg: any) => sum + Number(pg.valor), 0);
      return s + (recebidoProcesso * Number(p.percentual_profissional || 50)) / 100;
    }, 0);

    const totalEmpresa = procs.reduce((s: number, p: any) => {
      const pgtsProcesso = pagamentos.filter((pg: any) => pg.processo_id === p.id);
      const recebidoProcesso = pgtsProcesso.reduce((sum: number, pg: any) => sum + Number(pg.valor), 0);
      return s + (recebidoProcesso * Number(p.percentual_empresa || 50)) / 100;
    }, 0);

    return { totalRecebido, totalProfissional, totalEmpresa, totalJaPago, saldoDevedor: totalProfissional - totalJaPago };
  };

  const getClienteData = (processoId: string, profId: string) => {
    const processo = processos.find((p: any) => p.id === processoId);
    if (!processo) return null;
    const pgts = pgProcMes.filter((pg: any) => pg.processo_id === processoId);
    const recebido = pgts.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
    const parteProf = (recebido * Number(processo.percentual_profissional || 50)) / 100;
    const parteEmpresa = (recebido * Number(processo.percentual_empresa || 50)) / 100;
    const pgsProfCliente = pgProfMes.filter((pg: any) => pg.processo_id === processoId && pg.profissional_id === profId);
    const totalPagoProf = pgsProfCliente.reduce((s: number, pg: any) => s + Number(pg.valor), 0);
    return { processo, pgts, recebido, parteProf, parteEmpresa, pgsProfCliente, totalPagoProf, saldoDevedor: parteProf - totalPagoProf };
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : profissionais.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum profissional cadastrado. Acesse a aba Profissionais no menu para cadastrar.</CardContent></Card>
      ) : (
        profissionais.map((prof: any) => {
          const isExpanded = expandedProf === prof.id;
          const procs = getProcessosPorProf(prof.id, prof.nome);
          const totals = isExpanded ? getProfTotals(prof.id, prof.nome) : null;

          return (
            <Card key={prof.id} className="overflow-hidden">
              <button
                onClick={() => { setExpandedProf(isExpanded ? null : prof.id); setExpandedCliente(null); setShowPgForm(null); }}
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
                      <p className="text-xs text-muted-foreground">Total Recebido</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(totals.totalRecebido)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Parte Empresa</p>
                      <p className="font-bold text-sm text-primary">{formatCurrency(totals.totalEmpresa)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Parte Profissional</p>
                      <p className="font-bold text-sm text-orange-600">{formatCurrency(totals.totalProfissional)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Já Pago</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(totals.totalJaPago)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Saldo Devedor</p>
                      <p className={`font-bold text-sm ${totals.saldoDevedor > 0 ? "text-destructive" : "text-emerald-600"}`}>{formatCurrency(totals.saldoDevedor)}</p>
                    </div>
                  </div>

                  {procs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum processo vinculado</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Clientes</p>
                      {procs.map((proc: any) => {
                        const isClienteExpanded = expandedCliente === proc.id;
                        const clienteData = isClienteExpanded ? getClienteData(proc.id, prof.id) : null;
                        const pgtsPreview = pagamentosProcesso.filter((pg: any) => pg.processo_id === proc.id);
                        const recebidoPreview = pgtsPreview.reduce((s: number, pg: any) => s + Number(pg.valor), 0);

                        return (
                          <Card key={proc.id} className="border">
                            <button
                              onClick={() => { setExpandedCliente(isClienteExpanded ? null : proc.id); setShowPgForm(null); }}
                              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-bold text-primary">{proc.cliente_nome?.charAt(0)?.toUpperCase()}</span>
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{proc.cliente_nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatCurrency(Number(proc.valor_total || 0))} · Recebido: {formatCurrency(recebidoPreview)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={proc.status === "aberto" ? "default" : proc.status === "finalizado" ? "secondary" : "destructive"}>
                                  {proc.status === "aberto" ? "Aberto" : proc.status === "finalizado" ? "Finalizado" : proc.status === "cancelado" ? "Cancelado" : proc.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{isClienteExpanded ? "▲" : "▼"}</span>
                              </div>
                            </button>

                            {isClienteExpanded && clienteData && (
                              <CardContent className="pt-0 space-y-4">
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Valor Total</p>
                                    <p className="font-bold text-sm">{formatCurrency(Number(clienteData.processo.valor_total || 0))}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Recebido</p>
                                    <p className="font-bold text-sm text-emerald-600">{formatCurrency(clienteData.recebido)}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Parte Prof. ({clienteData.processo.percentual_profissional}%)</p>
                                    <p className="font-bold text-sm text-orange-600">{formatCurrency(clienteData.parteProf)}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Já Pago ao Prof.</p>
                                    <p className="font-bold text-sm text-emerald-600">{formatCurrency(clienteData.totalPagoProf)}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/50 p-3">
                                    <p className="text-xs text-muted-foreground">Falta Pagar</p>
                                    <p className={`font-bold text-sm ${clienteData.saldoDevedor > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                      {formatCurrency(clienteData.saldoDevedor)}
                                    </p>
                                  </div>
                                </div>

                                {/* Botão pagar profissional */}
                                {(clienteData.saldoDevedor > 0 || showPgForm === proc.id) && (
                                  <div>
                                    {showPgForm === proc.id ? (
                                      <Card className="border-primary">
                                        <CardHeader className="pb-2">
                                          <div className="flex items-center justify-between">
                                            <CardTitle className="text-sm">{editingPgProf ? "Editar Pagamento" : "Registrar Pagamento ao Profissional"}</CardTitle>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowPgForm(null); setEditingPgProf(null); }}>
                                              <X className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs">Valor (R$)</Label>
                                              <Input
                                                value={pgForm.valor}
                                                onChange={(e) => setPgForm(f => ({ ...f, valor: formatCurrencyInput(e.target.value) }))}
                                                placeholder="0,00"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs">Data</Label>
                                              <Input type="date" value={pgForm.data} onChange={(e) => setPgForm(f => ({ ...f, data: e.target.value }))} />
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs">Forma</Label>
                                              <Select value={pgForm.forma} onValueChange={(v) => setPgForm(f => ({ ...f, forma: v }))}>
                                                <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="pix">PIX</SelectItem>
                                                  <SelectItem value="transferencia">Transferência</SelectItem>
                                                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                  <SelectItem value="cartao">Cartão</SelectItem>
                                                  <SelectItem value="boleto">Boleto</SelectItem>
                                                  <SelectItem value="cheque">Cheque</SelectItem>
                                                  <SelectItem value="permuta">Permuta</SelectItem>
                                                  <SelectItem value="recorrencia_cartao">Recorrência no Cartão</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                            <div className="space-y-1">
                                              <Label className="text-xs">Conta</Label>
                                              <Select value={pgForm.conta_id} onValueChange={(v) => setPgForm(f => ({ ...f, conta_id: v }))}>
                                                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                                                <SelectContent>
                                                  {contas.map((c: any) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                              <Label className="text-xs">Observação</Label>
                                              <Input value={pgForm.obs} onChange={(e) => setPgForm(f => ({ ...f, obs: e.target.value }))} placeholder="Ex: transferência parcial" />
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
                                                {(pagarProfMutation.isPending || editPgProfMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4 mr-1" />}
                                                {editingPgProf ? "Salvar Alterações" : "Registrar Pagamento"}
                                              </Button>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setPgForm({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });
                                          setShowPgForm(proc.id);
                                        }}
                                      >
                                        <DollarSign className="h-4 w-4 mr-1" /> Pagar Profissional
                                      </Button>
                                    )}
                                  </div>
                                )}

                                {/* Histórico de pagamentos ao profissional */}
                                {clienteData.pgsProfCliente.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Pagamentos ao Profissional</p>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Data</TableHead>
                                          <TableHead>Forma</TableHead>
                                          <TableHead>Conta</TableHead>
                                          <TableHead>Obs</TableHead>
                                          <TableHead className="text-right">Valor</TableHead>
                                          <TableHead className="w-20" />
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {clienteData.pgsProfCliente.map((pg: any) => (
                                          <TableRow key={pg.id}>
                                            <TableCell className="text-sm">{formatDate(pg.data)}</TableCell>
                                            <TableCell className="text-sm">{pg.forma_pagamento || "—"}</TableCell>
                                            <TableCell className="text-sm">{(pg as any).contas_bancarias?.nome || "—"}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{pg.observacoes || "—"}</TableCell>
                                            <TableCell className="text-sm text-right font-semibold text-destructive">{formatCurrency(Number(pg.valor))}</TableCell>
                                            <TableCell>
                                              <div className="flex gap-1">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                                  setEditingPgProf(pg);
                                                  setPgForm({
                                                    valor: formatCurrencyInput(String(Math.round(Number(pg.valor) * 100))),
                                                    data: pg.data,
                                                    forma: pg.forma_pagamento || "",
                                                    conta_id: pg.conta_bancaria_id || "",
                                                    obs: pg.observacoes || "",
                                                  });
                                                  setShowPgForm(proc.id);
                                                }}>
                                                  <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                                  if (confirm("Remover este pagamento e a despesa vinculada?")) deletePgProfMutation.mutate(pg);
                                                }}>
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}

                                {/* Lançamentos recebidos do cliente */}
                                {clienteData.pgts.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Lançamentos Recebidos do Cliente</p>
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
                                        {clienteData.pgts.map((pg: any) => {
                                          const pctProf = Number(clienteData.processo.percentual_profissional || 50);
                                          return (
                                            <TableRow key={pg.id}>
                                              <TableCell className="text-sm">{formatDate(pg.data)}</TableCell>
                                              <TableCell className="text-sm">
                                                <Badge variant="outline">{pg.tipo === "entrada" ? "Entrada" : "Pagamento"}</Badge>
                                              </TableCell>
                                              <TableCell className="text-sm">{pg.forma_pagamento || "—"}</TableCell>
                                              <TableCell className="text-sm">{(pg as any).contas_bancarias?.nome || "—"}</TableCell>
                                              <TableCell className="text-sm text-right">{formatCurrency(Number(pg.valor))}</TableCell>
                                              <TableCell className="text-sm text-right text-orange-600 font-medium">{formatCurrency(Number(pg.valor) * pctProf / 100)}</TableCell>
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
