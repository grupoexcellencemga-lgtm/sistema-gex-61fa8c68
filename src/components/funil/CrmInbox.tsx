import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Send, Loader2, MessageSquare, Phone, User, ArrowRightFromLine, Settings2,
  ExternalLink, ChevronDown, RefreshCw, UserCheck, CheckCircle2, Clock, Users, Hash, Bot,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

type Protocolo = {
  id: string;
  numero_protocolo: string;
  lead_id: string;
  atendente_id: string | null;
  status: string;
  iniciado_em: string;
  finalizado_em: string | null;
  leads: { nome: string; foto_perfil: string | null; contato_id: string | null } | null;
};

type AbaAtendimento = "fila" | "minhas" | "finalizadas";

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
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const userId = user?.id;

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedProtocolo, setSelectedProtocolo] = useState<Protocolo | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState<string>("todos");
  const [aba, setAba] = useState<AbaAtendimento>("fila");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveQuadroId, setMoveQuadroId] = useState("");
  const [moveEtapaId, setMoveEtapaId] = useState("");
  const [moving, setMoving] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [listWidth, setListWidth] = useState(() => {
    try { const v = localStorage.getItem("crm-inbox-list-width"); return v ? Math.max(200, Math.min(520, Number(v))) : 360; } catch { return 360; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = listWidth;

    function onMouseMove(ev: MouseEvent) {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(520, startWidth + ev.clientX - startX));
      setListWidth(newWidth);
      try { localStorage.setItem("crm-inbox-list-width", String(newWidth)); } catch {}
    }
    function onMouseUp() {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [listWidth]);

  const etapaIds = etapas.map((e) => e.id);

  function mudarAba(novaAba: AbaAtendimento) {
    setAba(novaAba);
    setSelectedLeadId(null);
    setSelectedProtocolo(null);
    setFiltroCanal("todos");
    setReplyText("");
  }

  // Usuários da empresa (dropdown de atribuição)
  type UsuarioEmpresa = { user_id: string; nome: string };
  const { data: usuarios = [] } = useQuery<UsuarioEmpresa[]>({
    queryKey: ["usuarios-empresa", empresaId],
    queryFn: async () => {
      const { data: membros } = await (supabase as any)
        .from("user_empresa")
        .select("user_id")
        .eq("empresa_id", empresaId!);
      const userIds = (membros ?? []).map((m: any) => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);
      return (profiles ?? []).map((p: any) => ({ user_id: p.user_id, nome: p.nome ?? "Sem nome" }));
    },
    enabled: !!empresaId,
  });
  const usuariosMap = Object.fromEntries(usuarios.map((u) => [u.user_id, u.nome]));

  type Canal = { id: string; nome: string; cor: string };
  const { data: canais = [] } = useQuery<Canal[]>({
    queryKey: ["canais-crm-list", empresaId, canal],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("canais_crm")
        .select("id, nome, cor")
        .eq("empresa_id", empresaId!)
        .eq("tipo", canal)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Canal[];
    },
    enabled: !!empresaId,
    refetchInterval: 15000,
  });
  const canaisMap = Object.fromEntries(canais.map((c) => [c.id, { nome: c.nome, cor: c.cor || "#6366f1" }]));

  // Quando um canal é desativado/excluído, volta para "todos" se o filtro apontava para ele
  useEffect(() => {
    if (filtroCanal !== "todos" && !canais.find((c) => c.id === filtroCanal)) {
      setFiltroCanal("todos");
      setSelectedLeadId(null);
    }
  }, [canais, filtroCanal]);

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

  // Leads: fila e minhas abas
  const { data: leads = [], isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["crm-leads", quadroId, empresaId, aba, userId, isAdmin],
    queryFn: async () => {
      if (etapaIds.length === 0 || !userId) return [];
      let query = (supabase as any)
        .from("leads")
        .select("*")
        .eq("empresa_id", empresaId!)
        .in("etapa_id", etapaIds)
        .is("deleted_at", null);

      if (aba === "fila") {
        query = query.eq("status_atendimento", "fila");
      } else {
        query = query.eq("status_atendimento", "ativo");
        if (!isAdmin) query = query.eq("atendente_id", userId);
      }

      const { data, error } = await query
        .order("tem_mensagem_nova", { ascending: false })
        .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
    enabled: !!empresaId && !!userId && etapaIds.length > 0 && aba !== "finalizadas",
    refetchInterval: 15000,
  });

  // Protocolos finalizados
  const { data: protocolos = [], isLoading: protocolosLoading } = useQuery<Protocolo[]>({
    queryKey: ["protocolos-finalizados", empresaId, userId, isAdmin],
    queryFn: async () => {
      let query = (supabase as any)
        .from("protocolos_atendimento")
        .select("*, leads(nome, foto_perfil, contato_id)")
        .eq("empresa_id", empresaId!)
        .eq("status", "finalizado");
      if (!isAdmin) query = query.eq("atendente_id", userId!);
      const { data, error } = await query
        .order("finalizado_em", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Protocolo[];
    },
    enabled: !!empresaId && !!userId && aba === "finalizadas",
    refetchInterval: 30000,
  });

  const leadsFiltered = filtroCanal === "todos"
    ? leads
    : leads.filter((l) => (l as any).canal_id === filtroCanal);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;
  const selectedStatus: string = (selectedLead as any)?.status_atendimento ?? "fila";
  const selectedAtendente: string | null = (selectedLead as any)?.atendente_id ?? null;
  const isMyLead = selectedAtendente === userId;
  const canReply = canal === "whatsapp" && selectedStatus === "ativo" && (isMyLead || isAdmin);

  // Mensagens da conversa ativa (fila/minhas)
  const { data: mensagensLead = [], isLoading: msgsLeadLoading } = useQuery<Mensagem[]>({
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
    enabled: !!selectedLeadId && aba !== "finalizadas",
    staleTime: 0,
    refetchInterval: 1000,
  });

  // Mensagens de um protocolo finalizado
  const { data: mensagensProtocolo = [], isLoading: msgsProtoLoading } = useQuery<Mensagem[]>({
    queryKey: ["mensagens-protocolo", selectedProtocolo?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("mensagens_crm")
        .select("*")
        .eq("protocolo_id", selectedProtocolo!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Mensagem[];
    },
    enabled: !!selectedProtocolo?.id && aba === "finalizadas",
    staleTime: 5 * 60 * 1000,
  });

  const mensagens = aba === "finalizadas" ? mensagensProtocolo : mensagensLead;
  const msgsLoading = aba === "finalizadas" ? msgsProtoLoading : msgsLeadLoading;

  // Realtime: novas mensagens
  useEffect(() => {
    if (!selectedLeadId || aba === "finalizadas") return;
    const ch = supabase
      .channel("mensagens-crm-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens_crm" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedLeadId, aba, queryClient]);

  // Realtime: canais_crm (ativação/desativação/exclusão de números)
  useEffect(() => {
    if (!empresaId) return;
    const ch = supabase
      .channel(`canais-crm-${empresaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "canais_crm" }, () => {
        queryClient.invalidateQueries({ queryKey: ["canais-crm-list", empresaId, canal] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, canal, queryClient]);

  // Realtime: atualização de leads
  useEffect(() => {
    if (!empresaId || etapaIds.length === 0) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    const ch = supabase
      .channel(`crm-leads-${quadroId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [empresaId, quadroId, queryClient]);

  // Scroll to bottom — usa anchor div para garantir que funciona após qualquer mudança de layout
  useEffect(() => {
    if (mensagens.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      });
    }
  }, [mensagens, selectedLeadId, selectedProtocolo?.id]);

  async function marcarComoLido(leadId: string) {
    await (supabase as any)
      .from("leads")
      .update({ tem_mensagem_nova: false, mensagens_nao_lidas: 0 })
      .eq("id", leadId);
    queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
  }

  async function assumirOuAtribuir(leadId: string, paraUserId: string) {
    setAtribuindo(true);
    try {
      // Cria protocolo
      const { data: protoData, error: protoErr } = await supabase.rpc("criar_protocolo", {
        p_empresa_id: empresaId,
        p_lead_id: leadId,
        p_atendente_id: paraUserId,
      });
      if (protoErr) throw protoErr;

      const numero = (protoData as any)?.numero_protocolo ?? "";

      // Atualiza lead
      const { error } = await (supabase as any)
        .from("leads")
        .update({ atendente_id: paraUserId, status_atendimento: "ativo", atribuido_em: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;

      const nomeAgente = paraUserId === userId ? "você" : (usuariosMap[paraUserId] ?? "usuário");
      toast.success(`Protocolo ${numero} aberto — atribuído para ${nomeAgente}`);
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setAtribuindo(false);
    }
  }

  async function finalizar(leadId: string) {
    setFinalizando(true);
    try {
      // Fecha o protocolo ativo
      const { error: protoErr } = await supabase.rpc("finalizar_protocolo", { p_lead_id: leadId });
      if (protoErr) throw protoErr;

      // Atualiza lead
      const { error } = await (supabase as any)
        .from("leads")
        .update({ status_atendimento: "finalizado", bot_ativo: false })
        .eq("id", leadId);
      if (error) throw error;

      toast.success("Conversa finalizada! Protocolo encerrado.");
      setSelectedLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["protocolos-finalizados", empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro ao finalizar: " + err.message);
    } finally {
      setFinalizando(false);
    }
  }

  async function toggleBotAtivo(leadId: string, novoValor: boolean) {
    setTogglingBot(true);
    try {
      const { error } = await (supabase as any)
        .from("leads")
        .update({ bot_ativo: novoValor })
        .eq("id", leadId);
      if (error) throw error;
      toast.success(novoValor ? "Bot ativado para esta conversa" : "Bot desativado para esta conversa");
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro ao alterar bot: " + err.message);
    } finally {
      setTogglingBot(false);
    }
  }

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
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro ao mover: " + err.message);
    } finally {
      setMoving(false);
    }
  }

  async function handleSend() {
    if (!replyText.trim() || !selectedLeadId) return;
    const texto = replyText.trim();
    setSending(true);
    setReplyText("");

    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData<Mensagem[]>(["mensagens-crm", selectedLeadId], (old = []) => [
      ...old,
      { id: tempId, conteudo: texto, direcao: "saida" as const, canal: "whatsapp", lido: null, created_at: new Date().toISOString() },
    ]);

    try {
      const { error } = await supabase.functions.invoke("enviar-mensagem", {
        body: { lead_id: selectedLeadId, mensagem: texto },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
      await (supabase as any).from("leads").update({
        tem_mensagem_nova: false,
        mensagens_nao_lidas: 0,
        ultima_mensagem_em: new Date().toISOString(),
        bot_ativo: false,
      }).eq("id", selectedLeadId);
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      queryClient.setQueryData<Mensagem[]>(["mensagens-crm", selectedLeadId], (old = []) =>
        old.filter((m) => m.id !== tempId)
      );
      setReplyText(texto);
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

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const abaConfig: { key: AbaAtendimento; label: string; icon: React.ReactNode }[] = [
    { key: "fila", label: "Fila", icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "minhas", label: isAdmin ? "Em andamento" : "Minhas", icon: <UserCheck className="h-3.5 w-3.5" /> },
    { key: "finalizadas", label: "Finalizadas", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  ];

  // Painel de chat: conteúdo e header variam por aba
  const chatHeaderName = aba === "finalizadas"
    ? selectedProtocolo?.leads?.nome ?? "—"
    : selectedLead?.nome ?? "—";

  const chatHeaderSub = aba === "finalizadas"
    ? selectedProtocolo?.leads?.contato_id
    : (selectedLead as any)?.contato_id;

  const chatHeaderFoto = aba === "finalizadas"
    ? selectedProtocolo?.leads?.foto_perfil
    : (selectedLead as any)?.foto_perfil;

  const showChatPanel = aba === "finalizadas" ? !!selectedProtocolo : !!selectedLead;

  return (
    <div className="flex overflow-hidden w-full flex-1 min-h-0">
      {/* Lista lateral */}
      <div style={{ width: listWidth, minWidth: 200, maxWidth: 520 }} className="shrink-0 flex flex-col bg-card">

        {/* Abas de atendimento */}
        <div className="border-b">
          <div className="flex">
            {abaConfig.map((a) => (
              <button
                key={a.key}
                onClick={() => mudarAba(a.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  aba === a.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canal tabs (só nas abas de leads ativos) */}
        {aba !== "finalizadas" && canais.length > 1 && (
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
                const active = filtroCanal === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setFiltroCanal(c.id); setSelectedLeadId(null); }}
                    className="px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors"
                    style={{ borderBottomColor: active ? c.cor : "transparent", color: active ? c.cor : undefined }}
                  >
                    {c.nome} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 border-b flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {aba === "finalizadas"
              ? `${protocolos.length} protocolo${protocolos.length !== 1 ? "s" : ""}`
              : `${leadsFiltered.length} conversa${leadsFiltered.length !== 1 ? "s" : ""}`}
          </p>
          {aba !== "finalizadas" && (
            <button
              title="Atualizar fotos de perfil"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={async () => {
                const { data, error } = await supabase.functions.invoke("buscar-fotos-perfil", {});
                queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
                if (error) toast.error("Erro ao buscar fotos: " + error.message);
                else {
                  const ok = data?.resultados?.filter((r: any) => r.ok).length ?? 0;
                  toast.success(ok > 0 ? `${ok} foto${ok !== 1 ? "s" : ""} atualizada${ok !== 1 ? "s" : ""}` : "Nenhuma foto nova encontrada");
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1">
          {/* Lista de leads (fila/minhas) */}
          {aba !== "finalizadas" && (
            leadsLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : leadsFiltered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-20" />
                <p className="text-xs">
                  {aba === "fila" ? "Nenhuma conversa na fila." : isAdmin ? "Nenhuma conversa em andamento." : "Você não tem conversas ativas."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {leadsFiltered.map((lead) => {
                  const atendente: string | null = (lead as any).atendente_id ?? null;
                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        if ((lead as any).tem_mensagem_nova) marcarComoLido(lead.id);
                      }}
                      className={cn(
                        "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-2",
                        selectedLeadId === lead.id && "bg-primary/10"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {(lead as any).foto_perfil
                            ? <img src={(lead as any).foto_perfil} alt={lead.nome} className="h-full w-full object-cover" />
                            : <User className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        {(lead as any).tem_mensagem_nova && (
                          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-500 border-2 border-background flex items-center justify-center animate-pulse">
                            <span className="text-[10px] font-bold text-white leading-none">
                              {(lead as any).mensagens_nao_lidas > 0 ? (lead as any).mensagens_nao_lidas : ""}
                            </span>
                          </span>
                        )}
                        {(lead as any).bot_ativo && (
                          <span className="absolute -bottom-1 -left-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                            <Bot className="h-2.5 w-2.5 text-white" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className={cn("text-sm truncate", (lead as any).tem_mensagem_nova ? "font-bold" : "font-medium")}>{lead.nome}</p>
                          {(lead as any).canal_id && canaisMap[(lead as any).canal_id] && (
                            <span
                              className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-semibold whitespace-nowrap"
                              style={{
                                backgroundColor: canaisMap[(lead as any).canal_id].cor + "22",
                                color: canaisMap[(lead as any).canal_id].cor,
                                border: `1px solid ${canaisMap[(lead as any).canal_id].cor}44`,
                              }}
                            >
                              {canaisMap[(lead as any).canal_id].nome}
                            </span>
                          )}
                        </div>
                        {(lead as any).contato_id && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" />{(lead as any).contato_id}
                          </p>
                        )}
                        {atendente && usuariosMap[atendente] && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            <Users className="h-2.5 w-2.5" />{usuariosMap[atendente]}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          )}

          {/* Lista de protocolos finalizados */}
          {aba === "finalizadas" && (
            protocolosLoading ? (
              <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : protocolos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 opacity-20" />
                <p className="text-xs">Nenhum protocolo finalizado.</p>
              </div>
            ) : (
              <div className="divide-y">
                {protocolos.map((proto) => (
                  <button
                    key={proto.id}
                    onClick={() => setSelectedProtocolo(proto)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-start gap-2",
                      selectedProtocolo?.id === proto.id && "bg-primary/10"
                    )}
                  >
                    <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {proto.leads?.foto_perfil
                        ? <img src={proto.leads.foto_perfil} alt={proto.leads?.nome} className="h-full w-full object-cover" />
                        : <User className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{proto.leads?.nome ?? "—"}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 flex items-center gap-0.5">
                          <Hash className="h-2.5 w-2.5" />{proto.numero_protocolo}
                        </Badge>
                      </div>
                      {proto.leads?.contato_id && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" />{proto.leads.contato_id}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        {proto.atendente_id && usuariosMap[proto.atendente_id]
                          ? <><Users className="h-2.5 w-2.5" />{usuariosMap[proto.atendente_id]}</>
                          : null}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(proto.finalizado_em)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </ScrollArea>
      </div>

      {/* Handle de resize */}
      <div
        onMouseDown={startResize}
        className="w-1.5 shrink-0 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors bg-border/60 group relative"
        title="Arraste para redimensionar"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Painel de chat */}
      {showChatPanel ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between bg-card">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {chatHeaderFoto
                  ? <img src={chatHeaderFoto} alt={chatHeaderName} className="h-full w-full object-cover" />
                  : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{chatHeaderName}</p>
                  {aba === "finalizadas" && selectedProtocolo && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                      <Hash className="h-2.5 w-2.5" />{selectedProtocolo.numero_protocolo}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {chatHeaderSub && (
                    <p className="text-xs text-muted-foreground">{chatHeaderSub}</p>
                  )}
                  {aba !== "finalizadas" && selectedAtendente && usuariosMap[selectedAtendente] && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                      <UserCheck className="h-3 w-3" />{usuariosMap[selectedAtendente]}
                    </p>
                  )}
                  {aba === "finalizadas" && selectedProtocolo?.atendente_id && usuariosMap[selectedProtocolo.atendente_id] && (
                    <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <UserCheck className="h-3 w-3" />{usuariosMap[selectedProtocolo.atendente_id]}
                      {selectedProtocolo.finalizado_em && <> · {formatDate(selectedProtocolo.finalizado_em)}</>}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Ações (só em fila/minhas) */}
            {aba !== "finalizadas" && (
              <div className="flex gap-2 items-center">
                {/* Toggle bot */}
                {selectedLead && (
                  <div className="flex items-center gap-1.5 border rounded-md px-2 py-1">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch
                      checked={(selectedLead as any).bot_ativo ?? false}
                      onCheckedChange={(v) => toggleBotAtivo(selectedLead.id, v)}
                      disabled={togglingBot}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">Bot</span>
                  </div>
                )}
                {selectedStatus === "fila" && (
                  <>
                    <Button size="sm" variant="default" className="gap-1.5" onClick={() => assumirOuAtribuir(selectedLead!.id, userId!)} disabled={atribuindo}>
                      {atribuindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                      Assumir
                    </Button>
                    {isAdmin && usuarios.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1" disabled={atribuindo}>
                            <Users className="h-3.5 w-3.5" />Atribuir<ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {usuarios.map((u) => (
                            <DropdownMenuItem key={u.user_id} onClick={() => assumirOuAtribuir(selectedLead!.id, u.user_id)}>
                              <User className="h-4 w-4 mr-2 text-muted-foreground" />{u.nome}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}

                {selectedStatus === "ativo" && (isMyLead || isAdmin) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    onClick={() => finalizar(selectedLead!.id)}
                    disabled={finalizando}
                  >
                    {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Finalizar
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <Settings2 className="h-3.5 w-3.5" /><ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {onLeadClick && selectedLead && (
                      <>
                        <DropdownMenuItem onClick={() => onLeadClick(selectedLead)}>
                          <ExternalLink className="h-4 w-4 mr-2 text-muted-foreground" />Ver lead
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => { setMoveQuadroId(""); setMoveEtapaId(""); setMoveOpen(true); }}>
                      <ArrowRightFromLine className="h-4 w-4 mr-2 text-muted-foreground" />Mover para quadro
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Badge variant="outline" className="text-xs capitalize">{canal}</Badge>
              </div>
            )}

            {aba === "finalizadas" && (
              <Badge variant="outline" className="text-xs capitalize">{canal}</Badge>
            )}
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {msgsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : mensagens.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem neste protocolo.</p>
            ) : (
              mensagens.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.direcao === "saida" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    msg.direcao === "saida"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border rounded-bl-sm"
                  )}>
                    <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                    <p className={cn("text-[10px] mt-1", msg.direcao === "saida" ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Caixa de resposta */}
          {canal === "whatsapp" && aba !== "finalizadas" ? (
            canReply ? (
              <div className="p-3 border-t bg-card flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={sending}
                />
                <Button size="icon" onClick={handleSend} disabled={sending || !replyText.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="p-3 border-t bg-card">
                <p className="text-xs text-muted-foreground text-center">
                  {selectedStatus === "fila"
                    ? "Assuma esta conversa para poder responder."
                    : "Você não é o responsável por esta conversa."}
                </p>
              </div>
            )
          ) : aba === "finalizadas" ? (
            <div className="p-3 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground text-center">
                Histórico do protocolo {selectedProtocolo?.numero_protocolo} — somente leitura.
              </p>
            </div>
          ) : (
            <div className="p-3 border-t bg-card">
              <p className="text-xs text-muted-foreground text-center">
                Resposta direta pelo Instagram não disponível.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-20" />
          <p className="text-sm">
            {aba === "finalizadas" ? "Selecione um protocolo para ver o histórico" : "Selecione uma conversa para visualizar"}
          </p>
        </div>
      )}

      {/* Dialog — Mover para quadro */}
      <Dialog open={moveOpen} onOpenChange={(v) => { setMoveOpen(v); if (!v) { setMoveQuadroId(""); setMoveEtapaId(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightFromLine className="h-4 w-4 text-primary" />Mover para quadro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{selectedLead?.nome}</strong> sairá da entrada e entrará no quadro selecionado.
            </p>
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Quadro de destino</p>
              <Select value={moveQuadroId} onValueChange={(v) => { setMoveQuadroId(v); setMoveEtapaId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o quadro..." /></SelectTrigger>
                <SelectContent>
                  {quadrosDestino.length === 0
                    ? <SelectItem value="__none" disabled>Nenhum quadro disponível</SelectItem>
                    : quadrosDestino.map((q) => <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {moveQuadroId && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Etapa de entrada</p>
                <Select value={moveEtapaId} onValueChange={setMoveEtapaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a etapa..." /></SelectTrigger>
                  <SelectContent>
                    {etapasDestino.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button onClick={handleMover} disabled={moving || !moveQuadroId || !moveEtapaId}>
              {moving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Mover lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
