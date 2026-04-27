import { Trash2, Edit, Video, ImageIcon, Calendar, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface Props {
  item: Divulgacao;
  onEdit: (item: Divulgacao) => void;
  onDelete: (id: string) => void;
  onViewFile: (item: Divulgacao) => void;
  onToggleAtivo: (id: string, ativo: boolean) => void;
  isDragging?: boolean;
}

export function DivulgacaoCard({ item, onEdit, onDelete, onViewFile, onToggleAtivo, isDragging }: Props) {
  const arquivoUrl = item.arquivo_url;
  const isVideo = item.arquivo_tipo === "video";
  const isImageArquivo = item.arquivo_tipo === "image";
  const previewUrl = item.imagem_url || (isImageArquivo ? arquivoUrl : null);
  const ativo = item.ativo !== false; // default true se undefined

  return (
    <div
      className={`relative bg-card border rounded-xl shadow-sm transition-all group select-none ${
        isDragging
          ? "opacity-40 scale-95"
          : ativo
          ? "hover:shadow-md"
          : "opacity-50 grayscale hover:opacity-70"
      }`}
    >
      {/* Badge "Inativo" */}
      {!ativo && (
        <div className="absolute top-1 left-1 z-10 bg-muted/90 text-muted-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded-full border">
          Inativo
        </div>
      )}

      {/* Preview de imagem ou arquivo de imagem no topo */}
      {previewUrl && (
        <div
          className={`w-full h-32 rounded-t-xl overflow-hidden ${arquivoUrl ? "cursor-pointer" : ""}`}
          onClick={() => arquivoUrl && onViewFile(item)}
        >
          <img
            src={previewUrl}
            alt={item.titulo}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
          />
        </div>
      )}

      {/* Preview de vídeo no topo */}
      {!previewUrl && isVideo && arquivoUrl && (
        <div
          className="w-full h-32 rounded-t-xl overflow-hidden bg-black/80 flex flex-col items-center justify-center cursor-pointer hover:bg-black/60 transition-colors gap-1"
          onClick={() => onViewFile(item)}
        >
          <Video className="h-8 w-8 text-white/70" />
          <span className="text-white/60 text-[10px]">Clique para abrir</span>
        </div>
      )}

      <div className="p-3 relative">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-card-foreground leading-tight line-clamp-2 flex-1">
            {item.titulo}
          </h3>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {/* Toggle ativo/inativo */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 ${ativo ? "text-muted-foreground hover:text-amber-500" : "text-amber-500 hover:text-green-500"}`}
              onClick={(e) => { e.stopPropagation(); onToggleAtivo(item.id, !ativo); }}
              title={ativo ? "Desativar card" : "Ativar card"}
            >
              {ativo ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {item.descricao && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descricao}</p>
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

          {arquivoUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); onViewFile(item); }}
            >
              {isVideo ? <Video className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
