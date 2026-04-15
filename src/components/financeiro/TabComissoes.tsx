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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Loader2, Pencil, Trash2, UserCheck, X, Award, Check, Package, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";

export const TabComissoes = ({ mes, ano }: { mes: number; ano: number }) => {
  const queryClient = useQueryClient();
  const [expandedVendedor, setExpandedVendedor] = useState<string | null>(null);
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);
  const [showPagarForm, setShowPagarForm] = useState<string | null>(null);
  const [pgForm, setPgForm] = useState({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });

  const { data: comerciais = [], isLoading } = useQuery({
    queryKey: ["comerciais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comerciais").select("*").eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: comissoes = [] } = useQuery({
    queryKey: ["comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("comissoes").select("*, alunos(nome), produtos(nome), turmas(nome), comerciais(nome), contas_bancarias(nome)").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["contas_bancarias_comissoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").is("deleted_at", null).eq("ativo", true).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const pagarComissao = useMutation({
    mutationFn: async (comissao: any) => {
      const valor = Number(pgForm.valor) || (Number(comissao.valor_comissao) - Number(comissao.valor_pago));
      if (valor <= 0) throw new Error("Nada a pagar");

      let categoriaId: string | null = null;
      const { data: catExist } = await supabase.from("categorias_despesas").select("id").eq("nome", "Comissão Comercial").maybeSingle();
      if (catExist) {
        categoriaId = catExist.id;
      } else {
        const newCatId = crypto.randomUUID();
        await supabase.from("categorias_despesas").insert({ id: newCatId, nome: "Comissão Comercial", tipo: "empresa" });
        categoriaId = newCatId;
      }

      const alunoNome = comissao.alunos?.nome || "Aluno";
      const comercialNome = comissao.comerciais?.nome || "Comercial";

      if (comissao.status === "pago" && comissao.despesa_id) {
        await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", comissao.despesa_id);
      }

      const despesaId = crypto.randomUUID();
      const { error: despError } = await supabase.from("despesas").insert({
        id: despesaId,
        descricao: `Comissão: ${comercialNome} — Matrícula ${alunoNome}`,
        valor,
        data: pgForm.data || new Date().toISOString().split("T")[0],
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        observacoes: pgForm.obs.trim() || null,
        recorrente: false,
        categoria_id: categoriaId,
      });
      if (despError) throw despError;

      const { error } = await supabase.from("comissoes").update({
        valor_pago: valor,
        valor_comissao: valor,
        status: "pago",
        data_pagamento: pgForm.data || new Date().toISOString().split("T")[0],
        forma_pagamento: pgForm.forma || null,
        conta_bancaria_id: pgForm.conta_id || null,
        despesa_id: despesaId,
        observacoes: pgForm.obs.trim() || null,
      }).eq("id", comissao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Comissão paga e despesa registrada!" });
      setShowPagarForm(null);
      resetPgForm();
    },
    onError: () => toast({ title: "Erro ao pagar comissão", variant: "destructive" }),
  });

  const desfazerPagamento = useMutation({
    mutationFn: async (comissao: any) => {
      if (comissao.despesa_id) {
        await supabase.from("despesas").update({ deleted_at: new Date().toISOString() }).eq("id", comissao.despesa_id);
      }
      const { error } = await supabase.from("comissoes").update({
        valor_pago: 0,
        status: "pendente",
        data_pagamento: null,
        forma_pagamento: null,
        conta_bancaria_id: null,
        despesa_id: null,
        observacoes: null,
      }).eq("id", comissao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comissoes"] });
      queryClient.invalidateQueries({ queryKey: ["despesas"] });
      toast({ title: "Pagamento desfeito" });
    },
    onError: () => toast({ title: "Erro ao desfazer pagamento", variant: "destructive" }),
  });

  const resetPgForm = () => setPgForm({ valor: "", data: new Date().toISOString().split("T")[0], forma: "", conta_id: "", obs: "" });

  const openPgForm = (c: any) => {
    if (c.status === "pago") {
      setPgForm({
        valor: String(c.valor_comissao || ""),
        data: c.data_pagamento || new Date().toISOString().split("T")[0],
        forma: c.forma_pagamento || "",
        conta_id: c.conta_bancaria_id || "",
        obs: c.observacoes || "",
      });
    } else {
      setPgForm({
        valor: String(Number(c.valor_comissao) - Number(c.valor_pago)),
        data: new Date().toISOString().split("T")[0],
        forma: "",
        conta_id: "",
        obs: "",
      });
    }
    setShowPagarForm(c.id);
  };

  const comissoesMes = comissoes.filter((c: any) => isInMonth(c.created_at, mes, ano));

  const buildHierarchy = (comercialId: string) => {
    const cms = comissoesMes.filter((c: any) => c.comercial_id === comercialId);
    const produtoMap: Record<string, { nome: string; turmas: Record<string, { nome: string; comissoes: any[] }> }> = {};

    cms.forEach((c: any) => {
      const prodId = c.produto_id || "sem-produto";
      const prodNome = c.produtos?.nome || "Sem produto";
      const turmaId = c.turma_id || "sem-turma";
      const turmaNome = c.turmas?.nome || "Sem turma";

      if (!produtoMap[prodId]) produtoMap[prodId] = { nome: prodNome, turmas: {} };
      if (!produtoMap[prodId].turmas[turmaId]) produtoMap[prodId].turmas[turmaId] = { nome: turmaNome, comissoes: [] };
      produtoMap[prodId].turmas[turmaId].comissoes.push(c);
    });

    return produtoMap;
  };

  const getVendedorTotals = (comercialId: string) => {
    const cms = comissoes.filter((c: any) => c.comercial_id === comercialId);
    const total = cms.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
    const pago = cms.reduce((s: number, c: any) => s + Number(c.valor_pago), 0);
    const pendentes = cms.filter((c: any) => c.status === "pendente").length;
    return { total, pago, pendente: total - pago, pendentes, vendas: cms.length };
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Comissões por Vendedor</h3>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : comerciais.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum vendedor ativo. Cadastre vendedores na página "Vendedores" no menu lateral.</CardContent></Card>
      ) : (
        comerciais.map((com: any) => {
          const isVendedorExpanded = expandedVendedor === com.id;
          const totals = getVendedorTotals(com.id);
          const hierarchy = isVendedorExpanded ? buildHierarchy(com.id) : {};

          return (
            <Card key={com.id} className="overflow-hidden">
              <button
                onClick={() => { setExpandedVendedor(isVendedorExpanded ? null : com.id); setExpandedProduto(null); setExpandedTurma(null); }}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{com.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {totals.vendas} venda{totals.vendas !== 1 ? "s" : ""} · {totals.pendentes} pendente{totals.pendentes !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Comissão</p>
                    <p className="text-sm font-bold">{formatCurrency(totals.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className={`text-sm font-bold ${totals.pendente > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatCurrency(totals.pendente)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{isVendedorExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isVendedorExpanded && (
                <CardContent className="pt-0 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Total Comissões</p>
                      <p className="font-bold text-sm">{formatCurrency(totals.total)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Já Pago</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(totals.pago)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Pendente</p>
                      <p className={`font-bold text-sm ${totals.pendente > 0 ? "text-destructive" : "text-emerald-600"}`}>{formatCurrency(totals.pendente)}</p>
                    </div>
                  </div>

                  {Object.keys(hierarchy).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma comissão vinculada. Vincule este vendedor ao criar uma matrícula.</p>
                  ) : (
                    Object.entries(hierarchy).map(([prodId, prod]) => {
                      const prodKey = `${com.id}-${prodId}`;
                      const isProdExpanded = expandedProduto === prodKey;

                      return (
                        <Card key={prodKey} className="border-l-4 border-l-primary/30">
                          <button
                            onClick={() => { setExpandedProduto(isProdExpanded ? null : prodKey); setExpandedTurma(null); }}
                            className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary/70" />
                              <span className="font-medium text-sm">{prod.nome}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{isProdExpanded ? "▲" : "▼"}</span>
                            </div>
                          </button>

                          {isProdExpanded && (
                            <CardContent className="pt-0 space-y-3">
                              {Object.entries(prod.turmas).map(([turmaId, turma]) => {
                                const turmaKey = `${prodKey}-${turmaId}`;
                                const isTurmaExpanded = expandedTurma === turmaKey;
                                const turmaTotal5 = turma.comissoes.reduce((s: number, c: any) => s + Number(c.valor_comissao), 0);
                                const turmaPago = turma.comissoes.reduce((s: number, c: any) => s + Number(c.valor_pago), 0);
                                const turmaPendente = turmaTotal5 - turmaPago;

                                return (
                                  <Card key={turmaKey} className="border-l-4 border-l-accent">
                                    <button
                                      onClick={() => setExpandedTurma(isTurmaExpanded ? null : turmaKey)}
                                      className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{turma.nome}</span>
                                        <Badge variant="outline" className="text-xs">{turma.comissoes.length} aluno{turma.comissoes.length !== 1 ? "s" : ""}</Badge>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right">
                                          <span className={`text-sm font-semibold ${turmaPendente > 0 ? "text-destructive" : "text-emerald-600"}`}>
                                            {turmaPendente > 0 ? `Falta ${formatCurrency(turmaPendente)}` : "Pago ✓"}
                                          </span>
                                          <p className="text-xs text-muted-foreground">de {formatCurrency(turmaTotal5)}</p>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{isTurmaExpanded ? "▲" : "▼"}</span>
                                      </div>
                                    </button>

                                    {isTurmaExpanded && (
                                      <CardContent className="pt-0">
                                         <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Aluno</TableHead>
                                              <TableHead>Vendedor</TableHead>
                                              <TableHead>Produto / Turma</TableHead>
                                              <TableHead className="text-right">Valor Matrícula</TableHead>
                                              <TableHead className="text-right">Comissão</TableHead>
                                              <TableHead>Status</TableHead>
                                              <TableHead className="w-52" />
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {turma.comissoes.map((c: any) => (
                                              <TableRow key={c.id}>
                                                <TableCell className="text-sm font-medium">{c.alunos?.nome || "—"}</TableCell>
                                                <TableCell className="text-sm">{c.comerciais?.nome || "—"}</TableCell>
                                                <TableCell className="text-sm">
                                                  <div>{c.produtos?.nome || "—"}</div>
                                                  <div className="text-xs text-muted-foreground">{c.turmas?.nome || "—"}</div>
                                                </TableCell>
                                                <TableCell className="text-sm text-right">{formatCurrency(Number(c.valor_matricula))}</TableCell>
                                                <TableCell className="text-sm text-right font-semibold">
                                                  {formatCurrency(Number(c.valor_comissao))}
                                                  <span className="text-xs text-muted-foreground ml-1">({Number(c.percentual)}%)</span>
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant={c.status === "pago" ? "secondary" : "destructive"}>
                                                    {c.status === "pago" ? "Pago" : "Pendente"}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  {showPagarForm === c.id ? (
                                                    <div className="flex flex-col gap-2 min-w-[240px]">
                                                      <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                          <Label className="text-xs">Valor (R$)</Label>
                                                          <Input className="h-8 text-xs" type="number" step="0.01" value={pgForm.valor} onChange={(e) => setPgForm(f => ({ ...f, valor: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                          <Label className="text-xs">Data</Label>
                                                          <Input className="h-8 text-xs" type="date" value={pgForm.data} onChange={(e) => setPgForm(f => ({ ...f, data: e.target.value }))} />
                                                        </div>
                                                      </div>
                                                      <Select value={pgForm.forma} onValueChange={(v) => setPgForm(f => ({ ...f, forma: v }))}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Forma de pagamento..." /></SelectTrigger>
                                                        <SelectContent>
                                                          <SelectItem value="pix">PIX</SelectItem>
                                                          <SelectItem value="transferencia">Transferência</SelectItem>
                                                          <SelectItem value="boleto">Boleto</SelectItem>
                                                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                                          <SelectItem value="cheque">Cheque</SelectItem>
                                                          <SelectItem value="permuta">Permuta</SelectItem>
                                                          <SelectItem value="recorrencia_cartao">Recorrência no Cartão</SelectItem>
                                                        </SelectContent>
                                                      </Select>
                                                      <Select value={pgForm.conta_id} onValueChange={(v) => setPgForm(f => ({ ...f, conta_id: v }))}>
                                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Conta bancária..." /></SelectTrigger>
                                                        <SelectContent>
                                                          {contas.map((ct: any) => (
                                                            <SelectItem key={ct.id} value={ct.id}>{ct.nome}</SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                      </Select>
                                                      <Input className="h-8 text-xs" placeholder="Observações..." value={pgForm.obs} onChange={(e) => setPgForm(f => ({ ...f, obs: e.target.value }))} />
                                                      <div className="flex gap-1">
                                                        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => pagarComissao.mutate(c)} disabled={pagarComissao.isPending}>
                                                          {pagarComissao.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                                                          {c.status === "pago" ? "Salvar" : "Pagar"}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowPagarForm(null); resetPgForm(); }}>
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ) : c.status === "pendente" ? (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPgForm(c)}>
                                                      <DollarSign className="h-3 w-3 mr-1" /> Pagar
                                                    </Button>
                                                  ) : (
                                                    <div className="flex items-center gap-1">
                                                      <span className="text-xs text-muted-foreground">{c.data_pagamento ? formatDate(c.data_pagamento) : ""}</span>
                                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-1.5" onClick={() => openPgForm(c)}>
                                                        <Pencil className="h-3 w-3" />
                                                      </Button>
                                                      <Button size="sm" variant="ghost" className="h-6 text-xs px-1.5 text-destructive" onClick={() => desfazerPagamento.mutate(c)}>
                                                        Desfazer
                                                      </Button>
                                                    </div>
                                                  )}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                            <TableRow className="bg-muted/30 font-semibold">
                                              <TableCell className="text-sm">Total</TableCell>
                                              <TableCell className="text-sm text-right">
                                                {formatCurrency(turma.comissoes.reduce((s: number, c: any) => s + Number(c.valor_matricula), 0))}
                                              </TableCell>
                                              <TableCell className="text-sm text-right text-primary">
                                                {formatCurrency(turmaTotal5)}
                                              </TableCell>
                                              <TableCell colSpan={2} />
                                            </TableRow>
                                          </TableBody>
                                        </Table>
                                      </CardContent>
                                    )}
                                  </Card>
                                );
                              })}
                            </CardContent>
                          )}
                        </Card>
                      );
                    })
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
