import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { DivulgacaoCard, type Divulgacao } from "./DivulgacaoCard";

interface Column {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface Props {
  column: Column;
  items: Divulgacao[];
  onEdit: (d: Divulgacao) => void;
  onDelete: (id: string) => void;
  onAdd: (status: string) => void;
}

export function DivulgacaoColumn({ column, items, onEdit, onDelete, onAdd }: Props) {
  return (
    <div className="flex flex-col min-w-[300px] md:min-w-0 flex-1">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{column.icon}</span>
          <h3 className="text-sm font-semibold">{column.label}</h3>
          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {items.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onAdd(column.key)} title={`Novo card em ${column.label}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-2 min-h-[200px] rounded-xl p-2 bg-muted/30 border border-border/40">
        {items.map((item) => (
          <DivulgacaoCard key={item.id} divulgacao={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onAdd(column.key)}>
            <Plus className="h-5 w-5 mb-1 opacity-50" />
            <span>Nenhum item</span>
            <span className="opacity-60">Clique para adicionar</span>
          </div>
        )}
      </div>
    </div>
  );
}