import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, CreditCard, ArrowRight, MessageSquare, Phone, Mail, FileText, Loader2 } from "lucide-react";

const iconMap: Record<string, any> = {
  matricula: GraduationCap,
  pagamento: CreditCard,
  avanco_etapa: ArrowRight,
  ligacao: Phone,
  email: Mail,
  observacao: MessageSquare,
  documento: FileText,
};

const colorMap: Record<string, string> = {
  matricula: "text-primary bg-primary/10 border-primary/30",
  pagamento: "text-success bg-success/10 border-success/30",
  avanco_etapa: "text-warning bg-warning/10 border-warning/30",
  ligacao: "text-muted-foreground bg-secondary border-border",
  email: "text-muted-foreground bg-secondary border-border",
  observacao: "text-muted-foreground bg-secondary border-border",
  documento: "text-muted-foreground bg-secondary border-border",
};

const formatTimeAgo = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d atrás`;
  return d.toLocaleDateString("pt-BR");
};

interface ActivityTimelineProps {
  alunoId?: string;
  leadId?: string;
}

export function ActivityTimeline({ alunoId, leadId }: ActivityTimelineProps) {
  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["atividades", alunoId, leadId],
    queryFn: async () => {
      let query = supabase.from("atividades").select("*").order("created_at", { ascending: false }).limit(50);
      if (alunoId) query = query.eq("aluno_id", alunoId);
      if (leadId) query = query.eq("lead_id", leadId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!(alunoId || leadId),
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  }

  if (atividades.length === 0) {
    return (
      <div className="text-center py-6">
        <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {atividades.map((a, i) => {
        const Icon = iconMap[a.tipo] || MessageSquare;
        const colors = colorMap[a.tipo] || colorMap.observacao;

        return (
          <div key={a.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${colors}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {i < atividades.length - 1 && <div className="w-0.5 flex-1 my-1 bg-border" />}
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm">{a.descricao}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(a.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} · {formatTimeAgo(a.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper to log an activity
export async function logActivity(params: {
  tipo: string;
  descricao: string;
  aluno_id?: string | null;
  lead_id?: string | null;
  autor_id?: string | null;
}) {
  await supabase.from("atividades").insert({
    tipo: params.tipo,
    descricao: params.descricao,
    aluno_id: params.aluno_id || null,
    lead_id: params.lead_id || null,
    autor_id: params.autor_id || null,
  });
}
