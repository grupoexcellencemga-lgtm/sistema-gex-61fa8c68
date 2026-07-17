import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, CheckSquare, Square } from "lucide-react";

const tipos = [
  { value: "follow_up", label: "Follow-up" },
  { value: "cobranca", label: "Cobrança" },
  { value: "lembrete", label: "Lembrete" },
  { value: "reuniao", label: "Reunião" },
  { value: "outro", label: "Outro" },
];

const prioridades = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const recorrencias = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
];

interface SubItem {
  id?: string;
  titulo: string;
  concluido: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa?: any;
  defaultAlunoId?: string;
  defaultLeadId?: string;
  defaultProcessoId?: string;
  defaultEscopo?: "geral" | "individual";
  onSaved: () => void;
}

export function TarefaFormDialog({ open, onOpenChange, tarefa, defaultAlunoId, defaultLeadId, defaultProcessoId, defaultEscopo, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "outro", prioridade: "media",
    responsavel_id: "", data_vencimento: "", hora: "",
    aluno_id: "", lead_id: "", processo_id: "", recorrencia: "nenhuma",
    escopo: "geral" as "geral" | "individual",
  });
  const [items, setItems] = useState<SubItem[]>([]);
  const [newItemTitulo, setNewItemTitulo] = useState("");
  const newItemRef = useRef<HTMLInputElement>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setForm({
        titulo: tarefa.titulo || "",
        descricao: tarefa.descricao || "",
        tipo: tarefa.tipo || "outro",
        prioridade: tarefa.prioridade || "media",
        responsavel_id: tarefa.responsavel_id || user?.id || "",
        data_vencimento: tarefa.data_vencimento || "",
        hora: tarefa.hora || "",
        aluno_id: tarefa.aluno_id || "",
        lead_id: tarefa.lead_id || "",
        processo_id: tarefa.processo_id || "",
        recorrencia: tarefa.recorrencia || "nenhuma",
        escopo: (tarefa.escopo as "geral" | "individual") || "geral",
      });
      // Load existing sub-tasks
      (supabase as any)
        .from("tarefa_itens")
        .select("id, titulo, concluido, ordem")
        .eq("tarefa_id", tarefa.id)
        .order("ordem")
        .then(({ data }: any) => {
          setItems((data || []).map((i: any) => ({ id: i.id, titulo: i.titulo, concluido: i.concluido })));
        });
    } else {
      setForm({
        titulo: "", descricao: "", tipo: "outro", prioridade: "media",
        responsavel_id: user?.id || "", data_vencimento: "", hora: "",
        aluno_id: defaultAlunoId || "", lead_id: defaultLeadId || "",
        processo_id: defaultProcessoId || "", recorrencia: "nenhuma",
        escopo: defaultEscopo || "geral",
      });
      setItems([]);
    }
    setNewItemTitulo("");
  }, [open, tarefa, user, defaultAlunoId, defaultLeadId, defaultProcessoId, defaultEscopo]);

  const addItem = () => {
    const titulo = newItemTitulo.trim();
    if (!titulo) return;
    setItems(prev => [...prev, { titulo, concluido: false }]);
    setNewItemTitulo("");
    newItemRef.current?.focus();
  };

  const toggleItem = (idx: number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, concluido: !it.concluido } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const saveItems = async (tarefaId: string) => {
    // Delete all existing and re-insert to keep it simple
    await (supabase as any).from("tarefa_itens").delete().eq("tarefa_id", tarefaId);
    if (items.length > 0) {
      await (supabase as any).from("tarefa_itens").insert(
        items.map((it, i) => ({
          tarefa_id: tarefaId,
          titulo: it.titulo,
          concluido: it.concluido,
          ordem: i,
        }))
      );
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    if (!form.responsavel_id) { toast.error("Responsável é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo: form.tipo,
        prioridade: form.prioridade,
        responsavel_id: form.responsavel_id,
        data_vencimento: form.data_vencimento || null,
        hora: form.hora || null,
        aluno_id: form.aluno_id || null,
        lead_id: form.lead_id || null,
        processo_id: form.processo_id || null,
        recorrencia: form.recorrencia,
        escopo: form.escopo,
      };

      if (tarefa) {
        const { error } = await supabase.from("tarefas").update(payload).eq("id", tarefa.id);
        if (error) throw error;
        await saveItems(tarefa.id);
        toast.success("Tarefa atualizada");
      } else {
        payload.created_by = user?.id;
        payload.status = "pendente";
        const { data: inserted, error } = await (supabase as any)
          .from("tarefas").insert(payload).select("id").single();
        if (error) throw error;
        await saveItems(inserted.id);
        toast.success("Tarefa criada");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const completedCount = items.filter(i => i.concluido).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{tipos.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{prioridades.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Responsável *</Label>
            <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Visibilidade</Label>
            <div className="flex gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, escopo: "geral" }))}
                className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${form.escopo === "geral" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted/50"}`}
              >
                Geral
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, escopo: "individual" }))}
                className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${form.escopo === "individual" ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-muted/50"}`}
              >
                Individual
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.escopo === "geral" ? "Visível para toda a equipe." : "Visível apenas para o responsável (e administradores)."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
            <div>
              <Label>Hora</Label>
              <Input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Recorrência</Label>
            <Select value={form.recorrencia} onValueChange={v => setForm(f => ({ ...f, recorrencia: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{recorrencias.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Sub-tarefas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Sub-tarefas</Label>
              {items.length > 0 && (
                <span className="text-xs text-muted-foreground">{completedCount}/{items.length} concluídas</span>
              )}
            </div>

            {items.length > 0 && (
              <div className="space-y-1 mb-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => toggleItem(idx)}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item.concluido
                        ? <CheckSquare className="h-4 w-4 text-primary" />
                        : <Square className="h-4 w-4" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.concluido ? "line-through text-muted-foreground" : ""}`}>
                      {item.titulo}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                ref={newItemRef}
                value={newItemTitulo}
                onChange={e => setNewItemTitulo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem())}
                placeholder="Adicionar item..."
                className="h-8 text-sm"
              />
              <Button type="button" variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tarefa ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
