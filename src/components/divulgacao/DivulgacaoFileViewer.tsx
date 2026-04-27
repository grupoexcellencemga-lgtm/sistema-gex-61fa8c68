import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Video, ImageIcon } from "lucide-react";
import type { Divulgacao } from "./DivulgacaoCard";

interface Props {
  item: Divulgacao | null;
  open: boolean;
  onClose: () => void;
}

export function DivulgacaoFileViewer({ item, open, onClose }: Props) {
  if (!item) return null;

  const arquivoUrl = item.arquivo_url;
  const isVideo = item.arquivo_tipo === "video";
  const fileName = item.arquivo_nome ?? (isVideo ? "video.mp4" : "imagem.jpg");

  if (!arquivoUrl) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl w-full p-0 overflow-hidden gap-0">
        <DialogHeader className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            {isVideo ? (
              <Video className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            )}
            <DialogTitle className="text-sm font-medium truncate max-w-[400px]">
              {item.titulo}
            </DialogTitle>
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <a href={arquivoUrl} download={fileName} target="_blank" rel="noopener noreferrer">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Baixar
            </a>
          </Button>
        </DialogHeader>

        <div className="flex items-center justify-center bg-black/5 dark:bg-black/40" style={{ minHeight: 300, maxHeight: "72vh" }}>
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

        {item.descricao && (
          <div className="px-4 py-3 text-sm text-muted-foreground border-t bg-background">
            {item.descricao}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
