import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Video,
  ImageIcon,
  Copy,
  Check,
  FileText,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import type { Divulgacao, DivulgacaoArquivo, DivulgacaoLink } from "./DivulgacaoCard";
import { normalizeArquivos } from "./DivulgacaoCard";

interface Props {
  item: Divulgacao | null;
  open: boolean;
  onClose: () => void;
}

const normalizeLinks = (links: Divulgacao["links"]): DivulgacaoLink[] => {
  if (!links) return [];
  if (Array.isArray(links)) return links.filter((l) => l?.url);
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

const versionedUrl = (url: string, version?: string) =>
  `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || String(Date.now()))}`;

const getFileName = (item: Divulgacao, arquivo?: DivulgacaoArquivo | null) => {
  if (arquivo?.nome) return arquivo.nome;
  const tipo = arquivo?.tipo || item.arquivo_tipo;
  return item.arquivo_nome || `${item.titulo || "card-divulgacao"}.${tipo === "video" ? "mp4" : tipo === "pdf" ? "pdf" : tipo === "ppt" ? "pptx" : "jpg"}`;
};

export function DivulgacaoFileViewer({ item, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const links = useMemo(() => normalizeLinks(item?.links), [item?.links]);
  const arquivos = useMemo(() => normalizeArquivos(item?.arquivos, item), [item]);

  useEffect(() => {
    if (open) setSelectedFileIndex(0);
  }, [open, item?.id]);

  if (!item) return null;

  const selectedFile = arquivos[selectedFileIndex] || null;
  const arquivoUrlBase = selectedFile?.url || item.arquivo_url || item.imagem_url || "";
  const arquivoUrl = arquivoUrlBase
    ? versionedUrl(arquivoUrlBase, item.updated_at || item.created_at || item.id)
    : "";
  const arquivoTipo = selectedFile?.tipo || item.arquivo_tipo;
  const isVideo = arquivoTipo === "video";
  const isPdf = arquivoTipo === "pdf";
  const isPpt = arquivoTipo === "ppt";
  const fileName = getFileName(item, selectedFile);

  const textoParaCopiar = [item.titulo, item.descricao].filter(Boolean).join("\n\n").trim();

  const handleCopyText = async () => {
    if (!textoParaCopiar) {
      toast.error("Este card não possui texto para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      setCopied(true);
      toast.success("Texto copiado!");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  };

  const handleCopyLink = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkIndex(index);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedLinkIndex(null), 1800);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleDownload = async (url = arquivoUrl, name = fileName) => {
    if (!url) {
      toast.error("Este card não possui arquivo para baixar.");
      return;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);

      toast.success("Download iniciado!");
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.info("Abrindo o arquivo em uma nova aba.");
    }
  };

  const renderSelectedFile = () => {
    if (!arquivoUrl) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[260px] bg-muted/40 text-muted-foreground gap-2">
          <ImageIcon className="h-10 w-10 opacity-50" />
          <p className="text-sm">Este card não possui imagem ou arquivo anexado.</p>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="flex items-center justify-center">
          <video src={arquivoUrl} controls autoPlay={false} className="max-w-full rounded-sm" style={{ maxHeight: "68vh" }}>
            Seu navegador não suporta o player de vídeo.
          </video>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="w-full h-[70vh] rounded-md overflow-hidden border bg-background">
          <iframe src={arquivoUrl} title={item.titulo} className="w-full h-full" />
        </div>
      );
    }

    if (isPpt) {
      return (
        <div className="min-h-[320px] rounded-md border bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
          <FileText className="h-14 w-14 text-purple-500" />
          <div>
            <p className="text-base font-semibold">PowerPoint anexado</p>
            <p className="text-sm text-muted-foreground break-all mt-1">{fileName}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => window.open(arquivoUrl, "_blank", "noopener,noreferrer")} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir
            </Button>
            <Button variant="outline" onClick={() => handleDownload()} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Baixar PPT
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start justify-center">
        <img src={arquivoUrl} alt={item.titulo} className="w-auto max-w-full h-auto object-contain rounded-sm" style={{ maxHeight: "none" }} />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[calc(100vw-2rem)] h-[94vh] max-h-[94vh] p-0 overflow-hidden gap-0 flex flex-col">
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 min-w-0 pr-8">
              {isVideo ? (
                <Video className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : isPdf || isPpt ? (
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              )}

              <DialogTitle className="text-sm font-medium truncate">{item.titulo}</DialogTitle>
            </div>

            <div className="flex flex-wrap items-center gap-2 pr-8">
              <Button variant="outline" size="sm" onClick={handleCopyText} className="gap-1.5" disabled={!textoParaCopiar}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>

              {arquivoUrl && (
                <Button variant="default" size="sm" onClick={() => handleDownload()} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Baixar arquivo
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {arquivos.length > 1 && (
            <div className="px-4 py-3 border-b bg-background flex gap-2 overflow-x-auto">
              {arquivos.map((arquivo, index) => (
                <button
                  key={`${arquivo.url}-${index}`}
                  type="button"
                  onClick={() => setSelectedFileIndex(index)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs min-w-[180px] transition-colors ${
                    selectedFileIndex === index ? "bg-primary/10 border-primary text-primary" : "bg-muted/20 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium truncate">{arquivo.nome}</span>
                  </div>
                  <div className="uppercase text-[10px] opacity-70 mt-0.5">{arquivo.tipo}</div>
                </button>
              ))}
            </div>
          )}

          <div className="bg-black/5 dark:bg-black/40 p-4">{renderSelectedFile()}</div>

          <div className="px-4 pt-4 pb-10 border-t bg-background space-y-5">
            {arquivos.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Arquivos ({arquivos.length})
                </p>
                <div className="space-y-2">
                  {arquivos.map((arquivo, index) => {
                    const url = versionedUrl(arquivo.url, item.updated_at || item.created_at || item.id);
                    return (
                      <div key={`${arquivo.url}-list-${index}`} className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{arquivo.nome}</p>
                          <p className="text-xs text-muted-foreground break-all">{arquivo.tipo.toUpperCase()}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button variant="outline" size="sm" onClick={() => setSelectedFileIndex(index)} className="gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" /> Ver
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDownload(url, arquivo.nome)} className="gap-1.5">
                            <Download className="h-3.5 w-3.5" /> Baixar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {item.descricao ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Texto do card</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">{item.descricao}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum texto foi inserido neste card.</p>
            )}

            {links.length > 0 && (
              <div className="space-y-3 pb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Links ({links.length})</p>

                <div className="space-y-2">
                  {links.map((link, index) => (
                    <div key={`${link.url}-${index}`} className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{link.titulo || `Link ${index + 1}`}</p>
                        <p className="text-xs text-muted-foreground break-all">{link.url}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => handleCopyLink(link.url, index)} className="gap-1.5">
                          {copiedLinkIndex === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          Copiar
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")} className="gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
