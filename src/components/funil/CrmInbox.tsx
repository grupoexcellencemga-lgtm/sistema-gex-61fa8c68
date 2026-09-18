import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Send, Loader2, MessageSquare, Phone, User, ArrowRightFromLine, Settings2,
  ExternalLink, ChevronDown, RefreshCw, UserCheck, CheckCircle2, Clock, Users, Hash, Bot, Search, Bell, BellOff,
  FolderKanban, Plus, ChevronRight, Paperclip, FileText, ImageIcon, Music,
  Tag, Zap, Reply, X, ArrowRightLeft, Sparkles, SlidersHorizontal,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types";
import { slaLabel, type FunilEtapa } from "./funilUtils";
import { matchesCrmQueue, crmResponsibility, type CrmQueue } from "./crmOrganization";
import { FichaLeadPanel } from "./FichaLeadPanel";
import { ConversationDrawer } from "./ConversationDrawer";

type Mensagem = {
  id: string;
  conteudo: string;
  tipo: "texto" | "imagem" | "audio" | "video" | "documento" | "sticker";
  media_url: string | null;
  media_mime: string | null;
  media_nome: string | null;
  quoted_message_id: string | null;
  quoted_conteudo: string | null;
  quoted_tipo: string | null;
  is_nota_interna: boolean;
  direcao: "entrada" | "saida";
  canal: string;
  lido: boolean | null;
  created_at: string;
};
type TagCrm = { id: string; nome: string; cor: string };
type RespostaRapida = { id: string; titulo: string; conteudo: string; atalho: string | null };

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

type AbaAtendimento = CrmQueue;

interface CrmInboxProps {
  quadroId: string;
  etapas: FunilEtapa[];
  canal: "whatsapp" | "instagram";
  onLeadClick?: (lead: LeadRow) => void;
}

// Subcomponente que carrega etapas de um quadro para o Select inline
function EtapasCardOptions({ quadroId }: { quadroId: string }) {
  const { data: etapas = [] } = useQuery<{ id: string; nome: string; ordem: number }[]>({
    queryKey: ["etapas-card-opts", quadroId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("funil_etapas").select("id, nome, ordem").eq("quadro_id", quadroId).order("ordem");
      return data || [];
    },
    staleTime: 60000,
  });
  return <>{etapas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</>;
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
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveQuadroId, setMoveQuadroId] = useState("");
  const [moveEtapaId, setMoveEtapaId] = useState("");
  const [moving, setMoving] = useState(false);
  const [addFunilOpen, setAddFunilOpen] = useState(false);
  const [addFunilQuadroId, setAddFunilQuadroId] = useState("");
  const [addFunilEtapaId, setAddFunilEtapaId] = useState("");
  const [addingFunil, setAddingFunil] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ file: File; url: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Resposta citada
  const [quotedMsg, setQuotedMsg] = useState<Mensagem | null>(null);
  // Notas internas
  const [isNota, setIsNota] = useState(false);
  // Busca na conversa
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  // Respostas rápidas
  const [showRespostas, setShowRespostas] = useState(false);
  // Tags
  const [tagManageLeadId, setTagManageLeadId] = useState<string | null>(null);
  const [newTagNome, setNewTagNome] = useState("");
  const [newTagCor, setNewTagCor] = useState("#6366f1");
  const [savingTag, setSavingTag] = useState(false);
  // Transferência
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAgentId, setTransferAgentId] = useState("");
  const [transferindo, setTransferindo] = useState(false);
  // Distribuição automática
  const [distributing, setDistributing] = useState(false);
  const [busca, setBusca] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const { status: pushStatus, loading: pushLoading, activate: activatePush, deactivate: deactivatePush } = usePushNotifications();
  const [finalizando, setFinalizando] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const etapaIds = etapas.map((e) => e.id);

  function mudarAba(novaAba: AbaAtendimento) {
    setAba(novaAba);
    setSelectedLeadId(null);
    setSelectedProtocolo(null);
    setFiltroCanal("todos");
    setReplyText("");
    setBusca("");
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

  // Quadros normais (não-inbox) para adicionar ao funil
  type QuadroNormal = { id: string; nome: string };
  const { data: quadrosNormais = [] } = useQuery<QuadroNormal[]>({
    queryKey: ["quadros-normais", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_quadros")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .or("fixo.is.null,fixo.eq.false")
        .is("canal", null)
        .order("nome");
      if (error) throw error;
      return data as QuadroNormal[];
    },
    enabled: !!empresaId,
  });

  // Etapas do quadro selecionado para "adicionar ao funil"
  const { data: etapasAddFunil = [] } = useQuery<Etapa[]>({
    queryKey: ["etapas-add-funil", addFunilQuadroId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_etapas")
        .select("id, nome, ordem")
        .eq("quadro_id", addFunilQuadroId)
        .order("ordem");
      if (error) throw error;
      return data as Etapa[];
    },
    enabled: !!addFunilQuadroId,
  });

  // Cards do funil para o lead selecionado
  type FunilCardInfo = { id: string; quadro_id: string; etapa_id: string; quadro_nome: string; etapa_nome: string };
  const { data: funilCards = [], refetch: refetchFunilCards } = useQuery<FunilCardInfo[]>({
    queryKey: ["funil-cards-lead", selectedLeadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_cards")
        .select("id, quadro_id, etapa_id, funil_quadros(nome), funil_etapas(nome)")
        .eq("lead_id", selectedLeadId!)
        .eq("status", "ativo");
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        quadro_id: c.quadro_id,
        etapa_id: c.etapa_id,
        quadro_nome: c.funil_quadros?.nome ?? "—",
        etapa_nome: c.funil_etapas?.nome ?? "—",
      })) as FunilCardInfo[];
    },
    enabled: !!selectedLeadId && aba !== "finalizadas",
  });

  // Tags da empresa
  const { data: tagsEmpresa = [], refetch: refetchTags } = useQuery<TagCrm[]>({
    queryKey: ["tags-crm", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tags_crm").select("id, nome, cor").eq("empresa_id", empresaId!).order("nome");
      return (data ?? []) as TagCrm[];
    },
    enabled: !!empresaId,
  });

  // Tags do lead selecionado
  const { data: leadTagIds = [], refetch: refetchLeadTags } = useQuery<string[]>({
    queryKey: ["lead-tags", selectedLeadId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lead_tags").select("tag_id").eq("lead_id", selectedLeadId!);
      return (data ?? []).map((r: any) => r.tag_id as string);
    },
    enabled: !!selectedLeadId,
  });

  // Respostas rápidas
  const { data: respostasRapidas = [] } = useQuery<RespostaRapida[]>({
    queryKey: ["respostas-rapidas", empresaId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("respostas_rapidas").select("id, titulo, conteudo, atalho").eq("empresa_id", empresaId!).order("ordem");
      return (data ?? []) as RespostaRapida[];
    },
    enabled: !!empresaId,
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

      query = query.in("status_atendimento", ["fila", "ativo", "em_atendimento"]);
      if (!isAdmin) query = query.or(`status_atendimento.eq.fila,atendente_id.eq.${userId},bot_ativo.eq.true`);

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

  const buscaTrimmed = busca.toLowerCase().trim();
  const leadsFiltered = (filtroCanal === "todos" ? leads : leads.filter((l) => (l as any).canal_id === filtroCanal))
    .filter(l => matchesCrmQueue(l as any, aba, userId))
    .filter((l) => !buscaTrimmed || l.nome?.toLowerCase().includes(buscaTrimmed) || ((l as any).contato_id ?? "").includes(buscaTrimmed));

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;
  const selectedStatus: string = (selectedLead as any)?.status_atendimento ?? "fila";
  const selectedAtendente: string | null = (selectedLead as any)?.atendente_id ?? null;
  const isMyLead = selectedAtendente === userId;
  const canReply = canal === "whatsapp" && ["ativo", "em_atendimento"].includes(selectedStatus) && (isMyLead || isAdmin);

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
        .update({ atendente_id: paraUserId, status_atendimento: "ativo", atribuido_em: new Date().toISOString(), bot_ativo: false })
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
    if (!moveEtapaId || !moveQuadroId || !selectedLeadId || !empresaId) return;
    setMoving(true);
    try {
      const { error } = await (supabase as any)
        .from("funil_cards")
        .upsert(
          {
            lead_id: selectedLeadId,
            quadro_id: moveQuadroId,
            etapa_id: moveEtapaId,
            empresa_id: empresaId,
            status: "ativo",
          },
          { onConflict: "lead_id,quadro_id" }
        );
      if (error) throw error;
      toast.success("Lead adicionado ao funil!");
      setMoveOpen(false);
      setMoveQuadroId("");
      setMoveEtapaId("");
      setSelectedLeadId(null);
      queryClient.invalidateQueries({ queryKey: ["funil-cards"] });
    } catch (err: any) {
      toast.error("Erro ao mover: " + err.message);
    } finally {
      setMoving(false);
    }
  }

  async function handleSend() {
    if (!replyText.trim() || !selectedLeadId) return;
    const texto = replyText.trim();
    const nota = isNota;
    const quoted = quotedMsg;
    setSending(true);
    setReplyText("");
    setQuotedMsg(null);

    const tempId = `temp-${Date.now()}`;
    queryClient.setQueryData<Mensagem[]>(["mensagens-crm", selectedLeadId], (old = []) => [
      ...old,
      {
        id: tempId, conteudo: texto, tipo: "texto" as const,
        media_url: null, media_mime: null, media_nome: null,
        quoted_message_id: quoted?.id ?? null,
        quoted_conteudo: quoted?.conteudo ?? null,
        quoted_tipo: quoted?.tipo ?? null,
        is_nota_interna: nota,
        direcao: "saida" as const, canal: "whatsapp", lido: null,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      if (nota) {
        // Nota interna: salva só no DB, não envia pelo WhatsApp
        const { data: protocolo } = await (supabase as any).from("protocolos_atendimento").select("id").eq("lead_id", selectedLeadId).eq("status", "ativo").maybeSingle();
        await (supabase as any).from("mensagens_crm").insert({
          lead_id: selectedLeadId, empresa_id: empresaId,
          conteudo: texto, tipo: "texto", is_nota_interna: true,
          direcao: "saida", canal: "whatsapp",
          protocolo_id: protocolo?.id ?? null,
        });
      } else {
        const { error } = await supabase.functions.invoke("enviar-mensagem", {
          body: {
            lead_id: selectedLeadId, mensagem: texto,
            quoted_message_id: quoted?.id ?? null,
            quoted_conteudo: quoted?.conteudo ?? null,
            quoted_tipo: quoted?.tipo ?? null,
          },
        });
        if (error) throw error;
        await (supabase as any).from("leads").update({
          tem_mensagem_nova: false, mensagens_nao_lidas: 0,
          ultima_mensagem_em: new Date().toISOString(), bot_ativo: false,
        }).eq("id", selectedLeadId);
        queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
      }
      queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
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

  async function handleFileSend(file: File) {
    if (!selectedLeadId || !empresaId) return;
    setSendingMedia(true);
    try {
      const mime = file.type || "application/octet-stream";
      const tipo: Mensagem["tipo"] =
        mime.startsWith("image/") ? "imagem" :
        mime.startsWith("video/") ? "video" :
        mime.startsWith("audio/") ? "audio" : "documento";

      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${empresaId}/${selectedLeadId}/${tipo}-${Date.now()}.${ext}`;
      const bytes = await file.arrayBuffer();

      const { error: uploadErr } = await supabase.storage
        .from("midia_crm")
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (uploadErr) throw new Error("Erro no upload: " + uploadErr.message);

      const { data: pub } = supabase.storage.from("midia_crm").getPublicUrl(path);
      const mediaUrl = pub.publicUrl;

      // Otimista: adiciona localmente
      const tempId = `temp-${Date.now()}`;
      queryClient.setQueryData<Mensagem[]>(["mensagens-crm", selectedLeadId], (old = []) => [
        ...old,
        { id: tempId, conteudo: file.name, tipo, media_url: mediaUrl, media_mime: mime, media_nome: file.name, direcao: "saida", canal: "whatsapp", lido: null, created_at: new Date().toISOString() },
      ]);

      const { error } = await supabase.functions.invoke("enviar-mensagem", {
        body: { lead_id: selectedLeadId, tipo, media_url: mediaUrl, media_mime: mime, media_nome: file.name },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro ao enviar mídia: " + (err.message ?? String(err)));
    } finally {
      setSendingMedia(false);
      setMediaPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleTransfer() {
    if (!transferAgentId || !selectedLeadId) return;
    setTransferindo(true);
    try {
      await (supabase as any).from("leads").update({ atendente_id: transferAgentId, status_atendimento: "em_atendimento" }).eq("id", selectedLeadId);
      await (supabase as any).from("mensagens_crm").insert({
        lead_id: selectedLeadId, empresa_id: empresaId,
        conteudo: `🔄 Transferido para ${usuariosMap[transferAgentId] ?? "agente"}`,
        tipo: "texto", is_nota_interna: true, direcao: "saida", canal: "whatsapp",
      });
      toast.success("Atendimento transferido!");
      setTransferOpen(false);
      setTransferAgentId("");
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
      queryClient.invalidateQueries({ queryKey: ["mensagens-crm", selectedLeadId] });
    } catch (err: any) {
      toast.error("Erro ao transferir: " + err.message);
    } finally {
      setTransferindo(false);
    }
  }

  async function handleDistribuir() {
    const filaLeads = leads.filter((l) => (l as any).status_atendimento === "fila");
    if (!filaLeads.length) { toast.info("Nenhum lead na fila para distribuir."); return; }
    const agentes = Object.keys(usuariosMap);
    if (!agentes.length) { toast.error("Nenhum agente disponível."); return; }
    setDistributing(true);
    try {
      for (let i = 0; i < filaLeads.length; i++) {
        const agente = agentes[i % agentes.length];
        await (supabase as any).from("leads").update({ atendente_id: agente, status_atendimento: "em_atendimento" }).eq("id", filaLeads[i].id);
      }
      toast.success(`${filaLeads.length} lead${filaLeads.length !== 1 ? "s" : ""} distribuído${filaLeads.length !== 1 ? "s" : ""}!`);
      queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId], exact: false });
    } catch (err: any) {
      toast.error("Erro ao distribuir: " + err.message);
    } finally {
      setDistributing(false);
    }
  }

  async function toggleLeadTag(tagId: string) {
    if (!selectedLeadId) return;
    const has = leadTagIds.includes(tagId);
    if (has) {
      await (supabase as any).from("lead_tags").delete().eq("lead_id", selectedLeadId).eq("tag_id", tagId);
    } else {
      await (supabase as any).from("lead_tags").insert({ lead_id: selectedLeadId, tag_id: tagId });
    }
    refetchLeadTags();
  }

  async function handleCreateTag() {
    if (!newTagNome.trim() || !empresaId) return;
    setSavingTag(true);
    try {
      await (supabase as any).from("tags_crm").insert({ empresa_id: empresaId, nome: newTagNome.trim(), cor: newTagCor });
      setNewTagNome("");
      setNewTagCor("#6366f1");
      refetchTags();
    } catch (err: any) {
      toast.error("Erro ao criar tag: " + err.message);
    } finally {
      setSavingTag(false);
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

  async function addLeadToFunil() {
    if (!selectedLeadId || !addFunilQuadroId || !addFunilEtapaId || !empresaId) return;
    setAddingFunil(true);
    try {
      const { error } = await (supabase as any).from("funil_cards").upsert({
        lead_id: selectedLeadId,
        quadro_id: addFunilQuadroId,
        etapa_id: addFunilEtapaId,
        empresa_id: empresaId,
        status: "ativo",
      }, { onConflict: "lead_id,quadro_id" });
      if (error) throw error;
      toast.success("Lead adicionado ao funil!");
      setAddFunilOpen(false);
      setAddFunilQuadroId("");
      setAddFunilEtapaId("");
      refetchFunilCards();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setAddingFunil(false);
    }
  }

  async function moveCardEtapa(cardId: string, novaEtapaId: string) {
    const { error } = await (supabase as any).from("funil_cards").update({ etapa_id: novaEtapaId }).eq("id", cardId);
    if (error) { toast.error("Erro ao mover etapa"); return; }
    refetchFunilCards();
    queryClient.invalidateQueries({ queryKey: ["funil-cards"] });
  }

  async function removeFromFunil(cardId: string, quadroNome: string) {
    if (!confirm(`Remover este lead do funil "${quadroNome}"?`)) return;
    const { error } = await (supabase as any).from("funil_cards").delete().eq("id", cardId);
    if (error) { toast.error("Erro ao remover"); return; }
    refetchFunilCards();
    queryClient.invalidateQueries({ queryKey: ["funil-cards"] });
  }

  function formatPhone(raw: string | null): string {
    if (!raw) return "";
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
    if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    return raw;
  }

  function formatRelative(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `${diffMins}min`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "ontem";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " +
      d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function highlightText(text: string, query: string) {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  }

  const mensagensFiltradas = msgSearch.trim()
    ? mensagens.filter((m) => m.conteudo.toLowerCase().includes(msgSearch.toLowerCase()))
    : mensagens;

  const abaConfig: { key: AbaAtendimento; label: string; icon: React.ReactNode }[] = [
    { key: "fila", label: "Precisa de você", icon: <Clock className="h-3.5 w-3.5" /> },
    { key: "ia", label: "IA autorizada", icon: <Bot className="h-3.5 w-3.5" /> },
    { key: "minhas", label: "Minhas conversas", icon: <UserCheck className="h-3.5 w-3.5" /> },
    { key: "todos", label: "Todas", icon: <Users className="h-3.5 w-3.5" /> },
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
    <div className="flex w-full min-w-0">
      {/* Lista lateral */}
      <div className="w-full min-w-0 flex flex-col bg-card">

        {/* Abas de atendimento */}
        <div className="border-b">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-2 bg-muted/20">
            {abaConfig.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={aba === a.key}
                onClick={() => mudarAba(a.key)}
                className={cn(
                  "flex items-center justify-center gap-1.5 min-h-10 px-2 py-2.5 text-xs font-medium rounded-lg border shadow-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px",
                  a.key === "finalizadas" && "col-span-2 sm:col-span-1",
                  aba === a.key
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/20"
                    : "border-border bg-card text-muted-foreground hover:bg-muted hover:border-primary/40 hover:text-foreground"
                )}
              >
                {a.icon}
                {a.label}
                {a.key !== "finalizadas" && <span className={cn("ml-1 rounded-full px-1.5 text-[10px]", aba === a.key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{leads.filter(l => matchesCrmQueue(l as any, a.key, userId)).length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Canal tabs (só nas abas de leads ativos) */}
        {aba !== "finalizadas" && showFilters && canais.length > 1 && (
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

        <div className="px-3 py-2 border-b flex items-center gap-3 flex-wrap">
          {aba !== "finalizadas" && <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input aria-label="Buscar contatos" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone..." className="pl-8 h-8 text-xs" />
          </div>}
          {aba !== "finalizadas" && canais.length > 1 && <Button variant={showFilters ? "secondary" : "outline"} size="sm" className="h-8 gap-1.5" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal className="h-3.5 w-3.5" />Filtros{filtroCanal !== "todos" && " (1)"}</Button>}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {aba === "finalizadas"
              ? `${protocolos.length} protocolo${protocolos.length !== 1 ? "s" : ""}`
              : `${leadsFiltered.length} conversa${leadsFiltered.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-1">
            {/* Botão de notificações push */}
            {pushStatus !== "unsupported" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={pushStatus === "active" ? deactivatePush : activatePush}
                    disabled={pushLoading || pushStatus === "denied"}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    {pushLoading
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : pushStatus === "active"
                        ? <Bell className="h-3.5 w-3.5 text-green-500" />
                        : <BellOff className="h-3.5 w-3.5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {pushStatus === "active" ? "Notificações ativas — clique para desativar" :
                   pushStatus === "denied" ? "Notificações bloqueadas no navegador" :
                   "Ativar notificações de novas mensagens"}
                </TooltipContent>
              </Tooltip>
            )}
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
        </div>

        <div>
          {aba !== "finalizadas" && <div className="hidden lg:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_70px] gap-3 pl-[60px] pr-3 py-2 border-b bg-muted/30 text-[11px] font-medium text-muted-foreground"><span>Contato</span><span>Última mensagem</span><span>Responsável</span><span>Número comercial</span><span>Espera</span></div>}
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
                  return (
                    <button
                      key={lead.id}
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        if ((lead as any).tem_mensagem_nova) marcarComoLido(lead.id);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3",
                        selectedLeadId === lead.id && "bg-primary/10"
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
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
                      <div className="flex-1 min-w-0 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)_70px] lg:items-center lg:gap-3">
                        {/* Linha 1: nome + horário */}
                        <div className="flex items-start justify-between gap-1 min-w-0 lg:col-start-1 lg:row-start-1">
                          <p className={cn("text-sm truncate leading-tight", (lead as any).tem_mensagem_nova ? "font-bold" : "font-medium")}>
                            {lead.nome}
                          </p>
                          {(lead as any).ultima_mensagem_em && (
                            <span className="text-[10px] text-muted-foreground shrink-0 leading-tight mt-px">
                              {formatRelative((lead as any).ultima_mensagem_em)}
                            </span>
                          )}
                        </div>
                        <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] mt-1 lg:mt-0 lg:col-start-3 lg:row-start-1 lg:justify-self-start", (lead as any).bot_ativo ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : (lead as any).atendente_id ? "bg-muted text-muted-foreground" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300")}>{crmResponsibility(lead as any, usuariosMap)}</span>
                        {/* Linha 2: canal + telefone */}
                        <div className="flex items-center gap-1.5 mt-0.5 min-w-0 lg:mt-0 lg:col-start-4 lg:row-start-1 lg:flex-wrap">
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
                          {(lead as any).contato_id && (
                            <p className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
                              <Phone className="h-2.5 w-2.5 shrink-0" />{formatPhone((lead as any).contato_id)}
                            </p>
                          )}
                        </div>
                        {/* Linha 3: prévia da última mensagem */}
                        {(lead as any).ultima_mensagem_texto && (
                          <p className={cn(
                            "text-xs truncate mt-0.5 leading-tight lg:mt-0 lg:col-start-2 lg:row-start-1",
                            (lead as any).ultima_mensagem_direcao === "entrada"
                              ? "text-amber-600 dark:text-amber-400 font-medium"
                              : "text-muted-foreground"
                          )}>
                            {(lead as any).ultima_mensagem_direcao === "saida" && (
                              <span className="mr-0.5 opacity-60">Você: </span>
                            )}
                            {(lead as any).ultima_mensagem_texto}
                          </p>
                        )}
                        {/* Linha 4: atendente + SLA */}
                        {slaLabel(lead) && (
                          <div className="flex items-center gap-2 mt-0.5 lg:mt-0 lg:col-start-5 lg:row-start-1">
                            {slaLabel(lead) && (
                              <span className={`text-[10px] shrink-0 flex items-center gap-0.5 ${slaLabel(lead)!.color}`}>
                                <Clock className="h-2.5 w-2.5" />{slaLabel(lead)!.text}
                              </span>
                            )}
                          </div>
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
                      "w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center gap-3",
                      selectedProtocolo?.id === proto.id && "bg-primary/10"
                    )}
                  >
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {proto.leads?.foto_perfil
                        ? <img src={proto.leads.foto_perfil} alt={proto.leads?.nome} className="h-full w-full object-cover" />
                        : <User className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 min-w-0 lg:col-start-1 lg:row-start-1">
                        <p className="text-sm font-medium truncate leading-tight">{proto.leads?.nome ?? "—"}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 leading-tight mt-px">
                          {formatRelative(proto.finalizado_em)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 flex items-center gap-0.5">
                          <Hash className="h-2.5 w-2.5" />{proto.numero_protocolo}
                        </Badge>
                        {proto.leads?.contato_id && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5 shrink-0" />{formatPhone(proto.leads.contato_id)}
                          </p>
                        )}
                      </div>
                      {proto.atendente_id && usuariosMap[proto.atendente_id] && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Users className="h-2.5 w-2.5 shrink-0" />{usuariosMap[proto.atendente_id]}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      <ConversationDrawer open={showChatPanel} title={aba === "finalizadas" ? "Histórico da conversa" : "Atendimento"} onClose={() => { setSelectedLeadId(null); setSelectedProtocolo(null); setShowContactPanel(false); }}>
        <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", showContactPanel && selectedLead && "hidden sm:flex")}>
          {/* Header */}
          <div className="p-3 border-b flex items-center justify-between gap-3 flex-wrap bg-card">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {chatHeaderFoto
                  ? <img src={chatHeaderFoto} alt={chatHeaderName} className="h-full w-full object-cover" />
                  : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{chatHeaderName}</p>
                  {aba !== "finalizadas" && selectedLead && <Badge variant="secondary" className="text-[10px]">{crmResponsibility(selectedLead as any, usuariosMap)}</Badge>}
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
              <div className="flex gap-2 items-center flex-wrap">
                <Button variant="outline" size="sm" className="inline-flex" onClick={() => setShowContactPanel(v => !v)}>Ficha do contato</Button>
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
                    <span className="text-xs text-muted-foreground">Autorizar IA</span>
                  </div>
                )}
                {(selectedStatus === "fila" || (selectedLead as any)?.bot_ativo) && (
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

                {["ativo", "em_atendimento"].includes(selectedStatus) && (isMyLead || isAdmin) && (
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
                    {["ativo", "em_atendimento"].includes(selectedStatus) && (isMyLead || isAdmin) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setTransferOpen(true)}>
                          <ArrowRightLeft className="h-4 w-4 mr-2 text-muted-foreground" />Transferir atendimento
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* A ficha da IA mora no detalhe do lead; sem este atalho ela só era
                    alcançável pelo menu de engrenagem. */}
                {onLeadClick && selectedLead && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1 px-2 text-xs"
                        onClick={() => onLeadClick(selectedLead)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Ficha
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Ficha do lead feita pela IA</TooltipContent>
                  </Tooltip>
                )}
                {/* Busca na conversa */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={showMsgSearch ? "default" : "ghost"}
                      className="h-7 w-7 p-0"
                      onClick={() => { setShowMsgSearch(!showMsgSearch); if (showMsgSearch) setMsgSearch(""); }}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Buscar na conversa</TooltipContent>
                </Tooltip>
                {/* Tags */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={tagManageLeadId === selectedLeadId ? "default" : "ghost"}
                      className="h-7 w-7 p-0"
                      onClick={() => setTagManageLeadId(tagManageLeadId === selectedLeadId ? null : (selectedLeadId ?? null))}
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">Tags do contato</TooltipContent>
                </Tooltip>
                <Badge variant="outline" className="text-xs capitalize">{canal}</Badge>
              </div>
            )}

            {aba === "finalizadas" && (
              <Badge variant="outline" className="text-xs capitalize">{canal}</Badge>
            )}
          </div>

          {/* Barra de busca na conversa */}
          {aba !== "finalizadas" && showMsgSearch && (
            <div className="px-3 py-2 border-b flex items-center gap-2 bg-card">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
                placeholder="Buscar na conversa..."
                className="h-7 text-xs flex-1"
                autoFocus
              />
              <button
                onClick={() => { setShowMsgSearch(false); setMsgSearch(""); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Tags do contato */}
          {aba !== "finalizadas" && tagManageLeadId === selectedLeadId && selectedLeadId && (
            <div className="border-b bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </span>
              </div>
              {/* Tags da empresa (toggle) */}
              <div className="flex flex-wrap gap-1 mb-2">
                {tagsEmpresa.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma tag criada.</p>
                )}
                {tagsEmpresa.map((tag) => {
                  const ativo = leadTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleLeadTag(tag.id)}
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity"
                      style={{
                        backgroundColor: ativo ? tag.cor + "33" : "transparent",
                        color: tag.cor,
                        border: `1px solid ${tag.cor}${ativo ? "99" : "44"}`,
                        opacity: ativo ? 1 : 0.5,
                      }}
                    >
                      {tag.nome}
                    </button>
                  );
                })}
              </div>
              {/* Criar nova tag */}
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={newTagCor}
                  onChange={(e) => setNewTagCor(e.target.value)}
                  className="h-6 w-6 rounded cursor-pointer border-0 p-0"
                  title="Cor da tag"
                />
                <Input
                  value={newTagNome}
                  onChange={(e) => setNewTagNome(e.target.value)}
                  placeholder="Nova tag..."
                  className="h-6 text-xs flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateTag(); }}
                />
                <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreateTag} disabled={savingTag || !newTagNome.trim()}>
                  {savingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
                </Button>
              </div>
            </div>
          )}

          {/* Painel de Funis (só para leads ativos, não finalizados) */}
          {aba !== "finalizadas" && selectedLead && (
            <div className="border-b bg-card px-3 py-2">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <FolderKanban className="h-3 w-3" /> Funis
                </span>
                <button
                  onClick={() => { setAddFunilOpen(true); setAddFunilQuadroId(""); setAddFunilEtapaId(""); }}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5"
                >
                  <Plus className="h-3 w-3" />Adicionar
                </button>
              </div>

              {funilCards.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Não está em nenhum funil.</p>
              ) : (
                <div className="space-y-1">
                  {funilCards.map((card) => {
                    const etapasDoCard = quadrosNormais.find(q => q.id === card.quadro_id) ? [] : [];
                    return (
                      <div key={card.id} className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-medium truncate shrink-0 max-w-[90px]" title={card.quadro_nome}>{card.quadro_nome}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Select
                          value={card.etapa_id}
                          onValueChange={(v) => moveCardEtapa(card.id, v)}
                        >
                          <SelectTrigger className="h-6 text-xs flex-1 min-w-0 px-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <EtapasCardOptions quadroId={card.quadro_id} />
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => removeFromFunil(card.id, card.quadro_nome)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          title="Remover do funil"
                        >
                          <ArrowRightFromLine className="h-3 w-3 rotate-180" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Dialog adicionar ao funil */}
              {addFunilOpen && (
                <div className="mt-2 p-2 rounded-md border bg-muted/30 space-y-1.5">
                  <Select value={addFunilQuadroId} onValueChange={(v) => { setAddFunilQuadroId(v); setAddFunilEtapaId(""); }}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecione o funil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {quadrosNormais.filter(q => !funilCards.some(c => c.quadro_id === q.id)).map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {addFunilQuadroId && (
                    <Select value={addFunilEtapaId} onValueChange={setAddFunilEtapaId}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Etapa inicial..." />
                      </SelectTrigger>
                      <SelectContent>
                        {etapasAddFunil.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-6 text-xs flex-1" onClick={addLeadToFunil} disabled={addingFunil || !addFunilEtapaId}>
                      {addingFunil ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddFunilOpen(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {msgsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : mensagens.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem neste protocolo.</p>
            ) : (
              mensagensFiltradas.map((msg) => (
                <div key={msg.id} className={cn("flex group", msg.direcao === "saida" ? "justify-end" : "justify-start")}>
                  {/* Botão de citar — lado esquerdo para mensagens enviadas */}
                  {msg.direcao === "saida" && aba !== "finalizadas" && canReply && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity mr-1 self-center text-muted-foreground hover:text-foreground"
                      onClick={() => setQuotedMsg(msg)}
                      title="Citar mensagem"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                    msg.is_nota_interna
                      ? "bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 rounded-br-sm"
                      : msg.direcao === "saida"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border rounded-bl-sm"
                  )}>
                    {/* Nota interna badge */}
                    {msg.is_nota_interna && (
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-0.5">
                        <Tag className="h-2.5 w-2.5" /> Nota interna
                      </p>
                    )}
                    {/* Mensagem citada */}
                    {msg.quoted_conteudo && (
                      <div className={cn(
                        "border-l-2 pl-2 mb-1.5 rounded-r text-xs opacity-80 py-0.5",
                        msg.is_nota_interna
                          ? "border-amber-400"
                          : msg.direcao === "saida"
                          ? "border-primary-foreground/40 bg-primary-foreground/10"
                          : "border-border bg-muted/40"
                      )}>
                        <p className="truncate">{msg.quoted_conteudo}</p>
                      </div>
                    )}
                    {/* Mídia */}
                    {msg.media_url && (msg.tipo === "imagem" || msg.tipo === "sticker") && (
                      <img
                        src={msg.media_url}
                        alt={msg.media_nome ?? "imagem"}
                        className="rounded-lg max-w-full max-h-64 object-contain mb-1 cursor-zoom-in"
                        loading="lazy"
                        onClick={() => setLightboxUrl(msg.media_url!)}
                      />
                    )}
                    {msg.media_url && msg.tipo === "audio" && (
                      <audio controls src={msg.media_url} className="w-full mb-1" />
                    )}
                    {msg.media_url && msg.tipo === "video" && (
                      <video controls src={msg.media_url} className="rounded-lg max-w-full max-h-48 mb-1" />
                    )}
                    {msg.media_url && msg.tipo === "documento" && (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 mb-1 text-xs font-medium underline underline-offset-2",
                          msg.direcao === "saida" && !msg.is_nota_interna ? "text-primary-foreground/90" : "text-foreground"
                        )}
                      >
                        📄 {msg.media_nome ?? "Documento"}
                      </a>
                    )}
                    {/* Legenda ou texto */}
                    {msg.conteudo && !["[Imagem]","[Audio]","[Video]","[Documento]","[Sticker]","[Mídia]"].includes(msg.conteudo) && (
                      <p className="whitespace-pre-wrap break-words">{highlightText(msg.conteudo, msgSearch)}</p>
                    )}
                    {/* Fallback: sem mídia e sem texto útil */}
                    {!msg.media_url && ["[Imagem]","[Audio]","[Video]","[Documento]","[Sticker]","[Mídia]"].includes(msg.conteudo) && (
                      <p className="whitespace-pre-wrap break-words italic opacity-70">{msg.conteudo}</p>
                    )}
                    {!msg.media_url && msg.tipo === "texto" && !msg.conteudo && (
                      <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                    )}
                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.is_nota_interna
                        ? "text-amber-600/70 dark:text-amber-400/70 text-right"
                        : msg.direcao === "saida"
                        ? "text-primary-foreground/70 text-right"
                        : "text-muted-foreground"
                    )}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                  {/* Botão de citar — lado direito para mensagens recebidas */}
                  {msg.direcao === "entrada" && aba !== "finalizadas" && canReply && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 self-center text-muted-foreground hover:text-foreground"
                      onClick={() => setQuotedMsg(msg)}
                      title="Citar mensagem"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Caixa de resposta */}
          {canal === "whatsapp" && aba !== "finalizadas" ? (
            canReply ? (
              <div className="border-t bg-card">
                {/* Preview de mensagem citada */}
                {quotedMsg && (
                  <div className="flex items-start gap-2 px-3 pt-2 pb-0">
                    <div className="flex-1 border-l-2 border-primary pl-2 py-0.5">
                      <p className="text-xs text-muted-foreground truncate">
                        Respondendo: {quotedMsg.conteudo}
                      </p>
                    </div>
                    <button onClick={() => setQuotedMsg(null)} className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {/* Toolbar: nota interna + respostas rápidas */}
                <div className="px-3 pt-2 flex items-center gap-2">
                  <div className="flex rounded-md overflow-hidden border text-xs">
                    <button
                      onClick={() => setIsNota(false)}
                      className={cn("px-2.5 py-0.5 transition-colors", !isNota ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      Mensagem
                    </button>
                    <button
                      onClick={() => setIsNota(true)}
                      className={cn("px-2.5 py-0.5 transition-colors", isNota ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted")}
                    >
                      Nota interna
                    </button>
                  </div>
                  {/* Respostas rápidas */}
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn("h-6 gap-1 text-xs px-2", showRespostas && "bg-muted")}
                      onClick={() => setShowRespostas(!showRespostas)}
                      disabled={respostasRapidas.length === 0}
                      title={respostasRapidas.length === 0 ? "Nenhuma resposta rápida cadastrada" : "Respostas rápidas"}
                    >
                      <Zap className="h-3 w-3" />
                      <span className="hidden sm:inline">Rápidas</span>
                    </Button>
                    {showRespostas && respostasRapidas.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 bg-card border rounded-md shadow-lg z-20 min-w-[220px] max-h-52 overflow-y-auto">
                        {respostasRapidas.map((r) => (
                          <button
                            key={r.id}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b last:border-0"
                            onClick={() => { setReplyText(r.conteudo); setShowRespostas(false); }}
                          >
                            <p className="font-medium">{r.titulo}</p>
                            <p className="text-muted-foreground truncate mt-0.5">{r.conteudo}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Preview de arquivo selecionado */}
                {mediaPreview && (
                  <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                    {mediaPreview.file.type.startsWith("image/") ? (
                      <img src={mediaPreview.url} className="h-12 w-12 rounded object-cover border" />
                    ) : mediaPreview.file.type.startsWith("audio/") ? (
                      <Music className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground truncate flex-1">{mediaPreview.file.name}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setMediaPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                      Cancelar
                    </Button>
                    <Button size="sm" className="h-6 text-xs px-3" onClick={() => handleFileSend(mediaPreview.file)} disabled={sendingMedia}>
                      {sendingMedia ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enviar"}
                    </Button>
                  </div>
                )}
                <div className="p-3 flex gap-2 items-center">
                  {/* Botão de anexo */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      setMediaPreview({ file, url });
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || sendingMedia}
                    title="Enviar arquivo"
                  >
                    {sendingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </Button>
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={isNota ? "Escreva uma nota interna..." : "Digite uma mensagem..."}
                    className={cn("flex-1", isNota && "border-amber-400 focus-visible:ring-amber-400 bg-amber-50 dark:bg-amber-950/30")}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending || sendingMedia}
                  />
                  <Button size="icon" onClick={handleSend} disabled={sending || sendingMedia || !replyText.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
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
      {showChatPanel && selectedLead && aba !== "finalizadas" && (
        <aside className={cn("shrink-0 border-l bg-card overflow-y-auto", showContactPanel ? "block w-full sm:w-[280px]" : "hidden")}>
          <div className="p-4 border-b flex justify-between items-center"><h2 className="text-sm font-semibold">Ficha do contato</h2><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowContactPanel(false)} aria-label="Recolher ficha"><X className="h-3.5 w-3.5" /></Button></div>
          <div className="p-4 space-y-5">
            <div><p className="text-xs text-muted-foreground">Responsável pelo atendimento</p><p className="text-sm font-medium mt-1">{crmResponsibility(selectedLead as any, usuariosMap)}</p></div>
            <Button variant="outline" className="w-full" onClick={() => onLeadClick(selectedLead)}>Abrir cadastro e oportunidade</Button>
            <FichaLeadPanel leadId={selectedLead.id} tipoContato={(selectedLead as any).tipo_contato ?? null} temConversa={mensagens.length > 0} onTipoAlterado={() => queryClient.invalidateQueries({ queryKey: ["crm-leads", quadroId, empresaId] })} />
          </div>
        </aside>
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

      {/* Dialog — Transferir atendimento */}
      <Dialog open={transferOpen} onOpenChange={(v) => { setTransferOpen(v); if (!v) setTransferAgentId(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" />Transferir atendimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o agente para transferir a conversa de <strong>{selectedLead?.nome}</strong>.
            </p>
            <Select value={transferAgentId} onValueChange={setTransferAgentId}>
              <SelectTrigger><SelectValue placeholder="Selecione o agente..." /></SelectTrigger>
              <SelectContent>
                {usuarios.filter((u) => u.user_id !== userId).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransfer} disabled={transferindo || !transferAgentId}>
              {transferindo && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Transferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox de imagem */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setLightboxUrl(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <a
            href={lightboxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 text-white/70 hover:text-white text-xs underline"
            onClick={(e) => e.stopPropagation()}
          >
            Abrir original
          </a>
          <img
            src={lightboxUrl}
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      </ConversationDrawer>
    </div>
  );
}
