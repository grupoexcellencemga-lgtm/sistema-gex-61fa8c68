import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LucideIcon } from "lucide-react";

export interface MetricDetailItem {
  nome: string;
  data: string;
  valor: string;
}

interface MetricDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: LucideIcon;
  iconClass?: string;
  items: MetricDetailItem[];
}

import { formatDate } from "@/lib/formatters";

export function MetricDetailDialog({ open, onOpenChange, title, icon: Icon, iconClass, items }: MetricDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className={`h-5 w-5 ${iconClass || "text-muted-foreground"}`} />}
            {title}
          </DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                  <TableCell className="text-sm">{formatDate(item.data)}</TableCell>
                  <TableCell className="text-sm text-right">{item.valor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground text-right">{items.length} registro{items.length !== 1 ? "s" : ""}</p>
      </DialogContent>
    </Dialog>
  );
}
