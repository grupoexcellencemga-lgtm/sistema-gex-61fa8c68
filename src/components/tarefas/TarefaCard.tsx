import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pencil, Trash2, Calendar, Clock, User, Link2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { TarefaRow, ProfileSelect } from "@/types";

const prioridadeColors: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  alta: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  urgente: "bg-destructive/10 text-destructive",
};

const tipoLabels: Record<string, string> = {
  follow_up: "Follow-up",
  cobranca: "Cobrança",
  lembrete: "Lembrete",
  reuniao: "Reunião",
  outro: "Outro",
};

interface Props {
  tarefa: TarefaRow;
  onEdit: (t: TarefaRow) => void;
  onDelete: (id: string) => void;
  profiles?: ProfileSelect[];
}

export function TarefaCard({ tarefa, onEdit, onDelete, profiles = [] }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarefa.id,
    data: { tarefa },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    touchAction: "none" as const,
  };

  const responsavel = profiles.find((p) => p.user_id === tarefa.responsavel_id);
  const isVencida = tarefa.data_vencimento && new Date(tarefa.data_vencimento + "T23:59:59") < new Date() && tarefa.status !== "concluida";

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className={cn(
          "p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow",
          isVencida && "border-destructive/50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight flex-1">{tarefa.titulo}</h4>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(tarefa); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(tarefa.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", prioridadeColors[tarefa.prioridade])}>
            {tarefa.prioridade}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {tipoLabels[tarefa.tipo] || tarefa.tipo}
          </Badge>
        </div>

        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {tarefa.data_vencimento && (
            <span className={cn("flex items-center gap-1", isVencida && "text-destructive font-medium")}>
              <Calendar className="h-3 w-3" />
              {format(new Date(tarefa.data_vencimento + "T12:00:00"), "dd/MM", { locale: ptBR })}
            </span>
          )}
          {tarefa.hora && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tarefa.hora.substring(0, 5)}
            </span>
          )}
          {responsavel && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {responsavel.nome?.split(" ")[0]}
            </span>
          )}
          {(tarefa.aluno_id || tarefa.lead_id || tarefa.processo_id) && (
            <Link2 className="h-3 w-3" />
          )}
        </div>
      </Card>
    </div>
  );
}
