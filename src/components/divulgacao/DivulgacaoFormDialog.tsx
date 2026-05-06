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
import {
  Loader2,
  Upload,
  X,
  Video,
  ImageIcon,
  FileText,
  Plus,
  Link as LinkIcon,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Divulgacao, DivulgacaoLink } from "./DivulgacaoCard";
import type { DivulgacaoColuna } from "./DivulgacaoColunaDialog";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  links: DivulgacaoLink[];
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
  links: [],
};

const MAX_SIZE_BYTES = 500 * 1024 * 1024;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initialData?: Divulgacao | null;
  defaultColunaId?: string;
  colunas: DivulgacaoColuna[];
}

const normalizeLinks = (links: Divulgacao["links"]): DivulgacaoLink[] => {
  if (!links) return [];

  if (Array.isArray(links)) {
    return links.filter((l) => l?.url);
  }

  if (typeof links === "string") {
    try {
      const parsed = JSON.parse(links);
      return Array.isArray(parsed) ? parsed.filter((l) => l?.url) : [];
    } catch {
      return links.trim() ? [{ titulo: "Link", url: links.trim() }] : [];
    }
  }

  return [];
};

const gerarCapaPdf = async (file: File): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewportOriginal = page.getViewport({ scale: 1 });
  const larguraDesejada = 900;
  const scale = larguraDesejada / viewportOriginal.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível gerar a capa do PDF.");
  }

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Não foi possível converter a capa do PDF em imagem."));
          return;
        }

        resolve(result);
      },
      "image/png",
      0.92
    );
  });

  return blob;
};

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
          links: normalizeLinks(initialData.links),
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
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isVideo && !isImage && !isPdf) {
      toast.error("Apenas imagens, vídeos e PDFs são permitidos");
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

      let capaPdfUrl = "";

      if (isPdf) {
        try {
          const capaBlob = await gerarCapaPdf(file);
          const capaPath = `${Date.now()}-${Math.random().toString(36).slice(2)}-capa.png`;

          const { data: capaData, error: capaError } = await supabase.storage
            .from("divulgacoes")
            .upload(capaPath, capaBlob, {
              contentType: "image/png",
              cacheControl: "3600",
              upsert: false,
            });

          if (capaError) throw capaError;

          const { data: capaUrlData } = supabase.storage
            .from("divulgacoes")
            .getPublicUrl(capaData.path);

          capaPdfUrl = capaUrlData.publicUrl;
        } catch (capaError: any) {
          toast.error(
            "PDF enviado, mas não foi possível gerar a capa automaticamente: " +
              (capaError?.message ?? "")
          );
        }
      }

      setForm((f) => ({
        ...f,
        arquivo_url: urlData.publicUrl,
        arquivo_tipo: isVideo ? "video" : isPdf ? "pdf" : "image",
        arquivo_nome: file.name,
        imagem_url: isPdf && capaPdfUrl ? capaPdfUrl : isImage ? urlData.publicUrl : f.imagem_url,
      }));

      toast.success(
        isPdf && capaPdfUrl
          ? "PDF enviado e capa gerada com sucesso!"
          : "Arquivo enviado com sucesso!"
      );
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

  const addLink = () => {
    setForm((f) => ({
      ...f,
      links: [...f.links, { titulo: "", url: "" }],
    }));
  };

  const updateLink = (index: number, field: keyof DivulgacaoLink, value: string) => {
    setForm((f) => ({
      ...f,
      links: f.links.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  };

  const removeLink = (index: number) => {
    setForm((f) => ({
      ...f,
      links: f.links.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;

    const linksValidos = form.links
      .map((l) => ({
        titulo: l.titulo?.trim() || "",
        url: l.url?.trim() || "",
      }))
      .filter((l) => l.url);

    setLoading(true);
    try {
      await onSave({ ...form, links: linksValidos });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const isVideo = form.arquivo_tipo === "video";
  const isImageArq = form.arquivo_tipo === "image";
  const isPdf = form.arquivo_tipo === "pdf";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Divulgação" : "Nova Divulgação"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
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

          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={form.descricao}
              onChange={set("descricao")}
              placeholder="Detalhes da divulgação..."
              rows={4}
              className="resize-none"
            />
          </div>

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

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Arquivo do card</Label>

            {form.arquivo_url && (
              <div className="relative rounded-lg overflow-hidden border bg-muted/30">
                {isImageArq && (
                  <img
                    src={form.arquivo_url}
                    alt="preview"
                    className="w-full h-40 object-cover"
                  />
                )}
                {isVideo && (
                  <div className="w-full h-40 bg-black/80 flex flex-col items-center justify-center gap-1">
                    <Video className="h-8 w-8 text-white/70" />
                    <span className="text-white/60 text-xs">{form.arquivo_nome}</span>
                  </div>
                )}
                {isPdf && form.imagem_url && (
                  <img
                    src={form.imagem_url}
                    alt="Capa do PDF"
                    className="w-full h-40 object-cover"
                  />
                )}
                {isPdf && !form.imagem_url && (
                  <div className="w-full h-40 bg-red-50 dark:bg-red-950/30 flex flex-col items-center justify-center gap-1">
                    <FileText className="h-8 w-8 text-red-500" />
                    <span className="text-red-600 dark:text-red-300 text-xs font-medium">
                      {form.arquivo_nome || "PDF anexado"}
                    </span>
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
                      Clique para enviar imagem, vídeo ou PDF
                    </span>
                    <span className="text-xs text-muted-foreground/60">
                      JPG, PNG, GIF, WebP, MP4, WebM, PDF — máx. 500 MB
                    </span>
                  </>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

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

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Links do card
                </Label>
                <p className="text-xs text-muted-foreground">
                  Adicione um ou mais links para copiar/abrir no popup do card.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addLink}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Link
              </Button>
            </div>

            {form.links.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum link adicionado.
              </p>
            ) : (
              <div className="space-y-2">
                {form.links.map((link, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                    <Input
                      value={link.titulo || ""}
                      onChange={(e) => updateLink(index, "titulo", e.target.value)}
                      placeholder="Nome do link"
                    />
                    <Input
                      value={link.url || ""}
                      onChange={(e) => updateLink(index, "url", e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => removeLink(index)}
                      title="Remover link"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
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
