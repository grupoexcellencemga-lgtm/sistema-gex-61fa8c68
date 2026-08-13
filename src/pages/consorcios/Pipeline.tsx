import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Plus,
  Phone,
  MessageCircle,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  UserPlus,
  Loader2,
  Trash2,
  Search,
  LayoutList,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { Link } from "react-router-dom";
import {
  ConsorcioLead,
  ConsorcioInteracao,
  LeadConsorcioForm,
  EMPTY_LEAD_FORM,
  ETAPA_LIST,
  SEGMENTOS,
  ORIGENS,
  INTERACAO_TIPOS,
  formatCurrency,
  whatsappHref,
  fmtDate,
  formToPayload,
  type EtapaConsorcio,
  type Segmento,
  type InteracaoTipo,
} from "@/lib/consorcios";
import { useEmpresa } from "@/contexts/EmpresaContext";

// ── Pipeline stages with icons and colors ─────────────────────────────────────

const PIPELINE_STAGES = [
  {
    id: "novo_lead" as EtapaConsorcio,
    label: "Novo Lead",
    Icon: UserPlus,
    colClass: "border-slate-200 bg-slate-50/80 dark:bg-slate-900/20 dark:border-slate-700",
    headClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  {
    id: "em_contato" as EtapaConsorcio,
    label: "Em Contato",
    Icon: Phone,
    colClass: "border-blue-200 bg-blue-50/80 dark:bg-blue-950/20 dark:border-blue-800",
    headClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  },
  {
    id: "reuniao_agendada" as EtapaConsorcio,
    label: "Reunião Agendada",
    Icon: Calendar,
    colClass: "border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800",
    headClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  {
    id: "proposta_enviada" as EtapaConsorcio,
    label: "Proposta Enviada",
    Icon: FileText,
    colClass: "border-violet-200 bg-violet-50/80 dark:bg-violet-950/20 dark:border-violet-800",
    headClass: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  },
  {
    id: "contrato_fechado" as EtapaConsorcio,
    label: "Contrato Fechado",
    Icon: CheckCircle2,
    colClass: "border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 dark:border-emerald-800",
    headClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  {
    id: "perdido" as EtapaConsorcio,
    label: "Perdido",
    Icon: XCircle,
    colClass: "border-red-200 bg-red-50/80 dark:bg-red-950/20 dark:border-red-800",
    headClass: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  },
] as const;

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  comerciaisMap,
  onClick,
  onDelete,
  isOverlay = false,
}: {
  lead: ConsorcioLead;
  comerciaisMap: Map<string, string>;
  onClick: () => void;
  onDelete: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

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
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {seg && (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full",
            seg.className
          )}
        >
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
        ) : (
          <span />
        )}
        {lead.responsavel_id && (
          <span className="text-[11px] text-muted-foreground truncate shrink-0">
            {comerciaisMap.get(lead.responsavel_id) ?? "—"}
          </span>
        )}
      </div>

      {origem && (
        <div className="text-[11px] text-muted-foreground">via {origem.label}</div>
      )}
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  leads,
  comerciaisMap,
  onLeadClick,
  onDeleteLead,
}: {
  stage: typeof PIPELINE_STAGES[number];
  leads: ConsorcioLead[];
  comerciaisMap: Map<string, string>;
  onLeadClick: (lead: ConsorcioLead) => void;
  onDeleteLead: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const { Icon } = stage;
  const totalValor = leads.reduce((acc, l) => acc + (l.valor_credito ?? 0), 0);

  return (
    <div
      className={cn(
        "flex flex-col w-[268px] shrink-0 rounded-xl border-2 transition-all duration-150",
        stage.colClass,
        isOver && "ring-2 ring-primary/60 ring-offset-2 scale-[1.01]"
      )}
    >
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-lg", stage.headClass)}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">{stage.label}</span>
        <Badge variant="secondary" className="text-xs shrink-0 bg-white/60 dark:bg-black/30">
          {leads.length}
        </Badge>
      </div>

      {totalValor > 0 && (
        <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground border-b border-current/10">
          {formatCurrency(totalValor)} em carteira
        </div>
      )}

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[80px]"
        style={{ maxHeight: "calc(100svh - 22rem)" }}
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
          <div className="h-16 flex items-center justify-center text-xs text-muted-foreground/40 select-none">
            Arraste leads aqui
          </div>
        )}
      </div>
    </div>
  );
}

// ── LeadFormDialog ────────────────────────────────────────────────────────────

function LeadFormDialog({
  open,
  onClose,
  onSaved,
  comerciais,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  comerciais: Array<{ id: string; nome: string }>;
}) {
  const qc = useQueryClient();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [form, setForm] = useState<LeadConsorcioForm>(EMPTY_LEAD_FORM);

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
      setForm(EMPTY_LEAD_FORM);
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
              <Input
                value={form.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Nome do interessado"
              />
            </div>

            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(99) 99999-9999"
              />
            </div>

            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-1">
              <Label>CPF / CNPJ</Label>
              <Input
                value={form.cpf_cnpj}
                onChange={(e) => set("cpf_cnpj", e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => set("cidade", e.target.value)}
                placeholder="Ex.: Maringá"
              />
            </div>

            <div className="space-y-1">
              <Label>Segmento *</Label>
              <Select value={form.segmento} onValueChange={(v) => set("segmento", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTOS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.emoji} {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.origem === "indicacao" && (
              <div className="col-span-2 space-y-1">
                <Label>Indicado por</Label>
                <Input
                  value={form.indicado_por}
                  onChange={(e) => set("indicado_por", e.target.value)}
                  placeholder="Nome de quem indicou"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>Valor de crédito (R$)</Label>
              <Input
                value={form.valor_credito}
                onChange={(e) => set("valor_credito", e.target.value)}
                placeholder="Ex.: 150000"
                type="number"
                min={0}
              />
            </div>

            <div className="space-y-1">
              <Label>Prazo (meses)</Label>
              <Input
                value={form.prazo}
                onChange={(e) => set("prazo", e.target.value)}
                placeholder="Ex.: 180"
                type="number"
                min={1}
              />
            </div>

            <div className="space-y-1">
              <Label>Etapa inicial</Label>
              <Select value={form.etapa} onValueChange={(v) => set("etapa", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ETAPA_LIST.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Responsável</Label>
              <Select
                value={form.responsavel_id}
                onValueChange={(v) => set("responsavel_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {comerciais.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={3}
                placeholder="Informações adicionais sobre o lead..."
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
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
  lead,
  comerciais,
  onClose,
  onUpdated,
}: {
  lead: ConsorcioLead | null;
  comerciais: Array<{ id: string; nome: string }>;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<LeadConsorcioForm>(EMPTY_LEAD_FORM);
  const [dirty, setDirty] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState<{
    tipo: InteracaoTipo;
    descricao: string;
  }>({ tipo: "nota", descricao: "" });

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
        etapa: lead.etapa,
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
        .from("consorcios_interacoes")
        .select("*")
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
      <SheetContent
        side="right"
        className="w-full max-w-[480px] flex flex-col p-0 gap-0"
      >
        <SheetHeader className="p-5 border-b shrink-0">
          <SheetTitle className="truncate">{lead?.nome ?? ""}</SheetTitle>
          {lead && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(() => {
                const seg = SEGMENTOS.find((s) => s.id === lead.segmento);
                return seg ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                      seg.className
                    )}
                  >
                    {seg.emoji} {seg.label}
                  </span>
                ) : null;
              })()}
              {lead.valor_credito && (
                <span className="text-xs font-semibold text-muted-foreground">
                  {formatCurrency(lead.valor_credito)}
                </span>
              )}
              {lead.telefone && (
                <a
                  href={whatsappHref(lead.telefone)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  {lead.telefone}
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
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                  {interacoes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Aba Dados ── */}
          <TabsContent
            value="dados"
            className="flex-1 overflow-y-auto p-5 space-y-3 mt-0"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => set("telefone", e.target.value)}
                  placeholder="(99) 99999-9999"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">E-mail</Label>
                <Input
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  type="email"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CPF / CNPJ</Label>
                <Input
                  value={form.cpf_cnpj}
                  onChange={(e) => set("cpf_cnpj", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={form.cidade}
                  onChange={(e) => set("cidade", e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Segmento</Label>
                <Select value={form.segmento} onValueChange={(v) => set("segmento", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.emoji} {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.origem === "indicacao" && (
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Indicado por</Label>
                  <Input
                    value={form.indicado_por}
                    onChange={(e) => set("indicado_por", e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Valor crédito (R$)</Label>
                <Input
                  value={form.valor_credito}
                  onChange={(e) => set("valor_credito", e.target.value)}
                  type="number"
                  min={0}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Prazo (meses)</Label>
                <Input
                  value={form.prazo}
                  onChange={(e) => set("prazo", e.target.value)}
                  type="number"
                  min={1}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Etapa</Label>
                <Select value={form.etapa} onValueChange={(v) => set("etapa", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETAPA_LIST.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={form.responsavel_id}
                  onValueChange={(v) => set("responsavel_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {comerciais.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={form.observacoes}
                  onChange={(e) => set("observacoes", e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm(`Excluir o lead "${lead?.nome}"?`))
                    deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Excluir
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!dirty || updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </TabsContent>

          {/* ── Aba Histórico ── */}
          <TabsContent
            value="historico"
            className="flex-1 flex flex-col overflow-hidden p-5 gap-4 mt-0"
          >
            <div className="space-y-2 shrink-0">
              <div className="flex gap-2">
                <Select
                  value={novaInteracao.tipo}
                  onValueChange={(v) =>
                    setNovaInteracao((p) => ({ ...p, tipo: v as InteracaoTipo }))
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERACAO_TIPOS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => addInteracaoMutation.mutate()}
                  disabled={
                    !novaInteracao.descricao.trim() || addInteracaoMutation.isPending
                  }
                >
                  {addInteracaoMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Registrar"
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Descreva a interação..."
                value={novaInteracao.descricao}
                onChange={(e) =>
                  setNovaInteracao((p) => ({ ...p, descricao: e.target.value }))
                }
                rows={2}
              />
            </div>

            <Separator />

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {interacoes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma interação registrada ainda.
                </p>
              )}
              {interacoes.map((i) => (
                <div key={i.id} className="space-y-0.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {INTERACAO_TIPOS.find((t) => t.id === i.tipo)?.label ?? i.tipo}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {fmtDate(i.created_at)}
                    </span>
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
  const [filters, setFilters] = useState<Filters>({
    search: "",
    segmento: "todos",
    responsavel_id: "todos",
  });
  const debouncedSearch = useDebounce(filters.search, 300);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ConsorcioLead | null>(null);
  const [activeLead, setActiveLead] = useState<ConsorcioLead | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const { data: leads = [], isLoading } = useQuery<ConsorcioLead[]>({
    queryKey: ["consorcios-leads", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("consorcios_leads")
        .select("*")
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
        .from("comerciais")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const comerciaisMap = useMemo(
    () => new Map(comerciais.map((c) => [c.id, c.nome])),
    [comerciais]
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (
        debouncedSearch &&
        !l.nome.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !l.telefone?.includes(debouncedSearch)
      )
        return false;
      if (filters.segmento !== "todos" && l.segmento !== filters.segmento) return false;
      if (filters.responsavel_id !== "todos") {
        if (filters.responsavel_id === "sem" && l.responsavel_id) return false;
        if (
          filters.responsavel_id !== "sem" &&
          l.responsavel_id !== filters.responsavel_id
        )
          return false;
      }
      return true;
    });
  }, [leads, debouncedSearch, filters]);

  const getByEtapa = (etapa: EtapaConsorcio) =>
    filteredLeads.filter((l) => l.etapa === etapa);

  const moveLeadMutation = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: EtapaConsorcio }) => {
      const { error } = await (supabase as any)
        .from("consorcios_leads")
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
      toast.success("Lead excluído");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

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
    const newEtapa = over.id as EtapaConsorcio;
    if (lead.etapa === newEtapa) return;
    moveLeadMutation.mutate({ id: lead.id, etapa: newEtapa });
  }

  const totalLeads = leads.length;
  const totalValor = leads
    .filter((l) => l.etapa === "contrato_fechado")
    .reduce((acc, l) => acc + (l.valor_credito ?? 0), 0);

  return (
    <>
      <LeadFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {}}
        comerciais={comerciais}
      />
      <LeadDetailSheet
        lead={selectedLead}
        comerciais={comerciais}
        onClose={() => setSelectedLead(null)}
        onUpdated={() => {
          if (selectedLead) {
            qc.invalidateQueries({ queryKey: ["consorcios-leads"] });
          }
        }}
      />

      <div className="space-y-4">
        <PageHeader
          title="Pipeline — Consórcio"
          description={`${totalLeads} lead${totalLeads !== 1 ? "s" : ""} ativos${totalValor > 0 ? ` · ${formatCurrency(totalValor)} em contratos fechados` : ""}`}
        >
          <Button variant="outline" size="sm" asChild>
            <Link to="/consorcios/leads">
              <LayoutList className="h-4 w-4 mr-2" />
              Lista
            </Link>
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </PageHeader>

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

          <Select
            value={filters.segmento}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, segmento: v as Segmento | "todos" }))
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Segmento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos segmentos</SelectItem>
              {SEGMENTOS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.emoji} {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.responsavel_id}
            onValueChange={(v) => setFilters((p) => ({ ...p, responsavel_id: v }))}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos responsáveis</SelectItem>
              <SelectItem value="sem">Sem responsável</SelectItem>
              {comerciais.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban board */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          >
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-3 w-max min-w-full">
                {PIPELINE_STAGES.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    leads={getByEtapa(stage.id)}
                    comerciaisMap={comerciaisMap}
                    onLeadClick={(lead) => setSelectedLead(lead)}
                    onDeleteLead={(id) => {
                      if (confirm("Excluir este lead?")) deleteLeadMutation.mutate(id);
                    }}
                  />
                ))}
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
      </div>
    </>
  );
};

export default Pipeline;
