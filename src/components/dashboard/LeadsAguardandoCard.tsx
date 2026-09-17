import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TIPOS_CLIENTE,
  rotuloTipoContato,
  slaLabel,
  minutosAguardando,
  SLA_MINUTOS_PADRAO,
  type FichaLead,
} from "@/components/funil/funilUtils";
import { FichaLeadSheet } from "@/components/funil/FichaLeadSheet";
import { toast } from "sonner";
import { Check, ChevronRight, MessageSquareWarning, Sparkles } from "lucide-react";

const LIMITE_EXIBIDO = 8;

interface LeadAguardando {
  id: string;
  nome: string | null;
  telefone: string | null;
  contato_id: string | null;
  ultima_mensagem_em: string | null;
  ultima_mensagem_direcao: string | null;
  ultima_mensagem_texto: string | null;
  sla_minutos: number | null;
  tipo_contato: string;
  leads_ficha_ia: { ficha: FichaLead } | { ficha: FichaLead }[] | null;
}

function fichaDe(lead: LeadAguardando): FichaLead | null {
  const f = lead.leads_ficha_ia;
  if (!f) return null;
  return Array.isArray(f) ? f[0]?.ficha ?? null : f.ficha;
}

export function LeadsAguardandoCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [aberto, setAberto] = useState<LeadAguardando | null>(null);

  const { data: leads = [] } = useQuery<LeadAguardando[]>({
    queryKey: ["inicio-leads-aguardando", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, nome, telefone, contato_id, ultima_mensagem_em, ultima_mensagem_direcao, ultima_mensagem_texto, sla_minutos, tipo_contato, leads_ficha_ia(ficha)"
        )
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .eq("ultima_mensagem_direcao", "entrada")
        .not("ultima_mensagem_em", "is", null)
        // Fornecedor e equipe não são cliente esperando; conversa resolvida
        // não pede resposta (volta sozinha quando a pessoa escreve de novo).
        .in("tipo_contato", TIPOS_CLIENTE)
        .neq("status_atendimento", "finalizado")
        .order("ultima_mensagem_em", { ascending: true })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as unknown as LeadAguardando[];
    },
    enabled: !!empresaId,
    // O rótulo é calculado sobre o relógio, então precisa reavaliar sozinho.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["inicio-leads-aguardando"] });

  // Mesma sequência do "Finalizar" da caixa de entrada: fecha o protocolo e
  // marca o lead. O webhook reabre sozinho quando a pessoa volta a escrever.
  const resolver = useMutation({
    mutationFn: async (leadId: string) => {
      const { error: erroProtocolo } = await supabase.rpc("finalizar_protocolo", { p_lead_id: leadId });
      if (erroProtocolo) throw erroProtocolo;
      const { error } = await supabase
        .from("leads")
        .update({ status_atendimento: "finalizado", bot_ativo: false })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como resolvido. Volta para a lista se a pessoa escrever de novo.");
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível marcar como resolvido: " + e.message),
  });

  const confirmarTipo = useMutation({
    mutationFn: async ({ leadId, tipo }: { leadId: string; tipo: string }) => {
      const { error } = await supabase.from("leads").update({ tipo_contato: tipo }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: (_, { tipo }) => {
      toast.success(`Marcado como ${rotuloTipoContato(tipo).toLowerCase()} e retirado das pendências.`);
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível alterar o tipo: " + e.message),
  });

  const atrasados = leads.filter((l) => {
    const min = minutosAguardando(l);
    return min !== null && min >= (l.sla_minutos ?? SLA_MINUTOS_PADRAO);
  });

  if (atrasados.length === 0) return null;

  const visiveis = atrasados.slice(0, LIMITE_EXIBIDO);
  const restantes = atrasados.length - visiveis.length;
  const ocupado = resolver.isPending || confirmarTipo.isPending;

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-destructive" />
          Precisam de você
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {atrasados.length} aguardando resposta
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {visiveis.map((lead) => {
          const sla = slaLabel(lead);
          const ficha = fichaDe(lead);
          const sugereNaoCliente =
            ficha && !TIPOS_CLIENTE.includes(ficha.tipo_contato) ? ficha.tipo_contato : null;

          return (
            <div key={lead.id} className="rounded-lg border p-3 space-y-2">
              <button
                onClick={() => setAberto(lead)}
                className="w-full text-left rounded-md transition-colors hover:bg-muted/40 -m-1 p-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {lead.nome || lead.telefone || "Sem nome"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </div>
                    {lead.ultima_mensagem_texto && (
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.ultima_mensagem_texto}
                      </div>
                    )}
                  </div>
                  {sla && (
                    <div className={`text-sm shrink-0 whitespace-nowrap ${sla.color}`}>{sla.text}</div>
                  )}
                </div>
                {ficha?.resumo && (
                  <p className="mt-1.5 flex gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-primary/70" aria-hidden />
                    <span className="line-clamp-2">{ficha.resumo}</span>
                  </p>
                )}
              </button>

              <div className="flex items-center justify-end gap-2 flex-wrap">
                {sugereNaoCliente && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40 mr-auto"
                    disabled={ocupado}
                    onClick={() => confirmarTipo.mutate({ leadId: lead.id, tipo: sugereNaoCliente })}
                    title="A IA leu a conversa e acha que este contato não é cliente"
                  >
                    É {rotuloTipoContato(sugereNaoCliente).toLowerCase()}? Confirmar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  disabled={ocupado}
                  onClick={() => resolver.mutate(lead.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Resolvido
                </Button>
              </div>
            </div>
          );
        })}

        {restantes > 0 && (
          <button
            onClick={() => navigate("/funil")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            e mais {restantes} {restantes === 1 ? "lead" : "leads"} aguardando
          </button>
        )}
      </CardContent>

      <FichaLeadSheet
        lead={aberto}
        onClose={() => setAberto(null)}
        onTipoAlterado={(tipo) => setAberto((atual) => (atual ? { ...atual, tipo_contato: tipo } : atual))}
      />
    </Card>
  );
}
