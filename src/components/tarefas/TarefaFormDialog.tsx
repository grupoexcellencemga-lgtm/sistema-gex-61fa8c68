import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";

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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefa?: any;
  defaultAlunoId?: string;
  defaultLeadId?: string;
  defaultProcessoId?: string;
  onSaved: () => void;
}

export function TarefaFormDialog({ open, onOpenChange, tarefa, defaultAlunoId, defaultLeadId, defaultProcessoId, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "outro", prioridade: "media",
    responsavel_id: "", data_vencimento: "", hora: "",
    aluno_id: "", lead_id: "", processo_id: "", recorrencia: "nenhuma",
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, nome");
      return data || [];
    },
  });

  useEffect(() => {
    if (open) {
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
        });
      } else {
        setForm({
          titulo: "", descricao: "", tipo: "outro", prioridade: "media",
          responsavel_id: user?.id || "", data_vencimento: "", hora: "",
          aluno_id: defaultAlunoId || "", lead_id: defaultLeadId || "",
          processo_id: defaultProcessoId || "", recorrencia: "nenhuma",
        });
      }
    }
  }, [open, tarefa, user, defaultAlunoId, defaultLeadId, defaultProcessoId]);

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
      };

      if (tarefa) {
        const { error } = await supabase.from("tarefas").update(payload).eq("id", tarefa.id);
        if (error) throw error;
        toast.success("Tarefa atualizada");
      } else {
        payload.created_by = user?.id;
        payload.status = "pendente";
        const { error } = await supabase.from("tarefas").insert(payload);
        if (error) throw error;
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
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
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
