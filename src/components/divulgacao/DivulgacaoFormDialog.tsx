import { useEffect, useRef, useState } from "react";
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
import { Loader2, Upload, X, Video, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Divulgacao } from "./DivulgacaoCard";
import type { DivulgacaoColuna } from "./DivulgacaoColunaDialog";

type FormData = {
  titulo: string;
  descricao: string;
  categoria: string;
  coluna_id: string;
  imagem_url: string;
  responsavel_iniciais: string;
  data: string;
  arquivo_url: string;
  arquivo_tipo: string;
  arquivo_nome: string;
};

const EMPTY: FormData = {
  titulo: "",
  descricao: "",
  categoria: "Comunicado",
  coluna_id: "",
  imagem_url: "",
  responsavel_iniciais: "",
  data: "",
  arquivo_url: "",
  arquivo_tipo: "",
  arquivo_nome: "",
};

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initialData?: Divulgacao | null;
  defaultColunaId?: string;
  colunas: DivulgacaoColuna[];
}

export function DivulgacaoFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  defaultColunaId,
  colunas,
}: Props) {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm({
          titulo: initialData.titulo ?? "",
          descricao: initialData.descricao ?? "",
          categoria: initialData.categoria ?? "Comunicado",
          coluna_id: initialData.coluna_id ?? defaultColunaId ?? colunas[0]?.id ?? "",
          imagem_url: initialData.imagem_url ?? "",
          responsavel_iniciais: initialData.responsavel_iniciais ?? "",
          data: initialData.data ?? "",
          arquivo_url: initialData.arquivo_url ?? "",
          arquivo_tipo: initialData.arquivo_tipo ?? "",
          arquivo_nome: initialData.arquivo_nome ?? "",
        });
      } else {
        setForm({
          ...EMPTY,
          coluna_id: defaultColunaId ?? colunas[0]?.id ?? "",
        });
      }
      setUploadProgress(0);
    }
  }, [open, initialData, defaultColunaId, colunas]);

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      toast.error("Arquivo muito grande. Máximo permitido: 500 MB");
      return;
    }

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Apenas imagens e vídeos são permitidos");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("divulgacoes")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("divulgacoes")
        .getPublicUrl(data.path);

      setForm((f) => ({
        ...f,
        arquivo_url: urlData.publicUrl,
        arquivo_tipo: isVideo ? "video" : "image",
        arquivo_nome: file.name,
      }));

      toast.success("Arquivo enviado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message ?? ""));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeArquivo = () => {
    setForm((f) => ({ ...f, arquivo_url: "", arquivo_tipo: "", arquivo_nome: "" }));
  };

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

  const isVideo = form.arquivo_tipo === "video";
  const isImageArq = form.arquivo_tipo === "image";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Divulgação" : "Nova Divulgação"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Título */}
          <div className="space-y-1">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={set("titulo")}
              placeholder="Nome da divulgação"
              required
              autoFocus
            />
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

          {/* Categoria + Coluna */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select
                value={form.categoria}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
              >
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
              <Label>Quadro (coluna) *</Label>
              <Select
                value={form.coluna_id}
                onValueChange={(v) => setForm((f) => ({ ...f, coluna_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {colunas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icone} {c.nome}
                    </SelectItem>
                  ))}
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

          {/* Upload de arquivo (imagem ou vídeo) */}
          <div className="space-y-2">
            <Label>Imagem ou Vídeo</Label>

            {/* Preview do arquivo já enviado */}
            {form.arquivo_url && (
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                {isImageArq && (
                  <img
                    src={form.arquivo_url}
                    alt="preview"
                    className="w-full h-36 object-cover"
                  />
                )}
                {isVideo && (
                  <div className="w-full h-36 bg-black/80 flex flex-col items-center justify-center gap-1">
                    <Video className="h-8 w-8 text-white/70" />
                    <span className="text-white/60 text-xs">{form.arquivo_nome}</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={removeArquivo}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Botão de upload */}
            {!form.arquivo_url && (
              <div
                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    <span className="text-xs text-muted-foreground">Enviando arquivo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Clique para enviar imagem ou vídeo
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      JPG, PNG, GIF, WebP, MP4, WebM — máx. 500 MB
                    </span>
                  </>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* URL de imagem externa (opcional) */}
          <div className="space-y-1">
            <Label htmlFor="imagem_url">URL de imagem externa (opcional)</Label>
            <Input
              id="imagem_url"
              value={form.imagem_url}
              onChange={set("imagem_url")}
              placeholder="https://..."
              type="url"
            />
            {form.imagem_url && (
              <div className="mt-1 h-20 w-full overflow-hidden rounded-md border">
                <img
                  src={form.imagem_url}
                  alt="preview"
                  className="h-full w-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || uploading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || uploading || !form.titulo.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {initialData ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
