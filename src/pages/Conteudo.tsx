import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, closestCenter,
  useDraggable, useDroppable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Loader2, Film, Scissors, CheckCircle, Send,
  Instagram, Youtube, Linkedin, Pencil, Trash2, Link2, CalendarDays, User,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────────────────────

const ETAPAS = [
  { key: "a_gravar",      label: "A gravar",         icon: Film,         color: "bg-blue-500",    light: "bg-blue-50 dark:bg-blue-950/30",    text: "text-blue-600 dark:text-blue-300",    border: "border-blue-200 dark:border-blue-800"    },
  { key: "gravado",       label: "Gravado",           icon: Film,         color: "bg-violet-500",  light: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
  { key: "em_producao",   label: "Em produção",       icon: Scissors,     color: "bg-amber-500",   light: "bg-amber-50 dark:bg-amber-950/30",   text: "text-amber-600 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800"  },
  { key: "pronto_postar", label: "Pronto p/ postar",  icon: CheckCircle,  color: "bg-green-500",   light: "bg-green-50 dark:bg-green-950/30",   text: "text-green-600 dark:text-green-300",  border: "border-green-200 dark:border-green-800"  },
  { key: "postado",       label: "Postado",           icon: Send,         color: "bg-slate-400",   light: "bg-muted/50",                        text: "text-muted-foreground",               border: "border-border"                           },
] as const;

type Etapa = typeof ETAPAS[number]["key"];

const PLATAFORMAS = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "text-pink-500"         },
  { value: "youtube",   label: "YouTube",   icon: Youtube,   color: "text-red-500"           },
  { value: "tiktok",    label: "TikTok",    icon: Film,      color: "text-foreground"        },
  { value: "linkedin",  label: "LinkedIn",  icon: Linkedin,  color: "text-blue-700"          },
  { value: "outro",     label: "Outro",     icon: Link2,     color: "text-muted-foreground"  },
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Conteudo {
  id: string;
  titulo: string;
  descricao?: string;
  plataforma: string;
  status: Etapa;
  responsavel_id?: string;
  data_gravacao?: string;
  data_postagem?: string;
  link_publicado?: string;
  created_at: string;
  perfil?: { nome: string } | null;
}

interface FormState {
  titulo: string;
  descricao: string;
  plataforma: string;
  status: Etapa;
  data_gravacao: string;
  data_postagem: string;
  link_publicado: string;
  responsavel_id: string;
}

const emptyForm: FormState = {
  titulo: "", descricao: "", plataforma: "instagram", status: "a_gravar",
  data_gravacao: "", data_postagem: "", link_publicado: "", responsavel_id: "",
};

// ─── Card (draggable) ─────────────────────────────────────────────────────────

function ConteudoCard({ item, onEdit, onDelete }: {
  item: Conteudo;
  onEdit: (c: Conteudo) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const plat = PLATAFORMAS.find((p) => p.value === item.plataforma) ?? PLATAFORMAS[4];
  const PlatIcon = plat.icon;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "bg-card rounded-lg border border-border p-3 shadow-sm cursor-grab active:cursor-grabbing group",
        "hover:shadow-md transition-shadow",
        isDragging && "opacity-30 shadow-lg",
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <PlatIcon className={cn("h-3.5 w-3.5 shrink-0", plat.color)} />
          <span className="text-[11px] text-muted-foreground">{plat.label}</span>
        </div>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            className="rounded p-0.5 hover:bg-muted text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <p className="text-sm font-medium leading-snug line-clamp-2 mb-2">{item.titulo}</p>

      <div className="space-y-0.5">
        {item.data_gravacao && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>Gravar: {new Date(item.data_gravacao + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
          </div>
        )}
        {item.data_postagem && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Send className="h-3 w-3 shrink-0" />
            <span>Postar: {new Date(item.data_postagem + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
          </div>
        )}
        {item.perfil?.nome && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.perfil.nome.split(" ")[0]}</span>
          </div>
        )}
        {item.link_publicado && (
          <a
            href={item.link_publicado}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Link2 className="h-3 w-3 shrink-0" /> Ver publicação
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Coluna (droppable) ───────────────────────────────────────────────────────

function Coluna({ etapa, items, totalGeral, onEdit, onDelete, onAdd }: {
  etapa: typeof ETAPAS[number];
  items: Conteudo[];
  totalGeral: number;
  onEdit: (c: Conteudo) => void;
  onDelete: (id: string) => void;
  onAdd: (status: Etapa) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: etapa.key });
  const Icon = etapa.icon;
  const pct = totalGeral > 0 ? Math.round((items.length / totalGeral) * 100) : 0;

  return (
    <div className="flex flex-col min-w-[210px] w-[210px] shrink-0">
      {/* Cabeçalho com barra de funil */}
      <div className={cn("rounded-t-xl px-3 py-2.5 border border-b-0", etapa.light, etapa.border)}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Icon className={cn("h-3.5 w-3.5", etapa.text)} />
            <span className={cn("text-xs font-semibold", etapa.text)}>{etapa.label}</span>
          </div>
          <span className={cn("text-xl font-bold tabular-nums", etapa.text)}>{items.length}</span>
        </div>
        <div className="h-1 rounded-full bg-border/40 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", etapa.color)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Área droppable */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-xl border border-t-0 p-2 space-y-2 min-h-[420px] transition-colors",
          etapa.border,
          isOver ? "bg-primary/5 border-primary ring-1 ring-primary/30" : "bg-muted/20",
        )}
      >
        {items.map((item) => (
          <ConteudoCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {items.length === 0 && !isOver && (
          <p className="text-[11px] text-muted-foreground text-center pt-8 px-2 leading-relaxed">
            Arraste conteúdos para cá
          </p>
        )}
        <button
          onClick={() => onAdd(etapa.key)}
          className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </button>
      </div>
    </div>
  );
}

// ─── Formulário ──────────────────────────────────────────────────────────────

function ConteudoDialog({ open, onOpenChange, initial, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: (Partial<FormState> & { id?: string }) | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ ...emptyForm, ...initial });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast.error("Informe o título"); return; }
    setSaving(true);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao || null,
        plataforma: form.plataforma,
        status: form.status,
        data_gravacao: form.data_gravacao || null,
        data_postagem: form.data_postagem || null,
        link_publicado: form.link_publicado || null,
        responsavel_id: form.responsavel_id || user?.id || null,
      };
      const { error } = initial?.id
        ? await (supabase as any).from("conteudos").update(payload).eq("id", initial.id)
        : await (supabase as any).from("conteudos").insert(payload);
      if (error) throw error;
      toast.success(initial?.id ? "Conteúdo atualizado" : "Conteúdo criado");
      queryClient.invalidateQueries({ queryKey: ["conteudos"] });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar conteúdo" : "Novo conteúdo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex: Reel sobre captação de alunos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plataforma</Label>
              <Select value={form.plataforma} onValueChange={(v) => set("plataforma", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATAFORMAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as Etapa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de gravação</Label>
              <Input type="date" value={form.data_gravacao} onChange={(e) => set("data_gravacao", e.target.value)} />
            </div>
            <div>
              <Label>Data de postagem</Label>
              <Input type="date" value={form.data_postagem} onChange={(e) => set("data_postagem", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição / Roteiro</Label>
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Ideia, roteiro ou observações..."
              rows={3}
            />
          </div>
          <div>
            <Label>Link publicado</Label>
            <Input value={form.link_publicado} onChange={(e) => set("link_publicado", e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

const Conteudo = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<(Partial<FormState> & { id?: string }) | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const { data: items = [], isLoading } = useQuery<Conteudo[]>({
    queryKey: ["conteudos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("conteudos")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Etapa }) => {
      const { error } = await (supabase as any).from("conteudos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["conteudos"] });
      const prev = queryClient.getQueryData<Conteudo[]>(["conteudos"]) ?? [];
      queryClient.setQueryData<Conteudo[]>(["conteudos"], (old) =>
        (old ?? []).map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["conteudos"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["conteudos"] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("conteudos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conteudos"] });
      toast.success("Conteúdo removido");
    },
  });

  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  }, []);

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const targetEtapa = ETAPAS.find((e) => e.key === over.id);
    if (!targetEtapa) return;
    const dragItem = items.find((c) => c.id === active.id);
    if (dragItem && dragItem.status !== targetEtapa.key) {
      updateStatus.mutate({ id: active.id as string, status: targetEtapa.key });
    }
  }, [items, updateStatus]);

  const handleEdit = useCallback((c: Conteudo) => {
    setEditItem({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao ?? "",
      plataforma: c.plataforma,
      status: c.status,
      data_gravacao: c.data_gravacao ?? "",
      data_postagem: c.data_postagem ?? "",
      link_publicado: c.link_publicado ?? "",
      responsavel_id: c.responsavel_id ?? "",
    });
    setDialogOpen(true);
  }, []);

  const handleAdd = useCallback((status: Etapa) => {
    setEditItem({ status });
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm("Remover este conteúdo?")) deleteItem.mutate(id);
  }, [deleteItem]);

  const byEtapa = ETAPAS.reduce(
    (acc, e) => ({ ...acc, [e.key]: items.filter((c) => c.status === e.key) }),
    {} as Record<Etapa, Conteudo[]>,
  );
  const activeItem = activeId ? items.find((c) => c.id === activeId) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Produção de Conteúdo"
          description="Funil de produção — do roteiro à postagem"
        />
        <Button className="shrink-0" onClick={() => { setEditItem(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo conteúdo
        </Button>
      </div>

      {/* Métricas do funil */}
      <div className="grid grid-cols-5 gap-2">
        {ETAPAS.map((e) => {
          const count = byEtapa[e.key].length;
          const Icon = e.icon;
          return (
            <div key={e.key} className={cn("rounded-xl p-3 border text-center", e.light, e.border)}>
              <Icon className={cn("h-4 w-4 mx-auto mb-1", e.text)} />
              <div className={cn("text-2xl font-bold tabular-nums", e.text)}>{count}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{e.label}</div>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {ETAPAS.map((etapa) => (
              <Coluna
                key={etapa.key}
                etapa={etapa}
                items={byEtapa[etapa.key]}
                totalGeral={items.length}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAdd}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItem && (
              <div className="rotate-1 shadow-xl opacity-90">
                <ConteudoCard item={activeItem} onEdit={() => {}} onDelete={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <ConteudoDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditItem(null); }}
        initial={editItem}
        onSaved={() => setEditItem(null)}
      />
    </div>
  );
};

export default Conteudo;
