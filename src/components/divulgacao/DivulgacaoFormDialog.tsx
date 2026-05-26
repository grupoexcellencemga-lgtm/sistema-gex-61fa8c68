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
  Paperclip,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import * as tus from "tus-js-client";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Divulgacao, DivulgacaoArquivo, DivulgacaoLink } from "./DivulgacaoCard";
import { normalizeArquivos } from "./DivulgacaoCard";
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
  arquivos: DivulgacaoArquivo[];
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
  arquivos: [],
  links: [],
};

const MAX_SIZE_BYTES = 500 * 1024 * 1024;
const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024;
const STORAGE_BUCKET = "divulgacoes";

const isPowerPointFile = (file: File) => {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".ppt") ||
    name.endsWith(".pptx") ||
    file.type === "application/vnd.ms-powerpoint" ||
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
};

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

  await page.render({ canvasContext: context, viewport }).promise;

  return await new Promise<Blob>((resolve, reject) => {
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
};

const getTipoArquivo = (file: File): DivulgacaoArquivo["tipo"] => {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (isPowerPointFile(file)) return "ppt";
  return "file";
};

const getMainFields = (arquivos: DivulgacaoArquivo[]) => {
  const first = arquivos[0];

  return {
    arquivo_url: first?.url || "",
    arquivo_tipo: first?.tipo || "",
    arquivo_nome: first?.nome || "",
    imagem_url:
      first?.capa_url ||
      (first?.tipo === "image" ? first.url : "") ||
      arquivos.find((arquivo) => arquivo.capa_url)?.capa_url ||
      arquivos.find((arquivo) => arquivo.tipo === "image")?.url ||
      "",
  };
};

const versionedUrl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;

const getSupabaseConnection = () => {
  const client = supabase as any;

  const url =
    client.supabaseUrl ||
    client.url ||
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_PROJECT_URL;

  const anonKey =
    client.supabaseKey ||
    client.anonKey ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("URL do Supabase não encontrada para upload resumido.");
  }

  return { url: String(url).replace(/\/$/, ""), anonKey: anonKey ? String(anonKey) : "" };
};

const uploadWithTus = async (
  file: File | Blob,
  path: string,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<{ path: string }> => {
  const { url, anonKey } = getSupabaseConnection();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token || anonKey;

  if (!token) {
    throw new Error("Token do Supabase não encontrado para upload resumido.");
  }

  return await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${url}/storage/v1/upload/resumable`,
      chunkSize: RESUMABLE_UPLOAD_THRESHOLD,
      retryDelays: [0, 1000, 3000, 5000],
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${token}`,
        apikey: anonKey || token,
        "x-upsert": "false",
      },
      metadata: {
        bucketName: STORAGE_BUCKET,
        objectName: path,
        contentType: contentType || "application/octet-stream",
        cacheControl: "0",
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        if (!bytesTotal) return;
        onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess: () => resolve({ path }),
    });

    upload.start();
  });
};

const uploadToStorage = async (
  path: string,
  file: File | Blob,
  contentType: string,
  onProgress?: (progress: number) => void
): Promise<{ path: string }> => {
  const size = file.size ?? 0;
  const shouldUseTus = size >= RESUMABLE_UPLOAD_THRESHOLD || contentType.startsWith("video/");

  if (shouldUseTus) {
    return uploadWithTus(file, path, contentType, onProgress);
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      contentType,
      cacheControl: "0",
      upsert: false,
    });

  if (error) throw error;
  return { path: data.path };
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      const arquivos = normalizeArquivos(initialData.arquivos, initialData);
      setForm({
        titulo: initialData.titulo ?? "",
        descricao: initialData.descricao ?? "",
        categoria: initialData.categoria ?? "Comunicado",
        coluna_id: initialData.coluna_id ?? defaultColunaId ?? colunas[0]?.id ?? "",
        imagem_url: initialData.imagem_url ?? "",
        responsavel_iniciais: initialData.responsavel_iniciais ?? "",
        data: initialData.data ?? "",
        arquivo_url: initialData.arquivo_url ?? arquivos[0]?.url ?? "",
        arquivo_tipo: initialData.arquivo_tipo ?? arquivos[0]?.tipo ?? "",
        arquivo_nome: initialData.arquivo_nome ?? arquivos[0]?.nome ?? "",
        arquivos,
        links: normalizeLinks(initialData.links),
      });
    } else {
      setForm({
        ...EMPTY,
        coluna_id: defaultColunaId ?? colunas[0]?.id ?? "",
      });
    }
  }, [open, initialData, defaultColunaId, colunas]);

  const set =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const uploadOneFile = async (file: File, onProgress?: (progress: number) => void): Promise<DivulgacaoArquivo> => {
    if (file.size > MAX_SIZE_BYTES) {
      throw new Error(`${file.name}: arquivo muito grande. Máximo permitido: 500 MB`);
    }

    const tipo = getTipoArquivo(file);

    if (!['image', 'video', 'pdf', 'ppt'].includes(tipo)) {
      throw new Error(`${file.name}: apenas imagens, vídeos, PDFs e PowerPoints são permitidos`);
    }

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const data = await uploadToStorage(path, file, file.type || "application/octet-stream", onProgress);

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(data.path);

    let capaUrl: string | null = tipo === "image" ? urlData.publicUrl : null;

    if (tipo === "pdf") {
      try {
        const capaBlob = await gerarCapaPdf(file);
        const capaPath = `${Date.now()}-${Math.random().toString(36).slice(2)}-capa.png`;

        const capaData = await uploadToStorage(capaPath, capaBlob, "image/png");

        const { data: capaUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(capaData.path);

        capaUrl = capaUrlData.publicUrl;
      } catch (capaError: any) {
        toast.error(
          `${file.name} enviado, mas não foi possível gerar a capa do PDF: ${capaError?.message ?? ""}`
        );
      }
    }

    return {
      url: urlData.publicUrl,
      tipo,
      nome: file.name,
      capa_url: capaUrl,
      uploaded_at: new Date().toISOString(),
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const novosArquivos: DivulgacaoArquivo[] = [];

      for (const [index, file] of files.entries()) {
        novosArquivos.push(
          await uploadOneFile(file, (progress) => {
            const totalProgress = Math.round(((index + progress / 100) / files.length) * 100);
            setUploadProgress(totalProgress);
          })
        );
      }

      setForm((f) => {
        const arquivos = [...f.arquivos, ...novosArquivos];
        return {
          ...f,
          arquivos,
          ...getMainFields(arquivos),
        };
      });

      toast.success(
        novosArquivos.length === 1
          ? "Arquivo adicionado ao card!"
          : `${novosArquivos.length} arquivos adicionados ao card!`
      );
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + (err.message ?? ""));
    } finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeArquivo = (index: number) => {
    setForm((f) => {
      const arquivos = f.arquivos.filter((_, i) => i !== index);
      return {
        ...f,
        arquivos,
        ...getMainFields(arquivos),
      };
    });
  };

  const setArquivoComoCapa = (index: number) => {
    setForm((f) => {
      const arquivo = f.arquivos[index];
      if (!arquivo) return f;

      if (!arquivo.capa_url && arquivo.tipo !== "image") {
        toast.error("Este arquivo não possui imagem de capa.");
        return f;
      }

      const arquivos = [...f.arquivos];
      arquivos.splice(index, 1);
      arquivos.unshift(arquivo);

      return {
        ...f,
        arquivos,
        ...getMainFields(arquivos),
      };
    });
  };

  const addLink = () => {
    setForm((f) => ({ ...f, links: [...f.links, { titulo: "", url: "" }] }));
  };

  const updateLink = (index: number, field: keyof DivulgacaoLink, value: string) => {
    setForm((f) => ({
      ...f,
      links: f.links.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    }));
  };

  const removeLink = (index: number) => {
    setForm((f) => ({ ...f, links: f.links.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;

    const linksValidos = form.links
      .map((l) => ({ titulo: l.titulo?.trim() || "", url: l.url?.trim() || "" }))
      .filter((l) => l.url);

    const mainFields = getMainFields(form.arquivos);

    setLoading(true);
    try {
      await onSave({
        ...form,
        ...mainFields,
        links: linksValidos,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const renderArquivoPreview = (arquivo: DivulgacaoArquivo) => {
    const preview = arquivo.capa_url || (arquivo.tipo === "image" ? arquivo.url : "");

    if (preview) {
      return <img src={versionedUrl(preview)} alt={arquivo.nome} className="h-16 w-20 rounded-md object-cover border" />;
    }

    if (arquivo.tipo === "video") {
      return (
        <div className="h-16 w-20 rounded-md bg-black/80 flex items-center justify-center border">
          <Video className="h-6 w-6 text-white/70" />
        </div>
      );
    }

    return (
      <div className="h-16 w-20 rounded-md bg-muted flex items-center justify-center border">
        <FileText className={`h-6 w-6 ${arquivo.tipo === "ppt" ? "text-purple-500" : arquivo.tipo === "pdf" ? "text-red-500" : "text-muted-foreground"}`} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Divulgação" : "Nova Divulgação"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" value={form.titulo} onChange={set("titulo")} placeholder="Nome da divulgação" required autoFocus />
          </div>

          <div className="space-y-1">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" value={form.descricao} onChange={set("descricao")} placeholder="Detalhes da divulgação..." rows={4} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Categoria *</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={form.coluna_id} onValueChange={(v) => setForm((f) => ({ ...f, coluna_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {colunas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
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
              <Input id="responsavel_iniciais" value={form.responsavel_iniciais} onChange={set("responsavel_iniciais")} placeholder="Ex: AG, JP..." maxLength={5} />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Arquivos do card
                </Label>
                <p className="text-xs text-muted-foreground">Adicione mais de uma arte, PDF, vídeo ou PPT no mesmo card.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                Adicionar{uploadProgress !== null ? ` ${uploadProgress}%` : ""}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.pdf,.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              className="hidden"
              onChange={handleFileSelect}
            />

            {form.arquivos.length === 0 ? (
              <div
                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    <span className="text-xs text-muted-foreground">Enviando arquivo{uploadProgress !== null ? `... ${uploadProgress}%` : "..."}</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique para enviar um ou mais arquivos</span>
                    <span className="text-xs text-muted-foreground/60">JPG, PNG, GIF, WebP, MP4, WebM, PDF, PPT, PPTX — máx. 500 MB cada</span>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {form.arquivos.map((arquivo, index) => (
                  <div key={`${arquivo.url}-${index}`} className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2">
                    {renderArquivoPreview(arquivo)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{arquivo.nome}</p>
                      <p className="text-xs text-muted-foreground uppercase">{arquivo.tipo}{index === 0 ? " • capa principal" : ""}</p>
                    </div>
                    {index !== 0 && (arquivo.capa_url || arquivo.tipo === "image") && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setArquivoComoCapa(index)}>
                        Usar capa
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeArquivo(index)} title="Remover arquivo">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="imagem_url">URL de imagem externa/capa (opcional)</Label>
            <Input id="imagem_url" value={form.imagem_url} onChange={set("imagem_url")} placeholder="https://..." type="url" />
            {form.imagem_url && (
              <div className="mt-1 relative h-20 w-full overflow-hidden rounded-md border">
                <img src={versionedUrl(form.imagem_url)} alt="preview" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => setForm((f) => ({ ...f, imagem_url: "" }))} title="Remover imagem">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" />Links do card</Label>
                <p className="text-xs text-muted-foreground">Adicione um ou mais links para copiar/abrir no popup do card.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLink}><Plus className="h-3.5 w-3.5 mr-1" />Link</Button>
            </div>

            {form.links.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum link adicionado.</p>
            ) : (
              <div className="space-y-2">
                {form.links.map((link, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                    <Input value={link.titulo || ""} onChange={(e) => updateLink(index, "titulo", e.target.value)} placeholder="Nome do link" />
                    <Input value={link.url || ""} onChange={(e) => updateLink(index, "url", e.target.value)} placeholder="https://..." type="url" />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLink(index)} title="Remover link">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading || uploading}>Cancelar</Button>
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
