import { useEffect, useState } from "react";
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
import type { ChecklistItemRow } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: ChecklistItemRow | null;
  onSaved: () => void;
}

export function ChecklistItemFormDialog({ open, onOpenChange, item, onSaved }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", tipo: "diaria", usuario_id: "", data_alvo: "",
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
      if (item) {
        setForm({
          titulo: item.titulo,
          descricao: item.descricao || "",
          tipo: item.tipo,
          usuario_id: item.usuario_id,
          data_alvo: item.data_alvo || "",
        });
      } else {
        setForm({ titulo: "", descricao: "", tipo: "diaria", usuario_id: "", data_alvo: "" });
      }
    }
  }, [open, item]);

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    if (!form.usuario_id) { toast.error("Responsável é obrigatório"); return; }
    setSaving(true);
    try {
      const payload: any = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        tipo: form.tipo,
        usuario_id: form.usuario_id,
        data_alvo: form.tipo === "esporadica" ? (form.data_alvo || null) : null,
      };

      if (item) {
        const { error } = await supabase.from("checklist_itens").update(payload).eq("id", item.id);
        if (error) throw error;
        toast.success("Item atualizado");
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("checklist_itens").insert(payload);
        if (error) throw error;
        toast.success("Item criado");
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
          <DialogTitle>{item ? "Editar Item" : "Novo Item de Checklist"}</DialogTitle>
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
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="esporadica">Esporádica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo === "esporadica" && (
              <div>
                <Label>Prazo (opcional)</Label>
                <Input type="date" value={form.data_alvo} onChange={e => setForm(f => ({ ...f, data_alvo: e.target.value }))} />
              </div>
            )}
          </div>
          <div>
            <Label>Responsável *</Label>
            <Select value={form.usuario_id} onValueChange={v => setForm(f => ({ ...f, usuario_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {profiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {item ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
