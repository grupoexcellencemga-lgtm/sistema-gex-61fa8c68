import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";
import type { LeadRow } from "@/types";

interface Props {
  etapa: { key: string; label: string; color: string };
  leads: LeadRow[];
  comerciaisMap: Map<string, string>;
  onLeadClick: (lead: LeadRow) => void;
}

export function FunilColumn({ etapa, leads, comerciaisMap, onLeadClick }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: etapa.key });

  return (
    <div className="flex flex-col min-w-[280px] snap-center md:min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">{etapa.label}</h3>
        <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5">
          {leads.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[120px] rounded-lg p-2 transition-colors ${
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        }`}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            comercialNome={lead.responsavel_id ? comerciaisMap.get(lead.responsavel_id) : undefined}
            onClick={() => onLeadClick(lead)}
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
