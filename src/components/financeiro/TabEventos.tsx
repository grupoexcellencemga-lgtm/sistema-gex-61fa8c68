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
    queryKey: ["eventos", "financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.from("eventos").select("*, produtos(nome)").is("deleted_at", null).order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Busca todos os participantes pagos sem filtro de data.
  // O filtro por mês é feito em getEventoData usando data_pagamento com fallback para a data do evento.
  const { data: participantes = [] } = useQuery({
    queryKey: ["participantes_eventos", "financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participantes_eventos")
        .select("*, contas_bancarias(nome)")
        .eq("status_pagamento", "pago");
      if (error) throw error;
      return data;
    },
  });

  const { data: despesas = [] } = useQuery({
    queryKey: ["despesas", "financeiro-eventos", mes, ano],
    queryFn: async () => {
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fim = new Date(ano, mes, 0).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("despesas")
        .select("*, contas_bancarias(nome)")
        .is("deleted_at", null)
        .not("evento_id", "is", null)
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      return data;
    },
  });

  const getEventoData = (evento: any) => {
    const eventoId = evento.id;
    // Usa data_pagamento se preenchida; caso null, atribui ao mês do evento
    const partEntries = participantes
      .filter((p: any) => {
        if (p.evento_id !== eventoId) return false;
        const dataRef = p.data_pagamento || evento.data;
        return isInMonth(dataRef, mes, ano);
      })
      .map((p: any) => ({
        nome: p.nome || "—",
        valor: Number(p.valor) || 0,
        conta: p.contas_bancarias?.nome || "—",
        forma: p.forma_pagamento || "—",
        data: p.data_pagamento,
      }));

    const totalEntradas = partEntries.reduce((s, a) => s + a.valor, 0);
    const despesasEvento = despesas.filter((d: any) => d.evento_id === eventoId);
    const totalDespesas = despesasEvento.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const liquido = totalEntradas - totalDespesas;

    return {
      partEntries,
      totalPagos: partEntries.length,
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
        eventos.filter((evento: any) => isInMonth(evento.data, mes, ano)).map((evento: any) => {
          const isExpanded = expandedEvento === evento.id;
          const data = isExpanded ? getEventoData(evento) : null;

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
                      <p className="font-bold text-sm">{data.totalPagos} pagos</p>
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
