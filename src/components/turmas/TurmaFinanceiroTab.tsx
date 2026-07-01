import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";

const getValorPago = (p: any) => {
  const pago = p.valor_pago !== null && p.valor_pago !== undefined ? Number(p.valor_pago) : 0;
  const original = p.valor !== null && p.valor !== undefined ? Number(p.valor) : 0;
  return pago > 0 ? pago : original;
};

// Mesma regra do Financeiro > Turmas para atribuir um pagamento à matrícula.
const pagamentoPertenceMatricula = (p: any, m: any, turmaId: string) => {
  if (p.matricula_id && p.matricula_id === m.id) return true;
  if (p.turma_id && p.turma_id === turmaId && p.aluno_id === m.aluno_id) return true;
  if (!p.matricula_id && p.aluno_id === m.aluno_id && p.produto_id === m.produto_id) return true;
  return false;
};

export function TurmaFinanceiroTab({ turma }: { turma: any }) {
  const { data: matriculas = [], isLoading: loadingMat } = useQuery({
    queryKey: ["turma-fin-matriculas", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, aluno_id, produto_id, alunos(nome)")
        .eq("turma_id", turma.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const alunoIds = useMemo(
    () => [...new Set(matriculas.map((m: any) => m.aluno_id).filter(Boolean))],
    [matriculas]
  );

  const { data: pagamentos = [], isLoading: loadingPag } = useQuery({
    queryKey: ["turma-fin-pagamentos", turma.id, alunoIds.length],
    enabled: alunoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, contas_bancarias(nome)")
        .eq("status", "pago")
        .is("deleted_at", null)
        .in("aluno_id", alunoIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: despesas = [], isLoading: loadingDesp } = useQuery({
    queryKey: ["turma-fin-despesas", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, contas_bancarias(nome)")
        .eq("turma_id", turma.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const dados = useMemo(() => {
    const porAluno = new Map<string, { nome: string; total: number; conta: string }>();

    matriculas.forEach((m: any) => {
      const pgtos = pagamentos.filter((p: any) =>
        pagamentoPertenceMatricula(p, m, turma.id)
      );
      const total = pgtos.reduce((s: number, p: any) => s + getValorPago(p), 0);
      const conta = [
        ...new Set(pgtos.map((p: any) => p.contas_bancarias?.nome).filter(Boolean)),
      ].join(", ");

      const chave = m.aluno_id;
      const atual = porAluno.get(chave);
      if (atual) {
        atual.total += total;
        if (conta && !atual.conta.includes(conta)) {
          atual.conta = [atual.conta, conta].filter(Boolean).join(", ");
        }
      } else {
        porAluno.set(chave, { nome: m.alunos?.nome || "—", total, conta: conta || "—" });
      }
    });

    const alunoEntries = Array.from(porAluno.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );

    const totalEntradas = alunoEntries.reduce((s, a) => s + a.total, 0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    const liquido = totalEntradas - totalDespesas;

    return {
      alunoEntries,
      totalEntradas,
      totalDespesas,
      liquido,
      parteGex: liquido * 0.5,
      parteResponsavel: liquido * 0.5,
    };
  }, [matriculas, pagamentos, despesas, turma.id]);

  const isLoading = loadingMat || loadingPag || loadingDesp;

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Campo: "Turma", Valor: turma.nome },
        { Campo: "Responsável", Valor: turma.responsavel || "" },
        { Campo: "Entradas (recebido)", Valor: dados.totalEntradas },
        { Campo: "Despesas", Valor: dados.totalDespesas },
        { Campo: "Líquido", Valor: dados.liquido },
        { Campo: "GEx (50%)", Valor: dados.parteGex },
        { Campo: `${turma.responsavel || "Responsável"} (50%)`, Valor: dados.parteResponsavel },
      ]),
      "Resumo"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        dados.alunoEntries.length
          ? dados.alunoEntries.map((a) => ({
              Aluno: a.nome,
              "Conta/Banco": a.conta,
              "Total pago": a.total,
            }))
          : [{ Aluno: "Nenhuma entrada" }]
      ),
      "Alunos"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        despesas.length
          ? despesas.map((d: any) => ({
              Descrição: d.descricao,
              Data: formatDate(d.data),
              "Saiu de": d.contas_bancarias?.nome || "—",
              Valor: Number(d.valor || 0),
            }))
          : [{ Descrição: "Nenhuma despesa" }]
      ),
      "Despesas"
    );
    const slug = (turma.nome || "turma")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    XLSX.writeFile(wb, `financeiro-turma-${slug}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportarExcel}>
          <Download className="h-4 w-4 mr-2" />
          Baixar Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Entradas (recebido)</p>
          <p className="font-bold text-sm text-emerald-600">{formatCurrency(dados.totalEntradas)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="font-bold text-sm text-destructive">{formatCurrency(dados.totalDespesas)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Líquido</p>
          <p className={`font-bold text-sm ${dados.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
            {formatCurrency(dados.liquido)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Alunos com entrada</p>
          <p className="font-bold text-sm">{dados.alunoEntries.filter((a) => a.total > 0).length}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Conta / Banco</TableHead>
                <TableHead className="text-right">Total pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.alunoEntries.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{a.nome}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.conta}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatCurrency(a.total)}</TableCell>
                </TableRow>
              ))}
              {dados.alunoEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                    Nenhuma entrada registrada nesta turma
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Despesas da Turma</p>
        <Card>
          <CardContent className="p-0">
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
                {despesas.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm">{d.descricao}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(d.data)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.contas_bancarias?.nome || "—"}</TableCell>
                    <TableCell className="text-sm text-right text-destructive">
                      {formatCurrency(Number(d.valor || 0))}
                    </TableCell>
                  </TableRow>
                ))}
                {despesas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      Nenhuma despesa nesta turma
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="border-t pt-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Divisão 50/50</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">GEx</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(dados.parteGex)}</p>
            <p className="text-xs text-muted-foreground">50%</p>
          </div>
          <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{turma.responsavel || "Responsável"}</p>
            <p className="text-lg font-bold">{formatCurrency(dados.parteResponsavel)}</p>
            <p className="text-xs text-muted-foreground">50%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
