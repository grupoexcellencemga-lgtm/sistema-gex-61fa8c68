import {
  Trash2,
  Edit,
  Video,
  ImageIcon,
  Calendar,
  EyeOff,
  Eye,
  FileText,
  GripVertical,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type DivulgacaoLink = {
  titulo?: string;
  url: string;
};

export interface Divulgacao {
  id: string;
  titulo: string;
  descricao?: string | null;
  categoria: string;
  status: string;
  coluna_id?: string | null;
  ordem?: number | null;
  imagem_url?: string | null;
  arquivo_url?: string | null;
  arquivo_tipo?: string | null;
  arquivo_nome?: string | null;
  responsavel_iniciais?: string | null;
  data?: string | null;
  ativo?: boolean;
  links?: DivulgacaoLink[] | string | null;
  created_at?: string;
  updated_at?: string;
}

const CATEGORIA_COLORS: Record<string, string> = {
  Comunicado: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campanha: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Evento: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Treinamento: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
};

interface Props {
  item: Divulgacao;
  onEdit: (item: Divulgacao) => void;
  onDelete: (id: string) => void;
  onViewFile: (item: Divulgacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  isDragging?: boolean;
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
  const isPdf = item.arquivo_tipo === "pdf";
  const isImageArquivo = item.arquivo_tipo === "image";
  const previewUrlBase = item.imagem_url || (isImageArquivo ? arquivoUrl : null);
  const previewUrl = previewUrlBase
    ? `${previewUrlBase}${previewUrlBase.includes("?") ? "&" : "?"}v=${encodeURIComponent(item.updated_at || item.created_at || item.id)}`
    : null;
  const ativo = item.ativo !== false;
  const links = normalizeLinks(item.links);

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
      <div className="absolute top-2 right-2 z-10 hidden group-hover:flex items-center justify-center h-6 w-6 rounded-md bg-background/90 border text-muted-foreground shadow-sm">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

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

      {!previewUrl && isPdf && arquivoUrl && (
        <div className="w-full h-32 rounded-t-xl overflow-hidden bg-red-50 dark:bg-red-950/30 flex flex-col items-center justify-center hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors gap-1">
          <FileText className="h-8 w-8 text-red-500" />
          <span className="text-red-600 dark:text-red-300 text-[10px] font-medium">
            PDF anexado
          </span>
        </div>
      )}

      {!previewUrl && !isVideo && !isPdf && (
        <div className="w-full h-24 rounded-t-xl overflow-hidden bg-muted/60 flex flex-col items-center justify-center gap-1">
          <ImageIcon className="h-7 w-7 text-muted-foreground/60" />
          <span className="text-muted-foreground text-[10px]">Clique para visualizar</span>
        </div>
      )}

      <div className="p-3 relative">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground leading-tight line-clamp-2 flex-1">
            {item.titulo}
          </h3>

          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pr-7">
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
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {item.descricao}
          </p>
        )}

        <div className="flex flex-wrap gap-1 mt-2">
          <span
            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              CATEGORIA_COLORS[item.categoria] ?? "bg-muted text-muted-foreground"
            }`}
          >
            {item.categoria}
          </span>

          {isPdf && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <FileText className="h-2.5 w-2.5" />
              PDF
            </span>
          )}

          {links.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              <LinkIcon className="h-2.5 w-2.5" />
              {links.length} link{links.length > 1 ? "s" : ""}
            </span>
          )}
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

          {(arquivoUrl || item.imagem_url || links.length > 0) && (
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
              ) : isPdf ? (
                <FileText className="h-3.5 w-3.5" />
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
