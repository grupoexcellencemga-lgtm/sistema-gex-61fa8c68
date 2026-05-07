import { useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import type { Divulgacao, DivulgacaoLink } from "./DivulgacaoCard";

interface Props {
  item: Divulgacao | null;
  open: boolean;
  onClose: () => void;
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

export function DivulgacaoFileViewer({ item, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  const links = useMemo(() => normalizeLinks(item?.links), [item?.links]);

  if (!item) return null;

  const arquivoUrlBase = item.arquivo_url || item.imagem_url;
  const arquivoUrl = arquivoUrlBase
    ? `${arquivoUrlBase}${arquivoUrlBase.includes("?") ? "&" : "?"}v=${encodeURIComponent(item.updated_at || item.created_at || item.id)}`
    : "";
  const isVideo = item.arquivo_tipo === "video";
  const isPdf = item.arquivo_tipo === "pdf";
  const isPpt = item.arquivo_tipo === "ppt";
  const fileName =
    item.arquivo_nome ||
    `${item.titulo || "card-divulgacao"}.${isVideo ? "mp4" : isPdf ? "pdf" : isPpt ? "pptx" : "jpg"}`;

  const textoParaCopiar = [item.titulo, item.descricao]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const handleCopyText = async () => {
    if (!textoParaCopiar) {
      toast.error("Este card não possui texto para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(textoParaCopiar);
      setCopied(true);
      toast.success("Texto copiado!");

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch (error) {
      toast.error("Não foi possível copiar o texto.");
    }
  };

  const handleCopyLink = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkIndex(index);
      toast.success("Link copiado!");

      setTimeout(() => {
        setCopiedLinkIndex(null);
      }, 1800);
    } catch (error) {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleDownload = async () => {
    if (!arquivoUrl) {
      toast.error("Este card não possui arquivo para baixar.");
      return;
    }

    try {
      const response = await fetch(arquivoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (error) {
      window.open(arquivoUrl, "_blank", "noopener,noreferrer");
      toast.info("Abrindo o arquivo em uma nova aba.");
    }
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

              <DialogTitle className="text-sm font-medium truncate">
                {item.titulo}
              </DialogTitle>
            </div>

            <div className="flex flex-wrap items-center gap-2 pr-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                className="gap-1.5"
                disabled={!textoParaCopiar}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar texto"}
              </Button>

              {arquivoUrl && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar {isPdf ? "PDF" : isPpt ? "PPT" : "card"}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {arquivoUrl ? (
            <div className="bg-black/5 dark:bg-black/40 p-4">
              {isVideo ? (
                <div className="flex items-center justify-center">
                  <video
                    src={arquivoUrl}
                    controls
                    autoPlay={false}
                    className="max-w-full rounded-sm"
                    style={{ maxHeight: "68vh" }}
                  >
                    Seu navegador não suporta o player de vídeo.
                  </video>
                </div>
              ) : isPdf ? (
                <div className="w-full h-[70vh] rounded-md overflow-hidden border bg-background">
                  <iframe
                    src={arquivoUrl}
                    title={item.titulo}
                    className="w-full h-full"
                  />
                </div>
              ) : isPpt ? (
                <div className="min-h-[320px] rounded-md border bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <FileText className="h-14 w-14 text-purple-500" />
                  <div>
                    <p className="text-base font-semibold">PowerPoint anexado</p>
                    <p className="text-sm text-muted-foreground break-all mt-1">
                      {fileName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button onClick={() => window.open(arquivoUrl, "_blank", "noopener,noreferrer")} className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir
                    </Button>
                    <Button variant="outline" onClick={handleDownload} className="gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      Baixar PPT
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-center">
                  <img
                    src={arquivoUrl}
                    alt={item.titulo}
                    className="w-auto max-w-full h-auto object-contain rounded-sm"
                    style={{ maxHeight: "none" }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center min-h-[260px] bg-muted/40 text-muted-foreground gap-2">
              <ImageIcon className="h-10 w-10 opacity-50" />
              <p className="text-sm">Este card não possui imagem ou arquivo anexado.</p>
            </div>
          )}

          <div className="px-4 pt-4 pb-10 border-t bg-background space-y-5">
            {item.descricao ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Texto do card
                </p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {item.descricao}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum texto foi inserido neste card.
              </p>
            )}

            {links.length > 0 && (
              <div className="space-y-3 pb-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Links ({links.length})
                </p>

                <div className="space-y-2">
                  {links.map((link, index) => (
                    <div
                      key={`${link.url}-${index}`}
                      className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {link.titulo || `Link ${index + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground break-all">
                          {link.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(link.url, index)}
                          className="gap-1.5"
                        >
                          {copiedLinkIndex === index ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          Copiar
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(link.url, "_blank", "noopener,noreferrer")}
                          className="gap-1.5"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir
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
