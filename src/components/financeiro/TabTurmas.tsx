import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, Download } from "lucide-react";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";
import * as XLSX from "xlsx";
import { useEmpresa } from "@/contexts/EmpresaContext";

export const TabTurmas = ({ mes, ano }: { mes: number; ano: number }) => {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [expandedProduto, setExpandedProduto] = useState<string | null>(null);
  const [expandedTurma, setExpandedTurma] = useState<string | null>(null);

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-financeiro", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").eq("empresa_id", empresaId!).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-financeiro", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("turmas").select("*").eq("empresa_id", empresaId!).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: matriculas = [] } = useQuery({
    queryKey: ["matriculas-financeiro", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("matriculas").select("*, alunos(nome)").eq("empresa_id", empresaId!).is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-financeiro-turmas", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagamentos").select("*, contas_bancarias(nome)").eq("empresa_id", empresaId!).eq("status", "pago").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas-financeiro-turmas", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas").select("*, contas_bancarias(nome)").eq("empresa_id", empresaId!).is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const pgMes = pagamentos.filter((p: any) => isInMonth(p.data_pagamento, mes, ano));
  const despMes = despesas.filter((d: any) => isInMonth(d.data, mes, ano));

  const getValorPago = (p: any) => {
    const valorPago = p.valor_pago !== null && p.valor_pago !== undefined ? Number(p.valor_pago) : 0;
    const valorOriginal = p.valor !== null && p.valor !== undefined ? Number(p.valor) : 0;

    return valorPago > 0 ? valorPago : valorOriginal;
  };

  const pagamentoPertenceMatricula = (p: any, m: any, turmaId: string) => {
    if (p.matricula_id && p.matricula_id === m.id) return true;

    if (p.turma_id && p.turma_id === turmaId && p.aluno_id === m.aluno_id) {
      return true;
    }

    if (
      !p.matricula_id &&
      p.aluno_id === m.aluno_id &&
      p.produto_id === m.produto_id
    ) {
      return true;
    }

    return false;
  };

  const getDataReferenciaPagamento = (p: any) => {
    return p.data_pagamento || p.data_vencimento || p.created_at || null;
  };

  const getTurmaData = (turmaId: string) => {
    const turmaMatriculas = matriculas.filter((m: any) => m.turma_id === turmaId);

    const alunoEntries = turmaMatriculas.map((m: any) => {
      const pgtosTodos = pagamentos.filter((p: any) =>
        pagamentoPertenceMatricula(p, m, turmaId)
      );

      const pgtosMes = pgtosTodos.filter((p: any) =>
        isInMonth(getDataReferenciaPagamento(p), mes, ano)
      );

      const totalAlunoMes = pgtosMes.reduce(
        (s: number, p: any) => s + getValorPago(p),
        0
      );

      const totalAlunoGeral = pgtosTodos.reduce(
        (s: number, p: any) => s + getValorPago(p),
        0
      );

      const contasMes = [
        ...new Set(
          pgtosMes.map((p: any) => p.contas_bancarias?.nome).filter(Boolean)
        ),
      ].join(", ");

      const contasGeral = [
        ...new Set(
          pgtosTodos.map((p: any) => p.contas_bancarias?.nome).filter(Boolean)
        ),
      ].join(", ");

      return {
        nome: m.alunos?.nome || "—",
        valorMes: totalAlunoMes,
        valorTotal: totalAlunoGeral,
        conta: contasMes || contasGeral || "—",
        pagamentosMes: pgtosMes.length,
        pagamentosTotal: pgtosTodos.length,
      };
    });

    const totalEntradas = alunoEntries.reduce((s, a) => s + a.valorMes, 0);
    const totalPagoGeral = alunoEntries.reduce((s, a) => s + a.valorTotal, 0);

    const despesasTurma = despMes.filter((d: any) => d.turma_id === turmaId);
    const totalDespesas = despesasTurma.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const liquido = totalEntradas - totalDespesas;
    const parteGex = liquido * 0.5;
    const parteResponsavel = liquido * 0.5;

    return {
      alunoEntries,
      totalEntradas,
      totalPagoGeral,
      totalDespesas,
      liquido,
      parteGex,
      parteResponsavel,
      despesasTurma,
    };
  };

  const turmasPorProduto = (produtoId: string) => turmas.filter((t: any) => t.produto_id === produtoId);

  const exportarTurmaExcel = (
    produto: any,
    turma: any,
    data: ReturnType<typeof getTurmaData>
  ) => {
    const wb = XLSX.utils.book_new();
    const mesAno = `${String(mes).padStart(2, "0")}/${ano}`;

    const resumo = [
      { Campo: "Produto", Valor: produto.nome },
      { Campo: "Turma", Valor: turma.nome },
      { Campo: "Cidade", Valor: turma.cidade || "" },
      { Campo: "Modalidade", Valor: turma.modalidade || "" },
      { Campo: "Responsável", Valor: turma.responsavel || "" },
      { Campo: "Mês/Ano", Valor: mesAno },
      { Campo: "Entradas no mês", Valor: data.totalEntradas },
      { Campo: "Total pago (geral)", Valor: data.totalPagoGeral },
      { Campo: "Despesas da turma", Valor: data.totalDespesas },
      { Campo: "Líquido", Valor: data.liquido },
      { Campo: "GEx (50%)", Valor: data.parteGex },
      {
        Campo: `${turma.responsavel || "Responsável"} (50%)`,
        Valor: data.parteResponsavel,
      },
      { Campo: "Qtd de alunos", Valor: data.alunoEntries.length },
    ];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(resumo),
      "Resumo"
    );

    const alunos = data.alunoEntries.map((a) => ({
      Aluno: a.nome,
      "Conta/Banco": a.conta,
      "Pago no mês": a.valorMes,
      "Total pago": a.valorTotal,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        alunos.length ? alunos : [{ Aluno: "Nenhum aluno nesta turma" }]
      ),
      "Alunos"
    );

    const despesas = data.despesasTurma.map((d: any) => ({
      Descrição: d.descricao,
      Data: formatDate(d.data),
      "Saiu de": d.contas_bancarias?.nome || "—",
      Valor: Number(d.valor),
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        despesas.length
          ? despesas
          : [{ Descrição: "Nenhuma despesa nesta turma" }]
      ),
      "Despesas"
    );

    const slug = (turma.nome || "turma")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    XLSX.writeFile(wb, `turma-${slug}-${String(mes).padStart(2, "0")}-${ano}.xlsx`);
  };

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
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => exportarTurmaExcel(produto, turma, data)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Baixar Excel
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-lg bg-muted/50 p-3">
                                  <p className="text-xs text-muted-foreground">Entradas no mês</p>
                                  <p className="font-bold text-sm text-emerald-600">{formatCurrency(data.totalEntradas)}</p>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Total pago: {formatCurrency(data.totalPagoGeral)}
                                  </p>
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
                                    <TableHead className="text-right">Pago no mês</TableHead>
                                    <TableHead className="text-right">Total pago</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.alunoEntries.map((a, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-sm font-medium">{a.nome}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{a.conta}</TableCell>
                                      <TableCell className="text-sm text-right text-emerald-600">
                                        {formatCurrency(a.valorMes)}
                                      </TableCell>
                                      <TableCell className="text-sm text-right font-medium">
                                        {formatCurrency(a.valorTotal)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {data.alunoEntries.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum aluno nesta turma</TableCell></TableRow>
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
