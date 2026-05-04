import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Video, ImageIcon, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import type { Divulgacao } from "./DivulgacaoCard";

interface Props {
  item: Divulgacao | null;
  open: boolean;
  onClose: () => void;
}

export function DivulgacaoFileViewer({ item, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const arquivoUrl = item.arquivo_url || item.imagem_url;
  const isVideo = item.arquivo_tipo === "video";
  const fileName =
    item.arquivo_nome ||
    `${item.titulo || "card-divulgacao"}.${isVideo ? "mp4" : "jpg"}`;

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
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isVideo ? (
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            )}

            <DialogTitle className="text-sm font-medium truncate max-w-[360px]">
              {item.titulo}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyText}
              className="gap-1.5"
              disabled={!textoParaCopiar}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
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
                Baixar card
              </Button>
            )}
          </div>
        </DialogHeader>

        {arquivoUrl ? (
          <div
            className="flex items-center justify-center bg-black/5 dark:bg-black/40"
            style={{ minHeight: 300, maxHeight: "72vh" }}
          >
            {isVideo ? (
              <video
                src={arquivoUrl}
                controls
                autoPlay={false}
                className="max-w-full rounded-sm"
                style={{ maxHeight: "68vh" }}
              >
                Seu navegador não suporta o player de vídeo.
              </video>
            ) : (
              <img
                src={arquivoUrl}
                alt={item.titulo}
                className="max-w-full object-contain"
                style={{ maxHeight: "68vh" }}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[260px] bg-muted/40 text-muted-foreground gap-2">
            <ImageIcon className="h-10 w-10 opacity-50" />
            <p className="text-sm">Este card não possui imagem ou arquivo anexado.</p>
          </div>
        )}

        <div className="px-4 py-3 border-t bg-background">
          {item.descricao ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Texto do card
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {item.descricao}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum texto foi inserido neste card.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}