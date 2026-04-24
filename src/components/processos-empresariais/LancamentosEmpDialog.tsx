import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Pencil, Trash2, Check, Receipt, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseCurrencyToNumber, formatCurrencyInput, formatCurrency, formatDate } from "./processosEmpresariaisUtils";
import { useEntradaTaxas, getDefaultImposto } from "@/hooks/useEntradaTaxas";
import { EntradaTaxaFields } from "@/components/financeiro/EntradaTaxaFields";

export const LancamentosEmpDialog = ({ processo, contas }: { processo: any; contas: any[] }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [novoValor, setNovoValor] = useState("");
  const [novoData, setNovoData] = useState(new Date().toISOString().split("T")[0]);
  const [novoTipo, setNovoTipo] = useState("entrada");
  const [novoForma, setNovoForma] = useState("");
  const [novoObs, setNovoObs] = useState("");
  const [novoParcelas, setNovoParcelas] = useState(1);
  const [novoConta, setNovoConta] = useState(processo.conta_bancaria_id || "");
  const [novoImposto, setNovoImposto] = useState(9.5);
  const [novoRepassar, setNovoRepassar] = useState(false);
  const [novoDataVencimento, setNovoDataVencimento] = useState("");
  const [editingLanc, setEditingLanc] = useState<any>(null);

  const { data: taxas = [] } = useQuery({
    queryKey: ["taxas_sistema"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taxas_sistema").select("*").order("ordem", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (taxas.length > 0) {
      setNovoImposto(getDefaultImposto(taxas));
    }
  }, [taxas]);

  const valorNum = parseCurrencyToNumber(novoValor);
  const calc = useEntradaTaxas(novoForma, valorNum, novoParcelas, novoImposto, novoRepassar);

  const { data: lancamentos = [], isLoading, refetch } = useQuery({
    queryKey: ["pagamentos_processo_empresarial", processo.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial" as any)
        .select("*")
        .eq("processo_id", processo.id)
        .is("deleted_at", null)
        .order("data", { ascending: true });
      if (error) throw error;

      const lancamentosReais = data || [];
      const precisaEntradaFallback = Number(processo.valor_entrada || 0) > 0 &&
        !lancamentosReais.some((l: any) => l.tipo === "entrada");

      if (!precisaEntradaFallback) return lancamentosReais;

      return [
        {
          id: `fallback-${processo.id}`,
          processo_id: processo.id,
          valor: Number(processo.valor_entrada || 0),
          data: processo.data_inicio || processo.created_at || new Date().toISOString().split("T")[0],
          tipo: "entrada",
          forma_pagamento: processo.forma_pagamento || null,
          observacoes: "Entrada registrada no cadastro do processo",
          isFallback: true,
        },
        ...lancamentosReais,
      ];
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const valor = parseCurrencyToNumber(novoValor);
      if (valor <= 0) throw new Error("Valor inválido");
      const parcelasInfo = calc.showParcelas && novoParcelas > 1 ? `${novoParcelas}x` : "";
      const taxaInfo = calc.showTaxa && calc.taxaPercentual > 0
        ? `Taxa ${calc.taxaPercentual.toFixed(2)}%${novoRepassar ? " (repassada)" : ""}`
        : "";
      const parts = [novoObs.trim(), parcelasInfo, taxaInfo].filter(Boolean);
      const obs = parts.join(" — ") || null;

      const { error } = await supabase
        .from("pagamentos_processo_empresarial" as any)
        .insert({
          processo_id: processo.id,
          valor,
          data: novoData,
          tipo: novoTipo,
          forma_pagamento: novoForma || null,
          observacoes: obs,
          conta_bancaria_id: novoConta || null,
          taxa_cartao: calc.showTaxa ? calc.taxaPercentual : null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_empresarial_all"] });
      toast({ title: "Lançamento registrado com sucesso!" });
      setNovoValor("");
      setNovoObs("");
      setNovoForma("");
      setNovoTipo("entrada");
      setNovoParcelas(1);
      setNovoRepassar(false);
      setNovoDataVencimento("");
      setNovoConta(processo.conta_bancaria_id || "");
    },
    onError: () => toast({ title: "Erro ao registrar lançamento", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos_processo_empresarial" as any).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_empresarial_all"] });
      toast({ title: "Lançamento removido" });
    },
  });

  const updateLancMutation = useMutation({
    mutationFn: async (lanc: any) => {
      const { error } = await supabase.from("pagamentos_processo_empresarial" as any).update({
        valor: lanc.valor,
        data: lanc.data,
        forma_pagamento: lanc.forma_pagamento || null,
        observacoes: lanc.observacoes || null,
        conta_bancaria_id: lanc.conta_bancaria_id || null,
      }).eq("id", lanc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pagamentos_processo_empresarial_all"] });
      toast({ title: "Lançamento atualizado!" });
      setEditingLanc(null);
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const startEditLanc = (l: any) => {
    setEditingLanc({
      ...l,
      valor: formatCurrencyInput(String(Math.round(Number(l.valor) * 100))),
    });
  };

  const totalLancado = lancamentos.reduce((s: number, l: any) => s + Number(l.valor || 0), 0);
  const saldoRestante = Number(processo.valor_total || 0) - totalLancado;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Lançamentos">
          <Receipt className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Lançamentos — {processo.empresa_nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-sm font-semibold">{formatCurrency(Number(processo.valor_total || 0))}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total Lançado</p>
              <p className="text-sm font-semibold text-green-600">{formatCurrency(totalLancado)}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground">Saldo Restante</p>
              <p className={cn("text-sm font-semibold", saldoRestante > 0 ? "text-orange-600" : "text-green-600")}>
                {formatCurrency(saldoRestante)}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Novo Lançamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input value={novoValor} onChange={(e) => setNovoValor(formatCurrencyInput(e.target.value))} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data do pagamento</Label>
                  <Input type="date" value={novoData} onChange={(e) => setNovoData(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={novoTipo} onValueChange={setNovoTipo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="parcela">Parcela</SelectItem>
                      <SelectItem value="pagamento">Pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <EntradaTaxaFields
                formaPagamento={novoForma}
                onFormaPagamentoChange={(v) => { setNovoForma(v); setNovoRepassar(false); }}
                parcelas={novoParcelas}
                onParcelasChange={setNovoParcelas}
                impostoPercentual={novoImposto}
                onImpostoChange={setNovoImposto}
                repassarTaxa={novoRepassar}
                onRepassarTaxaChange={setNovoRepassar}
                calc={calc}
                dataVencimento={novoDataVencimento}
                onDataVencimentoChange={setNovoDataVencimento}
                taxas={taxas}
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Conta Bancária</Label>
                  <Select value={novoConta} onValueChange={setNovoConta}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {contas.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} — {c.banco}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observação</Label>
                  <Input value={novoObs} onChange={(e) => setNovoObs(e.target.value)} placeholder="Ex: entrada via pix" />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Registrar
              </Button>
            </CardContent>
          </Card>

          {editingLanc && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Editando Lançamento</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingLanc(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input value={editingLanc.valor} onChange={(e) => setEditingLanc((prev: any) => ({ ...prev, valor: formatCurrencyInput(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={editingLanc.data} onChange={(e) => setEditingLanc((prev: any) => ({ ...prev, data: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Forma</Label>
                    <Select value={editingLanc.forma_pagamento || ""} onValueChange={(v) => setEditingLanc((prev: any) => ({ ...prev, forma_pagamento: v }))}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                        <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                        <SelectItem value="link">Link de Pagamento</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Conta</Label>
                    <Select value={editingLanc.conta_bancaria_id || ""} onValueChange={(v) => setEditingLanc((prev: any) => ({ ...prev, conta_bancaria_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
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
                    <Input value={editingLanc.observacoes || ""} onChange={(e) => setEditingLanc((prev: any) => ({ ...prev, observacoes: e.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" className="w-full" onClick={() => {
                      updateLancMutation.mutate({
                        ...editingLanc,
                        valor: parseCurrencyToNumber(editingLanc.valor),
                      });
                    }} disabled={updateLancMutation.isPending}>
                      {updateLancMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Salvar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : lancamentos.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum lançamento registrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Obs.</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lancamentos.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{formatDate(l.data)}</TableCell>
                    <TableCell>
                      <Badge variant={l.tipo === "entrada" ? "default" : "outline"} className="text-xs">
                        {l.tipo === "entrada" ? "Entrada" : l.tipo === "parcela" ? "Parcela" : "Pagamento"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.forma_pagamento || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(l.valor))}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{l.observacoes || "—"}</TableCell>
                    <TableCell>
                      {!l.isFallback && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditLanc(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            if (confirm("Remover este lançamento?")) deleteMutation.mutate(l.id);
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
