import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Trash2, Check, Ban, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { statusMap, calcularProgressoFinanceiro, formatarProgressoSessoes } from "./processosUtils";
import { LancamentosDialog } from "./LancamentosDialog";

interface Props {
  processos: any[];
  pagamentosTotalPorProcesso: Record<string, number>;
  onSelect: (p: any) => void;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
  onFinalize: (id: string) => void;
  onCancel: (p: any) => void;
  onSessao: (id: string, sessoes_realizadas: number) => void;
  contas: any[];
}

export function ProcessoTable({
  processos, pagamentosTotalPorProcesso, onSelect, onEdit, onDelete, onFinalize, onCancel, onSessao, contas,
}: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="text-center">Progresso</TableHead>
              <TableHead className="text-center">Sessões</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Início</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {processos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum processo encontrado</TableCell>
              </TableRow>
            ) : (
              processos.map((p: any) => {
                const st = statusMap[p.status] || statusMap.aberto;
                const totalP = Number(p.valor_total || 0);
                const recebido = pagamentosTotalPorProcesso[p.id] || 0;
                const progresso = calcularProgressoFinanceiro(totalP, recebido);
                const sessoesRealizadas = Number(p.sessoes_realizadas || 0);
                const sessoesTotal = Number(p.sessoes || 1);
                return (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(p)}>
                    <TableCell className="font-medium">{p.cliente_nome}</TableCell>
                    <TableCell>{p.responsavel}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalP)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", progresso >= 100 ? "bg-green-500" : "bg-primary")} style={{ width: `${progresso}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{progresso}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sessoesRealizadas <= 0 || p.status !== "aberto"} onClick={() => onSessao(p.id, sessoesRealizadas - 1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className={cn("text-sm font-medium min-w-[40px]", sessoesRealizadas >= sessoesTotal ? "text-green-600" : "")}>
                          {formatarProgressoSessoes(sessoesRealizadas, sessoesTotal)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={sessoesRealizadas >= sessoesTotal || p.status !== "aberto"} onClick={() => onSessao(p.id, sessoesRealizadas + 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell className="text-center">{formatDate(p.data_inicio)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <LancamentosDialog processo={p} contas={contas} />
                        {p.status === "aberto" && (
                          <>
                            <Button variant="ghost" size="icon" title="Finalizar" onClick={() => { if (confirm("Finalizar este processo?")) onFinalize(p.id); }}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Cancelar" onClick={() => onCancel(p)}>
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Excluir este processo?")) onDelete(p.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
