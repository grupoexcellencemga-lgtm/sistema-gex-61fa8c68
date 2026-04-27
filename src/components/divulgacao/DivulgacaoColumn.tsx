import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DivulgacaoCard, type Divulgacao } from "./DivulgacaoCard";
import type { DivulgacaoColuna } from "./DivulgacaoColunaDialog";

const COR_MAP: Record<string, string> = {
  slate:  "text-slate-600 dark:text-slate-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  orange: "text-orange-600 dark:text-orange-400",
  blue:   "text-blue-600 dark:text-blue-400",
  green:  "text-green-600 dark:text-green-400",
  red:    "text-red-600 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
  pink:   "text-pink-600 dark:text-pink-400",
  teal:   "text-teal-600 dark:text-teal-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
};

const BORDER_MAP: Record<string, string> = {
  slate:  "border-slate-300 dark:border-slate-600",
  yellow: "border-yellow-300 dark:border-yellow-700",
  orange: "border-orange-300 dark:border-orange-700",
  blue:   "border-blue-300 dark:border-blue-700",
  green:  "border-green-300 dark:border-green-700",
  red:    "border-red-300 dark:border-red-700",
  purple: "border-purple-300 dark:border-purple-700",
  pink:   "border-pink-300 dark:border-pink-700",
  teal:   "border-teal-300 dark:border-teal-700",
  indigo: "border-indigo-300 dark:border-indigo-700",
};

interface Props {
  coluna: DivulgacaoColuna;
  items: Divulgacao[];
  onEdit: (d: Divulgacao) => void;
  onDelete: (id: string) => void;
  onAdd: (colunaId: string) => void;
  onViewFile: (d: Divulgacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  onEditColuna: (coluna: DivulgacaoColuna) => void;
  onDeleteColuna: (id: string) => void;
  onDropCard: (cardId: string, targetColunaId: string) => void;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

export function DivulgacaoColumn({
  coluna,
  items,
  onEdit,
  onDelete,
  onAdd,
  onViewFile,
  onToggleAtivo,
  onEditColuna,
  onDeleteColuna,
  onDropCard,
  draggingId,
  onDragStart,
  onDragEnd,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const corText = COR_MAP[coluna.cor] ?? COR_MAP.blue;
  const corBorder = BORDER_MAP[coluna.cor] ?? BORDER_MAP.blue;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggingId) onDropCard(draggingId, coluna.id);
  };

  return (
    <div className="flex flex-col min-w-[280px] md:min-w-0 flex-1">
      {/* Cabeçalho da coluna */}
      <div className={`flex items-center justify-between mb-3 px-1 pb-2 border-b-2 ${corBorder}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{coluna.icone}</span>
          <h3 className={`text-sm font-semibold ${corText}`}>{coluna.nome}</h3>
          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5 min-w-[20px] text-center">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity [.group:hover_&]:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onAdd(coluna.id)}
            title="Novo card"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onEditColuna(coluna)}
            title="Editar coluna"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteColuna(coluna.id)}
            title="Excluir coluna"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Corpo da coluna — drop zone */}
      <div
        className={`flex-1 space-y-2 min-h-[200px] rounded-xl p-2 border transition-colors ${
          isDragOver
            ? `bg-primary/5 border-primary/40 border-dashed`
            : "bg-muted/30 border-border/40"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing"
          >
            <DivulgacaoCard
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewFile={onViewFile}
              onToggleAtivo={onToggleAtivo}
              isDragging={draggingId === item.id}
            />
          </div>
        ))}

        {items.length === 0 && (
          <div
            className={`flex flex-col items-center justify-center py-10 text-xs text-muted-foreground border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
              isDragOver ? "border-primary/60 text-primary" : ""
            }`}
            onClick={() => onAdd(coluna.id)}
          >
            <Plus className="h-5 w-5 mb-1 opacity-50" />
            <span>{isDragOver ? "Soltar aqui" : "Nenhum card"}</span>
            {!isDragOver && <span className="opacity-60">Clique para adicionar</span>}
          </div>
        )}
      </div>
    </div>
  );
}
