import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Users, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatDate, formatCurrencyNullable as formatCurrency } from "@/lib/formatters";

interface Props {
  eventos: any[];
  isLoading: boolean;
  countParticipantes: (id: string) => number;
  onSelect: (evento: any) => void;
  onEdit: (evento: any) => void;
  onDelete: (id: string) => void;
}

export function EventoTable({ eventos, isLoading, countParticipantes, onSelect, onEdit, onDelete }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventos.map((e: any) => {
                const total = countParticipantes(e.id);
                return (
                  <TableRow key={e.id} className="cursor-pointer transition-snappy hover:bg-secondary/50" onClick={() => onSelect(e)}>
                    <TableCell>
                      <div><p className="font-medium text-sm">{e.nome}</p><p className="text-xs text-muted-foreground">{e.tipo}</p></div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(e.data)}</TableCell>
                    <TableCell><div className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{e.local || "—"}</div></TableCell>
                    <TableCell className="text-sm">{e.responsavel || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-sm"><Users className="h-3 w-3" />{total}{e.limite_participantes ? `/${e.limite_participantes}` : ""}</div>
                        {e.limite_participantes && total >= e.limite_participantes * 0.9 && <Badge variant="destructive" className="text-xs">Quase lotado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.pago ? <Badge className="bg-amber-600 text-white">{formatCurrency(e.valor)}</Badge> : <Badge variant="secondary">Gratuito</Badge>}
                    </TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(e)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Excluir este evento?")) onDelete(e.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {eventos.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum evento cadastrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
