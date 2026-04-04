import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBrazilNow } from "@/components/MonthFilter";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Building2, Receipt, Pencil, Trash2, Download, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "./financeiroUtils";

export const TabFechamento = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConta, setEditingConta] = useState<any>(null);
  const [expandedConta, setExpandedConta] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [fechamentoLoading, setFechamentoLoading] = useState<string | null>(null);

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ["contas_bancarias_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Pagamentos de alunos (entradas)
  const { data: pagamentosPorConta = [] } = useQuery({
    queryKey: ["pagamentos_por_conta_detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("conta_bancaria_id, valor, status, data_pagamento, forma_pagamento, alunos(nome), produtos(nome)")
        .eq("status", "pago")
        .not("conta_bancaria_id", "is", null)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // Despesas (saídas)
  const { data: despesasPorConta = [] } = useQuery({
    queryKey: ["despesas_por_conta_detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("conta_bancaria_id, valor, data, descricao, forma_pagamento, categorias_despesas(nome)")
        .not("conta_bancaria_id", "is", null)
        .is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  // Receitas avulsas (entradas)
  const { data: receitasAvulsasPorConta = [] } = useQuery({
    queryKey: ["receitas_avulsas_por_conta_detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receitas_avulsas")
        .select("conta_bancaria_id, valor, data, descricao, forma_pagamento, categoria")
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Processos individuais
  const { data: processosPorConta = [] } = useQuery({
    queryKey: ["processos_individuais_financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_individuais")
        .select("id, conta_bancaria_id, valor_entrada, cliente_nome, responsavel")
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosProcessoPorConta = [] } = useQuery({
    queryKey: ["pagamentos_processo_financeiro_detail"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo")
        .select("processo_id, valor, tipo, data, forma_pagamento, observacoes, conta_bancaria_id")
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Processos empresariais
  const { data: processosEmpresariaisPorConta = [] } = useQuery({
    queryKey: ["processos_empresariais_financeiro_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais")
        .select("id, conta_bancaria_id, empresa_nome, responsavel")
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentosEmpresariaisPorConta = [] } = useQuery({
    queryKey: ["pagamentos_processo_empresarial_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial")
        .select("processo_id, valor, tipo, data, forma_pagamento, observacoes, conta_bancaria_id")
        .is("deleted_at", null)
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Pagamentos profissional (saídas)
  const { data: pagamentosProfissionalPorConta = [] } = useQuery({
    queryKey: ["pagamentos_profissional_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_profissional")
        .select("conta_bancaria_id, valor, data, forma_pagamento, observacoes, profissionais(nome)")
        .is("deleted_at", null)
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Comissões pagas (saídas)
  const { data: comissoesPorConta = [] } = useQuery({
    queryKey: ["comissoes_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("conta_bancaria_id, valor_pago, data_pagamento, forma_pagamento, comerciais(nome), alunos(nome)")
        .is("deleted_at", null)
        .eq("status", "pago")
        .not("conta_bancaria_id", "is", null);
      if (error) throw error;
      return data;
    },
  });

  // Transferências entre contas
  const { data: transferencias = [] } = useQuery({
    queryKey: ["transferencias_entre_contas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transferencias_entre_contas")
        .select("*")
        .is("deleted_at", null)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fechamentos mensais
  const { data: fechamentos = [] } = useQuery({
    queryKey: ["fechamentos_mensais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fechamentos_mensais")
        .select("*")
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getUltimoFechamento = (contaId: string) => {
    return fechamentos.find((f: any) => f.conta_bancaria_id === contaId) || null;
  };

  const isAfterFechamento = (dateStr: string | null, fechamento: any) => {
    if (!fechamento || !dateStr) return true;
    const d = dateStr.substring(0, 10).split("-");
    const year = parseInt(d[0], 10);
    const month = parseInt(d[1], 10) - 1; // 0-indexed
    if (year > fechamento.ano) return true;
    if (year === fechamento.ano && month > fechamento.mes) return true;
    return false;
  };

  const saveTransfer = useMutation({
    mutationFn: async (form: any) => {
      if (form.conta_origem_id === form.conta_destino_id) throw new Error("Contas iguais");
      const { error } = await supabase.from("transferencias_entre_contas").insert({
        conta_origem_id: form.conta_origem_id,
        conta_destino_id: form.conta_destino_id,
        valor: Number(form.valor),
        data: form.data,
        descricao: form.descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transferencias_entre_contas"] });
      setTransferOpen(false);
      toast({ title: "Transferência registrada com sucesso" });
    },
    onError: (e: any) => toast({ title: e.message === "Contas iguais" ? "Selecione contas diferentes" : "Erro ao registrar transferência", variant: "destructive" }),
  });

  const deleteTransfer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transferencias_entre_contas").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transferencias_entre_contas"] });
      toast({ title: "Transferência excluída" });
    },
  });

  const calcEntradasProcessosConta = (contaId: string) => {
    const processosDaConta = processosPorConta.filter((p: any) => p.conta_bancaria_id === contaId);
    const processoIds = new Set(processosDaConta.map((p: any) => p.id));
    const entradasLancadas = pagamentosProcessoPorConta
      .filter((p: any) => processoIds.has(p.processo_id))
      .reduce((s: number, p: any) => s + Number(p.valor), 0);
    const entradasFallback = processosDaConta
      .filter((processo: any) => Number(processo.valor_entrada || 0) > 0)
      .filter((processo: any) => !pagamentosProcessoPorConta.some((p: any) => p.processo_id === processo.id && p.tipo === "entrada"))
      .reduce((s: number, processo: any) => s + Number(processo.valor_entrada || 0), 0);
    return entradasLancadas + entradasFallback;
  };

  const calcSaldoReal = (contaId: string, saldoInicial: number) => {
    const fechamento = getUltimoFechamento(contaId);
    const baseSaldo = fechamento ? Number(fechamento.saldo_fechamento) : saldoInicial;
    const filterFn = (dateStr: string | null) => isAfterFechamento(dateStr, fechamento);

    const entradas = pagamentosPorConta
      .filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data_pagamento))
      .reduce((s: number, p: any) => s + Number(p.valor), 0);
    const entradasProcessos = (() => {
      const processosDaConta = processosPorConta.filter((p: any) => p.conta_bancaria_id === contaId);
      const processoIds = new Set(processosDaConta.map((p: any) => p.id));
      const entradasLancadas = pagamentosProcessoPorConta
        .filter((p: any) => processoIds.has(p.processo_id) && filterFn(p.data))
        .reduce((s: number, p: any) => s + Number(p.valor), 0);
      const entradasFallback = fechamento ? 0 : processosDaConta
        .filter((processo: any) => Number(processo.valor_entrada || 0) > 0)
        .filter((processo: any) => !pagamentosProcessoPorConta.some((p: any) => p.processo_id === processo.id && p.tipo === "entrada"))
        .reduce((s: number, processo: any) => s + Number(processo.valor_entrada || 0), 0);
      return entradasLancadas + entradasFallback;
    })();
    const entradasAvulsas = receitasAvulsasPorConta
      .filter((r: any) => r.conta_bancaria_id === contaId && filterFn(r.data))
      .reduce((s: number, r: any) => s + Number(r.valor), 0);
    const entradasEmpresariais = pagamentosEmpresariaisPorConta
      .filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data))
      .reduce((s: number, p: any) => s + Number(p.valor), 0);
    const saidas = despesasPorConta
      .filter((d: any) => d.conta_bancaria_id === contaId && filterFn(d.data))
      .reduce((s: number, d: any) => s + Number(d.valor), 0);
    const saidasProfissional = pagamentosProfissionalPorConta
      .filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data))
      .reduce((s: number, p: any) => s + Number(p.valor), 0);
    const saidasComissoes = comissoesPorConta
      .filter((c: any) => c.conta_bancaria_id === contaId && filterFn(c.data_pagamento))
      .reduce((s: number, c: any) => s + Number(c.valor_pago), 0);
    const transferEntrando = transferencias
      .filter((t: any) => t.conta_destino_id === contaId && filterFn(t.data))
      .reduce((s: number, t: any) => s + Number(t.valor), 0);
    const transferSaindo = transferencias
      .filter((t: any) => t.conta_origem_id === contaId && filterFn(t.data))
      .reduce((s: number, t: any) => s + Number(t.valor), 0);
    return baseSaldo + entradas + entradasProcessos + entradasAvulsas + entradasEmpresariais + transferEntrando - saidas - saidasProfissional - saidasComissoes - transferSaindo;
  };

  // Build unified transaction list for a given account (only after last fechamento)
  const buildTransactions = (contaId: string) => {
    const fechamento = getUltimoFechamento(contaId);
    const filterFn = (dateStr: string | null) => isAfterFechamento(dateStr, fechamento);
    const txs: { date: string; tipo: "entrada" | "saida"; descricao: string; valor: number; forma: string }[] = [];

    // Pagamentos de alunos
    pagamentosPorConta.filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data_pagamento)).forEach((p: any) => {
      txs.push({
        date: p.data_pagamento || "",
        tipo: "entrada",
        descricao: `Pgto Aluno: ${(p as any).alunos?.nome || "—"}${(p as any).produtos?.nome ? ` — ${(p as any).produtos.nome}` : ""}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || "—",
      });
    });

    // Receitas avulsas
    receitasAvulsasPorConta.filter((r: any) => r.conta_bancaria_id === contaId && filterFn(r.data)).forEach((r: any) => {
      txs.push({
        date: r.data,
        tipo: "entrada",
        descricao: `Receita Avulsa: ${r.descricao}${r.categoria ? ` (${r.categoria})` : ""}`,
        valor: Number(r.valor),
        forma: r.forma_pagamento || "—",
      });
    });

    // Pagamentos processos individuais
    pagamentosProcessoPorConta.filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data)).forEach((p: any) => {
      const proc = processosPorConta.find((pr: any) => pr.id === p.processo_id);
      txs.push({
        date: p.data,
        tipo: "entrada",
        descricao: `Processo Individual: ${proc?.cliente_nome || "—"}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || "—",
      });
    });

    // Pagamentos processos empresariais
    pagamentosEmpresariaisPorConta.filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data)).forEach((p: any) => {
      const proc = processosEmpresariaisPorConta.find((pr: any) => pr.id === p.processo_id);
      txs.push({
        date: p.data,
        tipo: "entrada",
        descricao: `Processo Empresarial: ${proc?.empresa_nome || "—"}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || "—",
      });
    });

    // Despesas
    despesasPorConta.filter((d: any) => d.conta_bancaria_id === contaId && filterFn(d.data)).forEach((d: any) => {
      txs.push({
        date: d.data,
        tipo: "saida",
        descricao: `Despesa: ${d.descricao}${(d as any).categorias_despesas?.nome ? ` (${(d as any).categorias_despesas.nome})` : ""}`,
        valor: Number(d.valor),
        forma: d.forma_pagamento || "—",
      });
    });

    // Pagamentos profissional
    pagamentosProfissionalPorConta.filter((p: any) => p.conta_bancaria_id === contaId && filterFn(p.data)).forEach((p: any) => {
      txs.push({
        date: p.data,
        tipo: "saida",
        descricao: `Pgto Profissional: ${(p as any).profissionais?.nome || "—"}`,
        valor: Number(p.valor),
        forma: p.forma_pagamento || "—",
      });
    });

    // Comissões
    comissoesPorConta.filter((c: any) => c.conta_bancaria_id === contaId && filterFn(c.data_pagamento)).forEach((c: any) => {
      txs.push({
        date: c.data_pagamento || "",
        tipo: "saida",
        descricao: `Comissão: ${(c as any).comerciais?.nome || "—"} — Aluno: ${(c as any).alunos?.nome || "—"}`,
        valor: Number(c.valor_pago),
        forma: c.forma_pagamento || "—",
      });
    });

    // Transferências recebidas
    transferencias.filter((t: any) => t.conta_destino_id === contaId && filterFn(t.data)).forEach((t: any) => {
      const contaOrigem = contas.find((c: any) => c.id === t.conta_origem_id);
      txs.push({
        date: t.data,
        tipo: "entrada",
        descricao: `Transferência de: ${contaOrigem?.nome || "Outra conta"}${t.descricao ? ` — ${t.descricao}` : ""}`,
        valor: Number(t.valor),
        forma: "Transferência",
      });
    });

    // Transferências enviadas
    transferencias.filter((t: any) => t.conta_origem_id === contaId && filterFn(t.data)).forEach((t: any) => {
      const contaDestino = contas.find((c: any) => c.id === t.conta_destino_id);
      txs.push({
        date: t.data,
        tipo: "saida",
        descricao: `Transferência para: ${contaDestino?.nome || "Outra conta"}${t.descricao ? ` — ${t.descricao}` : ""}`,
        valor: Number(t.valor),
        forma: "Transferência",
      });
    });

    txs.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return txs;
  };

  const saveConta = useMutation({
    mutationFn: async (form: any) => {
      const payload = {
        nome: form.nome,
        banco: form.banco,
        agencia: form.agencia || null,
        numero_conta: form.numero_conta || null,
        tipo: form.tipo,
        saldo_inicial: Number(form.saldo_inicial || 0),
        ativo: form.ativo !== "false",
      };
      if (form.id) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contas_bancarias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      setDialogOpen(false);
      setEditingConta(null);
      toast({ title: "Conta salva com sucesso" });
    },
    onError: () => toast({ title: "Erro ao salvar conta", variant: "destructive" }),
  });

  const deleteConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contas_bancarias").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias_all"] });
      queryClient.invalidateQueries({ queryKey: ["contas_bancarias"] });
      toast({ title: "Conta excluída" });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form: any = Object.fromEntries(fd.entries());
    if (editingConta) form.id = editingConta.id;
    saveConta.mutate(form);
  };

  const openEdit = (c: any) => { setEditingConta(c); setDialogOpen(true); };
  const openNew = () => { setEditingConta(null); setDialogOpen(true); };

  const monthNamesShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const fecharMes = async (contaId: string) => {
    setFechamentoLoading(contaId);
    try {
      const saldoAtual = calcSaldoReal(contaId, Number(contas.find((c: any) => c.id === contaId)?.saldo_inicial || 0));
      const brNow = getBrazilNow();
      const mesAtual = brNow.getMonth(); // 0-indexed
      const anoAtual = brNow.getFullYear();
      
      // Check if already closed
      const existing = fechamentos.find((f: any) => f.conta_bancaria_id === contaId && f.mes === mesAtual && f.ano === anoAtual);
      if (existing) {
        // Update existing
        const { error } = await supabase.from("fechamentos_mensais").update({ saldo_fechamento: saldoAtual }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fechamentos_mensais").insert({
          conta_bancaria_id: contaId,
          mes: mesAtual,
          ano: anoAtual,
          saldo_fechamento: saldoAtual,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["fechamentos_mensais"] });
      toast({ title: `Mês ${monthNamesShort[mesAtual]}/${anoAtual} fechado com saldo ${formatCurrency(saldoAtual)}` });
    } catch {
      toast({ title: "Erro ao fechar mês", variant: "destructive" });
    } finally {
      setFechamentoLoading(null);
    }
  };

  const desfazerFechamento = async (contaId: string) => {
    const ultimo = getUltimoFechamento(contaId);
    if (!ultimo) return;
    try {
      const { error } = await supabase.from("fechamentos_mensais").delete().eq("id", ultimo.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["fechamentos_mensais"] });
      toast({ title: "Fechamento desfeito" });
    } catch {
      toast({ title: "Erro ao desfazer fechamento", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Contas Bancárias</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <Receipt className="h-4 w-4 mr-1" /> Transferência
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingConta(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Conta</Button>
                </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingConta ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Nome da Conta *</Label>
                      <Input name="nome" required placeholder="Ex: Conta Principal PJ" defaultValue={editingConta?.nome || ""} />
                    </div>
                    <div className="col-span-2">
                      <Label>Banco *</Label>
                      <Input name="banco" required placeholder="Ex: Itaú, Nubank..." defaultValue={editingConta?.banco || ""} />
                    </div>
                    <div>
                      <Label>Agência</Label>
                      <Input name="agencia" defaultValue={editingConta?.agencia || ""} />
                    </div>
                    <div>
                      <Label>Nº Conta</Label>
                      <Input name="numero_conta" defaultValue={editingConta?.numero_conta || ""} />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <select name="tipo" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingConta?.tipo || "corrente"}>
                        <option value="corrente">Corrente</option>
                        <option value="poupanca">Poupança</option>
                        <option value="investimento">Investimento</option>
                        <option value="caixa">Caixa</option>
                      </select>
                    </div>
                    <div>
                      <Label>Saldo Inicial</Label>
                      <Input name="saldo_inicial" type="number" step="0.01" defaultValue={editingConta?.saldo_inicial || "0"} />
                    </div>
                    {editingConta && (
                      <div className="col-span-2">
                        <Label>Ativo</Label>
                        <select name="ativo" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue={editingConta?.ativo ? "true" : "false"}>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </select>
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={saveConta.isPending}>
                    {saveConta.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingConta ? "Salvar" : "Cadastrar Conta"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 p-6 pt-0">
              {contas.map((c: any) => {
                const saldoReal = calcSaldoReal(c.id, Number(c.saldo_inicial));
                const fechamento = getUltimoFechamento(c.id);
                const filterAfter = (dateStr: string | null) => isAfterFechamento(dateStr, fechamento);
                const totalEntradas = pagamentosPorConta.filter((p: any) => p.conta_bancaria_id === c.id && filterAfter(p.data_pagamento)).reduce((s: number, p: any) => s + Number(p.valor), 0)
                  + (fechamento ? 0 : calcEntradasProcessosConta(c.id))
                  + receitasAvulsasPorConta.filter((r: any) => r.conta_bancaria_id === c.id && filterAfter(r.data)).reduce((s: number, r: any) => s + Number(r.valor), 0)
                  + pagamentosEmpresariaisPorConta.filter((p: any) => p.conta_bancaria_id === c.id && filterAfter(p.data)).reduce((s: number, p: any) => s + Number(p.valor), 0);
                const totalSaidas = despesasPorConta.filter((d: any) => d.conta_bancaria_id === c.id && filterAfter(d.data)).reduce((s: number, d: any) => s + Number(d.valor), 0)
                  + pagamentosProfissionalPorConta.filter((p: any) => p.conta_bancaria_id === c.id && filterAfter(p.data)).reduce((s: number, p: any) => s + Number(p.valor), 0)
                  + comissoesPorConta.filter((co: any) => co.conta_bancaria_id === c.id && filterAfter(co.data_pagamento)).reduce((s: number, co: any) => s + Number(co.valor_pago), 0);
                const isExpanded = expandedConta === c.id;
                const txs = isExpanded ? buildTransactions(c.id) : [];

                return (
                  <Card key={c.id} className={`${!c.ativo ? "opacity-50" : ""}`}>
                    <CardContent className="p-0">
                      <div
                        className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedConta(isExpanded ? null : c.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Building2 className="h-5 w-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.banco} {c.agencia ? `• Ag ${c.agencia}` : ""} {c.numero_conta ? `• CC ${c.numero_conta}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <p className={`text-lg font-bold ${saldoReal >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatCurrency(saldoReal)}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-emerald-600">+{formatCurrency(totalEntradas)}</span>
                              <span className="text-destructive">-{formatCurrency(totalSaidas)}</span>
                            </div>
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Badge variant={c.ativo ? "default" : "outline"} className="text-xs">{c.ativo ? "Ativa" : "Inativa"}</Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteConta.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-5 pb-5">
                          <div className="flex flex-col gap-2 py-3">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                {fechamento ? (
                                  <p className="text-xs text-muted-foreground">
                                    Último fechamento: <span className="font-medium">{monthNamesShort[fechamento.mes]}/{fechamento.ano}</span> — Saldo: <span className="font-medium">{formatCurrency(Number(fechamento.saldo_fechamento))}</span>
                                  </p>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrency(Number(c.saldo_inicial))}</p>
                                )}
                              </div>
                              <div className="flex gap-1.5">
                                {fechamento && (
                                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); desfazerFechamento(c.id); }}>
                                    <X className="h-3 w-3 mr-1" /> Desfazer
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  disabled={fechamentoLoading === c.id}
                                  onClick={(e) => { e.stopPropagation(); fecharMes(c.id); }}
                                >
                                  {fechamentoLoading === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Fechar Mês
                                </Button>
                                {txs.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const doc = new jsPDF();
                                      doc.setFontSize(16);
                                      doc.text(`Extrato — ${c.nome}`, 14, 20);
                                      doc.setFontSize(10);
                                      doc.text(`${c.banco}${c.agencia ? ` • Ag ${c.agencia}` : ""}${c.numero_conta ? ` • CC ${c.numero_conta}` : ""}`, 14, 28);
                                      doc.text(fechamento ? `Saldo Fechamento (${monthNamesShort[fechamento.mes]}/${fechamento.ano}): ${formatCurrency(Number(fechamento.saldo_fechamento))}` : `Saldo Inicial: ${formatCurrency(Number(c.saldo_inicial))}`, 14, 34);
                                      doc.text(`Total Entradas: ${formatCurrency(totalEntradas)}  |  Total Saídas: ${formatCurrency(totalSaidas)}  |  Saldo Atual: ${formatCurrency(saldoReal)}`, 14, 40);

                                      autoTable(doc, {
                                        startY: 46,
                                        head: [["Data", "Tipo", "Descrição", "Forma Pgto", "Valor"]],
                                        body: txs.map((tx) => [
                                          formatDate(tx.date),
                                          tx.tipo === "entrada" ? "Entrada" : "Saída",
                                          tx.descricao,
                                          tx.forma,
                                          `${tx.tipo === "entrada" ? "+" : "-"}${formatCurrency(tx.valor)}`,
                                        ]),
                                        styles: { fontSize: 8 },
                                        headStyles: { fillColor: [59, 130, 246] },
                                      });

                                      doc.save(`extrato-${c.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" /> Baixar PDF
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                          {txs.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma movimentação nesta conta</p>
                          ) : (
                            <div className="overflow-auto max-h-[400px]">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Forma Pgto</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {txs.map((tx, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                                      <TableCell>
                                        <Badge variant={tx.tipo === "entrada" ? "default" : "destructive"} className="text-xs">
                                          {tx.tipo === "entrada" ? "Entrada" : "Saída"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs max-w-[300px] truncate">{tx.descricao}</TableCell>
                                      <TableCell className="text-xs">{tx.forma}</TableCell>
                                      <TableCell className={`text-xs text-right font-medium ${tx.tipo === "entrada" ? "text-emerald-600" : "text-destructive"}`}>
                                        {tx.tipo === "entrada" ? "+" : "-"}{formatCurrency(tx.valor)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {contas.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">Nenhuma conta bancária cadastrada</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Transferência */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Transferência entre Contas</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            saveTransfer.mutate(Object.fromEntries(fd.entries()));
          }} className="space-y-4">
            <div>
              <Label>Conta Origem *</Label>
              <select name="conta_origem_id" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {contas.filter((c: any) => c.ativo).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Conta Destino *</Label>
              <select name="conta_destino_id" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {contas.filter((c: any) => c.ativo).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.banco})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input name="valor" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <Label>Data *</Label>
                <Input name="data" type="date" required defaultValue={new Date().toISOString().split("T")[0]} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input name="descricao" placeholder="Ex: Transferência para caixa" />
            </div>
            <Button type="submit" className="w-full" disabled={saveTransfer.isPending}>
              {saveTransfer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar Transferência
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Histórico de Transferências */}
      {transferencias.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Histórico de Transferências</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Para</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferencias.map((t: any) => {
                    const origem = contas.find((c: any) => c.id === t.conta_origem_id);
                    const destino = contas.find((c: any) => c.id === t.conta_destino_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(t.data)}</TableCell>
                        <TableCell className="text-xs font-medium">{origem?.nome || "—"}</TableCell>
                        <TableCell className="text-xs font-medium">{destino?.nome || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.descricao || "—"}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{formatCurrency(Number(t.valor))}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTransfer.mutate(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
