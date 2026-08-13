import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, User, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types";

interface Props {
  lead: LeadRow;
  comercialNome?: string;
  onClick: () => void;
  onDelete?: () => void;
  isOverlay?: boolean;
}

export function LeadCard({ lead, comercialNome, onClick, onDelete, isOverlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = isOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 50 : undefined,
        touchAction: "none" as const,
      };

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={style}
      {...(isOverlay ? {} : { ...listeners, ...attributes })}
    >
      <Card
        className={cn(
          "group/card relative cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md border",
          isOverlay && "shadow-xl rotate-1 cursor-grabbing ring-2 ring-primary/30"
        )}
        onClick={() => { if (!isDragging && !isOverlay) onClick(); }}
      >
        <CardContent className="p-3">
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover/card:opacity-100 text-muted-foreground hover:text-destructive z-10"
              title="Excluir lead"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          <p className="font-medium text-sm truncate pr-6">{lead.nome}</p>
          {lead.produto_interesse && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{lead.produto_interesse}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {lead.origem && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{lead.origem}</Badge>}
            {lead.cidade && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-2.5 w-2.5" />{lead.cidade}
              </span>
            )}
          </div>
          {comercialNome && (
            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
              <User className="h-2.5 w-2.5" />
              <span className="truncate">{comercialNome}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
