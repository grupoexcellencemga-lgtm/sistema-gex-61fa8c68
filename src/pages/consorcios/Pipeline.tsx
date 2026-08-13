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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus, MessageCircle, Loader2, Trash2, Search, LayoutList,
  ChevronLeft, ChevronRight, Pencil, Kanban,
  PanelLeftClose, PanelLeftOpen, Edit2, Check, X,
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

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({
  lead, comerciaisMap, onClick, onDelete, isOverlay = false,
}: {
  lead: ConsorcioLead;
  comerciaisMap: Map<string, string>;
  onClick: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: isOverlay,
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
  const origem = ORIGENS.find((o) => o.id === lead.origem);

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      className={cn(
        "bg-card border rounded-lg p-3 space-y-2 group",
        "cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-all",
        isDragging && !isOverlay && "opacity-40",
        isOverlay && "shadow-xl rotate-1 cursor-grabbing"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium leading-tight line-clamp-2 flex-1">{lead.nome}</span>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {seg && (
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full", seg.className)}>
          {seg.emoji} {seg.label}
        </span>
      )}

      {lead.valor_credito && (
        <div className="text-xs font-semibold text-foreground/80">
          {formatCurrency(lead.valor_credito)}
          {lead.prazo && <span className="font-normal text-muted-foreground"> · {lead.prazo} meses</span>}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 min-w-0">
        {lead.telefone ? (
          <a
            href={whatsappHref(lead.telefone)}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[11px] text-green-600 hover:text-green-700 transition-colors"
          >
            <MessageCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.telefone}</span>
          </a>
        ) : <span />}
        {lead.responsavel_id && (
          <span className="text-[11px] text-muted-foreground truncate shrink-0">
            {comerciaisMap.get(lead.responsavel_id) ?? "—"}
          </span>
        )}
      </div>

      {origem && <div className="text-[11px] text-muted-foreground">via {origem.label}</div>}
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
        className={cn(
          "flex-1 min-h-0 overflow-y-auto space-y-2 rounded-lg p-2 transition-colors min-h-[140px]",
          isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted/30"
        )}
        style={{ maxHeight: "calc(100svh - 24rem)" }}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            comerciaisMap={comerciaisMap}
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

// ── LeadFormDialog ────────────────────────────────────────────────────────────

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
        <DialogHeader>
          <DialogTitle>Novo Lead — Consórcio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              <Input value={form.valor_credito} onChange={(e) => set("valor_credito", e.target.value)} placeholder="Ex.: 150000" type="number" min={0} />
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cadastrar Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── LeadDetailSheet ───────────────────────────────────────────────────────────

function LeadDetailSheet({
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
      toast.success("Interação registrada");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-[480px] flex flex-col p-0 gap-0">
        <SheetHeader className="p-5 border-b shrink-0">
          <SheetTitle className="truncate">{lead?.nome ?? ""}</SheetTitle>
          {lead && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(() => {
                const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
                return seg ? (
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full", seg.className)}>
                    {seg.emoji} {seg.label}
                  </span>
                ) : null;
              })()}
              {lead.valor_credito && (
                <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(lead.valor_credito)}</span>
              )}
              {lead.telefone && (
                <a href={whatsappHref(lead.telefone)} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />{lead.telefone}
                </a>
              )}
            </div>
          )}
        </SheetHeader>

        <Tabs defaultValue="dados" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-4 shrink-0 w-auto self-start">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="historico">
              Histórico
              {interacoes.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{interacoes.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="flex-1 overflow-y-auto p-5 space-y-3 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(99) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF / CNPJ</Label>
                <Input value={form.cpf_cnpj} onChange={(e) => set("cpf_cnpj", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
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
                  <Input value={form.indicado_por} onChange={(e) => set("indicado_por", e.target.value)} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Valor crédito (R$)</Label>
                <Input value={form.valor_credito} onChange={(e) => set("valor_credito", e.target.value)} type="number" min={0} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prazo (meses)</Label>
                <Input value={form.prazo} onChange={(e) => set("prazo", e.target.value)} type="number" min={1} />
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

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="destructive" size="sm"
                onClick={() => { if (confirm(`Excluir o lead "${lead?.nome}"?`)) deleteMutation.mutate(); }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
              <Button onClick={() => updateMutation.mutate()} disabled={!dirty || updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="flex-1 flex flex-col overflow-hidden p-5 gap-4 mt-0">
            <div className="space-y-2 shrink-0">
              <div className="flex gap-2">
                <Select
                  value={novaInteracao.tipo}
                  onValueChange={(v) => setNovaInteracao((p) => ({ ...p, tipo: v as InteracaoTipo }))}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERACAO_TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" className="shrink-0" onClick={() => addInteracaoMutation.mutate()}
                  disabled={!novaInteracao.descricao.trim() || addInteracaoMutation.isPending}>
                  {addInteracaoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
                </Button>
              </div>
              <Textarea
                placeholder="Descreva a interação..."
                value={novaInteracao.descricao}
                onChange={(e) => setNovaInteracao((p) => ({ ...p, descricao: e.target.value }))}
                rows={2}
              />
            </div>

            <Separator />

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {interacoes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma interação registrada ainda.</p>
              )}
              {interacoes.map((i) => (
                <div key={i.id} className="space-y-0.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {INTERACAO_TIPOS.find((t) => t.id === i.tipo)?.label ?? i.tipo}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(i.created_at)}</span>
                  </div>
                  <p className="text-muted-foreground leading-snug">{i.descricao}</p>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
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

  // Leads do quadro selecionado
  const currentEtapaIds = useMemo(() => new Set(etapas.map((e) => e.id)), [etapas]);
  const quadroLeads = useMemo(() => leads.filter((l) => l.etapa_id && currentEtapaIds.has(l.etapa_id)), [leads, currentEtapaIds]);

  const filteredLeads = useMemo(() => {
    return quadroLeads.filter((l) => {
      if (
        debouncedSearch &&
        !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !l.telefone?.includes(debouncedSearch)
      ) return false;
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
      const ordem = quadros.length;
      const { data: quadro, error } = await (supabase as any)
        .from("funil_quadros")
        .insert({ nome: nome.trim(), ordem, empresa_id: empresaId })
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
      const { data: quadroEtapas } = await (supabase as any)
        .from("funil_etapas").select("id").eq("quadro_id", quadro.id);
      const etapaIds = (quadroEtapas || []).map((e: any) => e.id as string);
      const etapaSet = new Set(etapaIds);

      const emUso = leads.filter((l) => l.etapa_id && etapaSet.has(l.etapa_id)).length;
      if (emUso > 0) throw new Error(`Mova os ${emUso} lead(s) deste quadro antes de excluí-lo.`);

      if (etapaIds.length > 0) {
        await (supabase as any).from("funil_etapas").delete().in("id", etapaIds);
      }
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
      const ordem = etapas.length;
      const { error } = await (supabase as any).from("funil_etapas").insert({
        ...data, quadro_id: selectedQuadroId, ordem, empresa_id: empresaId,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); toast.success("Coluna criada"); },
    onError: (err: any) => toast.error("Erro ao criar coluna: " + err.message),
  });

  const updateEtapaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { nome: string; cor: string; tipo: FunilEtapa["tipo"]; observacoes: string } }) => {
      const { error } = await (supabase as any).from("funil_etapas").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); toast.success("Coluna atualizada"); },
    onError: (err: any) => toast.error("Erro ao atualizar coluna: " + err.message),
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
      const results = await Promise.all(
        updates.map((u) => (supabase as any).from("funil_etapas").update({ ordem: u.ordem }).eq("id", u.id))
      );
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["funil-etapas-consorcios", selectedQuadroId] }); },
    onError: (err: any) => toast.error("Erro ao mover coluna: " + err.message),
  });

  // ── Mutations: leads ──

  const moveLeadMutation = useMutation({
    mutationFn: async ({ id, etapaId }: { id: string; etapaId: string }) => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ etapa_id: etapaId, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["consorcios-leads"] }); },
    onError: (err: any) => toast.error("Erro ao mover lead: " + err.message),
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
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
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    if (!over) return;
    const lead = leads.find((l) => l.id === active.id);
    if (!lead) return;
    const newEtapaId = over.id as string;
    if (lead.etapa_id === newEtapaId) return;
    moveLeadMutation.mutate({ id: lead.id, etapaId: newEtapaId });
  }

  const closedEtapaIds = useMemo(() => new Set(etapas.filter((e) => e.tipo === "ganho").map((e) => e.id)), [etapas]);
  const totalValor = useMemo(
    () => quadroLeads.filter((l) => l.etapa_id && closedEtapaIds.has(l.etapa_id)).reduce((acc, l) => acc + (l.valor_credito ?? 0), 0),
    [quadroLeads, closedEtapaIds]
  );

  const loading = quadrosLoading || leadsLoading;

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
      <LeadDetailSheet
        lead={selectedLead}
        comerciais={comerciais}
        etapas={etapasOrdenadas}
        onClose={() => setSelectedLead(null)}
        onUpdated={() => { if (selectedLead) qc.invalidateQueries({ queryKey: ["consorcios-leads"] }); }}
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
                <Input
                  value={newQuadroName}
                  onChange={(e) => setNewQuadroName(e.target.value)}
                  placeholder="Nome do quadro..."
                  className="h-9 text-sm"
                />
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
                  <p className="text-xs text-muted-foreground">Crie o primeiro quadro do pipeline.</p>
                </div>
              ) : (
                quadros.map((quadro) => (
                  <div
                    key={quadro.id}
                    className={cn(
                      "flex items-center gap-1 px-2 py-2 rounded-md text-sm cursor-pointer group transition-colors",
                      selectedQuadroId === quadro.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {editingQuadroId === quadro.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (editingQuadroName.trim()) renameQuadroMutation.mutate({ id: quadro.id, nome: editingQuadroName });
                        }}
                        className="flex items-center gap-1 flex-1"
                      >
                        <Input value={editingQuadroName} onChange={(e) => setEditingQuadroName(e.target.value)} className="h-7 text-xs" autoFocus />
                        <Button type="submit" size="icon" variant="ghost" className="h-7 w-7">
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingQuadroId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : (
                      <>
                        <span className="flex-1 truncate" onClick={() => setSelectedQuadroId(quadro.id)}>
                          {quadro.nome}
                        </span>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => { setEditingQuadroId(quadro.id); setEditingQuadroName(quadro.nome); }} title="Renomear">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                          onClick={() => {
                            if (confirm(`Excluir o quadro "${quadro.nome}"? As colunas vazias serão removidas.`))
                              deleteQuadroMutation.mutate(quadro);
                          }} title="Excluir">
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
                  ? `${quadroLeads.length} lead${quadroLeads.length !== 1 ? "s" : ""} ativos${totalValor > 0 ? ` · ${formatCurrency(totalValor)} em contratos fechados` : ""}`
                  : "Selecione ou crie um quadro"
              }
            >
              <Button variant="outline" size="sm" onClick={() => setSidebarVisible((v) => !v)} className="gap-1">
                {sidebarVisible ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                {sidebarVisible ? "Ocultar" : "Quadros"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/consorcios/leads">
                  <LayoutList className="h-4 w-4 mr-2" />Lista
                </Link>
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
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      className="pl-9 w-56"
                      placeholder="Buscar lead..."
                      value={filters.search}
                      onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                    />
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

                {/* Board */}
                {loading || etapasLoading ? (
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
