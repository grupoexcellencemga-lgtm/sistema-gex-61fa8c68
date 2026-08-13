import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors,
  useDroppable, useDraggable, pointerWithin,
} from "@dnd-kit/core";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, MessageCircle, Loader2, Trash2, Search, LayoutList,
  ChevronLeft, ChevronRight, Pencil, Kanban,
  PanelLeftClose, PanelLeftOpen, Edit2, Check, X,
  Phone, MoreHorizontal, Tag, Calendar, MessageSquare,
  Share2, FileText, Send, Tag as TagIcon,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "react-router-dom";
import { FunilEtapaDialog } from "@/components/funil/FunilEtapaDialog";
import { ETAPA_CORES, type FunilEtapa } from "@/components/funil/funilUtils";
import {
  ConsorcioLead, ConsorcioInteracao, LeadConsorcioForm,
  EMPTY_LEAD_FORM, SEGMENTOS, ORIGENS, INTERACAO_TIPOS,
  formatCurrency, whatsappHref, fmtDate, formToPayload,
  type Segmento, type InteracaoTipo,
} from "@/lib/consorcios";
import { useEmpresa } from "@/contexts/EmpresaContext";

// ── Default etapas ao criar novo quadro ───────────────────────────────────────

const ETAPAS_PADRAO: Array<{ nome: string; cor: string; tipo: FunilEtapa["tipo"] }> = [
  { nome: "Novo Lead", cor: "slate", tipo: "em_andamento" },
  { nome: "Em Contato", cor: "blue", tipo: "em_andamento" },
  { nome: "Reunião Agendada", cor: "yellow", tipo: "em_andamento" },
  { nome: "Proposta Enviada", cor: "purple", tipo: "em_andamento" },
  { nome: "Contrato Fechado", cor: "green", tipo: "ganho" },
  { nome: "Perdido", cor: "red", tipo: "perdido" },
];

type Quadro = { id: string; nome: string; ordem: number };

// ── helpers ───────────────────────────────────────────────────────────────────

const SEG_ICON_BG: Record<string, string> = {
  imoveis: "bg-blue-600",
  veiculos: "bg-orange-500",
  servicos: "bg-purple-600",
};

function fmtK(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString("pt-BR");
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function daysBadgeClass(d: number): string {
  if (d <= 3) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (d <= 7) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({
  lead, comerciaisMap, etapaNome, onClick, onDelete, isOverlay = false,
}: {
  lead: ConsorcioLead;
  comerciaisMap: Map<string, string>;
  etapaNome?: string;
  onClick: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: isOverlay,
  });

  const style = transform ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)` } : undefined;
  const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
  const d = daysAgo(lead.created_at);
  const valorK = lead.valor_credito ? fmtK(lead.valor_credito) : null;
  const titulo = [lead.nome, seg?.label, valorK].filter(Boolean).join(" - ");
  const responsavel = lead.responsavel_id ? comerciaisMap.get(lead.responsavel_id) : null;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      className={cn(
        "bg-card border rounded-xl shadow-sm overflow-hidden",
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all",
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-2xl rotate-1 cursor-grabbing"
      )}
      onClick={onClick}
    >
      {/* Top row */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[18px]", SEG_ICON_BG[lead.segmento] ?? "bg-slate-600")}>
            {seg?.emoji}
          </div>
          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded", daysBadgeClass(d))}>
            {d}d
          </span>
        </div>
        <div
          className="flex items-center gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {lead.telefone && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3" />
              {lead.telefone}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={onClick}>
                <Pencil className="h-3.5 w-3.5 mr-2" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <div className="px-3 pb-2">
        <div className="font-semibold text-sm leading-tight line-clamp-2">{titulo}</div>
        <div className="text-xs text-muted-foreground mt-0.5">Cliente: {lead.nome}</div>
      </div>

      {/* Value */}
      <div className="px-3 pb-2 flex items-center justify-between min-h-[24px]">
        <TagIcon className="h-3.5 w-3.5 text-muted-foreground/25" />
        {valorK && (
          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            R$ {valorK}
          </span>
        )}
      </div>

      {/* Action row */}
      <div
        className="border-t flex items-center justify-between px-2 py-1.5 bg-muted/20"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          <button
            title="Ligar"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-500 transition-colors"
            onClick={() => lead.telefone && window.open(`tel:${lead.telefone}`)}
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
          <button
            title="WhatsApp"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-green-50 dark:hover:bg-green-950/40 text-green-600 transition-colors"
            onClick={() => lead.telefone && window.open(whatsappHref(lead.telefone), "_blank")}
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
          <button
            title="Histórico"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            onClick={onClick}
          >
            <Calendar className="h-3.5 w-3.5" />
          </button>
          <button
            title="Comentários"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            onClick={onClick}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>
        {responsavel && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
            {responsavel.split(" ")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  etapa, leads, comerciaisMap,
  onLeadClick, onDeleteLead,
  onEditEtapa, onDeleteEtapa, onMoveEtapa,
  canMoveLeft, canMoveRight,
}: {
  etapa: FunilEtapa;
  leads: ConsorcioLead[];
  comerciaisMap: Map<string, string>;
  onLeadClick: (lead: ConsorcioLead) => void;
  onDeleteLead: (id: string) => void;
  onEditEtapa: (etapa: FunilEtapa) => void;
  onDeleteEtapa: (etapa: FunilEtapa) => void;
  onMoveEtapa: (etapa: FunilEtapa, direction: -1 | 1) => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const cores = ETAPA_CORES[etapa.cor] || ETAPA_CORES.slate;
  const totalValor = leads.reduce((acc, l) => acc + (l.valor_credito ?? 0), 0);

  return (
    <div className="flex flex-col w-[280px] min-w-[280px] max-w-[280px] shrink-0 h-full">
      <div className="flex items-center justify-between gap-1 mb-3 group shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cores.dot}`} />
          <h3 className="text-sm font-semibold leading-tight break-words min-w-0">{etapa.nome}</h3>
          <span className="text-xs bg-secondary text-muted-foreground rounded-full px-2 py-0.5 shrink-0">
            {leads.length}
          </span>
          {totalValor > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">
              {totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canMoveLeft} onClick={() => onMoveEtapa(etapa, -1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" disabled={!canMoveRight} onClick={() => onMoveEtapa(etapa, 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditEtapa(etapa)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDeleteEtapa(etapa)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto space-y-2.5 rounded-lg p-2 transition-colors min-h-[140px]",
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        )}
        style={{ maxHeight: "calc(100svh - 24rem)" }}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            comerciaisMap={comerciaisMap}
            etapaNome={etapa.nome}
            onClick={() => onLeadClick(lead)}
            onDelete={() => onDeleteLead(lead.id)}
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

// ── LeadFormDialog (criar novo lead) ─────────────────────────────────────────

function LeadFormDialog({
  open, onClose, onSaved, comerciais, etapas, defaultEtapaId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  comerciais: Array<{ id: string; nome: string }>;
  etapas: FunilEtapa[];
  defaultEtapaId?: string;
}) {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [form, setForm] = useState<LeadConsorcioForm>({ ...EMPTY_LEAD_FORM });

  useEffect(() => {
    if (open) setForm({ ...EMPTY_LEAD_FORM, etapa_id: defaultEtapaId ?? "" });
  }, [open, defaultEtapaId]);

  function set(field: keyof LeadConsorcioForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim()) throw new Error("Nome é obrigatório");
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .insert({ ...formToPayload(form), empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
      toast.success("Lead cadastrado");
      onSaved();
      onClose();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90svh] overflow-y-auto">
        <div className="font-semibold text-lg mb-4">Novo Lead — Consórcio</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome do interessado" />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(99) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1">
              <Label>CPF / CNPJ</Label>
              <Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Ex.: Maringá" />
            </div>
            <div className="space-y-1">
              <Label>Segmento *</Label>
              <Select value={form.segmento} onValueChange={(v) => set("segmento", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEGMENTOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.origem === "indicacao" && (
              <div className="col-span-2 space-y-1">
                <Label>Indicado por</Label>
                <Input value={form.indicado_por} onChange={(e) => set("indicado_por", e.target.value)} placeholder="Nome de quem indicou" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Valor de crédito (R$)</Label>
              <Input value={form.valor_credito} onChange={(e) => set("valor_credito", e.target.value)} placeholder="Ex.: 250000" type="number" min={0} />
            </div>
            <div className="space-y-1">
              <Label>Prazo (meses)</Label>
              <Input value={form.prazo} onChange={(e) => set("prazo", e.target.value)} placeholder="Ex.: 180" type="number" min={1} />
            </div>
            <div className="space-y-1">
              <Label>Etapa inicial</Label>
              <Select value={form.etapa_id} onValueChange={(v) => set("etapa_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={(v) => set("responsavel_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {comerciais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} placeholder="Informações adicionais..." />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar Lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── LeadDetailDialog ──────────────────────────────────────────────────────────

function LeadDetailDialog({
  lead, comerciais, etapas, onClose, onUpdated,
}: {
  lead: ConsorcioLead | null;
  comerciais: Array<{ id: string; nome: string }>;
  etapas: FunilEtapa[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<LeadConsorcioForm>(EMPTY_LEAD_FORM);
  const [dirty, setDirty] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState<{ tipo: InteracaoTipo; descricao: string }>({ tipo: "nota", descricao: "" });
  const [activeTab, setActiveTab] = useState("comentarios");

  useEffect(() => {
    if (lead) {
      setForm({
        nome: lead.nome,
        telefone: lead.telefone ?? "",
        email: lead.email ?? "",
        cpf_cnpj: lead.cpf_cnpj ?? "",
        segmento: lead.segmento,
        valor_credito: lead.valor_credito?.toString() ?? "",
        prazo: lead.prazo?.toString() ?? "",
        origem: lead.origem ?? "",
        indicado_por: lead.indicado_por ?? "",
        etapa_id: lead.etapa_id ?? "",
        responsavel_id: lead.responsavel_id ?? "",
        observacoes: lead.observacoes ?? "",
        cidade: lead.cidade ?? "",
      });
      setDirty(false);
      setActiveTab("comentarios");
    }
  }, [lead?.id]);

  function set(field: keyof LeadConsorcioForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }

  const { data: interacoes = [], refetch: refetchInteracoes } = useQuery({
    queryKey: ["consorcios-interacoes", lead?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_interacoes").select("*")
        .eq("lead_id", lead!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ConsorcioInteracao[];
    },
    enabled: !!lead,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ ...formToPayload(form), updated_at: new Date().toISOString() })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
      toast.success("Lead atualizado");
      setDirty(false);
      onUpdated();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", lead!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
      toast.success("Lead excluído");
      onClose();
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const addInteracaoMutation = useMutation({
    mutationFn: async () => {
      if (!novaInteracao.descricao.trim()) throw new Error("Descrição obrigatória");
      const { error } = await (supabase as any).from("consorcios_interacoes").insert({
        lead_id: lead!.id,
        tipo: novaInteracao.tipo,
        descricao: novaInteracao.descricao.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchInteracoes();
      setNovaInteracao({ tipo: "nota", descricao: "" });
      toast.success("Comentário registrado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteInteracaoMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("consorcios_interacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchInteracoes();
      toast.success("Comentário excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  if (!lead) return null;

  const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
  const etapaAtual = etapas.find((e) => e.id === lead.etapa_id);
  const responsavelNome = lead.responsavel_id ? (comerciais.find((c) => c.id === lead.responsavel_id)?.nome ?? "—") : "—";
  const origemLabel = ORIGENS.find((o) => o.id === lead.origem)?.label;
  const valorK = lead.valor_credito ? fmtK(lead.valor_credito) : null;

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[95vw] w-[1100px] h-[92svh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* ── Blue header ── */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shrink-0">
          <div className="flex items-start gap-4 px-5 py-4">
            {/* Segmento icon */}
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shrink-0 mt-0.5">
              {seg?.emoji ?? "📋"}
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold leading-tight truncate">
                  {[lead.nome, seg?.label, valorK].filter(Boolean).join(" - ")}
                </h2>
                {etapaAtual && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/20 shrink-0">
                    {etapaAtual.nome.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-blue-100 flex-wrap">
                <span>Cliente: {lead.nome}</span>
                {lead.telefone && (
                  <a href={`tel:${lead.telefone}`} className="flex items-center gap-1 hover:text-white transition-colors">
                    <Phone className="h-3.5 w-3.5" />{lead.telefone}
                  </a>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-blue-200 flex-wrap">
                <span>Criado: {fmtDate(lead.created_at)}</span>
                <span>Atualizado: {fmtDate(lead.updated_at)}</span>
              </div>
            </div>

            {/* Value + close */}
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              {lead.valor_credito && (
                <div className="text-2xl font-bold leading-none">
                  R$ {lead.valor_credito.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
              {lead.prazo && (
                <div className="text-xs text-blue-200">{lead.prazo} meses</div>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="shrink-0 h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left sidebar */}
          <div className="w-[220px] shrink-0 border-r flex flex-col p-4 gap-2 overflow-y-auto bg-muted/20">
            <button
              onClick={() => setActiveTab("dados")}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors text-left w-full"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />Editar
            </button>
            <a
              href={lead.telefone ? `tel:${lead.telefone}` : undefined}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                lead.telefone
                  ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/50"
                  : "opacity-40 cursor-not-allowed text-muted-foreground"
              )}
            >
              <Phone className="h-4 w-4" />Ligar
            </a>
            <a
              href={lead.telefone ? whatsappHref(lead.telefone) : undefined}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full",
                lead.telefone
                  ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/50"
                  : "opacity-40 cursor-not-allowed text-muted-foreground"
              )}
            >
              <MessageCircle className="h-4 w-4" />WhatsApp
            </a>
            <button
              onClick={() => {
                const txt = [lead.nome, lead.telefone, lead.email, seg?.label, valorK ? `R$${valorK}` : ""].filter(Boolean).join(" | ");
                navigator.clipboard.writeText(txt).then(() => toast.success("Copiado!"));
              }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-600 dark:text-orange-400 transition-colors text-left w-full"
            >
              <Share2 className="h-4 w-4" />Compartilhar
            </button>
            <button
              onClick={() => toast.info("Funcionalidade em breve")}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400 transition-colors text-left w-full"
            >
              <FileText className="h-4 w-4" />Gerar Proposta
            </button>

            {/* Divider + info */}
            <div className="border-t my-1" />

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Responsável</span>
                <span className="text-foreground font-medium text-right truncate max-w-[110px]">{responsavelNome}</span>
              </div>
              {origemLabel && (
                <div className="flex items-center justify-between">
                  <span>Origem</span>
                  <span className="text-foreground font-medium">{origemLabel}</span>
                </div>
              )}
              {lead.cidade && (
                <div className="flex items-center justify-between">
                  <span>Cidade</span>
                  <span className="text-foreground font-medium">{lead.cidade}</span>
                </div>
              )}
              {lead.prazo && (
                <div className="flex items-center justify-between">
                  <span>Prazo</span>
                  <span className="text-foreground font-medium">{lead.prazo} meses</span>
                </div>
              )}
            </div>

            {/* TAGS */}
            <div className="border-t my-1" />
            <div>
              <div className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">TAGS</div>
              <div className="flex flex-wrap gap-1.5">
                {seg && (
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", seg.className)}>
                    {seg.emoji} {seg.label}
                  </span>
                )}
                {origemLabel && (
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {origemLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Delete */}
            <div className="border-t mt-auto pt-3">
              <button
                onClick={() => { if (confirm(`Excluir "${lead.nome}"?`)) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 text-xs text-destructive hover:text-destructive/80 transition-colors w-full"
              >
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Excluir lead
              </button>
            </div>
          </div>

          {/* Right area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-4 shrink-0 border-b">
                <TabsList>
                  <TabsTrigger value="comentarios" className="gap-1.5">
                    Comentários
                    {interacoes.length > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                        {interacoes.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                </TabsList>
              </div>

              {/* Comentários */}
              <TabsContent value="comentarios" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                {/* Add comment */}
                <div className="px-5 pt-4 pb-3 border-b shrink-0 space-y-2">
                  <Textarea
                    placeholder="Adicionar comentário... (Enter para enviar)"
                    value={novaInteracao.descricao}
                    onChange={(e) => setNovaInteracao((p) => ({ ...p, descricao: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && novaInteracao.descricao.trim()) {
                        e.preventDefault();
                        addInteracaoMutation.mutate();
                      }
                    }}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <Select
                      value={novaInteracao.tipo}
                      onValueChange={(v) => setNovaInteracao((p) => ({ ...p, tipo: v as InteracaoTipo }))}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INTERACAO_TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={!novaInteracao.descricao.trim() || addInteracaoMutation.isPending}
                      onClick={() => addInteracaoMutation.mutate()}
                    >
                      {addInteracaoMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />}
                      Enviar
                    </Button>
                  </div>
                </div>

                {/* Comment list */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {interacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum comentário ainda.</p>
                  ) : (
                    interacoes.map((i) => (
                      <div key={i.id} className="flex gap-3 group/comment">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-base">
                          {i.tipo === "ligacao" ? "📞" : i.tipo === "whatsapp" ? "💬" : i.tipo === "email" ? "✉️" : i.tipo === "reuniao" ? "📅" : i.tipo === "visita" ? "🚶" : "📝"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-medium text-foreground">
                              {INTERACAO_TIPOS.find((t) => t.id === i.tipo)?.label ?? i.tipo}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-muted-foreground">{fmtDate(i.created_at)}</span>
                              <button
                                onClick={() => { if (confirm("Excluir este comentário?")) deleteInteracaoMutation.mutate(i.id); }}
                                className="opacity-0 group-hover/comment:opacity-100 h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                                title="Excluir comentário"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed break-words">{i.descricao}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Dados / Edit form */}
              <TabsContent value="dados" className="flex-1 overflow-y-auto m-0 px-5 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.nome} onChange={(e) => set("nome", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(99) 99999-9999" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">CPF / CNPJ</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Segmento</Label>
                    <Select value={form.segmento} onValueChange={(v) => set("segmento", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEGMENTOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origem</Label>
                    <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {ORIGENS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.origem === "indicacao" && (
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Indicado por</Label>
                      <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.indicado_por} onChange={(e) => set("indicado_por", e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Valor crédito (R$)</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="number" min={0} value={form.valor_credito} onChange={(e) => set("valor_credito", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prazo (meses)</Label>
                    <input className="w-full border rounded-md px-3 py-2 text-sm bg-background" type="number" min={1} value={form.prazo} onChange={(e) => set("prazo", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Etapa</Label>
                    <Select value={form.etapa_id} onValueChange={(v) => set("etapa_id", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {etapas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Responsável</Label>
                    <Select value={form.responsavel_id} onValueChange={(v) => set("responsavel_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem responsável</SelectItem>
                        {comerciais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={3} />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={() => updateMutation.mutate()} disabled={!dirty || updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar alterações
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Pipeline page ─────────────────────────────────────────────────────────────

interface Filters {
  search: string;
  segmento: Segmento | "todos";
  responsavel_id: string;
}

const Pipeline = () => {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const [filters, setFilters] = useState<Filters>({ search: "", segmento: "todos", responsavel_id: "todos" });
  const debouncedSearch = useDebounce(filters.search, 300);
  const [selectedQuadroId, setSelectedQuadroId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [newQuadroName, setNewQuadroName] = useState("");
  const [editingQuadroId, setEditingQuadroId] = useState<string | null>(null);
  const [editingQuadroName, setEditingQuadroName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ConsorcioLead | null>(null);
  const [activeLead, setActiveLead] = useState<ConsorcioLead | null>(null);
  const [etapaDialogOpen, setEtapaDialogOpen] = useState(false);
  const [editEtapa, setEditEtapa] = useState<FunilEtapa | null>(null);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  // ── Queries ──

  const { data: quadros = [], isLoading: quadrosLoading } = useQuery<Quadro[]>({
    queryKey: ["funil-quadros-consorcios", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("funil_quadros").select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as Quadro[];
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (!selectedQuadroId && quadros.length > 0) setSelectedQuadroId(quadros[0].id);
  }, [quadros, selectedQuadroId]);

  const selectedQuadro = useMemo(() => quadros.find((q) => q.id === selectedQuadroId) ?? null, [quadros, selectedQuadroId]);

  const { data: etapas = [], isLoading: etapasLoading } = useQuery<FunilEtapa[]>({
    queryKey: ["funil-etapas-consorcios", selectedQuadroId],
    queryFn: async () => {
      if (!selectedQuadroId) return [];
      const { data, error } = await (supabase as any)
        .from("funil_etapas").select("*")
        .eq("quadro_id", selectedQuadroId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as FunilEtapa[];
    },
    enabled: !!selectedQuadroId,
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<ConsorcioLead[]>({
    queryKey: ["consorcios-leads", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_leads").select("*")
        .eq("empresa_id", empresaId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ConsorcioLead[];
    },
    enabled: !!empresaId,
  });

  const { data: comerciais = [] } = useQuery<Array<{ id: string; nome: string }>>({
    queryKey: ["comerciais-consorcios", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comerciais").select("id, nome")
        .eq("empresa_id", empresaId!).eq("ativo", true).is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const comerciaisMap = useMemo(() => new Map(comerciais.map((c) => [c.id, c.nome])), [comerciais]);
  const etapasOrdenadas = useMemo(() => [...etapas].sort((a, b) => a.ordem - b.ordem), [etapas]);

  const currentEtapaIds = useMemo(() => new Set(etapas.map((e) => e.id)), [etapas]);
  const quadroLeads = useMemo(() => leads.filter((l) => l.etapa_id && currentEtapaIds.has(l.etapa_id)), [leads, currentEtapaIds]);

  const filteredLeads = useMemo(() => {
    return quadroLeads.filter((l) => {
      if (debouncedSearch && !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) && !l.telefone?.includes(debouncedSearch)) return false;
      if (filters.segmento !== "todos" && l.segmento !== filters.segmento) return false;
      if (filters.responsavel_id !== "todos") {
        if (filters.responsavel_id === "sem" && l.responsavel_id) return false;
        if (filters.responsavel_id !== "sem" && l.responsavel_id !== filters.responsavel_id) return false;
      }
      return true;
    });
  }, [quadroLeads, debouncedSearch, filters]);

  const getByEtapa = (etapaId: string) => filteredLeads.filter((l) => l.etapa_id === etapaId);

  // ── Mutations: quadros ──

  const createQuadroMutation = useMutation({
    mutationFn: async (nome: string) => {
      const { data: quadro, error } = await (supabase as any)
        .from("funil_quadros")
        .insert({ nome: nome.trim(), ordem: quadros.length, empresa_id: empresaId })
        .select("id").single();
      if (error) throw error;
      await Promise.all(
        ETAPAS_PADRAO.map((e, i) =>
          (supabase as any).from("funil_etapas").insert({ ...e, quadro_id: quadro.id, ordem: i, empresa_id: empresaId, observacoes: null })
        )
      );
      return quadro.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["funil-quadros-consorcios", empresaId] });
      setNewQuadroName("");
      setSelectedQuadroId(id);
      toast.success("Quadro criado");
    },
    onError: (err: any) => toast.error("Erro ao criar quadro: " + err.message),
  });

  const renameQuadroMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await (supabase as any).from("funil_quadros").update({ nome: nome.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funil-quadros-consorcios", empresaId] });
      setEditingQuadroId(null);
      toast.success("Quadro renomeado");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteQuadroMutation = useMutation({
    mutationFn: async (quadro: Quadro) => {
      const { data: quadroEtapas } = await (supabase as any).from("funil_etapas").select("id").eq("quadro_id", quadro.id);
      const etapaIds = (quadroEtapas || []).map((e: any) => e.id as string);
      const emUso = leads.filter((l) => l.etapa_id && etapaIds.includes(l.etapa_id)).length;
      if (emUso > 0) throw new Error(`Mova os ${emUso} lead(s) deste quadro antes de excluí-lo.`);
      if (etapaIds.length > 0) await (supabase as any).from("funil_etapas").delete().in("id", etapaIds);
      const { error } = await (supabase as any).from("funil_quadros").delete().eq("id", quadro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funil-quadros-consorcios", empresaId] });
      setSelectedQuadroId(null);
      toast.success("Quadro excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // ── Mutations: etapas ──

  const insertEtapaMutation = useMutation({
    mutationFn: async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string }) => {
      const { error } = await (supabase as any).from("funil_etapas").insert({ ...data, quadro_id: selectedQuadroId, ordem: etapas.length, empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); toast.success("Coluna criada"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string } }) => {
      const { error } = await (supabase as any).from("funil_etapas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); toast.success("Coluna atualizada"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const deleteEtapaMutation = useMutation({
    mutationFn: async (etapa: FunilEtapa) => {
      const emUso = leads.filter((l) => l.etapa_id === etapa.id).length;
      if (emUso > 0) throw new Error(`Mova os ${emUso} lead(s) desta coluna antes de excluí-la.`);
      const { error } = await (supabase as any).from("funil_etapas").delete().eq("id", etapa.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); toast.success("Coluna excluída"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const reorderEtapasMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; ordem: number }>) => {
      const results = await Promise.all(updates.map((u) => (supabase as any).from("funil_etapas").update({ ordem: u.ordem }).eq("id", u.id)));
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); },
    onError: (err: any) => toast.error("Erro ao mover coluna: " + err.message),
  });

  // ── Mutations: leads ──

  const moveLeadMutation = useMutation({
    mutationFn: async ({ id, etapaId }: { id: string; etapaId: string }) => {
      const { error } = await (supabase as any).from("consorcios_leads").update({ etapa_id: etapaId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["consorcios-leads"] }); },
    onError: (err: any) => toast.error("Erro ao mover lead: " + err.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("consorcios_leads").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["consorcios-leads"] }); toast.success("Lead excluído"); },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  // ── Handlers ──

  const handleMoveEtapa = (etapa: FunilEtapa, direction: -1 | 1) => {
    const ordenadas = [...etapasOrdenadas];
    const idx = ordenadas.findIndex((e) => e.id === etapa.id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= ordenadas.length) return;
    [ordenadas[idx], ordenadas[targetIdx]] = [ordenadas[targetIdx], ordenadas[idx]];
    reorderEtapasMutation.mutate(ordenadas.map((e, i) => ({ id: e.id, ordem: i })));
  };

  const handleSaveEtapa = async (data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string }) => {
    if (editEtapa) await updateEtapaMutation.mutateAsync({ id: editEtapa.id, data });
    else await insertEtapaMutation.mutateAsync(data);
  };

  const handleDeleteEtapa = (etapa: FunilEtapa) => {
    if (etapasOrdenadas.length <= 1) { toast.error("O pipeline precisa de ao menos uma coluna."); return; }
    if (confirm(`Excluir a coluna "${etapa.nome}"?`)) deleteEtapaMutation.mutate(etapa);
  };

  function onDragStart(event: DragStartEvent) {
    setActiveLead(leads.find((l) => l.id === event.active.id) ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead || lead.etapa_id === over.id) return;
    moveLeadMutation.mutate({ id: lead.id, etapaId: over.id as string });
  }

  const closedEtapaIds = useMemo(() => new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id)), [etapas]);
  const totalValor = useMemo(
    () => quadroLeads.filter((l) => l.etapa_id && closedEtapaIds.has(l.etapa_id)).reduce((acc, l) => acc + (l.valor_credito ?? 0), 0),
    [quadroLeads, closedEtapaIds]
  );

  return (
    <>
      <FunilEtapaDialog
        open={etapaDialogOpen}
        onClose={() => { setEtapaDialogOpen(false); setEditEtapa(null); }}
        onSave={handleSaveEtapa}
        initialData={editEtapa}
      />
      <LeadFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {}}
        comerciais={comerciais}
        etapas={etapasOrdenadas}
        defaultEtapaId={etapasOrdenadas[0]?.id}
      />
      <LeadDetailDialog
        lead={selectedLead}
        comerciais={comerciais}
        etapas={etapasOrdenadas}
        onClose={() => setSelectedLead(null)}
        onUpdated={() => { qc.invalidateQueries({ queryKey: ["consorcios-leads"] }); }}
      />

      <div className="flex h-full min-h-[calc(100vh-7rem)] rounded-lg overflow-hidden border bg-card">
        {/* Sidebar — lista de quadros */}
        {sidebarVisible && (
          <aside className="w-[220px] shrink-0 border-r bg-card flex flex-col">
            <div className="p-4 border-b flex items-center gap-2">
              <Kanban className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold leading-tight">Quadros</h2>
                <p className="text-xs text-muted-foreground">Pipelines do consórcio</p>
              </div>
            </div>
            <div className="p-3 border-b">
              <form
                onSubmit={(e) => { e.preventDefault(); if (newQuadroName.trim()) createQuadroMutation.mutate(newQuadroName); }}
                className="flex gap-2"
              >
                <Input value={newQuadroName} onChange={(e) => setNewQuadroName(e.target.value)} placeholder="Nome do quadro..." className="h-9 text-sm" />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={createQuadroMutation.isPending}>
                  {createQuadroMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </form>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {quadrosLoading ? (
                <p className="text-xs text-muted-foreground text-center p-4">Carregando...</p>
              ) : quadros.length === 0 ? (
                <div className="text-center p-6 space-y-2">
                  <Kanban className="h-8 w-8 mx-auto text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">Crie o primeiro quadro.</p>
                </div>
              ) : (
                quadros.map((quadro) => (
                  <div
                    key={quadro.id}
                    className={cn(
                      "flex items-center gap-1 px-2 py-2 rounded-md text-sm cursor-pointer group transition-colors",
                      selectedQuadroId === quadro.id ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted text-foreground"
                    )}
                  >
                    {editingQuadroId === quadro.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); if (editingQuadroName.trim()) renameQuadroMutation.mutate({ id: quadro.id, nome: editingQuadroName }); }}
                        className="flex items-center gap-1 flex-1"
                      >
                        <Input value={editingQuadroName} onChange={(e) => setEditingQuadroName(e.target.value)} className="h-7 text-xs" autoFocus />
                        <Button type="submit" size="icon" variant="ghost" className="h-7 w-7"><Check className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingQuadroId(null)}><X className="h-3.5 w-3.5" /></Button>
                      </form>
                    ) : (
                      <>
                        <span className="flex-1 truncate" onClick={() => setSelectedQuadroId(quadro.id)}>{quadro.nome}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => { setEditingQuadroId(quadro.id); setEditingQuadroName(quadro.nome); }} title="Renomear">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => { if (confirm(`Excluir "${quadro.nome}"?`)) deleteQuadroMutation.mutate(quadro); }} title="Excluir">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Área principal */}
        <main className="flex-1 min-w-0 flex flex-col bg-background overflow-auto">
          <div className="p-6 space-y-4 min-h-full">
            <PageHeader
              title={selectedQuadro?.nome ?? "Pipeline — Consórcio"}
              description={
                selectedQuadroId
                  ? `${quadroLeads.length} lead${quadroLeads.length !== 1 ? "s" : ""}${totalValor > 0 ? ` · ${formatCurrency(totalValor)} em contratos fechados` : ""}`
                  : "Selecione ou crie um quadro"
              }
            >
              <Button variant="outline" size="sm" onClick={() => setSidebarVisible((v) => !v)} className="gap-1">
                {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                {sidebarVisible ? "Ocultar" : "Quadros"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/consorcios/leads"><LayoutList className="h-4 w-4 mr-2" />Lista</Link>
              </Button>
              {selectedQuadroId && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />Novo Lead
                </Button>
              )}
            </PageHeader>

            {!selectedQuadroId ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Kanban className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">Selecione um quadro no painel lateral ou crie um novo.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input className="pl-9 w-56" placeholder="Buscar lead..." value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} />
                  </div>
                  <Select value={filters.segmento} onValueChange={(v) => setFilters((p) => ({ ...p, segmento: v as Segmento | "todos" }))}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Segmento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos segmentos</SelectItem>
                      {SEGMENTOS.map((s) => <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={filters.responsavel_id} onValueChange={(v) => setFilters((p) => ({ ...p, responsavel_id: v }))}>
                    <SelectTrigger className="w-[170px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos responsáveis</SelectItem>
                      <SelectItem value="sem">Sem responsável</SelectItem>
                      {comerciais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {leadsLoading || etapasLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                    <div className="overflow-x-auto pb-4">
                      <div className="flex gap-6 w-max min-w-full" style={{ minHeight: "calc(100svh - 28rem)" }}>
                        {etapasOrdenadas.map((etapa, idx) => (
                          <KanbanColumn
                            key={etapa.id}
                            etapa={etapa}
                            leads={getByEtapa(etapa.id)}
                            comerciaisMap={comerciaisMap}
                            onLeadClick={(lead) => setSelectedLead(lead)}
                            onDeleteLead={(id) => { if (confirm("Excluir este lead?")) deleteLeadMutation.mutate(id); }}
                            onEditEtapa={(e) => { setEditEtapa(e); setEtapaDialogOpen(true); }}
                            onDeleteEtapa={handleDeleteEtapa}
                            onMoveEtapa={handleMoveEtapa}
                            canMoveLeft={idx > 0}
                            canMoveRight={idx < etapasOrdenadas.length - 1}
                          />
                        ))}
                        <div className="flex flex-col w-[200px] shrink-0 pt-1">
                          <Button
                            variant="ghost"
                            className="w-full h-9 border border-dashed text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditEtapa(null); setEtapaDialogOpen(true); }}
                          >
                            <Plus className="h-4 w-4 mr-2" />Nova coluna
                          </Button>
                        </div>
                      </div>
                    </div>

                    <DragOverlay dropAnimation={null}>
                      {activeLead && (
                        <LeadCard
                          lead={activeLead}
                          comerciaisMap={comerciaisMap}
                          onClick={() => {}}
                          onDelete={() => {}}
                          isOverlay
                        />
                      )}
                    </DragOverlay>
                  </DndContext>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default Pipeline;
