import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, GraduationCap } from "lucide-react";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";

export const TabTurmas = ({ mes, ano }: { mes: number; ano: number }) => {
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("*").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas").select("*, alunos(nome)").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-financeiro-turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*, contas_bancarias(nome)").eq("status", "pago").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas-financeiro-turmas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas").select("*, contas_bancarias(nome)").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const pgMes = pagamentos.filter((p: any) => isInMonth(p.data_pagamento, mes, ano));
  const despMes = despesas.filter((d: any) => isInMonth(d.data, mes, ano));

  const getTurmaData = (turmaId: string) => {
    const turmaMatriculas = matriculas.filter((m: any) => m.turma_id === turmaId);
    const alunoEntries = turmaMatriculas.map((m: any) => {
      const pgtos = pgMes.filter((p: any) => {
        if (p.matricula_id === m.id) return true;
        if (!p.matricula_id && p.aluno_id === m.aluno_id && p.produto_id === m.produto_id) return true;
        return false;
      });
      const totalAluno = pgtos.reduce((s: number, p: any) => s + Number(p.valor), 0);
      const contas = [...new Set(pgtos.map((p: any) => p.contas_bancarias?.nome).filter(Boolean))].join(", ");
      return { nome: m.alunos?.nome || "—", valor: totalAluno, conta: contas || "—" };
    });
    const totalEntradas = alunoEntries.reduce((s, a) => s + a.valor, 0);
    const despesasTurma = despMes.filter((d: any) => d.turma_id === turmaId);
    const totalDespesas = despesasTurma.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const liquido = totalEntradas - totalDespesas;
    const parteGex = liquido * 0.5;
    const parteResponsavel = liquido * 0.5;
    return { alunoEntries, totalEntradas, totalDespesas, liquido, parteGex, parteResponsavel, despesasTurma };
  };

  const turmasPorProduto = (produtoId: string) => turmas.filter((t: any) => t.produto_id === produtoId);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : produtos.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum produto cadastrado</CardContent></Card>
      ) : (
        produtos.map((produto: any) => {
          const isProdutoExpanded = expandedProduto === produto.id;
          const prodTurmas = turmasPorProduto(produto.id);

          return (
            <Card key={produto.id} className="overflow-hidden">
              <button
                onClick={() => { setExpandedProduto(isProdutoExpanded ? null : produto.id); setExpandedTurma(null); }}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">{produto.tipo} · {prodTurmas.length} turma{prodTurmas.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{isProdutoExpanded ? "▲" : "▼"}</span>
              </button>

              {isProdutoExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {prodTurmas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma turma vinculada a este produto</p>
                  ) : (
                    prodTurmas.map((turma: any) => {
                      const isTurmaExpanded = expandedTurma === turma.id;
                      const data = isTurmaExpanded ? getTurmaData(turma.id) : null;

                      return (
                        <Card key={turma.id} className="border">
                          <button
                            onClick={() => setExpandedTurma(isTurmaExpanded ? null : turma.id)}
                            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                          >
                            <div>
                              <p className="font-medium text-sm">{turma.nome}</p>
                              <p className="text-xs text-muted-foreground">{turma.cidade} · {turma.modalidade} {turma.responsavel ? `· ${turma.responsavel}` : ""}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{isTurmaExpanded ? "▲" : "▼"}</span>
                          </button>

                          {isTurmaExpanded && data && (
                            <CardContent className="pt-0 space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Total Entradas</p>
                                  <p className="font-bold text-sm text-emerald-600">{formatCurrency(data.totalEntradas)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Despesas Turma</p>
                                  <p className="font-bold text-sm text-destructive">{formatCurrency(data.totalDespesas)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Líquido</p>
                                  <p className={`font-bold text-sm ${data.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>{formatCurrency(data.liquido)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Alunos</p>
                                  <p className="font-bold text-sm">{data.alunoEntries.length}</p>
                                </div>
                              </div>

                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Aluno</TableHead>
                                    <TableHead>Entrou em</TableHead>
                                    <TableHead className="text-right">Valor Pago</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.alunoEntries.map((a, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-sm font-medium">{a.nome}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{a.conta}</TableCell>
                                      <TableCell className="text-sm text-right">{formatCurrency(a.valor)}</TableCell>
                                    </TableRow>
                                  ))}
                                  {data.alunoEntries.length === 0 && (
                                    <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nenhum aluno nesta turma</TableCell></TableRow>
                                  )}
                                </TableBody>
                              </Table>

                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Despesas da Turma</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Descrição</TableHead>
                                      <TableHead>Data</TableHead>
                                      <TableHead>Saiu de</TableHead>
                                      <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {data.despesasTurma.map((d: any) => (
                                      <TableRow key={d.id}>
                                        <TableCell className="text-sm">{d.descricao}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{formatDate(d.data)}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{d.contas_bancarias?.nome || "—"}</TableCell>
                                        <TableCell className="text-sm text-right text-destructive">{formatCurrency(Number(d.valor))}</TableCell>
                                      </TableRow>
                                    ))}
                                    {data.despesasTurma.length === 0 && (
                                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma despesa nesta turma</TableCell></TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>

                              <div className="border-t pt-4">
                                <p className="text-xs font-medium text-muted-foreground mb-3">Divisão 50/50</p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">GEx</p>
                                    <p className="text-lg font-bold text-primary">{formatCurrency(data.parteGex)}</p>
                                    <p className="text-xs text-muted-foreground">50%</p>
                                  </div>
                                  <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">{turma.responsavel || "Responsável"}</p>
                                    <p className="text-lg font-bold">{formatCurrency(data.parteResponsavel)}</p>
                                    <p className="text-xs text-muted-foreground">50%</p>
                                  </div>
                                </div>
                              </div>
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
