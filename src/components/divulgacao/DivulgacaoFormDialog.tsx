import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Divulgacao } from "./DivulgacaoCard";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData: Divulgacao | null;
  defaultStatus: string;
}

const CATEGORIAS = ["Comunicado", "Campanha", "Evento", "Treinamento"];
const STATUSES = ["Em breve", "Em andamento", "Concluído"];

export function DivulgacaoFormDialog({ open, onClose, onSave, initialData, defaultStatus }: Props) {
  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    categoria: "Comunicado",
    status: defaultStatus,
    imagem_url: "",
    responsavel_iniciais: "",
    data: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        titulo: initialData.titulo ?? "",
        descricao: initialData.descricao ?? "",
        categoria: initialData.categoria ?? "Comunicado",
        status: initialData.status ?? defaultStatus,
        imagem_url: initialData.imagem_url ?? "",
        responsavel_iniciais: initialData.responsavel_iniciais ?? "",
        data: initialData.data ?? "",
      });
    } else {
      setForm({
        titulo: "",
        descricao: "",
        categoria: "Comunicado",
        status: defaultStatus,
        imagem_url: "",
        responsavel_iniciais: "",
        data: "",
      });
    }
  }, [initialData, defaultStatus, open]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.titulo.trim()) return;
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar divulgação" : "Nova divulgação"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Título da divulgação" />
          </div>

          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descrição (opcional)" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set("categoria", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Responsável (iniciais)</Label>
              <Input value={form.responsavel_iniciais} onChange={(e) => set("responsavel_iniciais", e.target.value)} placeholder="Ex: JD" maxLength={5} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>URL da imagem</Label>
            <Input value={form.imagem_url} onChange={(e) => set("imagem_url", e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading || !form.titulo.trim()}>
            {loading ? "Salvando..." : initialData ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
