import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, MessageSquare, Phone, User, ArrowRightFromLine } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types";
import type { FunilEtapa } from "./funilUtils";

type Mensagem = {
  id: string;
  conteudo: string;
  direcao: "entrada" | "saida";
  canal: string;
  lido: boolean | null;
  created_at: string;
};

interface CrmInboxProps {
  quadroId: string;
  etapas: FunilEtapa[];
  canal: "whatsapp" | "instagram";
  onLeadClick?: (lead: LeadRow) => void;
}

export function CrmInbox({ quadroId, etapas, canal, onLeadClick }: CrmInboxProps) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveQuadroId, setMoveQuadroId] = useState("");
  const [moveEtapaId, setMoveEtapaId] = useState("");
  const [moving, setMoving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const etapaIds = etapas.map((e) => e.id);

  type Canal = { id: string; nome: string };
  const { data: canais = [] } = useQuery<Canal[]>({
    queryKey: ["canais-crm-list", empresaId, canal],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("canais_crm")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("tipo", canal)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Canal[];
    },
    enabled: !!empresaId,
  });

  const canaisMap = Object.fromEntries(canais.map((c) => [c.id, c.nome]));

  type Quadro = { id: string; nome: string };
  const { data: quadrosDestino = [] } = useQuery<Quadro[]>({
    queryKey: ["quadros-destino", empresaId, quadroId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_quadros")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .neq("id", quadroId)
        .neq("fixo", true)
        .order("nome");
      if (error) throw error;
      return data as Quadro[];
    },
    enabled: !!empresaId,
  });

  type Etapa = { id: string; nome: string; ordem: number };
  const { data: etapasDestino = [] } = useQuery<Etapa[]>({
    queryKey: ["etapas-destino", moveQuadroId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_etapas")
        .select("id, nome, ordem")
        .eq("quadro_id", moveQuadroId)
        .order("ordem");
      if (error) throw error;
      return data as Etapa[];
    },
    enabled: !!moveQuadroId,
  });

  async function handleMover() {
    if (!moveEtapaId || !selectedLeadId) return;
    setMoving(true);
    try {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ etapa_id: moveEtapaId })
        .eq("id", selectedLeadId);
      if (error) throw error;
      toast.success("Lead movido para o quadro!");
      setMoveOpen(false);
      setMoveQuadroId("");
      setMoveEtapaId("");
      setSelectedLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId] });
    } catch (err: any) {
      toast.error("Erro ao mover: " + err.message);
    } finally {
      setMoving(false);
    }
  }

  const { data: leads = [], isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["crm-leads", quadroId, empresaId],
    queryFn: async () => {
      if (etapaIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("leads")
        .select("*")
        .eq("empresa_id", empresaId!)
        .in("etapa_id", etapaIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
    enabled: !!empresaId && etapaIds.length > 0,
  });

  const leadsFiltered = filtroCanal === "todos"
    ? leads
    : leads.filter((l) => (l as any).canal_id === filtroCanal);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  const { data: mensagens = [], isLoading: msgsLoading } = useQuery<Mensagem[]>({
    queryKey: ["mensagens-crm", selectedLeadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mensagens_crm")
        .select("*")
        .eq("lead_id", selectedLeadId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Mensagem[];
    },
    enabled: !!selectedLeadId,
  });

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedLeadId) return;
    const channel = supabase
      .channel(`mensagens-crm-${selectedLeadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens_crm",
          filter: `lead_id=eq.${selectedLeadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeadId, queryClient]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Also subscribe to new leads so the list updates in real-time
  useEffect(() => {
    if (!empresaId || etapaIds.length === 0) return;
    const channel = supabase
      .channel(`crm-leads-${quadroId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        () => queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empresaId, quadroId, queryClient]);

  async function handleSend() {
    if (!replyText.trim() || !selectedLeadId) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("enviar-mensagem", {
        body: { lead_id: selectedLeadId, mensagem: replyText.trim() },
      });
      if (error) throw error;
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message ?? String(err)));
    } finally {
      setSending(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const isWhatsApp = canal === "whatsapp";

  return (
    <div className="flex h-full" style={{ height: "calc(100svh - 18rem)", minHeight: "400px" }}>
      {/* Lead list */}
      <div className="w-72 shrink-0 border-r flex flex-col bg-card">
        {/* Canal tabs */}
        {canais.length > 1 && (
          <div className="border-b overflow-x-auto">
            <div className="flex min-w-max">
              <button
                onClick={() => { setFiltroCanal("todos"); setSelectedLeadId(null); }}
                className={cn(
                  "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                  filtroCanal === "todos"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                Todos ({leads.length})
              </button>
              {canais.map((c) => {
                const count = leads.filter((l) => (l as any).canal_id === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setFiltroCanal(c.id); setSelectedLeadId(null); }}
                    className={cn(
                      "px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors",
                      filtroCanal === c.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c.nome} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="p-3 border-b">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {leadsFiltered.length} conversa{leadsFiltered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <ScrollArea className="flex-1">
          {leadsLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : leadsFiltered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-xs">Nenhuma mensagem recebida ainda.</p>
              {isWhatsApp && (
                <p className="text-xs opacity-70">
                  Quando alguém enviar mensagem para o WhatsApp conectado, aparecerá aqui.
                </p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {leadsFiltered.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-2",
                    selectedLeadId === lead.id && "bg-primary/10"
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-medium truncate">{lead.nome}</p>
                      {(lead as any).canal_id && canaisMap[(lead as any).canal_id] && (
                        <span className="shrink-0 inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          {canaisMap[(lead as any).canal_id]}
                        </span>
                      )}
                    </div>
                    {(lead as any).contato_id && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {(lead as any).contato_id}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat panel */}
      {selectedLead ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedLead.nome}</p>
                {(selectedLead as any).contato_id && (
                  <p className="text-xs text-muted-foreground">{(selectedLead as any).contato_id}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {onLeadClick && (
                <Button size="sm" variant="outline" onClick={() => onLeadClick(selectedLead)}>
                  Ver lead
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="text-primary border-primary/40 hover:bg-primary/5"
                onClick={() => { setMoveQuadroId(""); setMoveEtapaId(""); setMoveOpen(true); }}
              >
                <ArrowRightFromLine className="h-3.5 w-3.5 mr-1" />
                Mover para quadro
              </Button>
              <Badge variant="outline" className="text-xs capitalize">{canal}</Badge>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20"
          >
            {msgsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : mensagens.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem ainda.</p>
            ) : (
              mensagens.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.direcao === "saida" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      msg.direcao === "saida"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.direcao === "saida" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"
                    )}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Reply box */}
          {isWhatsApp ? (
            <div className="p-3 border-t bg-card flex gap-2">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={sending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={sending || !replyText.trim()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="p-3 border-t bg-card">
              <p className="text-xs text-muted-foreground text-center">
                Resposta direta pelo Instagram não disponível. Acesse o Instagram para responder.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-20" />
          <p className="text-sm">Selecione uma conversa para visualizar</p>
        </div>
      )}

      {/* Dialog — Mover para quadro */}
      <Dialog open={moveOpen} onOpenChange={(v) => { setMoveOpen(v); if (!v) { setMoveQuadroId(""); setMoveEtapaId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightFromLine className="h-4 w-4 text-primary" />
              Mover para quadro
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{selectedLead?.nome}</strong> sairá da entrada e entrará no quadro selecionado.
            </p>

            <div className="space-y-1.5">
              <p className="text-xs font-medium">Quadro de destino</p>
              <Select value={moveQuadroId} onValueChange={(v) => { setMoveQuadroId(v); setMoveEtapaId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o quadro..." />
                </SelectTrigger>
                <SelectContent>
                  {quadrosDestino.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum quadro disponível</SelectItem>
                  ) : (
                    quadrosDestino.map((q) => (
                      <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {moveQuadroId && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Etapa de entrada</p>
                <Select value={moveEtapaId} onValueChange={setMoveEtapaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a etapa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {etapasDestino.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleMover}
              disabled={moving || !moveQuadroId || !moveEtapaId}
            >
              {moving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mover lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
