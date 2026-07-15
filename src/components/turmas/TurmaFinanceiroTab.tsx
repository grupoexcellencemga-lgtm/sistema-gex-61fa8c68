import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";

const getValorPago = (p: any) => {
  const pago = p.valor_pago !== null && p.valor_pago !== undefined ? Number(p.valor_pago) : 0;
  const original = p.valor !== null && p.valor !== undefined ? Number(p.valor) : 0;
  return pago > 0 ? pago : original;
};

type SituacaoAluno = "gratuito" | "pago" | "parcial" | "pendente" | "vencido";

function getSituacao(pago: number, pendente: number, vencido: number, contratado: number): SituacaoAluno {
  if (contratado === 0 && pago === 0) return "gratuito";
  if (vencido > 0) return "vencido";
  if (pendente === 0 && pago > 0) return "pago";
  if (pago > 0) return "parcial";
  return "pendente";
}

function SituacaoBadge({ s }: { s: SituacaoAluno }) {
  const map: Record<SituacaoAluno, { label: string; className: string }> = {
    gratuito: { label: "Gratuito", className: "bg-muted text-muted-foreground" },
    pago:     { label: "Pago",     className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    parcial:  { label: "Parcial",  className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    pendente: { label: "Pendente", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    vencido:  { label: "Inadimplente", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const { label, className } = map[s];
  return <Badge variant="outline" className={`text-[11px] px-1.5 py-0 border-0 ${className}`}>{label}</Badge>;
}

export function TurmaFinanceiroTab({ turma }: { turma: any }) {
  const navigate = useNavigate();
  const { data: matriculas = [], isLoading: loadingMat } = useQuery({
    queryKey: ["turma-fin-matriculas", turma.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, aluno_id, produto_id, valor_final, alunos(nome)")
        .eq("turma_id", turma.id)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
  });

  const matriculaIds = useMemo(
    () => matriculas.map((m: any) => m.id).filter(Boolean),
    [matriculas]
  );

  // Busca TODOS os pagamentos da turma (pago + pendente + vencido) pelo matricula_id
  const { data: pagamentos = [], isLoading: loadingPag } = useQuery({
    queryKey: ["turma-fin-pagamentos", turma.id, matriculaIds.join(",")],
    enabled: matriculaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .in("matricula_id", matriculaIds as string[]);
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
    type AlunoEntry = {
      alunoId: string;
      nome: string;
      pago: number;
      pendente: number;
      vencido: number;
      contratado: number;
      conta: string;
      situacao: SituacaoAluno;
    };
    const porAluno = new Map<string, AlunoEntry>();

    matriculas.forEach((m: any) => {
      const pgtos = pagamentos.filter((p: any) => p.matricula_id === m.id);
      const contratado = Number(m.valor_final || 0);

      const pago = pgtos
        .filter((p: any) => p.status === "pago")
        .reduce((s: number, p: any) => s + getValorPago(p), 0);

      const pendente = pgtos
        .filter((p: any) => p.status === "pendente")
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const vencido = pgtos
        .filter((p: any) => p.status === "vencido")
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const conta = [
        ...new Set(
          pgtos
            .filter((p: any) => p.status === "pago")
            .map((p: any) => p.contas_bancarias?.nome)
            .filter(Boolean)
        ),
      ].join(", ");

      const chave = m.aluno_id;
      const atual = porAluno.get(chave);
      if (atual) {
        atual.pago += pago;
        atual.pendente += pendente;
        atual.vencido += vencido;
        atual.contratado += contratado;
        if (conta && !atual.conta.includes(conta)) {
          atual.conta = [atual.conta, conta].filter(Boolean).join(", ");
        }
        atual.situacao = getSituacao(atual.pago, atual.pendente, atual.vencido, atual.contratado);
      } else {
        porAluno.set(chave, {
          alunoId: m.aluno_id,
          nome: m.alunos?.nome || "—",
          pago,
          pendente,
          vencido,
          contratado,
          conta: conta || "—",
          situacao: getSituacao(pago, pendente, vencido, contratado),
        });
      }
    });

    const alunoEntries = Array.from(porAluno.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );

    const totalRecebido = alunoEntries.reduce((s, a) => s + a.pago, 0);
    const totalPendente = alunoEntries.reduce((s, a) => s + a.pendente + a.vencido, 0);
    const totalContratado = alunoEntries.reduce((s, a) => s + a.contratado, 0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    const liquido = totalRecebido - totalDespesas;

    return {
      alunoEntries,
      totalRecebido,
      totalPendente,
      totalContratado,
      totalDespesas,
      liquido,
      parteGex: liquido * 0.5,
      parteResponsavel: liquido * 0.5,
    };
  }, [matriculas, pagamentos, despesas]);

  const isLoading = loadingMat || loadingPag || loadingDesp;

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Campo: "Turma", Valor: turma.nome },
        { Campo: "Responsável", Valor: turma.responsavel || "" },
        { Campo: "Total contratado", Valor: dados.totalContratado },
        { Campo: "Entradas (recebido)", Valor: dados.totalRecebido },
        { Campo: "A receber (pendente)", Valor: dados.totalPendente },
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
              "Contratado": a.contratado,
              "Recebido": a.pago,
              "Pendente": a.pendente,
              "Vencido": a.vencido,
              "Situação": a.situacao,
            }))
          : [{ Aluno: "Nenhum aluno" }]
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
          <p className="text-xs text-muted-foreground">Contratado</p>
          <p className="font-bold text-sm">{formatCurrency(dados.totalContratado)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="font-bold text-sm text-emerald-600">{formatCurrency(dados.totalRecebido)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">A receber</p>
          <p className={`font-bold text-sm ${dados.totalPendente > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
            {formatCurrency(dados.totalPendente)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Despesas</p>
          <p className="font-bold text-sm text-destructive">{formatCurrency(dados.totalDespesas)}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Conta / Banco</TableHead>
                <TableHead className="text-right">Contratado</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead className="text-center">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.alunoEntries.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline hover:text-primary transition-colors"
                      onClick={() => navigate(`/alunos?aluno=${a.alunoId}&tab=financeiro`)}
                    >
                      {a.nome}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.conta}</TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency(a.contratado)}</TableCell>
                  <TableCell className="text-sm text-right font-medium text-emerald-600">
                    {a.pago > 0 ? formatCurrency(a.pago) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right text-amber-600">
                    {(a.pendente + a.vencido) > 0 ? formatCurrency(a.pendente + a.vencido) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <SituacaoBadge s={a.situacao} />
                  </TableCell>
                </TableRow>
              ))}
              {dados.alunoEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nenhum aluno matriculado nesta turma
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground">Divisão 50/50</p>
          <p className="text-xs text-muted-foreground">
            Líquido: <span className={`font-semibold ${dados.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(dados.liquido)}
            </span>
          </p>
        </div>
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
