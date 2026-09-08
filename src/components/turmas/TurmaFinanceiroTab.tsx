import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { formatDate, formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";
import { useEmpresa } from "@/contexts/EmpresaContext";

const getValorPago = (p: any) => {
  const pago = p.valor_pago !== null && p.valor_pago !== undefined ? Number(p.valor_pago) : 0;
  const original = p.valor !== null && p.valor !== undefined ? Number(p.valor) : 0;
  return pago > 0 ? pago : original;
};

type SituacaoAluno = "gratuito" | "pago" | "parcial" | "pendente" | "vencido";

function getSituacao(pago: number, pendente: number, vencido: number, contratado: number): SituacaoAluno {
  if (contratado === 0 && pago === 0) return "gratuito";
  if (vencido > 0) return "vencido";
  if (contratado > 0 && pago >= contratado) return "pago";
  // Parcial: pagou algo mas não quitou (inclui modo entrada sem parcelas geradas)
  if (pago > 0 && pago < contratado) return "parcial";
  if (pendente > 0 || vencido > 0) return "pendente";
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
  const location = useLocation();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const { data: matriculas = [], isLoading: loadingMat } = useQuery({
    queryKey: ["turma-fin-matriculas", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matriculas")
        .select("id, aluno_id, produto_id, valor_final, alunos(nome)")
        .eq("turma_id", turma.id)
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const matriculaIds = useMemo(
    () => matriculas.map((m: any) => m.id).filter(Boolean),
    [matriculas]
  );

  // Busca TODOS os pagamentos da turma (pago + pendente + vencido) pelo matricula_id
  const { data: pagamentos = [], isLoading: loadingPag } = useQuery({
    queryKey: ["turma-fin-pagamentos", turma.id, matriculaIds.join(","), empresaId],
    enabled: matriculaIds.length > 0 && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select("*, contas_bancarias(nome)")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .in("matricula_id", matriculaIds as string[]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: despesas = [], isLoading: loadingDesp } = useQuery({
    queryKey: ["turma-fin-despesas", turma.id, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*, contas_bancarias(nome)")
        .eq("turma_id", turma.id)
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaId,
  });

  const dados = useMemo(() => {
    type AlunoEntry = {
      alunoId: string;
      nome: string;
      pago: number;        // caixa: líquido recebido no banco
      pagoEfetivo: number; // obrigação: pago + taxa absorvida pela empresa
      pendente: number;
      vencido: number;
      contratado: number;
      aReceber: number;
      taxaEmpresa: number;
      taxaAluno: number;
      conta: string;
      situacao: SituacaoAluno;
    };
    const porAluno = new Map<string, AlunoEntry>();

    // Tolerância de R$0,10 para ruído de arredondamento de taxa
    const semNoise = (v: number) => (Math.round(v * 100) / 100 < 0.10 ? 0 : Math.round(v * 100) / 100);

    matriculas.forEach((m: any) => {
      const pgtos = pagamentos.filter((p: any) => p.matricula_id === m.id);
      const contratado = Number(m.valor_final || 0);

      // Caixa: líquido que entrou no banco
      const pago = pgtos
        .filter((p: any) => p.status === "pago")
        .reduce((s: number, p: any) => s + getValorPago(p), 0);

      // Obrigação do aluno: líquido + taxa que a empresa absorveu
      // (empresa absorveu a taxa → aluno cumpriu sua parte pelo valor integral)
      const pagoEfetivo = pgtos
        .filter((p: any) => p.status === "pago")
        .reduce((s: number, p: any) => {
          const base = getValorPago(p);
          const taxaEmp = p.taxa_absorvida_por === "empresa" ? Number(p.taxa_valor || 0) : 0;
          return s + base + taxaEmp;
        }, 0);

      const pendente = pgtos
        .filter((p: any) => p.status === "pendente")
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const vencido = pgtos
        .filter((p: any) => p.status === "vencido")
        .reduce((s: number, p: any) => s + Number(p.valor || 0), 0);

      const taxaEmpresa = pgtos
        .filter((p: any) => p.status === "pago" && p.taxa_absorvida_por === "empresa")
        .reduce((s: number, p: any) => s + Number(p.taxa_valor || 0), 0);

      const taxaAluno = pgtos
        .filter((p: any) => p.status === "pago" && p.taxa_absorvida_por === "aluno")
        .reduce((s: number, p: any) => s + Number(p.taxa_valor || 0), 0);

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
        atual.pagoEfetivo += pagoEfetivo;
        atual.pendente += pendente;
        atual.vencido += vencido;
        atual.contratado += contratado;
        atual.aReceber = semNoise(Math.max(0, atual.contratado - atual.pagoEfetivo));
        atual.taxaEmpresa += taxaEmpresa;
        atual.taxaAluno += taxaAluno;
        if (conta && !atual.conta.includes(conta)) {
          atual.conta = [atual.conta, conta].filter(Boolean).join(", ");
        }
        atual.situacao = getSituacao(atual.pagoEfetivo, atual.pendente, atual.vencido, atual.contratado);
      } else {
        const aReceber = semNoise(Math.max(0, contratado - pagoEfetivo));
        porAluno.set(chave, {
          alunoId: m.aluno_id,
          nome: m.alunos?.nome || "—",
          pago,
          pagoEfetivo,
          pendente,
          vencido,
          contratado,
          aReceber,
          taxaEmpresa,
          taxaAluno,
          conta: conta || "—",
          situacao: getSituacao(pagoEfetivo, pendente, vencido, contratado),
        });
      }
    });

    const alunoEntries = Array.from(porAluno.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR")
    );

    const totalRecebido = alunoEntries.reduce((s, a) => s + a.pago, 0);
    const totalPendente = alunoEntries.reduce((s, a) => s + a.aReceber, 0);
    const totalContratado = alunoEntries.reduce((s, a) => s + a.contratado, 0);
    const totalTaxaEmpresa = alunoEntries.reduce((s, a) => s + a.taxaEmpresa, 0);
    const totalTaxaAluno   = alunoEntries.reduce((s, a) => s + a.taxaAluno,   0);
    const totalDespesas = despesas.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    // valor_pago já é o líquido no banco (máquina descontou a taxa antes de depositar).
    // Subtrair totalTaxaEmpresa seria contar duas vezes.
    const liquido = totalRecebido - totalDespesas;

    return {
      alunoEntries,
      totalRecebido,
      totalPendente,
      totalContratado,
      totalTaxaEmpresa,
      totalTaxaAluno,
      totalDespesas,
      liquido,
    };
  }, [matriculas, pagamentos, despesas]);

  const isLoading = loadingMat || loadingPag || loadingDesp;

  const [divisaoGex, setDivisaoGex] = useState(50);
  const parteGex = dados.liquido * (divisaoGex / 100);
  const parteResponsavel = dados.liquido * ((100 - divisaoGex) / 100);

  const [filtroAluno, setFiltroAluno] = useState("");
  const [filtroContas, setFiltroContas] = useState<string[]>([]);
  const [filtroSituacoes, setFiltroSituacoes] = useState<SituacaoAluno[]>([]);

  const contasUnicas = useMemo(() => {
    const set = new Set<string>();
    dados.alunoEntries.forEach((a) => {
      if (a.conta && a.conta !== "—") {
        a.conta.split(", ").forEach((c) => set.add(c.trim()));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dados.alunoEntries]);

  const entriesFiltradas = useMemo(() => {
    return dados.alunoEntries.filter((a) => {
      if (filtroAluno && !a.nome.toLowerCase().includes(filtroAluno.toLowerCase())) return false;
      if (filtroContas.length > 0 && !filtroContas.some((c) => a.conta.includes(c))) return false;
      if (filtroSituacoes.length > 0 && !filtroSituacoes.includes(a.situacao)) return false;
      return true;
    });
  }, [dados.alunoEntries, filtroAluno, filtroContas, filtroSituacoes]);

  const algumFiltroAtivo = filtroAluno !== "" || filtroContas.length > 0 || filtroSituacoes.length > 0;

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        { Campo: "Turma", Valor: turma.nome },
        { Campo: "Responsável", Valor: turma.responsavel || "" },
        { Campo: "Total contratado", Valor: dados.totalContratado },
        { Campo: "Entradas (recebido)", Valor: dados.totalRecebido },
        { Campo: "Taxa absorvida pela empresa", Valor: -dados.totalTaxaEmpresa },
        { Campo: "Taxa absorvida pelo aluno", Valor: dados.totalTaxaAluno },
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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Contratado</p>
          <p className="font-bold text-sm">{formatCurrency(dados.totalContratado)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Recebido</p>
          <p className="font-bold text-sm text-emerald-600">{formatCurrency(dados.totalRecebido)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Taxa empresa</p>
          <p className={`font-bold text-sm ${dados.totalTaxaEmpresa > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
            {dados.totalTaxaEmpresa > 0 ? `-${formatCurrency(dados.totalTaxaEmpresa)}` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Taxa aluno</p>
          <p className={`font-bold text-sm ${dados.totalTaxaAluno > 0 ? "text-sky-600" : "text-muted-foreground"}`}>
            {dados.totalTaxaAluno > 0 ? `+${formatCurrency(dados.totalTaxaAluno)}` : "—"}
          </p>
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
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead className="text-center">Situação</TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="py-1.5">
                  <div className="relative">
                    <Input
                      placeholder="Buscar aluno…"
                      value={filtroAluno}
                      onChange={(e) => setFiltroAluno(e.target.value)}
                      className="h-7 text-xs pr-6"
                    />
                    {filtroAluno && (
                      <button type="button" onClick={() => setFiltroAluno("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </TableHead>
                <TableHead className="py-1.5">
                  {contasUnicas.length > 0 ? (
                    <select
                      value={filtroContas[0] || ""}
                      onChange={(e) => setFiltroContas(e.target.value ? [e.target.value] : [])}
                      className="h-7 w-full text-xs rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Todas as contas</option>
                      {contasUnicas.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : null}
                </TableHead>
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead className="py-1.5">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {(["pago", "parcial", "pendente", "vencido", "gratuito"] as SituacaoAluno[]).map((s) => {
                      const labels: Record<SituacaoAluno, string> = { pago: "Pago", parcial: "Parcial", pendente: "Pendente", vencido: "Inad.", gratuito: "Grat." };
                      const colors: Record<SituacaoAluno, string> = {
                        pago:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                        parcial:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        pendente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                        vencido:  "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        gratuito: "bg-muted text-muted-foreground",
                      };
                      const ativo = filtroSituacoes.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFiltroSituacoes((prev) =>
                            prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                          )}
                          className={`text-[10px] px-1.5 py-0.5 rounded border-0 font-medium transition-opacity ${colors[s]} ${
                            filtroSituacoes.length === 0 || ativo ? "opacity-100" : "opacity-30"
                          }`}
                        >
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entriesFiltradas.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline hover:text-primary transition-colors"
                      onClick={() => navigate(`/alunos?aluno=${a.alunoId}&tab=financeiro&returnTo=${encodeURIComponent(location.pathname + location.search)}`)}
                    >
                      {a.nome}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.conta}</TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency(a.contratado)}</TableCell>
                  <TableCell className="text-sm text-right font-medium text-emerald-600">
                    {a.pago > 0 ? formatCurrency(a.pago) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {(a.taxaEmpresa > 0 || a.taxaAluno > 0) ? (
                      <div className="flex flex-col items-end gap-0.5">
                        {a.taxaEmpresa > 0 && (
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                            -{formatCurrency(a.taxaEmpresa)} Empresa
                          </span>
                        )}
                        {a.taxaAluno > 0 && (
                          <span className="text-xs font-medium text-sky-600 bg-sky-50 dark:bg-sky-900/20 px-1.5 py-0.5 rounded">
                            {formatCurrency(a.taxaAluno)} Aluno
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right text-amber-600">
                    {a.aReceber > 0 ? formatCurrency(a.aReceber) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <SituacaoBadge s={a.situacao} />
                  </TableCell>
                </TableRow>
              ))}
              {entriesFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                    {algumFiltroAtivo
                      ? <span>Nenhum aluno corresponde aos filtros.{" "}
                          <button type="button" className="underline hover:text-foreground" onClick={() => { setFiltroAluno(""); setFiltroContas([]); setFiltroSituacoes([]); }}>Limpar filtros</button>
                        </span>
                      : "Nenhum aluno matriculado nesta turma"}
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

      <div className="border-t pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Divisão do líquido</p>
          <p className="text-xs text-muted-foreground">
            Líquido: <span className={`font-semibold ${dados.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {formatCurrency(dados.liquido)}
            </span>
          </p>
        </div>

        {/* Gangorra */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-lg border p-4 text-center transition-all ${divisaoGex >= 50 ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
            <p className="text-xs text-muted-foreground mb-1">GEx</p>
            <p className={`text-lg font-bold transition-colors ${divisaoGex >= 50 ? "text-primary" : "text-foreground"}`}>
              {formatCurrency(parteGex)}
            </p>
            <p className="text-xs font-semibold text-primary mt-0.5">{divisaoGex}%</p>
          </div>
          <div className={`rounded-lg border p-4 text-center transition-all ${100 - divisaoGex >= 50 ? "border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-border bg-muted/30"}`}>
            <p className="text-xs text-muted-foreground mb-1">{turma.responsavel || "Responsável"}</p>
            <p className={`text-lg font-bold transition-colors ${100 - divisaoGex >= 50 ? "text-emerald-600" : "text-foreground"}`}>
              {formatCurrency(parteResponsavel)}
            </p>
            <p className="text-xs font-semibold text-emerald-600 mt-0.5">{100 - divisaoGex}%</p>
          </div>
        </div>

        {/* Slider */}
        <div className="px-1 space-y-2">
          <div className="relative">
            {/* Faixas de cor atrás do slider */}
            <div className="absolute inset-0 flex rounded-full overflow-hidden pointer-events-none h-2 top-1/2 -translate-y-1/2">
              <div className="bg-primary/30 transition-all" style={{ width: `${divisaoGex}%` }} />
              <div className="bg-emerald-400/30 transition-all flex-1" />
            </div>
            <Slider
              value={[divisaoGex]}
              onValueChange={([v]) => setDivisaoGex(v)}
              min={0}
              max={100}
              step={1}
              className="relative"
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
            <span>← GEx</span>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => setDivisaoGex(50)}
            >
              {divisaoGex === 50 ? "50 / 50" : "Resetar"}
            </button>
            <span>{turma.responsavel || "Responsável"} →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
