import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Loader2, Building2, TrendingUp, UserCheck } from "lucide-react";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";

export const TabEmpresarial = ({ mes, ano }: { mes: number; ano: number }) => {
  const [expandedEmpresa, setExpandedEmpresa] = useState<string | null>(null);

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ["processos_empresariais_fin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_empresariais" as any)
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos_processo_empresarial_fin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_processo_empresarial" as any)
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .order("data", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const pgMes = pagamentos.filter((p: any) => isInMonth(p.data, mes, ano));

  const totalRecebido = pgMes.reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
  const totalEmpresa = pgMes.reduce((s: number, p: any) => {
    const proc = processos.find((pr: any) => pr.id === p.processo_id);
    const pct = proc ? Number(proc.percentual_empresa || 50) : 50;
    return s + (Number(p.valor || 0) * pct / 100);
  }, 0);
  const totalProfissional = totalRecebido - totalEmpresa;
  const totalAReceber = processos
    .filter((p: any) => p.status === "aberto")
    .reduce((s: number, p: any) => {
      const recebido = pagamentos.filter((pg: any) => pg.processo_id === p.id).reduce((sum: number, pg: any) => sum + Number(pg.valor || 0), 0);
      return s + Math.max(0, Number(p.valor_total || 0) - recebido);
    }, 0);

  // Group processos by empresa_nome
  const empresas = Array.from(new Set(processos.map((p: any) => p.empresa_nome))).sort();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Recebido" value={formatCurrency(totalRecebido)} icon={DollarSign} variant="primary" />
        <MetricCard title="Parte Empresa" value={formatCurrency(totalEmpresa)} icon={Building2} variant="success" />
        <MetricCard title="Parte Profissional" value={formatCurrency(totalProfissional)} icon={UserCheck} variant="warning" />
        <MetricCard title="A Receber (Abertos)" value={formatCurrency(totalAReceber)} icon={TrendingUp} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : empresas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum processo empresarial cadastrado.</CardContent></Card>
      ) : (
        empresas.map((empresaNome: string) => {
          const isExpanded = expandedEmpresa === empresaNome;
          const procsEmpresa = processos.filter((p: any) => p.empresa_nome === empresaNome);
          const procIds = new Set(procsEmpresa.map((p: any) => p.id));
          const pgtsEmpresa = pgMes.filter((pg: any) => procIds.has(pg.processo_id));
          const recebidoTotal = pgtsEmpresa.reduce((s: number, pg: any) => s + Number(pg.valor || 0), 0);
          const valorTotalContratos = procsEmpresa.reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
          const abertos = procsEmpresa.filter((p: any) => p.status === "aberto").length;

          return (
            <Card key={empresaNome} className="overflow-hidden">
              <button
                onClick={() => setExpandedEmpresa(isExpanded ? null : empresaNome)}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{empresaNome}</p>
                    <p className="text-xs text-muted-foreground">
                      {procsEmpresa.length} processo{procsEmpresa.length !== 1 ? "s" : ""} · {abertos} aberto{abertos !== 1 ? "s" : ""} · Recebido: {formatCurrency(recebidoTotal)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary">{formatCurrency(valorTotalContratos)}</span>
                  <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && (
                <CardContent className="pt-0 space-y-4">
                  {/* Métricas da empresa */}
                  {(() => {
                    const empEmpresa = pgtsEmpresa.reduce((s: number, pg: any) => {
                      const proc = procsEmpresa.find((p: any) => p.id === pg.processo_id);
                      return s + (Number(pg.valor || 0) * Number(proc?.percentual_empresa || 50) / 100);
                    }, 0);
                    const empProf = recebidoTotal - empEmpresa;
                    const restante = valorTotalContratos - recebidoTotal;

                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Valor Contratos</p>
                          <p className="font-bold text-sm">{formatCurrency(valorTotalContratos)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Recebido</p>
                          <p className="font-bold text-sm text-emerald-600">{formatCurrency(recebidoTotal)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Parte Empresa</p>
                          <p className="font-bold text-sm text-primary">{formatCurrency(empEmpresa)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Parte Profissional</p>
                          <p className="font-bold text-sm text-orange-600">{formatCurrency(empProf)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">A Receber</p>
                          <p className={`font-bold text-sm ${restante > 0 ? "text-destructive" : "text-emerald-600"}`}>{formatCurrency(Math.max(0, restante))}</p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Processos da empresa */}
                  <p className="text-xs font-medium text-muted-foreground">Processos</p>
                  <div className="space-y-2">
                    {procsEmpresa.map((proc: any) => {
                      const pgtsProc = pagamentos.filter((pg: any) => pg.processo_id === proc.id);
                      const recebidoProc = pgtsProc.reduce((s: number, pg: any) => s + Number(pg.valor || 0), 0);
                      const restanteProc = Math.max(0, Number(proc.valor_total || 0) - recebidoProc);
                      const parteEmpresa = recebidoProc * Number(proc.percentual_empresa || 50) / 100;
                      const parteProf = recebidoProc * Number(proc.percentual_profissional || 50) / 100;
                      const stVariant = proc.status === "aberto" ? "default" : proc.status === "finalizado" ? "secondary" : "destructive";
                      const stLabel = proc.status === "aberto" ? "Aberto" : proc.status === "finalizado" ? "Finalizado" : "Cancelado";

                      return (
                        <Card key={proc.id} className="border">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant={stVariant as any}>{stLabel}</Badge>
                                <span className="text-sm font-medium">Especialista: {proc.responsavel}</span>
                                {proc.contato_nome && <span className="text-xs text-muted-foreground">· Contato: {proc.contato_nome}</span>}
                              </div>
                              <span className="text-sm font-semibold">{formatCurrency(Number(proc.valor_total || 0))}</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                              <div className="rounded-lg bg-muted/30 p-2">
                                <p className="text-xs text-muted-foreground">Valor Total</p>
                                <p className="font-semibold text-sm">{formatCurrency(Number(proc.valor_total || 0))}</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-2">
                                <p className="text-xs text-muted-foreground">Recebido</p>
                                <p className="font-semibold text-sm text-emerald-600">{formatCurrency(recebidoProc)}</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-2">
                                <p className="text-xs text-muted-foreground">Restante</p>
                                <p className={`font-semibold text-sm ${restanteProc > 0 ? "text-orange-600" : "text-emerald-600"}`}>{formatCurrency(restanteProc)}</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-2">
                                <p className="text-xs text-muted-foreground">Empresa ({proc.percentual_empresa}%)</p>
                                <p className="font-semibold text-sm text-primary">{formatCurrency(parteEmpresa)}</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-2">
                                <p className="text-xs text-muted-foreground">Prof. ({proc.percentual_profissional}%)</p>
                                <p className="font-semibold text-sm">{formatCurrency(parteProf)}</p>
                              </div>
                            </div>

                            {proc.sessoes && (
                              <p className="text-xs text-muted-foreground">
                                Sessões: {proc.sessoes_realizadas || 0} / {proc.sessoes}
                                {proc.data_inicio && ` · Início: ${formatDate(proc.data_inicio)}`}
                                {proc.data_finalizacao && ` · Finalizado: ${formatDate(proc.data_finalizacao)}`}
                              </p>
                            )}

                            {/* Lançamentos do processo */}
                            {pgtsProc.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Lançamentos</p>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Data</TableHead>
                                      <TableHead>Tipo</TableHead>
                                      <TableHead>Forma</TableHead>
                                      <TableHead>Banco</TableHead>
                                      <TableHead>Obs</TableHead>
                                      <TableHead className="text-right">Valor</TableHead>
                                      <TableHead className="text-right">Parte Empresa</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {pgtsProc.map((pg: any) => (
                                      <TableRow key={pg.id}>
                                        <TableCell className="text-sm">{formatDate(pg.data)}</TableCell>
                                        <TableCell className="text-sm">
                                          <Badge variant="outline">{pg.tipo === "entrada" ? "Entrada" : pg.tipo === "parcela" ? "Parcela" : "Pagamento"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">{pg.forma_pagamento || "—"}</TableCell>
                                        <TableCell className="text-sm">{(pg as any).contas_bancarias?.nome || "—"}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{pg.observacoes || "—"}</TableCell>
                                        <TableCell className="text-sm text-right font-semibold text-emerald-600">{formatCurrency(Number(pg.valor))}</TableCell>
                                        <TableCell className="text-sm text-right text-muted-foreground">{formatCurrency(Number(pg.valor) * Number(proc.percentual_empresa || 50) / 100)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                            {pgtsProc.length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">Nenhum lançamento registrado</p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};
