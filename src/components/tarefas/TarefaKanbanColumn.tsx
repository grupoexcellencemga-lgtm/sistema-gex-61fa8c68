import { useDroppable } from "@dnd-kit/core";
import { TarefaCard } from "./TarefaCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import type { TarefaRow, ProfileSelect } from "@/types";

interface Props {
  columnKey: string;
  label: string;
  icon: LucideIcon;
  color: string;
  tarefas: TarefaRow[];
  onEdit: (t: TarefaRow) => void;
  onDelete: (id: string) => void;
  profiles: ProfileSelect[];
}

export function TarefaKanbanColumn({ columnKey, label, icon: Icon, color, tarefas, onEdit, onDelete, profiles }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: columnKey });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Icon className={cn("h-4 w-4", color)} />
        <h3 className="text-sm font-semibold">{label}</h3>
        <Badge variant="secondary" className="text-xs ml-auto">{tarefas.length}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "space-y-2 min-h-[200px] p-2 rounded-lg border border-dashed transition-colors",
          isOver ? "bg-primary/5 border-primary ring-2 ring-primary/20" : "bg-muted/30"
        )}
      >
        {tarefas.map((t) => (
          <TarefaCard
            key={t.id}
            tarefa={t}
            onEdit={onEdit}
            onDelete={onDelete}
            profiles={profiles}
          />
        ))}
        {tarefas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Arraste tarefas aqui</p>
        )}
      </div>
    </div>
  );
}
