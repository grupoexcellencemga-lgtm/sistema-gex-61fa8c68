import type { MouseEvent } from "react";
import { Trash2, Edit, Video, ImageIcon, Calendar, EyeOff, Eye, Copy, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface Divulgacao {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria: string;
  status: string;
  coluna_id?: string | null;
  imagem_url?: string | null;
  arquivo_url?: string | null;
  arquivo_tipo?: string | null;
  arquivo_nome?: string | null;
  link_url?: string | null;
  link_urls?: { titulo?: string; url: string }[] | string | null;
  responsavel_iniciais?: string | null;
  data?: string | null;
  ativo?: boolean;
  created_at?: string;
}

const CATEGORIA_COLORS: Record<string, string> = {
  Comunicado: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campanha: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Evento: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Treinamento: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

type CardLink = { titulo?: string; url: string };

function normalizeLinks(item: Divulgacao): CardLink[] {
  const raw = item.link_urls;

  if (Array.isArray(raw)) {
    return raw
      .map((link: any) => ({
        titulo: String(link?.titulo || "").trim(),
        url: String(link?.url || "").trim(),
      }))
      .filter((link) => link.url);
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((link: any) => ({
            titulo: String(link?.titulo || "").trim(),
            url: String(link?.url || "").trim(),
          }))
          .filter((link) => link.url);
      }
    } catch {
      // Mantém compatibilidade caso venha texto simples.
    }
  }

  const legacy = item.link_url?.trim();
  return legacy ? [{ titulo: "Link", url: legacy }] : [];
}

interface Props {
  item: Divulgacao;
  onEdit: (item: Divulgacao) => void;
  onDelete: (id: string) => void;
  onViewFile: (item: Divulgacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  isDragging?: boolean;
}

export function DivulgacaoCard({
  item,
  onEdit,
  onDelete,
  onViewFile,
  onToggleAtivo,
  isDragging,
}: Props) {
  const arquivoUrl = item.arquivo_url;
  const isVideo = item.arquivo_tipo === "video";
  const isImageArquivo = item.arquivo_tipo === "image";
  const previewUrl = item.imagem_url || (isImageArquivo ? arquivoUrl : null);
  const ativo = item.ativo !== false;
  const links = normalizeLinks(item);

  const handleCopyLink = async (e: MouseEvent, url: string) => {
    e.stopPropagation();

    if (!url) {
      toast.error("Este card não possui link cadastrado.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch (error) {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleOpenLink = (e: MouseEvent, url: string) => {
    e.stopPropagation();

    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={() => onViewFile(item)}
      className={`relative bg-card border rounded-xl shadow-sm transition-all group select-none cursor-pointer ${
        isDragging
          ? "opacity-40 scale-95"
          : ativo
          ? "hover:shadow-md hover:border-primary/40"
          : "opacity-50 grayscale hover:opacity-70"
      }`}
      title="Clique para abrir o card"
    >
      {!ativo && (
        <div className="absolute top-1 left-1 z-10 bg-muted/90 text-muted-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full border">
          Inativo
        </div>
      )}

      {previewUrl && (
        <div className="w-full h-32 rounded-t-xl overflow-hidden">
          <img
            src={previewUrl}
            alt={item.titulo}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>
      )}

      {!previewUrl && isVideo && arquivoUrl && (
        <div className="w-full h-32 rounded-t-xl overflow-hidden bg-black/80 flex flex-col items-center justify-center hover:bg-black/60 transition-colors gap-1">
          <Video className="h-8 w-8 text-white/70" />
          <span className="text-white/60 text-[10px]">Clique para abrir</span>
        </div>
      )}

      {!previewUrl && !isVideo && (
        <div className="w-full h-24 rounded-t-xl overflow-hidden bg-muted/60 flex flex-col items-center justify-center gap-1">
          <ImageIcon className="h-7 w-7 text-muted-foreground/60" />
          <span className="text-muted-foreground text-[10px]">Clique para visualizar</span>
        </div>
      )}

      <div className="p-3 relative">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground leading-tight flex-1 whitespace-normal break-words">
            {item.titulo}
          </h3>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${
                ativo
                  ? "text-muted-foreground hover:text-amber-500"
                  : "text-amber-500 hover:text-green-500"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleAtivo(item.id, !ativo);
              }}
              title={ativo ? "Desativar card" : "Ativar card"}
            >
              {ativo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              title="Editar card"
            >
              <Edit className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="Excluir card"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {item.descricao && (
          <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap break-words leading-relaxed">
            {item.descricao}
          </p>
        )}

        {links.length > 0 && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>{links.length === 1 ? "1 link cadastrado" : `${links.length} links cadastrados`}</span>
            </div>

            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={`${link.url}-${index}`} className="rounded-md bg-background/70 border p-2 space-y-1.5">
                  {link.titulo && (
                    <p className="text-[11px] font-semibold text-foreground break-words">
                      {link.titulo}
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground break-all whitespace-normal">
                    {link.url}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={(e) => handleCopyLink(e, link.url)}
                      title="Copiar link"
                    >
                      <Copy className="h-3 w-3" />
                      Copiar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] gap-1"
                      onClick={(e) => handleOpenLink(e, link.url)}
                      title="Abrir link"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          <span
            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              CATEGORIA_COLORS[item.categoria] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {item.categoria}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            {item.data && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5" />
                {new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
            )}

            {item.responsavel_iniciais && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                {item.responsavel_iniciais}
              </span>
            )}
          </div>

          {(arquivoUrl || item.imagem_url) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onViewFile(item);
              }}
              title="Abrir card"
            >
              {isVideo ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
