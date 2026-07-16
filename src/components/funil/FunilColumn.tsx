import { useDroppable } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { ETAPA_CORES, type FunilEtapa } from "./funilUtils";
import type { LeadRow } from "@/types";

interface Props {
  etapa: FunilEtapa;
  leads: LeadRow[];
  comerciaisMap: Map<string, string>;
  onLeadClick: (lead: LeadRow) => void;
  onDeleteLead: (lead: LeadRow) => void;
  onEditEtapa: (etapa: FunilEtapa) => void;
  onDeleteEtapa: (etapa: FunilEtapa) => void;
  onMoveEtapa: (etapa: FunilEtapa, direction: -1 | 1) => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}

export function FunilColumn({
  etapa,
  leads,
  comerciaisMap,
  onLeadClick,
  onDeleteLead,
  onEditEtapa,
  onDeleteEtapa,
  onMoveEtapa,
  canMoveLeft,
  canMoveRight,
}: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: etapa.id });
  const cores = ETAPA_CORES[etapa.cor] || ETAPA_CORES.slate;

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] max-w-[280px] shrink-0">
      <div className="flex items-center justify-between gap-1 mb-3 group">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cores.dot}`} />
          <h3 className="text-sm font-semibold leading-tight break-words min-w-0">{etapa.nome}</h3>
          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5 shrink-0">
            {leads.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canMoveLeft} onClick={() => onMoveEtapa(etapa, -1)} title="Mover para a esquerda">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canMoveRight} onClick={() => onMoveEtapa(etapa, 1)} title="Mover para a direita">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditEtapa(etapa)} title="Editar coluna">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteEtapa(etapa)} title="Excluir coluna">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[140px] rounded-lg p-2 transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        }`}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            comercialNome={lead.responsavel_id ? comerciaisMap.get(lead.responsavel_id) : undefined}
            onClick={() => onLeadClick(lead)}
            onDelete={() => onDeleteLead(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
            Nenhum lead
          </div>
        )}
      </div>
    </div>
  );
}
