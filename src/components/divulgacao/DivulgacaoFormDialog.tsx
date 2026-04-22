import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Divulgacao } from "./DivulgacaoCard";

type FormData = {
  titulo: string;
  descricao: string;
  categoria: string;
  status: string;
  imagem_url: string;
  responsavel_iniciais: string;
  data: string;
};

const EMPTY: FormData = {
  titulo: "",
  descricao: "",
  categoria: "Comunicado",
  status: "Em breve",
  imagem_url: "",
  responsavel_iniciais: "",
  data: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initialData?: Divulgacao | null;
  defaultStatus?: string;
}

export function DivulgacaoFormDialog({ open, onClose, onSave, initialData, defaultStatus }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          titulo: initialData.titulo ?? "",
          descricao: initialData.descricao ?? "",
          categoria: initialData.categoria ?? "Comunicado",
          status: initialData.status ?? "Em breve",
          imagem_url: initialData.imagem_url ?? "",
          responsavel_iniciais: initialData.responsavel_iniciais ?? "",
          data: initialData.data ?? "",
        });
      } else {
        setForm({ ...EMPTY, status: defaultStatus ?? "Em breve" });
      }
    }
  }, [open, initialData, defaultStatus]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Divulgação" : "Nova Divulgação"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Título */}
          <div className="space-y-1">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={form.titulo} onChange={set("titulo")} placeholder="Nome da divulgação" required />
          </div>

          {/* Descrição */}
          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={set("descricao")}
              placeholder="Detalhes da divulgação..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Categoria + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Comunicado">Comunicado</SelectItem>
                  <SelectItem value="Campanha">Campanha</SelectItem>
                  <SelectItem value="Evento">Evento</SelectItem>
                  <SelectItem value="Treinamento">Treinamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status *</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em breve">Em breve</SelectItem>
                  <SelectItem value="Em andamento">Em andamento</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Data + Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={form.data} onChange={set("data")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="responsavel_iniciais">Responsável (iniciais)</Label>
              <Input
                id="responsavel_iniciais"
                value={form.responsavel_iniciais}
                onChange={set("responsavel_iniciais")}
                placeholder="Ex: AG, JP..."
                maxLength={5}
              />
            </div>
          </div>

          {/* Imagem URL */}
          <div className="space-y-1">
            <Label htmlFor="imagem_url">URL da imagem</Label>
            <Input
              id="imagem_url"
              value={form.imagem_url}
              onChange={set("imagem_url")}
              placeholder="https://..."
              type="url"
            />
            {form.imagem_url && (
              <div className="mt-1 h-20 w-full overflow-hidden rounded-md border">
                <img src={form.imagem_url} alt="preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.titulo.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initialData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
