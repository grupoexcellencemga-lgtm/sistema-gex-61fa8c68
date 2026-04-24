import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, User } from "lucide-react";
import type { LeadRow } from "@/types";

interface Props {
  lead: LeadRow;
  comercialNome?: string;
  onClick: () => void;
}

export function LeadCard({ lead, comercialNome, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    touchAction: "none" as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Card
        className="cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md border"
        onClick={(e) => {
          if (!isDragging) onClick();
        }}
      >
        <CardContent className="p-3">
          <p className="font-medium text-sm truncate">{lead.nome}</p>
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
