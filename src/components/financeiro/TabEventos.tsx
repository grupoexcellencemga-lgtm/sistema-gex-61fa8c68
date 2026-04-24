import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CalendarDays } from "lucide-react";
import { formatDate, formatCurrency } from "./financeiroUtils";
import { isInMonth } from "@/components/MonthFilter";

export const TabEventos = ({ mes, ano }: { mes: number; ano: number }) => {
  const [expandedEvento, setExpandedEvento] = useState<string | null>(null);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["eventos-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos").select("*, produtos(nome)").is("deleted_at", null).order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: participantes = [] } = useQuery({
    queryKey: ["participantes-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("participantes_eventos").select("*, contas_bancarias(nome)");
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas-financeiro-eventos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("despesas").select("*, contas_bancarias(nome)").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
  });

  const despMes = despesas.filter((d: any) => isInMonth(d.data, mes, ano));

  const getEventoData = (eventoId: string) => {
    const eventoParts = participantes.filter((p: any) => p.evento_id === eventoId);
    const partsComPagamento = eventoParts.filter((p: any) => p.status_pagamento === "pago");
    
    const partEntries = partsComPagamento.map((p: any) => ({
      nome: p.nome || "—",
      valor: Number(p.valor) || 0,
      conta: p.contas_bancarias?.nome || "—",
      forma: p.forma_pagamento || "—",
      data: p.data_pagamento,
    }));

    // Filter by month
    const partEntriesMes = partEntries.filter((p) => {
      if (!p.data) return false;
      return isInMonth(p.data, mes, ano);
    });

    const totalEntradas = partEntriesMes.reduce((s, a) => s + a.valor, 0);
    const despesasEvento = despMes.filter((d: any) => d.evento_id === eventoId);
    const totalDespesas = despesasEvento.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const liquido = totalEntradas - totalDespesas;

    return {
      partEntries: partEntriesMes,
      totalParticipantes: eventoParts.length,
      totalPagos: partsComPagamento.length,
      totalEntradas,
      totalDespesas,
      liquido,
      despesasEvento,
    };
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : eventos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum evento cadastrado
          </CardContent>
        </Card>
      ) : (
        eventos.map((evento: any) => {
          const isExpanded = expandedEvento === evento.id;
          const data = isExpanded ? getEventoData(evento.id) : null;

          return (
            <Card key={evento.id} className="overflow-hidden">
              <button
                onClick={() => setExpandedEvento(isExpanded ? null : evento.id)}
                className="w-full text-left p-5 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{evento.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {evento.data ? formatDate(evento.data) : "Sem data"} 
                      {evento.local ? ` · ${evento.local}` : ""} 
                      {evento.produtos?.nome ? ` · ${evento.produtos.nome}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
              </button>

              {isExpanded && data && (
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Entradas (mês)</p>
                      <p className="font-bold text-sm text-emerald-600">{formatCurrency(data.totalEntradas)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Despesas (mês)</p>
                      <p className="font-bold text-sm text-destructive">{formatCurrency(data.totalDespesas)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Líquido</p>
                      <p className={`font-bold text-sm ${data.liquido >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {formatCurrency(data.liquido)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Participantes</p>
                      <p className="font-bold text-sm">{data.totalPagos}/{data.totalParticipantes} pagos</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participante</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Data Pgto</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.partEntries.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{p.nome}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.forma}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.data ? formatDate(p.data) : "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.conta}</TableCell>
                          <TableCell className="text-sm text-right">{formatCurrency(p.valor)}</TableCell>
                        </TableRow>
                      ))}
                      {data.partEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                            Nenhum pagamento neste mês
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Despesas do Evento</p>
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
                        {data.despesasEvento.map((d: any) => (
                          <TableRow key={d.id}>
                            <TableCell className="text-sm">{d.descricao}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(d.data)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{d.contas_bancarias?.nome || "—"}</TableCell>
                            <TableCell className="text-sm text-right text-destructive">{formatCurrency(Number(d.valor))}</TableCell>
                          </TableRow>
                        ))}
                        {data.despesasEvento.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                              Nenhuma despesa neste evento
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
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
