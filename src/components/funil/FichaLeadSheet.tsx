import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/utils";
import { ExternalLink, MessageSquare } from "lucide-react";
import { FichaLeadPanel } from "./FichaLeadPanel";

export interface LeadResumido {
  id: string;
  nome: string | null;
  telefone: string | null;
  contato_id: string | null;
  tipo_contato: string;
}

interface Props {
  lead: LeadResumido | null;
  onClose: () => void;
  onTipoAlterado: (tipo: string) => void;
}

// O webhook grava o telefone com DDI; o formatPhone espera o número nacional e
// leria o "55" como DDD.
function telefoneNacional(telefone: string | null): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  return digitos.length >= 12 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

// contato_id vem do WhatsApp já com DDI; telefone digitado à mão pode vir sem.
function linkWhatsapp(lead: LeadResumido): string | null {
  const digitos = (lead.contato_id || lead.telefone || "").replace(/\D/g, "");
  if (!digitos) return null;
  return `https://wa.me/${digitos.length <= 11 ? `55${digitos}` : digitos}`;
}

// Ficha aberta direto do painel "Precisam de você". A equipe responde pelo
// WhatsApp do computador, não pela caixa de entrada do sistema, então o
// caminho útil é: ler a ficha e ir responder lá.
export function FichaLeadSheet({ lead, onClose, onTipoAlterado }: Props) {
  const navigate = useNavigate();
  const whatsapp = lead ? linkWhatsapp(lead) : null;

  return (
    <Sheet open={!!lead} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.nome || formatPhone(telefoneNacional(lead.telefone)) || "Contato sem nome"}</SheetTitle>
              {lead.telefone && <SheetDescription>{formatPhone(telefoneNacional(lead.telefone))}</SheetDescription>}
            </SheetHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              {whatsapp && (
                <Button asChild size="sm" className="gap-1.5">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Responder no WhatsApp
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/funil")}>
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir no Funil
              </Button>
            </div>

            <div className="mt-6">
              <FichaLeadPanel
                key={lead.id}
                leadId={lead.id}
                tipoContato={lead.tipo_contato}
                onTipoAlterado={onTipoAlterado}
              />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
